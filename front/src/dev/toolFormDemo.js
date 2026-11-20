// Sample data for the dev-only tool form page (/dev/tool-form).
//
// The labels and options below are demo *data*, exactly like the `fields`
// array a tool sends in a `<tool>.form` event, so they are not translated.
// Each load starts with random selections plus an empty free-text answer.

export const COLOR_OPTIONS = [
  { value: "teal", label: "Teal" },
  { value: "magenta", label: "Magenta" },
  { value: "ochre", label: "Ochre" },
  { value: "slate", label: "Slate" },
  { value: "coral", label: "Coral" },
];

export const TIME_OPTIONS = [
  { value: "morning", label: "Morning" },
  { value: "noon", label: "Noon" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
];

export const SIZE_OPTIONS = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

export function pickRandom(options, random = Math.random) {
  if (!Array.isArray(options) || options.length === 0) return undefined;
  const index = Math.min(options.length - 1, Math.floor(random() * options.length));
  return options[index]?.value;
}

export function randomInt(min, max, random = Math.random) {
  return Math.min(max, Math.floor(random() * (max - min + 1)) + min);
}

export function buildDemoForm(random = Math.random) {
  return {
    tool_id: "demo_tool",
    title: "Random selections",
    description:
      "Every option is prefilled with a random pick so you can change it and submit.",
    fields: [
      {
        name: "colour",
        label: "Favourite colour",
        type: "select",
        value: pickRandom(COLOR_OPTIONS, random),
        options: COLOR_OPTIONS,
      },
      {
        name: "time",
        label: "Preferred time",
        type: "radio",
        value: pickRandom(TIME_OPTIONS, random),
        options: TIME_OPTIONS,
      },
      {
        name: "size",
        label: "Portion size",
        type: "select",
        value: pickRandom(SIZE_OPTIONS, random),
        options: SIZE_OPTIONS,
      },
      {
        name: "hunger",
        label: "How hungry are you?",
        type: "range",
        min: 1,
        max: 5,
        step: 1,
        value: randomInt(1, 5, random),
      },
      {
        name: "reminder",
        label: "Send me a reminder",
        type: "checkbox",
        value: random() >= 0.5,
      },
      {
        name: "answer",
        label: "Add text answer",
        type: "textarea",
        rows: 3,
        placeholder: "Anything else the tool should know?",
        value: "",
      },
    ],
  };
}
