# Changelog

## 0.3.1 - Runtime validation alignment

- Relaxed structured passage input schema minimums so Actor runtime can return structured error rows for invalid chapter, verse, and endVerse values.

## 0.3.0 - Structured passage input

- Added structured passage input for `passage` mode.
- Supports `book`, `chapter`, `verse`, and optional `endVerse`.
- Improves multilingual workflows where localized book names work better as structured API fields.
- Existing free-text `reference` behavior remains unchanged.
- Fixes the Apify/n8n schema limitation where `book` was previously rejected as an unsupported input property.

## 0.2.0 - Translation book metadata

- Added `translation_books` mode for metadata-only book discovery in a selected translation.
- Added `book` dataset rows with book name, slug, canonical key, chapter count, chapter range, and total verse count when available.
- Kept Scripture text export limited to `passage` mode; `translation_books` does not export Scripture text, chapters, books, or full Bible content.

## 0.1.0 - Phase 1 MVP

- Added the `scriptureflow-bible-data` Apify Actor.
- Supported modes: `catalog`, `passage`, and `validate_reference`.
- Added structured dataset rows for translations, verses, validation results, and user/input errors.
- Added `OUTPUT_SUMMARY.json` in the default key-value store.
- Wrapped the public ScriptureFlow API without scraping or modifying Scripture source text.
