use axum::{
    Json,
    extract::{Path, Query, State},
    http::HeaderMap,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::{
    auth::{self, AuthUser},
    content::parse_unit_markdown,
    db::models::{CourseRow, UnitRow},
    error::{AppError, AppResult},
    state::AppState,
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseFilters {
    pub source_language: Option<String>,
    pub target_language: Option<String>,
    pub level: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseListItem {
    pub id: String,
    pub title: String,
    pub source_language: String,
    pub target_language: String,
    pub level: String,
    pub visibility: Option<String>,
    pub unit_count: usize,
    pub lesson_count: usize,
    pub created_by: Option<String>,
}

pub async fn list_courses(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(filters): Query<CourseFilters>,
) -> AppResult<Json<Vec<CourseListItem>>> {
    let user = auth::optional_user(&headers, &state).await?;
    let user_id = user.as_ref().map(|u| u.id.clone()).unwrap_or_default();
    let rows = sqlx::query_as::<_, CourseRow>(
        r#"SELECT * FROM course
        WHERE published = true
          AND (visibility = 'public' OR created_by = NULLIF($1, ''))
          AND ($2 = '' OR source_language = $2)
          AND ($3 = '' OR target_language = $3)
          AND ($4 = '' OR level = $4)
        ORDER BY title"#,
    )
    .bind(&user_id)
    .bind(filters.source_language.unwrap_or_default())
    .bind(filters.target_language.unwrap_or_default())
    .bind(filters.level.unwrap_or_default())
    .fetch_all(&state.db)
    .await?;
    let mut out = Vec::new();
    for course in rows {
        let units =
            units_for_course(&state, &course.id, user.as_ref().map(|u| u.id.as_str())).await?;
        let lesson_count = units
            .iter()
            .map(|u| parse_unit_markdown(&u.markdown).lessons.len())
            .sum();
        out.push(CourseListItem {
            id: course.id,
            title: course.title,
            source_language: course.source_language,
            target_language: course.target_language,
            level: course.level,
            visibility: course.visibility,
            unit_count: units.len(),
            lesson_count,
            created_by: course.created_by,
        });
    }
    Ok(Json(out))
}

pub async fn get_course(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    let user = auth::optional_user(&headers, &state).await?;
    let user_id = user.as_ref().map(|u| u.id.clone()).unwrap_or_default();
    let course = sqlx::query_as::<_, CourseRow>("SELECT * FROM course WHERE id = $1 AND (visibility = 'public' OR created_by = NULLIF($2, ''))")
        .bind(&id).bind(user_id).fetch_optional(&state.db).await?.ok_or(AppError::NotFound)?;
    let units = units_for_course(&state, &course.id, user.as_ref().map(|u| u.id.as_str())).await?;
    let units_json: Vec<_> = units.into_iter().map(unit_json).collect();
    Ok(Json(json!({ "course": course, "units": units_json })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCourseBody {
    pub title: String,
    pub source_language: String,
    pub target_language: String,
    pub level: String,
}

pub async fn create_course(
    State(state): State<AppState>,
    user: AuthUser,
    Json(input): Json<CreateCourseBody>,
) -> AppResult<Json<serde_json::Value>> {
    let id = format!(
        "{}-{}",
        slugify(&input.title),
        &Uuid::new_v4().to_string()[..8]
    );
    sqlx::query("INSERT INTO course (id, title, source_language, target_language, level, visibility, published, created_by) VALUES ($1,$2,$3,$4,$5,null,true,$6)")
        .bind(&id).bind(input.title.trim()).bind(input.source_language).bind(input.target_language).bind(input.level).bind(user.id())
        .execute(&state.db).await?;
    Ok(Json(json!({ "success": true, "courseId": id })))
}

pub async fn delete_course(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    ensure_course_owner(&state, user.id(), &id).await?;
    sqlx::query("UPDATE unit SET course_id = null, updated_at = now() WHERE course_id = $1")
        .bind(&id)
        .execute(&state.db)
        .await?;
    sqlx::query("DELETE FROM course WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(Json(json!({ "success": true })))
}

pub async fn make_course_public(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    ensure_course_owner(&state, user.id(), &id).await?;
    sqlx::query("UPDATE course SET visibility='public', updated_at=now() WHERE id=$1")
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(Json(json!({ "success": true })))
}
pub async fn make_course_private(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    if !is_admin(user.email()) {
        return Err(AppError::Forbidden);
    }
    sqlx::query("UPDATE course SET visibility=null, updated_at=now() WHERE id=$1")
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(Json(json!({ "success": true })))
}

pub async fn course_management(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    ensure_course_owner_or_admin(&state, &user, &id).await?;
    let course = sqlx::query_as::<_, CourseRow>("SELECT * FROM course WHERE id=$1")
        .bind(&id)
        .fetch_one(&state.db)
        .await?;
    let units =
        sqlx::query_as::<_, UnitRow>("SELECT * FROM unit WHERE course_id=$1 ORDER BY created_at")
            .bind(&id)
            .fetch_all(&state.db)
            .await?;
    let available = sqlx::query_as::<_, UnitRow>(
        "SELECT * FROM unit WHERE created_by=$1 AND course_id IS NULL ORDER BY created_at DESC",
    )
    .bind(user.id())
    .fetch_all(&state.db)
    .await?;
    Ok(Json(
        json!({ "course": course, "units": units.into_iter().map(unit_json).collect::<Vec<_>>(), "availableUnits": available.into_iter().map(unit_json).collect::<Vec<_>>() }),
    ))
}

pub async fn add_unit_to_course(
    State(state): State<AppState>,
    user: AuthUser,
    Path((course_id, unit_id)): Path<(String, String)>,
) -> AppResult<Json<serde_json::Value>> {
    ensure_course_owner_or_admin(&state, &user, &course_id).await?;
    ensure_unit_owner_or_admin(&state, &user, &unit_id).await?;
    sqlx::query("UPDATE unit SET course_id=$1, updated_at=now() WHERE id=$2")
        .bind(course_id)
        .bind(unit_id)
        .execute(&state.db)
        .await?;
    Ok(Json(json!({ "success": true })))
}
pub async fn remove_unit_from_course(
    State(state): State<AppState>,
    user: AuthUser,
    Path((_course_id, unit_id)): Path<(String, String)>,
) -> AppResult<Json<serde_json::Value>> {
    ensure_unit_owner_or_admin(&state, &user, &unit_id).await?;
    sqlx::query("UPDATE unit SET course_id=null, updated_at=now() WHERE id=$1")
        .bind(unit_id)
        .execute(&state.db)
        .await?;
    Ok(Json(json!({ "success": true })))
}

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct UnitQuery {
    pub mine: Option<bool>,
}

pub async fn list_units(
    State(state): State<AppState>,
    user: AuthUser,
    Query(_q): Query<UnitQuery>,
) -> AppResult<Json<Vec<serde_json::Value>>> {
    let library_ids: Vec<(String,)> =
        sqlx::query_as("SELECT unit_id FROM user_unit_library WHERE user_id=$1")
            .bind(user.id())
            .fetch_all(&state.db)
            .await?;
    let ids: Vec<String> = library_ids.into_iter().map(|r| r.0).collect();
    let rows = if ids.is_empty() {
        sqlx::query_as::<_, UnitRow>(
            "SELECT * FROM unit WHERE course_id IS NULL AND created_by=$1 ORDER BY created_at DESC",
        )
        .bind(user.id())
        .fetch_all(&state.db)
        .await?
    } else {
        sqlx::query_as::<_, UnitRow>("SELECT * FROM unit WHERE course_id IS NULL AND (created_by=$1 OR id = ANY($2)) ORDER BY created_at DESC").bind(user.id()).bind(&ids).fetch_all(&state.db).await?
    };
    Ok(Json(rows.into_iter().map(unit_json).collect()))
}

pub async fn browse_units(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<Vec<serde_json::Value>>> {
    let rows = sqlx::query_as::<_, UnitRow>(
        "SELECT * FROM unit WHERE course_id IS NULL AND visibility='public' AND (created_by IS NULL OR created_by <> $1) AND id NOT IN (SELECT unit_id FROM user_unit_library WHERE user_id=$1) ORDER BY created_at DESC",
    ).bind(user.id()).fetch_all(&state.db).await?;
    Ok(Json(rows.into_iter().map(unit_json).collect()))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateUnitBody {
    pub markdown: String,
    pub course_id: Option<String>,
}

pub async fn create_unit(
    State(state): State<AppState>,
    user: AuthUser,
    Json(input): Json<CreateUnitBody>,
) -> AppResult<Json<serde_json::Value>> {
    let parsed = parse_unit_markdown(&input.markdown);
    let id = Uuid::new_v4().to_string();
    let course_id = input.course_id.or(parsed.course_id.clone());
    sqlx::query("INSERT INTO unit (id, course_id, title, description, icon, color, markdown, target_language, source_language, level, visibility, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,null,$11)")
        .bind(&id).bind(course_id).bind(parsed.title).bind(parsed.description).bind(parsed.icon).bind(parsed.color).bind(input.markdown)
        .bind(parsed.target_language.unwrap_or_else(|| "de".into())).bind(parsed.source_language).bind(parsed.level).bind(user.id()).execute(&state.db).await?;
    Ok(Json(json!({ "success": true, "unitId": id })))
}

pub async fn get_unit(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    let user = auth::optional_user(&headers, &state).await?;
    let user_id = user.as_ref().map(|u| u.id.clone()).unwrap_or_default();
    let unit = sqlx::query_as::<_, UnitRow>(
        "SELECT * FROM unit WHERE id=$1 AND (visibility='public' OR created_by = NULLIF($2,''))",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(Json(unit_json(unit)))
}

pub async fn update_unit_markdown(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(input): Json<CreateUnitBody>,
) -> AppResult<Json<serde_json::Value>> {
    ensure_unit_owner_or_admin(&state, &user, &id).await?;
    let parsed = parse_unit_markdown(&input.markdown);
    sqlx::query("UPDATE unit SET title=$1, description=$2, icon=$3, color=$4, markdown=$5, target_language=$6, source_language=$7, level=$8, updated_at=now() WHERE id=$9")
        .bind(parsed.title.clone()).bind(parsed.description).bind(parsed.icon).bind(parsed.color).bind(input.markdown)
        .bind(parsed.target_language.unwrap_or_else(|| "de".into())).bind(parsed.source_language).bind(parsed.level).bind(&id).execute(&state.db).await?;
    Ok(Json(
        json!({ "success": true, "title": parsed.title, "lessonCount": parsed.lessons.len() }),
    ))
}

pub async fn delete_unit(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    ensure_unit_owner_or_admin(&state, &user, &id).await?;
    sqlx::query("DELETE FROM unit WHERE id=$1")
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(Json(json!({ "success": true })))
}
pub async fn make_unit_public(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    ensure_unit_owner_or_admin(&state, &user, &id).await?;
    sqlx::query("UPDATE unit SET visibility='public', updated_at=now() WHERE id=$1")
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(Json(json!({"success":true})))
}
pub async fn make_unit_private(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    if !is_admin(user.email()) {
        return Err(AppError::Forbidden);
    }
    sqlx::query("UPDATE unit SET visibility=null, updated_at=now() WHERE id=$1")
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(Json(json!({"success":true})))
}
pub async fn add_unit_to_library(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    sqlx::query("INSERT INTO user_unit_library (id,user_id,unit_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING").bind(Uuid::new_v4().to_string()).bind(user.id()).bind(id).execute(&state.db).await?;
    Ok(Json(json!({"success":true})))
}
pub async fn remove_unit_from_library(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    sqlx::query("DELETE FROM user_unit_library WHERE user_id=$1 AND unit_id=$2")
        .bind(user.id())
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(Json(json!({"success":true})))
}

pub async fn course_progress(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    let rows = sqlx::query_as::<_, (String, String, i32, bool, chrono::NaiveDateTime)>("SELECT lc.id, lc.unit_id, lc.lesson_index, lc.perfect_score, lc.completed_at FROM lesson_completion lc JOIN unit u ON u.id=lc.unit_id WHERE lc.user_id=$1 AND u.course_id=$2")
        .bind(user.id()).bind(id).fetch_all(&state.db).await?;
    Ok(Json(json!({ "completions": rows })))
}
pub async fn unit_progress(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    let rows = sqlx::query_as::<_, (String, String, i32, bool, chrono::NaiveDateTime)>("SELECT id, unit_id, lesson_index, perfect_score, completed_at FROM lesson_completion WHERE user_id=$1 AND unit_id=$2")
        .bind(user.id()).bind(id).fetch_all(&state.db).await?;
    Ok(Json(json!({ "completions": rows })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteLessonBody {
    pub unit_id: String,
    pub lesson_index: i32,
    pub results: Vec<ExerciseResult>,
    pub mistake_count: i32,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExerciseResult {
    pub exercise_index: i32,
    pub exercise_type: String,
    pub correct: bool,
    pub user_answer: String,
}

pub async fn complete_lesson(
    State(state): State<AppState>,
    user: AuthUser,
    Json(input): Json<CompleteLessonBody>,
) -> AppResult<Json<serde_json::Value>> {
    let completion_id = Uuid::new_v4().to_string();
    let perfect = input.mistake_count == 0;
    let mut tx = state.db.begin().await?;
    sqlx::query("INSERT INTO lesson_completion (id,user_id,unit_id,lesson_index,perfect_score) VALUES ($1,$2,$3,$4,$5)")
        .bind(&completion_id).bind(user.id()).bind(&input.unit_id).bind(input.lesson_index).bind(perfect).execute(&mut *tx).await?;
    for r in input.results {
        sqlx::query("INSERT INTO exercise_attempt (id,user_id,lesson_completion_id,exercise_index,exercise_type,correct,user_answer) VALUES ($1,$2,$3,$4,$5,$6,$7)")
            .bind(Uuid::new_v4().to_string()).bind(user.id()).bind(&completion_id).bind(r.exercise_index).bind(r.exercise_type).bind(r.correct).bind(r.user_answer).execute(&mut *tx).await?;
    }
    let today = Utc::now().date_naive();
    sqlx::query("INSERT INTO daily_activity (id,user_id,date,lessons_completed) VALUES ($1,$2,$3,1) ON CONFLICT (user_id,date) DO UPDATE SET lessons_completed = daily_activity.lessons_completed + 1")
        .bind(Uuid::new_v4().to_string()).bind(user.id()).bind(today).execute(&mut *tx).await?;
    sqlx::query("INSERT INTO user_stats (user_id,current_streak,longest_streak,last_practice_date,total_lessons_completed) VALUES ($1,1,1,$2,1) ON CONFLICT (user_id) DO UPDATE SET total_lessons_completed=user_stats.total_lessons_completed+1, last_practice_date=$2, current_streak=GREATEST(user_stats.current_streak,1), longest_streak=GREATEST(user_stats.longest_streak,1)")
        .bind(user.id()).bind(today).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(json!({ "perfectScore": perfect })))
}

async fn units_for_course(
    state: &AppState,
    course_id: &str,
    user_id: Option<&str>,
) -> AppResult<Vec<UnitRow>> {
    let uid = user_id.unwrap_or("");
    Ok(sqlx::query_as::<_, UnitRow>("SELECT * FROM unit WHERE course_id=$1 AND (visibility='public' OR created_by = NULLIF($2,'')) ORDER BY created_at")
        .bind(course_id).bind(uid).fetch_all(&state.db).await?)
}

fn unit_json(unit: UnitRow) -> serde_json::Value {
    let parsed = parse_unit_markdown(&unit.markdown);
    json!({
        "id": unit.id, "courseId": unit.course_id, "title": unit.title, "description": unit.description, "icon": unit.icon, "color": unit.color,
        "markdown": unit.markdown, "targetLanguage": unit.target_language, "sourceLanguage": unit.source_language, "level": unit.level, "visibility": unit.visibility,
        "createdBy": unit.created_by, "createdAt": unit.created_at, "updatedAt": unit.updated_at,
        "lessons": parsed.lessons, "lessonCount": parsed.lessons.len()
    })
}

async fn ensure_course_owner(state: &AppState, user_id: &str, course_id: &str) -> AppResult<()> {
    let ok: Option<(String,)> =
        sqlx::query_as("SELECT id FROM course WHERE id=$1 AND created_by=$2")
            .bind(course_id)
            .bind(user_id)
            .fetch_optional(&state.db)
            .await?;
    ok.map(|_| ()).ok_or(AppError::Forbidden)
}
async fn ensure_course_owner_or_admin(
    state: &AppState,
    user: &AuthUser,
    course_id: &str,
) -> AppResult<()> {
    if is_admin(user.email()) {
        return Ok(());
    }
    ensure_course_owner(state, user.id(), course_id).await
}
async fn ensure_unit_owner_or_admin(
    state: &AppState,
    user: &AuthUser,
    unit_id: &str,
) -> AppResult<()> {
    if is_admin(user.email()) {
        return Ok(());
    }
    let ok: Option<(String,)> = sqlx::query_as("SELECT id FROM unit WHERE id=$1 AND created_by=$2")
        .bind(unit_id)
        .bind(user.id())
        .fetch_optional(&state.db)
        .await?;
    ok.map(|_| ()).ok_or(AppError::Forbidden)
}
fn is_admin(email: &str) -> bool {
    std::env::var("ADMIN_EMAILS")
        .unwrap_or_default()
        .split(',')
        .any(|e| e.trim().eq_ignore_ascii_case(email))
}
fn slugify(s: &str) -> String {
    let slug: String = s
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    slug.trim_matches('-')
        .split('-')
        .filter(|p| !p.is_empty())
        .collect::<Vec<_>>()
        .join("-")
        .chars()
        .take(40)
        .collect()
}
