import {
  PASSAGE_ENDPOINT,
  SCRIPTUREFLOW_API_CTA_URL,
  SCRIPTUREFLOW_DEVELOPER_DOCS_URL,
} from "./scriptureflow-client.js";

export type Mode = "catalog" | "catalogSummary" | "passage" | "validate_reference" | "translation_books";
export type RecordType = "translation" | "catalogSummary" | "verse" | "validation" | "error" | "book";

export interface SourceObject {
  provider: "ScriptureFlow";
  endpoint: string | null;
  docsUrl: string;
  apiCtaUrl: string;
  retrievedAt: string;
}

export function buildSource(endpoint: string | null, retrievedAt: string): SourceObject {
  return {
    provider: "ScriptureFlow",
    endpoint,
    docsUrl: SCRIPTUREFLOW_DEVELOPER_DOCS_URL,
    apiCtaUrl: SCRIPTUREFLOW_API_CTA_URL,
    retrievedAt,
  };
}

export function extractTranslations(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);

  if (isRecord(payload)) {
    if (Array.isArray(payload.translations)) return payload.translations.filter(isRecord);
    if (Array.isArray(payload.value)) return payload.value.filter(isRecord);
  }

  return [];
}

export function normalizeTranslationRows(
  translations: Record<string, unknown>[],
  options: {
    mode: "catalog";
    endpoint: string;
    retrievedAt: string;
    languageCode?: string;
    search?: string;
    fullBibleOnly?: boolean;
    maxResults: number;
  }
): Record<string, unknown>[] {
  const languageFilter = options.languageCode?.trim().toLowerCase();
  const searchFilter = normalizeCatalogSearchText(options.search);
  const source = buildSource(options.endpoint, options.retrievedAt);

  return translations
    .filter((translation) => {
      if (languageFilter && String(translation.language_code ?? translation.languageCode ?? "").toLowerCase() !== languageFilter) {
        return false;
      }

      if (options.fullBibleOnly === true && !isFullBibleTranslation(translation)) {
        return false;
      }

      if (!searchFilter) return true;

      return searchableCatalogValues(translation).some((value) => {
        const normalizedValue = normalizeCatalogSearchText(value);
        return catalogValueMatchesSearch(normalizedValue, searchFilter);
      });
    })
    .slice(0, options.maxResults)
    .map((translation) => ({
      recordType: "translation",
      mode: options.mode,
      source,
      translationId: stringOrNull(translation.version ?? translation.id),
      languageCode: stringOrNull(translation.language_code ?? translation.languageCode),
      translationName: normalizeCatalogTranslationName(translation.translation_name ?? translation.translationName ?? translation.name ?? translation.version),
      status: stringOrNull(translation.status),
      booksFound: numberOrNull(translation.books_found ?? translation.booksFound),
      chaptersFound: numberOrNull(translation.chapters_found ?? translation.chaptersFound),
      versesFound: numberOrNull(translation.verses_found ?? translation.versesFound),
      versesIndexType: stringOrNull(translation.verses_index_type ?? translation.versesIndexType),
    }));
}

export function normalizeCatalogSummaryRow(
  translations: Record<string, unknown>[],
  options: {
    mode: "catalogSummary";
    endpoint: string;
    retrievedAt: string;
    discoveredTranslations?: number | null;
    readyTranslations?: number | null;
  }
): Record<string, unknown> {
  const languageCounts = new Map<string, number>();
  let fullBibleCount = 0;
  let newTestamentOnlyCount = 0;

  for (const translation of translations) {
    const languageCode = stringOrNull(translation.language_code ?? translation.languageCode) ?? "unknown";
    languageCounts.set(languageCode, (languageCounts.get(languageCode) ?? 0) + 1);

    if (isFullBibleTranslation(translation)) fullBibleCount += 1;
    if (isNewTestamentOnlyTranslation(translation)) newTestamentOnlyCount += 1;
  }

  return {
    recordType: "catalogSummary",
    mode: options.mode,
    discoveredTranslations: options.discoveredTranslations ?? null,
    readyTranslations: options.readyTranslations ?? translations.length,
    totalTranslations: translations.length,
    languageCount: languageCounts.size,
    fullBibleCount,
    partialTranslationCount: translations.length - fullBibleCount,
    newTestamentOnlyCount,
    topLanguages: [...languageCounts.entries()]
      .sort((left, right) => {
        const countDelta = right[1] - left[1];
        if (countDelta !== 0) return countDelta;
        return left[0].localeCompare(right[0]);
      })
      .slice(0, 10)
      .map(([languageCode, translationCount]) => ({ languageCode, translationCount })),
    source: buildSource(options.endpoint, options.retrievedAt),
  };
}

export function normalizeBookRows(
  chapters: Record<string, unknown>[],
  options: { mode: "translation_books"; translationId: string; endpoint: string; retrievedAt: string; maxResults: number }
): Record<string, unknown>[] {
  const source = buildSource(options.endpoint, options.retrievedAt);
  const groups = new Map<
    string,
    {
      book: string | null;
      bookSlug: string | null;
      canonicalBook: string | null;
      chapters: Set<number>;
      totalVerses: number;
      hasVerseCounts: boolean;
    }
  >();

  for (const chapter of chapters) {
    const book = stringOrNull(chapter.book);
    const bookSlug = stringOrNull(chapter.book_slug);
    const canonicalBook = stringOrNull(chapter.canonical_book);
    const key = bookSlug ?? canonicalBook ?? book;
    if (!key) continue;

    const group = groups.get(key) ?? {
      book: book ?? canonicalBook ?? bookSlug,
      bookSlug,
      canonicalBook,
      chapters: new Set<number>(),
      totalVerses: 0,
      hasVerseCounts: false,
    };

    group.book ??= book ?? canonicalBook ?? bookSlug;
    group.bookSlug ??= bookSlug;
    group.canonicalBook ??= canonicalBook;

    const chapterNumber = numberOrNull(chapter.chapter);
    if (chapterNumber != null) group.chapters.add(chapterNumber);

    const verseCount = numberOrNull(chapter.verse_count);
    if (verseCount != null) {
      group.totalVerses += verseCount;
      group.hasVerseCounts = true;
    }

    groups.set(key, group);
  }

  return [...groups.values()].slice(0, options.maxResults).map((group) => {
    const chapterNumbers = [...group.chapters].sort((a, b) => a - b);

    return {
      recordType: "book",
      mode: options.mode,
      translationId: options.translationId,
      book: group.book,
      bookSlug: group.bookSlug,
      canonicalBook: group.canonicalBook,
      chaptersFound: chapterNumbers.length,
      firstChapter: chapterNumbers[0] ?? null,
      lastChapter: chapterNumbers.at(-1) ?? null,
      totalVerses: group.hasVerseCounts ? group.totalVerses : null,
      source,
    };
  });
}

export function normalizeVerseRows(
  payload: unknown,
  options: {
    mode: "passage";
    translationId: string;
    inputReference: string | null;
    structuredInput: { book: string; chapter: number | null; verse: number | null; endVerse: number | null } | null;
    includeMetadata: boolean;
    retrievedAt: string;
  }
): Record<string, unknown>[] {
  const verses = extractVerseRecords(payload);
  const source = buildSource(PASSAGE_ENDPOINT, options.retrievedAt);

  return verses.map((verse) => {
    const row: Record<string, unknown> = {
      recordType: "verse",
      mode: options.mode,
      source,
      valid: true,
      translationId: stringOrNull(verse.version) ?? options.translationId,
      reference: stringOrNull(verse.reference),
      book: stringOrNull(verse.book ?? verse.book_slug ?? verse.canonical_book),
      bookSlug: stringOrNull(verse.book_slug),
      canonicalBook: stringOrNull(verse.canonical_book),
      chapter: numberOrNull(verse.chapter),
      verse: numberOrNull(verse.verse),
      text: typeof verse.text === "string" ? verse.text : "",
    };

    if (options.includeMetadata) {
      row.metadata = {
        id: stringOrNull(verse.id),
        sourcePath: stringOrNull(verse.source_path),
        apiPath: stringOrNull(verse.api_path),
        inputReference: options.inputReference,
        inputBook: options.structuredInput?.book ?? null,
        inputChapter: options.structuredInput?.chapter ?? null,
        inputVerse: options.structuredInput?.verse ?? null,
        inputEndVerse: options.structuredInput?.endVerse ?? null,
      };
    }

    return row;
  });
}

export function normalizeValidationRow(
  payload: unknown,
  options: { translationId: string; inputReference: string; retrievedAt: string }
): Record<string, unknown> {
  const firstVerse = extractVerseRecords(payload)[0] ?? {};
  return {
    recordType: "validation",
    mode: "validate_reference",
    source: buildSource(PASSAGE_ENDPOINT, options.retrievedAt),
    valid: true,
    translationId: stringOrNull(firstVerse.version) ?? options.translationId,
    inputReference: options.inputReference,
    normalizedReference: stringOrNull(firstVerse.reference) ?? options.inputReference,
    book: stringOrNull(firstVerse.book ?? firstVerse.book_slug ?? firstVerse.canonical_book),
    chapter: numberOrNull(firstVerse.chapter),
    verse: numberOrNull(firstVerse.verse),
  };
}

export function normalizeErrorRow(options: {
  mode: Mode;
  endpoint: string | null;
  retrievedAt: string;
  code: string;
  message: string;
  translationId?: string;
  inputReference?: string;
  status?: number;
  details?: unknown;
  valid?: false;
}): Record<string, unknown> {
  return {
    recordType: "error",
    mode: options.mode,
    source: buildSource(options.endpoint, options.retrievedAt),
    valid: options.valid ?? false,
    errorCode: options.code,
    message: options.message,
    translationId: options.translationId ?? null,
    inputReference: options.inputReference ?? null,
    status: options.status ?? null,
    details: options.details ?? null,
  };
}

function extractVerseRecords(payload: unknown): Record<string, unknown>[] {
  if (!isRecord(payload)) return [];

  const payloadRecord = payload as Record<string, unknown>;
  if (Array.isArray(payloadRecord.results)) return payloadRecord.results.filter(isRecord);
  if (Array.isArray(payloadRecord.verses)) return payloadRecord.verses.filter(isRecord);
  if (Array.isArray(payloadRecord.result)) return payloadRecord.result.filter(isRecord);
  if (isRecord(payloadRecord.result)) return [payloadRecord.result];

  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberOrNull(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function searchableCatalogValues(translation: Record<string, unknown>): string[] {
  return [
    translation.version,
    translation.id,
    translation.translation_name,
    translation.name,
    translation.language_name,
    translation.languageName,
    translation.language_code,
    translation.languageCode,
  ].flatMap((value) => {
    const stringValue = stringOrNull(value);
    return stringValue == null ? [] : [stringValue];
  });
}

function normalizeCatalogSearchText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

function normalizeCatalogTranslationName(value: unknown): string | null {
  const name = stringOrNull(value);
  if (!name) return null;

  if (name === "Duay-Rheims American Edition  1899 [eng] USA") {
    return "Douay-Rheims American Edition 1899";
  }

  return name.replace(/\s+/gu, " ").trim();
}

function catalogValueMatchesSearch(normalizedValue: string, searchFilter: string): boolean {
  if (normalizedValue.includes(searchFilter)) return true;

  const searchTokens = searchFilter.split(/\s+/u).filter(Boolean);
  const valueTokens = normalizedValue.split(/\s+/u).filter(Boolean);

  if (searchTokens.length === 0 || valueTokens.length === 0) return false;

  return searchTokens.every((searchToken) => {
    if (searchToken.length < 5) return false;

    return valueTokens.some((valueToken) => {
      return valueToken.length >= 4 && levenshteinDistance(searchToken, valueToken) <= 1;
    });
  });
}

function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const current = [leftIndex + 1];

    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex] === right[rightIndex] ? 0 : 1;
      current[rightIndex + 1] = Math.min(
        current[rightIndex] + 1,
        previous[rightIndex + 1] + 1,
        previous[rightIndex] + substitutionCost
      );
    }

    for (let index = 0; index < current.length; index += 1) {
      previous[index] = current[index];
    }
  }

  return previous[right.length] ?? 0;
}

function isFullBibleTranslation(translation: Record<string, unknown>): boolean {
  const booksFound = numberOrNull(translation.books_found ?? translation.booksFound);
  const chaptersFound = numberOrNull(translation.chapters_found ?? translation.chaptersFound);

  return booksFound != null && chaptersFound != null && booksFound >= 66 && chaptersFound >= 1189;
}

function isNewTestamentOnlyTranslation(translation: Record<string, unknown>): boolean {
  const booksFound = numberOrNull(translation.books_found ?? translation.booksFound);
  const chaptersFound = numberOrNull(translation.chapters_found ?? translation.chaptersFound);

  return booksFound === 27 && chaptersFound === 260;
}
