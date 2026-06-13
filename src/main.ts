import { Actor, log } from "apify";
import { InfrastructureError, UserInputError, isUserInputError } from "./errors.js";
import {
  normalizeBookRows,
  normalizeErrorRow,
  normalizeTranslationRows,
  normalizeValidationRow,
  normalizeVerseRows,
  extractTranslations,
  type Mode,
} from "./normalizers.js";
import {
  PASSAGE_ENDPOINT,
  PUBLIC_CATALOG_ENDPOINT,
  SCRIPTUREFLOW_API_CTA_URL,
  SCRIPTUREFLOW_DEVELOPER_DOCS_URL,
  ScriptureFlowClient,
} from "./scriptureflow-client.js";
import { parseReference } from "./reference-parser.js";

const DEFAULT_INPUT = {
  mode: "passage",
  translationId: "en-kjv",
  reference: "John 3:16",
  includeMetadata: true,
  maxResults: 100,
} as const;

interface ActorInput {
  mode?: string;
  translationId?: string;
  reference?: string;
  languageCode?: string;
  includeMetadata?: boolean;
  maxResults?: number;
}

interface RunSummary {
  status: "success" | "user_error" | "failed";
  mode: Mode;
  translationId?: string;
  inputReference?: string;
  rowsWritten: number;
  warnings: string[];
  errors: string[];
  startedAt: string;
  finishedAt: string | null;
  scriptureFlow: {
    docsUrl: string;
    apiCtaUrl: string;
    contactUrl: string | null;
  };
}

async function main(): Promise<void> {
  await Actor.init();
  const startedAt = new Date().toISOString();
  const rawInput = (await Actor.getInput<ActorInput>()) ?? {};
  let input = buildFallbackInput(rawInput);
  const summary = buildInitialSummary(input, startedAt);
  const client = new ScriptureFlowClient();
  let exitCode = 0;

  try {
    input = normalizeInput(rawInput);
    applyInputToSummary(summary, input);
    const rows = await runMode(client, input);
    if (rows.length > 0) {
      await Actor.pushData(rows);
    }

    summary.rowsWritten = rows.length;
    summary.status = rows.some((row) => row.recordType === "error" || row.valid === false) ? "user_error" : "success";
    summary.errors = rows
      .filter((row) => row.recordType === "error" || row.valid === false)
      .map((row) => String(row.message ?? row.errorCode ?? "User error"));
    summary.finishedAt = new Date().toISOString();
    await writeSummary(summary);

    log.info(`Need direct API access or bulk Scripture data? Visit: ${SCRIPTUREFLOW_API_CTA_URL}`);
  } catch (error) {
    if (isUserInputError(error)) {
      const row = normalizeErrorRow({
        mode: input.mode,
        endpoint: endpointForMode(input),
        retrievedAt: new Date().toISOString(),
        code: error.code,
        message: error.message,
        translationId: input.translationId,
        inputReference: input.reference,
        status: error.status,
        details: error.details,
      });

      await Actor.pushData(row);
      summary.status = "user_error";
      summary.rowsWritten = 1;
      summary.errors = [error.message];
      summary.finishedAt = new Date().toISOString();
      await writeSummary(summary);
      log.info(`Need direct API access or bulk Scripture data? Visit: ${SCRIPTUREFLOW_API_CTA_URL}`);
    } else {
      summary.status = "failed";
      summary.errors = [error instanceof Error ? error.message : String(error)];
      summary.finishedAt = new Date().toISOString();
      await writeSummaryBestEffort(summary);
      log.exception(error instanceof Error ? error : new Error(String(error)), "ScriptureFlow Actor failed.");
      exitCode = 1;
    }
  } finally {
    await Actor.exit({ exitCode });
  }
}

function buildFallbackInput(input: ActorInput): Required<ActorInput> & { mode: Mode } {
  const rawMode = String(input.mode ?? DEFAULT_INPUT.mode).trim();
  const mode: Mode = ["catalog", "passage", "validate_reference", "translation_books"].includes(rawMode)
    ? (rawMode as Mode)
    : DEFAULT_INPUT.mode;

  return {
    mode,
    translationId: String(input.translationId ?? DEFAULT_INPUT.translationId).trim(),
    reference: String(input.reference ?? DEFAULT_INPUT.reference).trim(),
    languageCode: String(input.languageCode ?? "").trim(),
    includeMetadata: typeof input.includeMetadata === "boolean" ? input.includeMetadata : DEFAULT_INPUT.includeMetadata,
    maxResults: normalizeMaxResults(input.maxResults),
  };
}

function applyInputToSummary(summary: RunSummary, input: Required<ActorInput> & { mode: Mode }): void {
  summary.mode = input.mode;
  summary.translationId = input.mode === "catalog" ? undefined : input.translationId;
  summary.inputReference = input.mode === "catalog" || input.mode === "translation_books" ? undefined : input.reference;
}

async function runMode(client: ScriptureFlowClient, input: Required<ActorInput> & { mode: Mode }): Promise<Record<string, unknown>[]> {
  switch (input.mode) {
    case "catalog":
      return runCatalog(client, input);
    case "passage":
      return runPassage(client, input);
    case "validate_reference":
      return runValidateReference(client, input);
    case "translation_books":
      return runTranslationBooks(client, input);
    default:
      throw new UserInputError("INVALID_MODE", "Unsupported mode. Supported modes are catalog, passage, validate_reference, and translation_books.");
  }
}

async function runCatalog(client: ScriptureFlowClient, input: Required<ActorInput> & { mode: Mode }): Promise<Record<string, unknown>[]> {
  await client.checkStatus();
  const result = await client.fetchCatalog();
  const translations = extractTranslations(result.payload);

  if (translations.length === 0) {
    throw new InfrastructureError("UNEXPECTED_CATALOG_SHAPE", "ScriptureFlow catalog endpoint returned no translations in an expected shape.", {
      details: result.payload,
    });
  }

  return normalizeTranslationRows(translations, {
    mode: "catalog",
    endpoint: result.endpoint,
    retrievedAt: new Date().toISOString(),
    languageCode: input.languageCode,
    maxResults: input.maxResults,
  });
}

async function runPassage(client: ScriptureFlowClient, input: Required<ActorInput> & { mode: Mode }): Promise<Record<string, unknown>[]> {
  assertPassageInput(input);
  const parsed = parseReference(input.reference);

  try {
    await client.checkStatus();
    const result = await fetchParsedPassage(client, input.translationId, parsed);
    const rows = normalizeVerseRows(result.payload, {
      mode: "passage",
      translationId: input.translationId,
      inputReference: input.reference,
      includeMetadata: input.includeMetadata,
      retrievedAt: new Date().toISOString(),
    });

    if (rows.length === 0) {
      throw new UserInputError("EMPTY_RESULT", "ScriptureFlow resolved the request but returned no verse rows.");
    }

    return rows;
  } catch (error) {
    if (!isUserInputError(error)) throw error;

    return [
      normalizeErrorRow({
        mode: "passage",
        endpoint: PASSAGE_ENDPOINT,
        retrievedAt: new Date().toISOString(),
        code: error.code,
        message: error.message,
        translationId: input.translationId,
        inputReference: input.reference,
        status: error.status,
        details: error.details,
      }),
    ];
  }
}

async function hasCatalogTranslation(client: ScriptureFlowClient, translationId: string): Promise<boolean> {
  const result = await client.fetchCatalog();
  return extractTranslations(result.payload).some((translation) => {
    return String(translation.version ?? translation.id ?? "").trim() === translationId;
  });
}

async function runValidateReference(client: ScriptureFlowClient, input: Required<ActorInput> & { mode: Mode }): Promise<Record<string, unknown>[]> {
  assertPassageInput(input);
  const parsed = parseReference(input.reference);

  try {
    await client.checkStatus();
    const result = await fetchParsedPassage(client, input.translationId, parsed);
    return [
      normalizeValidationRow(result.payload, {
        translationId: input.translationId,
        inputReference: input.reference,
        retrievedAt: new Date().toISOString(),
      }),
    ];
  } catch (error) {
    if (!isUserInputError(error)) throw error;

    return [
      {
        ...normalizeErrorRow({
          mode: "validate_reference",
          endpoint: PASSAGE_ENDPOINT,
          retrievedAt: new Date().toISOString(),
          code: error.code,
          message: error.message,
          translationId: input.translationId,
          inputReference: input.reference,
          status: error.status,
          details: error.details,
        }),
        recordType: "validation",
      },
    ];
  }
}

async function runTranslationBooks(client: ScriptureFlowClient, input: Required<ActorInput> & { mode: Mode }): Promise<Record<string, unknown>[]> {
  assertTranslationInput(input);
  const endpoint = chaptersEndpoint(input.translationId);

  try {
    await client.checkStatus();
    const result = await client.fetchChapters(input.translationId);

    if (!Array.isArray(result.payload)) {
      throw new InfrastructureError("UNEXPECTED_CHAPTERS_SHAPE", "ScriptureFlow chapters endpoint returned an unexpected shape.", {
        details: result.payload,
      });
    }

    const rows = normalizeBookRows(result.payload.filter(isRecord), {
      mode: "translation_books",
      translationId: input.translationId,
      endpoint,
      retrievedAt: new Date().toISOString(),
      maxResults: input.maxResults,
    });

    if (rows.length === 0) {
      throw new UserInputError("EMPTY_RESULT", "ScriptureFlow returned no book metadata for this translation.", {
        status: 404,
        details: { translationId: input.translationId },
      });
    }

    return rows;
  } catch (error) {
    if (!isUserInputError(error)) {
      if (error instanceof InfrastructureError && error.code === "MALFORMED_JSON") {
        const translationExists = await hasCatalogTranslation(client, input.translationId);
        if (!translationExists) {
          return [
            normalizeErrorRow({
              mode: "translation_books",
              endpoint,
              retrievedAt: new Date().toISOString(),
              code: "REFERENCE_NOT_FOUND",
              message: "ScriptureFlow could not resolve the requested translation.",
              translationId: input.translationId,
              status: 404,
              details: { translationId: input.translationId },
            }),
          ];
        }
      }

      throw error;
    }

    return [
      normalizeErrorRow({
        mode: "translation_books",
        endpoint,
        retrievedAt: new Date().toISOString(),
        code: error.code,
        message: error.message,
        translationId: input.translationId,
        status: error.status,
        details: error.details,
      }),
    ];
  }
}

async function fetchParsedPassage(
  client: ScriptureFlowClient,
  translationId: string,
  parsed: ReturnType<typeof parseReference>
) {
  if (parsed.verse != null) {
    return client.fetchPassage(translationId, parsed.normalizedReference);
  }

  const endVerse = await resolveChapterVerseCount(client, translationId, parsed.book, parsed.chapter);

  return client.fetchStructuredPassage({
    translationId,
    book: parsed.book,
    chapter: parsed.chapter,
    verse: 1,
    endVerse,
  });
}

async function resolveChapterVerseCount(
  client: ScriptureFlowClient,
  translationId: string,
  book: string,
  chapter: number
): Promise<number> {
  const result = await client.fetchChapters(translationId);

  if (!Array.isArray(result.payload)) {
    throw new InfrastructureError("UNEXPECTED_CHAPTERS_SHAPE", "ScriptureFlow chapters endpoint returned an unexpected shape.", {
      details: result.payload,
    });
  }

  const normalizedBookVariants = bookVariants(book);
  const match = result.payload.find((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;

    const record = item as Record<string, unknown>;
    if (Number(record.chapter) !== chapter) return false;

    return [record.book, record.book_slug, record.canonical_book].some((value) => {
      return bookVariants(value).some((variant) => normalizedBookVariants.includes(variant));
    });
  }) as Record<string, unknown> | undefined;

  const verseCount = Number(match?.verse_count);
  if (!Number.isInteger(verseCount) || verseCount < 1) {
    throw new UserInputError("REFERENCE_NOT_FOUND", "Chapter reference was not found for this translation.", {
      status: 404,
      details: { translationId, reference: `${book} ${chapter}` },
    });
  }

  return verseCount;
}

function normalizeBook(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/[’'`´]/gu, "'")
    .replace(/[_-]+/gu, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/\s+/gu, " ");
}

function bookVariants(value: unknown): string[] {
  const normalized = normalizeBook(value);
  if (!normalized) return [];

  const variants = new Set([normalized]);
  if (normalized.endsWith("s")) variants.add(normalized.slice(0, -1));
  if (normalized === "psalm") variants.add("psalms");

  return [...variants];
}

function normalizeInput(input: ActorInput): Required<ActorInput> & { mode: Mode } {
  const mode = String(input.mode ?? DEFAULT_INPUT.mode).trim() as Mode;

  if (!["catalog", "passage", "validate_reference", "translation_books"].includes(mode)) {
    throw new UserInputError("INVALID_MODE", "Unsupported mode. Supported modes are catalog, passage, validate_reference, and translation_books.");
  }

  return {
    mode,
    translationId: String(input.translationId ?? DEFAULT_INPUT.translationId).trim(),
    reference: String(input.reference ?? DEFAULT_INPUT.reference).trim(),
    languageCode: String(input.languageCode ?? "").trim(),
    includeMetadata: typeof input.includeMetadata === "boolean" ? input.includeMetadata : DEFAULT_INPUT.includeMetadata,
    maxResults: normalizeMaxResults(input.maxResults),
  };
}

function normalizeMaxResults(value: unknown): number {
  const numberValue = Number(value ?? DEFAULT_INPUT.maxResults);
  if (!Number.isInteger(numberValue) || numberValue < 1) return DEFAULT_INPUT.maxResults;
  return Math.min(numberValue, 1000);
}

function assertPassageInput(input: Required<ActorInput>): void {
  assertTranslationInput(input);

  if (!input.reference) {
    throw new UserInputError("INVALID_REFERENCE", "reference is required for this mode.");
  }
}

function assertTranslationInput(input: Required<ActorInput>): void {
  if (!input.translationId) {
    throw new UserInputError("INVALID_TRANSLATION", "translationId is required for this mode.");
  }
}

function buildInitialSummary(input: Required<ActorInput> & { mode: Mode }, startedAt: string): RunSummary {
  return {
    status: "success",
    mode: input.mode,
    translationId: input.mode === "catalog" ? undefined : input.translationId,
    inputReference: input.mode === "catalog" || input.mode === "translation_books" ? undefined : input.reference,
    rowsWritten: 0,
    warnings: [],
    errors: [],
    startedAt,
    finishedAt: null,
    scriptureFlow: {
      docsUrl: SCRIPTUREFLOW_DEVELOPER_DOCS_URL,
      apiCtaUrl: SCRIPTUREFLOW_API_CTA_URL,
      contactUrl: null,
    },
  };
}

function chaptersEndpoint(translationId: string): string {
  return `/${encodeURIComponent(translationId)}/chapters.json`;
}

function endpointForMode(input: Required<ActorInput> & { mode: Mode }): string {
  if (input.mode === "catalog") return PUBLIC_CATALOG_ENDPOINT;
  if (input.mode === "translation_books") return chaptersEndpoint(input.translationId);
  return PASSAGE_ENDPOINT;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function writeSummary(summary: RunSummary): Promise<void> {
  await Actor.setValue("OUTPUT_SUMMARY", summary);
}

async function writeSummaryBestEffort(summary: RunSummary): Promise<void> {
  try {
    await writeSummary(summary);
  } catch (error) {
    log.error("Failed to write OUTPUT_SUMMARY.json before failing the Actor.", { error });
  }
}

main().catch((error) => {
  log.exception(error instanceof Error ? error : new Error(String(error)), "ScriptureFlow Actor failed.");
  process.exit(1);
});
