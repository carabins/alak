//! ActionContext — per-request metadata for generated action handlers.
//!
//! Extracted via [`axum::extract::FromRequestParts`] so generated dispatcher
//! signatures can take it as a plain argument:
//!
//! ```ignore
//! async fn dispatch_packages<H: Handlers>(
//!     State(state): State<AppState<H>>,
//!     ctx: ActionContext,
//!     Json(input): Json<PackagesInput>,
//! ) -> Result<Json<PackagesOutput>, HandlerError> { ... }
//! ```
//!
//! Header conventions (all optional):
//!   * `X-Trace-Id`  — request trace id. When absent, a fresh v4 UUID is
//!     generated so every request carries an id downstream.
//!   * `X-Peer-Id`   — logical peer / client identifier. Passed through
//!     verbatim (trimmed) when present.
//!   * `X-Admin-Key` — when present *and non-empty*, sets `admin = true`.
//!     Verification of the key itself happens in middleware — this extractor
//!     only reports "a key was asserted". Generators that need admin-gated
//!     routes should pair a middleware that 401s on mismatch with this flag.

use axum::extract::FromRequestParts;
use http::request::Parts;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::HandlerError;

/// Per-request context passed to every generated action handler.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionContext {
    /// Trace id — mirrors `X-Trace-Id` header when provided, otherwise a
    /// freshly generated v4 UUID.
    pub trace_id: Uuid,
    /// Logical peer id — from `X-Peer-Id` header. `None` when the caller
    /// chose not to identify itself.
    pub peer: Option<String>,
    /// `true` when `X-Admin-Key` is present and non-empty. Presence only —
    /// actual key verification is middleware's job.
    pub admin: bool,
}

impl ActionContext {
    /// Construct an anonymous context — used as a fallback when header parsing
    /// fails in a way that doesn't warrant a hard reject (never today; kept
    /// for future extensibility).
    pub fn anonymous() -> Self {
        Self {
            trace_id: Uuid::new_v4(),
            peer: None,
            admin: false,
        }
    }
}

impl<S> FromRequestParts<S> for ActionContext
where
    S: Send + Sync,
{
    type Rejection = HandlerError;

    async fn from_request_parts(
        parts: &mut Parts,
        _state: &S,
    ) -> Result<Self, Self::Rejection> {
        let headers = &parts.headers;

        let trace_id = headers
            .get("x-trace-id")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| Uuid::parse_str(s.trim()).ok())
            .unwrap_or_else(Uuid::new_v4);

        let peer = headers
            .get("x-peer-id")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        let admin = headers
            .get("x-admin-key")
            .and_then(|v| v.to_str().ok())
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false);

        Ok(ActionContext {
            trace_id,
            peer,
            admin,
        })
    }
}
