import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AiError } from "@/lib/ai";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(error: string, status = 400, fieldErrors?: Record<string, string[]>) {
  return NextResponse.json({ error, fieldErrors }, { status });
}

export async function readBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ZodError([{ code: "custom", message: "Body must be JSON", path: [] }]);
  }
  return schema.parse(raw);
}

// Wrap a route handler so validation, AI and unexpected errors all return clean JSON.
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ZodError) {
        const fieldErrors: Record<string, string[]> = {};
        for (const issue of err.issues) {
          const key = issue.path.join(".") || "_";
          (fieldErrors[key] ??= []).push(issue.message);
        }
        return fail("Please fix the highlighted fields.", 422, fieldErrors);
      }
      if (err instanceof AiError) return fail(err.message, err.status);
      console.error(err);
      return fail(err instanceof Error ? err.message : "Something went wrong.", 500);
    }
  };
}
