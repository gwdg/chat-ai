// Prompt assembly for the radiology report inputs (modules.radiology).
//
// The UI collects an ordered list of inputs, each { kind, text }. This file is
// the only place that decides how they become the prompt sent to the model, so
// the template (or a whole processing pipeline) can be swapped here without
// touching the UI. Pasted text is inserted verbatim: never trim or re-wrap it,
// the report layout carries meaning.

// Kinds in the order they appear in the prompt and in the UI.
export const REPORT_KINDS = {
  previous_report: { multiple: true },
  dictation: { multiple: false },
  assessment: { multiple: false },
};

const KIND_ORDER = Object.keys(REPORT_KINDS);

// Insert a new input after the existing ones of the same or earlier kind, so
// the list always reads previous reports → dictation → assessment.
export function insertInput(inputs, input) {
  const rank = KIND_ORDER.indexOf(input.kind);
  const at = inputs.findIndex((other) => KIND_ORDER.indexOf(other.kind) > rank);
  return at === -1
    ? [...inputs, input]
    : [...inputs.slice(0, at), input, ...inputs.slice(at)];
}

// Placeholder instruction for the demo, to be replaced by the agreed prompt.
const INSTRUCTION =
  "Erstelle den vollständigen Folgebefund. Übernimm den Vorbefund und arbeite " +
  "nur die Änderungen aus dem Diktat ein; alle übrigen Sätze bleiben wörtlich " +
  "unverändert. Falls eine Beurteilung diktiert wurde, übernimm sie wörtlich " +
  "als neue Beurteilung.";

const HEADINGS = {
  previous_report: "VORBEFUND",
  dictation: "DIKTAT DES RADIOLOGEN (nur Änderungen)",
  assessment: "BEURTEILUNG (diktiert)",
  note: "ZUSÄTZLICHE HINWEISE DES RADIOLOGEN",
};

const section = (heading, text) => `${heading}:\n---\n${text}\n---`;

// Build the user message from the collected inputs and the optional text the
// radiologist typed into the normal prompt box.
export function buildRadiologyPrompt(inputs, note = "") {
  const reports = inputs.filter((input) => input.kind === "previous_report");
  const blocks = [INSTRUCTION];

  reports.forEach((report, i) => {
    const heading = reports.length > 1
      ? `${HEADINGS.previous_report} ${i + 1}`
      : HEADINGS.previous_report;
    blocks.push(section(heading, report.text));
  });
  for (const kind of ["dictation", "assessment"]) {
    const input = inputs.find((input) => input.kind === kind);
    if (input) blocks.push(section(HEADINGS[kind], input.text));
  }
  if (note.trim() !== "") blocks.push(section(HEADINGS.note, note));

  return blocks.join("\n\n");
}

// Chip labels, e.g. "Vorbefund 2". Previous reports are numbered in the order
// they were added.
export function getInputLabels(kinds, t) {
  let reportCount = 0;
  return kinds.map((kind) =>
    kind === "previous_report"
      ? `${t("radiology.previous_report")} ${++reportCount}`
      : t(`radiology.${kind}`)
  );
}
