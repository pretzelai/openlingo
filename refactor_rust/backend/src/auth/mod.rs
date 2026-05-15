use argon2::{
    Argon2,
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString, rand_core::OsRng},
};
use axum::{
    extract::FromRequestParts,
    http::{HeaderMap, header, request::Parts},
};
use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use chrono::{Duration, Utc};
use rand::RngCore;
use serde::Deserialize;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::{
    db::models::{PublicSession, User},
    error::{AppError, AppResult},
    state::AppState,
};

pub mod oauth_google;
pub mod turnstile;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignUpRequest {
    pub name: String,
    pub email: String,
    pub password: String,
    pub turnstile_token: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignInRequest {
    pub email: String,
    pub password: String,
    pub turnstile_token: Option<String>,
}

#[derive(Clone, Debug)]
pub struct AuthUser(pub User);

impl AuthUser {
    pub fn id(&self) -> &str {
        &self.0.id
    }
    pub fn email(&self) -> &str {
        &self.0.email
    }
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let token = read_session_token(&parts.headers, &state.config.session_cookie_name)
            .ok_or(AppError::Unauthorized)?;
        let user = user_for_session(&state.db, &token)
            .await?
            .ok_or(AppError::Unauthorized)?;
        Ok(AuthUser(user))
    }
}

pub async fn optional_user(headers: &HeaderMap, state: &AppState) -> AppResult<Option<User>> {
    let Some(token) = read_session_token(headers, &state.config.session_cookie_name) else {
        return Ok(None);
    };
    user_for_session(&state.db, &token).await
}

pub fn hash_password(password: &str) -> AppResult<String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| AppError::Internal(format!("password hash failed: {e}")))
}

pub fn verify_password(password: &str, hash: &str) -> bool {
    let Ok(parsed) = PasswordHash::new(hash) else {
        return false;
    };
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok()
}

pub async fn create_user_with_password(
    pool: &PgPool,
    name: &str,
    email: &str,
    password: &str,
) -> AppResult<User> {
    let normalized_email = email.trim().to_lowercase();
    if normalized_email.is_empty() || !normalized_email.contains('@') {
        return Err(AppError::BadRequest("valid email is required".into()));
    }
    if password.len() < 8 {
        return Err(AppError::BadRequest(
            "password must be at least 8 characters".into(),
        ));
    }

    let user_id = Uuid::new_v4().to_string();
    let account_id = Uuid::new_v4().to_string();
    let password_hash = hash_password(password)?;
    let now = Utc::now().naive_utc();

    let mut tx = pool.begin().await?;
    let user = sqlx::query_as::<_, User>(
        r#"INSERT INTO "user" (id, name, email, email_verified, image, created_at, updated_at)
           VALUES ($1, $2, $3, false, null, $4, $4)
           RETURNING id, name, email, email_verified, image, created_at, updated_at"#,
    )
    .bind(&user_id)
    .bind(name.trim())
    .bind(&normalized_email)
    .bind(now)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        if matches!(e, sqlx::Error::Database(ref db) if db.constraint() == Some("user_email_unique")) {
            AppError::BadRequest("email already registered".into())
        } else {
            AppError::Db(e)
        }
    })?;

    sqlx::query(
        r#"INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
           VALUES ($1, $2, 'credential', $3, $4, $5, $5)"#,
    )
    .bind(&account_id)
    .bind(&normalized_email)
    .bind(&user_id)
    .bind(password_hash)
    .bind(now)
    .execute(&mut *tx)
    .await?;

    sqlx::query("INSERT INTO user_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING")
        .bind(&user_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query(
        "INSERT INTO user_preferences (user_id, native_language) VALUES ($1, 'en') ON CONFLICT DO NOTHING",
    )
    .bind(&user_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(user)
}

pub async fn authenticate(pool: &PgPool, email: &str, password: &str) -> AppResult<User> {
    let normalized_email = email.trim().to_lowercase();
    let row = sqlx::query(
        r#"SELECT u.id, u.name, u.email, u.email_verified, u.image, u.created_at, u.updated_at, a.password
           FROM "user" u
           JOIN account a ON a.user_id = u.id
           WHERE lower(u.email) = $1 AND a.provider_id = 'credential'
           LIMIT 1"#,
    )
    .bind(normalized_email)
    .fetch_optional(pool)
    .await?;

    let Some(row) = row else {
        return Err(AppError::Unauthorized);
    };
    let hash: Option<String> = row.try_get("password")?;
    if !hash
        .as_deref()
        .map(|h| verify_password(password, h))
        .unwrap_or(false)
    {
        return Err(AppError::Unauthorized);
    }
    Ok(User {
        id: row.try_get("id")?,
        name: row.try_get("name")?,
        email: row.try_get("email")?,
        email_verified: row.try_get("email_verified")?,
        image: row.try_get("image")?,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
    })
}

pub async fn create_session(
    state: &AppState,
    user_id: &str,
    headers: &HeaderMap,
) -> AppResult<String> {
    let token = random_token();
    let now = Utc::now().naive_utc();
    let expires = now + Duration::days(state.config.session_days);
    let user_agent = headers
        .get(header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .map(ToOwned::to_owned);

    sqlx::query(
        r#"INSERT INTO session (id, expires_at, token, created_at, updated_at, ip_address, user_agent, user_id)
           VALUES ($1, $2, $3, $4, $4, null, $5, $6)"#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(expires)
    .bind(&token)
    .bind(now)
    .bind(user_agent)
    .bind(user_id)
    .execute(&state.db)
    .await?;
    Ok(token)
}

pub async fn destroy_session(pool: &PgPool, token: &str) -> AppResult<()> {
    sqlx::query("DELETE FROM session WHERE token = $1")
        .bind(token)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn user_for_session(pool: &PgPool, token: &str) -> AppResult<Option<User>> {
    let user = sqlx::query_as::<_, User>(
        r#"SELECT u.id, u.name, u.email, u.email_verified, u.image, u.created_at, u.updated_at
           FROM session s
           JOIN "user" u ON u.id = s.user_id
           WHERE s.token = $1 AND s.expires_at > now()
           LIMIT 1"#,
    )
    .bind(token)
    .fetch_optional(pool)
    .await?;
    Ok(user)
}

pub fn read_session_token(headers: &HeaderMap, cookie_name: &str) -> Option<String> {
    let cookie = headers.get(header::COOKIE)?.to_str().ok()?;
    cookie.split(';').find_map(|pair| {
        let mut parts = pair.trim().splitn(2, '=');
        let name = parts.next()?.trim();
        let value = parts.next()?.trim();
        (name == cookie_name).then(|| value.to_string())
    })
}

pub fn session_cookie(cookie_name: &str, token: &str, max_age_days: i64) -> String {
    format!(
        "{}={}; Path=/; Max-Age={}; HttpOnly; SameSite=Lax",
        cookie_name,
        token,
        max_age_days * 24 * 60 * 60
    )
}

pub fn expired_session_cookie(cookie_name: &str) -> String {
    format!(
        "{}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
        cookie_name
    )
}

fn random_token() -> String {
    let mut bytes = [0_u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

pub fn public_session(user: User) -> PublicSession {
    PublicSession { user }
}
