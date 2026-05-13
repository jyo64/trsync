# Trsync

A modern GUI wrapper for [`rsync`](https://github.com/RsyncProject/rsync) built with **Tauri (React frontend)** and **Rust backend**, designed to simplify file synchronization with an intuitive graphical interface.

## Overview

Trsync provides a user-friendly way to interact with `rsync` without needing to remember complex command-line flags. It enables selecting files and directories via a GUI, supports multi-file selection, and executes synchronization operations securely through a Rust-powered backend.

## Features

- 📁 Graphical file and folder selection
- 📦 Multi-file sync support
- 🔄 Powered by `rsync` for efficient delta transfers
- ⚡ Fast and lightweight (Tauri-based desktop app)
- 🦀 Secure backend logic in Rust
- 🖥 Tested only on Fedora Linux






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