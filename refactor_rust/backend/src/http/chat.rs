use std::convert::Infallible;

use axum::{
    Json,
    extract::{Path, State},
    response::sse::{Event, Sse},
};
use futures_util::Stream;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::{
    ai,
    auth::AuthUser,
    db::models::ChatConversation,
    error::{AppError, AppResult},
    state::AppState,
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamChatBody {
    pub messages: Vec<ClientMessage>,
    pub language: Option<String>,
    pub model: Option<String>,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ClientMessage {
    pub role: String,
    pub content: String,
}

pub async fn stream_chat(
    State(state): State<AppState>,
    user: AuthUser,
    Json(input): Json<StreamChatBody>,
) -> AppResult<Sse<impl Stream<Item = Result<Event, Infallible>>>> {
    let prompt = build_prompt(&state, user.id(), &input).await?;
    let text = ai::generate_text(&state, &prompt, input.model.as_deref()).await?;
    let stream = async_stream::stream! {
        for chunk in text.as_bytes().chunks(80) {
            let s = String::from_utf8_lossy(chunk).to_string();
            yield Ok(Event::default().event("delta").data(s));
        }
        yield Ok(Event::default().event("done").data("{}"));
    };
    Ok(Sse::new(stream))
}

async fn build_prompt(
    state: &AppState,
    user_id: &str,
    input: &StreamChatBody,
) -> AppResult<String> {
    let memory: Option<(String,)> =
        sqlx::query_as("SELECT value FROM user_memory WHERE user_id=$1 AND key='memory' LIMIT 1")
            .bind(user_id)
            .fetch_optional(&state.db)
            .await?;
    let lang = input.language.clone().unwrap_or_else(|| "en".into());
    let transcript = input
        .messages
        .iter()
        .map(|m| format!("{}: {}", m.role, m.content))
        .collect::<Vec<_>>()
        .join("\n");
    Ok(format!(
        "You are OpenLingo, a friendly language tutor. Target language code: {lang}. Memory: {}\n\nConversation:\n{transcript}",
        memory.map(|m| m.0).unwrap_or_default()
    ))
}

pub async fn ai_prompt(
    State(state): State<AppState>,
    _user: AuthUser,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    let prompt = body
        .get("prompt")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::BadRequest("prompt is required".into()))?;
    let result = ai::generate_text(&state, prompt, Some("gemini-2.5-flash-lite")).await?;
    Ok(Json(json!({ "result": result })))
}

pub async fn list_conversations(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<Vec<ChatConversation>>> {
    Ok(Json(
        sqlx::query_as::<_, ChatConversation>(
            "SELECT * FROM chat_conversation WHERE user_id=$1 ORDER BY updated_at DESC",
        )
        .bind(user.id())
        .fetch_all(&state.db)
        .await?,
    ))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateConversationBody {
    pub language: String,
    pub title: String,
    pub messages: Value,
}

pub async fn create_conversation(
    State(state): State<AppState>,
    user: AuthUser,
    Json(input): Json<CreateConversationBody>,
) -> AppResult<Json<Value>> {
    let id = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO chat_conversation (id,user_id,title,language,messages) VALUES ($1,$2,$3,$4,$5)")
        .bind(&id).bind(user.id()).bind(input.title).bind(input.language).bind(input.messages).execute(&state.db).await?;
    Ok(Json(json!({ "id": id })))
}

pub async fn get_conversation(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<ChatConversation>> {
    sqlx::query_as::<_, ChatConversation>(
        "SELECT * FROM chat_conversation WHERE id=$1 AND user_id=$2",
    )
    .bind(id)
    .bind(user.id())
    .fetch_optional(&state.db)
    .await?
    .map(Json)
    .ok_or(AppError::NotFound)
}

#[derive(Deserialize)]
pub struct SaveConversationBody {
    pub messages: Value,
}

pub async fn save_conversation(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(input): Json<SaveConversationBody>,
) -> AppResult<Json<Value>> {
    sqlx::query(
        "UPDATE chat_conversation SET messages=$1, updated_at=now() WHERE id=$2 AND user_id=$3",
    )
    .bind(input.messages)
    .bind(id)
    .bind(user.id())
    .execute(&state.db)
    .await?;
    Ok(Json(json!({ "success": true })))
}

pub async fn delete_conversation(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    sqlx::query("DELETE FROM chat_conversation WHERE id=$1 AND user_id=$2")
        .bind(id)
        .bind(user.id())
        .execute(&state.db)
        .await?;
    Ok(Json(json!({ "success": true })))
}
