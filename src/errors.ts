export type UserErrorCode =
  | "INVALID_INPUT"
  | "INVALID_MODE"
  | "INVALID_TRANSLATION"
  | "INVALID_REFERENCE"
  | "UNSUPPORTED_REFERENCE_FORMAT"
  | "REFERENCE_NOT_FOUND"
  | "EMPTY_RESULT";

export class UserInputError extends Error {
  readonly code: UserErrorCode;
  readonly status?: number;
  readonly details?: unknown;

  constructor(code: UserErrorCode, message: string, options: { status?: number; details?: unknown } = {}) {
    super(message);
    this.name = "UserInputError";
    this.code = code;
    this.status = options.status;
    this.details = options.details;
  }
}

export class InfrastructureError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly details?: unknown;

  constructor(code: string, message: string, options: { status?: number; details?: unknown } = {}) {
    super(message);
    this.name = "InfrastructureError";
    this.code = code;
    this.status = options.status;
    this.details = options.details;
  }
}

export function isUserInputError(error: unknown): error is UserInputError {
  return error instanceof UserInputError;
}
