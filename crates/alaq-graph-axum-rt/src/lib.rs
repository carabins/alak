//! alaq-graph-axum-rt — runtime support for `@alaq/graph-axum` generated code.
//!
//! Scope (v0.1):
//!   * [`ActionContext`] — per-request metadata extractor (trace id, peer id,
//!     admin flag). Implements [`axum::extract::FromRequestParts`] so generated
//!     dispatchers can take it as a handler argument.
//!   * [`HandlerError`] — typed error a `Handlers` impl may return. Implements
//!     [`axum::response::IntoResponse`] with a small JSON body `{ "error": "...",
//!     "code": "..." }` and a matching HTTP status.
//!   * Re-exports [`async_trait::async_trait`] so generated `trait Handlers`
//!     definitions compile without the consumer adding `async-trait` manually.
//!
//! The crate deliberately avoids defining an application state wrapper; that
//! lives in generated code (per-namespace `AppState<H>`). Nothing in this
//! crate knows the schema.

pub mod context;
pub mod error;

pub use context::ActionContext;
pub use error::HandlerError;

// Re-export so generated code can `use alaq_graph_axum_rt::async_trait;`
// without pulling the `async-trait` crate into the generated crate's
// Cargo.toml explicitly. Matches the ergonomics of link-state-runtime in
// the TS side.
pub use async_trait::async_trait;
