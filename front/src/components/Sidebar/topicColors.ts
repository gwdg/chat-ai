import type { FolderRow } from "../../db/dbTypes";

/**
 * Topic colours.
 *
 * A topic's colour is the only chromatic signal in an otherwise near-achromatic
 * sidebar, so the eight hues are spaced far enough apart to stay distinct at an
 * 8px dot, and kept clear of the accent blue so a colour tag never reads as
 * "selected".
 *
 * A topic without an explicit colour gets one derived from its id, so topics
 * created before this field existed still look intentional and keep the same
 * colour on every render and every device — no backfill required.
 */
export type TopicColorId =
  | "rose"
  | "orange"
  | "amber"
  | "emerald"
  | "teal"
  | "cyan"
  | "violet"
  | "fuchsia";

export const TOPIC_COLORS: { id: TopicColorId; label: string; hex: string }[] = [
  { id: "rose", label: "Rose", hex: "#E11D48" },
  { id: "orange", label: "Orange", hex: "#EA580C" },
  { id: "amber", label: "Amber", hex: "#D97706" },
  { id: "emerald", label: "Emerald", hex: "#059669" },
  { id: "teal", label: "Teal", hex: "#0D9488" },
  { id: "cyan", label: "Cyan", hex: "#0891B2" },
  { id: "violet", label: "Violet", hex: "#7C3AED" },
  { id: "fuchsia", label: "Fuchsia", hex: "#C026D3" },
];

const BY_ID = new Map(TOPIC_COLORS.map((c) => [c.id, c]));

/** Resolve a colour by id, falling back to the first swatch. */
export function topicColorById(id?: string | null) {
  return (id && BY_ID.get(id as TopicColorId)) || TOPIC_COLORS[0];
}

/** Stable, order-independent index so a topic keeps its colour forever. */
function hashToIndex(seed: string, buckets: number) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % buckets;
}

export function topicColor(topic: Pick<FolderRow, "id" | "color">) {
  const explicit = topic?.color
    ? BY_ID.get(topic.color as TopicColorId)
    : undefined;
  if (explicit) return explicit;
  return TOPIC_COLORS[hashToIndex(topic?.id ?? "", TOPIC_COLORS.length)];
}

/** `#RRGGBB` -> `rgba(r, g, b, a)`, for tints that must sit on either theme. */
export function withAlpha(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Background of a coloured group row (topic, workspace). A light version of the
 * group colour so the row still reads as a name, not as a button. The resting
 * wash stays close to the sidebar background — the open group, at 16% (20% in
 * dark mode), is what carries the colour, and the quieter rest is what makes
 * that difference visible.
 */
export function groupRowTint(
  hex: string,
  isDark: boolean,
  { active = false, hover = false } = {},
) {
  const alpha = isDark
    ? active
      ? 0.2
      : hover
        ? 0.13
        : 0.09
    : active
      ? 0.16
      : hover
        ? 0.09
        : 0.06;
  return withAlpha(hex, alpha);
}

/** Colour of the vertical rules bracketing the chats under a group, left and right. */
export function groupRule(hex: string, isDark: boolean) {
  return withAlpha(hex, isDark ? 0.5 : 0.35);
}

/**
 * Background of the Unsorted Chats group — the one group with no colour of its own.
 * Slate at a topic's strength reads as one of the grey section bands (CHATS,
 * WORKSPACES, AGENTS), so this row keeps within a step of the sidebar's own colour:
 * a trace at rest, a hint on hover and a touch more when it is the open group.
 * `chat` is the row inside it: it stays below the group's open and hover washes, so
 * it still reads as part of the group — but it may lead the resting group, whose
 * wash is only a trace; otherwise an open chat would be invisible.
 */
export function neutralRowTint(
  isDark: boolean,
  { active = false, hover = false, chat = false } = {},
) {
  const ink = isDark ? "148, 163, 184" : "15, 23, 42";
  if (chat) {
    const alpha = isDark
      ? active
        ? 0.085
        : hover
          ? 0.05
          : 0.03
      : active
        ? 0.045
        : hover
          ? 0.025
          : 0.012;
    return `rgba(${ink}, ${alpha})`;
  }
  const alpha = isDark
    ? active
      ? 0.11
      : hover
        ? 0.06
        : 0.035
    : active
      ? 0.06
      : hover
        ? 0.03
        : 0.015;
  return `rgba(${ink}, ${alpha})`;
}

/**
 * Background of a chat row inside a group. Deliberately weaker than the
 * group's own wash — about two thirds of it — so the open chat reads as a
 * highlight inside the topic instead of competing with the topic's name.
 */
export function chatRowTint(
  hex: string,
  isDark: boolean,
  { active = false, hover = false } = {},
) {
  const alpha = isDark
    ? active
      ? 0.08
      : hover
        ? 0.06
        : 0.05
    : active
      ? 0.05
      : hover
        ? 0.04
        : 0.03;
  return withAlpha(hex, alpha);
}
