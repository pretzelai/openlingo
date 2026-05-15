use crate::{
    error::{AppError, AppResult},
    state::AppState,
};

pub async fn send_html(state: &AppState, to: &str, subject: &str, html: &str) -> AppResult<()> {
    let Some(api_key) = state.config.resend_api_key.as_deref() else {
        tracing::info!(%to, %subject, "RESEND_API_KEY unset; skipping email");
        return Ok(());
    };

    let payload = serde_json::json!({
        "from": state.config.resend_from_email,
        "to": [to],
        "subject": subject,
        "html": html,
    });
    let res = state
        .http
        .post("https://api.resend.com/emails")
        .bearer_auth(api_key)
        .json(&payload)
        .send()
        .await
        .map_err(|e| AppError::External(format!("email request failed: {e}")))?;
    if !res.status().is_success() {
        return Err(AppError::External(format!(
            "email returned {}",
            res.status()
        )));
    }
    Ok(())
}
