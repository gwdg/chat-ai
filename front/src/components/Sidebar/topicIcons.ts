import {
  Basketball,
  Book,
  Calendar,
  Camera,
  Chemistry,
  Code,
  Education,
  Favorite,
  GameConsole,
  Globe,
  Hashtag,
  Home,
  Idea,
  Microscope,
  Music,
  Pen,
  Plane,
  Portfolio,
  Restaurant,
  Rocket,
  Scales,
  ShoppingCart,
  Sprout,
  Stethoscope,
  Tools,
  UserMultiple,
  Video,
  Wallet,
} from "@carbon/icons-react";

/**
 * Topic icons.
 *
 * Glyphs come from Carbon, matching the rest of the sidebar chrome. The ids are
 * stable strings stored on the topic row, so the visual set can be re-mapped
 * later without touching stored data.
 */
export type TopicIconId = string;

export const TOPIC_ICONS: {
  id: TopicIconId;
  label: string;
  Icon: typeof Hashtag;
}[] = [
  { id: "hash", label: "General", Icon: Hashtag },
  { id: "graduation", label: "Study", Icon: Education },
  { id: "pen", label: "Writing", Icon: Pen },
  { id: "stethoscope", label: "Health", Icon: Stethoscope },
  { id: "microscope", label: "Research", Icon: Microscope },
  { id: "briefcase", label: "Work", Icon: Portfolio },
  { id: "code", label: "Code", Icon: Code },
  { id: "book", label: "Reading", Icon: Book },
  { id: "flask", label: "Experiments", Icon: Chemistry },
  { id: "lightbulb", label: "Ideas", Icon: Idea },
  { id: "rocket", label: "Projects", Icon: Rocket },
  { id: "globe", label: "Travel", Icon: Globe },
  { id: "plane", label: "Trips", Icon: Plane },
  { id: "home", label: "Home", Icon: Home },
  { id: "heart", label: "Personal", Icon: Favorite },
  { id: "dumbbell", label: "Fitness", Icon: Basketball },
  { id: "utensils", label: "Food", Icon: Restaurant },
  { id: "wallet", label: "Money", Icon: Wallet },
  { id: "cart", label: "Shopping", Icon: ShoppingCart },
  { id: "calendar", label: "Planning", Icon: Calendar },
  { id: "users", label: "People", Icon: UserMultiple },
  { id: "music", label: "Music", Icon: Music },
  { id: "camera", label: "Photos", Icon: Camera },
  { id: "film", label: "Film", Icon: Video },
  { id: "game", label: "Games", Icon: GameConsole },
  { id: "scale", label: "Legal", Icon: Scales },
  { id: "wrench", label: "Tools", Icon: Tools },
  { id: "sprout", label: "Growth", Icon: Sprout },
];

export const DEFAULT_TOPIC_ICON = TOPIC_ICONS[0];

const BY_ID = new Map(TOPIC_ICONS.map((entry) => [entry.id, entry]));

/** Resolve an icon by id, falling back to the default glyph. */
export function topicIconById(id?: string | null) {
  return (id && BY_ID.get(id)) || DEFAULT_TOPIC_ICON;
}

/** The icon a topic should render with. */
export function topicIcon(topic: { icon?: string }) {
  return topicIconById(topic?.icon).Icon;
}
