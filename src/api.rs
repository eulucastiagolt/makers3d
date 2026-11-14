use crate::filament::Filament;
use crate::printer::Printer;
use crate::store::{self, Settings, Store};
use gtk4::glib;
use serde_json::{Value, json};
use std::{
    cell::RefCell,
    path::PathBuf,
    sync::{Arc, Mutex},
};

type ChatProgress = (String, Arc<Mutex<String>>);

pub struct Api {
    chat_progress: RefCell<Option<ChatProgress>>,
    data: RefCell<Store>,
    proposal: RefCell<Option<(String, Value, Value)>>,
    path: PathBuf,
    _lock: std::fs::File,
}

impl Api {
    pub fn open() -> store::Result<Self> {
        let path = Store::path();
        let lock = store::lock(&path)?;
        let data = Store::open(&path)?;
        Ok(Self {
            chat_progress: RefCell::new(None),
            data: RefCell::new(data),
            proposal: RefCell::new(None),
            path,
            _lock: lock,
        })
    }

    pub fn stage_chat_result(&self, mut result: Value) -> (u32, Value) {
        self.proposal.replace(None);
        let Some(action) = result
            .as_object_mut()
            .and_then(|object| object.remove("proposal"))
        else {
            return (200, result);
        };
        let prepared = match self.prepare_action(&action) {
            Ok(prepared) => prepared,
            Err(error) => {
                return (
                    200,
                    json!({"reply": format!("Não foi possível preparar a ação: {error}")}),
                );
            }
        };
        let id = glib::uuid_string_random().to_string();
        self.proposal
            .replace(Some((id.clone(), action, prepared.preview.clone())));
        (
            200,
            json!({"action": {"id": id, "preview": prepared.preview}}),
        )
    }

    fn prepare_action(&self, action: &Value) -> store::Result<crate::chat_actions::Prepared> {
        let proposal: crate::chat_actions::Proposal = serde_json::from_value(action.clone())?;
        proposal.prepare(&self.data.borrow())
    }

    fn confirm_action(&self, body: &[u8]) -> (u32, Value) {
        let input: Value = match serde_json::from_slice(body) {
            Ok(input) => input,
            Err(_) => return (400, json!({"error": "Confirmação inválida."})),
        };
        let mut pending = self.proposal.borrow_mut();
        if !pending
            .as_ref()
            .is_some_and(|(id, _, _)| input["id"] == id.as_str())
        {
            return (
                409,
                json!({"error": "A proposta expirou. Peça a ação novamente."}),
            );
        }
        let Some((_, action, preview)) = pending.take() else {
            unreachable!()
        };
        drop(pending);
        let prepared = match self.prepare_action(&action) {
            Ok(prepared) if prepared.preview == preview => prepared,
            _ => {
                return (
                    409,
                    json!({"error": "Os dados mudaram. Peça uma nova proposta antes de confirmar."}),
                );
            }
        };
        self.dispatch(
            prepared.method,
            &prepared.path,
            None,
            prepared.payload.to_string().as_bytes(),
        )
    }

    pub fn start_chat_progress(&self, body: &[u8]) -> Option<Arc<Mutex<String>>> {
        let request: Value = serde_json::from_slice(body).ok()?;
        let id = request["progress_id"].as_str()?;
        if !glib::uuid_string_is_valid(id) {
            return None;
        }
        let text = Arc::new(Mutex::new(String::new()));
        self.chat_progress
            .replace(Some((id.to_owned(), text.clone())));
        Some(text)
    }

    pub fn chat_context(&self) -> Value {
        let data = self.data.borrow();
        json!({
            "orcamentos_impressao_3d": data.printing,
            "orcamentos_marketplace": data.marketplace,
            "impressoras": data.printers,
            "filamentos": data.filaments,
            "configuracoes": data.settings.as_ref().unwrap_or(&Settings { electricity_rate: 1.0 }),
        })
    }

    fn write(&self, next: Store, result: Value) -> (u32, Value) {
        match next.save(&self.path) {
            Ok(()) => {
                self.data.replace(next);
                (200, result)
            }
            Err(error) => (
                500,
                json!({"error": format!("Falha ao gravar os dados: {error}")}),
            ),
        }
    }

    pub fn dispatch(
        &self,
        method: &str,
        path: &str,
        query: Option<&str>,
        body: &[u8],
    ) -> (u32, Value) {
        let missing = || (404, json!({"error": "Orçamento ou rota inexistente."}));
        let invalid = |error: Box<dyn std::error::Error>| {
            (400, json!({"error": format!("Dados inválidos: {error}")}))
        };
        if path == "/api/chat/connection" {
            return crate::chat_connection::dispatch(
                &self.path.with_file_name("conexao-chat.json"),
                method,
                body,
            );
        }
        if path == "/api/chat/history" || path.starts_with("/api/chat/history/") {
            return crate::chat_history::dispatch(
                &self.path.with_file_name("conversas"),
                method,
                path.strip_prefix("/api/chat/history/"),
                body,
            );
        }
        if method == "GET" && path == "/api/chat/progress" {
            let progress = self.chat_progress.borrow();
            let text = progress
                .as_ref()
                .filter(|(id, _)| {
                    query.and_then(|query| query.split('&').next()) == Some(id.as_str())
                })
                .and_then(|(_, text)| text.lock().ok());
            return (
                200,
                json!({"text": text.as_deref().map_or("", String::as_str)}),
            );
        }
        if method == "POST" && path == "/api/chat/confirm" {
            return self.confirm_action(body);
        }
        if path == "/api/settings" {
            return match method {
                "GET" => (
                    200,
                    json!(self.data.borrow().settings.as_ref().unwrap_or(&Settings {
                        electricity_rate: 1.0
                    })),
                ),
                "PUT" => {
                    let settings: Settings = match serde_json::from_slice(body) {
                        Ok(settings) => settings,
                        Err(error) => return invalid(error.into()),
                    };
                    if let Err(error) = settings.validate() {
                        return invalid(error);
                    }
                    let result = json!(settings);
                    let mut next = self.data.borrow().clone();
                    next.settings = Some(settings);
                    self.write(next, result)
                }
                _ => missing(),
            };
        }
        if path == "/api/backup" {
            return match method {
                "GET" => (200, json!(*self.data.borrow())),
                "POST" => {
                    let incoming = match Store::decode(body) {
                        Ok(data) => data,
                        Err(error) => return invalid(error),
                    };
                    let mut next = self.data.borrow().clone();
                    let (added, printers, filaments) = next.merge(incoming);
                    self.write(
                        next,
                        json!({ "added": added, "printers": printers, "filaments": filaments }),
                    )
                }
                _ => missing(),
            };
        }
        if path == "/api/printers" || path.starts_with("/api/printers/") {
            let id = path.strip_prefix("/api/printers/");
            if method == "GET" && id.is_none() {
                return (200, json!(self.data.borrow().printers));
            }
            let mut next = self.data.borrow().clone();
            let index = id.and_then(|id| next.printers.iter().position(|printer| printer.id == id));
            return match (method, id, index) {
                ("POST", None, None) | ("PUT", Some(_), Some(_)) => {
                    let mut printer: Printer = match serde_json::from_slice(body) {
                        Ok(printer) => printer,
                        Err(error) => return invalid(error.into()),
                    };
                    if let Err(error) = printer.validate() {
                        return invalid(error.into());
                    }
                    if let Some(index) = index {
                        printer.id = next.printers[index].id.clone();
                        next.printers[index] = printer.clone();
                    } else {
                        printer.id = glib::uuid_string_random().to_string();
                        next.printers.push(printer.clone());
                    }
                    self.write(next, json!(printer))
                }
                ("DELETE", Some(_), Some(index)) => {
                    next.printers.remove(index);
                    self.write(next, json!({"deleted": true}))
                }
                _ => missing(),
            };
        }
        if path == "/api/filaments" || path.starts_with("/api/filaments/") {
            let id = path.strip_prefix("/api/filaments/");
            if method == "GET" && id.is_none() {
                return (200, json!(self.data.borrow().filaments));
            }
            let mut next = self.data.borrow().clone();
            let index =
                id.and_then(|id| next.filaments.iter().position(|filament| filament.id == id));
            return match (method, id, index) {
                ("POST", None, None) | ("PUT", Some(_), Some(_)) => {
                    let mut filament: Filament = match serde_json::from_slice(body) {
                        Ok(filament) => filament,
                        Err(error) => return invalid(error.into()),
                    };
                    if let Err(error) = filament.validate() {
                        return invalid(error.into());
                    }
                    if let Some(index) = index {
                        filament.id = next.filaments[index].id.clone();
                        next.filaments[index] = filament.clone();
                    } else {
                        filament.id = glib::uuid_string_random().to_string();
                        next.filaments.push(filament.clone());
                    }
                    self.write(next, json!(filament))
                }
                ("DELETE", Some(_), Some(index)) => {
                    next.filaments.remove(index);
                    self.write(next, json!({"deleted": true}))
                }
                _ => missing(),
            };
        }
        let mut pieces = path.trim_start_matches("/api/").split('/');
        let market = match pieces.next() {
            Some("budgets") => false,
            Some("marketplace-budgets") => true,
            _ => return missing(),
        };
        let id = pieces.next();
        if pieces.next().is_some() {
            return missing();
        }
        let mut next = self.data.borrow().clone();
        let rows = if market {
            &mut next.marketplace
        } else {
            &mut next.printing
        };
        let index = id.and_then(|id| rows.iter().position(|row| row["id"] == id));
        if id.is_some() && index.is_none() {
            return missing();
        }
        match (method, index) {
            ("GET", Some(index)) => (200, rows[index].clone()),
            ("GET", None) => {
                let filter = query.and_then(|query| query.strip_prefix("marketplace="));
                rows.retain(|row| {
                    !market || filter.is_none_or(|value| row["marketplace"] == value)
                });
                rows.sort_by(|a, b| b["createdAt"].as_str().cmp(&a["createdAt"].as_str()));
                (200, json!(rows))
            }
            ("DELETE", Some(index)) => {
                rows.remove(index);
                self.write(next, json!({ "deleted": true }))
            }
            ("POST", None) | ("PUT", Some(_)) => {
                let input: Value = match serde_json::from_slice(body) {
                    Ok(data) => data,
                    Err(error) => return invalid(error.into()),
                };
                let mut row = match store::validate(&input, market) {
                    Ok(row) => row,
                    Err(error) => return invalid(error),
                };
                let Ok(now) = glib::DateTime::now_utc().and_then(|date| date.format_iso8601())
                else {
                    return (
                        500,
                        json!({"error": "Não foi possível obter a data atual."}),
                    );
                };
                row["updatedAt"] = json!(now.as_str());
                if let Some(index) = index {
                    row["id"] = rows[index]["id"].clone();
                    row["createdAt"] = rows[index]["createdAt"].clone();
                    rows[index] = row.clone();
                } else {
                    row["id"] = json!(glib::uuid_string_random().as_str());
                    row["createdAt"] = row["updatedAt"].clone();
                    rows.push(row.clone());
                }
                self.write(next, row)
            }
            _ => missing(),
        }
    }
}

#[cfg(test)]
mod chat_action_tests {
    use super::*;

    #[test]
    fn chat_budget_requires_confirmation_and_persists_calculated_results() {
        let temporary = tempfile::tempdir().unwrap();
        let path = temporary.path().join("orcamentos.json");
        let data = Store::decode(br#"{
            "version":2,"printing":[],"marketplace":[],
            "printers":[{"id":"d83400f1-b9f5-47b0-ac5c-c76ca5d826af","name":"A1","price":1500,"power":300,"lifetime":4000,"maintenance":10}],
            "filaments":[{"id":"fb5f175b-9185-4dbc-84da-a2644cf74837","name":"PLA","material":"PLA","price":100,"weight":1000}]
        }"#).unwrap();
        let api = Api {
            chat_progress: RefCell::new(None),
            data: RefCell::new(data),
            proposal: RefCell::new(None),
            _lock: store::lock(&path).unwrap(),
            path,
        };
        let (status, response) = api.stage_chat_result(json!({"proposal":{
            "operation":"create","resource":"printing",
            "data":{"name":"Vaso","pesoPeca":20,"tempoImpressao":2,
                    "printerId":"d83400f1-b9f5-47b0-ac5c-c76ca5d826af","filamentId":"fb5f175b-9185-4dbc-84da-a2644cf74837"}
        }}));
        assert_eq!(status, 200);
        assert!(api.data.borrow().printing.is_empty());
        assert_eq!(response["action"]["preview"]["data"]["precoVenda"], 26.58);
        let confirm = json!({"id":response["action"]["id"]}).to_string();
        let (status, row) = api.dispatch("POST", "/api/chat/confirm", None, confirm.as_bytes());
        assert_eq!(status, 200);
        assert_eq!(row["custoTotal"], 14.77);
        assert_eq!(Store::open(&api.path).unwrap().printing[0]["name"], "Vaso");
        assert_eq!(
            api.dispatch("POST", "/api/chat/confirm", None, confirm.as_bytes())
                .0,
            409
        );
    }
}
