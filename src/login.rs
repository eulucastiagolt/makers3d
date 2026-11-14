use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD as B64};
use gtk4::{gio, glib};
use reqwest::{
    Url,
    blocking::{Client, Response},
    redirect::Policy,
};
use ring::{
    digest,
    rand::{SecureRandom, SystemRandom},
    signature,
};
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use serde_json::{Value, json};
use std::{
    collections::HashMap,
    fs,
    io::{BufRead, BufReader, Read, Write},
    net::{TcpListener, TcpStream},
    path::PathBuf,
    sync::Mutex,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

type Result<T> = std::result::Result<T, String>;
const OPENAI: &str = "https://auth.openai.com";
const OPENAI_TOKEN: &str = "https://auth.openai.com/api/accounts/oauth/token";
const RESOURCE: &str = "https://api.openai.com/v1";
const GOOGLE_TOKEN: &str = "https://oauth2.googleapis.com/token";

#[derive(Clone, Copy, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
enum Provider {
    Chatgpt,
    Google,
}

#[derive(Deserialize)]
struct Request {
    provider: Provider,
    #[serde(default)]
    credentials: String,
}

#[derive(Deserialize)]
struct GoogleFile {
    installed: GoogleClient,
}

#[derive(Clone, Deserialize, Serialize)]
struct GoogleClient {
    client_id: String,
    client_secret: String,
    project_id: String,
}

#[derive(Deserialize)]
struct Token {
    access_token: String,
    refresh_token: Option<String>,
    id_token: Option<String>,
    scope: Option<String>,
    expires_in: u64,
}

#[derive(Deserialize, Serialize)]
struct Session {
    client_id: String,
    subject: String,
    email: String,
    access: String,
    refresh: String,
    expires: u64,
    google: Option<GoogleClient>,
}

#[derive(Deserialize, Serialize)]
struct Registration {
    client_id: String,
    subject: String,
    email: String,
}

#[derive(Default)]
pub struct Accounts(Mutex<()>);

fn storage() -> PathBuf {
    glib::user_config_dir().join("makers3d")
}

fn path(provider: Provider) -> PathBuf {
    storage().join(match provider {
        Provider::Chatgpt => "chatgpt-session.json",
        Provider::Google => "google-session.json",
    })
}

fn save(path: PathBuf, value: &impl Serialize) -> Result<()> {
    fs::create_dir_all(storage()).map_err(|_| "Não foi possível criar a pasta de configuração.")?;
    let mut file = tempfile::NamedTempFile::new_in(storage())
        .map_err(|_| "Não foi possível criar o arquivo de sessão.")?;
    serde_json::to_writer(file.as_file_mut(), value)
        .map_err(|_| "Não foi possível gravar a sessão.")?;
    file.as_file()
        .sync_all()
        .map_err(|_| "Não foi possível gravar a sessão.")?;
    file.persist(path)
        .map_err(|_| "Não foi possível salvar a sessão.")?;
    Ok(())
}

fn load(provider: Provider) -> Result<Option<Session>> {
    match fs::read(path(provider)) {
        Ok(bytes) => serde_json::from_slice(&bytes)
            .map(Some)
            .map_err(|_| "A sessão local está inválida. Desconecte e entre novamente.".into()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(_) => Err("Não foi possível ler a sessão local.".into()),
    }
}

fn random() -> Result<String> {
    let mut bytes = [0; 32];
    SystemRandom::new()
        .fill(&mut bytes)
        .map_err(|_| "Não foi possível gerar a proteção do login.")?;
    Ok(B64.encode(bytes))
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn client() -> Result<Client> {
    Client::builder()
        .redirect(Policy::none())
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|_| "Não foi possível inicializar a conexão.".into())
}

fn parse<T: DeserializeOwned>(response: reqwest::Result<Response>) -> Result<T> {
    let response = response.map_err(|_| "Não foi possível comunicar com o provedor.")?;
    if !response.status().is_success() {
        return Err(format!(
            "O provedor devolveu HTTP {}. Confira o acesso da conta, o projeto e a cota.",
            response.status().as_u16()
        ));
    }
    serde_json::from_reader(response.take(2_000_000))
        .map_err(|_| "Resposta inválida do provedor.".into())
}

fn callback(listener: TcpListener, state: &str) -> Result<(TcpStream, HashMap<String, String>)> {
    listener
        .set_nonblocking(true)
        .map_err(|_| "Não foi possível configurar o retorno do login.")?;
    let deadline = Instant::now() + Duration::from_secs(180);
    while Instant::now() < deadline {
        let Ok((mut stream, _)) = listener.accept() else {
            std::thread::sleep(Duration::from_millis(80));
            continue;
        };
        let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
        let _ = stream.set_write_timeout(Some(Duration::from_secs(2)));
        let mut buffer = Vec::new();
        let _ = BufReader::new(&stream)
            .take(16_384)
            .read_until(b'\n', &mut buffer);
        let line = String::from_utf8_lossy(&buffer);
        let route = line
            .strip_prefix("GET ")
            .and_then(|line| line.split_whitespace().next());
        let params = route
            .filter(|route| route.starts_with("/auth/callback?"))
            .and_then(|route| Url::parse(&format!("http://127.0.0.1{route}")).ok())
            .map(|url| url.query_pairs().into_owned().collect::<HashMap<_, _>>());
        if let Some(params) =
            params.filter(|params| params.get("state").is_some_and(|value| value == state))
        {
            return Ok((stream, params));
        }
        let _ = write!(
            stream,
            "HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n"
        );
    }
    Err("O tempo do login expirou. Tente novamente.".into())
}

fn claim<'a>(data: &'a Value, key: &str) -> Result<&'a str> {
    data[key]
        .as_str()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Resposta de identidade incompleta.".into())
}

fn validate_identity_claims(
    claims: &Value,
    provider: Provider,
    issuer: &str,
    audience: &str,
    nonce: &str,
) -> Result<()> {
    if claims["iss"] != issuer
        && !(provider == Provider::Google && claims["iss"] == "accounts.google.com")
    {
        return Err("O emissor da identidade não corresponde ao provedor.".into());
    }

    let aud = &claims["aud"];
    let audiences = aud.as_array();
    let matches_audience = aud == audience
        || audiences.is_some_and(|entries| {
            entries.iter().all(Value::is_string) && entries.iter().any(|entry| entry == audience)
        });
    let authorized_party_required =
        audiences.is_some_and(|entries| entries.len() > 1) || claims.get("azp").is_some();
    if !matches_audience || (authorized_party_required && claims["azp"] != audience) {
        return Err("A identidade retornada não foi emitida para este aplicativo.".into());
    }

    if claims["nonce"] != nonce {
        return Err(
            "A identidade retornada não corresponde a esta tentativa de login. Tente novamente."
                .into(),
        );
    }

    let now = now();
    if claims["exp"]
        .as_u64()
        .is_none_or(|exp| exp.saturating_add(5) <= now)
        || claims
            .get("nbf")
            .is_some_and(|nbf| nbf.as_u64().is_none_or(|time| time > now.saturating_add(5)))
    {
        return Err("A identidade está expirada ou ainda não é válida. Confira a data e a hora do computador e tente novamente.".into());
    }

    Ok(())
}

fn identity(
    client: &Client,
    provider: Provider,
    token: &str,
    audience: &str,
    nonce: &str,
) -> Result<(String, String)> {
    let invalid = || "Não foi possível validar a identidade da conta.".to_owned();
    let [header, payload, signed]: [&str; 3] = token
        .split('.')
        .collect::<Vec<_>>()
        .try_into()
        .map_err(|_| invalid())?;
    let decode = |value| B64.decode(value).map_err(|_| invalid());
    let meta: Value = serde_json::from_slice(&decode(header)?).map_err(|_| invalid())?;
    let claims: Value = serde_json::from_slice(&decode(payload)?).map_err(|_| invalid())?;
    let issuer = match provider {
        Provider::Chatgpt => OPENAI,
        Provider::Google => "https://accounts.google.com",
    };
    if meta["alg"] != "RS256" {
        return Err("O provedor retornou um algoritmo de assinatura incompatível.".into());
    }
    let discovery: Value = parse(
        client
            .get(format!("{issuer}/.well-known/openid-configuration"))
            .send(),
    )
    .map_err(|_| "Não foi possível consultar a configuração de identidade do provedor.")?;
    if discovery["issuer"] != issuer {
        return Err("A configuração de identidade não corresponde ao provedor.".into());
    }
    let jwks = Url::parse(claim(&discovery, "jwks_uri")?).map_err(|_| invalid())?;
    let host = match provider {
        Provider::Chatgpt => "auth.openai.com",
        Provider::Google => "www.googleapis.com",
    };
    if jwks.scheme() != "https"
        || jwks.host_str() != Some(host)
        || !jwks.username().is_empty()
        || jwks.password().is_some()
    {
        return Err(invalid());
    }
    let keys: Value = parse(client.get(jwks).send())
        .map_err(|_| "Não foi possível consultar as chaves de assinatura do provedor.")?;
    let kid = claim(&meta, "kid")?;
    let key = keys["keys"]
        .as_array()
        .into_iter()
        .flatten()
        .find(|key| key["kid"] == kid && key["kty"] == "RSA")
        .ok_or("A chave usada para assinar a identidade não está disponível no provedor. Tente novamente.")?;
    signature::RsaPublicKeyComponents {
        n: decode(claim(key, "n")?)?,
        e: decode(claim(key, "e")?)?,
    }
    .verify(
        &signature::RSA_PKCS1_2048_8192_SHA256,
        format!("{header}.{payload}").as_bytes(),
        &decode(signed)?,
    )
    .map_err(|_| "A assinatura da identidade retornada pelo provedor é inválida.")?;
    validate_identity_claims(&claims, provider, issuer, audience, nonce)?;
    Ok((
        claim(&claims, "sub")?.to_owned(),
        claim(&claims, "email")?.to_owned(),
    ))
}

fn host_id() -> Result<String> {
    let file = storage().join("oauth-host.json");
    match fs::read(&file) {
        Ok(bytes) => {
            serde_json::from_slice(&bytes).map_err(|_| "Identificador local inválido.".into())
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            let id = format!("urn:uuid:{}", glib::uuid_string_random());
            save(file, &id)?;
            Ok(id)
        }
        Err(_) => Err("Não foi possível ler o identificador local.".into()),
    }
}

fn show_login_result(stream: &mut TcpStream, connected: bool, cancelled: bool) {
    let (class, icon, title, description) = match (connected, cancelled) {
        (true, _) => (
            "",
            "✓",
            "Conta conectada",
            "Volte ao Makers 3D para escolher o modelo e iniciar uma conversa.",
        ),
        (false, true) => (
            "",
            "−",
            "Conexão cancelada",
            "Volte ao Makers 3D para iniciar uma nova tentativa quando quiser.",
        ),
        (false, false) => (
            "failed",
            "!",
            "Não foi possível conectar",
            "Volte ao Makers 3D para conferir os detalhes e tentar novamente.",
        ),
    };
    let page = include_str!("login-return.html")
        .replace("{{CLASS}}", class)
        .replace("{{ICON}}", icon)
        .replace("{{TITLE}}", title)
        .replace("{{DESCRIPTION}}", description);
    let _ = write!(
        stream,
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nCache-Control: no-store\r\nReferrer-Policy: no-referrer\r\nX-Content-Type-Options: nosniff\r\nContent-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{page}",
        page.len()
    );
}

fn authorize(client: &Client, request: Request) -> Result<Session> {
    let provider = request.provider;
    let google = if provider == Provider::Google {
        let file: GoogleFile = serde_json::from_str(&request.credentials).map_err(
            |_| "Selecione o JSON de um cliente OAuth do tipo App para computador no Google Cloud.",
        )?;
        let config = file.installed;
        if config.client_id.is_empty()
            || config.client_secret.is_empty()
            || config.project_id.is_empty()
        {
            return Err("O cliente OAuth precisa ter ID, segredo e projeto.".into());
        }
        Some(config)
    } else {
        None
    };
    let listener = TcpListener::bind(("127.0.0.1", 0))
        .map_err(|_| "Não foi possível abrir o retorno local do login.")?;
    let port = listener
        .local_addr()
        .map_err(|_| "Não foi possível abrir o retorno local do login.")?
        .port();
    let redirect = format!("http://127.0.0.1:{port}/auth/callback");
    let (state, nonce, verifier) = (random()?, random()?, random()?);
    let challenge = B64.encode(digest::digest(&digest::SHA256, verifier.as_bytes()));
    let registration_path = storage().join("chatgpt-registration.json");
    let registration: Option<Registration> = if provider == Provider::Chatgpt {
        match fs::read(&registration_path) {
            Ok(bytes) => Some(
                serde_json::from_slice(&bytes)
                    .map_err(|_| "Registro local do ChatGPT inválido.")?,
            ),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
            Err(_) => return Err("Não foi possível ler o registro do ChatGPT.".into()),
        }
    } else {
        None
    };
    let (authorize, scope, entry) = match &google {
        Some(google) => (
            "https://accounts.google.com/o/oauth2/v2/auth",
            "openid email https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/generative-language.retriever",
            google.client_id.as_str(),
        ),
        None => (
            "https://auth.openai.com/api/accounts/authorize",
            "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct",
            registration
                .as_ref()
                .map_or("dynamic_agent_client", |record| record.client_id.as_str()),
        ),
    };
    let mut url = Url::parse(authorize).map_err(|_| "Endereço de autorização inválido.")?;
    url.query_pairs_mut().extend_pairs([
        ("response_type", "code"),
        ("client_id", entry),
        ("redirect_uri", &redirect),
        ("scope", scope),
        ("state", &state),
        ("nonce", &nonce),
        ("code_challenge", &challenge),
        ("code_challenge_method", "S256"),
    ]);
    if google.is_some() {
        url.query_pairs_mut()
            .append_pair("access_type", "offline")
            .append_pair("prompt", "consent");
    } else {
        url.query_pairs_mut()
            .append_pair("ext_agent_host_id", &host_id()?)
            .append_pair("resource", RESOURCE);
        if let Some(record) = &registration {
            url.query_pairs_mut()
                .append_pair("login_hint", &record.email);
        } else {
            url.query_pairs_mut()
                .append_pair("agent_name_hint", "Makers 3D");
        }
    }
    gio::AppInfo::launch_default_for_uri(url.as_str(), gio::AppLaunchContext::NONE)
        .map_err(|_| "Não foi possível abrir o navegador padrão.")?;
    let (mut browser, params) = callback(listener, &state)?;
    let cancelled = params
        .get("error")
        .is_some_and(|error| error == "access_denied");
    let result = (|| {
        if params.contains_key("error") {
            return Err("A autorização foi recusada ou cancelada.".into());
        }
        let code = params
            .get("code")
            .ok_or("O provedor não retornou o código do login.")?;
        let id = match &google {
            Some(_) => entry.to_owned(),
            None if registration.is_some() => {
                if params.get("client_id").is_some_and(|id| id != entry) {
                    return Err("O provedor retornou outro registro de aplicativo.".into());
                }
                entry.to_owned()
            }
            None => params
                .get("client_id")
                .filter(|id| !id.is_empty() && *id != entry)
                .ok_or("O ChatGPT não registrou este aplicativo.")?
                .to_owned(),
        };
        let mut form = vec![
            ("grant_type", "authorization_code"),
            ("client_id", &id),
            ("redirect_uri", &redirect),
            ("code", code),
            ("code_verifier", &verifier),
        ];
        let endpoint = if let Some(google) = &google {
            form.push(("client_secret", &google.client_secret));
            GOOGLE_TOKEN
        } else {
            form.push(("resource", RESOURCE));
            OPENAI_TOKEN
        };
        let token: Token = parse(client.post(endpoint).form(&form).send())?;
        if provider == Provider::Chatgpt
            && !token.scope.as_deref().is_some_and(|scope| {
                scope
                    .split_whitespace()
                    .any(|item| item == "chatgpt.tokens.use.direct")
            })
        {
            return Err("O ChatGPT não liberou o uso do plano para esta conexão.".into());
        }
        let (subject, email) = identity(
            client,
            provider,
            token
                .id_token
                .as_deref()
                .ok_or("O provedor não confirmou a identidade.")?,
            &id,
            &nonce,
        )?;
        if provider == Provider::Chatgpt {
            if registration
                .as_ref()
                .is_some_and(|previous| previous.subject != subject)
            {
                return Err("Entre com a conta usada para registrar o Makers 3D.".into());
            }
            save(
                registration_path,
                &Registration {
                    client_id: id.clone(),
                    subject: subject.clone(),
                    email: email.clone(),
                },
            )?;
        }
        let session = Session {
            client_id: id,
            subject,
            email,
            access: token.access_token,
            refresh: token
                .refresh_token
                .ok_or("O provedor não liberou a renovação da sessão.")?,
            expires: now().saturating_add(token.expires_in),
            google: google.clone(),
        };
        save(path(provider), &session)?;
        Ok(session)
    })();
    show_login_result(&mut browser, result.is_ok(), cancelled);
    result
}

impl Accounts {
    pub fn dispatch(&self, method: &str, body: &[u8]) -> (u32, Value) {
        let result: Result<Value> = (|| {
            let request: Request =
                serde_json::from_slice(body).map_err(|_| "Provedor inválido.")?;
            let provider = request.provider;
            let _guard = self
                .0
                .try_lock()
                .map_err(|_| "Aguarde a operação de conta em andamento.")?;
            match method {
                "POST" => {
                    let session = authorize(&client()?, request)?;
                    Ok(json!({"email": session.email}))
                }
                "PUT" => Ok(json!({"email": load(provider)?.map(|session| session.email)})),
                "DELETE" => {
                    let session = load(provider).ok().flatten();
                    let revoked = session.is_none_or(|session| {
                        let Ok(client) = client() else {
                            return false;
                        };
                        let endpoint = match provider {
                            Provider::Google => "https://oauth2.googleapis.com/revoke",
                            Provider::Chatgpt => {
                                "https://auth.openai.com/api/accounts/oauth/revoke"
                            }
                        };
                        client
                            .post(endpoint)
                            .timeout(Duration::from_secs(10))
                            .form(&[
                                ("token", session.refresh.as_str()),
                                ("token_type_hint", "refresh_token"),
                                ("client_id", &session.client_id),
                            ])
                            .send()
                            .is_ok_and(|response| response.status().is_success())
                    });
                    match fs::remove_file(path(provider)) {
                        Ok(()) => {}
                        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                        Err(_) => return Err("Não foi possível apagar a sessão local.".into()),
                    }
                    Ok(json!({"revoked": revoked}))
                }
                _ => Err("Operação de conta inválida.".into()),
            }
        })();
        match result {
            Ok(data) => (200, data),
            Err(error) => (400, json!({"error": error})),
        }
    }

    fn session(&self, provider: Provider, client: &Client) -> Result<Session> {
        let _guard = self
            .0
            .try_lock()
            .map_err(|_| "Aguarde a operação de conta em andamento.")?;
        let mut session = load(provider)?.ok_or("Conecte sua conta antes de iniciar o chat.")?;
        if now().saturating_add(60) < session.expires {
            return Ok(session);
        }
        let mut form = vec![
            ("grant_type", "refresh_token"),
            ("client_id", &session.client_id),
            ("refresh_token", &session.refresh),
        ];
        let endpoint = if let Some(google) = &session.google {
            form.push(("client_secret", &google.client_secret));
            GOOGLE_TOKEN
        } else {
            form.push(("resource", RESOURCE));
            OPENAI_TOKEN
        };
        let token: Token = parse(client.post(endpoint).form(&form).send())
            .map_err(|error| format!("Falha ao renovar a sessão. {error}"))?;
        session.access = token.access_token;
        session.refresh = token.refresh_token.unwrap_or(session.refresh);
        session.expires = now().saturating_add(token.expires_in);
        save(path(provider), &session)?;
        Ok(session)
    }

    pub fn models(&self) -> (u32, Value) {
        let result: Result<Value> = (|| {
            let client = client()?;
            let session = self.session(Provider::Chatgpt, &client)?;
            let data: Value = parse(
                client
                    .get(format!("{RESOURCE}/models"))
                    .bearer_auth(session.access)
                    .send(),
            )?;
            let models: Vec<_> = data["models"].as_array().into_iter().flatten()
                .filter(|model| model["visibility"] == "list")
                .filter_map(|model| Some(json!({"id": model["slug"].as_str()?, "name": model["display_name"].as_str()?})))
                .collect();
            if models.is_empty() {
                return Err("Nenhum modelo foi liberado para esta conta do ChatGPT.".into());
            }
            Ok(json!(models))
        })();
        match result {
            Ok(data) => (200, data),
            Err(error) => (400, json!({"error": error})),
        }
    }

    pub fn chat(
        &self,
        google: bool,
        model: &str,
        messages: Value,
        publish: &impl Fn(&str),
    ) -> Result<String> {
        let provider = if google {
            Provider::Google
        } else {
            Provider::Chatgpt
        };
        let client = client()?;
        let session = self.session(provider, &client)?;
        if let Some(google) = session.google {
            if !model
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
            {
                return Err("O identificador do modelo Gemini é inválido.".into());
            }
            let contents: Vec<_> = messages
                .as_array()
                .into_iter()
                .flatten()
                .map(|message| {
                    let role = if message["role"] == "assistant" {
                        "model"
                    } else {
                        "user"
                    };
                    json!({"role": role, "parts": [{"text": message["content"]}]})
                })
                .collect();
            let data: Value = parse(client.post(format!("https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"))
                .bearer_auth(session.access).header("x-goog-user-project", google.project_id)
                .json(&json!({"contents": contents})).send())?;
            return nonempty(
                data["candidates"][0]["content"]["parts"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter(|part| part["thought"] != true)
                    .filter_map(|part| part["text"].as_str())
                    .collect::<Vec<_>>()
                    .join("\n"),
            );
        }
        let response = client
            .post(format!("{RESOURCE}/responses"))
            .bearer_auth(session.access)
            .json(&json!({"model": model, "input": messages, "stream": true, "store": false}))
            .send()
            .map_err(|_| "Não foi possível comunicar com o ChatGPT.")?;
        if !response.status().is_success() {
            return Err(format!(
                "O ChatGPT devolveu HTTP {}. Confira a permissão e a cota do plano.",
                response.status().as_u16()
            ));
        }
        let events = BufReader::new(response.take(8_000_000));
        let mut reply = String::new();
        for line in events.lines() {
            let line = line.map_err(|_| "A resposta do ChatGPT foi interrompida.")?;
            let Some(data) = line.strip_prefix("data:") else {
                continue;
            };
            let Ok(event) = serde_json::from_str::<Value>(data.trim()) else {
                continue;
            };
            match event["type"].as_str() {
                Some("response.output_text.delta") => {
                    if let Some(delta) = event["delta"].as_str() {
                        reply.push_str(delta);
                        publish(delta);
                    }
                }
                Some("response.completed") => return nonempty(reply),
                Some("response.failed" | "response.incomplete" | "error") => {
                    return Err(
                        "O ChatGPT não concluiu a resposta. Confira a cota e o acesso ao modelo."
                            .into(),
                    );
                }
                _ => {}
            }
        }
        Err("A resposta do ChatGPT terminou antes de ser concluída.".into())
    }
}

fn nonempty(reply: String) -> Result<String> {
    if reply.trim().is_empty() {
        return Err("O modelo não devolveu uma resposta em texto.".into());
    }
    Ok(reply)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identity_accepts_single_audience_as_a_string_or_array() {
        for audience in [json!("client"), json!(["client"])] {
            let claims =
                json!({"iss": OPENAI, "aud": audience, "nonce": "nonce", "exp": now() + 60});
            assert!(
                validate_identity_claims(&claims, Provider::Chatgpt, OPENAI, "client", "nonce")
                    .is_ok()
            );
        }
    }

    #[test]
    fn identity_requires_matching_party_for_multiple_audiences() {
        let mut claims =
            json!({"iss": OPENAI, "aud": ["client", "other"], "nonce": "nonce", "exp": now() + 60});
        let validate = |claims: &Value| {
            validate_identity_claims(claims, Provider::Chatgpt, OPENAI, "client", "nonce")
        };
        assert!(validate(&claims).is_err());
        claims["azp"] = json!("other");
        assert!(validate(&claims).is_err());
        claims["azp"] = json!("client");
        assert!(validate(&claims).is_ok());
        claims["nonce"] = json!("different");
        assert!(validate(&claims).is_err());
    }

    #[test]
    fn callback_ignores_a_mismatched_state() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let address = listener.local_addr().unwrap();
        let worker = std::thread::spawn(move || {
            for (state, code, status) in [("wrong", "wrong", "404"), ("expected", "valid", "200")] {
                let mut socket = std::net::TcpStream::connect(address).unwrap();
                socket
                    .set_read_timeout(Some(Duration::from_secs(3)))
                    .unwrap();
                write!(socket, "GET /auth/callback?state={state}&code={code} HTTP/1.1\r\nHost: {address}\r\n\r\n").unwrap();
                let mut response = String::new();
                BufReader::new(socket)
                    .read_to_string(&mut response)
                    .unwrap();
                if status == "200" {
                    assert!(response.contains("Content-Type: text/html"));
                    assert!(response.contains("Conta conectada"));
                }
                assert!(response.starts_with(&format!("HTTP/1.1 {status}")));
            }
        });
        let (mut browser, params) = callback(listener, "expected").unwrap();
        assert_eq!(params["code"], "valid");
        show_login_result(&mut browser, true, false);
        drop(browser);
        worker.join().unwrap();
    }
}
