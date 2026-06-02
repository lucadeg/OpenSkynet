use sediman_tui_core::command::{Command, CommandCategory};

use crate::app::{App, AppModal, ModalLine};

pub async fn handle_connect(app: &mut App, args: &str) {
    let args = args.trim();

    if args.is_empty() {
        show_integration_hub(app).await;
        return;
    }

    let (service, rest) = match args.split_once(' ') {
        Some((s, r)) => (s.trim(), r.trim()),
        None => (args, ""),
    };

    match service {
        "discord" => handle_service_config(app, "discord", rest).await,
        "telegram" => handle_service_config(app, "telegram", rest).await,
        _ => {
            app.add_error_message(format!(
                "Unknown service: {}. Use: /connect discord <token> or /connect telegram <token>",
                service
            ));
        }
    }
}

async fn show_integration_hub(app: &mut App) {
    match app.bridge.list_integrations().await {
        Ok(integrations) => {
            let mut lines = vec![ModalLine::heading(String::from("  Connect Integrations"))];
            lines.push(ModalLine::blank());

            if integrations.is_empty() {
                lines.push(ModalLine::normal(String::from("  No integrations available.")));
            } else {
                for i in &integrations {
                    let status_icon = if i.connected {
                        "\u{25cf} connected"
                    } else if i.configured {
                        "\u{25cb} configured"
                    } else {
                        "\u{25cb} not configured"
                    };
                    lines.push(ModalLine::accent(format!("  {}  {}", i.name, status_icon)));
                    if i.enabled {
                        lines.push(ModalLine::muted(String::from("    enabled: true")));
                    }
                }
            }

            lines.push(ModalLine::blank());
            lines.push(ModalLine::muted(String::from("  Usage:")));
            lines.push(ModalLine::muted(String::from("    /connect discord <bot-token>        Set token & enable")));
            lines.push(ModalLine::muted(String::from("    /connect discord --disable           Disable Discord")));
            lines.push(ModalLine::muted(String::from("    /connect discord --channel <n>=<id>  Map channel")));
            lines.push(ModalLine::muted(String::from("    /connect telegram <bot-token>        Set token & enable")));
            lines.push(ModalLine::muted(String::from("    /connect telegram --disable          Disable Telegram")));
            lines.push(ModalLine::muted(String::from("    /connect telegram --chat <n>=<id>    Map chat")));

            app.active_modal = Some(AppModal::Info {
                title: String::from("Connect"),
                lines,
                scroll: 0,
            });
        }
        Err(e) => app.add_error_message(format!("Failed to load integrations: {}", e)),
    }
}

async fn handle_service_config(app: &mut App, service: &str, args: &str) {
    if args.is_empty() {
        show_service_status(app, service).await;
        return;
    }

    if args == "--disable" {
        match app
            .bridge
            .configure_integration(service, serde_json::json!({"enabled": false}))
            .await
        {
            Ok(_) => app.add_system_message(format!("{} integration disabled.", capitalize(service))),
            Err(e) => app.add_error_message(format!("Failed to disable {}: {}", service, e)),
        }
        return;
    }

    let channel_flag = if service == "discord" { "--channel" } else { "--chat" };
    if let Some(spec) = args.strip_prefix(&format!("{} ", channel_flag)) {
        let parts: Vec<&str> = spec.splitn(2, '=').collect();
        if parts.len() != 2 {
            app.add_system_message(format!(
                "Usage: /connect {} {} <name>=<id>",
                service, channel_flag
            ));
            return;
        }
        let name = parts[0].trim();
        let id = parts[1].trim();
        let key = if service == "discord" { "channels" } else { "chats" };
        match app
            .bridge
            .configure_integration(service, serde_json::json!({key: {name: id}}))
            .await
        {
            Ok(_) => app.add_system_message(format!(
                "{} {} mapped: {} \u{2192} {}",
                capitalize(service),
                if service == "discord" { "channel" } else { "chat" },
                name,
                id
            )),
            Err(e) => app.add_error_message(format!("Failed to set {} {}: {}", service, key, e)),
        }
        return;
    }

    // Treat as bot token
    let token = args.to_string();
    match app
        .bridge
        .configure_integration(service, serde_json::json!({
            "token": token,
            "enabled": true,
        }))
        .await
    {
        Ok(_) => app.add_system_message(format!(
            "{} integration enabled. Bot will start on next task.",
            capitalize(service)
        )),
        Err(e) => app.add_error_message(format!("Failed to configure {}: {}", service, e)),
    }
}

async fn show_service_status(app: &mut App, service: &str) {
    match app.bridge.integration_status(service).await {
        Ok(status) => {
            let mut lines = vec![ModalLine::heading(format!("  {} Integration", capitalize(service)))];
            lines.push(ModalLine::blank());

            if status.connected {
                lines.push(ModalLine::normal(String::from("  Status:    \u{25cf} connected")));
            } else if status.configured {
                lines.push(ModalLine::normal(String::from("  Status:    \u{25cb} configured (not connected)")));
            } else {
                lines.push(ModalLine::normal(String::from("  Status:    \u{25cb} not configured")));
            }
            lines.push(ModalLine::normal(format!("  Enabled:   {}", status.enabled)));
            lines.push(ModalLine::blank());
            lines.push(ModalLine::muted(String::from("  Usage:")));
            lines.push(ModalLine::muted(format!(
                "    /connect {} <bot-token>       Set bot token & enable",
                service
            )));
            lines.push(ModalLine::muted(format!(
                "    /connect {} --disable         Disable",
                service
            )));
            if service == "discord" {
                lines.push(ModalLine::muted(String::from(
                    "    /connect discord --channel <name>=<id>  Map channel",
                )));
            } else {
                lines.push(ModalLine::muted(String::from(
                    "    /connect telegram --chat <name>=<id>     Map chat",
                )));
            }

            app.active_modal = Some(AppModal::Info {
                title: capitalize(service),
                lines,
                scroll: 0,
            });
        }
        Err(e) => app.add_error_message(format!("{} status failed: {}", service, e)),
    }
}

fn capitalize(s: &str) -> String {
    let mut c = s.chars();
    match c.next() {
        None => String::new(),
        Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
    }
}

pub static CMD_CONNECT: Command = Command {
    name: "/connect",
    aliases: &[],
    description: "Connect integrations: /connect discord <token> | /connect telegram <token>",
    category: CommandCategory::General,
};
