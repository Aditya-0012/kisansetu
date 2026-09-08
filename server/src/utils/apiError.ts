/**
 * A typed error the error-handling middleware knows how to render safely.
 * Anything thrown that ISN'T an ApiError is treated as an unexpected bug and
 * masked behind a generic "Something went wrong" message (see
 * middleware/errorHandler.ts) — we never leak stack traces or raw DB errors
 * to the client (spec section 60).
 */
export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, "BAD_REQUEST", message, details);
  }
  static unauthorized(message = "Authentication required") {
    return new ApiError(401, "UNAUTHORIZED", message);
  }
  static forbidden(message = "You don't have permission to do that") {
    return new ApiError(403, "FORBIDDEN", message);
  }
  static notFound(message = "Not found") {
    return new ApiError(404, "NOT_FOUND", message);
  }
  static conflict(message: string) {
    return new ApiError(409, "CONFLICT", message);
  }
  static internal(message = "Something went wrong") {
    return new ApiError(500, "INTERNAL", message);
  }
}
