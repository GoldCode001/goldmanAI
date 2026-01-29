// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use std::process::Command;
use enigo::{Enigo, Key, KeyboardControllable, MouseButton, MouseControllable};

// Desktop automation commands
#[tauri::command]
fn run_shell_command(command: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    let output = Command::new("cmd")
        .args(["/C", &command])
        .output()
        .map_err(|e| e.to_string())?;

    #[cfg(not(target_os = "windows"))]
    let output = Command::new("sh")
        .args(["-c", &command])
        .output()
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        Ok(stdout)
    } else {
        Err(stderr)
    }
}

#[tauri::command]
fn get_platform_info() -> PlatformInfo {
    PlatformInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        family: std::env::consts::FAMILY.to_string(),
    }
}

#[derive(serde::Serialize)]
struct PlatformInfo {
    os: String,
    arch: String,
    family: String,
}

// Mouse control commands
#[tauri::command]
fn mouse_move(x: i32, y: i32) -> Result<String, String> {
    let mut enigo = Enigo::new();
    enigo.mouse_move_to(x, y);
    Ok(format!("Moved mouse to ({}, {})", x, y))
}

#[tauri::command]
fn mouse_click(button: String) -> Result<String, String> {
    let mut enigo = Enigo::new();
    let mouse_button = match button.to_lowercase().as_str() {
        "left" => MouseButton::Left,
        "right" => MouseButton::Right,
        "middle" => MouseButton::Middle,
        _ => return Err(format!("Invalid button: {}. Use 'left', 'right', or 'middle'", button)),
    };
    enigo.mouse_click(mouse_button);
    Ok(format!("Clicked {} mouse button", button))
}

#[tauri::command]
fn mouse_scroll(amount: i32) -> Result<String, String> {
    let mut enigo = Enigo::new();
    enigo.mouse_scroll_y(amount);
    Ok(format!("Scrolled mouse by {}", amount))
}

#[tauri::command]
fn get_mouse_position() -> Result<(i32, i32), String> {
    let enigo = Enigo::new();
    let (x, y) = enigo.mouse_location();
    Ok((x, y))
}

// Keyboard control commands
#[tauri::command]
fn keyboard_type(text: String) -> Result<String, String> {
    let mut enigo = Enigo::new();
    enigo.key_sequence(&text);
    Ok(format!("Typed: {}", text))
}

#[tauri::command]
fn keyboard_press(key: String) -> Result<String, String> {
    let mut enigo = Enigo::new();

    let enigo_key = match key.to_lowercase().as_str() {
        "enter" | "return" => Key::Return,
        "tab" => Key::Tab,
        "escape" | "esc" => Key::Escape,
        "backspace" => Key::Backspace,
        "delete" | "del" => Key::Delete,
        "up" | "uparrow" => Key::UpArrow,
        "down" | "downarrow" => Key::DownArrow,
        "left" | "leftarrow" => Key::LeftArrow,
        "right" | "rightarrow" => Key::RightArrow,
        "home" => Key::Home,
        "end" => Key::End,
        "pageup" => Key::PageUp,
        "pagedown" => Key::PageDown,
        "space" => Key::Space,
        "shift" => Key::Shift,
        "control" | "ctrl" => Key::Control,
        "alt" => Key::Alt,
        "meta" | "windows" | "cmd" | "command" => Key::Meta,
        _ => return Err(format!("Unsupported key: {}. Use special key names like 'enter', 'tab', 'escape', etc.", key)),
    };

    enigo.key_click(enigo_key);
    Ok(format!("Pressed key: {}", key))
}

#[tauri::command]
fn keyboard_shortcut(keys: Vec<String>) -> Result<String, String> {
    let mut enigo = Enigo::new();

    // Press all keys down
    for key in &keys {
        let enigo_key = match key.to_lowercase().as_str() {
            "shift" => Key::Shift,
            "control" | "ctrl" => Key::Control,
            "alt" => Key::Alt,
            "meta" | "windows" | "cmd" | "command" => Key::Meta,
            single if single.len() == 1 => {
                enigo.key_sequence(single);
                continue;
            }
            _ => return Err(format!("Unsupported key in shortcut: {}", key)),
        };
        enigo.key_down(enigo_key);
    }

    // Release all keys
    for key in keys.iter().rev() {
        let enigo_key = match key.to_lowercase().as_str() {
            "shift" => Key::Shift,
            "control" | "ctrl" => Key::Control,
            "alt" => Key::Alt,
            "meta" | "windows" | "cmd" | "command" => Key::Meta,
            _ => continue,
        };
        enigo.key_up(enigo_key);
    }

    Ok(format!("Executed keyboard shortcut: {}", keys.join("+")))
}

// Browser automation with Playwright
#[tauri::command]
fn browser_open(url: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    let output = Command::new("cmd")
        .args(["/C", &format!("start {}", url)])
        .output()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "macos")]
    let output = Command::new("open")
        .arg(&url)
        .output()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "linux")]
    let output = Command::new("xdg-open")
        .arg(&url)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(format!("Opened browser to: {}", url))
    } else {
        Err("Failed to open browser".to_string())
    }
}

#[tauri::command]
fn run_playwright_script(script: String) -> Result<String, String> {
    // Run a Node.js Playwright script
    let output = Command::new("node")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|e| format!("Failed to run Playwright script: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        Ok(stdout)
    } else {
        Err(format!("Playwright error: {}", stderr))
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            run_shell_command,
            get_platform_info,
            mouse_move,
            mouse_click,
            mouse_scroll,
            get_mouse_position,
            keyboard_type,
            keyboard_press,
            keyboard_shortcut,
            browser_open,
            run_playwright_script
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
