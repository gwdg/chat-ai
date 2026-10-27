// Seasonal screensavers. Dates are { month (1-12), day } and the range may
// wrap around the new year. Only the gate below is bundled eagerly; the
// overlay itself is lazy-loaded inside the timeframe.

export const SNOW_START = { month: 12, day: 1 };
export const SNOW_END = { month: 1, day: 31 };
export const SNOW_IDLE_MS = 5 * 60 * 1000;

const toKey = ({ month, day }) => month * 100 + day;

export function isWithinSeason(start, end, date = new Date()) {
  const now = toKey({ month: date.getMonth() + 1, day: date.getDate() });
  const from = toKey(start);
  const to = toKey(end);
  return from <= to ? now >= from && now <= to : now >= from || now <= to;
}

export const isSnowSeason = (date) => isWithinSeason(SNOW_START, SNOW_END, date);
