use crate::models::CurrentActivity;
use rusqlite::Connection;
use std::sync::atomic::AtomicBool;
use std::sync::Mutex;

/// Shared application state held in Tauri's managed state.
pub struct AppState {
    /// The single encrypted DB connection, guarded by a mutex (sufficient for a
    /// local single-process app; avoids the r2d2/rusqlite version-skew issue).
    pub db: Mutex<Connection>,
    /// Stable per-install identifier, stamped on every row for future sync.
    pub device_id: String,
    /// When true, the tracker records nothing (privacy pause / incognito).
    pub paused: AtomicBool,
    /// What the tracker is currently observing, for the live status pill.
    pub current: Mutex<Option<CurrentActivity>>,
}

impl AppState {
    pub fn new(db: Connection, device_id: String) -> Self {
        AppState {
            db: Mutex::new(db),
            device_id,
            paused: AtomicBool::new(false),
            current: Mutex::new(None),
        }
    }
}
