const JST = "Asia/Tokyo";

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: JST,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: JST,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const longFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: JST,
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/** YYYY-MM-DD in Asia/Tokyo */
export function jstDateKey(input: number | Date): string {
  return dateFmt.format(new Date(input));
}

/** HH:mm in Asia/Tokyo */
export function jstTime(input: number | Date): string {
  return timeFmt.format(new Date(input));
}

export function jstLong(input: number | Date): string {
  return longFmt.format(new Date(input));
}

/**
 * Build a UTC timestamp from a Tokyo wall-clock date and time.
 * Japan has no DST, so a fixed +09:00 offset is exact.
 */
export function jstToUtc(dateKey: string, time = "10:00"): number {
  return Date.parse(`${dateKey}T${time}:00+09:00`);
}

export function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMinutes(ms: number, minutes: number): number {
  return ms + minutes * 60_000;
}

export function dayRangeUtc(dateKey: string): { from: number; to: number } {
  return { from: jstToUtc(dateKey, "00:00"), to: jstToUtc(dateKey, "23:59") };
}

export function formatJpy(amount: number): string {
  return `¥${Math.round(amount).toLocaleString("en-US")}`;
}

export function formatDuration(hours: number): string {
  return hours === 1 ? "1 hour" : `${hours} hours`;
}
