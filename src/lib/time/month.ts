const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function dateInMexicoCity(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function monthInMexicoCity(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

export function isMonthKey(value: string): boolean {
  return MONTH_PATTERN.test(value);
}
