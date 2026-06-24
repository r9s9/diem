//! All SQL lives here behind a repository API, so a future sync engine can slot in
//! behind the same functions without touching callers.
use crate::error::{AppError, Result};
use crate::models::*;
use chrono::{Datelike, Duration, Local, NaiveDate, NaiveDateTime, TimeZone};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Deserialize;
use std::collections::HashMap;
use uuid::Uuid;

// --- small helpers ----------------------------------------------------------

pub fn now_ms() -> i64 {
    Local::now().timestamp_millis()
}

pub fn new_id() -> String {
    Uuid::new_v4().to_string()
}

fn local_naive_to_ms(n: NaiveDateTime) -> i64 {
    match Local.from_local_datetime(&n) {
        chrono::LocalResult::Single(dt) => dt.timestamp_millis(),
        chrono::LocalResult::Ambiguous(dt, _) => dt.timestamp_millis(),
        chrono::LocalResult::None => n.and_utc().timestamp_millis(),
    }
}

fn parse_day(day: &str) -> Result<NaiveDate> {
    NaiveDate::parse_from_str(day, "%Y-%m-%d")
        .map_err(|e| AppError::Other(format!("bad day '{day}': {e}")))
}

/// [start, end) epoch-ms bounds of a local calendar day.
fn day_bounds(day: &str) -> Result<(i64, i64)> {
    let d = parse_day(day)?;
    let start = local_naive_to_ms(d.and_hms_opt(0, 0, 0).unwrap());
    let end = local_naive_to_ms((d + Duration::days(1)).and_hms_opt(0, 0, 0).unwrap());
    Ok((start, end))
}

fn ms_to_day_key(ms: i64) -> String {
    Local
        .timestamp_millis_opt(ms)
        .single()
        .map(|dt| dt.format("%Y-%m-%d").to_string())
        .unwrap_or_default()
}

// --- device id + settings ---------------------------------------------------

pub fn get_or_create_device_id(conn: &Connection) -> Result<String> {
    if let Some(v) = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'device_id'",
            [],
            |r| r.get::<_, String>(0),
        )
        .optional()?
    {
        return Ok(v);
    }
    let id = new_id();
    conn.execute(
        "INSERT INTO settings(key, value, updated_at) VALUES ('device_id', ?1, ?2)",
        params![id, now_ms()],
    )?;
    Ok(id)
}

pub fn get_settings(conn: &Connection) -> Result<Settings> {
    let raw: Option<String> = conn
        .query_row("SELECT value FROM settings WHERE key = 'app'", [], |r| {
            r.get(0)
        })
        .optional()?;
    match raw {
        Some(s) => Ok(serde_json::from_str(&s)?),
        None => {
            let def = Settings::default();
            save_settings(conn, &def)?;
            Ok(def)
        }
    }
}

pub fn save_settings(conn: &Connection, settings: &Settings) -> Result<()> {
    let json = serde_json::to_string(settings)?;
    conn.execute(
        "INSERT INTO settings(key, value, updated_at) VALUES ('app', ?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        params![json, now_ms()],
    )?;
    Ok(())
}

// --- seeding default categories + rules -------------------------------------

#[derive(Deserialize)]
struct SeedFile {
    categories: Vec<SeedCategory>,
    rules: Vec<SeedRule>,
}
#[derive(Deserialize)]
struct SeedCategory {
    slug: String,
    name: String,
    color: String,
    icon: String,
    is_billable: i64,
    is_idle: i64,
    sort_order: i64,
}
#[derive(Deserialize)]
struct SeedRule {
    match_type: String,
    pattern: String,
    category: String,
    priority: i64,
}

const SEED_JSON: &str = include_str!("../../resources/seed.json");

pub fn ensure_seeded(conn: &Connection, device_id: &str) -> Result<()> {
    let count: i64 = conn.query_row("SELECT count(*) FROM categories", [], |r| r.get(0))?;
    if count > 0 {
        return Ok(());
    }
    let seed: SeedFile = serde_json::from_str(SEED_JSON)?;
    let now = now_ms();
    let mut slug_to_id: HashMap<String, String> = HashMap::new();

    for c in &seed.categories {
        let id = new_id();
        conn.execute(
            "INSERT INTO categories(id, device_id, name, color, icon, is_billable, is_idle, sort_order, created_at, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?9)",
            params![id, device_id, c.name, c.color, c.icon, c.is_billable, c.is_idle, c.sort_order, now],
        )?;
        slug_to_id.insert(c.slug.clone(), id);
    }
    for r in &seed.rules {
        let Some(cat_id) = slug_to_id.get(&r.category) else {
            continue;
        };
        conn.execute(
            "INSERT INTO category_rules(id, device_id, match_type, pattern, category_id, priority, source, enabled, created_at, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,'builtin',1,?7,?7)",
            params![new_id(), device_id, r.match_type, r.pattern, cat_id, r.priority, now],
        )?;
    }
    Ok(())
}

pub fn list_categories(conn: &Connection) -> Result<Vec<Category>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, color, icon, is_billable, is_idle, sort_order
         FROM categories WHERE deleted_at IS NULL ORDER BY sort_order",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(Category {
            id: r.get(0)?,
            name: r.get(1)?,
            color: r.get(2)?,
            icon: r.get(3)?,
            is_billable: r.get::<_, i64>(4)? != 0,
            is_idle: r.get::<_, i64>(5)? != 0,
            sort_order: r.get(6)?,
        })
    })?;
    Ok(rows.collect::<std::result::Result<_, _>>()?)
}

// --- categorization rules ----------------------------------------------------

struct Rule {
    match_type: String,
    pattern: String,
    category_id: String,
}

fn load_rules(conn: &Connection) -> Result<Vec<Rule>> {
    let mut stmt = conn.prepare(
        "SELECT match_type, pattern, category_id FROM category_rules
         WHERE deleted_at IS NULL AND enabled = 1 ORDER BY priority ASC",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(Rule {
            match_type: r.get(0)?,
            pattern: r.get(1)?,
            category_id: r.get(2)?,
        })
    })?;
    Ok(rows.collect::<std::result::Result<_, _>>()?)
}

/// Resolve a category from app/domain/title using the first matching rule.
pub fn categorize(
    conn: &Connection,
    app_name: Option<&str>,
    url_domain: Option<&str>,
    title: Option<&str>,
) -> Result<Option<String>> {
    let app = app_name.map(|s| s.to_ascii_lowercase());
    let domain = url_domain.map(|s| s.to_ascii_lowercase());
    let title_l = title.map(|s| s.to_ascii_lowercase());
    for rule in load_rules(conn)? {
        let hit = match rule.match_type.as_str() {
            "process" | "app" => app.as_deref() == Some(rule.pattern.as_str())
                || app.as_deref().map_or(false, |a| a.contains(&rule.pattern)),
            "domain" => domain.as_deref() == Some(rule.pattern.as_str())
                || domain
                    .as_deref()
                    .map_or(false, |d| d.ends_with(&rule.pattern)),
            "title_regex" => title_l.as_deref().map_or(false, |t| t.contains(&rule.pattern)),
            _ => false,
        };
        if hit {
            return Ok(Some(rule.category_id));
        }
    }
    Ok(None)
}

// --- writing activity --------------------------------------------------------

#[derive(Debug, Clone)]
pub struct NewSession {
    pub start_ts: i64,
    pub end_ts: i64,
    pub state: String,
    pub app_name: Option<String>,
    pub process_path: Option<String>,
    pub window_title: Option<String>,
    pub url_domain: Option<String>,
    pub doc_name: Option<String>,
    pub category_id: Option<String>,
    pub category_source: Option<String>,
}

pub fn insert_session(conn: &Connection, device_id: &str, s: &NewSession) -> Result<()> {
    let now = now_ms();
    let dur = (s.end_ts - s.start_ts).max(0);
    conn.execute(
        "INSERT INTO activity_sessions
           (id, device_id, start_ts, end_ts, duration_ms, state, app_name, process_path,
            window_title, url_domain, url_full, doc_name, category_id, category_source,
            confidence, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,NULL,?11,?12,?13,NULL,?14,?14)",
        params![
            new_id(),
            device_id,
            s.start_ts,
            s.end_ts,
            dur,
            s.state,
            s.app_name,
            s.process_path,
            s.window_title,
            s.url_domain,
            s.doc_name,
            s.category_id,
            s.category_source,
            now,
        ],
    )?;
    Ok(())
}

pub fn set_session_category(conn: &Connection, session_id: &str, category_id: &str) -> Result<()> {
    conn.execute(
        "UPDATE activity_sessions SET category_id = ?2, category_source = 'user', updated_at = ?3
         WHERE id = ?1",
        params![session_id, category_id, now_ms()],
    )?;
    Ok(())
}

// --- reading: day view -------------------------------------------------------

fn read_blocks(conn: &Connection, start: i64, end: i64) -> Result<Vec<TimelineBlock>> {
    let mut stmt = conn.prepare(
        "SELECT s.start_ts, s.end_ts, s.duration_ms, s.state, s.app_name, s.window_title,
                s.url_domain, s.doc_name, s.category_id, c.name, c.color
         FROM activity_sessions s
         LEFT JOIN categories c ON c.id = s.category_id
         WHERE s.deleted_at IS NULL AND s.end_ts > ?1 AND s.start_ts < ?2
         ORDER BY s.start_ts",
    )?;
    let rows = stmt.query_map(params![start, end], |r| {
        let app_name: Option<String> = r.get(4)?;
        let window_title: Option<String> = r.get(5)?;
        let doc_name: Option<String> = r.get(7)?;
        let label = doc_name
            .clone()
            .or_else(|| window_title.clone())
            .or_else(|| app_name.clone())
            .unwrap_or_else(|| "Activity".into());
        Ok(TimelineBlock {
            start_ts: r.get(0)?,
            end_ts: r.get(1)?,
            duration_ms: r.get(2)?,
            state: r.get(3)?,
            label,
            app_name,
            category_id: r.get(8)?,
            category_name: r.get(9)?,
            category_color: r.get(10)?,
            url_domain: r.get(6)?,
        })
    })?;
    Ok(rows.collect::<std::result::Result<_, _>>()?)
}

fn read_meetings(conn: &Connection, start: i64, end: i64) -> Result<Vec<CalendarEvent>> {
    let mut stmt = conn.prepare(
        "SELECT id, external_id, subject, start_ts, end_ts, is_all_day, is_online,
                online_provider, organizer_name, organizer_email, attendee_count,
                show_as, location, web_link, attended, category_id
         FROM calendar_events
         WHERE deleted_at IS NULL AND end_ts > ?1 AND start_ts < ?2
         ORDER BY start_ts",
    )?;
    let rows = stmt.query_map(params![start, end], |r| {
        Ok(CalendarEvent {
            id: r.get(0)?,
            external_id: r.get(1)?,
            subject: r.get(2)?,
            start_ts: r.get(3)?,
            end_ts: r.get(4)?,
            is_all_day: r.get::<_, i64>(5)? != 0,
            is_online: r.get::<_, i64>(6)? != 0,
            online_provider: r.get(7)?,
            organizer_name: r.get(8)?,
            organizer_email: r.get(9)?,
            attendee_count: r.get(10)?,
            show_as: r.get(11)?,
            location: r.get(12)?,
            web_link: r.get(13)?,
            attended: r.get::<_, Option<i64>>(14)?.map(|v| v != 0),
            category_id: r.get(15)?,
        })
    })?;
    Ok(rows.collect::<std::result::Result<_, _>>()?)
}

fn totals_from_blocks(blocks: &[TimelineBlock]) -> (i64, i64, Vec<CategoryTotal>) {
    let mut active = 0i64;
    let mut idle = 0i64;
    let mut by_cat: HashMap<String, (String, String, i64)> = HashMap::new();
    for b in blocks {
        if b.state == "active" {
            active += b.duration_ms;
            let key = b.category_id.clone().unwrap_or_else(|| "uncategorized".into());
            let name = b.category_name.clone().unwrap_or_else(|| "Uncategorized".into());
            let color = b.category_color.clone().unwrap_or_else(|| "#64748B".into());
            let e = by_cat.entry(key).or_insert((name, color, 0));
            e.2 += b.duration_ms;
        } else {
            idle += b.duration_ms;
        }
    }
    let mut cats: Vec<CategoryTotal> = by_cat
        .into_iter()
        .map(|(id, (name, color, ms))| CategoryTotal {
            category_id: Some(id),
            category_name: name,
            category_color: color,
            active_ms: ms,
            share: if active > 0 { ms as f64 / active as f64 } else { 0.0 },
        })
        .collect();
    cats.sort_by(|a, b| b.active_ms.cmp(&a.active_ms));
    (active, idle, cats)
}

/// Per-application active-time rollup, with each app's dominant category.
fn apps_from_blocks(blocks: &[TimelineBlock], active_total: i64) -> Vec<AppUsage> {
    struct Acc {
        ms: i64,
        best: i64,
        name: Option<String>,
        color: Option<String>,
    }
    let mut map: HashMap<String, Acc> = HashMap::new();
    for b in blocks {
        if b.state != "active" {
            continue;
        }
        let key = b.app_name.clone().unwrap_or_else(|| "Unknown".into());
        let e = map.entry(key).or_insert(Acc {
            ms: 0,
            best: 0,
            name: None,
            color: None,
        });
        e.ms += b.duration_ms;
        if b.duration_ms >= e.best {
            e.best = b.duration_ms;
            e.name = b.category_name.clone();
            e.color = b.category_color.clone();
        }
    }
    let mut apps: Vec<AppUsage> = map
        .into_iter()
        .map(|(app, a)| AppUsage {
            app_name: app,
            active_ms: a.ms,
            category_name: a.name,
            category_color: a.color,
            share: if active_total > 0 {
                a.ms as f64 / active_total as f64
            } else {
                0.0
            },
        })
        .collect();
    apps.sort_by(|x, y| y.active_ms.cmp(&x.active_ms));
    apps
}

fn bands_from_blocks(blocks: &[TimelineBlock]) -> Vec<OnOffBand> {
    let mut bands: Vec<OnOffBand> = Vec::new();
    for b in blocks {
        let kind = match b.state.as_str() {
            "idle" | "away" => "idle",
            "locked" => "locked",
            _ => "on",
        };
        if let Some(last) = bands.last_mut() {
            if last.kind == kind && b.start_ts - last.end_ts < 6 * 60_000 {
                last.end_ts = b.end_ts;
                continue;
            }
        }
        bands.push(OnOffBand {
            start_ts: b.start_ts,
            end_ts: b.end_ts,
            kind: kind.into(),
        });
    }
    bands
}

pub fn get_day_view(conn: &Connection, day: &str) -> Result<DayView> {
    let (start, end) = day_bounds(day)?;
    let blocks = read_blocks(conn, start, end)?;
    let meetings = read_meetings(conn, start, end)?;
    let (active_ms, idle_ms, categories) = totals_from_blocks(&blocks);
    let apps = apps_from_blocks(&blocks, active_ms);
    let bands = bands_from_blocks(&blocks);

    let first = blocks.first().map(|b| b.start_ts);
    let last = blocks.last().map(|b| b.end_ts);
    let on_ms = match (first, last) {
        (Some(f), Some(l)) => l - f,
        _ => 0,
    };
    let meeting_ms = meetings.iter().map(|m| (m.end_ts - m.start_ts).max(0)).sum();
    let summary = get_summary(conn, "day", day)?;

    Ok(DayView {
        day: day.to_string(),
        first_activity_ts: first,
        last_activity_ts: last,
        active_ms,
        idle_ms,
        on_ms,
        meeting_ms,
        blocks,
        bands,
        categories,
        apps,
        meetings,
        summary,
    })
}

// --- reading: period view ----------------------------------------------------

fn period_range(period_type: &str, anchor_day: &str) -> Result<(String, Vec<String>)> {
    let anchor = parse_day(anchor_day)?;
    let mut days = Vec::new();
    let (start, key) = match period_type {
        "week" => {
            let dow = anchor.weekday().num_days_from_monday() as i64;
            let start = anchor - Duration::days(dow);
            let iso = start.iso_week();
            (start, format!("{}-W{:02}", iso.year(), iso.week()))
        }
        _ => {
            let start = NaiveDate::from_ymd_opt(anchor.year(), anchor.month(), 1).unwrap();
            (start, format!("{:04}-{:02}", anchor.year(), anchor.month()))
        }
    };
    let count = match period_type {
        "week" => 7,
        _ => {
            let (ny, nm) = if start.month() == 12 {
                (start.year() + 1, 1)
            } else {
                (start.year(), start.month() + 1)
            };
            let next = NaiveDate::from_ymd_opt(ny, nm, 1).unwrap();
            (next - start).num_days()
        }
    };
    for i in 0..count {
        days.push((start + Duration::days(i)).format("%Y-%m-%d").to_string());
    }
    Ok((key, days))
}

pub fn get_period_view(conn: &Connection, period_type: &str, anchor_day: &str) -> Result<PeriodView> {
    let (period_key, day_keys) = period_range(period_type, anchor_day)?;
    let start = day_bounds(day_keys.first().unwrap())?.0;
    let end = day_bounds(day_keys.last().unwrap())?.1;

    let blocks = read_blocks(conn, start, end)?;
    let meetings = read_meetings(conn, start, end)?;

    // Bucket blocks by local day (keep `blocks` alive for the app rollup below).
    let mut per_day: HashMap<String, Vec<TimelineBlock>> = HashMap::new();
    for b in &blocks {
        per_day
            .entry(ms_to_day_key(b.start_ts))
            .or_default()
            .push(b.clone());
    }

    let mut days = Vec::new();
    let mut total_active = 0i64;
    let mut total_idle = 0i64;
    let mut overall: HashMap<String, (String, String, i64)> = HashMap::new();

    for day in &day_keys {
        let day_blocks = per_day.remove(day).unwrap_or_default();
        let (active, idle, cats) = totals_from_blocks(&day_blocks);
        total_active += active;
        total_idle += idle;
        for c in &cats {
            let id = c.category_id.clone().unwrap_or_else(|| "uncategorized".into());
            let e = overall
                .entry(id)
                .or_insert((c.category_name.clone(), c.category_color.clone(), 0));
            e.2 += c.active_ms;
        }
        days.push(PeriodDayBucket {
            day: day.clone(),
            active_ms: active,
            idle_ms: idle,
            meeting_ms: 0,
            categories: cats,
        });
    }

    let mut categories: Vec<CategoryTotal> = overall
        .into_iter()
        .map(|(id, (name, color, ms))| CategoryTotal {
            category_id: Some(id),
            category_name: name,
            category_color: color,
            active_ms: ms,
            share: if total_active > 0 {
                ms as f64 / total_active as f64
            } else {
                0.0
            },
        })
        .collect();
    categories.sort_by(|a, b| b.active_ms.cmp(&a.active_ms));

    let meeting_ms = meetings.iter().map(|m| (m.end_ts - m.start_ts).max(0)).sum();
    let apps = apps_from_blocks(&blocks, total_active);
    let summary = get_summary(conn, period_type, &period_key)?;

    Ok(PeriodView {
        period_type: period_type.to_string(),
        period_key,
        start_day: day_keys.first().cloned().unwrap_or_default(),
        end_day: day_keys.last().cloned().unwrap_or_default(),
        active_ms: total_active,
        idle_ms: total_idle,
        meeting_ms,
        days,
        categories,
        apps,
        summary,
    })
}

// --- summaries ---------------------------------------------------------------

pub fn get_summary(conn: &Connection, period_type: &str, period_key: &str) -> Result<Option<Summary>> {
    conn.query_row(
        "SELECT id, period_type, period_key, narrative, totals_json, model, source, generated_at
         FROM summaries WHERE deleted_at IS NULL AND period_type = ?1 AND period_key = ?2",
        params![period_type, period_key],
        |r| {
            Ok(Summary {
                id: r.get(0)?,
                period_type: r.get(1)?,
                period_key: r.get(2)?,
                narrative: r.get(3)?,
                totals_json: r.get(4)?,
                model: r.get(5)?,
                source: r.get(6)?,
                generated_at: r.get(7)?,
            })
        },
    )
    .optional()
    .map_err(AppError::from)
}

pub fn upsert_summary(conn: &Connection, device_id: &str, s: &Summary) -> Result<()> {
    let now = now_ms();
    conn.execute(
        "INSERT INTO summaries
           (id, device_id, period_type, period_key, narrative, totals_json, model, source, generated_at, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?10)
         ON CONFLICT(device_id, period_type, period_key) DO UPDATE SET
           narrative = excluded.narrative, totals_json = excluded.totals_json,
           model = excluded.model, source = excluded.source,
           generated_at = excluded.generated_at, updated_at = excluded.updated_at",
        params![
            s.id, device_id, s.period_type, s.period_key, s.narrative,
            s.totals_json, s.model, s.source, s.generated_at, now
        ],
    )?;
    Ok(())
}

// --- exclusions --------------------------------------------------------------

pub fn list_exclusions(conn: &Connection) -> Result<Vec<Exclusion>> {
    let mut stmt = conn.prepare(
        "SELECT id, match_type, pattern, note, enabled FROM exclusions
         WHERE deleted_at IS NULL ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(Exclusion {
            id: r.get(0)?,
            match_type: r.get(1)?,
            pattern: r.get(2)?,
            note: r.get(3)?,
            enabled: r.get::<_, i64>(4)? != 0,
        })
    })?;
    Ok(rows.collect::<std::result::Result<_, _>>()?)
}

pub fn add_exclusion(
    conn: &Connection,
    device_id: &str,
    match_type: &str,
    pattern: &str,
    note: Option<&str>,
) -> Result<()> {
    let now = now_ms();
    conn.execute(
        "INSERT INTO exclusions(id, device_id, match_type, pattern, note, enabled, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,1,?6,?6)",
        params![new_id(), device_id, match_type, pattern, note, now],
    )?;
    Ok(())
}

pub fn remove_exclusion(conn: &Connection, id: &str) -> Result<()> {
    conn.execute(
        "UPDATE exclusions SET deleted_at = ?2 WHERE id = ?1",
        params![id, now_ms()],
    )?;
    Ok(())
}

/// True if the activity matches any enabled exclusion (so it must NOT be recorded).
pub fn is_excluded(conn: &Connection, app_name: Option<&str>, domain: Option<&str>) -> Result<bool> {
    let app = app_name.map(|s| s.to_ascii_lowercase());
    let domain = domain.map(|s| s.to_ascii_lowercase());
    for ex in list_exclusions(conn)? {
        if !ex.enabled {
            continue;
        }
        let pat = ex.pattern.to_ascii_lowercase();
        let hit = match ex.match_type.as_str() {
            "process" => app.as_deref().map_or(false, |a| a == pat || a.contains(&pat)),
            "domain" => domain.as_deref().map_or(false, |d| d == pat || d.ends_with(&pat)),
            _ => false,
        };
        if hit {
            return Ok(true);
        }
    }
    Ok(false)
}

/// Sum of `active` session time today, for the live status pill.
pub fn today_active_ms(conn: &Connection) -> Result<i64> {
    let today = Local::now().format("%Y-%m-%d").to_string();
    let (start, end) = day_bounds(&today)?;
    let ms: Option<i64> = conn.query_row(
        "SELECT SUM(duration_ms) FROM activity_sessions
         WHERE deleted_at IS NULL AND state = 'active' AND end_ts > ?1 AND start_ts < ?2",
        params![start, end],
        |r| r.get(0),
    )?;
    Ok(ms.unwrap_or(0))
}
