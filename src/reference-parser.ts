import { UserInputError } from "./errors.js";

export interface ParsedReference {
  original: string;
  normalizedReference: string;
  book: string;
  chapter: number;
  verse?: number;
  endVerse?: number;
}

const BOOK_WITH_CHAPTER_VERSE = /^((?:[1-3]\s+)?[A-Za-z][A-Za-z .'-]*?)\s+(\d{1,3})\s*:\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?$/u;
const BOOK_WITH_CHAPTER = /^((?:[1-3]\s+)?[A-Za-z][A-Za-z .'-]*?)\s+(\d{1,3})$/u;

export function parseReference(reference: unknown): ParsedReference {
  const raw = String(reference ?? "").trim().replace(/\s+/gu, " ");

  if (!raw) {
    throw new UserInputError("INVALID_REFERENCE", "Reference is required.");
  }

  if (/[;,]/u.test(raw) || /\bthrough\b/iu.test(raw)) {
    throw new UserInputError(
      "UNSUPPORTED_REFERENCE_FORMAT",
      "Unsupported reference format for Phase 1. Use a single simple reference such as John 3:16 or John 3:16-18."
    );
  }

  if (/^\S+\s+\d+\s*-\s*\d+$/u.test(raw)) {
    throw new UserInputError(
      "UNSUPPORTED_REFERENCE_FORMAT",
      "Chapter ranges are not supported in Phase 1."
    );
  }

  const passageMatch = raw.match(BOOK_WITH_CHAPTER_VERSE);
  if (passageMatch) {
    const book = passageMatch[1].trim();
    const chapter = Number(passageMatch[2]);
    const verse = Number(passageMatch[3]);
    const endVerse = passageMatch[4] == null ? undefined : Number(passageMatch[4]);

    if (endVerse != null && endVerse < verse) {
      throw new UserInputError("INVALID_REFERENCE", "End verse must be greater than or equal to the starting verse.");
    }

    return {
      original: raw,
      normalizedReference: `${book} ${chapter}:${verse}${endVerse == null ? "" : `-${endVerse}`}`,
      book,
      chapter,
      verse,
      endVerse,
    };
  }

  const chapterMatch = raw.match(BOOK_WITH_CHAPTER);
  if (chapterMatch) {
    const book = chapterMatch[1].trim();
    const chapter = Number(chapterMatch[2]);

    return {
      original: raw,
      normalizedReference: `${book} ${chapter}`,
      book,
      chapter,
    };
  }

  throw new UserInputError(
    "UNSUPPORTED_REFERENCE_FORMAT",
    "Unsupported reference format for Phase 1. Supported examples include John 3:16, John 3:16-18, Psalm 23, and 1 John 1:9."
  );
}
