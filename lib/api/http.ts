import { NextResponse } from "next/server";
import type { z } from "zod";

import { ConflictError, NotFoundError, ValidationError } from "../server/errors";

export type Parsed<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/** Parses a JSON body against a schema; a malformed body or invalid field is a 400 naming the problem. */
export async function parseBody<S extends z.ZodTypeAny>(request: Request, schema: S, { optional = false } = {}): Promise<Parsed<z.infer<S>>> {
  let raw: unknown;
  const text = await request.text();
  if (!text.trim()) raw = optional ? {} : undefined;
  else {
    try {
      raw = JSON.parse(text);
    } catch {
      return { ok: false, response: error(400, "The request body is not valid JSON.") };
    }
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
    return { ok: false, response: error(400, `${where}${issue?.message ?? "Invalid request."}`, result.error.issues.slice(0, 5)) };
  }
  return { ok: true, data: result.data };
}

export function error(status: number, message: string, details?: unknown): NextResponse {
  return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status });
}

/** Maps a thrown error to its HTTP status: typed errors keep theirs; anything else is a 500. */
export function fromError(e: unknown): NextResponse {
  if (e instanceof NotFoundError || e instanceof ConflictError || e instanceof ValidationError) return error(e.status, e.message);
  console.error(e);
  return error(500, "Something went wrong on the server. Your work is saved; please try again.");
}
