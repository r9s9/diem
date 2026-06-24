//! Seals the random 32-byte SQLCipher key to the current Windows user via DPAPI
//! (CryptProtectData), storing the opaque blob in a file next to the database.
//! Only this Windows user on this machine can unseal it. The plaintext key and its
//! hex form are wrapped in `Zeroizing` so they are scrubbed from memory on drop.
use crate::error::{AppError, Result};
use std::path::Path;
use std::slice;
use zeroize::Zeroizing;
use windows::Win32::Foundation::{LocalFree, HLOCAL};
use windows::Win32::Security::Cryptography::{
    CryptProtectData, CryptUnprotectData, CRYPT_INTEGER_BLOB,
};

fn blob(data: &mut [u8]) -> CRYPT_INTEGER_BLOB {
    CRYPT_INTEGER_BLOB {
        cbData: data.len() as u32,
        pbData: data.as_mut_ptr(),
    }
}

fn seal(plain: &mut [u8]) -> Result<Vec<u8>> {
    let in_blob = blob(plain);
    let mut out = CRYPT_INTEGER_BLOB::default();
    unsafe {
        CryptProtectData(&in_blob, None, None, None, None, 0, &mut out)
            .map_err(|e| AppError::Other(format!("DPAPI seal failed: {e}")))?;
        let sealed = slice::from_raw_parts(out.pbData, out.cbData as usize).to_vec();
        let _ = LocalFree(Some(HLOCAL(out.pbData as *mut _)));
        Ok(sealed)
    }
}

fn unseal(sealed: &mut [u8]) -> Result<Vec<u8>> {
    let in_blob = blob(sealed);
    let mut out = CRYPT_INTEGER_BLOB::default();
    unsafe {
        CryptUnprotectData(&in_blob, None, None, None, None, 0, &mut out)
            .map_err(|e| AppError::Other(format!("DPAPI unseal failed: {e}")))?;
        let key = slice::from_raw_parts(out.pbData, out.cbData as usize).to_vec();
        let _ = LocalFree(Some(HLOCAL(out.pbData as *mut _)));
        Ok(key)
    }
}

/// Load the sealed key from disk, or generate + seal a fresh one on first run.
pub fn load_or_create_key(key_path: &Path) -> Result<Zeroizing<[u8; 32]>> {
    if key_path.exists() {
        let mut sealed = std::fs::read(key_path)?;
        let raw = unseal(&mut sealed)?;
        if raw.len() != 32 {
            return Err(AppError::msg("sealed key has unexpected length"));
        }
        let mut k = [0u8; 32];
        k.copy_from_slice(&raw);
        Ok(Zeroizing::new(k))
    } else {
        let mut k = [0u8; 32];
        getrandom::fill(&mut k).map_err(|e| AppError::Other(format!("rng failure: {e}")))?;
        let mut k_copy = k;
        let sealed = seal(&mut k_copy)?;
        std::fs::write(key_path, sealed)?;
        Ok(Zeroizing::new(k))
    }
}

/// Hex-encode the key for use in `PRAGMA key = "x'...'"` (raw key, no PBKDF2).
pub fn key_hex(key: &[u8; 32]) -> Zeroizing<String> {
    let mut s = String::with_capacity(64);
    for b in key {
        s.push_str(&format!("{:02x}", b));
    }
    Zeroizing::new(s)
}
