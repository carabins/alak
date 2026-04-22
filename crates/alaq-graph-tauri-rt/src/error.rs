//! Error type shared by every generated namespace.
//!
//! Historically the generator (`@alaq/graph-tauri-rs`) emitted a
//! namespace-local `AppError` enum into each `types.rs`. That produced N
//! identical copies across a consumer with N namespaces. C3 moved the
//! canonical definition here — the generator now re-`use`s this type from
//! `alaq_graph_tauri_rt::AppError` instead of re-defining it.
//!
//! ## Shape on the wire
//!
//! Serialises through serde as `{ "kind": "<variant>", "message": "<text>" }`
//! via `#[serde(tag = "kind", rename_all = "snake_case")]`. TS side branches
//! on `kind`. The enum deliberately does **not** implement `Display` — that
//! frees us to have a blanket `impl<E: Display> From<E> for AppError` without
//! triggering Rust's `impl<T> From<T> for T` reflexive-conflict (E0119).
//! Consumers that need a string form call `.message()` or
//! `format!("{:?}", err)`.

use serde::Serialize;

/// Bound alias for displayable error types that cross async/thread
/// boundaries. Generated code never stores `Box<dyn DisplayError>` directly
/// — it converts through [`AppError`] — but library authors writing utility
/// helpers can use this as the minimum bound.
pub trait DisplayError: std::fmt::Display + Send + Sync {}
impl<T: std::fmt::Display + Send + Sync> DisplayError for T {}

/// Unified error type for every Tauri command emitted by
/// `@alaq/graph-tauri-rs`.
///
/// Serialises as `{ "kind": "<variant>", "message": "<text>" }` through
/// Tauri v2's built-in serde return-type handling. TS side (via
/// `@alaq/graph-tauri`) branches on `kind`. Namespace-specific variants
/// should extend this type in the runtime crate, not in per-namespace
/// generated code — that way every consumer benefits at once.
///
/// This type is intentionally free of `Display`/`std::error::Error` impls
/// to permit a blanket `impl<E: Display> From<E> for AppError`; see module
/// doc for the E0119 rationale.
#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AppError {
    /// Handler returned an error — default catch-all.
    Handler {
        /// Human-readable error text, surfaced to TS.
        message: String,
    },
    /// Input failed validation before reaching the handler.
    BadInput {
        /// Human-readable error text, surfaced to TS.
        message: String,
    },
    /// Handler pre-condition not met (backend offline, state not ready, …).
    Unavailable {
        /// Human-readable error text, surfaced to TS.
        message: String,
    },
    /// Internal invariant violated; the command cannot continue.
    Internal {
        /// Human-readable error text, surfaced to TS.
        message: String,
    },
}

impl AppError {
    /// Lift any `Display`-able error into [`AppError::Handler`].
    pub fn handler<E: std::fmt::Display>(e: E) -> Self {
        AppError::Handler {
            message: e.to_string(),
        }
    }

    /// Lift any `Display`-able error into [`AppError::BadInput`].
    pub fn bad_input<E: std::fmt::Display>(e: E) -> Self {
        AppError::BadInput {
            message: e.to_string(),
        }
    }

    /// Lift any `Display`-able error into [`AppError::Unavailable`].
    pub fn unavailable<E: std::fmt::Display>(e: E) -> Self {
        AppError::Unavailable {
            message: e.to_string(),
        }
    }

    /// Lift any `Display`-able error into [`AppError::Internal`].
    pub fn internal<E: std::fmt::Display>(e: E) -> Self {
        AppError::Internal {
            message: e.to_string(),
        }
    }

    /// Borrow the inner message payload regardless of variant.
    pub fn message(&self) -> &str {
        match self {
            AppError::Handler { message }
            | AppError::BadInput { message }
            | AppError::Unavailable { message }
            | AppError::Internal { message } => message.as_str(),
        }
    }
}

/// Blanket conversion — any `Display` type becomes an `AppError::Handler`.
///
/// Sound because `AppError` itself does **not** implement `Display`, so this
/// impl never clashes with the stdlib reflexive `impl<T> From<T> for T`
/// (which would otherwise trigger E0119). Handler code that returns
/// `anyhow::Error`, `Box<dyn Error>`, `String`, `&str`, … lands here without
/// a manual `.map_err`.
impl<E: std::fmt::Display> From<E> for AppError {
    fn from(e: E) -> Self {
        AppError::Handler {
            message: e.to_string(),
        }
    }
}
