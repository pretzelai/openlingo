use serde_json::{Value, json};
use tokio::time::{Duration, sleep};
use uuid::Uuid;

use crate::{
    ai,
    articles::{chunks, count_words, html_to_text},
    error::{AppError, AppResult},
    state::AppState,
};

pub fn spawn_worker(state: AppState) {
    tokio::spawn(async move {
        loop {
            if let Err(err) = claim_one(&state).await {
                tracing::warn!(?err, "job worker tick failed");
            }
            sleep(Duration::from_secs(2)).await;
        }
    });
}

pub async fn enqueue(state: &AppState, kind: &str, payload: Value) -> AppResult<String> {
    let id = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO jobs (id, kind, payload) VALUES ($1,$2,$3)")
        .bind(&id)
        .bind(kind)
        .bind(payload)
        .execute(&state.db)
        .await?;
    Ok(id)
}

async fn claim_one(state: &AppState) -> AppResult<()> {
    let mut tx = state.db.begin().await?;
    let row = sqlx::query_as::<_, (String, String, Value)>(
        r#"SELECT id, kind, payload FROM jobs
           WHERE status='queued' AND run_at <= now() AND locked_at IS NULL
           ORDER BY created_at
           LIMIT 1
           FOR UPDATE SKIP LOCKED"#,
    )
    .fetch_optional(&mut *tx)
    .await?;
    let Some((id, kind, payload)) = row else {
        tx.commit().await?;
        return Ok(());
    };
    sqlx::query("UPDATE jobs SET status='running', locked_at=now(), updated_at=now() WHERE id=$1")
        .bind(&id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;

    let result = match kind.as_str() {
        "translate_article" => translate_article(state, payload).await,
        "article_audio" => article_audio(state, payload).await,
        _ => Err(AppError::BadRequest(format!("unknown job kind {kind}"))),
    };
    match result {
        Ok(()) => {
            sqlx::query("UPDATE jobs SET status='completed', updated_at=now() WHERE id=$1")
                .bind(id)
                .execute(&state.db)
                .await?;
        }
        Err(err) => {
            sqlx::query("UPDATE jobs SET status='failed', attempts=attempts+1, last_error=$2, locked_at=null, updated_at=now() WHERE id=$1").bind(id).bind(err.to_string()).execute(&state.db).await?;
        }
    }
    Ok(())
}

async fn translate_article(state: &AppState, payload: Value) -> AppResult<()> {
    let article_id = payload["articleId"]
        .as_str()
        .ok_or_else(|| AppError::BadRequest("articleId missing".into()))?;
    let source_url = payload["sourceUrl"]
        .as_str()
        .ok_or_else(|| AppError::BadRequest("sourceUrl missing".into()))?;
    let target_language = payload["targetLanguage"].as_str().unwrap_or("German");
    let cefr = payload["cefrLevel"].as_str().unwrap_or("B1");
    sqlx::query("UPDATE article SET status='fetching' WHERE id=$1")
        .bind(article_id)
        .execute(&state.db)
        .await?;
    let html = fetch_article(state, source_url).await?;
    let title = extract_title(&html).unwrap_or_else(|| "Untitled".into());
    let text = html_to_text(&html);
    let chunks = chunks(&text);
    sqlx::query("UPDATE article SET title=$1, original_content=$2, source_language='Unknown', status='translating', total_paragraphs=$3, translation_progress=0 WHERE id=$4")
        .bind(&title).bind(serde_json::to_string(&chunks).unwrap()).bind(chunks.len() as i32).bind(article_id).execute(&state.db).await?;
    let mut blocks = Vec::new();
    for (idx, chunk) in chunks.iter().enumerate() {
        let prompt = format!(
            "Translate/adapt this article chunk into {target_language} at CEFR {cefr}. Return only the translated text.\n\n{chunk}"
        );
        let translated = ai::generate_text(state, &prompt, Some("gemini-3-flash-preview"))
            .await
            .unwrap_or_else(|_| chunk.clone());
        blocks.push(json!({ "original": chunk, "translated": translated, "bridge": null }));
        sqlx::query(
            "UPDATE article SET translated_content=$1, translation_progress=$2 WHERE id=$3",
        )
        .bind(serde_json::to_string(&blocks).unwrap())
        .bind((idx + 1) as i32)
        .bind(article_id)
        .execute(&state.db)
        .await?;
    }
    let translated_text = blocks
        .iter()
        .filter_map(|b| b["translated"].as_str())
        .collect::<Vec<_>>()
        .join(" ");
    sqlx::query("UPDATE article SET status='completed', translated_content=$1, translation_progress=total_paragraphs, word_count=$2 WHERE id=$3")
        .bind(serde_json::to_string(&blocks).unwrap()).bind(count_words(&translated_text) as i32).bind(article_id).execute(&state.db).await?;
    Ok(())
}

async fn article_audio(_state: &AppState, payload: Value) -> AppResult<()> {
    let article_id = payload["articleId"]
        .as_str()
        .ok_or_else(|| AppError::BadRequest("articleId missing".into()))?;
    // Audio generation endpoint marks state as generating; the backend audio module can be extended
    // to upload real MP3 to R2. For now we reset gracefully so UI can retry when OpenAI/R2 are added.
    sqlx::query("UPDATE article SET audio_url=null WHERE id=$1")
        .bind(article_id)
        .execute(&_state.db)
        .await?;
    Ok(())
}

async fn fetch_article(state: &AppState, source_url: &str) -> AppResult<String> {
    let direct = state
        .http
        .get(source_url)
        .header("User-Agent", "Mozilla/5.0 OpenLingo")
        .send()
        .await;
    if let Ok(res) = direct {
        if res.status().is_success() {
            if let Ok(text) = res.text().await {
                if text.len() > 200 {
                    return Ok(text);
                }
            }
        }
    }
    if state.config.jina_api_key.is_some() {
        let jina_url = format!("https://r.jina.ai/{}", urlencoding::encode(source_url));
        let res = state
            .http
            .get(jina_url)
            .send()
            .await
            .map_err(|e| AppError::External(e.to_string()))?;
        if res.status().is_success() {
            return res
                .text()
                .await
                .map_err(|e| AppError::External(e.to_string()));
        }
    }
    Err(AppError::External("failed to fetch article".into()))
}

fn extract_title(html: &str) -> Option<String> {
    let re = regex::Regex::new(r"(?is)<title[^>]*>([^<]+)</title>").ok()?;
    re.captures(html)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().trim().to_string())
}
