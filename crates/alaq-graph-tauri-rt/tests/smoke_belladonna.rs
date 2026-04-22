//! Compile-smoke test for @alaq/graph-tauri-rs output.
//!
//! Pulls in the six `.rs` files emitted for Belladonna's `belladonna.reader`
//! namespace via absolute `#[path]` includes, and asserts that the resulting
//! module compiles end-to-end. Covers:
//!
//! * `types.rs`     — records, enums, scalars, Input structs, AppError
//! * `handlers.rs`  — `#[async_trait]` trait, `use super::types::*;`
//! * `commands.rs`  — `#[tauri::command]` delegators
//! * `register.rs`  — `register_belladonna_reader_commands!` macro
//! * `events.rs`    — stub
//! * `mod.rs`       — re-exports (not included directly — we inline the tree
//!                    here because `mod.rs` expects `pub mod types; …` which
//!                    we already declare explicitly via `#[path]`).
//!
//! This is NOT a behavioural test. It runs no Tauri command; it just confirms
//! the generator's output type-checks with real Tauri and async-trait crates.
//!
//! If this test breaks, the generator produced ill-formed Rust. If Belladonna's
//! SDL changes, regenerate via `bun schema/_generate_tauri_rs.ts`.

#[cfg(test)]
#[allow(dead_code, unused_imports, unused_variables, clippy::all)]
mod belladonna_reader {
    #[path = "../../../../../pharos/Belladonna/src-tauri/src/generated/belladonna_reader/types.rs"]
    pub mod types;

    #[path = "../../../../../pharos/Belladonna/src-tauri/src/generated/belladonna_reader/handlers.rs"]
    pub mod handlers;

    #[path = "../../../../../pharos/Belladonna/src-tauri/src/generated/belladonna_reader/commands.rs"]
    pub mod commands;

    #[path = "../../../../../pharos/Belladonna/src-tauri/src/generated/belladonna_reader/register.rs"]
    pub mod register;

    #[path = "../../../../../pharos/Belladonna/src-tauri/src/generated/belladonna_reader/events.rs"]
    pub mod events;
}

#[test]
fn generated_module_compiles() {
    // Reaching this point means the generated tree type-checked.
    // We poke a couple of public symbols to guard against dead-code trimming.
    use belladonna_reader::types::{AppError, TocEntry};
    let _ = AppError::handler("test");
    let _ = TocEntry {
        level: 1,
        text: "T".to_string(),
        anchor: "t".to_string(),
    };
}
