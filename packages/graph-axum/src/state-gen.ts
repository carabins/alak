// @alaq/graph-axum — state.rs emitter.
//
// Per-namespace `AppState<H>` wrapper:
//
//   pub struct AppState<H: Handlers + ?Sized> {
//       pub handlers: Arc<H>,
//   }
//
// A manual `Clone` impl keeps `H: Clone` out of the bounds — `Arc<H>` is
// cheaply clone-able regardless. The struct implements no domain behaviour
// itself; it exists so `axum::extract::State` has something concrete to
// pull out of the router.

import { LineBuffer } from './utils'

export function emitAppState(buf: LineBuffer) {
  buf.line(`use std::sync::Arc;`)
  buf.line(`use super::handlers::Handlers;`)
  buf.blank()
  buf.line(`/// Shared state threaded through every generated route.`)
  buf.line(`///`)
  buf.line(`/// Use \`AppState::new(my_handlers)\` to construct; clone freely — the inner`)
  buf.line(`/// handlers are reference-counted.`)
  buf.line(`pub struct AppState<H: Handlers + ?Sized> {`)
  buf.indent()
  buf.line(`pub handlers: Arc<H>,`)
  buf.dedent()
  buf.line(`}`)
  buf.blank()

  buf.line(`impl<H: Handlers + ?Sized> AppState<H> {`)
  buf.indent()
  buf.line(`pub fn new(handlers: Arc<H>) -> Self { Self { handlers } }`)
  buf.dedent()
  buf.line(`}`)
  buf.blank()

  // Manual Clone — we only need `H: ?Sized`, not `H: Clone`.
  buf.line(`impl<H: Handlers + ?Sized> Clone for AppState<H> {`)
  buf.indent()
  buf.line(`fn clone(&self) -> Self {`)
  buf.indent()
  buf.line(`Self { handlers: Arc::clone(&self.handlers) }`)
  buf.dedent()
  buf.line(`}`)
  buf.dedent()
  buf.line(`}`)
  buf.blank()
}
