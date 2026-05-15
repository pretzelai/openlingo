use axum::{
    Json,
    extract::{Path, Query, State},
};
use chrono::Utc;
use serde::Deserialize;
use serde_json::json;

use crate::{
    auth::AuthUser,
    db::models::SrsCard,
    error::{AppError, AppResult},
    srs::{CardStatus, ReviewInput, calculate_next_review},
    state::AppState,
};

#[derive(Deserialize)]
pub struct LanguageQuery {
    pub language: Option<String>,
    pub limit: Option<i64>,
}

pub async fn cards(
    State(state): State<AppState>,
    user: AuthUser,
    Query(q): Query<LanguageQuery>,
) -> AppResult<Json<Vec<SrsCard>>> {
    let limit = q.limit.unwrap_or(1000).clamp(1, 5000);
    let rows = if let Some(lang) = q.language {
        sqlx::query_as::<_, SrsCard>("SELECT * FROM srs_card WHERE user_id = $1 AND language = $2 ORDER BY created_at LIMIT $3")
            .bind(user.id()).bind(lang).bind(limit).fetch_all(&state.db).await?
    } else {
        sqlx::query_as::<_, SrsCard>(
            "SELECT * FROM srs_card WHERE user_id = $1 ORDER BY created_at LIMIT $2",
        )
        .bind(user.id())
        .bind(limit)
        .fetch_all(&state.db)
        .await?
    };
    Ok(Json(rows))
}

pub async fn stats(
    State(state): State<AppState>,
    user: AuthUser,
    Query(q): Query<LanguageQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let lang = q.language;
    let (total, due, new_count, learning, review) = if let Some(lang) = lang {
        counts(&state, user.id(), Some(&lang)).await?
    } else {
        counts(&state, user.id(), None).await?
    };
    Ok(Json(
        json!({ "total": total, "due": due, "new": new_count, "learning": learning, "review": review, "learned": review }),
    ))
}

async fn counts(
    state: &AppState,
    user_id: &str,
    lang: Option<&str>,
) -> AppResult<(i64, i64, i64, i64, i64)> {
    let lang_filter = lang.unwrap_or("");
    let row = sqlx::query_as::<_, (i64, i64, i64, i64, i64)>(
        r#"SELECT
          count(*)::bigint,
          count(*) FILTER (WHERE status IN ('learning','review') AND next_review_at IS NOT NULL AND next_review_at <= now())::bigint,
          count(*) FILTER (WHERE status = 'new')::bigint,
          count(*) FILTER (WHERE status = 'learning')::bigint,
          count(*) FILTER (WHERE status = 'review')::bigint
        FROM srs_card WHERE user_id = $1 AND ($2 = '' OR language = $2)"#,
    )
    .bind(user_id).bind(lang_filter).fetch_one(&state.db).await?;
    Ok(row)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddWordBody {
    pub word: Option<String>,
    pub language: String,
    pub translation: Option<String>,
    pub words: Option<Vec<AddWordItem>>,
}
#[derive(Deserialize)]
pub struct AddWordItem {
    pub word: String,
    pub translation: String,
}

pub async fn add_word(
    State(state): State<AppState>,
    user: AuthUser,
    Path(word): Path<String>,
    Json(mut input): Json<AddWordBody>,
) -> AppResult<Json<serde_json::Value>> {
    input.word = Some(word);
    add_words(State(state), user, Json(input)).await
}

pub async fn add_words(
    State(state): State<AppState>,
    user: AuthUser,
    Json(input): Json<AddWordBody>,
) -> AppResult<Json<serde_json::Value>> {
    let mut items = input.words.unwrap_or_default();
    if let Some(word) = input.word {
        items.push(AddWordItem {
            word,
            translation: input.translation.unwrap_or_default(),
        });
    }
    if items.is_empty() {
        return Err(AppError::BadRequest("word is required".into()));
    }
    for item in &items {
        sqlx::query(
            "INSERT INTO srs_card (word, language, user_id, translation, status, next_review_at) VALUES ($1, $2, $3, $4, 'new', null) ON CONFLICT DO NOTHING",
        )
        .bind(item.word.to_lowercase()).bind(&input.language).bind(user.id()).bind(&item.translation)
        .execute(&state.db).await?;
    }
    Ok(Json(json!({ "success": true, "added": items.len() })))
}

pub async fn remove_word(
    State(state): State<AppState>,
    user: AuthUser,
    Path(word): Path<String>,
    Query(q): Query<LanguageQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let lang = q
        .language
        .ok_or_else(|| AppError::BadRequest("language is required".into()))?;
    sqlx::query("DELETE FROM srs_card WHERE user_id = $1 AND language = $2 AND word = $3")
        .bind(user.id())
        .bind(lang)
        .bind(word.to_lowercase())
        .execute(&state.db)
        .await?;
    Ok(Json(json!({ "success": true })))
}

pub async fn remove_all_words(
    State(state): State<AppState>,
    user: AuthUser,
    Query(q): Query<LanguageQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let lang = q
        .language
        .ok_or_else(|| AppError::BadRequest("language is required".into()))?;
    sqlx::query("DELETE FROM srs_card WHERE user_id = $1 AND language = $2")
        .bind(user.id())
        .bind(lang)
        .execute(&state.db)
        .await?;
    Ok(Json(json!({ "success": true })))
}

#[derive(Deserialize)]
pub struct ReviewBody {
    pub word: String,
    pub language: String,
    pub quality: i32,
}

pub async fn review(
    State(state): State<AppState>,
    user: AuthUser,
    Json(input): Json<ReviewBody>,
) -> AppResult<Json<serde_json::Value>> {
    let card = sqlx::query_as::<_, SrsCard>(
        "SELECT * FROM srs_card WHERE user_id = $1 AND language = $2 AND word = $3",
    )
    .bind(user.id())
    .bind(&input.language)
    .bind(input.word.to_lowercase())
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;
    let result = calculate_next_review(
        ReviewInput {
            ease_factor: card.ease_factor,
            interval: card.interval,
            repetitions: card.repetitions,
            status: CardStatus::from(card.status.as_str()),
        },
        input.quality,
    );
    sqlx::query("UPDATE srs_card SET ease_factor=$1, interval=$2, repetitions=$3, status=$4, next_review_at=$5, last_reviewed_at=$6 WHERE user_id=$7 AND language=$8 AND word=$9")
        .bind(result.ease_factor).bind(result.interval).bind(result.repetitions).bind(result.status).bind(result.next_review_at).bind(Utc::now().naive_utc())
        .bind(user.id()).bind(&input.language).bind(input.word.to_lowercase()).execute(&state.db).await?;
    Ok(Json(serde_json::to_value(result).unwrap()))
}

#[derive(Deserialize)]
pub struct IntroduceBody {
    pub language: String,
    pub count: i64,
}

pub async fn introduce_new(
    State(state): State<AppState>,
    user: AuthUser,
    Json(input): Json<IntroduceBody>,
) -> AppResult<Json<Vec<SrsCard>>> {
    let selected = sqlx::query_as::<_, SrsCard>("SELECT * FROM srs_card WHERE user_id=$1 AND language=$2 AND status='new' ORDER BY created_at LIMIT $3")
        .bind(user.id()).bind(&input.language).bind(input.count.clamp(1, 100)).fetch_all(&state.db).await?;
    for card in &selected {
        sqlx::query("UPDATE srs_card SET status='learning', next_review_at=now() WHERE user_id=$1 AND language=$2 AND word=$3")
            .bind(user.id()).bind(&input.language).bind(&card.word).execute(&state.db).await?;
    }
    let mut out = selected;
    for c in &mut out {
        c.status = "learning".into();
        c.next_review_at = Some(Utc::now().naive_utc());
    }
    Ok(Json(out))
}
