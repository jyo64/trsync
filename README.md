# <img width="30" height="30" alt="Logo" src="https://github.com/user-attachments/assets/3420ace3-e813-4b48-a122-4476a27d6fab" /> Trsync
<p align="center">
<img width="542" height="398" alt="Screenshot_20260514_011336" src="https://github.com/user-attachments/assets/7dc78ee3-fad0-4d5a-a470-82c35d628790" />
</p>


A modern GUI wrapper for [`rsync`](https://github.com/RsyncProject/rsync) built with **Tauri (React frontend)** and **Rust backend**, designed to simplify file synchronization with an intuitive graphical interface.

## Overview

Trsync provides a user-friendly way to interact with `rsync` without needing to remember complex command-line flags. It enables selecting files and directories via a GUI, supports multi-file selection, and executes synchronization operations securely through a Rust-powered backend.

## Features

- 📁 Graphical file and folder selection
- 📦 Multi-file sync support
- 🌐 SSH Support. A graphical alternative to the SCP tool.
- 🔄 Powered by `rsync` for efficient delta transfers
- ⚡ Fast and lightweight (Tauri-based desktop app)
- 🦀 Secure backend logic in Rust
- ⚠️ Tested only on Fedora Linux


## Tech Stack

- **Frontend:** React (TypeScript)
- **Backend:** Rust
- **Desktop Shell:** Tauri 2.0
- **Core Engine:** rsync

## How It Works

1. User selects source files/folders via the GUI
2. Destination path is chosen through the interface
3. Frontend sends sync configuration to Rust backend
4. Rust constructs and executes the appropriate `rsync` command
5. Output is streamed back to the UI for status updates

## Installation

### Pre-built Binaries

You can download pre-built binaries for your platform from the [Releases](https://github.com/jyo64/trsync/releases) page. Available for both x86_64 and ARM64 architectures. ⚠️ Only .deb and .rpm packages are available at the moment.

## Development

### Prerequisites

Ensure you have the following installed:

- Rust (latest stable)
- Node.js (LTS recommended)
- `rsync` (pre-installed on macOS/Linux; Windows requires setup)
- Tauri prerequisites (platform-specific dependencies)

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/trsync.git
cd trsync

# Install frontend dependencies
pnpm install

# Run in development mode
pnpm tauri dev
