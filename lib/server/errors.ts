/** Typed failures the API layer turns into the right HTTP status. */
export class NotFoundError extends Error {
  readonly status = 404;
}
export class ConflictError extends Error {
  readonly status = 409;
}
export class ValidationError extends Error {
  readonly status = 400;
}
export type HttpError = NotFoundError | ConflictError | ValidationError;
