use serde::Deserialize;

use crate::{
    error::{AppError, AppResult},
    state::AppState,
};

#[derive(Debug, Deserialize)]
struct TurnstileResponse {
    success: bool,
}

pub async fn verify(state: &AppState, token: Option<&str>) -> AppResult<()> {
    let Some(secret) = state.config.turnstile_secret_key.as_deref() else {
        return Ok(());
    };
    let Some(token) = token.filter(|v| !v.is_empty()) else {
        return Err(AppError::BadRequest("bot verification is required".into()));
    };

    let res = state
        .http
        .post("https://challenges.cloudflare.com/turnstile/v0/siteverify")
        .form(&[("secret", secret), ("response", token)])
        .send()
        .await
        .map_err(|e| AppError::External(format!("turnstile request failed: {e}")))?;
    let body: TurnstileResponse = res
        .json()
        .await
        .map_err(|e| AppError::External(format!("turnstile response failed: {e}")))?;
    if body.success {
        Ok(())
    } else {
        Err(AppError::BadRequest("bot verification failed".into()))
    }
}
