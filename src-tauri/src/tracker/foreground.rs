//! Reads the current foreground window's title and owning process.
use windows::core::PWSTR;
use windows::Win32::Foundation::CloseHandle;
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT,
    PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId,
};

#[derive(Debug, Clone)]
pub struct Foreground {
    pub process_path: Option<String>,
    pub process_name: Option<String>,
    pub title: Option<String>,
}

pub fn foreground() -> Option<Foreground> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return None;
        }

        // Window title
        let len = GetWindowTextLengthW(hwnd);
        let title = if len > 0 {
            let mut buf = vec![0u16; (len + 1) as usize];
            let n = GetWindowTextW(hwnd, &mut buf);
            if n > 0 {
                Some(String::from_utf16_lossy(&buf[..n as usize]))
            } else {
                None
            }
        } else {
            None
        };

        // Owning process -> full image path + base exe name
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid as *mut u32));
        let (process_path, process_name) = if pid != 0 {
            match OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) {
                Ok(handle) => {
                    let mut buf = vec![0u16; 1024];
                    let mut size = buf.len() as u32;
                    let ok = QueryFullProcessImageNameW(
                        handle,
                        PROCESS_NAME_FORMAT(0),
                        PWSTR(buf.as_mut_ptr()),
                        &mut size,
                    )
                    .is_ok();
                    let _ = CloseHandle(handle);
                    if ok {
                        let full = String::from_utf16_lossy(&buf[..size as usize]);
                        let name = full
                            .rsplit(['\\', '/'])
                            .next()
                            .map(|s| s.to_string());
                        (Some(full), name)
                    } else {
                        (None, None)
                    }
                }
                Err(_) => (None, None),
            }
        } else {
            (None, None)
        };

        Some(Foreground {
            process_path,
            process_name,
            title,
        })
    }
}
