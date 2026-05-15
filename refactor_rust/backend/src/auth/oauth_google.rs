use axum::{
    extract::{Query, State},
    http::{StatusCode, header},
    response::{IntoResponse, Redirect},
};
use serde::Deserialize;

use crate::{
    error::{AppError, AppResult},
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct GoogleCallbackQuery {
    pub code: Option<String>,
    pub error: Option<String>,
}

pub async fn start(State(state): State<AppState>) -> impl IntoResponse {
    let client_id = std::env::var("GOOGLE_CLIENT_ID").unwrap_or_default();
    if client_id.is_empty() {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            "Google OAuth is not configured",
        )
            .into_response();
    }
    let redirect_uri = format!("{}/api/auth/google/callback", state.config.api_base_url);
    let url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope=openid%20email%20profile&prompt=select_account",
        urlencoding::encode(&client_id),
        urlencoding::encode(&redirect_uri),
    );
    Redirect::temporary(&url).into_response()
}

pub async fn callback(
    State(state): State<AppState>,
    Query(query): Query<GoogleCallbackQuery>,
) -> AppResult<impl IntoResponse> {
    if let Some(error) = query.error {
        return Err(AppError::BadRequest(format!(
            "google oauth failed: {error}"
        )));
    }
    let _code = query
        .code
        .ok_or_else(|| AppError::BadRequest("missing oauth code".into()))?;

    // Full Google OAuth exchange is intentionally isolated here. The endpoint is wired so
    // deployments can enable it by adding the token/profile exchange without touching routes.
    // Email/password auth is complete and is the default test-domain path.
    Ok((
        StatusCode::TEMPORARY_REDIRECT,
        [(
            header::LOCATION,
            format!(
                "{}/sign-in?oauth=not-yet-enabled",
                state.config.app_base_url
            ),
        )],
    ))
}
