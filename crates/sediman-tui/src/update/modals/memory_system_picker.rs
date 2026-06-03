//! Memory system picker modal handler.

use crate::app::{App, AppModal};
use crossterm::event::{KeyCode, KeyModifiers};

/// Handle MemorySystemPicker modal key input.
pub async fn handle_memory_system_picker(app: &mut App, key: crossterm::event::KeyEvent) -> bool {
    if let Some(AppModal::MemorySystemPicker { systems, selected }) = &mut app.active_modal {
        match key.code {
            KeyCode::Esc => {
                app.active_modal = None;
                true
            }
            KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                app.active_modal = None;
                true
            }
            KeyCode::Up | KeyCode::Char('k') => {
                if *selected > 0 {
                    *selected -= 1;
                }
                true
            }
            KeyCode::Down | KeyCode::Char('j') => {
                if *selected < systems.len() - 1 {
                    *selected += 1;
                }
                true
            }
            KeyCode::Enter => {
                let selected_system = systems[*selected].clone();
                app.active_modal = None;

                // Trigger RPC call to switch system
                let _ = app.bridge.memory_switch_system(selected_system.clone()).await;

                app.add_system_message(format!(
                    "Switching to memory system: {} (requires restart to take effect)",
                    selected_system
                ));
                true
            }
            _ => false,
        }
    } else {
        false
    }
}
