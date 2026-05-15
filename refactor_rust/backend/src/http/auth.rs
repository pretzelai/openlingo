use axum::{
    Json,
    extract::State,
    http::{HeaderMap, StatusCode, header},
    response::IntoResponse,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    auth::{self, SignInRequest, SignUpRequest},
    error::{AppError, AppResult},
    services::{email, slack},
    state::AppState,
};

pub async fn sign_up(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<SignUpRequest>,
) -> AppResult<impl IntoResponse> {
    auth::turnstile::verify(&state, input.turnstile_token.as_deref()).await?;
    let user =
        auth::create_user_with_password(&state.db, &input.name, &input.email, &input.password)
            .await?;
    let token = auth::create_session(&state, &user.id, &headers).await?;
    let cookie = auth::session_cookie(
        &state.config.session_cookie_name,
        &token,
        state.config.session_days,
    );

    let _ = slack::send(
        &state,
        format!("New user signup: {} ({})", user.name, user.email),
    )
    .await;

    Ok((
        StatusCode::OK,
        [(header::SET_COOKIE, cookie)],
        Json(auth::public_session(user)),
    ))
}

pub async fn sign_in(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<SignInRequest>,
) -> AppResult<impl IntoResponse> {
    auth::turnstile::verify(&state, input.turnstile_token.as_deref()).await?;
    let user = auth::authenticate(&state.db, &input.email, &input.password).await?;
    let token = auth::create_session(&state, &user.id, &headers).await?;
    let cookie = auth::session_cookie(
        &state.config.session_cookie_name,
        &token,
        state.config.session_days,
    );
    Ok((
        StatusCode::OK,
        [(header::SET_COOKIE, cookie)],
        Json(auth::public_session(user)),
    ))
}

pub async fn sign_out(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> AppResult<impl IntoResponse> {
    if let Some(token) = auth::read_session_token(&headers, &state.config.session_cookie_name) {
        auth::destroy_session(&state.db, &token).await?;
    }
    Ok((
        StatusCode::OK,
        [(
            header::SET_COOKIE,
            auth::expired_session_cookie(&state.config.session_cookie_name),
        )],
        Json(serde_json::json!({ "success": true })),
    ))
}

pub async fn session(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> AppResult<impl IntoResponse> {
    match auth::optional_user(&headers, &state).await? {
        Some(user) => Ok((
            StatusCode::OK,
            Json(serde_json::to_value(auth::public_session(user)).unwrap()),
        )),
        None => Ok((StatusCode::OK, Json(serde_json::Value::Null))),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestPasswordReset {
    email: String,
}

pub async fn request_password_reset(
    State(state): State<AppState>,
    Json(input): Json<RequestPasswordReset>,
) -> AppResult<impl IntoResponse> {
    let email_addr = input.email.trim().to_lowercase();
    if email_addr.is_empty() {
        return Err(AppError::BadRequest("email is required".into()));
    }
    if let Some((user_id, name)) = sqlx::query_as::<_, (String, String)>(
        r#"SELECT id, name FROM "user" WHERE lower(email) = $1 LIMIT 1"#,
    )
    .bind(&email_addr)
    .fetch_optional(&state.db)
    .await?
    {
        let token = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at) VALUES ($1, $2, $3, now() + interval '1 hour', now(), now())",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(format!("password-reset:{user_id}"))
        .bind(&token)
        .execute(&state.db)
        .await?;
        let reset_url = format!(
            "{}/reset-password?token={}",
            state.config.app_base_url, token
        );
        let html = format!(
            "<p>Hi {},</p><p>Reset your OpenLingo password here:</p><p><a href=\"{}\">Reset password</a></p>",
            name, reset_url
        );
        let _ = email::send_html(&state, &email_addr, "Reset your OpenLingo password", &html).await;
    }
    Ok(Json(serde_json::json!({ "success": true })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfirmPasswordReset {
    #[allow(dead_code)]
    token: String,
    #[allow(dead_code)]
    password: String,
}

pub async fn confirm_password_reset(
    Json(_input): Json<ConfirmPasswordReset>,
) -> AppResult<Json<serde_json::Value>> {
    // Password reset token rotation is scaffolded through verification rows above. The endpoint
    // is intentionally conservative until production hash compatibility is confirmed.
    Err(AppError::BadRequest(
        "password reset confirmation is not enabled yet".into(),
    ))
}
