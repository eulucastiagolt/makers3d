use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use std::{io::Read, time::Duration};

#[derive(Deserialize)]
struct Feed {
    channel: Channel,
}

#[derive(Deserialize)]
struct Channel {
    #[serde(rename = "item", default)]
    results: Vec<SearchResult>,
}

#[derive(Deserialize, Serialize)]
struct SearchResult {
    title: String,
    link: String,
    description: String,
}

pub fn search(query: &str) -> Result<String, &'static str> {
    let query: String = query
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(350)
        .collect();
    let client = Client::builder()
        .timeout(Duration::from_secs(12))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "Não foi possível iniciar a pesquisa na web.")?;
    let url = reqwest::Url::parse_with_params(
        "https://www.bing.com/search",
        [
            ("q", query.as_str()),
            ("format", "rss"),
            ("setlang", "pt-br"),
        ],
    )
    .map_err(|_| "Não foi possível preparar a pesquisa.")?;
    let response = client
        .get(url)
        .send()
        .and_then(reqwest::blocking::Response::error_for_status)
        .map_err(
            |_| "O buscador não respondeu. Confira a conexão ou desmarque Pesquisar na web.",
        )?;
    let mut body = String::new();
    response
        .take(512_001)
        .read_to_string(&mut body)
        .map_err(|_| "Não foi possível ler os resultados da pesquisa.")?;
    if body.len() > 512_000 {
        return Err("A resposta do buscador excedeu o limite.");
    }
    parse_results(&body)
}

fn parse_results(body: &str) -> Result<String, &'static str> {
    let feed: Feed =
        quick_xml::de::from_str(body).map_err(|_| "O buscador retornou um formato inesperado.")?;
    let results: Vec<_> = feed
        .channel
        .results
        .into_iter()
        .filter(|result| {
            reqwest::Url::parse(&result.link)
                .is_ok_and(|url| matches!(url.scheme(), "https" | "http"))
        })
        .take(8)
        .collect();
    if results.is_empty() {
        return Err("A pesquisa não encontrou resultados. Tente uma consulta mais específica.");
    }
    serde_json::to_string(&results)
        .map_err(|_| "Não foi possível preparar os resultados da pesquisa.")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_rss_results() {
        let input = "<rss><channel><title>Busca</title><item><title>A1 &amp; A1 mini</title><link>https://example.com/a1</link><description>600 W</description></item></channel></rss>";
        let results: serde_json::Value =
            serde_json::from_str(&parse_results(input).unwrap()).unwrap();
        assert_eq!(results[0]["title"], "A1 & A1 mini");
        assert_eq!(results[0]["description"], "600 W");
    }
}
