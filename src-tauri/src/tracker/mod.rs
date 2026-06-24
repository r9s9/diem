//! Background activity tracker. Polls the foreground window + idle time, collapses
//! contiguous same-activity stretches into sessions, and writes them to the DB.
mod foreground;
mod idle;

use crate::db::repo::{self, NewSession};
use crate::models::CurrentActivity;
use crate::state::AppState;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Duration;

/// Start the tracker on a dedicated OS thread (needed for blocking Win32 polling).
pub fn spawn(state: Arc<AppState>) {
    std::thread::spawn(move || run_loop(state));
}

fn signature(app: &Option<String>, title: &Option<String>, st: &str) -> String {
    format!(
        "{}|{}|{}",
        app.as_deref().unwrap_or(""),
        title.as_deref().unwrap_or(""),
        st
    )
}

fn run_loop(state: Arc<AppState>) {
    let device_id = state.device_id.clone();
    // (active session being accumulated, its signature)
    let mut cur: Option<(CurrentActivity, String)> = None;

    loop {
        let (enabled, poll_ms, idle_threshold_ms) = read_tracking_settings(&state);

        if state.paused.load(Ordering::Relaxed) || !enabled {
            flush(&state, &device_id, &mut cur);
            *state.current.lock().unwrap() = None;
            std::thread::sleep(Duration::from_millis(poll_ms));
            continue;
        }

        let idle = idle::idle_ms();
        let st = if idle >= idle_threshold_ms { "idle" } else { "active" };

        let fg = foreground::foreground();
        let (app_name, process_path, title) = match &fg {
            Some(f) => (f.process_name.clone(), f.process_path.clone(), f.title.clone()),
            None => (None, None, None),
        };

        // Respect exclusions — never record matching apps/domains.
        let excluded = state
            .db
            .lock()
            .ok()
            .and_then(|c| repo::is_excluded(&c, app_name.as_deref(), None).ok())
            .unwrap_or(false);
        if excluded {
            flush(&state, &device_id, &mut cur);
            *state.current.lock().unwrap() = None;
            std::thread::sleep(Duration::from_millis(poll_ms));
            continue;
        }

        let now = repo::now_ms();
        let sig = signature(&app_name, &title, st);
        let changed = cur.as_ref().map(|(_, s)| s != &sig).unwrap_or(true);

        if changed {
            flush(&state, &device_id, &mut cur);
            let activity = CurrentActivity {
                app_name,
                process_path,
                window_title: title,
                state: st.to_string(),
                since_ts: now,
            };
            *state.current.lock().unwrap() = Some(activity.clone());
            cur = Some((activity, sig));
        } else if let Some((act, _)) = cur.as_mut() {
            // Same focused activity still ongoing — persist a chunk every
            // PERSIST_CHUNK_MS so today's totals advance live (drives the UI
            // auto-refresh) instead of only on the next app switch.
            if now - act.since_ts >= PERSIST_CHUNK_MS {
                write_session(&state, &device_id, act, now);
                act.since_ts = now; // continue the same activity from here
            }
        }

        std::thread::sleep(Duration::from_millis(poll_ms));
    }
}

/// How often an unbroken focused activity is checkpointed to the DB.
const PERSIST_CHUNK_MS: i64 = 20_000;

fn read_tracking_settings(state: &Arc<AppState>) -> (bool, u64, u64) {
    if let Ok(conn) = state.db.lock() {
        if let Ok(s) = repo::get_settings(&conn) {
            return (
                s.tracking.enabled,
                (s.tracking.poll_interval_ms.max(500)) as u64,
                (s.tracking.idle_threshold_sec.max(15) * 1000) as u64,
            );
        }
    }
    (true, 2000, 90_000)
}

/// Persist the in-flight session (if it lasted long enough) and clear it.
fn flush(state: &Arc<AppState>, device_id: &str, cur: &mut Option<(CurrentActivity, String)>) {
    if let Some((act, _)) = cur.take() {
        write_session(state, device_id, &act, repo::now_ms());
    }
}

/// Write a single `[act.since_ts, end_ts)` session row. Sub-second blips are dropped.
fn write_session(
    state: &Arc<AppState>,
    device_id: &str,
    act: &CurrentActivity,
    end_ts: i64,
) {
    if end_ts - act.since_ts < 1000 {
        return; // ignore sub-second blips
    }
    if let Ok(conn) = state.db.lock() {
        let category_id = repo::categorize(
            &conn,
            act.app_name.as_deref(),
            None,
            act.window_title.as_deref(),
        )
        .ok()
        .flatten();
        let category_source = category_id.as_ref().map(|_| "rule".to_string());
        let ns = NewSession {
            start_ts: act.since_ts,
            end_ts,
            state: act.state.clone(),
            app_name: act.app_name.clone(),
            process_path: act.process_path.clone(),
            window_title: act.window_title.clone(),
            url_domain: None,
            doc_name: None,
            category_id,
            category_source,
        };
        let _ = repo::insert_session(&conn, device_id, &ns);
    }
}
