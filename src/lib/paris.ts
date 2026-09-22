/** Everything the app timestamps is expressed in Europe/Paris, whatever the
 *  clock of the machine hosting it. Node ships full ICU since 13, so the
 *  Intl time zone is reliable without extra dependencies. */
export const TZ = "Europe/Paris";

function parts(date: Date): Record<string, string> {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
}

/** "2026-09-22" — the submissions/ sub-directory for the day. */
export function parisDate(date: Date): string {
  const p = parts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

/** "18-47-03" — filename-safe, sorts chronologically inside a day. */
export function parisTimeForFile(date: Date): string {
  const p = parts(date);
  return `${p.hour}-${p.minute}-${p.second}`;
}

/** "22/09/2026 18:47" — for the on-screen summary and the PDF header. */
export function parisHuman(date: Date): string {
  const p = parts(date);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/** Offset as "+02:00" / "+01:00", so the ISO stamp is a real Paris instant
 *  rather than UTC wearing a local label. */
function parisOffset(date: Date): string {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")?.value;
  const match = name?.match(/GMT([+-]\d{2}:\d{2})/);
  return match ? match[1] : "+00:00";
}

/** "2026-09-22T18:47:03+02:00" — ISO 8601 with the Paris offset. */
export function parisIso(date: Date): string {
  const p = parts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${parisOffset(date)}`;
}
