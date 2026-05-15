use anyhow::Context;
use sqlx::{PgPool, postgres::PgPoolOptions};

pub mod models;

pub async fn connect(database_url: &str) -> anyhow::Result<PgPool> {
    PgPoolOptions::new()
        .max_connections(10)
        .connect(database_url)
        .await
        .context("failed to connect to Postgres")
}
