pub mod encryption;
pub mod repo;

use crate::error::Result;
use rusqlite::Connection;
use rusqlite_migration::{Migrations, M};
use std::path::Path;

// The schema lives in a plain .sql file so it is easy to read/review.
const MIGRATION_0001: &str = include_str!("../../migrations/0001_init.sql");

fn migrations() -> Migrations<'static> {
    Migrations::new(vec![M::up(MIGRATION_0001)])
}

/// Open the encrypted SQLite database, applying the SQLCipher key, pragmas and
/// any pending migrations. The key is loaded/created via DPAPI.
pub fn open_encrypted(db_path: &Path, key_path: &Path) -> Result<Connection> {
    let key = encryption::load_or_create_key(key_path)?;
    let hex = encryption::key_hex(&key);

    let mut conn = Connection::open(db_path)?;
    // PRAGMA key MUST be the very first statement on the connection.
    conn.pragma_update(None, "key", format!("x'{}'", &*hex))?;
    // Force SQLCipher to validate the key; errors here mean a wrong key / bad file.
    conn.query_row("SELECT count(*) FROM sqlite_master", [], |_row| Ok(()))?;

    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;

    migrations().to_latest(&mut conn)?;
    Ok(conn)
}
