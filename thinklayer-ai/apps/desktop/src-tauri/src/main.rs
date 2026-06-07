// ThinkLayer AI desktop shell.
//
// The MVP runs the Python FastAPI backend as a separate process (see the
// README). This shell simply hosts the web UI. A later milestone can use a
// Tauri sidecar to launch and supervise the backend automatically.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running ThinkLayer AI");
}
