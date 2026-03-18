mod credentials;
mod repos;
mod generator;
mod github;

use repos::DbConn;
use rusqlite::Connection;
use std::sync::Mutex;
use serde_json::Value;

// ─── Core API commands ──────────────────────────────────────────────────────

#[tauri::command]
async fn anthropic_chat(
    api_key: String,
    model: String,
    system: String,
    user_message: String,
    max_tokens: u32,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": model,
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{ "role": "user", "content": user_message }]
    });

    let resp: Value = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    if let Some(err) = resp.get("error") {
        return Err(err["message"].as_str().unwrap_or("Anthropic error").to_string());
    }

    resp["content"][0]["text"]
        .as_str()
        .map(String::from)
        .ok_or_else(|| format!("Unexpected response: {}", resp))
}

#[tauri::command]
async fn apollo_people_search(
    api_key: String,
    filters: Value,
    person_titles: Vec<String>,
    seniority_levels: Vec<String>,
    page: Option<u32>,
    per_page: Option<u32>,
) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let mut body = serde_json::json!({
        "page":     page.unwrap_or(1),
        "per_page": per_page.unwrap_or(25),
        "person_titles": person_titles,
    });

    // Merge filters into body
    if let Value::Object(map) = &filters {
        for (k, v) in map {
            body[k] = v.clone();
        }
    }
    if !seniority_levels.is_empty() {
        body["person_seniorities"] = serde_json::json!(seniority_levels);
    }

    let resp: Value = client
        .post("https://api.apollo.io/v1/people/search")
        .header("X-Api-Key", &api_key)
        .header("Content-Type", "application/json")
        .header("Cache-Control", "no-cache")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    if let Some(err) = resp.get("error") {
        return Err(err.as_str()
            .or_else(|| resp["message"].as_str())
            .unwrap_or("Apollo error")
            .to_string());
    }
    Ok(resp)
}

#[tauri::command]
async fn apollo_bulk_match(api_key: String, details: Vec<Value>) -> Result<Value, String> {
    let client = reqwest::Client::new();
    // Strip null values from each detail object
    let clean: Vec<Value> = details.iter().map(|d| {
        if let Value::Object(map) = d {
            Value::Object(map.iter()
                .filter(|(_, v)| !v.is_null())
                .map(|(k, v)| (k.clone(), v.clone()))
                .collect())
        } else { d.clone() }
    }).collect();

    let body = serde_json::json!({ "details": clean, "reveal_personal_emails": false });

    let resp: Value = client
        .post("https://api.apollo.io/v1/people/bulk_match")
        .header("X-Api-Key", &api_key)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    Ok(resp)
}

#[tauri::command]
fn cache_apollo_contacts(contacts: Vec<serde_json::Value>, state: tauri::State<'_, DbConn>) -> Result<usize, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    let mut count = 0usize;
    for contact in &contacts {
        let apollo_id = contact.get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if apollo_id.is_empty() { continue; }
        let data = serde_json::to_string(contact).map_err(|e| e.to_string())?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        db.execute(
            "INSERT OR REPLACE INTO apollo_contact_cache (apollo_id, data, cached_at) VALUES (?1, ?2, ?3)",
            rusqlite::params![apollo_id, data, now],
        ).map_err(|e| e.to_string())?;
        count += 1;
    }
    Ok(count)
}

#[tauri::command]
fn get_cached_apollo_ids(state: tauri::State<'_, DbConn>) -> Result<Vec<String>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = db.prepare("SELECT apollo_id FROM apollo_contact_cache")
        .map_err(|e| e.to_string())?;
    let ids: Vec<String> = stmt.query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(ids)
}

#[tauri::command]
fn get_cached_apollo_contacts(ids: Vec<String>, state: tauri::State<'_, DbConn>) -> Result<Vec<serde_json::Value>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    let mut results = Vec::new();
    for id in &ids {
        let row: rusqlite::Result<String> = db.query_row(
            "SELECT data FROM apollo_contact_cache WHERE apollo_id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        );
        if let Ok(data) = row {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&data) {
                results.push(val);
            }
        }
    }
    Ok(results)
}

#[tauri::command]
fn add_to_suppress_list(entry: String, entry_type: String, state: tauri::State<'_, DbConn>) -> Result<String, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    let id = format!("sup-{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0));
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    db.execute(
        "INSERT OR IGNORE INTO suppress_list (id, entry, entry_type, created_at) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![id, entry.to_lowercase(), entry_type, now],
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn remove_from_suppress_list(id: String, state: tauri::State<'_, DbConn>) -> Result<(), String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM suppress_list WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_suppress_list(state: tauri::State<'_, DbConn>) -> Result<Vec<serde_json::Value>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = db.prepare("SELECT id, entry, entry_type, created_at FROM suppress_list ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let rows: Vec<serde_json::Value> = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, i64>(3)?,
        ))
    })
    .map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .map(|(id, entry, entry_type, created_at)| serde_json::json!({
        "id": id, "entry": entry, "entry_type": entry_type, "created_at": created_at
    }))
    .collect();
    Ok(rows)
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| e.to_string())
}

// ─── App entry ──────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_path = dirs::data_dir()
        .map(|p: std::path::PathBuf| p.join("dev.foxworks.eventfold").join("eventfold.db"))
        .and_then(|p: std::path::PathBuf| {
            std::fs::create_dir_all(p.parent().unwrap()).ok()?;
            Some(p)
        });

    let conn = match db_path {
        Some(path) => Connection::open(path).unwrap_or_else(|_| Connection::open_in_memory().unwrap()),
        None       => Connection::open_in_memory().unwrap(),
    };
    repos::init_db(&conn).expect("DB init failed");

    tauri::Builder::default()
        .manage(DbConn(Mutex::new(conn)))
        .invoke_handler(tauri::generate_handler![
            anthropic_chat,
            apollo_people_search,
            apollo_bulk_match,
            cache_apollo_contacts,
            get_cached_apollo_ids,
            get_cached_apollo_contacts,
            add_to_suppress_list,
            remove_from_suppress_list,
            get_suppress_list,
            open_url,
            credentials::save_credential,
            credentials::get_credential,
            repos::list_saved_repos,
            repos::upsert_saved_repo,
            repos::delete_saved_repo,
            generator::generate_feature_request,
            github::create_github_issues,
        ])
        .run(tauri::generate_context!())
        .expect("error while running EventFold");
}
