mod ai_summary;
mod commands;
mod db;
mod error;
mod models;
mod state;
mod tracker;

use state::AppState;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // single-instance must be registered first
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // ---- data dir + encrypted DB ----
            let dir = app.path().app_local_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let conn = db::open_encrypted(&dir.join("diem.db"), &dir.join("diem.key"))?;
            let device_id = db::repo::get_or_create_device_id(&conn)?;
            db::repo::ensure_seeded(&conn, &device_id)?;
            let _ = db::repo::get_settings(&conn)?; // materialize defaults on first run

            let app_state = Arc::new(AppState::new(conn, device_id));
            app.manage(app_state.clone());

            // ---- background activity tracker ----
            tracker::spawn(app_state.clone());

            // ---- system tray ----
            let show = MenuItemBuilder::with_id("show", "Open diem").build(app)?;
            let pause = MenuItemBuilder::with_id("pause", "Pause / resume tracking").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit diem").build(app)?;
            let menu = MenuBuilder::new(app).items(&[&show, &pause, &quit]).build()?;

            TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("diem")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "pause" => {
                        if let Some(s) = app.try_state::<Arc<AppState>>() {
                            let now = s.paused.load(Ordering::Relaxed);
                            s.paused.store(!now, Ordering::Relaxed);
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_day_view,
            commands::get_period_view,
            commands::get_tracking_status,
            commands::set_tracking_paused,
            commands::list_categories,
            commands::set_session_category,
            commands::get_settings,
            commands::update_settings,
            commands::generate_summary,
            commands::get_ollama_status,
            commands::get_calendar_status,
            commands::connect_calendar,
            commands::sync_calendar,
            commands::list_exclusions,
            commands::add_exclusion,
            commands::remove_exclusion,
        ])
        // hide to tray instead of quitting when the window is closed
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building the diem application")
        // keep the process alive in the tray even with no visible window
        .run(|_app, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                api.prevent_exit();
            }
        });
}
