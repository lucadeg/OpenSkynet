use sediman_tui_core::command::{Command, CommandCategory};

use crate::app::App;

const VALID_MODES: &[&str] = &["auto", "simple", "advanced"];

/// `/search` without args — open picker popup.
/// `/search <mode>` — switch search mode directly.
pub async fn handle_search(app: &mut App, args: &str) {
    let input = args.trim().to_lowercase();

    if input.is_empty() {
        // Open picker, pre-select current mode
        app.search_mode_picker_selected = VALID_MODES.iter()
            .position(|&m| m == app.search_mode)
            .unwrap_or(0);
        app.active_modal = Some(crate::app::AppModal::SearchModePicker);
        return;
    }

    if VALID_MODES.contains(&input.as_str()) {
        let old = app.search_mode.clone();
        app.search_mode = input.clone();
        app.add_system_message(format!(
            "Search mode: {} → {}",
            old, input
        ));
        // Persist
        let config = crate::config::TuiConfig::load();
        let mut config = config;
        config.search_mode = app.search_mode.clone();
        if let Err(e) = config.save() {
            app.add_error_message(format!("Failed to save config: {}", e));
        }
    } else {
        app.add_error_message(format!(
            "Unknown search mode '{}'. Options: {}",
            input,
            VALID_MODES.join(", ")
        ));
    }
}

pub static CMD_SEARCH: Command = Command {
    name: "/search",
    aliases: &[],
    description: "Set search mode (auto|simple|advanced)",
    category: CommandCategory::Agent,
};
