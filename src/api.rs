use crate::store::{self, Store};
use gtk4::glib;
use serde_json::{Value, json};
use std::{cell::RefCell, path::PathBuf};

pub struct Api {
    data: RefCell<Store>,
    path: PathBuf,
    _lock: std::fs::File,
}

impl Api {
    pub fn open() -> store::Result<Self> {
        let path = Store::path();
        let lock = store::lock(&path)?;
        let data = Store::open(&path)?;
        Ok(Self {
            data: RefCell::new(data),
            path,
            _lock: lock,
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
        if path == "/api/backup" {
            return match method {
                "GET" => (200, json!(*self.data.borrow())),
                "POST" => {
                    let incoming = match Store::decode(body) {
                        Ok(data) => data,
                        Err(error) => return invalid(error),
                    };
                    let mut next = self.data.borrow().clone();
                    let added = next.merge(incoming);
                    self.write(next, json!({ "added": added }))
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
