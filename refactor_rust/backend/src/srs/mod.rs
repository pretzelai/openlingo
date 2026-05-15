use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Deserialize)]
pub struct ReviewInput {
    pub ease_factor: f32,
    pub interval: i32,
    pub repetitions: i32,
    #[allow(dead_code)]
    pub status: CardStatus,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum CardStatus {
    New,
    Learning,
    Review,
}

impl CardStatus {
    #[allow(dead_code)]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::New => "new",
            Self::Learning => "learning",
            Self::Review => "review",
        }
    }
}

impl From<&str> for CardStatus {
    fn from(value: &str) -> Self {
        match value {
            "review" => Self::Review,
            "learning" => Self::Learning,
            _ => Self::New,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewResult {
    pub ease_factor: f32,
    pub interval: i32,
    pub repetitions: i32,
    pub status: &'static str,
    pub next_review_at: chrono::NaiveDateTime,
}

pub fn calculate_next_review(input: ReviewInput, quality: i32) -> ReviewResult {
    let quality = quality.clamp(0, 5);
    let now = Utc::now().naive_utc();

    if quality < 3 {
        let ease = (input.ease_factor - 0.2).max(1.3);
        return ReviewResult {
            ease_factor: ease,
            interval: 0,
            repetitions: 0,
            status: "learning",
            next_review_at: now + Duration::minutes(10),
        };
    }

    let repetitions = input.repetitions + 1;
    let interval = if repetitions == 1 {
        1
    } else if repetitions == 2 {
        6
    } else {
        ((input.interval.max(1) as f32) * input.ease_factor).round() as i32
    };
    let q = quality as f32;
    let ease = (input.ease_factor + (0.1 - (5.0 - q) * (0.08 + (5.0 - q) * 0.02))).max(1.3);
    ReviewResult {
        ease_factor: ease,
        interval,
        repetitions,
        status: "review",
        next_review_at: now + Duration::days(interval as i64),
    }
}
