use serde_json::{Value, json};
use std::{
    env, fs,
    io::{Read, Seek, Write},
    os::unix::fs::PermissionsExt,
    path::PathBuf,
    process::{Command, Stdio},
    time::{Duration, Instant},
};

const AGENTS: [(&str, &str, bool); 7] = [
    ("codex", "Codex CLI", true),
    ("claude", "Claude Code", true),
    ("agy", "Antigravity CLI", true),
    ("antigravity", "Antigravity", false),
    ("opencode", "OpenCode", true),
    ("gemini", "Gemini CLI", false),
    ("copilot", "GitHub Copilot CLI", false),
];

fn executable(name: &str) -> Option<PathBuf> {
    let mut locations: Vec<_> = env::var_os("PATH")
        .as_ref()
        .map(|path| env::split_paths(path).collect())
        .unwrap_or_default();
    if let Some(home) = env::home_dir() {
        locations.extend([
            home.join(".local/bin"),
            home.join(".cargo/bin"),
            home.join("bin"),
        ]);
    }
    locations
        .into_iter()
        .filter(|dir: &PathBuf| dir.is_absolute())
        .map(|dir| dir.join(name))
        .find(|path| {
            fs::metadata(path)
                .is_ok_and(|meta| meta.is_file() && meta.permissions().mode() & 0o111 != 0)
        })
}

pub fn installed() -> Value {
    let agents: Vec<_> = AGENTS
        .into_iter()
        .filter(|(id, _, _)| {
            executable(id).is_some() && (*id != "antigravity" || executable("agy").is_none())
        })
        .map(|(id, name, chat)| json!({"id": id, "name": name, "chat": chat}))
        .collect();
    json!(agents)
}

pub fn reply(id: &str, messages: Value) -> Result<String, String> {
    let program = match id {
        "codex" | "claude" | "agy" | "opencode" => {
            executable(id).ok_or("O agente não foi encontrado neste computador.")?
        }
        _ => return Err("Este agente ainda não tem integração com o chat.".into()),
    };
    run(Command::new(program), id, messages)
}

fn run(mut command: Command, id: &str, messages: Value) -> Result<String, String> {
    let workspace = tempfile::tempdir().map_err(|_| "Não foi possível preparar a sessão local.")?;
    let io_error = |_| "Não foi possível preparar a sessão local.";
    let mut input = tempfile::tempfile().map_err(io_error)?;
    let prompt = format!(
        "Responda à última mensagem do usuário. Use os resultados de pesquisa fornecidos quando disponíveis e cite as fontes. Proponha ações do Makers 3D apenas pelo formato informado.\n{messages}"
    );
    if id == "agy" {
        serde_json::to_writer(
            &mut input,
            &json!({"event":"user","message":{"content": prompt}}),
        )
        .map_err(|_| "Não foi possível preparar a mensagem.")?;
        writeln!(input).map_err(io_error)?;
    } else {
        writeln!(input, "{prompt}").map_err(io_error)?;
    }
    input.rewind().map_err(io_error)?;
    let mut output = tempfile::tempfile().map_err(io_error)?;
    command
        .current_dir(workspace.path())
        .stdin(input)
        .stdout(output.try_clone().map_err(io_error)?)
        .stderr(Stdio::null());
    match id {
        "codex" => {
            command.args([
                "-a",
                "never",
                "exec",
                "--ignore-user-config",
                "--sandbox",
                "read-only",
                "--skip-git-repo-check",
                "--ephemeral",
                "--disable",
                "shell_tool",
                "--disable",
                "plugins",
                "-c",
                "web_search=\"disabled\"",
                "--json",
                "-",
            ]);
        }
        "agy" => {
            command
                .args([
                    "--input-format",
                    "stream-json",
                    "--output-format",
                    "stream-json",
                    "--disable-slash-commands",
                    "--sandbox",
                    "--mode",
                    "plan",
                    "--settings",
                    r#"{"toolPermission":"strict","allowNonWorkspaceAccess":false}"#,
                ])
                .env("AGY_CLI_DISABLE_AUTO_UPDATE", "true");
        }
        "opencode" => {
            command
                .args(["run", "--standalone", "--format", "json"])
                .env(
                    "OPENCODE_CONFIG_CONTENT",
                    r#"{"permissions":[{"action":"*","resource":"*","effect":"deny"}]}"#,
                );
        }
        _ => {
            command.args([
                "--print",
                "--output-format",
                "json",
                "--no-session-persistence",
                "--setting-sources",
                "",
                "--strict-mcp-config",
                "--tools",
                "",
            ]);
        }
    }
    let mut child = command
        .spawn()
        .map_err(|_| "Não foi possível iniciar o agente instalado.")?;
    let deadline = Instant::now() + Duration::from_secs(180);
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None)
                if Instant::now() < deadline
                    && output.metadata().is_ok_and(|file| file.len() <= 2_000_000) =>
            {
                std::thread::sleep(Duration::from_millis(100));
            }
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                return Err("O agente excedeu o tempo ou o tamanho máximo da resposta.".into());
            }
        }
    };
    if !status.success() {
        return Err("O agente não concluiu a conversa. Verifique se ele está autenticado e funciona no terminal.".into());
    }
    output.rewind().map_err(io_error)?;
    let mut content = String::new();
    output
        .take(2_000_000)
        .read_to_string(&mut content)
        .map_err(io_error)?;
    parse_reply(id, &content).ok_or_else(|| "O agente não retornou uma resposta de texto.".into())
}

fn parse_reply(id: &str, output: &str) -> Option<String> {
    if matches!(id, "agy" | "opencode") {
        let mut text = String::new();
        for event in output
            .lines()
            .filter_map(|line| serde_json::from_str::<Value>(line).ok())
        {
            if id == "agy" && event["event"] == "result" {
                let result = &event["result"];
                return (result["status"] == "SUCCESS")
                    .then(|| result["response"].as_str())
                    .flatten()
                    .filter(|reply| !reply.trim().is_empty())
                    .map(str::to_owned);
            }
            if id == "opencode" {
                match event["type"].as_str() {
                    Some("error") => return None,
                    Some("text") => {
                        text.push_str(event["part"]["text"].as_str().unwrap_or_default())
                    }
                    _ => {}
                }
            }
        }
        return (!text.trim().is_empty()).then_some(text);
    }
    let text = if id == "codex" {
        output
            .lines()
            .rev()
            .filter_map(|line| serde_json::from_str::<Value>(line).ok())
            .find(|event| {
                event["type"] == "item.completed" && event["item"]["type"] == "agent_message"
            })?["item"]["text"]
            .as_str()?
            .to_owned()
    } else {
        let result: Value = serde_json::from_str(output).ok()?;
        if result["is_error"] == true {
            return None;
        }
        result["result"].as_str()?.to_owned()
    };
    (!text.trim().is_empty()).then_some(text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn local_agents_receive_the_conversation_and_return_text() {
        for (agent, output) in [
            (
                "codex",
                r#"{"type":"item.completed","item":{"type":"agent_message","text":"Resposta"}}"#,
            ),
            ("claude", r#"{"is_error":false,"result":"Resposta"}"#),
            (
                "agy",
                r#"{"event":"result","result":{"status":"SUCCESS","response":"Resposta"}}"#,
            ),
            ("opencode", r#"{"type":"text","part":{"text":"Resposta"}}"#),
        ] {
            let mut command = Command::new("/bin/sh");
            command.args([
                "-c",
                r#"grep -q 'Mensagem teste' && printf '%s' "$1""#,
                "test",
                output,
            ]);
            let messages = json!([{"role":"user","content":"Mensagem teste"}]);
            assert_eq!(run(command, agent, messages).unwrap(), "Resposta");
        }
    }
}
