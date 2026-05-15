use axum::{
    Router,
    extract::DefaultBodyLimit,
    http::{HeaderValue, Method, header},
    routing::{get, post, put},
};
use tower_http::{cors::CorsLayer, services::ServeDir};

use crate::state::AppState;

pub mod articles;
pub mod audio;
pub mod auth;
pub mod chat;
pub mod content;
pub mod feedback;
pub mod me;
pub mod srs;
pub mod words;

pub fn router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin([
            "http://localhost:5173".parse::<HeaderValue>().unwrap(),
            "http://127.0.0.1:5173".parse::<HeaderValue>().unwrap(),
        ])
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION])
        .allow_credentials(true);

    let api = Router::new()
        .route("/health", get(health))
        .route("/github-stars", get(me::github_stars))
        .route("/auth/sign-up", post(auth::sign_up))
        .route("/auth/sign-in", post(auth::sign_in))
        .route("/auth/sign-out", post(auth::sign_out))
        .route("/auth/session", get(auth::session))
        .route(
            "/auth/password-reset/request",
            post(auth::request_password_reset),
        )
        .route(
            "/auth/password-reset/confirm",
            post(auth::confirm_password_reset),
        )
        .route("/auth/google/start", get(crate::auth::oauth_google::start))
        .route(
            "/auth/google/callback",
            get(crate::auth::oauth_google::callback),
        )
        .route("/me", get(me::me))
        .route(
            "/preferences",
            get(me::preferences).put(me::update_preferences),
        )
        .route("/profile", get(me::profile).put(me::update_profile))
        .route("/prompts", get(me::prompts))
        .route(
            "/prompts/{id}",
            put(me::save_prompt).delete(me::reset_prompt),
        )
        .route("/memory", get(me::memory).put(me::save_memory))
        .route("/feedback", post(feedback::submit_feedback))
        .route("/chat/stream", post(chat::stream_chat))
        .route(
            "/chat/conversations",
            get(chat::list_conversations).post(chat::create_conversation),
        )
        .route(
            "/chat/conversations/{id}",
            get(chat::get_conversation)
                .put(chat::save_conversation)
                .delete(chat::delete_conversation),
        )
        .route(
            "/courses",
            get(content::list_courses).post(content::create_course),
        )
        .route(
            "/courses/{id}",
            get(content::get_course).delete(content::delete_course),
        )
        .route("/courses/{id}/public", post(content::make_course_public))
        .route("/courses/{id}/private", post(content::make_course_private))
        .route("/courses/{id}/manage", get(content::course_management))
        .route(
            "/courses/{course_id}/units/{unit_id}",
            post(content::add_unit_to_course).delete(content::remove_unit_from_course),
        )
        .route(
            "/units",
            get(content::list_units).post(content::create_unit),
        )
        .route("/units/browse", get(content::browse_units))
        .route(
            "/units/{id}",
            get(content::get_unit).delete(content::delete_unit),
        )
        .route("/units/{id}/markdown", put(content::update_unit_markdown))
        .route("/units/{id}/public", post(content::make_unit_public))
        .route("/units/{id}/private", post(content::make_unit_private))
        .route(
            "/units/{id}/library",
            post(content::add_unit_to_library).delete(content::remove_unit_from_library),
        )
        .route("/progress/course/{id}", get(content::course_progress))
        .route("/progress/unit/{id}", get(content::unit_progress))
        .route("/lesson/complete", post(content::complete_lesson))
        .route("/srs/cards", get(srs::cards))
        .route("/srs/stats", get(srs::stats))
        .route(
            "/srs/words",
            post(srs::add_words).delete(srs::remove_all_words),
        )
        .route(
            "/srs/words/{word}",
            post(srs::add_word).delete(srs::remove_word),
        )
        .route("/srs/review", post(srs::review))
        .route("/srs/introduce-new", post(srs::introduce_new))
        .route("/word/lookup", get(words::lookup))
        .route(
            "/articles",
            get(articles::list_articles).post(articles::create_article),
        )
        .route(
            "/articles/{id}",
            get(articles::get_article).delete(articles::delete_article),
        )
        .route("/articles/{id}/status", get(articles::article_status))
        .route(
            "/articles/{id}/audio",
            get(articles::get_article_audio).post(articles::generate_article_audio),
        )
        .route("/articles/{id}/timestamps", get(articles::timestamps))
        .route("/tts", get(audio::get_tts).post(audio::create_tts))
        .route("/stt", post(audio::stt))
        .route("/ai-prompt", post(chat::ai_prompt))
        .layer(DefaultBodyLimit::max(25 * 1024 * 1024));

    Router::new()
        .nest("/api", api)
        .fallback_service(
            ServeDir::new("refactor_rust/frontend/dist").append_index_html_on_directories(true),
        )
        .layer(cors)
        .with_state(state)
}

async fn health() -> &'static str {
    "ok"
}
