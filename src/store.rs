use crate::calc::{Kind, Options, calculate};
use crate::filament::Filament;
use crate::printer::Printer;
use gtk4::glib;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    collections::HashSet,
    error::Error,
    fs, io,
    path::{Path, PathBuf},
};

pub type Result<T> = std::result::Result<T, Box<dyn Error>>;

pub(crate) const PRINT: &[&str] = &[
    "precoRoloFilamento",
    "pesoRoloFilamento",
    "pesoPeca",
    "tempoImpressao",
    "potenciaImpressora",
    "tarifaEnergia",
    "precoImpressora",
    "vidaUtilHoras",
    "percentualManutencao",
    "taxaFalhaPercentual",
    "valorHoraTrabalho",
    "tempoPreparacao",
    "tempoPosProcessamento",
    "margemLucro",
];
pub(crate) const MARKET: &[&str] = &[
    "productCost",
    "otherCosts",
    "taxPercentage",
    "desiredMargin",
    "categoryPercentage",
    "shippingCost",
    "weight",
    "height",
    "widthF",
    "depth",
];
const PRINT_RESULTS: &[&str] = &["custoTotal", "precoVenda"];
const MARKET_RESULTS: &[&str] = &[
    "sellingPrice",
    "totalFees",
    "netProfit",
    "profitMargin",
    "commissionPercentage",
    "commissionFixed",
    "commissionAdditional",
];
const OPTIONS: &[&str] = &[
    "pricingMode",
    "shippingMode",
    "freeShipping",
    "highlightCampaigns",
];

#[derive(Deserialize)]
struct LegacyBudget {
    id: String,
    name: String,
    kind: Kind,
    values: Vec<f64>,
    options: Options,
    updated_at: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub electricity_rate: f64,
}

impl Settings {
    pub fn validate(&self) -> Result<()> {
        if !self.electricity_rate.is_finite() || self.electricity_rate < 0.0 {
            return Err("Informe uma tarifa de energia válida, maior ou igual a zero.".into());
        }
        Ok(())
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Store {
    version: u32,
    pub printing: Vec<Value>,
    pub marketplace: Vec<Value>,
    #[serde(default)]
    pub printers: Vec<Printer>,
    #[serde(default)]
    pub filaments: Vec<Filament>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub settings: Option<Settings>,
}

impl Store {
    pub fn path() -> PathBuf {
        glib::user_data_dir()
            .join("makers3d")
            .join("orcamentos.json")
    }

    pub fn open(path: &Path) -> Result<Self> {
        match fs::read(path) {
            Ok(bytes) => Self::decode(&bytes),
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                let legacy = glib::user_data_dir()
                    .join("fatia3d")
                    .join("orcamentos.json");
                if legacy.try_exists()? {
                    let _lock = lock(&legacy)?;
                    let store = Self::decode(&fs::read(legacy)?)?;
                    store.save(path)?;
                    return Ok(store);
                }
                Ok(Self {
                    version: 2,
                    printing: Vec::new(),
                    marketplace: Vec::new(),
                    printers: Vec::new(),
                    filaments: Vec::new(),
                    settings: None,
                })
            }
            Err(error) => Err(error.into()),
        }
    }

    pub fn decode(bytes: &[u8]) -> Result<Self> {
        let data: Value = serde_json::from_slice(bytes)?;
        let mut store = match data["version"].as_u64() {
            Some(2) => serde_json::from_value(data)?,
            Some(1) => {
                let records: Vec<LegacyBudget> = serde_json::from_value(data["budgets"].clone())?;
                let mut store = Self {
                    version: 2,
                    printing: Vec::new(),
                    marketplace: Vec::new(),
                    printers: Vec::new(),
                    filaments: Vec::new(),
                    settings: None,
                };
                for record in records {
                    let print = record.kind == Kind::Print;
                    let quote = calculate(record.kind, &record.values, record.options)?;
                    let mut row = json!({
                        "id": record.id, "name": record.name,
                        "createdAt": record.updated_at, "updatedAt": record.updated_at,
                    });
                    for (key, value) in (if print { PRINT } else { MARKET })
                        .iter()
                        .zip(record.values)
                    {
                        row[*key] = json!(value);
                    }
                    if print {
                        row["custoTotal"] = json!(quote.cost);
                        row["precoVenda"] = json!(quote.price);
                        store.printing.push(row);
                    } else {
                        row["marketplace"] = json!(match record.kind {
                            Kind::Shopee => "shopee",
                            Kind::TikTok => "tiktok",
                            _ => "mercadolivre",
                        });
                        row["pricingMode"] = json!(if record.options.by_price {
                            "price"
                        } else {
                            "margin"
                        });
                        row["shippingMode"] = json!(if record.options.auto_shipping {
                            "auto"
                        } else {
                            "manual"
                        });
                        row["freeShipping"] = json!(record.options.free_shipping);
                        row["highlightCampaigns"] = json!(record.options.campaigns);
                        row["sellingPrice"] = json!(quote.price);
                        row["totalFees"] = json!(quote.details.last().map(|(_, value)| *value));
                        row["profitMargin"] = json!(quote.margin);
                        row["netProfit"] = json!(quote.profit);
                        store.marketplace.push(row);
                    }
                }
                store
            }
            _ => return Err("Versão de backup incompatível.".into()),
        };
        for (rows, market) in [(&mut store.printing, false), (&mut store.marketplace, true)] {
            let mut ids = HashSet::new();
            for row in rows {
                let normalized = validate(row, market)?;
                let id = row["id"]
                    .as_str()
                    .filter(|s| {
                        !s.is_empty()
                            && s.len() <= 128
                            && s.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
                    })
                    .ok_or("Identificador inválido.")?;
                if !ids.insert(id.to_owned()) {
                    return Err("O backup contém orçamentos duplicados.".into());
                }
                let mut normalized = normalized;
                normalized["id"] = json!(id);
                for key in ["createdAt", "updatedAt"] {
                    let date = row[key].as_str().ok_or("Data ausente.")?;
                    glib::DateTime::from_iso8601(date, None)?;
                    normalized[key] = json!(date);
                }
                *row = normalized;
            }
        }
        let mut printer_ids = HashSet::new();
        for printer in &mut store.printers {
            printer.validate()?;
            if !glib::uuid_string_is_valid(&printer.id) || !printer_ids.insert(printer.id.clone()) {
                return Err(
                    "O backup contém impressoras com identificadores inválidos ou duplicados."
                        .into(),
                );
            }
        }
        let mut filament_ids = HashSet::new();
        for filament in &mut store.filaments {
            filament.validate()?;
            if !glib::uuid_string_is_valid(&filament.id)
                || !filament_ids.insert(filament.id.clone())
            {
                return Err(
                    "O backup contém filamentos com identificadores inválidos ou duplicados."
                        .into(),
                );
            }
        }
        if let Some(settings) = &store.settings {
            settings.validate()?;
        }
        Ok(store)
    }

    pub fn save(&self, path: &Path) -> Result<()> {
        let mut output =
            tempfile::NamedTempFile::new_in(path.parent().ok_or("Destino inválido.")?)?;
        serde_json::to_writer_pretty(output.as_file_mut(), self)?;
        output.as_file().sync_all()?;
        output.persist(path)?;
        Ok(())
    }

    pub fn merge(&mut self, incoming: Self) -> (usize, usize, usize) {
        if self.settings.is_none() {
            self.settings = incoming.settings;
        }
        let mut added = 0;
        for (current, rows) in [
            (&mut self.printing, incoming.printing),
            (&mut self.marketplace, incoming.marketplace),
        ] {
            let mut ids: HashSet<_> = current.iter().map(|row| row["id"].to_string()).collect();
            for row in rows {
                if ids.insert(row["id"].to_string()) {
                    current.push(row);
                    added += 1;
                }
            }
        }
        let mut ids: HashSet<_> = self
            .printers
            .iter()
            .map(|printer| printer.id.clone())
            .collect();
        let before = self.printers.len();
        self.printers.extend(
            incoming
                .printers
                .into_iter()
                .filter(|printer| ids.insert(printer.id.clone())),
        );
        let printers = self.printers.len() - before;
        let mut ids: HashSet<_> = self
            .filaments
            .iter()
            .map(|filament| filament.id.clone())
            .collect();
        let before = self.filaments.len();
        self.filaments.extend(
            incoming
                .filaments
                .into_iter()
                .filter(|filament| ids.insert(filament.id.clone())),
        );
        (added, printers, self.filaments.len() - before)
    }
}

pub fn validate(input: &Value, market: bool) -> Result<Value> {
    let name = input["name"]
        .as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty() && s.chars().count() <= 250)
        .ok_or("Informe um nome de até 250 caracteres.")?;
    let mut row = json!({ "name": name });
    let fields = if market { MARKET } else { PRINT };
    for key in fields {
        let value = if *key == "widthF" && input[*key].is_null() {
            &input["width"]
        } else {
            &input[*key]
        };
        let value = match value.as_f64() {
            Some(number) if number >= 0.0 => number,
            None if market && value.is_null() => 0.0,
            _ => return Err(format!("Campo numérico inválido: {key}.").into()),
        };
        row[*key] = json!(value);
    }
    for key in if market {
        MARKET_RESULTS
    } else {
        PRINT_RESULTS
    } {
        match input[*key].as_f64() {
            Some(value) => row[*key] = json!(value),
            None if market && key.starts_with("commission") && input[*key].is_null() => {
                row[*key] = json!(0)
            }
            _ => return Err(format!("Resultado inválido: {key}.").into()),
        }
    }
    if market {
        let name = input["marketplace"]
            .as_str()
            .filter(|s| matches!(*s, "shopee" | "tiktok" | "mercadolivre"))
            .ok_or("Marketplace inválido.")?;
        row["marketplace"] = json!(name);
        for key in OPTIONS {
            row[*key] = match *key {
                "pricingMode" => json!(match input[*key].as_str() {
                    Some("price") => "price",
                    _ => "margin",
                }),
                "shippingMode" => json!(match input[*key].as_str() {
                    Some("auto") => "auto",
                    _ => "manual",
                }),
                _ => json!(input[*key].as_bool().unwrap_or(false)),
            };
        }
    }
    Ok(row)
}

pub fn lock(path: &Path) -> Result<fs::File> {
    fs::create_dir_all(path.parent().ok_or("Caminho inválido.")?)?;
    let file = fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(false)
        .open(path.with_extension("lock"))?;
    file.try_lock().map_err(|error| {
        format!("Feche outra instância do Makers 3D e tente novamente. {error}")
    })?;
    Ok(file)
}
