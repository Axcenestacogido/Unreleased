// Prevents an additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Spawn the FastAPI backend sidecar
            let resource_path = app
                .path()
                .resource_dir()
                .expect("failed to resolve resource dir");

            let backend_path = resource_path.join("binaries/musicvault-backend");

            if backend_path.exists() {
                let _child = Command::new(backend_path)
                    .env("DATA_DIR", resource_path.join("data").to_str().unwrap())
                    .spawn()
                    .expect("failed to spawn backend");

                // Give the backend a moment to start
                std::thread::sleep(std::time::Duration::from_millis(500));
            } else {
                // Dev mode: assume backend is already running on port 8000
                eprintln!("Backend binary not found — assuming dev server at localhost:8000");
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
