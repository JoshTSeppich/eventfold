use serde::{Deserialize, Serialize};
use crate::credentials::get_credential;

#[derive(Serialize, Deserialize, Clone)]
pub struct IssuePayload {
    pub title: String,
    pub body: String,
    pub area: String,
    pub acceptance_criteria: Vec<String>,
    pub dependencies: Vec<String>,
}

#[derive(Serialize)]
pub struct IssueResult {
    pub title: String,
    pub status: String,
    pub url: Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn create_github_issues(
    owner: String,
    repo_name: String,
    issues: Vec<IssuePayload>,
) -> Result<Vec<IssueResult>, String> {
    let pat = get_credential("github_pat".to_string())?
        .filter(|s| !s.is_empty())
        .ok_or("GitHub PAT not set — add it in Settings")?;

    let client = reqwest::Client::new();
    let url    = format!("https://api.github.com/repos/{}/{}/issues", owner, repo_name);
    let mut results = Vec::new();

    for issue in &issues {
        // Build body with acceptance criteria and dependencies
        let mut full_body = issue.body.clone();
        if !issue.acceptance_criteria.is_empty() {
            full_body.push_str("\n\n## Acceptance Criteria\n");
            for ac in &issue.acceptance_criteria {
                full_body.push_str(&format!("- [ ] {}\n", ac));
            }
        }
        if !issue.dependencies.is_empty() {
            full_body.push_str("\n## Dependencies\n");
            for dep in &issue.dependencies {
                full_body.push_str(&format!("- {}\n", dep));
            }
        }

        let body = serde_json::json!({ "title": issue.title, "body": full_body });
        let resp = client
            .post(&url)
            .header("Authorization", format!("Bearer {}", pat))
            .header("User-Agent", "eventfold")
            .header("Content-Type", "application/json")
            .header("Accept", "application/vnd.github+json")
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let status = resp.status();
        let json: serde_json::Value = resp.json().await.unwrap_or_default();

        if status == 201 {
            results.push(IssueResult {
                title: issue.title.clone(),
                status: "success".into(),
                url: json["html_url"].as_str().map(String::from),
                error: None,
            });
        } else {
            let msg = match status.as_u16() {
                401 => "Authentication failed — check your GitHub PAT".into(),
                403 => "Permission denied — ensure your PAT has repo scope".into(),
                404 => "Repository not found".into(),
                422 => "GitHub rejected the issue — check title/body".into(),
                _   => format!("GitHub error {}", status),
            };
            results.push(IssueResult {
                title: issue.title.clone(),
                status: "error".into(),
                url: None,
                error: Some(msg),
            });
        }
    }
    Ok(results)
}
