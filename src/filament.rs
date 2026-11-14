use serde::{Deserialize, Serialize};

#[derive(Clone, Deserialize, Serialize)]
pub struct Filament {
    #[serde(default)]
    pub id: String,
    pub name: String,
    pub material: String,
    #[serde(default)]
    pub color: String,
    pub price: f64,
    pub weight: f64,
}

impl Filament {
    pub fn validate(&mut self) -> Result<(), &'static str> {
        self.name = self.name.trim().to_owned();
        self.material = self.material.trim().to_owned();
        self.color = self.color.trim().to_owned();
        if self.name.is_empty() || self.name.chars().count() > 150 {
            return Err("Informe um nome de até 150 caracteres.");
        }
        if self.material.is_empty()
            || self.material.chars().count() > 60
            || self.color.chars().count() > 60
        {
            return Err("Informe o material. Material e cor podem ter até 60 caracteres.");
        }
        if !self.price.is_finite()
            || self.price < 0.0
            || !self.weight.is_finite()
            || self.weight <= 0.0
        {
            return Err("Informe um preço não negativo e um peso maior que zero.");
        }
        Ok(())
    }
}
