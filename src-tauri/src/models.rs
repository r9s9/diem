//! Serde models shared with the React frontend. `rename_all = "camelCase"` makes the
//! JSON match `src/lib/types.ts` exactly. Timestamps are Unix epoch milliseconds (i64).
use serde::{Deserialize, Serialize};

pub type EpochMs = i64;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String,
    pub color: String,
    pub icon: Option<String>,
    pub is_billable: bool,
    pub is_idle: bool,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineBlock {
    pub start_ts: EpochMs,
    pub end_ts: EpochMs,
    pub duration_ms: i64,
    pub state: String,
    pub label: String,
    pub app_name: Option<String>,
    pub category_id: Option<String>,
    pub category_name: Option<String>,
    pub category_color: Option<String>,
    pub url_domain: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OnOffBand {
    pub start_ts: EpochMs,
    pub end_ts: EpochMs,
    pub kind: String, // on | idle | locked | off
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryTotal {
    pub category_id: Option<String>,
    pub category_name: String,
    pub category_color: String,
    pub active_ms: i64,
    pub share: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUsage {
    pub app_name: String,
    pub active_ms: i64,
    pub category_name: Option<String>,
    pub category_color: Option<String>,
    pub share: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEvent {
    pub id: String,
    pub external_id: Option<String>,
    pub subject: Option<String>,
    pub start_ts: EpochMs,
    pub end_ts: EpochMs,
    pub is_all_day: bool,
    pub is_online: bool,
    pub online_provider: Option<String>,
    pub organizer_name: Option<String>,
    pub organizer_email: Option<String>,
    pub attendee_count: Option<i64>,
    pub show_as: Option<String>,
    pub location: Option<String>,
    pub web_link: Option<String>,
    pub attended: Option<bool>,
    pub category_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Summary {
    pub id: String,
    pub period_type: String,
    pub period_key: String,
    pub narrative: String,
    pub totals_json: Option<String>,
    pub model: Option<String>,
    pub source: String,
    pub generated_at: EpochMs,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DayView {
    pub day: String,
    pub first_activity_ts: Option<EpochMs>,
    pub last_activity_ts: Option<EpochMs>,
    pub active_ms: i64,
    pub idle_ms: i64,
    pub on_ms: i64,
    pub meeting_ms: i64,
    pub blocks: Vec<TimelineBlock>,
    pub bands: Vec<OnOffBand>,
    pub categories: Vec<CategoryTotal>,
    pub apps: Vec<AppUsage>,
    pub meetings: Vec<CalendarEvent>,
    pub summary: Option<Summary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PeriodDayBucket {
    pub day: String,
    pub active_ms: i64,
    pub idle_ms: i64,
    pub meeting_ms: i64,
    pub categories: Vec<CategoryTotal>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PeriodView {
    pub period_type: String,
    pub period_key: String,
    pub start_day: String,
    pub end_day: String,
    pub active_ms: i64,
    pub idle_ms: i64,
    pub meeting_ms: i64,
    pub days: Vec<PeriodDayBucket>,
    pub categories: Vec<CategoryTotal>,
    pub apps: Vec<AppUsage>,
    pub summary: Option<Summary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Exclusion {
    pub id: String,
    pub match_type: String,
    pub pattern: String,
    pub note: Option<String>,
    pub enabled: bool,
}

// --- Settings (nested, mirrors TS Settings) ---------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackingSettings {
    pub enabled: bool,
    pub poll_interval_ms: i64,
    pub idle_threshold_sec: i64,
    pub capture_browser_urls: bool,
    pub capture_doc_names: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSettings {
    pub local_enabled: bool,
    pub ollama_model: String,
    pub cloud_summaries_enabled: bool,
    pub cloud_send_detail: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarSettings {
    pub connected: bool,
    pub account: Option<String>,
    pub sync_interval_min: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupSettings {
    pub autostart: bool,
    pub start_minimized: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub tracking: TrackingSettings,
    pub ai: AiSettings,
    pub calendar: CalendarSettings,
    pub startup: StartupSettings,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            tracking: TrackingSettings {
                enabled: true,
                poll_interval_ms: 2000,
                idle_threshold_sec: 90,
                capture_browser_urls: false,
                capture_doc_names: true,
            },
            ai: AiSettings {
                local_enabled: true,
                ollama_model: "llama3.2:3b".into(),
                cloud_summaries_enabled: false,
                cloud_send_detail: false,
            },
            calendar: CalendarSettings {
                connected: false,
                account: None,
                sync_interval_min: 30,
            },
            startup: StartupSettings {
                autostart: true,
                start_minimized: true,
            },
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackingStatus {
    pub running: bool,
    pub paused: bool,
    pub current_app: Option<String>,
    pub current_title: Option<String>,
    pub state: String,
    pub today_active_ms: i64,
    pub last_flush_ts: Option<EpochMs>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaStatus {
    pub installed: bool,
    pub running: bool,
    pub models: Vec<String>,
    pub recommended_model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarStatus {
    pub connected: bool,
    pub account: Option<String>,
    pub last_sync_ts: Option<EpochMs>,
}

/// What the tracker is currently observing (held in memory, not the DB).
#[derive(Debug, Clone)]
pub struct CurrentActivity {
    pub app_name: Option<String>,
    pub process_path: Option<String>,
    pub window_title: Option<String>,
    pub state: String,
    pub since_ts: EpochMs,
}
