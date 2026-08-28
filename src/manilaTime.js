export const MANILA_TIME_ZONE = 'Asia/Manila';

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function pad2(value) {
  return String(value).padStart(2, '0');
}

function finiteTimestamp(value = Date.now()) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

function shiftedManilaDate(timestamp = Date.now()) {
  return new Date(finiteTimestamp(timestamp) + MANILA_OFFSET_MS);
}

export function manilaDateKey(timestamp = Date.now()) {
  const date = shiftedManilaDate(timestamp);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

export function parseManilaDateKey(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const carrier = new Date(Date.UTC(year, month - 1, day));

  if (
    carrier.getUTCFullYear() !== year ||
    carrier.getUTCMonth() !== month - 1 ||
    carrier.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    year,
    month,
    day,
    key: `${year}-${pad2(month)}-${pad2(day)}`
  };
}

export function manilaDateKeyToStartMs(value) {
  const parsed = parseManilaDateKey(value);
  if (!parsed) return NaN;
  return Date.UTC(parsed.year, parsed.month - 1, parsed.day) - MANILA_OFFSET_MS;
}

export function manilaStartOfDayMs(timestamp = Date.now()) {
  return manilaDateKeyToStartMs(manilaDateKey(timestamp));
}

export function addManilaDays(value, amount) {
  const parsed = parseManilaDateKey(value);
  if (!parsed) return null;
  const carrier = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + Number(amount || 0)));
  return `${carrier.getUTCFullYear()}-${pad2(carrier.getUTCMonth() + 1)}-${pad2(carrier.getUTCDate())}`;
}

export function manilaMonthStartKey(timestamp = Date.now()) {
  return `${manilaDateKey(timestamp).slice(0, 7)}-01`;
}

export function manilaWeekday(timestamp = Date.now()) {
  return shiftedManilaDate(timestamp).getUTCDay();
}

export function manilaHour(timestamp = Date.now()) {
  return shiftedManilaDate(timestamp).getUTCHours();
}

export function formatManilaDate(timestamp, options = {}) {
  return new Intl.DateTimeFormat([], {
    ...options,
    timeZone: MANILA_TIME_ZONE
  }).format(new Date(finiteTimestamp(timestamp)));
}

export function formatManilaDateTime(timestamp, options = {}) {
  return new Intl.DateTimeFormat([], {
    ...options,
    timeZone: MANILA_TIME_ZONE
  }).format(new Date(finiteTimestamp(timestamp)));
}

export function manilaDayDurationMs() {
  return DAY_MS;
}
