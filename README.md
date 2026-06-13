# ScriptureFlow Bible Data

Retrieve structured, multilingual Bible data as clean JSON: look up any verse or passage, discover available translations, list book names for a selected translation, validate Scripture references, and work with localized book names where available for Apify datasets, n8n automations, and AI agents. No scraping, no setup, just a reliable **Bible API** wrapped in an Apify Actor.

ScriptureFlow Bible Data is for builders who need Scripture data that is structured, translation-aware, language-aware, and ready to use in automation workflows. It calls the public ScriptureFlow API and writes predictable rows to the Apify default dataset.

It does not scrape BibleGateway, YouVersion, Blue Letter Bible, Logos, or any third-party Bible website. It does not generate sermons, devotionals, commentary, theological interpretation, embeddings, or RAG chunks. It does not modify Scripture source text.

## What does ScriptureFlow Bible Data do?

ScriptureFlow Bible Data lets you request Bible data by `translationId` and reference, then returns structured JSON rows that are easy to use in apps, spreadsheets, n8n workflows, and AI-agent pipelines.

Because ScriptureFlow is translation-aware and language-aware, the same workflow can serve different audiences by changing the `translationId`. For translations with localized book aliases available in ScriptureFlow's canonical book map, reference lookup can also understand localized book names - for example, a Spanish Bible translation may resolve `Juan 3:16` instead of requiring only `John 3:16`.

The Actor supports four focused modes:

* `catalog` - discover available translations.
* `translation_books` - list metadata-only book names available in a selected translation.
* `passage` - fetch a simple verse or same-chapter passage.
* `validate_reference` - check whether a reference resolves before using it downstream.

## What can this Actor do?

* **Look up verses and passages** - fetch simple references such as `John 3:16`, `John 3:16-18`, `Romans 8:28-30`, `Psalm 23`, or `1 John 1:9`.
* **Work with multilingual Scripture data** - choose translations by language, return Scripture text for the selected translation, and use localized book names where ScriptureFlow's alias system supports them.
* **Discover translations** - list every available translation and its language, ideal for populating app dropdowns, supporting multilingual workflows, or letting an AI agent pick a valid `translationId`.
* **List book names for a selected translation** - return one metadata row per book, useful before passage lookup and helpful for multilingual workflows such as Swahili `swh-onen`.
* **Validate references** - check whether a user-provided reference resolves before sending it into an automation, database, or agent workflow.
* **Return structured errors** - invalid references, unsupported formats, and invalid translation IDs return dataset rows instead of crashing the run.
* **Write a run summary** - every successful or structured user-error run writes `OUTPUT_SUMMARY.json` to the default key-value store.

This Actor intentionally stays narrow. `translation_books` is metadata discovery only. It is not book mode, chapter mode, Scripture text export, full Bible export, or bulk export. The Actor does not provide random verse mode, scraping, browser automation, API key gating, monetization logic, sermon generation, devotional generation, commentary generation, embeddings, or RAG chunks.

## What data can ScriptureFlow Bible Data return?

| Field | Description |
| --- | --- |
| `recordType` | Row type: `translation`, `book`, `verse`, `validation`, or `error`. |
| `mode` | Actor mode that produced the row: `catalog`, `translation_books`, `passage`, or `validate_reference`. |
| `source` | Object describing ScriptureFlow as the provider, endpoint used, docs URL, CTA URL, and retrieval time. |
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
| `firstChapter` | Lowest chapter number found for a book metadata row. |
| `lastChapter` | Highest chapter number found for a book metadata row. |
| `totalVerses` | Sum of available chapter verse counts for a book metadata row. |
| `chapter` | Resolved chapter number. |
| `verse` | Resolved verse number. |
| `text` | Scripture text returned by ScriptureFlow for passage mode. |
| `valid` | Whether the reference or result is valid. |
| `errorCode` | Structured code for user/input error rows. |
| `message` | Human-readable message for validation or error rows. |
| `status` | Translation status for catalog rows or HTTP/user-error status when available. |
| `metadata` | Optional supporting metadata from ScriptureFlow. |

Every dataset row includes `recordType`, `mode`, and `source`. The `source` field is always an object, never the string `"ScriptureFlow"`.

## How to use ScriptureFlow Bible Data

### Quick start

Run the Actor with the default input:

```json
{
  "mode": "passage",
  "translationId": "en-kjv",
  "reference": "John 3:16",
  "includeMetadata": true,
  "maxResults": 100
}
```

The Actor writes one `verse` row to the default dataset and writes `OUTPUT_SUMMARY.json` to the default key-value store.

### Catalog example

Use `catalog` mode to list translations and language metadata:

```json
{
  "mode": "catalog",
  "languageCode": "eng",
  "maxResults": 100
}
```

### Translation books example

Use `translation_books` mode to list book names for a selected translation. This returns metadata only: one dataset row per book. It does not return Scripture text, every chapter as a row, or a full Bible export.

```json
{
  "mode": "translation_books",
  "translationId": "swh-onen",
  "includeMetadata": true,
  "maxResults": 100
}
```

This is useful before passage lookup and helps discover valid localized book names for translations such as Swahili `swh-onen`.

### Passage example

Use `passage` mode to fetch Scripture text:

```json
{
  "mode": "passage",
  "translationId": "en-kjv",
  "reference": "John 3:16",
  "includeMetadata": true
}
```

### Validate reference example

Use `validate_reference` mode to check a reference before using it downstream:

```json
{
  "mode": "validate_reference",
  "translationId": "en-kjv",
  "reference": "Romans 8:28"
}
```

### n8n example

Manual Trigger -> HTTP Request node calling Apify Actor -> Parse returned dataset item -> Use Scripture text downstream

Example Actor input:

```json
{
  "mode": "passage",
  "translationId": "en-kjv",
  "reference": "John 3:16",
  "includeMetadata": true
}
```

After the run finishes, read the default dataset items and use fields such as `text`, `reference`, `translationId`, `book`, `chapter`, and `verse` in later n8n nodes. Use `translation_books` first when you need to discover localized book names before building a passage reference.

### AI-agent and MCP usage notes

This Actor is useful for agents that need structured Scripture lookup, reference validation, catalog discovery, or translation book metadata, but it does not provide theological interpretation, sermon writing, devotional content, embeddings, or RAG chunks.

For agent workflows:

* Use `catalog` to discover valid translation IDs and language codes.
* Use `translation_books` to discover book names for a selected translation before lookup.
* Use `validate_reference` before taking downstream action on a user-provided reference.
* Use `passage` when the agent needs structured verse rows with Scripture text.

## Is ScriptureFlow Bible Data free?

This Actor does not include pay-per-event logic, API key gating, or custom monetization. Normal Apify platform compute and storage usage may still apply based on your Apify plan.

Default passage and validation runs are intentionally small. Catalog and translation book metadata output can be bounded with `maxResults`.

ScriptureFlow Bible Data Actor provides structured access to ScriptureFlow data. Users are responsible for confirming that their use of any translation complies with applicable copyright, licensing, and attribution requirements. ScriptureFlow does not grant rights to restricted Bible translations unless those rights are explicitly stated.

## Input

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

Input fields:

* **`mode`** - one of `catalog`, `translation_books`, `passage`, or `validate_reference`.
* **`translationId`** - ScriptureFlow translation ID, such as `en-kjv` or `swh-onen`; required for `translation_books`, `passage`, and `validate_reference`.
* **`reference`** - e.g. `John 3:16`; required for `passage` and `validate_reference`. Localized book names such as `Juan 3:16` may work when the selected translation and ScriptureFlow canonical book map support that alias.
* **`languageCode`** - optional catalog filter for translation language.
* **`includeMetadata`** - include available non-text metadata in verse rows.
* **`maxResults`** - maximum number of catalog or translation book metadata rows to write.

**Supported reference formats:** `John 3:16` - `John 3:16-18` - `Romans 8:28-30` - `Psalm 23` - `1 John 1:9`. ScriptureFlow also supports localized book aliases where they are available in the canonical book map, so some translations may resolve references such as `Juan 3:16` or other language-specific book names. Multi-reference input such as `John 3:16; Romans 8:28` is not supported in this version.

Apify may validate the public input schema before the Actor starts. Because `mode` is a dropdown enum in the Apify UI, invalid mode values can be rejected by the platform before runtime. The Actor still keeps its code-level `INVALID_MODE` handler as a defensive fallback for local runs and direct API calls.

## Output

The Actor writes results to the default Apify dataset and writes `OUTPUT_SUMMARY.json` to the default key-value store.

### Translation row

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

### Book row

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

### Verse row

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

### Validation row

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

### Error row

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

User/input errors do not fail the Actor. They write structured rows and exit successfully. Infrastructure errors, such as ScriptureFlow API downtime, malformed JSON, request timeouts after retries, unexpected required response shapes, unhealthy status output, or Apify storage failure, fail clearly.

The Actor does not fake Scripture data and does not use fallback Scripture text.

## Use cases

* Bible verse lookup for apps, spreadsheets, and dashboards.
* Multilingual Scripture workflows where users select a translation by language.
* Discovering localized book names for translations such as Swahili `swh-onen`.
* n8n automations that need clean Scripture text and reference fields.
* AI agents that need safe catalog discovery, translation book metadata, reference validation, or structured passage lookup.
* Form validation for Bible references before writing to a database.
* Translation dropdowns powered by ScriptureFlow catalog metadata.
* Lightweight Scripture lookup without scraping Bible websites.

## Need higher volume or a custom integration? Use the ScriptureFlow API directly

For higher-volume API access, custom integrations, or direct ScriptureFlow API use, visit the ScriptureFlow developer docs:

https://scriptureflow-dev-docs.pages.dev?utm_source=apify&utm_medium=actor&utm_campaign=scriptureflow_bible_data

For Actor run support, include the run ID, input JSON, and `OUTPUT_SUMMARY.json` content when requesting help.

## FAQ

### Can this Actor fetch an entire Bible?

No. This Actor supports catalog lookup, metadata-only translation book discovery, passage lookup, and reference validation only. It does not provide full Bible export, book mode, chapter mode, random verse mode, or bulk export.

### Does this Actor scrape Bible websites?

No. It calls the public ScriptureFlow API only. It does not scrape BibleGateway, YouVersion, Blue Letter Bible, Logos, or any third-party Bible website.

### Does this Actor generate sermons, devotionals, or commentary?

No. It returns structured Scripture data and validation results. It does not generate theological interpretation, sermon content, devotional content, commentary, embeddings, or RAG chunks.

### Does ScriptureFlow Bible Data support multilingual Bible references?

Yes. ScriptureFlow is built around translation-aware and language-aware Bible data. Use `catalog` mode to discover available translations and language codes, then choose the `translationId` you want to use. Where ScriptureFlow has localized book aliases available, the Actor can resolve localized book names such as `Juan 3:16` for Spanish workflows. Alias availability can vary by language and translation, so validate references before using them in downstream automations.

Use `translation_books` mode when you want to discover book names available in a selected translation before building passage references.

### What do the error codes mean?

* `UNSUPPORTED_REFERENCE_FORMAT` - the reference is outside the supported simple-reference formats.
* `REFERENCE_NOT_FOUND` - ScriptureFlow could not resolve the requested reference or translation.
* `INVALID_MODE` - the requested mode is not supported. Use only `catalog`, `translation_books`, `passage`, or `validate_reference`.
* `REQUEST_FAILED_AFTER_RETRIES` - ScriptureFlow returned a retryable infrastructure error after bounded retries.

### Can I use this in n8n or AI agents?

Yes. The Actor writes predictable dataset rows and includes output and dataset schemas to help automations and agents understand the result structure.

### Is this machine translation?

No. The Actor does not translate Scripture text or convert references between languages. It looks up ScriptureFlow translations and can use localized book aliases only where ScriptureFlow already has those aliases available.

### Where is the changelog?

See [CHANGELOG.md](./CHANGELOG.md).
