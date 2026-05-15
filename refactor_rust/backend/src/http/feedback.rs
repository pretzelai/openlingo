use axum::{Json, extract::State, http::HeaderMap};
use serde::Deserialize;
use serde_json::json;

use crate::{
    auth,
    error::{AppError, AppResult},
    services::slack,
    state::AppState,
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedbackInput {
    pub message: String,
    pub email: Option<String>,
    pub turnstile_token: Option<String>,
}

pub async fn submit_feedback(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<FeedbackInput>,
) -> AppResult<Json<serde_json::Value>> {
    if input.message.trim().is_empty() {
        return Err(AppError::BadRequest("message is required".into()));
    }
    let user = auth::optional_user(&headers, &state).await?;
    let text = if let Some(user) = user {
        format!(
            "*Feedback from:* {} ({})\n---\n{}",
            user.name,
            user.email,
            input.message.trim()
        )
    } else {
        auth::turnstile::verify(&state, input.turnstile_token.as_deref()).await?;
        let email = input
            .email
            .filter(|e| !e.trim().is_empty())
            .ok_or_else(|| AppError::BadRequest("email is required".into()))?;
        format!(
            "*Feedback from (not logged in):* {}\n---\n{}",
            email,
            input.message.trim()
        )
    };
    slack::send(&state, text).await?;
    Ok(Json(json!({ "success": true })))
}
