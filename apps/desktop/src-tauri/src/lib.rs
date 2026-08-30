use std::sync::Mutex;
use std::process::Child;

use tauri::Manager;

struct Backend(Mutex<Option<Child>>);

#[cfg(not(debug_assertions))]
mod prod {
    use super::*;
    use std::net::TcpStream;
    use std::path::PathBuf;
    use std::process::{Command, Stdio};
    use std::thread;
    use std::time::Duration;

    pub const PORT: u16 = 18787;

    fn cli_command() -> Command {
        let exe = std::env::current_exe().expect("exe");
        let dir = exe.parent().expect("dir");
        let candidates = [
            dir.join("wai"),
            dir.join("../Resources/wai"),
            dir.join("../Resources/binaries/wai"),
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("binaries/wai"),
        ];
        let bin = candidates
            .into_iter()
            .find(|p| p.exists())
            .unwrap_or(dir.join("wai"));
        Command::new(bin)
    }

    fn wait_port(port: u16) -> bool {
        for _ in 0..80 {
            if TcpStream::connect(("127.0.0.1", port)).is_ok() {
                return true;
            }
            thread::sleep(Duration::from_millis(100));
        }
        false
    }

    pub fn spawn_backend() -> Result<Child, String> {
        let mut cmd = cli_command();
        cmd.args(["serve", "--host", "127.0.0.1", "--port", &PORT.to_string()]);
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        cmd.spawn()
            .map_err(|e| format!("无法启动 Who Am I 服务：{e}"))
    }

    pub fn attach(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
        let child = spawn_backend()?;
        *app.state::<Backend>().0.lock().unwrap() = Some(child);
        if !wait_port(PORT) {
            eprintln!("Who Am I 服务在 127.0.0.1:{PORT} 没有起来");
        }
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.navigate(format!("http://127.0.0.1:{PORT}").parse()?);
        }
        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Backend(Mutex::new(None)))
        .setup(|app| {
            #[cfg(not(debug_assertions))]
            prod::attach(app)?;
            let _ = app;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Ok(mut guard) = window.app_handle().state::<Backend>().0.lock() {
                    if let Some(mut child) = guard.take() {
                        let _ = child.kill();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Who Am I");
}
