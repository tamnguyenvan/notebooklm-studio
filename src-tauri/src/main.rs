// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager, RunEvent};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

const SIDECAR_URL: &str = "http://127.0.0.1:8008";

// ── window ───────────────────────────────────────────────────────────────────

#[tauri::command]
fn toggle_fullscreen(window: tauri::Window) {
    if let Ok(is_fullscreen) = window.is_fullscreen() {
        window.set_fullscreen(!is_fullscreen).unwrap();
    }
}

// ── sidecar lifecycle ─────────────────────────────────────────────────────────

fn spawn_and_monitor_sidecar(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(state) = app_handle.try_state::<Arc<Mutex<Option<CommandChild>>>>() {
        let child_process = state.lock().unwrap();
        if child_process.is_some() {
            println!("[tauri] Sidecar is already running. Skipping spawn.");
            return Ok(());
        }
    }

    let sidecar_command = app_handle
        .shell()
        .sidecar("main")
        .map_err(|e| e.to_string())?;
    let (mut rx, child) = sidecar_command.spawn().map_err(|e| e.to_string())?;

    if let Some(state) = app_handle.try_state::<Arc<Mutex<Option<CommandChild>>>>() {
        *state.lock().unwrap() = Some(child);
    } else {
        return Err("Failed to access app state".to_string());
    }

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes);
                    println!("Sidecar stdout: {}", line);
                    app_handle
                        .emit("sidecar-stdout", line.to_string())
                        .expect("Failed to emit sidecar stdout event");
                }
                CommandEvent::Stderr(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes);
                    eprintln!("Sidecar stderr: {}", line);
                    app_handle
                        .emit("sidecar-stderr", line.to_string())
                        .expect("Failed to emit sidecar stderr event");
                }
                _ => {}
            }
        }
    });

    Ok(())
}

fn do_shutdown_sidecar(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(state) = app.try_state::<Arc<Mutex<Option<CommandChild>>>>() {
        let mut guard = state.lock().unwrap();
        if let Some(mut process) = guard.take() {
            process
                .write(b"sidecar shutdown\n")
                .map_err(|e| e.to_string())?;
            println!("[tauri] 'sidecar shutdown' sent.");
        }
    }
    Ok(())
}

#[tauri::command]
fn start_sidecar(app_handle: tauri::AppHandle) -> Result<String, String> {
    spawn_and_monitor_sidecar(app_handle)?;
    Ok("Sidecar spawned and monitoring started.".to_string())
}

#[tauri::command]
fn shutdown_sidecar(app_handle: tauri::AppHandle) -> Result<String, String> {
    do_shutdown_sidecar(&app_handle).map_err(|e| e.to_string())?;
    Ok("'sidecar shutdown' command sent.".to_string())
}

// ── auth commands ─────────────────────────────────────────────────────────────

#[derive(serde::Serialize, serde::Deserialize, Debug)]
struct AuthStatus {
    is_logged_in: bool,
    account: Option<serde_json::Value>,
}

/// GET /auth/status — returns current login state
#[tauri::command]
async fn get_auth_status() -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let res = client
        .get(format!("{}/auth/status", SIDECAR_URL))
        .send()
        .await
        .map_err(|e| format!("Sidecar unreachable: {}", e))?;
    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    Ok(json)
}

/// POST /auth/login — launches Playwright browser, blocks up to 5 min
#[tauri::command]
async fn login() -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(360)) // 6-min timeout
        .build()
        .map_err(|e| e.to_string())?;
    let res = client
        .post(format!("{}/auth/login", SIDECAR_URL))
        .send()
        .await
        .map_err(|e| format!("Login failed: {}", e))?;

    if res.status().is_success() {
        let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
        Ok(json)
    } else {
        let err: serde_json::Value = res.json().await.unwrap_or(serde_json::json!({"error": "login_failed"}));
        Err(err.to_string())
    }
}

/// POST /auth/logout
#[tauri::command]
async fn logout() -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let res = client
        .post(format!("{}/auth/logout", SIDECAR_URL))
        .send()
        .await
        .map_err(|e| format!("Logout failed: {}", e))?;
    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    Ok(json)
}

// ── notebook commands ─────────────────────────────────────────────────────────

async fn sidecar_get(path: &str) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let res = client
        .get(format!("{}{}", SIDECAR_URL, path))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if res.status().is_success() {
        Ok(res.json().await.map_err(|e| e.to_string())?)
    } else {
        let err: serde_json::Value = res.json().await.unwrap_or(serde_json::json!({"error": "request_failed"}));
        Err(err.to_string())
    }
}

async fn sidecar_post(path: &str, body: serde_json::Value) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let res = client
        .post(format!("{}{}", SIDECAR_URL, path))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if res.status().is_success() {
        Ok(res.json().await.map_err(|e| e.to_string())?)
    } else {
        let err: serde_json::Value = res.json().await.unwrap_or(serde_json::json!({"error": "request_failed"}));
        Err(err.to_string())
    }
}

async fn sidecar_put(path: &str, body: serde_json::Value) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let res = client
        .put(format!("{}{}", SIDECAR_URL, path))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if res.status().is_success() {
        Ok(res.json().await.map_err(|e| e.to_string())?)
    } else {
        let err: serde_json::Value = res.json().await.unwrap_or(serde_json::json!({"error": "request_failed"}));
        Err(err.to_string())
    }
}

async fn sidecar_delete(path: &str) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let res = client
        .delete(format!("{}{}", SIDECAR_URL, path))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if res.status().is_success() {
        Ok(res.json().await.map_err(|e| e.to_string())?)
    } else {
        let err: serde_json::Value = res.json().await.unwrap_or(serde_json::json!({"error": "request_failed"}));
        Err(err.to_string())
    }
}

#[tauri::command]
async fn list_notebooks() -> Result<serde_json::Value, String> {
    sidecar_get("/notebooks").await
}

#[tauri::command]
async fn create_notebook(title: String, emoji: Option<String>) -> Result<serde_json::Value, String> {
    sidecar_post("/notebooks", serde_json::json!({ "title": title, "emoji": emoji })).await
}

#[tauri::command]
async fn rename_notebook(id: String, title: String) -> Result<serde_json::Value, String> {
    sidecar_put(&format!("/notebooks/{}/rename", id), serde_json::json!({ "title": title })).await
}

#[tauri::command]
async fn delete_notebook(id: String) -> Result<serde_json::Value, String> {
    sidecar_delete(&format!("/notebooks/{}", id)).await
}

#[tauri::command]
async fn pin_notebook(id: String, pinned: bool) -> Result<serde_json::Value, String> {
    sidecar_put(&format!("/notebooks/{}/pin", id), serde_json::json!({ "pinned": pinned })).await
}

// ── source commands ───────────────────────────────────────────────────────────

#[tauri::command]
async fn open_file_dialog(window: tauri::Window) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let path = window
        .app_handle()
        .dialog()
        .file()
        .add_filter("Supported files", &["pdf", "txt", "md", "docx", "mp3", "mp4"])
        .blocking_pick_file();
    Ok(path.map(|p| p.to_string()))
}

#[tauri::command]
async fn list_sources(notebook_id: String) -> Result<serde_json::Value, String> {
    sidecar_get(&format!("/notebooks/{}/sources", notebook_id)).await
}

#[tauri::command]
async fn add_source_url(notebook_id: String, url: String) -> Result<serde_json::Value, String> {
    sidecar_post(&format!("/notebooks/{}/sources/url", notebook_id), serde_json::json!({ "url": url })).await
}

#[tauri::command]
async fn add_source_youtube(notebook_id: String, url: String) -> Result<serde_json::Value, String> {
    sidecar_post(&format!("/notebooks/{}/sources/youtube", notebook_id), serde_json::json!({ "url": url })).await
}

#[tauri::command]
async fn add_source_file(notebook_id: String, file_path: String) -> Result<serde_json::Value, String> {
    sidecar_post(&format!("/notebooks/{}/sources/file", notebook_id), serde_json::json!({ "file_path": file_path })).await
}

#[tauri::command]
async fn add_source_text(notebook_id: String, title: String, text: String) -> Result<serde_json::Value, String> {
    sidecar_post(&format!("/notebooks/{}/sources/text", notebook_id), serde_json::json!({ "title": title, "content": text })).await
}

#[tauri::command]
async fn add_source_gdrive(notebook_id: String, drive_url: String) -> Result<serde_json::Value, String> {
    sidecar_post(&format!("/notebooks/{}/sources/gdrive", notebook_id), serde_json::json!({ "drive_url": drive_url })).await
}

#[tauri::command]
async fn refresh_source(notebook_id: String, source_id: String) -> Result<serde_json::Value, String> {
    sidecar_post(&format!("/notebooks/{}/sources/{}/refresh", notebook_id, source_id), serde_json::json!({})).await
}

#[tauri::command]
async fn delete_source(notebook_id: String, source_id: String) -> Result<serde_json::Value, String> {
    sidecar_delete(&format!("/notebooks/{}/sources/{}", notebook_id, source_id)).await
}

#[tauri::command]
async fn get_source_fulltext(notebook_id: String, source_id: String) -> Result<serde_json::Value, String> {
    sidecar_get(&format!("/notebooks/{}/sources/{}/fulltext", notebook_id, source_id)).await
}

// ── chat commands ─────────────────────────────────────────────────────────────

#[tauri::command]
async fn send_message(notebook_id: String, message: String, conversation_id: Option<String>) -> Result<serde_json::Value, String> {
    sidecar_post(
        &format!("/notebooks/{}/chat", notebook_id),
        serde_json::json!({ "message": message, "conversation_id": conversation_id }),
    ).await
}

#[tauri::command]
async fn get_chat_history(notebook_id: String) -> Result<serde_json::Value, String> {
    sidecar_get(&format!("/notebooks/{}/chat/history", notebook_id)).await
}

#[tauri::command]
async fn set_persona(notebook_id: String, instructions: String) -> Result<serde_json::Value, String> {
    sidecar_put(
        &format!("/notebooks/{}/chat/persona", notebook_id),
        serde_json::json!({ "instructions": instructions }),
    ).await
}

// ── main ──────────────────────────────────────────────────────────────────────

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            app.manage(Arc::new(Mutex::new(None::<CommandChild>)));
            let app_handle = app.handle().clone();
            println!("[tauri] Creating sidecar...");
            spawn_and_monitor_sidecar(app_handle).ok();
            println!("[tauri] Sidecar spawned and monitoring started.");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_sidecar,
            shutdown_sidecar,
            toggle_fullscreen,
            get_auth_status,
            login,
            logout,
            list_notebooks,
            create_notebook,
            rename_notebook,
            delete_notebook,
            pin_notebook,
            list_sources,
            add_source_url,
            add_source_youtube,
            add_source_file,
            add_source_text,
            add_source_gdrive,
            refresh_source,
            delete_source,
            get_source_fulltext,
            open_file_dialog,
            send_message,
            get_chat_history,
            set_persona,
        ])
        .build(tauri::generate_context!())
        .expect("Error while running tauri application")
        .run(|app_handle, event| {
            if let RunEvent::ExitRequested { .. } = event {
                do_shutdown_sidecar(app_handle).ok();
            }
        });
}
