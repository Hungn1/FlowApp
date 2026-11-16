// Small fetch wrapper: always returns parsed JSON or throws an Error with a readable message.
export class ApiError extends Error {
  constructor(message: string, public status: number, public fieldErrors?: Record<string, string[]>) {
    super(message);
  }
}

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...rest.headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError("Can't reach the ApplyFlow server. Is `npm run dev` still running?", 0);
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const d = data as { error?: string; fieldErrors?: Record<string, string[]> } | null;
    throw new ApiError(d?.error ?? `Request failed (${res.status})`, res.status, d?.fieldErrors);
  }
  return data as T;
}
