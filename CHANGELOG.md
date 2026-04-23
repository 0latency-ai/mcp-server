# Changelog

All notable changes to `@0latency/mcp-server` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.0] — 2026-04-22

### Summary

Unification of the HTTP/SSE and stdio MCP servers onto a single TypeScript codebase. Both transports now expose the same 14 tools, share the same hardening layer, and resolve against the same backend API paths.

### Added (stdio)

- `memory_write` — direct seed API, previously HTTP/SSE only
- `memory_history` — memory version history
- `memory_feedback` — feedback signal for recall quality
- `import_document` — bulk document import
- `import_conversation` — bulk conversation import

### Fixed

- Graph tools (`memory_graph_traverse`, `memory_entities`, `memory_by_entity`) now call the correct API paths on stdio. In 0.1.4 these tools returned 404 against a live server due to path drift between the two codebases.
- Tool handler registration no longer silently drops tools when a single handler throws during module load.

### Changed

- Unified codebase at `@0latency/mcp-server` backs both `npx` (stdio) and the hosted HTTP/SSE endpoint at `mcp.0latency.ai`. Previously these shipped from separate repos.
- Rate limiting, content-hash deduplication, active profiling, and sentinel DLP now applied uniformly on both transports.

### Removed

- `remember` — duplicate of `memory_add`
- `seed_memories` — replaced by `memory_write`
- `memory_sentiment_summary` — endpoint never existed on the server; tool was a stub that returned empty data
- `load_memory_pack` — stub with no implementation

Users upgrading from 0.1.x: if you were calling any of the removed tools and receiving non-empty responses, those responses were not coming from live server data. Switch to the listed replacements.

### Compatibility

- HTTP/SSE endpoint, API keys, and tenant/agent semantics are unchanged.
- Breaking for stdio users who had workarounds for the broken graph tools — those workarounds are no longer necessary and may produce duplicate data.

### Verification

Pre-release smoke: 32/33 tool-transport calls passed against dev build. Post-deploy smoke: sentinel write verified end-to-end via both HTTP/SSE (prod tenant) and stdio (test tenant) with DB-level confirmation on each.

## [0.1.4] — (prior)

Last release of the pre-unification stdio codebase. Graph tools shipped but broken (path mismatch). Superseded by 0.2.0.
