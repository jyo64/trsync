#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use tauri::Emitter;

#[derive(serde::Serialize, Clone)]
struct DirtyMemoryData {
    dirty: String,
    writeback: String,
}

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
    fsync:bool,
    source_ssh: Option<SshOptions>,
    dest_ssh: Option<SshOptions>,
}

// Helper function to format bytes to human-readable format
fn format_memory_size(kb_value: &str) -> String {
    // Parse the KB value (removes "kB" and any whitespace)
    let clean = kb_value.trim_end_matches("kB").trim();
    if let Ok(kb) = clean.parse::<f64>() {
        let bytes = kb * 1024.0;
        
        if bytes >= 1024.0 * 1024.0 * 1024.0 { // GB
            format!("{:.2} GB", bytes / (1024.0 * 1024.0 * 1024.0))
        } else if bytes >= 1024.0 * 1024.0 { // MB
            format!("{:.2} MB", bytes / (1024.0 * 1024.0))
        } else if bytes >= 1024.0 { // KB
            format!("{:.2} KB", bytes / 1024.0)
        } else {
            format!("{:.0} B", bytes)
        }
    } else {
        kb_value.to_string()
    }
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
    if opts.fsync {
        cmd.arg("--fsync");
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

    let app_clone = app.clone();

    std::thread::spawn(move || {
        loop {
            let output = Command::new("sh")
                .arg("-c")
                .arg("grep -E 'Dirty:|Writeback:' /proc/meminfo")
                .output();

            if let Ok(output) = output {
                let text = String::from_utf8_lossy(&output.stdout);

                let mut dirty = String::new();
                let mut writeback = String::new();

                for line in text.lines() {
                    if line.starts_with("Dirty:") {
                        dirty = line.replace("Dirty:", "").trim().to_string();
                    }

                    if line.starts_with("Writeback:") {
                        writeback = line.replace("Writeback:", "").trim().to_string();
                    }
                }

                let _ = app_clone.emit(
                    "dirty-memory",
                    DirtyMemoryData {
                        dirty: format_memory_size(&dirty),
                        writeback: format_memory_size(&writeback),
                    },
                );
            }

            std::thread::sleep(std::time::Duration::from_secs(1));
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