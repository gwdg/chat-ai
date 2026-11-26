// Text helpers shared by the course-material blocks and tools. Pure functions
// only: no React, no network, so the matching rules can be tested on their own.

export const normalize = (value) => String(value ?? "").trim().toLowerCase();

export const words = (value) =>
  normalize(value)
    .split(/[^0-9a-zäöüß]+/)
    .filter((word) => word.length > 2);

/** The course's skill keys mapped to their names. */
export function skillMapOf(course) {
  const skills = course?.skillsDoc?.skills || [];
  return new Map(skills.map((skill) => [skill.key, skill]));
}

export function skillNamesOf(entry, skills) {
  return (entry?.skills || []).map((key) => skills.get(key)?.name || key);
}

export const randomOf = (list) => list[Math.floor(Math.random() * list.length)];

/** Counts how many of the learner's words appear in a searchable string. */
export function matchScore(tokens, haystack) {
  return tokens.filter((token) => haystack.includes(token)).length;
}
