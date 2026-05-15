use crate::{
    error::{AppError, AppResult},
    state::AppState,
};

pub async fn send(state: &AppState, text: impl Into<String>) -> AppResult<()> {
    let Some(webhook) = state.config.slack_webhook.as_deref() else {
        tracing::info!(message = %text.into(), "SLACK_WEBHOOK unset; skipping Slack delivery");
        return Ok(());
    };
    let payload = serde_json::json!({ "text": text.into() });
    let res = state
        .http
        .post(webhook)
        .json(&payload)
        .send()
        .await
        .map_err(|e| AppError::External(format!("slack request failed: {e}")))?;
    if !res.status().is_success() {
        return Err(AppError::External(format!(
            "slack returned {}",
            res.status()
        )));
    }
    Ok(())
}
