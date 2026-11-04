import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  FEATURE_CATEGORIES,
  featureGuides,
} from "../src/config/featureGuides.js";
import {
  USE_CASE_CATEGORIES,
  useCases,
} from "../src/config/useCases.js";
import en from "../src/i18n/en.js";
import de from "../src/i18n/de.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "src");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(jsx?|tsx?)$/.test(entry.name) ? [full] : [];
  });
}

const sourceText = walk(srcDir)
  .filter((file) => !file.startsWith(path.join(srcDir, "config") + path.sep))
  .map((file) => fs.readFileSync(file, "utf8"))
  .join("\n");

const staticGuideValues = new Set(
  [...sourceText.matchAll(/data-guide="([^"]+)"/g)].map((match) => match[1]),
);
const hasDynamicTools = sourceText.includes(
  "data-guide={`tool-${guideKey}`}",
);
const hasDynamicSettingsTabs = sourceText.includes(
  "data-guide={`settings-tab-${tab.id}`}",
);
const hasDynamicAttachmentCards = sourceText.includes(
  'data-guide={inHistory ? undefined : "attachment-card"}',
);

function getKey(object, key) {
  return key.split(".").reduce((value, part) => value?.[part], object);
}

function checkTarget(target, featureId, label, errors) {
  const selectors = Array.isArray(target) ? target : [target];
  for (const selector of selectors) {
    if (typeof selector !== "string" || !selector.trim()) {
      errors.push(`${featureId}: ${label} has an invalid target`);
      continue;
    }

    if (selector.startsWith("[data-guide=")) {
      const value = selector.match(/"([^"]+)"/)?.[1];
      if (!value) {
        errors.push(`${featureId}: ${label} has an invalid data-guide target`);
        continue;
      }
      if (
        !staticGuideValues.has(value) &&
        !(value.startsWith("tool-") && hasDynamicTools) &&
        !(value.startsWith("settings-tab-") && hasDynamicSettingsTabs) &&
        !(value === "attachment-card" && hasDynamicAttachmentCards)
      ) {
        errors.push(`${featureId}: ${label} targets missing data-guide="${value}"`);
      }
      continue;
    }

    if (selector.startsWith(".")) {
      if (!sourceText.includes(selector.slice(1))) {
        errors.push(`${featureId}: ${label} targets missing class ${selector}`);
      }
      continue;
    }

    errors.push(`${featureId}: ${label} uses an unsupported selector ${selector}`);
  }
}

const errors = [];
const categorised = new Set();

for (const [featureId, guide] of Object.entries(featureGuides)) {
  if (!guide.titleKey) errors.push(`${featureId}: missing titleKey`);
  if (!guide.prompt) errors.push(`${featureId}: missing prompt`);
  if (!Array.isArray(guide.keywords) || guide.keywords.length === 0) {
    errors.push(`${featureId}: missing keywords`);
  }
  if (!Array.isArray(guide.steps) || guide.steps.length === 0) {
    errors.push(`${featureId}: missing steps`);
  }

  for (const [index, step] of (guide.steps || []).entries()) {
    const label = `step ${index + 1}`;
    if (!step.textKey) errors.push(`${featureId}: ${label} missing textKey`);
    if (!step.target) errors.push(`${featureId}: ${label} missing target`);
    else checkTarget(step.target, featureId, label, errors);
    if (step.prepare !== undefined && typeof step.prepare !== "function") {
      errors.push(`${featureId}: ${label} has a non-function prepare`);
    }
  }

  for (const [locale, messages] of Object.entries({ en, de })) {
    if (guide.titleKey && !getKey(messages, guide.titleKey)) {
      errors.push(`${featureId}: missing ${locale} title ${guide.titleKey}`);
    }
    for (const [index, step] of (guide.steps || []).entries()) {
      if (step.textKey && !getKey(messages, step.textKey)) {
        errors.push(
          `${featureId}: missing ${locale} step ${index + 1} ${step.textKey}`,
        );
      }
    }
  }
}

for (const key of [
  "feature_guide.catalog.open",
  "feature_guide.catalog.close",
  "feature_guide.catalog.search",
  "feature_guide.catalog.empty",
  "feature_guide.catalog.completed",
  "feature_guide.catalog.completed_successfully",
  "feature_guide.catalog.hide_completed",
  "feature_guide.catalog.start",
  "feature_guide.catalog.replay",
  "feature_guide.complete_step",
  "feature_guide.status_title",
  "feature_guide.status_waiting",
  "feature_guide.status_ready",
  "feature_guide.status_manual",
  "feature_guide.status_done",
  "feature_guide.dont_show_again",
  "feature_guide.walkthrough_complete",
  "feature_guide.completed_title",
  "feature_guide.more_tutorials",
]) {
  if (!getKey(en, key)) errors.push(`missing en string ${key}`);
  if (!getKey(de, key)) errors.push(`missing de string ${key}`);
}

for (const [category, ids] of Object.entries(FEATURE_CATEGORIES)) {
  if (!getKey(en, `feature_guide.categories.${category}`)) {
    errors.push(`missing en category label: ${category}`);
  }
  if (!getKey(de, `feature_guide.categories.${category}`)) {
    errors.push(`missing de category label: ${category}`);
  }
  for (const id of ids) {
    if (!featureGuides[id]) {
      errors.push(`category ${category} references unknown guide ${id}`);
    }
    if (categorised.has(id)) {
      errors.push(`guide ${id} is in more than one category`);
    }
    categorised.add(id);
  }
}

for (const id of Object.keys(featureGuides)) {
  if (!categorised.has(id)) errors.push(`guide ${id} has no category`);
}

const useCasesCategorised = new Set();

for (const [useCaseId, useCase] of Object.entries(useCases)) {
  if (!Array.isArray(useCase.steps) || useCase.steps.length === 0) {
    errors.push(`use case ${useCaseId}: missing steps`);
  }
  for (const key of [
    `use_cases.${useCaseId}.title`,
    `use_cases.${useCaseId}.description`,
  ]) {
    if (!getKey(en, key)) errors.push(`missing en string ${key}`);
    if (!getKey(de, key)) errors.push(`missing de string ${key}`);
  }
  for (const [index, step] of (useCase.steps || []).entries()) {
    if (!step.target) {
      errors.push(`use case ${useCaseId}: step ${index + 1} missing target`);
    } else {
      checkTarget(
        step.target,
        `use case ${useCaseId}`,
        `step ${index + 1}`,
        errors,
      );
    }
    if (step.prepare !== undefined && typeof step.prepare !== "function") {
      errors.push(
        `use case ${useCaseId}: step ${index + 1} has a non-function prepare`,
      );
    }
    if (step.tutorialId && !featureGuides[step.tutorialId]) {
      errors.push(
        `use case ${useCaseId}: step ${index + 1} references unknown tutorial ${step.tutorialId}`,
      );
    }
    if (!getKey(en, step.textKey)) {
      errors.push(`missing en string ${step.textKey}`);
    }
    if (!getKey(de, step.textKey)) {
      errors.push(`missing de string ${step.textKey}`);
    }
  }
}

for (const [category, ids] of Object.entries(USE_CASE_CATEGORIES)) {
  if (!getKey(en, `use_cases.categories.${category}`)) {
    errors.push(`missing en use-case category label: ${category}`);
  }
  if (!getKey(de, `use_cases.categories.${category}`)) {
    errors.push(`missing de use-case category label: ${category}`);
  }
  for (const id of ids) {
    if (!useCases[id]) {
      errors.push(`use-case category ${category} references unknown ${id}`);
    }
    if (useCasesCategorised.has(id)) {
      errors.push(`use case ${id} is in more than one category`);
    }
    useCasesCategorised.add(id);
  }
}

for (const id of Object.keys(useCases)) {
  if (!useCasesCategorised.has(id)) {
    errors.push(`use case ${id} has no category`);
  }
}

for (const key of [
  "use_cases.common.start_new_chat",
  "use_cases.catalog.open",
  "use_cases.catalog.close",
  "use_cases.catalog.search",
  "use_cases.catalog.empty",
  "use_cases.catalog.completed_successfully",
  "use_cases.catalog.hide_completed",
  "use_cases.catalog.show_tutorial",
  "use_cases.catalog.start_walkthrough",
  "use_cases.catalog.walk_through_again",
]) {
  if (!getKey(en, key)) errors.push(`missing en string ${key}`);
  if (!getKey(de, key)) errors.push(`missing de string ${key}`);
}

if (errors.length > 0) {
  console.error("Feature guide validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Feature guide validation passed (${Object.keys(featureGuides).length} guides, ${Object.keys(useCases).length} use cases).`,
  );
}
