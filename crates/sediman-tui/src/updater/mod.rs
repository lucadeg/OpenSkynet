//! Update module for checking and installing updates.

mod github;
mod installer;

pub use github::check_for_update;
pub use installer::install_update;

use anyhow::Result;

/// Check for updates and return release info if available.
pub async fn check_for_update() -> Result<Option<Release>> {
    github::check_for_update().await
}

/// Install the latest update.
pub async fn install_update(version: &str) -> Result<()> {
    installer::install_update(version).await
}

/// Release information from GitHub.
#[derive(Debug, Clone)]
pub struct Release {
    pub tag_name: String,
    pub name: String,
    pub body: String,
    pub published_at: String,
}
