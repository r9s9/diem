//! Tauri commands — the API surface the React frontend invokes. Argument names are
//! snake_case here; the frontend sends camelCase and Tauri maps between them.
use crate::ai_summary;
use crate::db::repo;
use crate::error::{AppError, Result};
use crate::models::*;
use crate::state::AppState;
use chrono::{NaiveDate, Weekday};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::State;

type AppArc<'a> = State<'a, Arc<AppState>>;

fn lock<'a>(
    state: &'a AppArc,
) -> Result<std::sync::MutexGuard<'a, rusqlite::Connection>> {
    state.db.lock().map_err(|_| AppError::msg("database busy"))
}

#[tauri::command]
pub fn get_day_view(state: AppArc, day: String) -> Result<DayView> {
    let conn = lock(&state)?;
    repo::get_day_view(&conn, &day)
}

#[tauri::command]
pub fn get_period_view(
    state: AppArc,
    period_type: String,
    anchor_day: String,
) -> Result<PeriodView> {
    let conn = lock(&state)?;
    repo::get_period_view(&conn, &period_type, &anchor_day)
}

#[tauri::command]
pub fn get_tracking_status(state: AppArc) -> Result<TrackingStatus> {
    let today = {
        let conn = lock(&state)?;
        repo::today_active_ms(&conn)?
    };
    let cur = state
        .current
        .lock()
        .map_err(|_| AppError::msg("busy"))?
        .clone();
    let (current_app, current_title, st) = match cur {
        Some(c) => (c.app_name, c.window_title, c.state),
        None => (None, None, "idle".to_string()),
    };
    Ok(TrackingStatus {
        running: true,
        paused: state.paused.load(Ordering::Relaxed),
        current_app,
        current_title,
        state: st,
        today_active_ms: today,
        last_flush_ts: None,
    })
}

#[tauri::command]
pub fn set_tracking_paused(state: AppArc, paused: bool) -> Result<()> {
    state.paused.store(paused, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub fn list_categories(state: AppArc) -> Result<Vec<Category>> {
    let conn = lock(&state)?;
    repo::list_categories(&conn)
}

#[tauri::command]
pub fn set_session_category(
    state: AppArc,
    session_id: String,
    category_id: String,
) -> Result<()> {
    let conn = lock(&state)?;
    repo::set_session_category(&conn, &session_id, &category_id)
}

#[tauri::command]
pub fn get_settings(state: AppArc) -> Result<Settings> {
    let conn = lock(&state)?;
    repo::get_settings(&conn)
}

#[tauri::command]
pub fn update_settings(state: AppArc, settings: Settings) -> Result<()> {
    let conn = lock(&state)?;
    repo::save_settings(&conn, &settings)
}

#[tauri::command]
pub fn generate_summary(
    state: AppArc,
    period_type: String,
    period_key: String,
    force: bool,
) -> Result<Summary> {
    let conn = lock(&state)?;
    if !force {
        if let Some(existing) = repo::get_summary(&conn, &period_type, &period_key)? {
            return Ok(existing);
        }
    }
    let (label, active_ms, meeting_count, categories) = match period_type.as_str() {
        "day" => {
            let v = repo::get_day_view(&conn, &period_key)?;
            ("today".to_string(), v.active_ms, v.meetings.len(), v.categories)
        }
        other => {
            let anchor = anchor_from_key(other, &period_key)?;
            let v = repo::get_period_view(&conn, other, &anchor)?;
            let label = if other == "week" { "this week" } else { "this month" };
            let approx_meetings = (v.meeting_ms / (30 * 60_000)).max(0) as usize;
            (label.to_string(), v.active_ms, approx_meetings, v.categories)
        }
    };
    let narrative = ai_summary::local_narrative(&label, active_ms, meeting_count, &categories);
    let totals_json = serde_json::to_string(&categories).ok();
    let summary = Summary {
        id: repo::new_id(),
        period_type: period_type.clone(),
        period_key: period_key.clone(),
        narrative,
        totals_json,
        model: Some("local".into()),
        source: "local".into(),
        generated_at: repo::now_ms(),
    };
    repo::upsert_summary(&conn, &state.device_id, &summary)?;
    Ok(summary)
}

fn anchor_from_key(period_type: &str, key: &str) -> Result<String> {
    match period_type {
        "month" => Ok(format!("{key}-01")),
        "week" => {
            let parts: Vec<&str> = key.split("-W").collect();
            if parts.len() != 2 {
                return Err(AppError::msg("bad week key"));
            }
            let year: i32 = parts[0].parse().map_err(|_| AppError::msg("bad week year"))?;
            let week: u32 = parts[1].parse().map_err(|_| AppError::msg("bad week number"))?;
            let d = NaiveDate::from_isoywd_opt(year, week, Weekday::Mon)
                .ok_or_else(|| AppError::msg("invalid ISO week"))?;
            Ok(d.format("%Y-%m-%d").to_string())
        }
        _ => Err(AppError::msg("unknown period type")),
    }
}

#[tauri::command]
pub fn get_ollama_status() -> Result<OllamaStatus> {
    // Real detection (HTTP to localhost:11434) lands with the Ollama phase.
    Ok(OllamaStatus {
        installed: false,
        running: false,
        models: vec![],
        recommended_model: "llama3.2:3b".into(),
    })
}

#[tauri::command]
pub fn get_calendar_status(state: AppArc) -> Result<CalendarStatus> {
    let conn = lock(&state)?;
    let s = repo::get_settings(&conn)?;
    Ok(CalendarStatus {
        connected: s.calendar.connected,
        account: s.calendar.account,
        last_sync_ts: None,
    })
}

#[tauri::command]
pub fn connect_calendar() -> Result<CalendarStatus> {
    Err(AppError::msg(
        "Outlook/Teams sign-in arrives in the calendar update.",
    ))
}

#[tauri::command]
pub fn sync_calendar(state: AppArc) -> Result<CalendarStatus> {
    get_calendar_status(state)
}

#[tauri::command]
pub fn list_exclusions(state: AppArc) -> Result<Vec<Exclusion>> {
    let conn = lock(&state)?;
    repo::list_exclusions(&conn)
}

#[tauri::command]
pub fn add_exclusion(
    state: AppArc,
    match_type: String,
    pattern: String,
    note: Option<String>,
) -> Result<()> {
    let conn = lock(&state)?;
    repo::add_exclusion(&conn, &state.device_id, &match_type, &pattern, note.as_deref())
}

#[tauri::command]
pub fn remove_exclusion(state: AppArc, id: String) -> Result<()> {
    let conn = lock(&state)?;
    repo::remove_exclusion(&conn, &id)
}
