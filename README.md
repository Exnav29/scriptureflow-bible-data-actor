# ScriptureFlow Bible Data

**ScriptureFlow Bible Data is structured, multilingual Bible data infrastructure — not a Bible website scraper.** This Apify Actor returns clean Bible data as JSON across **200+ translations** in many languages: look up any **verse or passage**, discover available **Bible translations** in dozens of languages, resolve **localized book names** (e.g. `Juan 3:16` in Spanish or `Yohana` in Swahili), and **validate Scripture references** before you use them downstream. It calls the public ScriptureFlow API — **no scraping, no setup, no broken HTML selectors** — making it dependable for Apify datasets, **n8n** automations, and **AI agents**.

## What is ScriptureFlow Bible Data?

ScriptureFlow Bible Data is an Apify Actor for builders who need Scripture data that is **structured, translation-aware, and language-aware** and ready to drop into automation workflows. You request Bible data by `translationId` and reference, and the Actor writes predictable rows to the Apify default dataset and an `OUTPUT_SUMMARY.json` to the default key-value store.

It is **not a Bible website scraper**. It does **not** scrape BibleGateway, YouVersion, Blue Letter Bible, Logos, or any third-party Bible website, and it does not depend on any of them keeping the same page layout. It also does **not** generate sermons, devotionals, commentary, theological interpretation, embeddings, or RAG chunks, and it does not modify Scripture source text.

## Why ScriptureFlow is structured Bible data infrastructure, not a scraper

Scraper-based Bible tools break when a third-party Bible website changes its HTML layout. ScriptureFlow takes a different approach: it returns **structured Bible data from a prepared catalog**, with **deterministic translation IDs**, so the same workflow produces the same shape every run. That makes it suitable for **repeatable automation and API-style workflows** instead of fragile scraper-based pipelines.

You also get the full **Apify platform** behind it: scheduling, monitoring, the Apify API, dataset storage, and native integrations with tools like n8n — all wrapped around a reliable Bible API call.

## Multilingual, language-aware Bible data across many languages

Multilingual support is a core strength of ScriptureFlow Bible Data, not an afterthought. The Actor ships with **200+ translations** ready across many languages, and because it is **translation-aware and language-aware**, the *same* workflow can serve completely different audiences just by changing the `translationId` — no separate pipeline per language.

It also understands **localized book names**. Where ScriptureFlow has localized book aliases available, reference lookup resolves names in the reader's own language instead of forcing English:

- 🇪🇸 Spanish — `Juan 3:16` resolves without rewriting it to `John 3:16`
- 🇰🇪 Swahili — `swh-onen` exposes localized books like `Yohana` (John) and `Warumi` (Romans)
- 🌍 African-language coverage — including Akuapem Twi, Asante Twi, Yoruba, Hausa, Igbo, and Ewe

That makes it well suited for ministries, Bible apps, and study tools that need to reach multilingual audiences, including languages that are often missing from mainstream Bible tooling. Alias availability varies by language and translation, so use `catalog` and `translation_books` to confirm what's available, and `validate_reference` before going to production.

Representative coverage includes Protestant, public-domain, open-license, multilingual, and **Catholic / deuterocanonical-friendly** examples such as the Douay-Rheims American Edition. A few verified translation IDs from the catalog:

| Translation ID | Translation | Language |
| --- | --- | --- |
| `en-kjv` | King James Version | English |
| `en-lsv` | Literal Standard Version | English |
| `en-oeb` | Open English Bible | English |
| `en-dra` | Douay-Rheims American Edition 1899 (Catholic / deuterocanonical-friendly) | English |
| `es-vbl` | Versión Biblia Libre | Spanish |
| `es-rv09` | Reina Valera 1909 | Spanish |
| `de-luther1912` | Luther 1912 | German |
| `it-db1885` | Italian Diodati Bible 1885 | Italian |
| `swh-onen` | Biblica Open Kiswahili Contemporary Version | Swahili |
| `tw-wakna` | Biblica Open Akuapem Twi Contemporary Bible 2020 | Akuapem Twi |
| `tw-wasna` | Biblica Open Asante Twi Contemporary Bible 2020 | Asante Twi |
| `yo-oycb` | Biblica Open Yoruba Contemporary Bible 2017 | Yoruba |
| `ha-bsrk` | Biblica Open Hausa Contemporary Bible 2020 | Hausa |
| `ig-biuo` | Biblica Open Igbo Contemporary Bible 2020 | Igbo |
| `ee-oal` | eweOAL20 | Ewe |

To see the exact, current list of supported translations and languages, use **`catalog` mode** (see [Catalog discovery](#discover-the-full-bible-translation-catalog) below) — that is always the source of truth.

## What can this Actor do?

ScriptureFlow Bible Data supports five focused modes:

- 📖 **`passage`** — fetch a single verse or a same-chapter passage (e.g. `John 3:16`, `John 3:16-18`, `Romans 8:28-30`, `Psalm 23`, `1 John 1:9`), using free-text references or structured `book` / `chapter` / `verse` / `endVerse` fields.
- 🌍 **`catalog`** — discover available Bible translations and their language codes; filter by `languageCode`, `search`, and `fullBibleOnly`.
- 📊 **`catalogSummary`** — write one catalog coverage summary row with total translations, language count, full-Bible count, New Testament-only count, and top language codes when those values can be derived from catalog metadata.
- 📚 **`translation_books`** — list **metadata-only** book names for a selected translation (one row per book). Useful for discovering localized book names before a passage lookup.
- ✅ **`validate_reference`** — check whether a reference resolves *before* sending it into an automation, database, or agent workflow.
- 🧱 **Structured error rows** — invalid references, unsupported formats, and invalid translation IDs return dataset rows instead of crashing the run.

This Actor intentionally stays narrow. `translation_books` is metadata discovery only — it is **not** full Bible export, book mode, chapter mode, bulk export, or random verse mode.

## What data does ScriptureFlow Bible Data return?

The Actor writes structured JSON rows to the default Apify dataset. Every row includes `recordType`, `mode`, and `source` (the `source` field is always an object describing ScriptureFlow as the provider, never a plain string).

| Field | Description |
| --- | --- |
| `recordType` | Row type: `translation`, `catalogSummary`, `book`, `verse`, `validation`, or `error`. |
| `mode` | Mode that produced the row: `catalog`, `catalogSummary`, `translation_books`, `passage`, or `validate_reference`. |
| `source` | Object describing ScriptureFlow as provider, endpoint used, docs URL, CTA URL, and retrieval time. |
| `translationId` | ScriptureFlow translation ID, such as `en-kjv` or `swh-onen`. |
| `languageCode` | Language code for catalog rows when available. |
| `translationName` | Human-readable translation name when available. |
| `reference` | Resolved Scripture reference for verse rows. |
| `inputReference` | Reference originally supplied by the user. |
| `normalizedReference` | Reference normalized by ScriptureFlow validation when available. |
| `book` | Resolved book identifier or human-facing book name for book metadata rows. |
| `bookSlug` | Book slug when available. |
| `canonicalBook` | Canonical book key when available. |
| `chaptersFound` | Number of chapters found for a book metadata row or catalog metadata. |
| `firstChapter` / `lastChapter` | Lowest / highest chapter number found for a book metadata row. |
| `totalVerses` | Sum of available chapter verse counts for a book metadata row. |
| `chapter` / `verse` | Resolved chapter and verse numbers. |
| `text` | Scripture text returned by ScriptureFlow for passage mode. |
| `valid` | Whether the reference or result is valid. |
| `errorCode` | Structured code for user / input error rows. |
| `message` | Human-readable message for validation or error rows. |
| `status` | Translation status for catalog rows, or HTTP / user-error status when available. |
| `metadata` | Optional supporting metadata from ScriptureFlow. |
| `totalTranslations` / `languageCount` | Catalog-level totals for `catalogSummary` rows. |
| `fullBibleCount` / `partialTranslationCount` / `newTestamentOnlyCount` | Coverage counts derived from available catalog metadata for `catalogSummary` rows. |
| `topLanguages` | Most represented language codes for `catalogSummary` rows. |

You can download the resulting dataset in various formats such as JSON, CSV, Excel, or HTML directly from the Apify platform.

## How to use ScriptureFlow Bible Data

### Quick start

Run the Actor with the default input. It writes one verse row to the default dataset and `OUTPUT_SUMMARY.json` to the default key-value store:

```json
{
  "mode": "passage",
  "translationId": "en-kjv",
  "reference": "John 3:16",
  "includeMetadata": true,
  "maxResults": 100
}
```

### Discover translations with catalog mode

```json
{
  "mode": "catalog",
  "languageCode": "eng",
  "maxResults": 100
}
```

### Search the translation catalog

```json
{
  "mode": "catalog",
  "search": "Douay",
  "maxResults": 100
}
```

### Summarize catalog coverage

```json
{
  "mode": "catalogSummary"
}
```

### List book names for a translation

`translation_books` returns metadata only — one row per book — not Scripture text or a full Bible export. Useful for discovering valid localized book names (e.g. Swahili `swh-onen`):

```json
{
  "mode": "translation_books",
  "translationId": "swh-onen",
  "includeMetadata": true,
  "maxResults": 100
}
```

### Fetch a passage by free-text reference

```json
{
  "mode": "passage",
  "translationId": "en-kjv",
  "reference": "John 3:16",
  "includeMetadata": true
}
```

### Fetch a passage with structured, localized fields

When localized book names or slugs work better as API fields than as free text, use structured input:

```json
{
  "mode": "passage",
  "translationId": "swh-onen",
  "book": "yohana",
  "chapter": 3,
  "verse": 2,
  "includeMetadata": true
}
```

### Fetch a same-chapter verse range

Use `endVerse` for same-chapter structured ranges:

```json
{
  "mode": "passage",
  "translationId": "swh-onen",
  "book": "warumi",
  "chapter": 8,
  "verse": 28,
  "endVerse": 30,
  "includeMetadata": true
}
```

### Validate a reference before using it downstream

```json
{
  "mode": "validate_reference",
  "translationId": "en-kjv",
  "reference": "Romans 8:28"
}
```

### Recommended multilingual workflow

1. Run `catalog` with a language code, e.g. `swh`.
2. Run `translation_books` for the returned translation ID, e.g. `swh-onen`.
3. Use the returned `bookSlug` or book name in structured passage input.
4. Retrieve Scripture text.

### Using ScriptureFlow Bible Data in n8n

```
Manual Trigger → HTTP Request node calling the Apify Actor → Parse returned dataset item → Use Scripture text downstream
```

After the run finishes, read the default dataset items and use fields such as `text`, `reference`, `translationId`, `book`, `chapter`, and `verse` in later n8n nodes. Use `translation_books` first when you need to discover localized book names before building a passage reference.

### Using ScriptureFlow Bible Data with AI agents and MCP

This Actor is useful for agents that need structured Scripture lookup, reference validation, catalog discovery, or translation book metadata. It does **not** provide theological interpretation, sermon writing, devotional content, embeddings, or RAG chunks.

- Use `catalog` to discover valid translation IDs and language codes.
- Use `translation_books` to discover book names before lookup.
- Use `validate_reference` before taking downstream action on a user-provided reference.
- Use `passage` with structured fields when localized references are better represented as API fields than free text, or with `reference` for simple English / canonical free-text lookup.

## Output examples

### Translation row (catalog)

```json
{
  "recordType": "translation",
  "mode": "catalog",
  "source": {
    "provider": "ScriptureFlow",
    "endpoint": "/public-catalog.json",
    "docsUrl": "https://scriptureflow-dev-docs.pages.dev",
    "apiCtaUrl": "https://scriptureflow-dev-docs.pages.dev?utm_source=apify&utm_medium=actor&utm_campaign=scriptureflow_bible_data",
    "retrievedAt": "2026-06-13T00:00:00.000Z"
  },
  "translationId": "en-kjv",
  "languageCode": "eng",
  "translationName": "King James Version",
  "status": "ready"
}
```

### Book row (translation_books)

```json
{
  "recordType": "book",
  "mode": "translation_books",
  "translationId": "swh-onen",
  "book": "Yohana",
  "bookSlug": "yohana",
  "canonicalBook": "john",
  "chaptersFound": 21,
  "firstChapter": 1,
  "lastChapter": 21,
  "totalVerses": 879,
  "source": {
    "provider": "ScriptureFlow",
    "endpoint": "/swh-onen/chapters.json",
    "docsUrl": "https://scriptureflow-dev-docs.pages.dev",
    "apiCtaUrl": "https://scriptureflow-dev-docs.pages.dev?utm_source=apify&utm_medium=actor&utm_campaign=scriptureflow_bible_data",
    "retrievedAt": "2026-06-13T00:00:00.000Z"
  }
}
```

### Verse row (passage)

```json
{
  "recordType": "verse",
  "mode": "passage",
  "source": {
    "provider": "ScriptureFlow",
    "endpoint": "/api/verse",
    "docsUrl": "https://scriptureflow-dev-docs.pages.dev",
    "apiCtaUrl": "https://scriptureflow-dev-docs.pages.dev?utm_source=apify&utm_medium=actor&utm_campaign=scriptureflow_bible_data",
    "retrievedAt": "2026-06-13T00:00:00.000Z"
  },
  "valid": true,
  "translationId": "en-kjv",
  "reference": "John 3:16",
  "book": "john",
  "chapter": 3,
  "verse": 16,
  "text": "For God so loved the world..."
}
```

### Validation row (validate_reference)

```json
{
  "recordType": "validation",
  "mode": "validate_reference",
  "source": {
    "provider": "ScriptureFlow",
    "endpoint": "/api/verse",
    "docsUrl": "https://scriptureflow-dev-docs.pages.dev",
    "apiCtaUrl": "https://scriptureflow-dev-docs.pages.dev?utm_source=apify&utm_medium=actor&utm_campaign=scriptureflow_bible_data",
    "retrievedAt": "2026-06-13T00:00:00.000Z"
  },
  "valid": true,
  "translationId": "en-kjv",
  "inputReference": "Romans 8:28",
  "normalizedReference": "Romans 8:28",
  "book": "romans",
  "chapter": 8,
  "verse": 28
}
```

### Error row (structured, does not crash the run)

```json
{
  "recordType": "error",
  "mode": "translation_books",
  "source": {
    "provider": "ScriptureFlow",
    "endpoint": "/bad-id/chapters.json",
    "docsUrl": "https://scriptureflow-dev-docs.pages.dev",
    "apiCtaUrl": "https://scriptureflow-dev-docs.pages.dev?utm_source=apify&utm_medium=actor&utm_campaign=scriptureflow_bible_data",
    "retrievedAt": "2026-06-13T00:00:00.000Z"
  },
  "valid": false,
  "errorCode": "REFERENCE_NOT_FOUND",
  "message": "ScriptureFlow could not resolve the requested translation.",
  "translationId": "bad-id",
  "inputReference": null,
  "status": 404
}
```

User / input errors do **not** fail the Actor — they write structured rows and exit successfully. Infrastructure errors (ScriptureFlow API downtime, malformed JSON, request timeouts after retries, unexpected response shapes, unhealthy status, or Apify storage failure) fail clearly. The Actor does not fake Scripture data and does not use fallback Scripture text.

## Input reference

Default input:

```json
{
  "mode": "passage",
  "translationId": "en-kjv",
  "reference": "John 3:16",
  "includeMetadata": true,
  "maxResults": 100
}
```

| Field | Description |
| --- | --- |
| `mode` | One of `catalog`, `catalogSummary`, `translation_books`, `passage`, `validate_reference`. |
| `translationId` | ScriptureFlow translation ID (e.g. `en-kjv`, `swh-onen`); required for `translation_books`, `passage`, and `validate_reference`. |
| `reference` | e.g. `John 3:16`; used for free-text passage and required for `validate_reference`. Localized names like `Juan 3:16` may work when the translation and ScriptureFlow's canonical book map support that alias. |
| `book` | Structured passage book value, e.g. `yohana`; use the `bookSlug` or book name returned by `translation_books`. |
| `chapter` | Structured passage chapter number; required when any structured passage field is used. |
| `verse` | Structured passage starting verse; required when any structured passage field is used. |
| `endVerse` | Optional same-chapter ending verse for structured ranges. |
| `languageCode` | Optional catalog filter for translation language. |
| `search` | Optional catalog search across safe catalog fields such as translation ID, translation name, language code, and language name when available. |
| `fullBibleOnly` | Optional catalog filter for translations whose metadata indicates at least 66 books and 1,189 chapters. |
| `includeMetadata` | Include available non-text metadata in verse rows. |
| `maxResults` | Maximum number of catalog or translation-book metadata rows to write. |

**Supported reference formats:** `John 3:16`, `John 3:16-18`, `Romans 8:28-30`, `Psalm 23`, `1 John 1:9`. Localized book aliases (e.g. `Juan 3:16`) work where they exist in ScriptureFlow's canonical book map. Multi-reference input such as `John 3:16; Romans 8:28` is **not** supported in this version.

If any structured fields are provided, the Actor uses structured lookup and requires `book`, `chapter`, and `verse`; `endVerse` is optional. For multilingual workflows, structured passage input is often more reliable than free-text localized references. Because `mode` is a dropdown enum in the Apify UI, invalid mode values may be rejected by the platform before runtime; the Actor still keeps a code-level `INVALID_MODE` handler as a defensive fallback for local runs and direct API calls. Click the **Input** tab for the full schema.

## Discover the full Bible translation catalog

The most reliable way to see every supported translation is to run the Actor in **`catalog` mode**, which lists each available translation and its language code — perfect for app dropdowns, multilingual workflows, or agent translation selection.

Use `search` to find catalog rows by translation ID, translation name, or language code. Use `fullBibleOnly` to limit catalog rows to translations whose current catalog metadata indicates full-Bible coverage.

A preview translations list is also available here:

```
https://scriptureflow-api-preview.pages.dev/translations.json
```

Note that this is a **preview** endpoint, so treat `catalog` mode as the authoritative source when building production workflows.

## Use cases

- 🔎 Bible verse lookup for apps, spreadsheets, and dashboards.
- 🌐 Multilingual Scripture workflows where users select a translation by language.
- 📚 Discovering localized book names for translations such as Swahili `swh-onen`.
- ⚙️ n8n automations that need clean Scripture text and reference fields.
- 🤖 AI agents that need safe catalog discovery, translation book metadata, reference validation, or structured passage lookup.
- 🧪 Form validation for Bible references before writing to a database.
- 📝 Translation dropdowns powered by ScriptureFlow catalog metadata.
- 🧱 Lightweight Scripture lookup **without scraping Bible websites**.

## Known limitations

In the interest of being upfront — please review these before building production workflows:

- Some translations are full Bible; others are New Testament or portion-only.
- Book names and coverage may vary by translation.
- Use `catalog` (and `translation_books`) mode to confirm supported translations and books **before** building production workflows.
- Licensing and usage terms may vary by translation (see the disclaimer below).

## Why this matters for production workflows

Because ScriptureFlow returns structured data with **deterministic translation IDs** and does **not** depend on any third-party Bible website's HTML, your automations are far less likely to silently break when an external site changes. Structured JSON output, a discoverable catalog, documented modes, predictable dataset rows, and **structured error rows instead of crashes** give you the repeatability that API-style and agent workflows need. Combined with the Apify platform's scheduling, monitoring, API access, and integrations, that makes ScriptureFlow Bible Data a dependable foundation rather than a fragile scraper.

## Is ScriptureFlow Bible Data free?

This Actor does **not** include pay-per-event logic, API key gating, or custom monetization. Normal Apify platform compute and storage usage may still apply based on your Apify plan. Default passage and validation runs are intentionally small, and catalog and translation-book output can be bounded with `maxResults`.

## Pricing and licensing of Bible translations

ScriptureFlow Bible Data provides structured access to ScriptureFlow data. **You are responsible for confirming that your use of any translation complies with applicable copyright, licensing, and attribution requirements.** ScriptureFlow does not grant rights to restricted Bible translations unless those rights are explicitly stated.

## Need higher volume or a custom integration? Use the ScriptureFlow API directly

For higher-volume API access, custom integrations, or direct ScriptureFlow API use, visit the ScriptureFlow developer docs:

➡️ **[ScriptureFlow developer docs](https://scriptureflow-dev-docs.pages.dev?utm_source=apify&utm_medium=actor&utm_campaign=scriptureflow_bible_data)**

For Actor run support, include the run ID, input JSON, and `OUTPUT_SUMMARY.json` content when requesting help.

## FAQ

### Does this Actor scrape Bible websites?

No. ScriptureFlow Bible Data calls the public ScriptureFlow API only. It does **not** scrape BibleGateway, YouVersion, Blue Letter Bible, Logos, or any third-party Bible website, and it does not depend on their page layouts.

### Can this Actor fetch an entire Bible?

No. It supports `catalog` lookup, metadata-only `translation_books` discovery, `passage` lookup, and `validate_reference` only. It does not provide full Bible export, book mode, chapter mode, random verse mode, or bulk export.

### Does this Actor generate sermons, devotionals, or commentary?

No. It returns structured Scripture data and validation results only. It does not generate theological interpretation, sermon content, devotional content, commentary, embeddings, or RAG chunks.

### Does ScriptureFlow Bible Data support multilingual Bible references?

Yes. ScriptureFlow is built around translation-aware and language-aware Bible data. Use `catalog` mode to discover available translations and language codes, then choose your `translationId`. Where ScriptureFlow has localized book aliases available, the Actor can resolve names such as `Juan 3:16` for Spanish workflows. Alias availability varies by language and translation, so validate references before using them downstream. Use `translation_books` mode to discover book names for a translation before building passage references.

### Is this machine translation?

No. The Actor does not translate Scripture text or convert references between languages. It looks up ScriptureFlow translations and can use localized book aliases only where ScriptureFlow already has them available.

### What do the error codes mean?

- `UNSUPPORTED_REFERENCE_FORMAT` — the reference is outside the supported simple-reference formats.
- `REFERENCE_NOT_FOUND` — ScriptureFlow could not resolve the requested reference or translation.
- `INVALID_MODE` — the requested mode is not supported. Use only `catalog`, `catalogSummary`, `translation_books`, `passage`, or `validate_reference`.
- `REQUEST_FAILED_AFTER_RETRIES` — ScriptureFlow returned a retryable infrastructure error after bounded retries.

### Can I use this in n8n or AI agents?

Yes. The Actor writes predictable dataset rows and includes output and dataset schemas to help automations and agents understand the result structure.

### Where is the changelog?

See `./CHANGELOG.md`.
