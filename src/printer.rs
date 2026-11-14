use serde::{Deserialize, Serialize};

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Printer {
    #[serde(default)]
    pub id: String,
    pub name: String,
    pub price: f64,
    pub power: f64,
    pub lifetime: f64,
    pub maintenance: f64,
}

impl Printer {
    pub fn validate(&mut self) -> Result<(), &'static str> {
        self.name = self.name.trim().to_owned();
        if self.name.is_empty() || self.name.chars().count() > 150 {
            return Err("Informe um nome de até 150 caracteres.");
        }
        if self.lifetime <= 0.0
            || [self.price, self.power, self.lifetime, self.maintenance]
                .into_iter()
                .any(|value| !value.is_finite() || value < 0.0)
        {
            return Err("Informe valores não negativos e uma vida útil maior que zero.");
        }
        Ok(())
    }
}
