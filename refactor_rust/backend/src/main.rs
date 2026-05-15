mod ai;
mod articles;
mod audio;
mod auth;
mod config;
mod content;
mod db;
mod error;
mod http;
mod services;
mod srs;
mod state;

use std::net::SocketAddr;

use anyhow::Context;
use tokio::net::TcpListener;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::{config::Config, state::AppState};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "openlingo_refactor=debug,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::from_env()?;
    let pool = db::connect(&config.database_url).await?;

    if config.run_migrations {
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .context("failed to run migrations")?;
    }

    let state = AppState::new(config.clone(), pool);
    articles::jobs::spawn_worker(state.clone());

    let app = http::router(state).layer(TraceLayer::new_for_http());

    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    let listener = TcpListener::bind(addr).await?;
    tracing::info!(%addr, "OpenLingo refactor backend listening");
    axum::serve(listener, app).await?;
    Ok(())
}
