use crate::{
    calc::{self, Kind, Options},
    store::{self, Store},
};
use serde::Deserialize;
use serde_json::{Value, json};

#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
enum Resource {
    Printing,
    Marketplace,
    Printers,
    Filaments,
    Settings,
}

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
enum Operation {
    Create,
    Update,
    Delete,
}

#[derive(Deserialize)]
pub struct Proposal {
    operation: Operation,
    resource: Resource,
    id: Option<String>,
    #[serde(default)]
    data: serde_json::Map<String, Value>,
}

pub struct Prepared {
    pub method: &'static str,
    pub path: String,
    pub payload: Value,
    pub preview: Value,
}

impl Proposal {
    pub fn prepare(self, store: &Store) -> store::Result<Prepared> {
        let (route, label, mut current) = match self.resource {
            Resource::Printing => (
                "budgets",
                "Orçamento de impressão 3D",
                json!(store.printing),
            ),
            Resource::Marketplace => (
                "marketplace-budgets",
                "Orçamento de marketplace",
                json!(store.marketplace),
            ),
            Resource::Printers => ("printers", "Impressora", json!(store.printers)),
            Resource::Filaments => ("filaments", "Filamento", json!(store.filaments)),
            Resource::Settings => ("settings", "Configurações", json!(store.settings)),
        };
        let mut path = format!("/api/{route}");
        let creating = matches!(self.operation, Operation::Create);
        let deleting = matches!(self.operation, Operation::Delete);
        if matches!(self.resource, Resource::Settings) {
            if creating || deleting {
                return Err("Configurações só podem ser atualizadas.".into());
            }
        } else if !creating {
            let id = self
                .id
                .as_deref()
                .ok_or("Informe o identificador do registro.")?;
            current = current
                .as_array()
                .and_then(|rows| rows.iter().find(|row| row["id"] == id))
                .cloned()
                .ok_or("O registro indicado não foi encontrado.")?;
            path.push('/');
            path.push_str(id);
        }
        let mut payload = if creating || current.is_null() {
            json!({})
        } else {
            current.clone()
        };
        let method = if deleting {
            "DELETE"
        } else if creating {
            "POST"
        } else {
            "PUT"
        };
        if !deleting {
            for (key, value) in self.data {
                let allowed = match self.resource {
                    Resource::Printing => matches!(
                        key.as_str(),
                        "name"
                            | "printerId"
                            | "filamentId"
                            | "pesoPeca"
                            | "tempoImpressao"
                            | "taxaFalhaPercentual"
                            | "valorHoraTrabalho"
                            | "tempoPreparacao"
                            | "tempoPosProcessamento"
                            | "margemLucro"
                    ),
                    Resource::Marketplace => {
                        store::MARKET.contains(&key.as_str())
                            || matches!(
                                key.as_str(),
                                "name"
                                    | "marketplace"
                                    | "pricingMode"
                                    | "shippingMode"
                                    | "freeShipping"
                                    | "highlightCampaigns"
                            )
                    }
                    Resource::Printers => matches!(
                        key.as_str(),
                        "name" | "price" | "power" | "lifetime" | "maintenance"
                    ),
                    Resource::Filaments => matches!(
                        key.as_str(),
                        "name" | "material" | "color" | "price" | "weight"
                    ),
                    Resource::Settings => key == "electricityRate",
                };
                if !allowed {
                    return Err(format!("Campo não permitido nesta ação: {key}.").into());
                }
                payload[&key] = value;
            }
            payload = match self.resource {
                Resource::Printing => printing(payload, store, creating)?,
                Resource::Marketplace => marketplace(payload)?,
                Resource::Printers => {
                    let mut item: crate::printer::Printer = serde_json::from_value(payload)?;
                    item.validate()?;
                    json!(item)
                }
                Resource::Filaments => {
                    let mut item: crate::filament::Filament = serde_json::from_value(payload)?;
                    item.validate()?;
                    json!(item)
                }
                Resource::Settings => {
                    let settings: crate::store::Settings = serde_json::from_value(payload)?;
                    settings.validate()?;
                    json!(settings)
                }
            };
        }
        let title = match self.operation {
            Operation::Create => "Cadastrar",
            Operation::Update => "Atualizar",
            Operation::Delete => "Excluir",
        };
        let shown = if deleting { &current } else { &payload };
        let preview =
            json!({"title": format!("{title} · {label}"), "data": shown, "previous": current});
        Ok(Prepared {
            method,
            path,
            payload,
            preview,
        })
    }
}

fn printing(mut data: Value, store: &Store, creating: bool) -> store::Result<Value> {
    if creating || !data["printerId"].is_null() {
        let id = data["printerId"]
            .as_str()
            .ok_or("Selecione uma impressora cadastrada.")?;
        let printer = store
            .printers
            .iter()
            .find(|item| item.id == id)
            .ok_or("Impressora não encontrada.")?;
        data["potenciaImpressora"] = json!(printer.power);
        data["precoImpressora"] = json!(printer.price);
        data["vidaUtilHoras"] = json!(printer.lifetime);
        data["percentualManutencao"] = json!(printer.maintenance);
    }
    if creating || !data["filamentId"].is_null() {
        let id = data["filamentId"]
            .as_str()
            .ok_or("Selecione um filamento cadastrado.")?;
        let filament = store
            .filaments
            .iter()
            .find(|item| item.id == id)
            .ok_or("Filamento não encontrado.")?;
        data["precoRoloFilamento"] = json!(filament.price);
        data["pesoRoloFilamento"] = json!(filament.weight);
    }
    if creating {
        data["tarifaEnergia"] = json!(
            store
                .settings
                .as_ref()
                .map_or(1.0, |settings| settings.electricity_rate)
        );
        for (index, key) in store::PRINT.iter().enumerate().skip(9) {
            if data[*key].is_null() {
                data[*key] = json!(calc::PRINT_FIELDS[index].1);
            }
        }
    }
    let values = numbers(&data, store::PRINT)?;
    let quote = calc::calculate(Kind::Print, &values, Options::default())?;
    data["custoTotal"] = json!(quote.cost);
    data["precoVenda"] = json!(quote.price);
    store::validate(&data, false)
}

fn marketplace(mut data: Value) -> store::Result<Value> {
    let kind = match data["marketplace"].as_str() {
        Some("shopee") => Kind::Shopee,
        Some("tiktok") => Kind::TikTok,
        Some("mercadolivre") => Kind::MercadoLivre,
        _ => return Err("Selecione um marketplace válido.".into()),
    };
    for key in store::MARKET {
        if !matches!(*key, "productCost" | "desiredMargin") && data[*key].is_null() {
            data[*key] = json!(if *key == "categoryPercentage" {
                11.0
            } else {
                0.0
            });
        }
    }
    let options = Options {
        by_price: data["pricingMode"] == "price",
        auto_shipping: data["shippingMode"] == "auto",
        free_shipping: data["freeShipping"] == true,
        campaigns: data["highlightCampaigns"] == true,
    };
    let quote = calc::calculate(kind, &numbers(&data, store::MARKET)?, options)?;
    let [fees, commission, fixed, additional] = quote.market_fees.ok_or("Taxas indisponíveis.")?;
    for (key, value) in [
        ("sellingPrice", quote.price),
        ("totalFees", fees),
        ("netProfit", quote.profit),
        ("profitMargin", quote.margin.unwrap_or_default()),
        ("commissionPercentage", commission),
        ("commissionFixed", fixed),
        ("commissionAdditional", additional),
    ] {
        data[key] = json!(value);
    }
    store::validate(&data, true)
}

fn numbers(data: &Value, keys: &[&str]) -> store::Result<Vec<f64>> {
    keys.iter()
        .map(|key| {
            data[*key]
                .as_f64()
                .ok_or_else(|| format!("Informe um valor numérico para {key}.").into())
        })
        .collect()
}
