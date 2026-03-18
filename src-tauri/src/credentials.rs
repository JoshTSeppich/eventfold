use keyring::Entry;

const SERVICE: &str = "eventfold";

#[tauri::command]
pub fn save_credential(key: String, value: String) -> Result<(), String> {
    let entry = Entry::new(SERVICE, &key).map_err(|e| e.to_string())?;
    if value.is_empty() {
        let _ = entry.delete_credential();
    } else {
        entry.set_password(&value).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_credential(key: String) -> Result<Option<String>, String> {
    let entry = Entry::new(SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(v)                                => Ok(Some(v)),
        Err(keyring::Error::NoEntry)         => Ok(None),
        Err(keyring::Error::NoStorageAccess(_)) => Ok(None),
        Err(e)                               => Err(e.to_string()),
    }
}
