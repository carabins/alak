//! HandlerError — typed error for generated `Handlers` impls.
//!
//! Generated `trait Handlers` methods return `Result<T, HandlerError>`. The
//! generated dispatcher propagates the error; `IntoResponse` turns it into
//! a JSON body `{ "error": "...", "code": "..." }` with a matching HTTP
//! status.
//!
//! Status mapping (v0.1):
//!   * `BadRequest`   → 400
//!   * `NotFound`     → 404
//!   * `Unauthorized` → 401
//!   * `Forbidden`    → 403
//!   * `Internal`     → 500
//!
//! The body is stable so a typed TS client can pattern-match on `code`.

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use thiserror::Error;

/// Typed error returned by generated handlers.
#[derive(Debug, Error)]
pub enum HandlerError {
    /// Input failed validation. Message is shown to the caller.
    #[error("bad request: {0}")]
    BadRequest(String),

    /// Target resource does not exist.
    #[error("not found")]
    NotFound,

    /// Authentication required or authentication credentials invalid.
    #[error("unauthorized")]
    Unauthorized,

    /// Authenticated, but the caller is not permitted to perform this action.
    #[error("forbidden")]
    Forbidden,

    /// Unexpected server-side failure. Message is logged; a generic response
    /// body is returned so internals don't leak to the client.
    #[error("internal error: {0}")]
    Internal(String),
}

impl HandlerError {
    /// Convenience for `HandlerError::BadRequest(...)` from any `Display`.
    pub fn bad<S: Into<String>>(msg: S) -> Self {
        HandlerError::BadRequest(msg.into())
    }

    /// Convenience for `HandlerError::Internal(...)` from any `Display`.
    pub fn internal<S: Into<String>>(msg: S) -> Self {
        HandlerError::Internal(msg.into())
    }

    fn status_and_code(&self) -> (StatusCode, &'static str) {
        match self {
            HandlerError::BadRequest(_) => (StatusCode::BAD_REQUEST, "bad_request"),
            HandlerError::NotFound => (StatusCode::NOT_FOUND, "not_found"),
            HandlerError::Unauthorized => (StatusCode::UNAUTHORIZED, "unauthorized"),
            HandlerError::Forbidden => (StatusCode::FORBIDDEN, "forbidden"),
            HandlerError::Internal(_) => (StatusCode::INTERNAL_SERVER_ERROR, "internal"),
        }
    }
}

#[derive(Debug, Serialize)]
struct ErrorBody<'a> {
    error: &'a str,
    code: &'a str,
}

impl IntoResponse for HandlerError {
    fn into_response(self) -> Response {
        let (status, code) = self.status_and_code();
        // For `Internal` we intentionally mask the raw message; logs carry the
        // detail. Other variants show their Display form — matches the code.
        let msg = match &self {
            HandlerError::Internal(_) => "internal error".to_string(),
            other => other.to_string(),
        };
        (
            status,
            Json(ErrorBody {
                error: &msg,
                code,
            }),
        )
            .into_response()
    }
}
