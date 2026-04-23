use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AlaqHttpError {
    #[error("HTTP error: {status} - {code}: {message}")]
    Api {
        status: u16,
        code: String,
        message: String,
    },
    #[error("Transport error: {0}")]
    Transport(#[from] reqwest::Error),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

pub struct HttpClient {
    client: reqwest::Client,
    base_url: String,
    token: Option<String>,
}

impl HttpClient {
    pub fn new(base_url: String) -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
            token: None,
        }
    }

    pub fn with_token(mut self, token: String) -> Self {
        self.token = Some(token);
        self
    }

    pub async fn call_action<I, O>(&self, action_name: &str, input: I) -> Result<O, AlaqHttpError>
    where
        I: Serialize,
        O: for<'de> Deserialize<'de>,
    {
        let url = format!("{}/{}", self.base_url, action_name);
        let mut request = self.client.post(&url).json(&serde_json::json!({ "input": input }));

        if let Some(token) = &self.token {
            request = request.bearer_auth(token);
        }

        let response = request.send().await?;

        if !response.status().is_success() {
            let status = response.status().as_u16();
            let error_body: serde_json::Value = response.json().await.unwrap_or_default();
            
            let code = error_body["code"]
                .as_str()
                .unwrap_or("INTERNAL_ERROR")
                .to_string();
            
            let message = error_body["message"]
                .as_str()
                .or_else(|| error_body["error"].as_str())
                .unwrap_or("Unknown error")
                .to_string();

            return Err(AlaqHttpError::Api { status, code, message });
        }

        if response.status() == reqwest::StatusCode::ACCEPTED {
            // For void/202 responses
            return serde_json::from_value(serde_json::Value::Null).map_err(Into::into);
        }

        Ok(response.json().await?)
    }
}
