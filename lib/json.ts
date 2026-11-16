// SQLite stores list fields as JSON strings. These helpers never throw.
export function parseList<T = string>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function toJson(value: unknown): string {
  return JSON.stringify(value ?? []);
}
