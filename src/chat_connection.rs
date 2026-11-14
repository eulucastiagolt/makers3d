use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{fs, io, path::Path};

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
enum Provider {
    Agent,
    Chatgpt,
    Google,
    Openai,
    Claude,
    Gemini,
    Ollama,
    Lmstudio,
    Custom,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Connection {
    provider: Provider,
    endpoint: String,
    model: String,
    requires_key: bool,
}

pub fn dispatch(path: &Path, method: &str, body: &[u8]) -> (u32, Value) {
    match method {
        "GET" => match fs::File::open(path) {
            Ok(file) => match serde_json::from_reader::<_, Connection>(io::BufReader::new(file)) {
                Ok(connection) => (200, json!(connection)),
                Err(_) => (500, json!({"error": "A conexão salva está inválida."})),
            },
            Err(error) if error.kind() == io::ErrorKind::NotFound => (200, Value::Null),
            Err(_) => (
                500,
                json!({"error": "Não foi possível ler a conexão salva."}),
            ),
        },
        "PUT" => {
            let Ok(connection) = serde_json::from_slice::<Connection>(body) else {
                return (400, json!({"error": "Configuração de conexão inválida."}));
            };
            let internal = matches!(
                connection.provider,
                Provider::Chatgpt | Provider::Google | Provider::Agent
            );
            if connection.model.trim().is_empty()
                || connection.model.len() > 256
                || connection.endpoint.len() > 2048
                || (!internal && connection.endpoint.trim().is_empty())
            {
                return (
                    400,
                    json!({"error": "Informe um modelo e um endereço válidos."}),
                );
            }
            match save(path, &connection) {
                Ok(()) => (200, json!(connection)),
                Err(_) => (500, json!({"error": "Não foi possível salvar a conexão."})),
            }
        }
        _ => (405, json!({"error": "Operação de conexão inválida."})),
    }
}

fn save(path: &Path, connection: &Connection) -> io::Result<()> {
    let directory = path
        .parent()
        .ok_or_else(|| io::Error::other("Diretório ausente."))?;
    let mut file = tempfile::NamedTempFile::new_in(directory)?;
    serde_json::to_writer(file.as_file_mut(), connection).map_err(io::Error::other)?;
    file.as_file().sync_all()?;
    file.persist(path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn restores_connection_without_storing_api_key() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("conexao.json");
        assert!(dispatch(&path, "GET", &[]).1.is_null());
        let input = br#"{"provider":"custom","endpoint":"https://example.org/v1/chat","model":"example","requiresKey":true,"key":"secret"}"#;
        assert_eq!(dispatch(&path, "PUT", input).0, 200);
        let (status, saved) = dispatch(&path, "GET", &[]);
        assert_eq!(status, 200);
        assert_eq!(saved["model"], "example");
        assert_eq!(saved["requiresKey"], true);
        assert!(!fs::read_to_string(path).unwrap().contains("secret"));
    }
}
