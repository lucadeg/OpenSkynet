use sediman_tui_core::renderer::{CellBuffer, Rect, Style, display_width};
use crate::app::App;

use super::messages::format_elapsed;

pub fn render_status_bar(buf: &mut CellBuffer, area: Rect, app: &App) {
    let t = &app.theme;
    let y = area.y;

    for sx in area.x..area.right() {
        buf.put_char(sx, y, ' ', Style::new().bg(t.background_panel).fg(t.text));
    }

    let mut x = area.x;

    if app.agent_running {
        let elapsed = format_elapsed(app.agent_start.elapsed().as_secs());
        let pill = format!(" \u{25cf} {} ", elapsed);
        buf.draw_str(x, y, &pill, Style::new().bg(t.primary).fg(t.background_darker));
        x += display_width(&pill);

        if !app.streaming_phase.is_empty() {
            let (phase_label, phase_color) = match app.streaming_phase.as_str() {
                "thinking" | "planning" => ("thinking", t.warning),
                "executing" | "observing" => ("executing", t.primary),
                "responding" => ("responding", t.info),
                _ => ("", t.text),
            };
            if !phase_label.is_empty() {
                let phase_pill = format!(" {} ", phase_label);
                buf.draw_str(x, y, &phase_pill, Style::new().bg(phase_color).fg(t.background_darker));
                x += display_width(&phase_pill);
            }
        }
    } else if app.task_count > 0 {
        let pill = format!(" {} ", app.task_count);
        buf.draw_str(x, y, &pill, Style::new().bg(t.background_darker).fg(t.text_muted));
        x += display_width(&pill);
    }

    let mode = app.permission.current_label();
    let mode_color = match mode {
        "acceptEdits" => t.success,
        "plan" => t.info,
        "auto" => t.error,
        _ => t.text,
    };
    let mode_text = format!(" {} ", mode);
    buf.draw_str(x, y, &mode_text, Style::new().bg(mode_color).fg(t.background_darker));
    x += display_width(&mode_text);

    let model = app.model.as_deref().unwrap_or("default");
    let model_text = format!(" {} ", model);
    let model_x = area.right().saturating_sub(display_width(&model_text));
    if model_x > x + 2 {
        buf.draw_str(model_x, y, &model_text, Style::new().bg(t.background_darker).fg(t.text_muted));
    }
}
