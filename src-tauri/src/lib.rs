// src-tauri/src/lib.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;
use tauri::Emitter; // For sending live output

#[derive(serde::Serialize, serde::Deserialize)]
pub struct RsyncOptions {
    source: String,
    destination: String,
    archive: bool,     // -a
    verbose: bool,     // -v
    delete: bool,      // --delete
    dry_run: bool,     // -n
}

#[tauri::command]
async fn run_rsync(app: tauri::AppHandle, opts: RsyncOptions) -> Result<String, String> {
    let mut cmd = Command::new("rsync");

    // Build arguments
    if opts.archive {
        cmd.arg("-a");
    }
    if opts.verbose {
        cmd.arg("-v");
    }
    if opts.delete {
        cmd.arg("--delete");
    }
    if opts.dry_run {
        cmd.arg("-n");
    }

    cmd.arg(&opts.source);
    cmd.arg(&opts.destination);

    // For real-time output (nice for learning)
    let output = cmd.output().map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    // Send output to frontend via events (optional but useful)
    let _ = app.emit("rsync-output", &stdout);
    if !stderr.is_empty() {
        let _ = app.emit("rsync-error", &stderr);
    }

    if output.status.success() {
        Ok(stdout)
    } else {
        Err(stderr)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init()) // Often useful, keep it
        .invoke_handler(tauri::generate_handler![run_rsync])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}