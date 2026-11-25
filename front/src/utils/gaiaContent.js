/**
 * Readers for the GAIA course formats.
 *
 * A course ships two JSON documents next to its persona:
 *
 *  - `gaia-skills` — topics and the skills (learning objectives) they contain,
 *  - `gaia-quiz`   — questions that point at one or more skills.
 *
 * Both formats use 1-based answer indexes (`correct: [4]` means the fourth
 * answer). Everything the UI displays is derived here so the components never
 * have to know the raw field names.
 */

export const QUESTION_TYPES = ["single_choice", "multiple_choice", "open_end"];

export const isChoiceQuestion = (question) =>
  question?.type === "single_choice" || question?.type === "multiple_choice";

function parseJson(raw) {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error("Course content is not valid JSON.");
    }
  }
  return raw;
}

function text(value) {
  return String(value ?? "").trim();
}

function stringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(text).filter(Boolean);
}

function normalizeTopics(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const topics = [];
  for (const topic of value) {
    const key = text(topic?.key);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    topics.push({
      key,
      unit: text(topic?.unit),
      name: text(topic?.name) || key,
      description: text(topic?.description),
    });
  }
  return topics;
}

function normalizeSkills(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const skills = [];
  for (const skill of value) {
    const key = text(skill?.key);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    skills.push({
      key,
      topicKey: text(skill?.topic_key),
      concept: text(skill?.concept),
      name: text(skill?.name) || key,
      description: text(skill?.description),
      prerequisites: stringList(skill?.prerequisites),
    });
  }
  return skills;
}

/**
 * Normalizes a `gaia-skills` document.
 *
 * Returns the topic/skill lists plus lookup maps and the topics in display
 * order with their skills already grouped.
 */
export function parseSkillsDocument(raw) {
  const data = parseJson(raw);
  if (!data || typeof data !== "object") {
    throw new Error("Course skills are not an object.");
  }

  const topics = normalizeTopics(data.topics);
  const skills = normalizeSkills(data.skills);
  const topicByKey = new Map(topics.map((topic) => [topic.key, topic]));
  const skillByKey = new Map(skills.map((skill) => [skill.key, skill]));

  for (const skill of skills) {
    skill.prerequisiteSkills = skill.prerequisites.map((key) => {
      const match = skillByKey.get(key);
      return { key, name: match?.name || key, known: Boolean(match) };
    });
  }

  const groups = [];
  const grouped = new Map();
  for (const topic of topics) {
    const group = { topic, skills: [] };
    grouped.set(topic.key, group);
    groups.push(group);
  }
  for (const skill of skills) {
    let group = grouped.get(skill.topicKey);
    if (!group) {
      group = {
        topic: {
          key: skill.topicKey || "unsorted",
          unit: "",
          name: skill.topicKey || "Other",
          description: "",
        },
        skills: [],
      };
      grouped.set(group.topic.key, group);
      groups.push(group);
    }
    group.skills.push(skill);
  }

  return {
    format: text(data.format) || "gaia-skills",
    version: Number(data.version) || 1,
    topics,
    skills,
    groups: groups.filter((group) => group.skills.length > 0),
    topicByKey,
    skillByKey,
  };
}

/** Converts a documented 1-based answer index list into 0-based indexes. */
export function correctAnswerIndexes(question) {
  const answers = Array.isArray(question?.answers) ? question.answers : [];
  const raw = Array.isArray(question?.correct)
    ? question.correct
    : question?.correct === undefined || question?.correct === null
      ? []
      : [question.correct];
  const out = [];
  for (const value of raw) {
    const number = Number(value);
    if (!Number.isInteger(number)) continue;
    const index = number - 1;
    if (index < 0 || index >= answers.length) continue;
    if (!out.includes(index)) out.push(index);
  }
  return out.sort((a, b) => a - b);
}

function normalizeQuestion(raw, index) {
  const answers = stringList(raw?.answers);
  const type = text(raw?.type);
  if (!QUESTION_TYPES.includes(type) || !text(raw?.question)) return null;
  return {
    id: text(raw?.id) || `question-${index + 1}`,
    type,
    question: text(raw.question),
    answers,
    correct: type === "open_end" ? [] : correctAnswerIndexes({ answers, correct: raw.correct }),
    skills: stringList(raw?.skills),
    tags: stringList(raw?.tags),
    status: text(raw?.status) || "draft",
    origin: text(raw?.origin),
    source: text(raw?.source),
    explanation: text(raw?.explanation),
  };
}

/** Normalizes a `gaia-quiz` document. Invalid entries are skipped, not fatal. */
export function parseQuizDocument(raw) {
  const data = parseJson(raw);
  if (!data || typeof data !== "object") {
    throw new Error("Course quiz is not an object.");
  }
  const questions = (Array.isArray(data.questions) ? data.questions : [])
    .map(normalizeQuestion)
    .filter(Boolean);
  return {
    format: text(data.format) || "gaia-quiz",
    version: Number(data.version) || 1,
    questions,
  };
}

/** The sample answer of an open question, if the course provides one. */
export function sampleAnswer(question) {
  if (question?.type !== "open_end") return "";
  return text(question.answers?.[0]);
}

const sameSet = (a, b) =>
  a.length === b.length && b.every((value) => a.includes(value));

/**
 * Grades a choice question against the selected answer indexes (0-based).
 * Open questions are never graded automatically.
 */
export function evaluateQuestion(question, selection) {
  if (!isChoiceQuestion(question)) {
    return { graded: false, correct: null, missing: [], wrong: [] };
  }
  const selected = Array.isArray(selection)
    ? selection
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value))
        .filter((value, index, list) => list.indexOf(value) === index)
        .sort((a, b) => a - b)
    : [];
  const correct = question.correct || [];
  return {
    graded: true,
    correct: sameSet(selected, correct),
    missing: correct.filter((index) => !selected.includes(index)),
    wrong: selected.filter((index) => !correct.includes(index)),
  };
}

export function countQuestionsBySkill(questions) {
  const counts = new Map();
  for (const question of questions || []) {
    for (const skillKey of question.skills || []) {
      counts.set(skillKey, (counts.get(skillKey) || 0) + 1);
    }
  }
  return counts;
}

export function questionsForSkill(questions, skillKey) {
  if (!skillKey) return questions || [];
  return (questions || []).filter((question) => question.skills?.includes(skillKey));
}

export function skillKeysWithLernseite(lernseiten) {
  return new Set(
    (lernseiten || []).map((entry) => text(entry?.skill)).filter(Boolean),
  );
}

export function buildCourseStats({ skillsDoc, quizDoc, lernseiten }) {
  const questions = quizDoc?.questions || [];
  const skills = skillsDoc?.skills || [];
  const withLernseite = skillKeysWithLernseite(lernseiten);
  const byType = { single_choice: 0, multiple_choice: 0, open_end: 0 };
  for (const question of questions) {
    if (byType[question.type] !== undefined) byType[question.type] += 1;
  }
  return {
    topics: skillsDoc?.topics?.length || 0,
    skills: skills.length,
    questions: questions.length,
    byType,
    lernseiten: (lernseiten || []).length,
    skillsWithLernseite: skills.filter((skill) => withLernseite.has(skill.key)).length,
    drafts: questions.filter((question) => question.status === "draft").length,
    withExplanation: questions.filter((question) => question.explanation).length,
  };
}
