use axum::{
    Json,
    extract::{Query, State},
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    db::models::DictionaryWord,
    error::{AppError, AppResult},
    state::AppState,
};

#[derive(Deserialize)]
pub struct LookupQuery {
    pub word: String,
    pub language: String,
}

pub async fn lookup(
    State(state): State<AppState>,
    _user: AuthUser,
    Query(q): Query<LookupQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let normalized = q.word.trim().to_lowercase();
    if normalized.is_empty() || q.language.trim().is_empty() {
        return Err(AppError::BadRequest(
            "word and language are required".into(),
        ));
    }
    if let Some(entry) = sqlx::query_as::<_, DictionaryWord>(
        "SELECT * FROM dictionary_word WHERE word = $1 AND language = $2 LIMIT 1",
    )
    .bind(&normalized)
    .bind(&q.language)
    .fetch_optional(&state.db)
    .await?
    {
        return Ok(Json(json!({
            "found": true, "source": "dictionary", "word": entry.word, "translation": entry.english_translation,
            "pos": entry.pos, "gender": entry.gender, "cefrLevel": entry.cefr_level,
            "exampleNative": entry.example_sentence_native, "exampleEnglish": entry.example_sentence_english
        })));
    }
    if let Some(cached) = sqlx::query_as::<_, (Option<String>, String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>)>(
        "SELECT base_form, translation, pos, gender, cefr_level, example_native, example_english FROM word_cache WHERE word=$1 AND language=$2 LIMIT 1",
    ).bind(&normalized).bind(&q.language).fetch_optional(&state.db).await? {
        return Ok(Json(json!({ "found": true, "source": "ai", "word": cached.0.unwrap_or(normalized), "translation": cached.1, "pos": cached.2, "gender": cached.3, "cefrLevel": cached.4, "exampleNative": cached.5, "exampleEnglish": cached.6 })));
    }
    let ai = ai_lookup(&state, &normalized, &q.language).await?;
    if let Some(result) = ai {
        sqlx::query("INSERT INTO word_cache (id, word, language, base_form, translation, pos, gender, cefr_level, example_native, example_english) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING")
            .bind(Uuid::new_v4().to_string()).bind(&normalized).bind(&q.language)
            .bind(result.get("word").and_then(|v| v.as_str()).unwrap_or(&normalized))
            .bind(result.get("translation").and_then(|v| v.as_str()).unwrap_or(""))
            .bind(result.get("pos").and_then(|v| v.as_str()))
            .bind(result.get("gender").and_then(|v| v.as_str()))
            .bind(result.get("cefrLevel").and_then(|v| v.as_str()))
            .bind(result.get("exampleNative").and_then(|v| v.as_str()))
            .bind(result.get("exampleEnglish").and_then(|v| v.as_str()))
            .execute(&state.db).await?;
        return Ok(Json(result));
    }
    Ok(Json(json!({ "found": false, "word": normalized })))
}

async fn ai_lookup(
    state: &AppState,
    word: &str,
    language: &str,
) -> AppResult<Option<serde_json::Value>> {
    let Some(key) = state.config.google_ai_api_key.as_deref() else {
        return Ok(None);
    };
    let prompt = format!(
        "Analyze the word '{word}' in language code '{language}'. Return JSON with fields: word, translation, pos, gender, cefrLevel, exampleNative, exampleEnglish."
    );
    let body = json!({ "contents": [{ "parts": [{ "text": prompt }] }], "generationConfig": { "responseMimeType": "application/json" } });
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key={key}"
    );
    let res = state
        .http
        .post(url)
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::External(e.to_string()))?;
    if !res.status().is_success() {
        return Ok(None);
    }
    let json_body: serde_json::Value = res
        .json()
        .await
        .map_err(|e| AppError::External(e.to_string()))?;
    let Some(text) = json_body
        .pointer("/candidates/0/content/parts/0/text")
        .and_then(|v| v.as_str())
    else {
        return Ok(None);
    };
    let parsed: serde_json::Value =
        serde_json::from_str(text).unwrap_or_else(|_| json!({ "translation": text }));
    Ok(Some(json!({
        "found": true, "source": "ai", "word": parsed.get("word").and_then(|v| v.as_str()).unwrap_or(word),
        "translation": parsed.get("translation").and_then(|v| v.as_str()).unwrap_or(""),
        "pos": parsed.get("pos"), "gender": parsed.get("gender"), "cefrLevel": parsed.get("cefrLevel"),
        "exampleNative": parsed.get("exampleNative"), "exampleEnglish": parsed.get("exampleEnglish")
    })))
}
