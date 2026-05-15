use anyhow::Context;

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub port: u16,
    pub app_base_url: String,
    pub api_base_url: String,
    pub session_cookie_name: String,
    pub session_days: i64,
    pub run_migrations: bool,
    pub openai_api_key: Option<String>,
    pub google_ai_api_key: Option<String>,
    #[allow(dead_code)]
    pub exa_api_key: Option<String>,
    pub jina_api_key: Option<String>,
    pub turnstile_secret_key: Option<String>,
    pub resend_api_key: Option<String>,
    pub resend_from_email: String,
    pub slack_webhook: Option<String>,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            database_url: std::env::var("DATABASE_URL").context("DATABASE_URL is required")?,
            port: std::env::var("PORT")
                .or_else(|_| std::env::var("BACKEND_PORT"))
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(8080),
            app_base_url: std::env::var("APP_BASE_URL")
                .unwrap_or_else(|_| "http://localhost:5173".into()),
            api_base_url: std::env::var("API_BASE_URL")
                .unwrap_or_else(|_| "http://localhost:8080".into()),
            session_cookie_name: std::env::var("SESSION_COOKIE_NAME")
                .unwrap_or_else(|_| "openlingo.session_token".into()),
            session_days: std::env::var("SESSION_DAYS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(30),
            run_migrations: std::env::var("RUN_MIGRATIONS")
                .map(|v| v != "false" && v != "0")
                .unwrap_or(true),
            openai_api_key: nonempty_env("OPENAI_API_KEY"),
            google_ai_api_key: nonempty_env("GOOGLE_AI_API_KEY"),
            exa_api_key: nonempty_env("EXA_API_KEY"),
            jina_api_key: nonempty_env("JINA_API_KEY"),
            turnstile_secret_key: nonempty_env("TURNSTILE_SECRET_KEY"),
            resend_api_key: nonempty_env("RESEND_API_KEY"),
            resend_from_email: std::env::var("RESEND_FROM_EMAIL")
                .unwrap_or_else(|_| "OpenLingo <onboarding@resend.dev>".into()),
            slack_webhook: nonempty_env("SLACK_WEBHOOK"),
        })
    }
}

fn nonempty_env(key: &str) -> Option<String> {
    std::env::var(key)
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}
