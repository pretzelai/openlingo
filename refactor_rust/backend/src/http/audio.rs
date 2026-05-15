use axum::{
    Json,
    body::Body,
    extract::{Multipart, Query, State},
    http::{StatusCode, header},
    response::{IntoResponse, Response},
};
use serde::Deserialize;
use serde_json::json;

use crate::{
    audio::audio_key,
    error::{AppError, AppResult},
    state::AppState,
};

#[derive(Deserialize)]
pub struct TtsQuery {
    pub key: Option<String>,
}

pub async fn get_tts(Query(q): Query<TtsQuery>) -> AppResult<Response> {
    let key = q
        .key
        .ok_or_else(|| AppError::BadRequest("key is required".into()))?;
    let safe = key.replace("..", "");
    let path = std::path::Path::new("/tmp/openlingo-refactor-audio").join(safe);
    let bytes = tokio::fs::read(path)
        .await
        .map_err(|_| AppError::NotFound)?;
    Ok((
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "audio/mpeg"),
            (header::CACHE_CONTROL, "public, max-age=31536000, immutable"),
        ],
        Body::from(bytes),
    )
        .into_response())
}

#[derive(Deserialize)]
pub struct TtsBody {
    pub text: String,
    pub language: String,
}

pub async fn create_tts(
    State(state): State<AppState>,
    Json(input): Json<TtsBody>,
) -> AppResult<Json<serde_json::Value>> {
    if input.text.trim().is_empty() {
        return Err(AppError::BadRequest("text is required".into()));
    }
    if input.text.len() > 4096 {
        return Err(AppError::BadRequest(
            "text must be under 4096 characters".into(),
        ));
    }
    let normalized = input.text.to_lowercase();
    if let Some((r2_key,)) = sqlx::query_as::<_, (String,)>(
        "SELECT r2_key FROM audio_cache WHERE text=$1 AND language=$2 LIMIT 1",
    )
    .bind(&normalized)
    .bind(&input.language)
    .fetch_optional(&state.db)
    .await?
    {
        return Ok(Json(
            json!({ "url": format!("/api/tts?key={}", urlencoding::encode(&r2_key)) }),
        ));
    }
    let key = audio_key(&input.text, &input.language);
    if let Some(api_key) = state.config.openai_api_key.as_deref() {
        let res = state.http.post("https://api.openai.com/v1/audio/speech")
            .bearer_auth(api_key)
            .json(&json!({"model":"gpt-4o-mini-tts","voice":"coral","input":input.text,"response_format":"mp3"}))
            .send().await.map_err(|e| AppError::External(e.to_string()))?;
        if res.status().is_success() {
            let bytes = res
                .bytes()
                .await
                .map_err(|e| AppError::External(e.to_string()))?;
            let path = std::path::Path::new("/tmp/openlingo-refactor-audio").join(&key);
            if let Some(parent) = path.parent() {
                let _ = tokio::fs::create_dir_all(parent).await;
            }
            tokio::fs::write(&path, bytes)
                .await
                .map_err(|e| AppError::Internal(e.to_string()))?;
            sqlx::query("INSERT INTO audio_cache (id,text,language,r2_key) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING")
                .bind(uuid::Uuid::new_v4().to_string()).bind(&normalized).bind(&input.language).bind(&key).execute(&state.db).await?;
            return Ok(Json(
                json!({ "url": format!("/api/tts?key={}", urlencoding::encode(&key)) }),
            ));
        }
    }
    Ok(Json(
        json!({ "url": "", "warning": "OPENAI_API_KEY is not configured" }),
    ))
}

pub async fn stt(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> AppResult<Json<serde_json::Value>> {
    let Some(api_key) = state.config.openai_api_key.as_deref() else {
        return Ok(Json(json!({ "text": "" })));
    };
    let mut audio: Option<(String, Vec<u8>, String)> = None;
    let mut language = String::from("en");
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?
    {
        let name = field.name().unwrap_or_default().to_string();
        if name == "language" {
            language = field.text().await.unwrap_or_else(|_| "en".into());
        } else if name == "audio" {
            let content_type = field.content_type().unwrap_or("audio/webm").to_string();
            let bytes = field
                .bytes()
                .await
                .map_err(|e| AppError::BadRequest(e.to_string()))?
                .to_vec();
            audio = Some(("recording.webm".into(), bytes, content_type));
        }
    }
    let Some((filename, bytes, mime)) = audio else {
        return Err(AppError::BadRequest("audio file is required".into()));
    };
    let part = reqwest::multipart::Part::bytes(bytes)
        .file_name(filename)
        .mime_str(&mime)
        .map_err(|e| AppError::BadRequest(e.to_string()))?;
    let form = reqwest::multipart::Form::new()
        .text("model", "whisper-1")
        .text("language", language)
        .part("file", part);
    let res = state
        .http
        .post("https://api.openai.com/v1/audio/transcriptions")
        .bearer_auth(api_key)
        .multipart(form)
        .send()
        .await
        .map_err(|e| AppError::External(e.to_string()))?;
    let body: serde_json::Value = res
        .json()
        .await
        .map_err(|e| AppError::External(e.to_string()))?;
    Ok(Json(
        json!({ "text": body.get("text").and_then(|v| v.as_str()).unwrap_or("") }),
    ))
}
