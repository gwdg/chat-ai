// Pure helpers for the course learning-page chat block and its tool. No React
// and no network access here, so the matching rules and the model-facing text
// can be tested on their own.
import {
  matchScore,
  normalize,
  randomOf,
  skillMapOf,
  words,
} from "./courseMaterialText";

export const PAGE_FENCE_LANGUAGE = "gaia-page";
export const COURSE_PAGE_TOOL = "show_course_page";

/**
 * Reads the fenced block. Only `course` and `page` are honoured: the page, its
 * title and its HTML always come from the course's own document.
 */
export function parsePageFence(source) {
  try {
    const data = JSON.parse(String(source ?? ""));
    const course = String(data?.course ?? "").trim();
    const page = String(data?.page ?? "").trim();
    if (!course || !page) return null;
    return { course, page };
  } catch {
    return null;
  }
}

/** The learning page a fence payload names (`file` is the canonical key). */
export function findCoursePage(course, key) {
  const wanted = normalize(key);
  if (!wanted) return null;
  const pages = Array.isArray(course?.lernseiten) ? course.lernseiten : [];
  return (
    pages.find((page) => normalize(page.file) === wanted) ||
    pages.find((page) => normalize(page.skill) === wanted) ||
    // A model may hand back only the file name without its folder.
    pages.find((page) => normalize(page.file).endsWith(`/${wanted}`)) ||
    null
  );
}

/** The skill name a learning page belongs to, or its raw skill key. */
export function pageSkillName(course, page) {
  const skills = skillMapOf(course);
  const key = normalize(page?.skill);
  if (!key) return "";
  return skills.get(key)?.name || page.skill;
}

/**
 * Picks the learning page the tool returns. `skill` narrows by key or name,
 * `search` scores the remaining pages by the learner's words, and a request
 * that matches nothing gets a random page instead of an error.
 */
export function pickCoursePage(course, { search = "", skill = "" } = {}) {
  const pages = Array.isArray(course?.lernseiten) ? course.lernseiten : [];
  if (pages.length === 0) return null;
  const skills = skillMapOf(course);

  const wantedSkill = normalize(skill);
  if (wantedSkill) {
    const byKey = pages.find((page) => normalize(page.skill) === wantedSkill);
    if (byKey) return byKey;
    const byName = pages.find((page) =>
      normalize(skills.get(page.skill)?.name).includes(wantedSkill),
    );
    if (byName) return byName;
  }

  const tokens = words(search);
  if (tokens.length === 0) return randomOf(pages);

  let best = null;
  let bestScore = 0;
  for (const page of pages) {
    const haystack = normalize(
      [
        page.title,
        page.file,
        page.skill,
        skills.get(page.skill)?.name,
      ].join(" "),
    );
    const score = matchScore(tokens, haystack);
    if (score > bestScore) {
      best = page;
      bestScore = score;
    }
  }
  return best || randomOf(pages);
}

/** The block the model must paste into its reply. */
export function pageFenceFor(course, page) {
  return [
    "```" + PAGE_FENCE_LANGUAGE,
    JSON.stringify({ course: course.id, page: page.file }),
    "```",
  ].join("\n");
}

/**
 * The tool result. The page's HTML never travels through the model: the block
 * loads it from the course, so the reply carries only the ids.
 */
export function formatPageToolResult({ course, page }) {
  const skill = pageSkillName(course, page);
  const lines = [
    `Learning page from the course "${course.title}": ${page.title}${skill ? ` (skill: ${skill})` : ""}.`,
    "The card loads this page from the course and renders it inside your reply, so do not copy or retype the page, and do not walk the learner through it line by line. One short sentence introducing the page is enough; add this block exactly once at the end of your reply:",
    "",
    pageFenceFor(course, page),
  ];
  return lines.join("\n");
}
