# ScriptureFlow Apify Actor Guardrails

This Actor wraps the public ScriptureFlow API only.

- Do not modify Scripture source text.
- Do not modify files under `/bibles`.
- Do not add scraping, browser automation, Playwright, Puppeteer, or Crawlee browser crawling.
- Keep Phase 1 modes limited to `catalog`, `passage`, and `validate_reference`.
- Treat invalid references, unsupported reference formats, invalid translation IDs, and user-caused empty results as structured dataset rows.
- Fail clearly for ScriptureFlow API availability, timeout, malformed JSON, unexpected required response shapes, unhealthy status, or Apify storage failures.
- Keep generated Actor storage and build output out of repository commits.
