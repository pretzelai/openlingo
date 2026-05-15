use sha2::{Digest, Sha256};

pub fn audio_key(text: &str, language: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(text.to_lowercase());
    let hash = format!("{:x}", hasher.finalize());
    format!("audio/{language}/{hash}.mp3")
}
