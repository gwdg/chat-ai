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
 * The same two rules painted as a gradient: the group colour at full rule
 * strength where the first chat starts, a little lighter under the last one —
 * enough to read as light rather than a hard bar, not enough to disappear.
 * The far stop keeps 60% of the near one, and the whole rule sits a step below
 * the old solid border so it stays a hint rather than a bar.
 */
export function groupRuleGradient(hex: string, isDark: boolean) {
  const near = isDark ? 0.4 : 0.28;
  return `linear-gradient(to bottom, ${withAlpha(
    hex,
    near,
  )}, ${withAlpha(hex, near * 0.6)})`;
}

/** The Unsorted Chats trace, easing off the same way. */
export function neutralRuleGradient(isDark: boolean) {
  return `linear-gradient(to bottom, rgba(${
    isDark ? "148, 163, 184" : "15, 23, 42"
  }, 0.05), rgba(${isDark ? "148, 163, 184" : "15, 23, 42"}, 0.03))`;
}

/**
 * Background of the Unsorted Chats group — the one group with no colour of its own.
 * Slate at a topic's strength reads as one of the grey section bands (CHATS,
 * WORKSPACES, AGENTS), so this row is the sidebar's own colour at rest, and the
 * open group is only the lightest possible grey — always paler than a band.
 * `chat` is the row inside it: it stays below the group's open wash, so it still
 * reads as part of the group; it is the only thing on the row, so it does not
 * need a wash of its own at rest.
 */
export function neutralRowTint(
  isDark: boolean,
  { active = false, hover = false, chat = false } = {},
) {
  const ink = isDark ? "148, 163, 184" : "15, 23, 42";
  if (chat) {
    const alpha = isDark
      ? active
        ? 0.035
        : hover
          ? 0.025
          : 0.015
      : active
        ? 0.01
        : hover
          ? 0.005
          : 0;
    return `rgba(${ink}, ${alpha})`;
  }
  const alpha = isDark
    ? active
      ? 0.06
      : hover
        ? 0.04
        : 0.02
    : active
      ? 0.015
      : hover
        ? 0.008
        : 0;
  return `rgba(${ink}, ${alpha})`;
}

/**
 * The vertical rules bracketing the chats under Unsorted Chats. They carry the
 * group's colour everywhere else, and a colourless group would otherwise show
 * the grey of the slate default — two lines louder than the row they bracket.
 */
export function neutralRule(isDark: boolean) {
  return isDark ? "rgba(148, 163, 184, 0.18)" : "rgba(15, 23, 42, 0.06)";
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
