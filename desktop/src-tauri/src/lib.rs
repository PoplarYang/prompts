#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri::Manager;

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![read_local_prompt_files, app_installation_status])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            #[cfg(target_os = "macos")]
            {
                if let tauri::RunEvent::Reopen { .. } = event {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.unminimize();
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        });
}

#[derive(serde::Serialize)]
struct AppInstallationStatus {
    is_macos: bool,
    is_in_applications: bool,
    executable_path: String,
}

#[tauri::command]
fn app_installation_status() -> AppInstallationStatus {
    let executable = std::env::current_exe().unwrap_or_default();
    let path = executable.to_string_lossy().to_string();
    AppInstallationStatus {
        is_macos: cfg!(target_os = "macos"),
        is_in_applications: cfg!(target_os = "macos") && path.contains("/Applications/"),
        executable_path: path,
    }
}

#[derive(serde::Serialize)]
struct LocalPromptFile {
    path: String,
    raw: String,
}

#[derive(serde::Serialize)]
struct LocalPromptFiles {
    manifest: Option<String>,
    files: Vec<LocalPromptFile>,
}

#[tauri::command]
fn read_local_prompt_files(root_dir: String, prompts_dir: String) -> Result<LocalPromptFiles, String> {
    let root = std::path::PathBuf::from(root_dir);
    if !root.is_dir() {
        return Err("Local prompt folder does not exist".into());
    }

    let prompt_root = root.join(prompts_dir.trim_matches(|value| value == '/' || value == '\\'));
    if !prompt_root.is_dir() {
        return Err("Local prompts directory does not exist".into());
    }

    let manifest = std::fs::read_to_string(root.join("manifest.yaml")).ok();
    let mut files = Vec::new();
    collect_markdown_files(&root, &prompt_root, &mut files)?;
    files.sort_by(|a, b| a.path.cmp(&b.path));

    Ok(LocalPromptFiles { manifest, files })
}

fn collect_markdown_files(
    root: &std::path::Path,
    dir: &std::path::Path,
    files: &mut Vec<LocalPromptFile>,
) -> Result<(), String> {
    for entry in std::fs::read_dir(dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if path.is_dir() {
            collect_markdown_files(root, &path, files)?;
            continue;
        }
        if path.extension().and_then(|value| value.to_str()) != Some("md") {
            continue;
        }
        let relative = path
            .strip_prefix(root)
            .map_err(|error| error.to_string())?
            .to_string_lossy()
            .replace('\\', "/");
        let raw = std::fs::read_to_string(&path).map_err(|error| error.to_string())?;
        files.push(LocalPromptFile { path: relative, raw });
    }

    Ok(())
}
