// Dates are stored at local noon and shown as YYYY-MM-DD in local time, so they never shift a day.
const pad = (n: number) => String(n).padStart(2, "0");

export const dateOnly = (d: Date | null | undefined) =>
  d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "";

export const toDate = (s: string) => (s ? new Date(`${s}T12:00:00`) : null);

export const todayStr = () => dateOnly(new Date());

export const addDays = (s: string, n: number) => {
  const d = toDate(s)!;
  d.setDate(d.getDate() + n);
  return dateOnly(d);
};

export const daysBetween = (from: string, to: string) => Math.round((toDate(to)!.getTime() - toDate(from)!.getTime()) / 86_400_000);
