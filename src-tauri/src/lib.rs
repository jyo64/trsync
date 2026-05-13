#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use tauri::Emitter;

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct SshOptions {
    enabled: bool,
    username: String,
    host: String,
    port: Option<u16>, // Optional port field
    is_alias: Option<bool>
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct RsyncOptions {
    source: Vec<String>,
    destination: String,
    archive: bool,
    verbose: bool,
    delete: bool,
    dry_run: bool,
    progress: bool,
    recursive: bool,
    source_ssh: Option<SshOptions>,
    dest_ssh: Option<SshOptions>,
}

#[tauri::command]
async fn run_rsync(app: tauri::AppHandle, opts: RsyncOptions) -> Result<String, String> {
    let mut cmd = Command::new("rsync");

    // Build arguments
    if opts.archive {
        cmd.arg("--archive");
    }
    if opts.verbose {
        cmd.arg("--verbose");
    }
    if opts.delete {
        cmd.arg("--delete");
    }
    if opts.dry_run {
        cmd.arg("--dry-run");
    }
    if opts.progress {
        cmd.arg("--progress");
        cmd.arg("--info=progress2");
    }
    if opts.recursive {
        cmd.arg("--recursive");
    }

    if let Some(ssh) = opts.source_ssh {
        if ssh.enabled {
            if ssh.is_alias == Some(true) {
                // Use alias directly - no -e flag needed for aliases from SSH config
                for src in &opts.source {
                    cmd.arg(format!("{}:{}", ssh.username, src));
                }
            } else {
                let ssh_cmd = if let Some(port) = ssh.port {
                    format!("ssh -p {} -l {}", port, ssh.username)
                } else {
                    format!("ssh -l {}", ssh.username)
                };
                cmd.arg("-e").arg(ssh_cmd);
                for src in &opts.source {
                    cmd.arg(format!("{}:{}", ssh.host, src));
                }
            }
        } else {
            for src in &opts.source {
                cmd.arg(src);
            }
        }
    } else {
        for src in &opts.source {
            cmd.arg(src);
        }
    }

    // Add destination with SSH if enabled
    if let Some(ssh) = opts.dest_ssh {
        if ssh.enabled {
            if ssh.is_alias == Some(true) {
                // Use alias directly - no -e flag needed for aliases from SSH config
                cmd.arg(format!("{}:{}", ssh.username, opts.destination));
            } else {
                let ssh_cmd = if let Some(port) = ssh.port {
                    format!("ssh -p {} -l {}", port, ssh.username)
                } else {
                    format!("ssh -l {}", ssh.username)
                };
                cmd.arg("-e").arg(ssh_cmd);
                cmd.arg(format!("{}:{}", ssh.host, opts.destination));
            }
        } else {
            cmd.arg(&opts.destination);
        }
    } else {
        cmd.arg(&opts.destination);
    }

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
        println!("Starting Rsync Thread");
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