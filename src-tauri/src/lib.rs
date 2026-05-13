#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use tauri::Emitter;

#[derive(serde::Serialize, serde::Deserialize)]
pub struct RsyncOptions {
    source: String,
    destination: String,
    archive: bool,
    verbose: bool,
    delete: bool,
    dry_run: bool,
    progress: bool,
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
    if opts.progress {
        cmd.arg("--progress");
        cmd.arg("--info=progress2");
    }

    cmd.arg(&opts.source);
    cmd.arg(&opts.destination);

    // Spawn command with piped stdout/stderr
    let mut child = cmd
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    // Read stdout line by line (properly handles \r updates)
    let app_clone = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line) = line {
                let trimmed = line.trim();
                if !trimmed.is_empty() {
                    println!("Rust Transfer Progress - {}", trimmed); 
                    let _ = app_clone.emit("rsync-output", trimmed.to_string());
                }
            }
        }
    });

    // Read stderr line by line
    let app_clone = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line) = line {
                let _ = app_clone.emit("rsync-error", line);
            }
        }
    });

    let output = child.wait().map_err(|e| e.to_string())?;

    if output.success() {
        Ok("Rsync completed".to_string())
    } else {
        Err("Rsync failed".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![run_rsync])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}