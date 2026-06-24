//! Narrative summaries. v1 ships a deterministic on-device generator; the local
//! Ollama path and the opt-in Claude path attach here in later phases.
use crate::models::CategoryTotal;

fn fmt_dur(ms: i64) -> String {
    let m = (ms / 60_000).max(0);
    let h = m / 60;
    let mm = m % 60;
    if h == 0 {
        format!("{mm}m")
    } else if mm == 0 {
        format!("{h}h")
    } else {
        format!("{h}h {mm}m")
    }
}

/// Build a plain-language recap from aggregated totals — privacy-safe and offline.
pub fn local_narrative(
    period_label: &str,
    active_ms: i64,
    meeting_count: usize,
    categories: &[CategoryTotal],
) -> String {
    if active_ms == 0 && categories.is_empty() {
        return format!("No tracked activity for {period_label} yet.");
    }
    let mut parts: Vec<String> = Vec::new();
    parts.push(format!("{} of tracked work {}", fmt_dur(active_ms), period_label));

    let top: Vec<String> = categories
        .iter()
        .take(3)
        .map(|c| format!("{} ({})", c.category_name.to_lowercase(), fmt_dur(c.active_ms)))
        .collect();
    if !top.is_empty() {
        parts.push(format!("mostly {}", top.join(", ")));
    }
    if meeting_count > 0 {
        parts.push(format!(
            "{} meeting{} attended",
            meeting_count,
            if meeting_count == 1 { "" } else { "s" }
        ));
    }
    format!(
        "{}. Generated locally on this device — review and edit before adding to your timesheet.",
        parts.join("; ")
    )
}
