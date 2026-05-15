use axum::{
    Json,
    extract::{Path, State},
};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::{
    auth::AuthUser,
    db::models::{UserPreferences, UserStats},
    error::{AppError, AppResult},
    services,
    state::AppState,
};

pub async fn me(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<serde_json::Value>> {
    let stats = get_or_create_stats(&state, user.id()).await?;
    let prefs = get_or_create_preferences(&state, user.id()).await?;
    Ok(Json(
        json!({ "user": user.0, "stats": stats, "preferences": prefs }),
    ))
}

pub async fn github_stars(State(state): State<AppState>) -> AppResult<Json<serde_json::Value>> {
    Ok(Json(
        json!({ "stars": services::github::stars(&state).await? }),
    ))
}

pub async fn preferences(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<UserPreferences>> {
    Ok(Json(get_or_create_preferences(&state, user.id()).await?))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePreferences {
    pub target_language: Option<String>,
    pub native_language: Option<String>,
    pub preferred_model: Option<String>,
}

pub async fn update_preferences(
    State(state): State<AppState>,
    user: AuthUser,
    Json(input): Json<UpdatePreferences>,
) -> AppResult<Json<UserPreferences>> {
    sqlx::query(
        r#"INSERT INTO user_preferences (user_id, target_language, native_language, preferred_model)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id) DO UPDATE SET
             target_language = COALESCE(EXCLUDED.target_language, user_preferences.target_language),
             native_language = COALESCE(EXCLUDED.native_language, user_preferences.native_language),
             preferred_model = COALESCE(EXCLUDED.preferred_model, user_preferences.preferred_model),
             updated_at = now()"#,
    )
    .bind(user.id())
    .bind(input.target_language)
    .bind(input.native_language)
    .bind(input.preferred_model)
    .execute(&state.db)
    .await?;
    Ok(Json(get_or_create_preferences(&state, user.id()).await?))
}

pub async fn profile(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<serde_json::Value>> {
    let stats = get_or_create_stats(&state, user.id()).await?;
    let recent = sqlx::query_as::<_, (String, String, i32, bool, chrono::NaiveDateTime)>(
        "SELECT id, unit_id, lesson_index, perfect_score, completed_at FROM lesson_completion WHERE user_id = $1 ORDER BY completed_at DESC LIMIT 10",
    )
    .bind(user.id())
    .fetch_all(&state.db)
    .await?;
    Ok(Json(
        json!({ "user": user.0, "stats": stats, "recentCompletions": recent }),
    ))
}

pub async fn update_profile(
    State(state): State<AppState>,
    user: AuthUser,
    Json(input): Json<UpdatePreferences>,
) -> AppResult<Json<UserPreferences>> {
    update_preferences(State(state), user, Json(input)).await
}

pub async fn prompts(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<Vec<PromptWithOverride>>> {
    let overrides = sqlx::query_as::<_, (String, String)>(
        "SELECT key, value FROM user_memory WHERE user_id = $1 AND key LIKE 'prompt:%'",
    )
    .bind(user.id())
    .fetch_all(&state.db)
    .await?;
    let mut output = vec![];
    for def in default_prompts() {
        let key = format!("prompt:{}", def.id);
        let custom = overrides
            .iter()
            .find(|(k, _)| k == &key)
            .map(|(_, v)| v.clone());
        output.push(PromptWithOverride {
            custom_template: custom,
            ..def
        });
    }
    Ok(Json(output))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptWithOverride {
    pub id: String,
    pub display_name: String,
    pub description: String,
    pub default_template: String,
    pub variables: Vec<String>,
    pub custom_template: Option<String>,
}

#[derive(Deserialize)]
pub struct SaveText {
    value: String,
}

pub async fn save_prompt(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(input): Json<SaveText>,
) -> AppResult<Json<serde_json::Value>> {
    if !default_prompts().iter().any(|p| p.id == id) {
        return Err(AppError::BadRequest("unknown prompt".into()));
    }
    upsert_memory(&state, user.id(), &format!("prompt:{id}"), &input.value).await?;
    Ok(Json(json!({ "success": true })))
}

pub async fn reset_prompt(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    sqlx::query("DELETE FROM user_memory WHERE user_id = $1 AND key = $2")
        .bind(user.id())
        .bind(format!("prompt:{id}"))
        .execute(&state.db)
        .await?;
    Ok(Json(json!({ "success": true })))
}

pub async fn memory(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<serde_json::Value>> {
    let row = sqlx::query_as::<_, (String,)>(
        "SELECT value FROM user_memory WHERE user_id = $1 AND key = 'memory' LIMIT 1",
    )
    .bind(user.id())
    .fetch_optional(&state.db)
    .await?;
    Ok(Json(
        json!({ "value": row.map(|r| r.0).unwrap_or_default() }),
    ))
}

pub async fn save_memory(
    State(state): State<AppState>,
    user: AuthUser,
    Json(input): Json<SaveText>,
) -> AppResult<Json<serde_json::Value>> {
    upsert_memory(&state, user.id(), "memory", &input.value).await?;
    Ok(Json(json!({ "success": true })))
}

async fn upsert_memory(state: &AppState, user_id: &str, key: &str, value: &str) -> AppResult<()> {
    sqlx::query(
        "INSERT INTO user_memory (id, user_id, key, value) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()",
    )
    .bind(uuid::Uuid::new_v4().to_string()).bind(user_id).bind(key).bind(value)
    .execute(&state.db).await?;
    Ok(())
}

async fn get_or_create_stats(state: &AppState, user_id: &str) -> AppResult<UserStats> {
    sqlx::query("INSERT INTO user_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING")
        .bind(user_id)
        .execute(&state.db)
        .await?;
    Ok(sqlx::query_as::<_, UserStats>("SELECT user_id, current_streak, longest_streak, last_practice_date, total_lessons_completed FROM user_stats WHERE user_id = $1")
        .bind(user_id).fetch_one(&state.db).await?)
}

async fn get_or_create_preferences(state: &AppState, user_id: &str) -> AppResult<UserPreferences> {
    sqlx::query("INSERT INTO user_preferences (user_id, native_language) VALUES ($1, 'en') ON CONFLICT DO NOTHING").bind(user_id).execute(&state.db).await?;
    Ok(sqlx::query_as::<_, UserPreferences>("SELECT user_id, native_language, target_language, preferred_model, updated_at FROM user_preferences WHERE user_id = $1")
        .bind(user_id).fetch_one(&state.db).await?)
}

pub fn default_prompts() -> Vec<PromptWithOverride> {
    vec![
        PromptWithOverride { id: "chat-system".into(), display_name: "Chat tutor".into(), description: "System prompt for the AI tutor".into(), default_template: "You are OpenLingo, a friendly language tutor. Target language: {{target_language}}. Native language: {{native_language}}. Memory: {{memory}}".into(), variables: vec!["target_language".into(), "native_language".into(), "memory".into()], custom_template: None },
        PromptWithOverride { id: "word-analysis".into(), display_name: "Word analysis".into(), description: "Analyze unknown words".into(), default_template: "Analyze {{word}} in {{target_language}}.".into(), variables: vec!["word".into(), "target_language".into()], custom_template: None },
        PromptWithOverride { id: "tts-instructions".into(), display_name: "TTS instructions".into(), description: "Speech style".into(), default_template: "Speak clearly in {{target_language}} for a language learner.".into(), variables: vec!["target_language".into()], custom_template: None },
    ]
}
