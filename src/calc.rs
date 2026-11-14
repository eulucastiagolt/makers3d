use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Kind {
    Print,
    Shopee,
    TikTok,
    MercadoLivre,
}

pub const PRINT_FIELDS: [(&str, f64); 14] = [
    ("Preço do rolo (R$)", 100.0),
    ("Peso do rolo (g)", 1000.0),
    ("Peso da peça (g)", 20.0),
    ("Tempo de impressão (h)", 2.0),
    ("Potência da impressora (W)", 300.0),
    ("Tarifa de energia (R$/kWh)", 1.0),
    ("Preço da impressora (R$)", 1500.0),
    ("Vida útil da impressora (h)", 4000.0),
    ("Manutenção (%)", 10.0),
    ("Taxa de falha (%)", 10.0),
    ("Valor da hora de trabalho (R$)", 20.0),
    ("Tempo de preparação (min)", 15.0),
    ("Tempo de pós-processamento (min)", 15.0),
    ("Acréscimo sobre o custo (%)", 80.0),
];

pub const MARKET_FIELDS: [(&str, f64); 10] = [
    ("Custo do produto (R$)", 30.0),
    ("Outros custos (R$)", 5.0),
    ("Impostos (%)", 0.0),
    ("Margem desejada (%)", 20.0),
    ("Comissão da categoria (%)", 11.0),
    ("Frete manual (R$)", 0.0),
    ("Peso (kg)", 0.0),
    ("Altura (cm)", 0.0),
    ("Largura (cm)", 0.0),
    ("Comprimento (cm)", 0.0),
];

#[derive(Clone, Copy, Default, Serialize, Deserialize)]
pub struct Options {
    pub by_price: bool,
    pub auto_shipping: bool,
    pub free_shipping: bool,
    pub campaigns: bool,
}

pub struct Quote {
    pub price: f64,
    pub cost: f64,
    pub profit: f64,
    pub details: Vec<(&'static str, f64)>,
    pub margin: Option<f64>,
}

fn round(value: f64) -> f64 {
    let scaled = value * 100.0;
    let floor = scaled.floor();
    (floor + f64::from(scaled - floor >= 0.5)) / 100.0
}

fn ratio(value: f64, denominator: f64) -> f64 {
    if denominator > 0.0 {
        value / denominator
    } else {
        0.0
    }
}

fn print_quote(values: &[f64]) -> Quote {
    let filament_per_gram = ratio(values[0], values[1]);
    let machine_per_hour = ratio(values[6], values[7]);
    let filament = filament_per_gram * values[2];
    let energy = values[4] / 1000.0 * values[3] * values[5];
    let depreciation = machine_per_hour * values[3];
    let maintenance = depreciation * (values[8] / 100.0);
    let labor = (values[11] + values[12]) / 60.0 * values[10];
    let subtotal = filament + energy + depreciation + maintenance + labor;
    let failure = subtotal * (values[9] / 100.0);
    let cost = subtotal + failure;
    let price = cost * (1.0 + values[13] / 100.0);

    Quote {
        price: round(price),
        cost: round(cost),
        profit: round(price - cost),
        margin: None,
        details: vec![
            ("Filamento", round(filament)),
            ("Energia", round(energy)),
            ("Depreciação", round(depreciation)),
            ("Manutenção", round(maintenance)),
            ("Mão de obra", round(labor)),
            ("Subtotal", round(subtotal)),
            ("Taxa de falha", round(failure)),
            ("Custo por grama", round(filament_per_gram)),
            ("Custo por hora de máquina", round(machine_per_hour)),
        ],
    }
}

fn shopee_bracket(price: f64) -> (f64, f64) {
    match price {
        80.0..=99.99 => (14.0, 16.0),
        100.0..=199.99 => (14.0, 20.0),
        200.0..=499.99 | 500.0.. => (14.0, 26.0),
        _ => (20.0, 4.0),
    }
}

fn market_quote(kind: Kind, values: &[f64], options: Options) -> Result<Quote, &'static str> {
    let shipping = if options.free_shipping && kind != Kind::MercadoLivre {
        0.0
    } else if options.auto_shipping && values[6] > 0.0 {
        let weight = values[6].max(values[7] * values[8] * values[9] / 6000.0);
        12.0 + ((weight - 0.5).max(0.0) / 0.5).ceil() * 4.0
    } else {
        values[5]
    };

    let additional = match kind {
        Kind::Shopee if options.campaigns => 3.5,
        Kind::TikTok => 6.0,
        _ => 0.0,
    };
    let bracket = |price| match kind {
        Kind::Shopee => shopee_bracket(price),
        Kind::TikTok => (6.0, 4.0),
        _ => (values[4], 0.0),
    };

    let base = values[0] + values[1];
    let price = if options.by_price {
        values[3]
    } else {
        let mut price = 0.0;
        for _ in 0..5 {
            let reference = if price > 0.0 {
                price
            } else {
                base + shipping + 4.0
            };
            let (commission, fixed) = bracket(reference);
            let denominator = 1.0
                - values[2] / 100.0
                - commission / 100.0
                - additional / 100.0
                - values[3] / 100.0;
            if denominator <= 1e-12 {
                return Err("Não foi possível calcular um preço viável com essa margem e taxas.");
            }
            price = round((base + shipping + fixed) / denominator);
            if bracket(price) == (commission, fixed) {
                break;
            }
        }
        price
    };
    let (commission, fixed) = bracket(price);
    let commission_fee = round(price * commission / 100.0);
    let additional_fee = round(price * additional / 100.0);
    let taxes = round(price * values[2] / 100.0);
    let fees = round(((commission_fee + fixed) + additional_fee) + taxes + shipping);
    let profit = round(price - values[0] - values[1] - fees);

    Ok(Quote {
        price,
        cost: round(base + fees),
        profit,
        margin: Some(round(ratio(profit, price) * 100.0)),
        details: vec![
            ("Produto", values[0]),
            ("Outros custos", values[1]),
            ("Comissão", commission_fee),
            ("Tarifa fixa", fixed),
            ("Taxa adicional", additional_fee),
            ("Impostos", taxes),
            ("Frete", shipping),
            ("Total de taxas e frete", fees),
        ],
    })
}

pub fn calculate(kind: Kind, values: &[f64], options: Options) -> Result<Quote, &'static str> {
    let expected = if kind == Kind::Print {
        PRINT_FIELDS.len()
    } else {
        MARKET_FIELDS.len()
    };
    if values.len() != expected
        || values
            .iter()
            .any(|value| !value.is_finite() || *value < 0.0)
    {
        return Err("Preencha os campos com números válidos, iguais ou maiores que zero.");
    }

    let quote = if kind == Kind::Print {
        print_quote(values)
    } else {
        market_quote(kind, values, options)?
    };
    let valid = [
        quote.price,
        quote.cost,
        quote.profit,
        quote.margin.unwrap_or_default(),
    ]
    .into_iter()
    .chain(quote.details.iter().map(|(_, value)| *value))
    .all(f64::is_finite);

    if valid {
        Ok(quote)
    } else {
        Err("Os valores ultrapassaram o limite do cálculo.")
    }
}
