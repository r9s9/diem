-- diem — initial schema (v1)
--
-- Conventions:
--   * All ids are UUID strings (TEXT).
--   * All timestamps are Unix epoch MILLISECONDS in UTC (INTEGER).
--   * Every user-data row is SYNC-READY: id, device_id, created_at, updated_at,
--     deleted_at (NULL = live; non-NULL = soft-deleted). This lets an optional
--     end-to-end-encrypted sync be layered on later with no schema change.
--   * `settings` is intentionally simple key/value (not synced the same way).

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- settings: simple local key/value (value is JSON text)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

-- ---------------------------------------------------------------------------
-- categories: the work buckets shown in the UI
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id          TEXT PRIMARY KEY,
    device_id   TEXT NOT NULL,
    name        TEXT NOT NULL,
    color       TEXT NOT NULL,            -- hex, e.g. #4F46E5
    icon        TEXT,                     -- optional icon key
    is_billable INTEGER NOT NULL DEFAULT 1,
    is_idle     INTEGER NOT NULL DEFAULT 0, -- marks the "off"/break bucket
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    deleted_at  INTEGER
);

-- ---------------------------------------------------------------------------
-- category_rules: deterministic process/domain/title -> category mapping
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS category_rules (
    id          TEXT PRIMARY KEY,
    device_id   TEXT NOT NULL,
    match_type  TEXT NOT NULL,            -- 'process' | 'domain' | 'title_regex' | 'app'
    pattern     TEXT NOT NULL,            -- lowercased match value or regex
    category_id TEXT NOT NULL REFERENCES categories(id),
    priority    INTEGER NOT NULL DEFAULT 100, -- lower = checked first
    source      TEXT NOT NULL DEFAULT 'builtin', -- 'builtin' | 'user' | 'ai'
    enabled     INTEGER NOT NULL DEFAULT 1,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    deleted_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_rules_match ON category_rules(match_type, pattern);

-- ---------------------------------------------------------------------------
-- activity_sessions: the durable, aggregated record of what you did
-- (raw high-frequency polls are aggregated into contiguous sessions in memory)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_sessions (
    id              TEXT PRIMARY KEY,
    device_id       TEXT NOT NULL,
    start_ts        INTEGER NOT NULL,     -- epoch ms
    end_ts          INTEGER NOT NULL,     -- epoch ms
    duration_ms     INTEGER NOT NULL,
    state           TEXT NOT NULL,        -- 'active' | 'idle' | 'locked' | 'away'
    app_name        TEXT,                 -- exe base name, e.g. Code.exe
    process_path    TEXT,
    window_title    TEXT,
    url_domain      TEXT,                 -- registrable domain (eTLD+1)
    url_full        TEXT,                 -- only populated if user opts in
    doc_name        TEXT,                 -- parsed from window title
    category_id     TEXT REFERENCES categories(id),
    category_source TEXT,                 -- 'rule' | 'ai' | 'user' | NULL
    confidence      REAL,                 -- 0..1 when category_source = 'ai'
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    deleted_at      INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sessions_start   ON activity_sessions(start_ts);
CREATE INDEX IF NOT EXISTS idx_sessions_cat     ON activity_sessions(category_id);
CREATE INDEX IF NOT EXISTS idx_sessions_state   ON activity_sessions(state);

-- ---------------------------------------------------------------------------
-- system_events: lock/unlock/suspend/resume/startup -> true machine on/off
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_events (
    id         TEXT PRIMARY KEY,
    device_id  TEXT NOT NULL,
    kind       TEXT NOT NULL,             -- 'lock'|'unlock'|'suspend'|'resume'|'startup'|'shutdown'
    ts         INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sysevents_ts ON system_events(ts);

-- ---------------------------------------------------------------------------
-- calendar_events: Outlook/Teams meetings pulled from Microsoft Graph
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendar_events (
    id               TEXT PRIMARY KEY,
    device_id        TEXT NOT NULL,
    external_id      TEXT,                -- Graph event id (unique per device)
    subject          TEXT,
    start_ts         INTEGER NOT NULL,
    end_ts           INTEGER NOT NULL,
    is_all_day       INTEGER NOT NULL DEFAULT 0,
    is_online        INTEGER NOT NULL DEFAULT 0, -- isOnlineMeeting
    online_provider  TEXT,                -- e.g. teamsForBusiness
    organizer_name   TEXT,
    organizer_email  TEXT,
    attendee_count   INTEGER,
    show_as          TEXT,                -- busy/free/tentative/oof
    location         TEXT,
    web_link         TEXT,
    attended         INTEGER,             -- correlation: was Teams foreground during slot
    category_id      TEXT REFERENCES categories(id),
    created_at       INTEGER NOT NULL,
    updated_at       INTEGER NOT NULL,
    deleted_at       INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cal_external ON calendar_events(device_id, external_id);
CREATE INDEX IF NOT EXISTS idx_cal_start ON calendar_events(start_ts);

-- ---------------------------------------------------------------------------
-- summaries: AI narratives per day / week / month (local or opt-in cloud)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS summaries (
    id           TEXT PRIMARY KEY,
    device_id    TEXT NOT NULL,
    period_type  TEXT NOT NULL,           -- 'day' | 'week' | 'month'
    period_key   TEXT NOT NULL,           -- 'YYYY-MM-DD' | 'YYYY-Www' | 'YYYY-MM'
    narrative    TEXT NOT NULL,
    totals_json  TEXT,                    -- per-category totals snapshot
    model        TEXT,                    -- e.g. llama3.2:3b or claude-...
    source       TEXT NOT NULL DEFAULT 'local', -- 'local' | 'cloud'
    generated_at INTEGER NOT NULL,
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL,
    deleted_at   INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_summaries_period
    ON summaries(device_id, period_type, period_key);

-- ---------------------------------------------------------------------------
-- exclusions: apps/domains diem must never record
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exclusions (
    id         TEXT PRIMARY KEY,
    device_id  TEXT NOT NULL,
    match_type TEXT NOT NULL,             -- 'process' | 'domain' | 'title_regex'
    pattern    TEXT NOT NULL,
    note       TEXT,
    enabled    INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
);

-- ---------------------------------------------------------------------------
-- ai_classifications: cache of LLM categorizations keyed by app+normalized title
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_classifications (
    cache_key   TEXT PRIMARY KEY,         -- e.g. "app|normalized-title"
    category_id TEXT NOT NULL REFERENCES categories(id),
    confidence  REAL NOT NULL,
    model       TEXT,
    created_at  INTEGER NOT NULL
);
