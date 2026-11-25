// Every attachment the user adds is copied below /artefacts in the conversation workspace, and
// documents and audio get a converted text variant next to them. Files in there are input, so a
// turn only reports files outside this directory as results.
export const ARTEFACTS = "/artefacts";

export const uploadPath = (fileId: string, name: string) =>
  `${ARTEFACTS}/${fileId.slice(0, 8)}/${name}`;
