use crate::{
    error::{AppError, AppResult},
    state::AppState,
};

pub async fn stars(state: &AppState) -> AppResult<Option<i64>> {
    let res = state
        .http
        .get("https://api.github.com/repos/pretzelai/openlingo")
        .header("User-Agent", "openlingo-refactor")
        .send()
        .await
        .map_err(|e| AppError::External(format!("github request failed: {e}")))?;
    if !res.status().is_success() {
        return Ok(None);
    }
    let json: serde_json::Value = res
        .json()
        .await
        .map_err(|e| AppError::External(e.to_string()))?;
    Ok(json.get("stargazers_count").and_then(|v| v.as_i64()))
}
