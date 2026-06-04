//! SoulEditor modal key handling.

const DEFAULT_SOUL: &str = "You are OpenSkynet, a self-improving browser automation agent.

You are pragmatic, concise, and efficient. You complete browser tasks with minimal steps.

Communication style:
- Be brief but thorough
- When reporting results, lead with the answer
- If something fails, explain what went wrong and what you tried
- Proactively suggest improvements when you notice patterns";

use crate::app::App;
use crossterm::event::{KeyCode, KeyModifiers};

const SOUL_MAX_LENGTH: usize = 4000;

/// Handle SoulEditor modal key input.
pub async fn handle_soul_editor(app: &mut App, key: crossterm::event::KeyEvent) -> bool {
    match key.code {
        KeyCode::Esc | KeyCode::Char('q') => {
            app.soul_editor_input.clear();
            app.active_modal = None;
            true
        }
        KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            app.soul_editor_input.clear();
            app.active_modal = None;
            true
        }
        KeyCode::Char('r') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            let _ = app.bridge.reset_soul().await;
            app.soul_editor_input = DEFAULT_SOUL.to_string();
            app.add_system_message("Personality reset to default.".into());
            true
        }
        KeyCode::Enter => {
            let text = app.soul_editor_input.trim().to_string();
            if text.is_empty() {
                app.add_error_message("Soul cannot be empty.".into());
                return true;
            }
            match app.bridge.set_soul(&text).await {
                Ok(()) => {
                    app.add_system_message("Soul updated.".to_string());
                    app.soul_editor_input.clear();
                    app.active_modal = None;
                }
                Err(e) => app.add_error_message(format!("Failed to set soul: {}", e)),
            }
            true
        }
        KeyCode::Backspace => {
            app.soul_editor_input.pop();
            true
        }
        KeyCode::Tab => {
            true
        }
        KeyCode::Char(c) => {
            if app.soul_editor_input.len() < SOUL_MAX_LENGTH {
                app.soul_editor_input.push(c);
            }
            true
        }
        _ => false,
    }
}

