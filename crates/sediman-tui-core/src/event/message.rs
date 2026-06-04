use crossterm::event::{KeyEvent, MouseEvent};

pub enum AppEvent {
    Key(KeyEvent),
    Mouse(MouseEvent),
    Paste(String),
    Tick,
    Resize(u16, u16),
    Shutdown,
    AgentStep(String, String),
    AgentResult(bool, String, u64, Option<String>, Option<String>),
    AgentError(String),
    AgentDone,
    CommandOutput(String),
    StreamingToken(String, String),
    UpdateSuccess,
    UpdateFailed(String),
    UpdateAvailable {
        version: String,
        release_notes: String,
        current_version: String,
    },
}
