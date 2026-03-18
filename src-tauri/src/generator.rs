use serde::{Deserialize, Serialize};
use crate::credentials::get_credential;

const MODEL:   &str = "claude-sonnet-4-6";
const TIMEOUT: u64  = 90;

#[derive(Serialize, Deserialize)]
pub struct FeatureBrief {
    pub feature_name: String,
    pub summary:      String,
    pub problem:      String,
    pub goals:        Vec<String>,
    pub non_goals:    Vec<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct IssuePayload {
    pub title:               String,
    pub body:                String,
    pub area:                String,
    pub acceptance_criteria: Vec<String>,
    pub dependencies:        Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct GenerationOutput {
    pub brief:  FeatureBrief,
    pub issues: Vec<IssuePayload>,
}

fn system_prompt(owner: &str, repo: &str) -> String {
    format!(
        r#"You are a senior software architect generating structured feature tickets for the GitHub repo {owner}/{repo}.

Return ONLY valid JSON — no markdown, no code fences, no preamble.

Schema:
{{
  "brief": {{
    "feature_name": "concise name",
    "summary": "1-2 sentence overview",
    "problem": "what problem this solves",
    "goals": ["goal 1", "goal 2"],
    "non_goals": ["out of scope item"]
  }},
  "issues": [
    {{
      "title": "50-80 char action-oriented title",
      "body": "3+ paragraphs: what, why, how",
      "area": "Backend|Frontend|Database|Integration|Testing|Infrastructure",
      "acceptance_criteria": ["concrete testable criterion"],
      "dependencies": ["Issue title this depends on"]
    }}
  ]
}}

Rules:
- 4–8 issues ordered by dependency
- Acceptance criteria must be concrete and testable
- Issue body minimum 3 paragraphs
- Dependencies reference other issue titles in this set
"#,
        owner = owner, repo = repo
    )
}

#[tauri::command]
pub async fn generate_feature_request(
    owner: String,
    repo_name: String,
    idea: String,
) -> Result<GenerationOutput, String> {
    let api_key = get_credential("anthropic_key".to_string())?
        .filter(|s| !s.is_empty())
        .ok_or("Anthropic API key not set — add it in Settings")?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(TIMEOUT))
        .build()
        .map_err(|e| e.to_string())?;

    let body = serde_json::json!({
        "model": MODEL,
        "max_tokens": 8192,
        "system": system_prompt(&owner, &repo_name),
        "messages": [{ "role": "user", "content": idea }]
    });

    let resp: serde_json::Value = client
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

    let raw = resp["content"][0]["text"]
        .as_str()
        .ok_or_else(|| format!("Unexpected response: {}", resp))?;

    let cleaned = raw
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    serde_json::from_str::<GenerationOutput>(cleaned)
        .map_err(|e| format!("Parse error: {} — raw: {}", e, &cleaned[..cleaned.len().min(300)]))
}
