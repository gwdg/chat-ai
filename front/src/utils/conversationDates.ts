export type DateBucketKey =
  | "today"
  | "yesterday"
  | "lastWeek"
  | "lastMonth"
  | "older";

export const DATE_BUCKET_ORDER: DateBucketKey[] = [
  "today",
  "yesterday",
  "lastWeek",
  "lastMonth",
  "older",
];

type ConversationLike = {
  createdAt?: number;
  lastModified?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function conversationModifiedAt(
  conversation: ConversationLike,
): number {
  return conversation.lastModified ?? conversation.createdAt ?? 0;
}

function startOfToday(now: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function getDateBucket(
  timestamp: number,
  now: number = Date.now(),
): DateBucketKey {
  const today = startOfToday(now);
  if (timestamp >= today) return "today";
  if (timestamp >= today - DAY_MS) return "yesterday";
  if (timestamp >= today - 7 * DAY_MS) return "lastWeek";
  if (timestamp >= today - 30 * DAY_MS) return "lastMonth";
  return "older";
}

export function groupConversationsByDate<T extends ConversationLike>(
  conversations: T[],
  now: number = Date.now(),
) {
  const buckets = new Map<DateBucketKey, T[]>();
  for (const key of DATE_BUCKET_ORDER) buckets.set(key, []);

  for (const conversation of conversations) {
    const timestamp = conversationModifiedAt(conversation);
    buckets.get(getDateBucket(timestamp, now))!.push(conversation);
  }

  return DATE_BUCKET_ORDER.map((key) => ({
    key,
    conversations: buckets
      .get(key)!
      .sort(
        (a, b) => conversationModifiedAt(b) - conversationModifiedAt(a),
      ),
  })).filter((bucket) => bucket.conversations.length > 0);
}

export function formatCompactDate(
  timestamp: number,
  locale: string = "en",
): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(locale, {
    ...(sameYear ? {} : { year: "numeric" }),
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatModifiedTime(
  timestamp: number,
  locale: string = "en",
  now: number = Date.now(),
): string {
  if (!timestamp) return "";
  const bucket = getDateBucket(timestamp, now);
  const date = new Date(timestamp);

  if (bucket === "today" || bucket === "yesterday") {
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  if (bucket === "lastWeek") {
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat(locale, {
    ...(sameYear ? {} : { year: "numeric" }),
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatRelativeTime(
  timestamp: number,
  locale: string = "en",
  now: number = Date.now(),
): string {
  if (!timestamp) return "";
  const diff = timestamp - now;
  const absolute = Math.abs(diff);
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (absolute < 45 * 1000) return relative.format(0, "second");
  if (absolute < 60 * 60 * 1000) {
    return relative.format(Math.round(diff / (60 * 1000)), "minute");
  }
  if (absolute < DAY_MS) {
    return relative.format(Math.round(diff / (60 * 60 * 1000)), "hour");
  }
  if (absolute < 7 * DAY_MS) {
    return relative.format(Math.round(diff / DAY_MS), "day");
  }
  return formatCompactDate(timestamp, locale);
}

export function formatFullTimestamp(
  timestamp: number,
  locale: string = "en",
): string {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleString(locale);
}
