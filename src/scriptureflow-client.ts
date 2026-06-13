import { InfrastructureError, UserInputError } from "./errors.js";

export const SCRIPTUREFLOW_API_BASE_URL = "https://scriptureflow-api-preview.pages.dev";
export const SCRIPTUREFLOW_DEVELOPER_DOCS_URL = "https://scriptureflow-dev-docs.pages.dev";
export const SCRIPTUREFLOW_API_CTA_URL =
  "https://scriptureflow-dev-docs.pages.dev?utm_source=apify&utm_medium=actor&utm_campaign=scriptureflow_bible_data";

export const STATUS_ENDPOINT = "/status.json";
export const TRANSLATIONS_ENDPOINT = "/translations.json";
export const PUBLIC_CATALOG_ENDPOINT = "/public-catalog.json";
export const PASSAGE_ENDPOINT = "/api/verse";

const REQUEST_TIMEOUT_MS = 8000;
const TOTAL_REQUEST_BUDGET_MS = 30000;
const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

export interface FetchResult {
  endpoint: string;
  status: number;
  payload: unknown;
}

function joinUrl(baseUrl: string, endpoint: string): string {
  const base = baseUrl.replace(/\/+$/u, "");
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number): number {
  if (attempt === 2) return 500 + Math.floor(Math.random() * 501);
  return 1500 + Math.floor(Math.random() * 1501);
}

function isRetryableNetworkError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("timeout") || message.includes("econnreset") || message.includes("socket hang up");
}

export class ScriptureFlowClient {
  readonly baseUrl: string;

  constructor(baseUrl = SCRIPTUREFLOW_API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async fetchJson(endpoint: string): Promise<FetchResult> {
    const started = Date.now();
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      if (attempt > 1) {
        await delay(backoffMs(attempt));
      }

      const elapsed = Date.now() - started;
      if (elapsed >= TOTAL_REQUEST_BUDGET_MS) {
        throw new InfrastructureError("REQUEST_BUDGET_EXCEEDED", `ScriptureFlow request budget exceeded for ${endpoint}.`, {
          details: { endpoint, elapsedMs: elapsed },
        });
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Math.min(REQUEST_TIMEOUT_MS, TOTAL_REQUEST_BUDGET_MS - elapsed));

      try {
        const response = await fetch(joinUrl(this.baseUrl, endpoint), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const body = await response.text();
        clearTimeout(timeout);

        let payload: unknown;
        try {
          payload = body ? JSON.parse(body) : null;
        } catch (error) {
          if (response.status === 400 || response.status === 404) {
            throw new UserInputError(
              response.status === 404 ? "REFERENCE_NOT_FOUND" : "INVALID_REFERENCE",
              `ScriptureFlow returned HTTP ${response.status} for ${endpoint}.`,
              {
                status: response.status,
                details: {
                  endpoint,
                  preview: body.slice(0, 160),
                  error: error instanceof Error ? error.message : String(error),
                },
              }
            );
          }

          throw new InfrastructureError("MALFORMED_JSON", `ScriptureFlow returned malformed JSON for ${endpoint}.`, {
            status: response.status,
            details: { endpoint, preview: body.slice(0, 160), error: error instanceof Error ? error.message : String(error) },
          });
        }

        if (response.ok) {
          return { endpoint, status: response.status, payload };
        }

        if (response.status === 400 || response.status === 404) {
          throw new UserInputError(
            response.status === 404 ? "REFERENCE_NOT_FOUND" : "INVALID_REFERENCE",
            extractErrorMessage(payload, `ScriptureFlow returned HTTP ${response.status} for ${endpoint}.`),
            { status: response.status, details: payload }
          );
        }

        if (!RETRYABLE_STATUS_CODES.has(response.status)) {
          throw new InfrastructureError("HTTP_ERROR", `ScriptureFlow returned HTTP ${response.status} for ${endpoint}.`, {
            status: response.status,
            details: payload,
          });
        }

        lastError = new InfrastructureError("RETRYABLE_HTTP_ERROR", `ScriptureFlow returned HTTP ${response.status} for ${endpoint}.`, {
          status: response.status,
          details: payload,
        });
      } catch (error) {
        clearTimeout(timeout);

        if (error instanceof UserInputError || error instanceof InfrastructureError) {
          if (error instanceof InfrastructureError && error.code === "RETRYABLE_HTTP_ERROR") {
            lastError = error;
            continue;
          }
          throw error;
        }

        if (!isRetryableNetworkError(error)) {
          throw new InfrastructureError("NETWORK_ERROR", `ScriptureFlow request failed for ${endpoint}.`, { details: error });
        }

        lastError = error;
      }
    }

    throw new InfrastructureError("REQUEST_FAILED_AFTER_RETRIES", `ScriptureFlow request failed after retries for ${endpoint}.`, {
      details: { lastError: lastError instanceof Error ? lastError.message : lastError },
    });
  }

  async checkStatus(): Promise<void> {
    const { payload } = await this.fetchJson(STATUS_ENDPOINT);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new InfrastructureError("UNEXPECTED_STATUS_SHAPE", "ScriptureFlow status endpoint returned an unexpected shape.");
    }

    const status = payload as Record<string, unknown>;
    if (typeof status.generated_at !== "string" || typeof status.total_ready !== "number") {
      throw new InfrastructureError("UNHEALTHY_STATUS", "ScriptureFlow status endpoint is missing required health fields.", {
        details: payload,
      });
    }
  }

  async fetchCatalog(): Promise<FetchResult> {
    try {
      return await this.fetchJson(PUBLIC_CATALOG_ENDPOINT);
    } catch (error) {
      if (error instanceof UserInputError) {
        return await this.fetchJson(TRANSLATIONS_ENDPOINT);
      }
      throw error;
    }
  }

  async fetchPassage(translationId: string, reference: string): Promise<FetchResult> {
    const params = new URLSearchParams({ version: translationId, reference });
    return this.fetchJson(`${PASSAGE_ENDPOINT}?${params.toString()}`);
  }

  async fetchStructuredPassage(input: {
    translationId: string;
    book: string;
    chapter: number;
    verse: number;
    endVerse?: number;
  }): Promise<FetchResult> {
    const params = new URLSearchParams({
      version: input.translationId,
      book: input.book,
      chapter: String(input.chapter),
      verse: String(input.verse),
    });

    if (input.endVerse != null) {
      params.set("end_verse", String(input.endVerse));
    }

    return this.fetchJson(`${PASSAGE_ENDPOINT}?${params.toString()}`);
  }

  async fetchChapters(translationId: string): Promise<FetchResult> {
    return this.fetchJson(`/${encodeURIComponent(translationId)}/chapters.json`);
  }
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    if (typeof record.error === "string" && record.error.trim()) return record.error;
    if (typeof record.message === "string" && record.message.trim()) return record.message;
  }

  return fallback;
}
