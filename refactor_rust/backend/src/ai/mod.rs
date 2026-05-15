use serde_json::json;

use crate::{
    error::{AppError, AppResult},
    state::AppState,
};

pub const DEFAULT_MODEL: &str = "gemini-3-flash-preview";

#[allow(dead_code)]
pub fn available_models(is_admin: bool) -> Vec<serde_json::Value> {
    let all = vec![
        json!({"id":"gemini-3-flash-preview","label":"Gemini 3 Flash","provider":"google"}),
        json!({"id":"gemini-3-pro-preview","label":"Gemini 3 Pro","provider":"google"}),
        json!({"id":"gemini-2.5-flash-lite","label":"Gemini 2.5 Flash Lite","provider":"google"}),
        json!({"id":"gpt-4o","label":"GPT-4o","provider":"openai"}),
        json!({"id":"gpt-4o-mini","label":"GPT-4o Mini","provider":"openai"}),
        json!({"id":"claude-sonnet-4-6","label":"Claude Sonnet 4.6","provider":"anthropic"}),
    ];
    if is_admin {
        all
    } else {
        all.into_iter()
            .filter(|m| m["id"] == "claude-sonnet-4-6" || m["provider"] == "google")
            .collect()
    }
}

pub async fn generate_text(
    state: &AppState,
    prompt: &str,
    model: Option<&str>,
) -> AppResult<String> {
    if let Some(key) = state.config.google_ai_api_key.as_deref() {
        let model = model.unwrap_or(DEFAULT_MODEL);
        let body = json!({ "contents": [{ "parts": [{ "text": prompt }] }] });
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
        );
        let res = state
            .http
            .post(url)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::External(e.to_string()))?;
        if res.status().is_success() {
            let body: serde_json::Value = res
                .json()
                .await
                .map_err(|e| AppError::External(e.to_string()))?;
            if let Some(text) = body
                .pointer("/candidates/0/content/parts/0/text")
                .and_then(|v| v.as_str())
            {
                return Ok(text.to_string());
            }
        }
    }
    Ok(format!(
        "I’m running in local fallback mode because no AI provider is configured. You said: {prompt}"
    ))
}

#[allow(dead_code)]
pub fn is_admin(email: &str) -> bool {
    std::env::var("ADMIN_EMAILS")
        .unwrap_or_default()
        .split(',')
        .any(|e| e.trim().eq_ignore_ascii_case(email))
}
