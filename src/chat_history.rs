use gtk4::glib;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{fs, io, path::Path};

#[derive(Deserialize, Serialize)]
struct Conversation {
    id: String,
    title: String,
    #[serde(default)]
    generated_title: bool,
    updated_at: String,
    messages: Vec<Message>,
}

#[derive(Deserialize, Serialize)]
struct Message {
    role: Role,
    content: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
enum Role {
    User,
    Assistant,
}

pub fn dispatch(directory: &Path, method: &str, id: Option<&str>, body: &[u8]) -> (u32, Value) {
    if id.is_some_and(|id| !glib::uuid_string_is_valid(id)) {
        return (400, json!({"error": "Identificador de conversa inválido."}));
    }

    match (method, id) {
        ("GET", None) => match list(directory) {
            Ok(rows) => (200, json!(rows)),
            Err(_) => (
                500,
                json!({"error": "Não foi possível ler o histórico de conversas."}),
            ),
        },
        ("GET", Some(id)) => match read(&directory.join(format!("{id}.json"))) {
            Ok(row) => (200, json!(row)),
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                (404, json!({"error": "Conversa não encontrada."}))
            }
            Err(_) => (500, json!({"error": "Não foi possível abrir a conversa."})),
        },
        ("PATCH", Some(id)) => {
            let Ok(title) = serde_json::from_slice::<String>(body) else {
                return (400, json!({"error": "Título inválido."}));
            };
            let title = title
                .trim()
                .trim_matches(['"', '“', '”', '`', '*', '#'])
                .trim();
            if title.is_empty() || title.contains(['\n', '\r']) || title.chars().count() > 80 {
                return (400, json!({"error": "Título inválido."}));
            }
            let Ok(mut row) = read(&directory.join(format!("{id}.json"))) else {
                return (404, json!({"error": "Conversa não encontrada."}));
            };
            if !row.generated_title {
                row.title = title.to_owned();
                row.generated_title = true;
                if save(directory, &row).is_err() {
                    return (500, json!({"error": "Não foi possível salvar o título."}));
                }
            }
            (200, summary(&row))
        }
        ("PUT", Some(id)) => {
            let Ok(messages) = serde_json::from_slice::<Vec<Message>>(body) else {
                return (400, json!({"error": "Mensagens inválidas."}));
            };
            if messages.is_empty()
                || messages.iter().enumerate().any(|(index, msg)| {
                    msg.content.trim().is_empty()
                        || matches!(msg.role, Role::User) != (index % 2 == 0)
                })
            {
                return (
                    400,
                    json!({"error": "A sequência de mensagens é inválida."}),
                );
            }
            let Ok(updated_at) = glib::DateTime::now_utc().and_then(|date| date.format_iso8601())
            else {
                return (
                    500,
                    json!({"error": "Não foi possível obter a data atual."}),
                );
            };
            let title = messages[0]
                .content
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ");
            let (title, generated_title) = match read(&directory.join(format!("{id}.json"))) {
                Ok(row) => (row.title, row.generated_title),
                Err(error) if error.kind() == io::ErrorKind::NotFound => {
                    (title.chars().take(80).collect(), false)
                }
                Err(_) => return (500, json!({"error": "Não foi possível abrir a conversa."})),
            };
            let row = Conversation {
                id: id.to_owned(),
                title,
                generated_title,
                updated_at: updated_at.to_string(),
                messages,
            };
            match save(directory, &row) {
                Ok(()) => (200, summary(&row)),
                Err(_) => (
                    500,
                    json!({"error": "Não foi possível salvar a conversa no histórico."}),
                ),
            }
        }
        _ => (405, json!({"error": "Operação de histórico inválida."})),
    }
}

fn summary(row: &Conversation) -> Value {
    json!({"id": row.id, "title": row.title, "updated_at": row.updated_at, "generated_title": row.generated_title})
}

fn read(path: &Path) -> io::Result<Conversation> {
    serde_json::from_reader(io::BufReader::new(fs::File::open(path)?)).map_err(io::Error::other)
}

fn list(directory: &Path) -> io::Result<Vec<Value>> {
    let files = match fs::read_dir(directory) {
        Ok(files) => files,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(error),
    };
    let mut rows = Vec::new();
    for file in files {
        let path = file?.path();
        if path
            .file_stem()
            .and_then(|stem| stem.to_str())
            .is_some_and(glib::uuid_string_is_valid)
            && path.extension().is_some_and(|ext| ext == "json")
        {
            rows.push(summary(&read(&path)?));
        }
    }
    rows.sort_by(|a, b| b["updated_at"].as_str().cmp(&a["updated_at"].as_str()));
    Ok(rows)
}

fn save(directory: &Path, row: &Conversation) -> io::Result<()> {
    fs::create_dir_all(directory)?;
    let mut file = tempfile::NamedTempFile::new_in(directory)?;
    serde_json::to_writer(file.as_file_mut(), row).map_err(io::Error::other)?;
    file.as_file().sync_all()?;
    file.persist(directory.join(format!("{}.json", row.id)))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn saves_lists_and_reopens_a_conversation() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path();
        let id = glib::uuid_string_random();
        let messages = json!([
            {"role": "user", "content": "Quanto custa o vaso?"},
            {"role": "assistant", "content": "R$ 42."},
        ]);
        assert_eq!(
            dispatch(path, "PUT", Some(&id), messages.to_string().as_bytes()).0,
            200
        );
        let (_, list) = dispatch(path, "GET", None, &[]);
        assert_eq!(list[0]["title"], "Quanto custa o vaso?");
        assert!(list[0].get("messages").is_none());
        let (_, reopened) = dispatch(path, "GET", Some(&id), &[]);
        assert_eq!(reopened["messages"], messages);
        assert_eq!(
            dispatch(path, "PATCH", Some(&id), br#""Custo do vaso""#).0,
            200
        );
        assert_eq!(
            dispatch(path, "PUT", Some(&id), messages.to_string().as_bytes()).0,
            200
        );
        let (_, reopened) = dispatch(path, "GET", Some(&id), &[]);
        assert_eq!(reopened["title"], "Custo do vaso");
        assert_eq!(reopened["generated_title"], true);
        assert_eq!(reopened["messages"], messages);
        assert_eq!(dispatch(path, "GET", Some("../orcamentos"), &[]).0, 400);
    }
}
