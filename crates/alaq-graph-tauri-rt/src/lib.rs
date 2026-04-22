//! # alaq-graph-tauri-rt
//!
//! Runtime support crate for code emitted by the `@alaq/graph-tauri-rs`
//! generator. Stable enough for generated code to depend on across alpha
//! releases.
//!
//! ## Status
//!
//! `0.1.0` — **alpha**. The surface is deliberately small: the canonical
//! [`AppError`] enum (used by every generated namespace via `pub use
//! alaq_graph_tauri_rt::AppError;`) and a [`DisplayError`] bound alias for
//! library authors wanting the minimum `Display + Send + Sync` contract.
//!
//! Before C3 (2026-04-21) the generator emitted a full `pub enum AppError`
//! into every namespace; now it re-exports this one. Before C4
//! (2026-04-21) this crate also shipped a placeholder marker trait
//! `HandlerExt` and a doc-only `macros` module — both had zero consumers
//! and were removed. See stress.md (C4) for the audit trail.

#![deny(missing_docs)]

pub mod error;

pub use error::{AppError, DisplayError};
