import { fetchPersona } from "./personaCatalog";
import {
  buildCourseStats,
  parseQuizDocument,
  parseSkillsDocument,
} from "./gaiaContent";

/**
 * Courses are personas with an extra `course` block. The persona stays a
 * normal persona (title, model, system prompt); the block adds the learning
 * material next to it:
 *
 * ```json
 * "course": {
 *   "id": "c-programmierung",
 *   "baseUrl": "c-programmierung/",
 *   "skills": "skills-c-programmierung.json",
 *   "quiz": "quiz-c-programmierung.json",
 *   "overviews": { "skills": "skills.html", "quiz": "quiz.html" },
 *   "lernseiten": [{ "skill": "call_by_value_erklaeren", "file": "lernseiten/call_by_value_erklaeren.html" }]
 * }
 * ```
 *
 * `baseUrl` is resolved against the persona's own URL, so the material can move
 * to another host by changing only that value. JSON datasets are loaded with
 * the course; the (much larger) review HTML is fetched when its tab opens.
 */

const COURSE_PERSONA_DIR = "courses";
const COURSE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;

const courseCache = new Map();
const courseRequests = new Map();
const documentCache = new Map();

/** The persona path a course id points at (`courses/<id>.json`). */
export function coursePersonaPath(courseId) {
  const raw = String(courseId || "").trim();
  if (!raw) throw new Error("Missing course id.");
  if (raw.endsWith(".json")) {
    if (raw.split("/").some((part) => !part || part === "." || part === "..")) {
      throw new Error("Invalid course path.");
    }
    return raw;
  }
  if (!COURSE_ID_PATTERN.test(raw)) {
    throw new Error("Invalid course id.");
  }
  return `${COURSE_PERSONA_DIR}/${raw}.json`;
}

export function courseIdFromPath(path) {
  const name = String(path || "").split("/").pop() || "";
  return name.replace(/\.json$/i, "");
}

function text(value) {
  return String(value ?? "").trim();
}

function withTrailingSlash(url) {
  return url.endsWith("/") ? url : `${url}/`;
}

function resolveBaseUrl(personaUrl, baseUrl) {
  const raw = text(baseUrl);
  const resolved = raw ? new URL(raw, personaUrl).href : new URL("./", personaUrl).href;
  return withTrailingSlash(resolved);
}

function resolveAsset(baseUrl, file) {
  const value = text(file);
  if (!value) return "";
  return new URL(value, baseUrl).href;
}

function normalizeOverviews(overviews, baseUrl) {
  if (!overviews || typeof overviews !== "object") {
    return { skills: "", quiz: "" };
  }
  return {
    skills: resolveAsset(baseUrl, overviews.skills),
    quiz: resolveAsset(baseUrl, overviews.quiz),
  };
}

function normalizeLernseiten(list, baseUrl) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of list) {
    const file = text(typeof entry === "string" ? entry : entry?.file);
    if (!file) continue;
    const url = resolveAsset(baseUrl, file);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const fallbackTitle =
      file.split("/").pop()?.replace(/\.html?$/i, "").replace(/[_-]+/g, " ") || file;
    out.push({
      skill: text(typeof entry === "string" ? "" : entry?.skill),
      file,
      url,
      title: text(typeof entry === "string" ? "" : entry?.title) || fallbackTitle,
    });
  }
  return out;
}

async function fetchText(url) {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Failed to load course file (${response.status}): ${url}`);
  }
  return response.text();
}

/**
 * Loads one course, including its skills and quiz datasets.
 *
 * @param {string} courseId course id (`c-programmierung`) or a persona path
 * @param {{force?: boolean}} [options]
 */
export async function loadCourse(courseId, { force = false } = {}) {
  const personaPath = coursePersonaPath(courseId);
  if (!force && courseCache.has(personaPath)) {
    return courseCache.get(personaPath);
  }

  const { entry, data } = await fetchPersona(personaPath);
  const block = data?.course;
  if (!block || typeof block !== "object") {
    throw new Error("NOT_A_COURSE");
  }

  const personaUrl = entry.url;
  const baseUrl = resolveBaseUrl(personaUrl, block.baseUrl);
  const skillsFile = text(block.skills);
  const quizFile = text(block.quiz);
  if (!skillsFile || !quizFile) {
    throw new Error("Course block is missing skills or quiz.");
  }

  const [skillsText, quizText] = await Promise.all([
    fetchText(resolveAsset(baseUrl, skillsFile)),
    fetchText(resolveAsset(baseUrl, quizFile)),
  ]);

  const skillsDoc = parseSkillsDocument(skillsText);
  const quizDoc = parseQuizDocument(quizText);
  const lernseiten = normalizeLernseiten(block.lernseiten, baseUrl);
  const stats = buildCourseStats({ skillsDoc, quizDoc, lernseiten });

  const course = {
    id: text(block.id) || courseIdFromPath(personaPath),
    title: text(block.title) || entry.title,
    subtitle: text(block.subtitle) || entry.description,
    language: text(block.language) || "de",
    personaPath,
    personaUrl,
    persona: data,
    entry,
    baseUrl,
    skillsDoc,
    quizDoc,
    questions: quizDoc.questions,
    groups: skillsDoc.groups,
    overviews: normalizeOverviews(block.overviews, baseUrl),
    lernseiten,
    stats,
  };

  courseCache.set(personaPath, course);
  return course;
}

/**
 * Loads a course for a caller that only has its id (the chat's quiz block and
 * its tool). Concurrent callers share one request, so opening several quiz
 * cards never downloads the same course twice. A failed request is forgotten,
 * so the next attempt can succeed.
 */
export function ensureCourse(courseId) {
  const personaPath = coursePersonaPath(courseId);
  if (courseCache.has(personaPath)) {
    return Promise.resolve(courseCache.get(personaPath));
  }
  if (!courseRequests.has(personaPath)) {
    const request = loadCourse(courseId).finally(() => {
      courseRequests.delete(personaPath);
    });
    courseRequests.set(personaPath, request);
  }
  return courseRequests.get(personaPath);
}

/** Fetches a review page or a self-learning page as text (cached). */
export async function loadCourseDocument(url, { force = false } = {}) {
  const target = text(url);
  if (!target) throw new Error("Missing course document URL.");
  if (!force && documentCache.has(target)) {
    return documentCache.get(target);
  }
  const html = await fetchText(target);
  documentCache.set(target, html);
  return html;
}

/** Test helper: drops every cached course and document. */
export function clearCourseCache() {
  courseCache.clear();
  courseRequests.clear();
  documentCache.clear();
}
