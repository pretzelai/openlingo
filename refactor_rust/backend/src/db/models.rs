use chrono::{NaiveDate, NaiveDateTime};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: String,
    pub name: String,
    pub email: String,
    pub email_verified: bool,
    pub image: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct SessionRow {
    pub id: String,
    pub expires_at: NaiveDateTime,
    pub token: String,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub user_id: String,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct Account {
    pub id: String,
    pub account_id: String,
    pub provider_id: String,
    pub user_id: String,
    pub password: Option<String>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct UserStats {
    pub user_id: String,
    pub current_streak: i32,
    pub longest_streak: i32,
    pub last_practice_date: Option<NaiveDate>,
    pub total_lessons_completed: i32,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct UserPreferences {
    pub user_id: String,
    pub native_language: Option<String>,
    pub target_language: Option<String>,
    pub preferred_model: Option<String>,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CourseRow {
    pub id: String,
    pub title: String,
    pub source_language: String,
    pub target_language: String,
    pub level: String,
    pub visibility: Option<String>,
    pub published: bool,
    pub created_by: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct UnitRow {
    pub id: String,
    pub course_id: Option<String>,
    pub title: String,
    pub description: String,
    pub icon: String,
    pub color: String,
    pub markdown: String,
    pub target_language: String,
    pub source_language: Option<String>,
    pub level: Option<String>,
    pub visibility: Option<String>,
    pub created_by: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct SrsCard {
    pub word: String,
    pub language: String,
    pub user_id: String,
    pub translation: String,
    pub cefr_level: Option<String>,
    pub pos: Option<String>,
    pub gender: Option<String>,
    pub example_native: Option<String>,
    pub example_english: Option<String>,
    pub status: String,
    pub ease_factor: f32,
    pub interval: i32,
    pub repetitions: i32,
    pub next_review_at: Option<NaiveDateTime>,
    pub last_reviewed_at: Option<NaiveDateTime>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct DictionaryWord {
    pub id: String,
    pub word: String,
    pub language: String,
    pub pos: Option<String>,
    pub cefr_level: Option<String>,
    pub english_translation: String,
    pub example_sentence_native: Option<String>,
    pub example_sentence_english: Option<String>,
    pub gender: Option<String>,
    pub word_frequency: Option<i32>,
    pub useful_for_flashcard: Option<bool>,
    pub goethe_b1_wordlist: Option<bool>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ChatConversation {
    pub id: String,
    pub user_id: String,
    pub title: String,
    pub language: String,
    pub messages: Value,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Article {
    pub id: String,
    pub user_id: String,
    pub source_url: String,
    pub title: Option<String>,
    pub source_language: Option<String>,
    pub target_language: String,
    pub cefr_level: String,
    pub original_content: Option<String>,
    pub translated_content: Option<String>,
    pub status: String,
    pub translation_progress: i32,
    pub total_paragraphs: i32,
    pub error_message: Option<String>,
    pub word_count: Option<i32>,
    pub audio_url: Option<String>,
    pub audio_duration_seconds: Option<i32>,
    pub audio_timestamps: Option<String>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicSession {
    pub user: User,
}
