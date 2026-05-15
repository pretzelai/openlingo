use axum::{
    Json,
    extract::{Path, State},
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::{
    articles::jobs,
    auth::AuthUser,
    db::models::Article,
    error::{AppError, AppResult},
    state::AppState,
};

pub async fn list_articles(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<Vec<Article>>> {
    Ok(Json(
        sqlx::query_as::<_, Article>(
            "SELECT * FROM article WHERE user_id=$1 ORDER BY created_at DESC",
        )
        .bind(user.id())
        .fetch_all(&state.db)
        .await?,
    ))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateArticleBody {
    pub url: String,
    pub target_language: Option<String>,
    pub cefr_level: Option<String>,
}

pub async fn create_article(
    State(state): State<AppState>,
    user: AuthUser,
    Json(input): Json<CreateArticleBody>,
) -> AppResult<Json<serde_json::Value>> {
    let id = Uuid::new_v4().to_string();
    let lang = input.target_language.unwrap_or_else(|| "German".into());
    let cefr = input.cefr_level.unwrap_or_else(|| "B1".into());
    sqlx::query("INSERT INTO article (id,user_id,source_url,target_language,cefr_level,status) VALUES ($1,$2,$3,$4,$5,'fetching')")
        .bind(&id).bind(user.id()).bind(&input.url).bind(&lang).bind(&cefr).execute(&state.db).await?;
    jobs::enqueue(&state, "translate_article", json!({ "articleId": id, "sourceUrl": input.url, "targetLanguage": lang, "cefrLevel": cefr })).await?;
    Ok(Json(
        json!({ "success": true, "articleId": id, "url": format!("/read/{id}") }),
    ))
}

pub async fn get_article(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<Article>> {
    sqlx::query_as::<_, Article>("SELECT * FROM article WHERE id=$1 AND user_id=$2")
        .bind(id)
        .bind(user.id())
        .fetch_optional(&state.db)
        .await?
        .map(Json)
        .ok_or(AppError::NotFound)
}
pub async fn delete_article(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    sqlx::query("DELETE FROM article WHERE id=$1 AND user_id=$2")
        .bind(id)
        .bind(user.id())
        .execute(&state.db)
        .await?;
    Ok(Json(json!({"success":true})))
}
pub async fn article_status(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    let row = sqlx::query_as::<_, (String, i32, i32, Option<String>, Option<String>, chrono::NaiveDateTime)>("SELECT status, translation_progress, total_paragraphs, title, error_message, created_at FROM article WHERE id=$1 AND user_id=$2").bind(id).bind(user.id()).fetch_optional(&state.db).await?.ok_or(AppError::NotFound)?;
    Ok(Json(
        json!({"status":row.0,"translationProgress":row.1,"totalParagraphs":row.2,"title":row.3,"errorMessage":row.4,"createdAt":row.5}),
    ))
}

pub async fn get_article_audio(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    let row = sqlx::query_as::<_, (Option<String>,)>(
        "SELECT audio_url FROM article WHERE id=$1 AND user_id=$2",
    )
    .bind(id)
    .bind(user.id())
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;
    match row.0.as_deref() {
        Some("generating") => Ok(Json(json!({"status":"generating"}))),
        Some(url) => Ok(Json(json!({"audioUrl": url}))),
        None => Err(AppError::NotFound),
    }
}
pub async fn generate_article_audio(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    let exists: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM article WHERE id=$1 AND user_id=$2 AND translated_content IS NOT NULL",
    )
    .bind(&id)
    .bind(user.id())
    .fetch_optional(&state.db)
    .await?;
    if exists.is_none() {
        return Err(AppError::BadRequest(
            "article translation not complete".into(),
        ));
    }
    sqlx::query("UPDATE article SET audio_url='generating' WHERE id=$1")
        .bind(&id)
        .execute(&state.db)
        .await?;
    jobs::enqueue(&state, "article_audio", json!({"articleId": id})).await?;
    Ok(Json(json!({"status":"generating"})))
}
pub async fn timestamps(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    let row = sqlx::query_as::<_, (Option<String>,)>(
        "SELECT audio_timestamps FROM article WHERE id=$1 AND user_id=$2",
    )
    .bind(id)
    .bind(user.id())
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;
    let Some(raw) = row.0 else {
        return Err(AppError::NotFound);
    };
    let parsed: serde_json::Value =
        serde_json::from_str(&raw).map_err(|_| AppError::Internal("invalid timestamps".into()))?;
    Ok(Json(json!({"timestamps": parsed})))
}
