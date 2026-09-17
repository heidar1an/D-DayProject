// .green-path-render.mjs
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// src/services/greenPath/greenPathConfig.js
var GREEN_PATH_STORAGE_KEY = "tapesh:green-path:v1";
var TASK_TYPES = Object.freeze({
  LEARN: "LEARN",
  REVIEW: "REVIEW",
  PRACTICE: "PRACTICE",
  TEST: "TEST",
  ANALYZE: "ANALYZE",
  READ_REFERENCE: "READ_REFERENCE",
  WIKI_REVIEW: "WIKI_REVIEW",
  KNOWLEDGE_LINK: "KNOWLEDGE_LINK",
  FLASHCARD_REVIEW: "FLASHCARD_REVIEW",
  MOCK_EXAM: "MOCK_EXAM",
  REST: "REST",
  BUFFER: "BUFFER"
});
var TASK_STATES = Object.freeze({
  PLANNED: "planned",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  SKIPPED: "skipped",
  RESCHEDULED: "rescheduled",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
  FAILED: "failed"
});
var GOAL_PROFILES = Object.freeze({
  "semester-excellence": {
    id: "semester-excellence",
    title: "\u06A9\u0633\u0628 \u0645\u0639\u062F\u0644 \u0627\u0644\u0641",
    description: "\u067E\u0648\u0634\u0634 \u0645\u0646\u0638\u0645 \u062F\u0631\u0633\u200C\u0647\u0627\u060C \u0645\u0631\u0648\u0631 \u067E\u06CC\u0634 \u0627\u0632 \u0627\u0645\u062A\u062D\u0627\u0646 \u0648 \u062D\u0641\u0638 \u0631\u06CC\u062A\u0645 \u0647\u0641\u062A\u06AF\u06CC.",
    taskMix: { LEARN: 0.34, REVIEW: 0.2, PRACTICE: 0.22, TEST: 0.16, ANALYZE: 0.08 },
    phaseOrder: ["foundation", "consolidation", "testing", "final-review"],
    relevance: { semester: 1, basicSciences: 0.55, exam: 0.85 }
  },
  "university-rank": {
    id: "university-rank",
    title: "\u06A9\u0633\u0628 \u0631\u062A\u0628\u0647 \u0628\u0631\u062A\u0631 \u062F\u0627\u0646\u0634\u06AF\u0627\u0647",
    description: "\u0639\u0645\u0642 \u0645\u0641\u0647\u0648\u0645\u06CC\u060C \u062A\u0633\u062A \u062A\u0631\u06A9\u06CC\u0628\u06CC\u060C \u062A\u062D\u0644\u06CC\u0644 \u062E\u0637\u0627 \u0648 \u062A\u062B\u0628\u06CC\u062A \u0642\u0627\u0628\u0644\u200C\u0627\u0646\u062F\u0627\u0632\u0647\u200C\u06AF\u06CC\u0631\u06CC.",
    taskMix: { LEARN: 0.24, REVIEW: 0.2, PRACTICE: 0.25, TEST: 0.2, ANALYZE: 0.11 },
    phaseOrder: ["foundation", "consolidation", "integration", "testing", "final-review"],
    relevance: { semester: 0.95, basicSciences: 0.7, exam: 0.9 }
  },
  "basic-sciences": {
    id: "basic-sciences",
    title: "\u0622\u0645\u0627\u062F\u06AF\u06CC \u0639\u0644\u0648\u0645 \u067E\u0627\u06CC\u0647",
    description: "\u067E\u0648\u0634\u0634 \u0648\u0633\u06CC\u0639\u060C \u0645\u0631\u0648\u0631 \u0686\u0646\u062F\u0645\u0631\u062D\u0644\u0647\u200C\u0627\u06CC\u060C \u0627\u062A\u0635\u0627\u0644 \u0628\u06CC\u0646\u200C\u062F\u0631\u0633\u06CC \u0648 \u0622\u0632\u0645\u0648\u0646\u200C\u0647\u0627\u06CC \u0634\u0628\u06CC\u0647\u200C\u0633\u0627\u0632.",
    taskMix: { LEARN: 0.22, REVIEW: 0.22, PRACTICE: 0.2, TEST: 0.2, ANALYZE: 0.16 },
    phaseOrder: ["foundation", "integration", "testing", "final-review"],
    relevance: { semester: 0.7, basicSciences: 1, exam: 0.95 }
  },
  "deep-basic-sciences": {
    id: "deep-basic-sciences",
    title: "\u062A\u0633\u0644\u0637 \u0639\u0645\u06CC\u0642 \u0628\u0631 \u0639\u0644\u0648\u0645 \u067E\u0627\u06CC\u0647",
    description: "\u06CC\u0627\u062F\u06AF\u06CC\u0631\u06CC \u0645\u0641\u0647\u0648\u0645\u06CC \u0628\u0627 \u0631\u0641\u0631\u0646\u0633\u060C \u0634\u0628\u06A9\u0647 \u062F\u0627\u0646\u0634 \u0648 \u0628\u0627\u0632\u0622\u0632\u0645\u0627\u06CC\u06CC \u0641\u0627\u0635\u0644\u0647\u200C\u062F\u0627\u0631.",
    taskMix: { LEARN: 0.25, REVIEW: 0.2, PRACTICE: 0.2, TEST: 0.17, ANALYZE: 0.18 },
    phaseOrder: ["foundation", "consolidation", "integration", "testing"],
    relevance: { semester: 0.65, basicSciences: 1, exam: 0.9 }
  },
  "catch-up": {
    id: "catch-up",
    title: "\u062C\u0628\u0631\u0627\u0646 \u0639\u0642\u0628\u200C\u0645\u0627\u0646\u062F\u06AF\u06CC",
    description: "\u062A\u0645\u0631\u06A9\u0632 \u0631\u0648\u06CC \u0645\u0628\u0627\u062D\u062B \u067E\u064F\u0631\u0628\u0627\u0632\u062F\u0647\u060C \u067E\u06CC\u0634\u200C\u0646\u06CC\u0627\u0632\u0647\u0627 \u0648 \u062C\u0628\u0631\u0627\u0646 \u0628\u0627 \u0638\u0631\u0641\u06CC\u062A \u06A9\u0646\u062A\u0631\u0644\u200C\u0634\u062F\u0647.",
    taskMix: { LEARN: 0.35, REVIEW: 0.2, PRACTICE: 0.2, TEST: 0.15, ANALYZE: 0.1 },
    phaseOrder: ["recovery", "foundation", "testing", "final-review"],
    relevance: { semester: 0.9, basicSciences: 0.6, exam: 1 }
  },
  balanced: {
    id: "balanced",
    title: "\u0645\u0637\u0627\u0644\u0639\u0647 \u0645\u062A\u0639\u0627\u062F\u0644 \u0648 \u0645\u0633\u062A\u0645\u0631",
    description: "\u067E\u06CC\u0634\u0631\u0648\u06CC \u0622\u0647\u0633\u062A\u0647 \u0627\u0645\u0627 \u067E\u0627\u06CC\u062F\u0627\u0631 \u0628\u0627 \u0645\u0631\u0648\u0631 \u0648 \u062A\u0633\u062A \u062F\u0631 \u06A9\u0646\u0627\u0631 \u06CC\u0627\u062F\u06AF\u06CC\u0631\u06CC.",
    taskMix: { LEARN: 0.3, REVIEW: 0.22, PRACTICE: 0.2, TEST: 0.16, ANALYZE: 0.12 },
    phaseOrder: ["foundation", "consolidation", "testing", "final-review"],
    relevance: { semester: 0.85, basicSciences: 0.65, exam: 0.8 }
  }
});
var PHASE_META = Object.freeze({
  foundation: { title: "Foundation", label: "\u06CC\u0627\u062F\u06AF\u06CC\u0631\u06CC \u067E\u0627\u06CC\u0647", description: "\u0633\u0627\u062E\u062A\u0646 \u0641\u0647\u0645 \u0627\u0648\u0644\u06CC\u0647 \u0648 \u0639\u0628\u0648\u0631 \u0627\u0632 \u067E\u06CC\u0634\u200C\u0646\u06CC\u0627\u0632\u0647\u0627." },
  consolidation: { title: "Consolidation", label: "\u062A\u062B\u0628\u06CC\u062A", description: "\u0645\u0631\u0648\u0631 \u0641\u0639\u0627\u0644 \u0648 \u062A\u0628\u062F\u06CC\u0644 \u0645\u0637\u0627\u0644\u0639\u0647 \u0628\u0647 \u06CC\u0627\u062F\u0622\u0648\u0631\u06CC \u0642\u0627\u0628\u0644 \u0627\u062A\u06A9\u0627." },
  testing: { title: "Testing", label: "\u062A\u0633\u062A \u0648 \u062A\u062D\u0644\u06CC\u0644", description: "\u062D\u0644 \u062A\u0633\u062A \u0647\u062F\u0641\u0645\u0646\u062F\u060C \u0632\u0645\u0627\u0646\u200C\u062F\u0627\u0631 \u0648 \u062A\u062D\u0644\u06CC\u0644 \u062E\u0637\u0627." },
  integration: { title: "Integration", label: "\u0627\u062A\u0635\u0627\u0644 \u0645\u0641\u0627\u0647\u06CC\u0645", description: "\u0648\u0635\u0644\u200C\u06A9\u0631\u062F\u0646 \u0645\u0648\u0636\u0648\u0639\u0627\u062A \u0628\u06CC\u0646 \u062F\u0631\u0633\u200C\u0647\u0627 \u0641\u0642\u0637 \u0648\u0642\u062A\u06CC \u0627\u0631\u0632\u0634 \u06CC\u0627\u062F\u06AF\u06CC\u0631\u06CC \u062F\u0627\u0631\u062F." },
  recovery: { title: "Recovery", label: "\u062C\u0628\u0631\u0627\u0646 \u06A9\u0646\u062A\u0631\u0644\u200C\u0634\u062F\u0647", description: "\u062C\u0645\u0639\u200C\u06A9\u0631\u062F\u0646 \u0639\u0642\u0628\u200C\u0627\u0641\u062A\u0627\u062F\u06AF\u06CC \u0628\u062F\u0648\u0646 \u067E\u0631\u06A9\u0631\u062F\u0646 \u062E\u0637\u0631\u0646\u0627\u06A9 \u0641\u0631\u062F\u0627." },
  "final-review": { title: "Final Review", label: "\u0645\u0631\u0648\u0631 \u0646\u0647\u0627\u06CC\u06CC", description: "\u0645\u0631\u0648\u0631 \u0647\u062F\u0641\u0645\u0646\u062F \u0646\u0632\u062F\u06CC\u06A9 \u0628\u0647 \u062F\u062F\u0644\u0627\u06CC\u0646 \u0648 \u0622\u0632\u0645\u0648\u0646." }
});
var DEFAULT_PLANNING_CONFIG = Object.freeze({
  horizonDays: 28,
  minimumTaskMinutes: 12,
  bufferRatio: 0.2,
  maxRecoveryRatio: 0.25,
  reviewIntervalsDays: [1, 3, 7, 14],
  priorityWeights: {
    importance: 0.17,
    urgency: 0.2,
    weakness: 0.2,
    examWeight: 0.15,
    goalRelevance: 0.14,
    dependency: 0.08,
    historicalError: 0.06
  },
  readinessWeights: {
    coverage: 0.35,
    accuracy: 0.3,
    revision: 0.2,
    volume: 0.15
  }
});
var RECOVERY_MODES = Object.freeze({
  conservative: { label: "\u06A9\u0645\u200C\u0641\u0634\u0627\u0631", maxExtraRatio: 0.1, preserveReview: true },
  balanced: { label: "\u0645\u062A\u0639\u0627\u062F\u0644", maxExtraRatio: 0.18, preserveReview: true },
  aggressive: { label: "\u0633\u0631\u06CC\u0639", maxExtraRatio: 0.25, preserveReview: false }
});
var RESOURCE_TYPES = Object.freeze({
  MICRO_LESSON: "micro_lesson",
  COMPREHENSIVE_LESSON: "comprehensive_lesson",
  REFERENCE: "reference",
  QUESTION_BANK: "question_bank",
  WIKI: "wiki",
  KNOWLEDGE_NETWORK: "knowledge_network",
  FLASHCARD: "flashcard",
  COORDINATED_EXAM: "coordinated_exam"
});
var RESOURCE_LABELS = Object.freeze({
  micro_lesson: "\u0645\u06CC\u06A9\u0631\u0648 \u062F\u0631\u0633\u0646\u0627\u0645\u0647",
  comprehensive_lesson: "\u062F\u0631\u0633\u0646\u0627\u0645\u0647 \u062C\u0627\u0645\u0639",
  reference: "\u0631\u0641\u0631\u0646\u0633",
  question_bank: "\u0628\u0627\u0646\u06A9 \u062A\u0633\u062A",
  wiki: "\u0648\u06CC\u06A9\u06CC \u062A\u067E\u0634",
  knowledge_network: "\u0634\u0628\u06A9\u0647 \u062F\u0627\u0646\u0634",
  flashcard: "\u0641\u0644\u0634\u200C\u06A9\u0627\u0631\u062A",
  coordinated_exam: "\u0622\u0632\u0645\u0648\u0646 \u0647\u0645\u0627\u0647\u0646\u06AF"
});
var GREEN_PATH_SECTIONS = Object.freeze({
  "course-micro": { id: "course-micro", label: "\u0645\u06CC\u06A9\u0631\u0648 \u062F\u0631\u0633\u0646\u0627\u0645\u0647", group: "courses", accent: "var(--purple-ink)", shortLabel: "\u0645\u06CC\u06A9\u0631\u0648" },
  "course-comprehensive": { id: "course-comprehensive", label: "\u062F\u0631\u0633\u0646\u0627\u0645\u0647 \u062C\u0627\u0645\u0639", group: "courses", accent: "var(--blue-ink)", shortLabel: "\u062C\u0627\u0645\u0639" },
  "test-bank": { id: "test-bank", label: "\u0628\u0627\u0646\u06A9 \u062A\u0633\u062A", group: "testing", accent: "var(--green-ink)", shortLabel: "\u062A\u0633\u062A" },
  analytics: { id: "analytics", label: "\u062A\u062D\u0644\u06CC\u0644 \u0639\u0645\u0644\u06A9\u0631\u062F", group: "feedback", accent: "var(--gold-ink)", shortLabel: "\u062A\u062D\u0644\u06CC\u0644" },
  reference: { id: "reference", label: "\u0631\u0641\u0631\u0646\u0633", group: "resources", accent: "var(--copper-ink)", shortLabel: "\u0631\u0641\u0631\u0646\u0633" },
  wiki: { id: "wiki", label: "\u0648\u06CC\u06A9\u06CC \u062A\u067E\u0634", group: "resources", accent: "var(--blue-bright)", shortLabel: "\u0648\u06CC\u06A9\u06CC" },
  knowledge: { id: "knowledge", label: "\u0634\u0628\u06A9\u0647 \u062F\u0627\u0646\u0634", group: "resources", accent: "var(--purple-bright)", shortLabel: "\u0634\u0628\u06A9\u0647" },
  flashcards: { id: "flashcards", label: "\u0641\u0644\u0634\u200C\u06A9\u0627\u0631\u062A", group: "review", accent: "var(--rose)", shortLabel: "\u0641\u0644\u0634" },
  "coordinated-exam": { id: "coordinated-exam", label: "\u0622\u0632\u0645\u0648\u0646 \u0647\u0645\u0627\u0647\u0646\u06AF", group: "testing", accent: "var(--red-ink)", shortLabel: "\u0647\u0645\u0627\u0647\u0646\u06AF" },
  deadline: { id: "deadline", label: "\u062F\u062F\u0644\u0627\u06CC\u0646", group: "milestone", accent: "var(--orange-ink)", shortLabel: "\u062F\u062F\u0644\u0627\u06CC\u0646" },
  milestone: { id: "milestone", label: "\u0646\u0642\u0637\u0647 \u0639\u0637\u0641", group: "milestone", accent: "var(--white)", shortLabel: "\u0647\u062F\u0641" }
});
var SECTION_BY_TASK_TYPE = Object.freeze({
  LEARN: "course-micro",
  REVIEW: "course-comprehensive",
  PRACTICE: "test-bank",
  TEST: "test-bank",
  ANALYZE: "analytics",
  READ_REFERENCE: "reference",
  WIKI_REVIEW: "wiki",
  KNOWLEDGE_LINK: "knowledge",
  FLASHCARD_REVIEW: "flashcards",
  MOCK_EXAM: "coordinated-exam"
});
var COURSE_COLORS = Object.freeze({
  anatomy: "var(--blue-ink)",
  physiology: "var(--copper-ink)",
  biochemistry: "var(--green-ink)",
  histology: "var(--green-bright)",
  microbiology: "var(--brown-bright)",
  immunology: "var(--purple-ink)",
  pathology: "var(--red-ink)",
  genetics: "var(--purple-bright)",
  virology: "var(--rose)",
  mycology: "var(--brown-bright)",
  parasitology: "var(--gold-ink)",
  embryology: "var(--blue-bright)",
  pharmacology: "var(--purple-ink)",
  hygiene: "var(--blue-ink)",
  english: "var(--copper-ink)"
});
var toFa = (value) => String(value ?? "").replace(/\d/g, (digit) => "\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9"[Number(digit)]);

// src/services/coordinatedExams/mockData.js
var DAY = 864e5;
var MINUTE = 6e4;
var now = () => Date.now();
function atCleanHour(offsetDays, hour, minute = 0) {
  const date = new Date(Date.now() + offsetDays * DAY);
  date.setHours(hour, minute, 0, 0);
  if (offsetDays === 0 && date.getTime() < Date.now()) date.setDate(date.getDate() + 1);
  return date.getTime();
}
var EXAMS = [
  {
    id: "exam-basic-national-01",
    slug: "basic-sciences-national-01",
    title: "\u0622\u0632\u0645\u0648\u0646 \u062C\u0627\u0645\u0639 \u0647\u0645\u0627\u0647\u0646\u06AF \u0639\u0644\u0648\u0645 \u067E\u0627\u06CC\u0647 \u062A\u067E\u0634",
    shortName: "\u062C\u0627\u0645\u0639 \u0639\u0644\u0648\u0645 \u067E\u0627\u06CC\u0647",
    type: "national",
    organizer: "\u062A\u06CC\u0645 \u0622\u0632\u0645\u0648\u0646 \u062A\u067E\u0634",
    description: "\u062C\u0627\u0645\u0639\u200C\u062A\u0631\u06CC\u0646 \u0622\u0632\u0645\u0648\u0646 \u0647\u0645\u0627\u0647\u0646\u06AF \u0639\u0644\u0648\u0645 \u067E\u0627\u06CC\u0647 \u0628\u06CC\u0646 \u062F\u0627\u0646\u0634\u062C\u0648\u06CC\u0627\u0646 \u0633\u0631\u0627\u0633\u0631 \u06A9\u0634\u0648\u0631\u061B \u0628\u0627 \u0633\u0624\u0627\u0644\u200C\u0647\u0627\u06CC \u062A\u0627\u0644\u06CC\u0641\u06CC \u0647\u0645\u200C\u0633\u0648 \u0628\u0627 \u0622\u0632\u0645\u0648\u0646 \u0639\u0644\u0648\u0645 \u067E\u0627\u06CC\u0647 \u0648\u0632\u0627\u0631\u062A \u0628\u0647\u062F\u0627\u0634\u062A \u0637\u0631\u0627\u062D\u06CC \u0634\u062F\u0647 \u062A\u0627 \u0646\u0642\u0637\u0647\u0654 \u0627\u06CC\u0633\u062A\u0627\u06CC\u06CC \u062E\u0648\u062F \u0631\u0627 \u0642\u0628\u0644 \u0627\u0632 \u0622\u0632\u0645\u0648\u0646 \u0627\u0635\u0644\u06CC \u0628\u0633\u0646\u062C\u06CC\u062F.",
    subject: "\u0639\u0644\u0648\u0645 \u067E\u0627\u06CC\u0647 \u067E\u0632\u0634\u06A9\u06CC",
    topics: ["\u0641\u06CC\u0632\u06CC\u0648\u0644\u0648\u0698\u06CC", "\u0628\u06CC\u0648\u0634\u06CC\u0645\u06CC", "\u0622\u0646\u0627\u062A\u0648\u0645\u06CC", "\u0628\u0627\u0641\u062A\u200C\u0634\u0646\u0627\u0633\u06CC", "\u062C\u0646\u06CC\u0646\u200C\u0634\u0646\u0627\u0633\u06CC", "\u0627\u06CC\u0645\u0648\u0646\u0648\u0644\u0648\u0698\u06CC"],
    difficulty: "hard",
    audience: "\u062F\u0627\u0646\u0634\u062C\u0648\u06CC\u0627\u0646 \u067E\u0632\u0634\u06A9\u06CC\u060C \u062F\u0646\u062F\u0627\u0646\u200C\u067E\u0632\u0634\u06A9\u06CC \u0648 \u062F\u0627\u0631\u0648\u0633\u0627\u0632\u06CC",
    level: "\u067E\u0627\u06CC\u0627\u0646 \u062F\u0648\u0631\u0647\u0654 \u0639\u0644\u0648\u0645 \u067E\u0627\u06CC\u0647",
    duration: 120,
    questionCount: 100,
    startTime: atCleanHour(2, 10, 0),
    endTime: atCleanHour(2, 10, 0) + 120 * MINUTE,
    registrationOpenAt: now() - 3 * DAY,
    registrationDeadline: atCleanHour(2, 10, 0) - 12 * 60 * MINUTE,
    resultReleaseAt: atCleanHour(2, 10, 0) + 120 * MINUTE + 6 * 60 * MINUTE,
    participantsCount: 3482,
    universities: ["\u062A\u0647\u0631\u0627\u0646", "\u0634\u0647\u06CC\u062F \u0628\u0647\u0634\u062A\u06CC", "\u0627\u06CC\u0631\u0627\u0646", "\u0645\u0634\u0647\u062F", "\u062A\u0628\u0631\u06CC\u0632", "\u0634\u06CC\u0631\u0627\u0632", "\u0627\u0635\u0641\u0647\u0627\u0646", "\u0633\u0627\u06CC\u0631 \u062F\u0627\u0646\u0634\u06AF\u0627\u0647\u200C\u0647\u0627"],
    accent: "#61D192",
    glyph: "shield",
    featured: true,
    rules: {
      negativeMarking: -0.25,
      allowBackNavigation: true,
      allowAnswerChange: true,
      attemptLimit: 1,
      deadlineMode: "exam_end",
      allowMarking: true
    }
  },
  {
    id: "exam-physio-live-01",
    slug: "physio-heart-live-01",
    title: "\u0622\u0632\u0645\u0648\u0646 \u0647\u0645\u0627\u0647\u0646\u06AF \u0641\u06CC\u0632\u06CC\u0648\u0644\u0648\u0698\u06CC \u0642\u0644\u0628",
    shortName: "\u0647\u0645\u0627\u0647\u0646\u06AF \u0641\u06CC\u0632\u06CC\u0648\u0644\u0648\u0698\u06CC",
    type: "subject",
    organizer: "\u062A\u06CC\u0645 \u0622\u0632\u0645\u0648\u0646 \u062A\u067E\u0634",
    description: "\u0622\u0632\u0645\u0648\u0646 \u0647\u0645\u0627\u0647\u0646\u06AF \u0645\u0648\u0636\u0648\u0639\u06CC \u0631\u0648\u06CC \u0641\u06CC\u0632\u06CC\u0648\u0644\u0648\u0698\u06CC \u0642\u0644\u0628 \u0648 \u06AF\u0631\u062F\u0634 \u062E\u0648\u0646\u061B \u0647\u0645\u200C\u0632\u0645\u0627\u0646 \u0628\u0627 \u062F\u0627\u0646\u0634\u062C\u0648\u06CC\u0627\u0646 \u0633\u0631\u0627\u0633\u0631 \u06A9\u0634\u0648\u0631 \u0648 \u0628\u0627 \u06A9\u0627\u0631\u0646\u0627\u0645\u0647 \u0648 \u0631\u062A\u0628\u0647\u0654 \u0644\u062D\u0638\u0647\u200C\u0627\u06CC \u0628\u0639\u062F \u0627\u0632 \u067E\u0627\u06CC\u0627\u0646.",
    subject: "\u0641\u06CC\u0632\u06CC\u0648\u0644\u0648\u0698\u06CC",
    topics: ["\u0641\u06CC\u0632\u06CC\u0648\u0644\u0648\u0698\u06CC \u0642\u0644\u0628", "\u067E\u062A\u0627\u0646\u0633\u06CC\u0644 \u0639\u0645\u0644 \u0642\u0644\u0628\u06CC", "\u0686\u0631\u062E\u0647\u0654 \u0642\u0644\u0628\u06CC", "ECG", "\u062A\u0646\u0638\u06CC\u0645 \u0641\u0634\u0627\u0631 \u062E\u0648\u0646"],
    difficulty: "medium",
    audience: "\u062F\u0627\u0646\u0634\u062C\u0648\u06CC\u0627\u0646 \u0639\u0644\u0648\u0645 \u067E\u0632\u0634\u06A9\u06CC \u2014 \u062A\u0631\u0645 \u06F3 \u0628\u0647 \u0628\u0627\u0644\u0627",
    level: "\u0645\u06CC\u0627\u0646\u200C\u062A\u0631\u0645",
    duration: 90,
    questionCount: 8,
    startTime: now() - 32 * MINUTE,
    endTime: now() + 88 * MINUTE,
    registrationOpenAt: now() - 2 * DAY,
    registrationDeadline: now() - 32 * MINUTE,
    resultReleaseAt: now() + 88 * MINUTE + 45 * MINUTE,
    participantsCount: 1286,
    accent: "#937fcd",
    glyph: "orbit",
    rules: {
      negativeMarking: -0.25,
      allowBackNavigation: true,
      allowAnswerChange: true,
      attemptLimit: 1,
      deadlineMode: "exam_end",
      allowMarking: true
    }
  },
  {
    id: "exam-daily-quiz",
    slug: "daily-quiz",
    title: "\u0622\u0632\u0645\u0648\u0646\u06A9 \u0631\u0648\u0632\u0627\u0646\u0647 \u062A\u067E\u0634",
    shortName: "\u0622\u0632\u0645\u0648\u0646\u06A9 \u0631\u0648\u0632\u0627\u0646\u0647",
    type: "quiz",
    organizer: "\u062A\u06CC\u0645 \u0645\u062D\u062A\u0648\u0627\u06CC \u062A\u067E\u0634",
    description: "\u067E\u0646\u062C \u0633\u0624\u0627\u0644 \u06A9\u0648\u062A\u0627\u0647 \u0647\u0631 \u0631\u0648\u0632 \u0627\u0632 \u0645\u0628\u0627\u062D\u062B \u067E\u0631\u062A\u06A9\u0631\u0627\u0631\u061B \u0628\u062F\u0648\u0646 \u062B\u0628\u062A\u200C\u0646\u0627\u0645\u060C \u0647\u0645\u06CC\u0634\u0647 \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u2014 \u0628\u0631\u0627\u06CC \u06AF\u0631\u0645\u200C\u06A9\u0631\u062F\u0646 \u0630\u0647\u0646 \u0642\u0628\u0644 \u0627\u0632 \u0645\u0637\u0627\u0644\u0639\u0647.",
    subject: "\u0639\u0644\u0648\u0645 \u067E\u0627\u06CC\u0647",
    topics: ["\u0647\u06CC\u0628\u0631\u06CC\u062F \u062F\u0627\u0626\u0645", "\u0686\u0631\u062E\u0647\u0654 \u06A9\u0631\u0628\u0633", "\u0648\u06CC\u062A\u0627\u0645\u06CC\u0646\u200C\u0647\u0627", "\u0641\u06CC\u0632\u06CC\u0648\u0644\u0648\u0698\u06CC \u0639\u0645\u0648\u0645\u06CC"],
    difficulty: "easy",
    audience: "\u0647\u0645\u0647\u0654 \u062F\u0627\u0646\u0634\u062C\u0648\u06CC\u0627\u0646 \u0639\u0644\u0648\u0645 \u067E\u0632\u0634\u06A9\u06CC",
    level: "\u0645\u062A\u0641\u0631\u0642\u0647",
    duration: 5,
    questionCount: 5,
    alwaysAvailable: true,
    startTime: now() - DAY,
    endTime: now() + DAY,
    resultReleaseAt: 0,
    participantsCount: 5217,
    accent: "#e0b45c",
    glyph: "spark",
    rules: {
      negativeMarking: 0,
      allowBackNavigation: true,
      allowAnswerChange: true,
      attemptLimit: 3,
      deadlineMode: "per_attempt",
      allowMarking: false
    }
  },
  {
    id: "exam-biochem-past-01",
    slug: "biochem-subject-01",
    title: "\u0622\u0632\u0645\u0648\u0646 \u0645\u0648\u0636\u0648\u0639\u06CC \u0628\u06CC\u0648\u0634\u06CC\u0645\u06CC \u2014 \u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u0633\u0645",
    shortName: "\u0645\u0648\u0636\u0648\u0639\u06CC \u0628\u06CC\u0648\u0634\u06CC\u0645\u06CC",
    type: "subject",
    organizer: "\u062A\u06CC\u0645 \u0622\u0632\u0645\u0648\u0646 \u062A\u067E\u0634",
    description: "\u0622\u0632\u0645\u0648\u0646 \u0645\u0648\u0636\u0648\u0639\u06CC \u0628\u06CC\u0648\u0634\u06CC\u0645\u06CC \u0628\u0627 \u062A\u0645\u0631\u06A9\u0632 \u0631\u0648\u06CC \u06AF\u0644\u06CC\u06A9\u0648\u0644\u06CC\u0632\u060C \u0686\u0631\u062E\u0647\u0654 \u06A9\u0631\u0628\u0633 \u0648 \u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u0633\u0645 \u0627\u0646\u0631\u0698\u06CC\u061B \u0628\u0631\u06AF\u0632\u0627\u0631\u0634\u062F\u0647 \u062F\u0631 \u0645\u0631\u062F\u0627\u062F \u0645\u0627\u0647.",
    subject: "\u0628\u06CC\u0648\u0634\u06CC\u0645\u06CC",
    topics: ["\u06AF\u0644\u06CC\u06A9\u0648\u0644\u06CC\u0632", "\u0686\u0631\u062E\u0647\u0654 \u06A9\u0631\u0628\u0633", "\u0645\u062A\u0633\u0627\u0648\u06CC\u200C\u0627\u0646\u0631\u0698\u06CC", "\u0633\u0627\u062E\u062A\u0627\u0631 \u067E\u0631\u0648\u062A\u0626\u06CC\u0646"],
    difficulty: "medium",
    audience: "\u062F\u0627\u0646\u0634\u062C\u0648\u06CC\u0627\u0646 \u067E\u0632\u0634\u06A9\u06CC \u0648 \u062F\u0646\u062F\u0627\u0646\u200C\u067E\u0632\u0634\u06A9\u06CC",
    level: "\u067E\u0627\u06CC\u0627\u0646 \u0645\u0628\u062D\u062B",
    duration: 45,
    questionCount: 6,
    startTime: now() - 12 * DAY,
    endTime: now() - 12 * DAY + 45 * MINUTE,
    registrationOpenAt: now() - 18 * DAY,
    registrationDeadline: now() - 12 * DAY,
    resultReleaseAt: now() - 12 * DAY + 3 * 60 * MINUTE,
    participantsCount: 842,
    accent: "#77b787",
    glyph: "delta",
    rules: {
      negativeMarking: -0.25,
      allowBackNavigation: true,
      allowAnswerChange: true,
      attemptLimit: 1,
      deadlineMode: "exam_end",
      allowMarking: true
    }
  },
  {
    id: "exam-basic-mock-aug",
    slug: "basic-sciences-mock-aug",
    title: "\u0622\u0632\u0645\u0648\u0646 \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC \u0639\u0644\u0648\u0645 \u067E\u0627\u06CC\u0647 \u0645\u0631\u062F\u0627\u062F",
    shortName: "\u0622\u0632\u0645\u0627\u06CC\u0634\u06CC \u0645\u0631\u062F\u0627\u062F",
    type: "mock",
    organizer: "\u062A\u06CC\u0645 \u0622\u0632\u0645\u0648\u0646 \u062A\u067E\u0634",
    description: "\u0634\u0628\u06CC\u0647\u200C\u0633\u0627\u0632 \u06A9\u0627\u0645\u0644 \u0622\u0632\u0645\u0648\u0646 \u0639\u0644\u0648\u0645 \u067E\u0627\u06CC\u0647 \u0648\u0632\u0627\u0631\u062A \u0628\u0647\u062F\u0627\u0634\u062A \u0628\u0627 \u062A\u0631\u0627\u0632 \u0648 \u0631\u062A\u0628\u0647\u0654 \u06A9\u0634\u0648\u0631\u06CC\u061B \u0628\u0631\u0627\u06CC \u0633\u0646\u062C\u0634 \u0648\u0636\u0639\u06CC\u062A \u0642\u0628\u0644 \u0627\u0632 \u062C\u0645\u0639\u200C\u0628\u0646\u062F\u06CC.",
    subject: "\u0639\u0644\u0648\u0645 \u067E\u0627\u06CC\u0647 \u067E\u0632\u0634\u06A9\u06CC",
    topics: ["\u0641\u06CC\u0632\u06CC\u0648\u0644\u0648\u0698\u06CC", "\u0628\u06CC\u0648\u0634\u06CC\u0645\u06CC", "\u0622\u0646\u0627\u062A\u0648\u0645\u06CC"],
    difficulty: "hard",
    audience: "\u062F\u0627\u0646\u0634\u062C\u0648\u06CC\u0627\u0646 \u0639\u0644\u0648\u0645 \u067E\u0632\u0634\u06A9\u06CC",
    level: "\u0634\u0628\u06CC\u0647\u200C\u0633\u0627\u0632 \u0631\u0633\u0645\u06CC",
    duration: 150,
    questionCount: 120,
    startTime: now() - 26 * DAY,
    endTime: now() - 26 * DAY + 150 * MINUTE,
    registrationOpenAt: now() - 33 * DAY,
    registrationDeadline: now() - 26 * DAY,
    resultReleaseAt: now() - 26 * DAY + 180 * MINUTE,
    participantsCount: 2614,
    accent: "#5b8cc7",
    glyph: "arch",
    rules: {
      negativeMarking: -0.25,
      allowBackNavigation: true,
      allowAnswerChange: true,
      attemptLimit: 1,
      deadlineMode: "exam_end",
      allowMarking: true
    }
  },
  {
    id: "exam-first-term-01",
    slug: "first-term-comprehensive-01",
    title: "\u0622\u0632\u0645\u0648\u0646 \u062C\u0627\u0645\u0639 \u0627\u0648\u0644 \u062A\u0631\u0645 \u2014 \u0622\u0628\u0627\u0646",
    shortName: "\u062C\u0627\u0645\u0639 \u0627\u0648\u0644 \u062A\u0631\u0645",
    type: "comprehensive",
    organizer: "\u062A\u06CC\u0645 \u0622\u0632\u0645\u0648\u0646 \u062A\u067E\u0634",
    description: "\u0622\u0632\u0645\u0648\u0646 \u062C\u0627\u0645\u0639 \u0634\u0631\u0648\u0639 \u0646\u06CC\u0645\u200C\u0633\u0627\u0644\u061B \u067E\u0648\u0634\u0634 \u0645\u0628\u0627\u062D\u062B \u062A\u0631\u0645 \u062C\u0627\u0631\u06CC \u0628\u0631\u0627\u06CC \u062C\u0647\u062A\u200C\u06AF\u06CC\u0631\u06CC \u0645\u0637\u0627\u0644\u0639\u0647 \u0627\u0632 \u0627\u0628\u062A\u062F\u0627\u06CC \u0633\u0627\u0644 \u062A\u062D\u0635\u06CC\u0644\u06CC. \u062B\u0628\u062A\u200C\u0646\u0627\u0645 \u0628\u0647\u200C\u0632\u0648\u062F\u06CC \u0628\u0627\u0632 \u0645\u06CC\u200C\u0634\u0648\u062F.",
    subject: "\u0639\u0644\u0648\u0645 \u067E\u0627\u06CC\u0647",
    topics: ["\u0641\u06CC\u0632\u06CC\u0648\u0644\u0648\u0698\u06CC", "\u0622\u0646\u0627\u062A\u0648\u0645\u06CC", "\u0647\u06CC\u0633\u062A\u0648\u0644\u0648\u0698\u06CC"],
    difficulty: "medium",
    audience: "\u062F\u0627\u0646\u0634\u062C\u0648\u06CC\u0627\u0646 \u062C\u062F\u06CC\u062F\u0627\u0644\u0648\u0631\u0648\u062F \u0648 \u062A\u0631\u0645 \u06F2",
    level: "\u0634\u0631\u0648\u0639 \u062A\u0631\u0645",
    duration: 90,
    questionCount: 60,
    startTime: atCleanHour(48, 16, 0),
    endTime: atCleanHour(48, 16, 0) + 90 * MINUTE,
    registrationOpenAt: atCleanHour(10, 12, 0),
    registrationDeadline: atCleanHour(48, 16, 0) - 12 * 60 * MINUTE,
    resultReleaseAt: atCleanHour(48, 16, 0) + 90 * MINUTE + 6 * 60 * MINUTE,
    participantsCount: 0,
    accent: "#937fcd",
    glyph: "compass",
    rules: {
      negativeMarking: -0.25,
      allowBackNavigation: true,
      allowAnswerChange: true,
      attemptLimit: 1,
      deadlineMode: "exam_end",
      allowMarking: true
    }
  }
];

// src/services/testBank/mockData.js
var SUBJECTS = [
  { id: "physiology", name: "\u0641\u06CC\u0632\u06CC\u0648\u0644\u0648\u0698\u06CC", accent: "#937fcd", topics: true },
  { id: "anatomy", name: "\u0622\u0646\u0627\u062A\u0648\u0645\u06CC", accent: "#5b8cc7", topics: true },
  { id: "biochemistry", name: "\u0628\u06CC\u0648\u0634\u06CC\u0645\u06CC", accent: "#77b787", topics: true },
  { id: "microbiology", name: "\u0645\u06CC\u06A9\u0631\u0648\u0628\u200C\u0634\u0646\u0627\u0633\u06CC", accent: "#ab8e7c", topics: true },
  { id: "immunology", name: "\u0627\u06CC\u0645\u0646\u06CC\u200C\u0634\u0646\u0627\u0633\u06CC", accent: "#61D192", topics: false },
  { id: "pathology", name: "\u067E\u0627\u062A\u0648\u0644\u0648\u0698\u06CC", accent: "#e0b45c", topics: false },
  { id: "virology", name: "\u0648\u06CC\u0631\u0648\u0633\u200C\u0634\u0646\u0627\u0633\u06CC", accent: "#ef9196", topics: false },
  { id: "mycology", name: "\u0642\u0627\u0631\u0686\u200C\u0634\u0646\u0627\u0633\u06CC", accent: "#b99a86", topics: false },
  { id: "parasitology", name: "\u0627\u0646\u06AF\u0644\u200C\u0634\u0646\u0627\u0633\u06CC", accent: "#d5bba9", topics: false },
  { id: "genetics", name: "\u0698\u0646\u062A\u06CC\u06A9", accent: "#c9bdf0", topics: false },
  { id: "histology", name: "\u0628\u0627\u0641\u062A\u200C\u0634\u0646\u0627\u0633\u06CC", accent: "#8fbcd4", topics: false },
  { id: "esl", name: "\u0632\u0628\u0627\u0646 \u062A\u062E\u0635\u0635\u06CC", accent: "#9aa5b1", topics: false }
];
var TOPIC_TREE = {
  physiology: [
    {
      name: "\u0642\u0644\u0628 \u0648 \u0639\u0631\u0648\u0642",
      children: ["\u0627\u0644\u06A9\u062A\u0631\u0648\u0641\u06CC\u0632\u06CC\u0648\u0644\u0648\u0698\u06CC \u0642\u0644\u0628", "\u0686\u0631\u062E\u0647\u0654 \u0642\u0644\u0628\u06CC", "ECG", "\u062A\u0646\u0638\u06CC\u0645 \u0641\u0634\u0627\u0631 \u062E\u0648\u0646"]
    },
    {
      name: "\u062A\u0646\u0641\u0633",
      children: ["\u062D\u062C\u0645\u200C\u0647\u0627 \u0648 \u0638\u0631\u0641\u06CC\u062A\u200C\u0647\u0627\u06CC \u0631\u06CC\u0648\u06CC", "\u0627\u0646\u062A\u0642\u0627\u0644 \u06AF\u0627\u0632\u0647\u0627"]
    },
    {
      name: "\u06A9\u0644\u06CC\u0647",
      children: ["\u0641\u06CC\u0632\u06CC\u0648\u0644\u0648\u0698\u06CC \u0644\u0648\u0644\u0647\u200C\u0647\u0627\u06CC \u0646\u0641\u0631\u0648\u0646", "\u062A\u0639\u0627\u062F\u0644 \u0627\u0633\u06CC\u062F-\u0628\u0627\u0632"]
    },
    {
      name: "\u0639\u0635\u0628",
      children: ["\u0633\u06CC\u0646\u0627\u067E\u0633 \u0648 \u06AF\u06CC\u0631\u0646\u062F\u0647\u200C\u0647\u0627", "\u0633\u06CC\u0633\u062A\u0645 \u0639\u0635\u0628\u06CC \u062E\u0648\u062F\u06A9\u0627\u0631"]
    },
    { name: "\u06AF\u0648\u0627\u0631\u0634", children: ["\u0647\u0648\u0631\u0645\u0648\u0646\u200C\u0647\u0627\u06CC \u06AF\u0648\u0627\u0631\u0634\u06CC"] },
    { name: "\u063A\u062F\u062F \u062F\u0631\u0648\u0646\u200C\u0631\u06CC\u0632", children: ["\u063A\u062F\u0647\u0654 \u062A\u06CC\u0631\u0648\u0626\u06CC\u062F"] },
    { name: "\u062E\u0648\u0646", children: ["\u0627\u0646\u0639\u0642\u0627\u062F \u062E\u0648\u0646"] },
    { name: "\u0639\u0636\u0644\u0647", children: ["\u0641\u06CC\u0632\u06CC\u0648\u0644\u0648\u0698\u06CC \u0627\u0646\u0642\u0628\u0627\u0636"] },
    { name: "\u063A\u062F\u062F \u0628\u0632\u0627\u0642\u06CC", children: ["\u062A\u0631\u0634\u062D \u0648 \u062A\u0646\u0638\u06CC\u0645 \u0628\u0632\u0627\u0642"] }
  ],
  anatomy: [
    {
      name: "\u0627\u0646\u062F\u0627\u0645 \u0641\u0648\u0642\u0627\u0646\u06CC",
      children: ["\u0627\u0639\u0635\u0627\u0628 \u0627\u0646\u062F\u0627\u0645 \u0641\u0648\u0642\u0627\u0646\u06CC", "\u0627\u0633\u062A\u062E\u0648\u0627\u0646\u200C\u0634\u0646\u0627\u0633\u06CC", "\u0646\u0627\u062D\u06CC\u0647\u0654 \u0633\u0631\u0634\u0627\u0646\u0647 \u0648 \u0628\u0631\u0627\u06A9\u06CC\u0627\u0644 \u067E\u0644\u06A9\u0633\u0648\u0633"]
    },
    { name: "\u0642\u0644\u0628 \u0648 \u062A\u0648\u0631\u0627\u06A9\u0633", children: ["\u0622\u0646\u0627\u062A\u0648\u0645\u06CC \u0642\u0644\u0628", "\u062F\u06CC\u0627\u0641\u0631\u0627\u06AF\u0645"] },
    { name: "\u0627\u0646\u062F\u0627\u0645 \u062A\u062D\u062A\u0627\u0646\u06CC", children: ["\u0627\u0639\u0635\u0627\u0628 \u0627\u0646\u062F\u0627\u0645 \u062A\u062D\u062A\u0627\u0646\u06CC"] },
    { name: "\u0634\u06A9\u0645 \u0648 \u0644\u06AF\u0646", children: ["\u06A9\u0627\u0646\u0627\u0644 \u0627\u06CC\u0646\u06AF\u0648\u06CC\u0646\u0627\u0644"] },
    { name: "\u0633\u0631 \u0648 \u06AF\u0631\u062F\u0646", children: ["\u062A\u0631\u0627\u06CC\u06AF\u0644\u200C\u0647\u0627\u06CC \u06AF\u0631\u062F\u0646", "\u0639\u0635\u0628 \u0633\u0647\u200C\u0642\u0644\u0648 \u0648 \u0634\u0627\u062E\u0647\u200C\u0647\u0627"] },
    { name: "\u0646\u0648\u0631\u0648\u0622\u0646\u0627\u062A\u0648\u0645\u06CC", children: ["\u0633\u06CC\u0633\u062A\u0645 \u0628\u06CC\u0646\u0627\u06CC\u06CC", "\u0639\u0631\u0648\u0642 \u0645\u063A\u0632"] }
  ],
  biochemistry: [
    { name: "\u0622\u0646\u0632\u06CC\u0645\u200C\u0647\u0627", children: ["\u0633\u06CC\u0646\u062A\u06CC\u06A9 \u0622\u0646\u0632\u06CC\u0645\u06CC", "\u0645\u0647\u0627\u0631\u06A9\u0646\u0646\u062F\u0647\u200C\u0647\u0627\u06CC \u0622\u0646\u0632\u06CC\u0645\u06CC"] },
    {
      name: "\u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u0633\u0645 \u06A9\u0631\u0628\u0648\u0647\u06CC\u062F\u0631\u0627\u062A",
      children: ["\u06AF\u0644\u06CC\u06A9\u0648\u0644\u06CC\u0632 \u0648 \u06AF\u0644\u0648\u06A9\u0648\u0646\u0626\u0648\u0698\u0646\u0632", "\u0634\u0646\u062A \u0647\u06AF\u0632\u0648\u0632 \u0645\u0648\u0646\u0648\u0641\u0633\u0641\u0627\u062A"]
    },
    { name: "\u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u0633\u0645 \u0644\u06CC\u067E\u06CC\u062F", children: ["\u0633\u0646\u062A\u0632 \u0627\u0633\u06CC\u062F \u0686\u0631\u0628"] },
    { name: "\u0628\u06CC\u0648\u0634\u06CC\u0645\u06CC \u0645\u0648\u0644\u06A9\u0648\u0644\u06CC", children: ["\u062A\u0631\u062C\u0645\u0647\u0654 \u067E\u0631\u0648\u062A\u0626\u06CC\u0646", "\u062C\u0647\u0634\u200C\u0647\u0627", "\u0633\u0627\u062E\u062A\u0627\u0631 \u06A9\u0644\u0627\u0698\u0646"] },
    { name: "\u0648\u06CC\u062A\u0627\u0645\u06CC\u0646\u200C\u0647\u0627", children: ["\u0648\u06CC\u062A\u0627\u0645\u06CC\u0646\u200C\u0647\u0627\u06CC \u0645\u062D\u0644\u0648\u0644 \u062F\u0631 \u0686\u0631\u0628\u06CC"] },
    { name: "\u062A\u0639\u0627\u062F\u0644 \u0627\u0633\u06CC\u062F-\u0628\u0627\u0632", children: ["\u0628\u0627\u0641\u0631\u0647\u0627"] },
    { name: "\u0686\u0631\u062E\u0647\u0654 \u0627\u0648\u0631\u0647", children: [] }
  ],
  histology: [
    { name: "\u0628\u0627\u0641\u062A\u200C\u0634\u0646\u0627\u0633\u06CC \u062F\u0647\u0627\u0646 \u0648 \u062F\u0646\u062F\u0627\u0646", children: ["\u0645\u06CC\u0646\u0627 \u0648 \u0639\u0627\u062C", "\u0645\u062E\u0627\u0637 \u062F\u0647\u0627\u0646"] },
    { name: "\u0628\u0627\u0641\u062A \u067E\u0648\u0634\u0634\u06CC", children: ["\u0627\u067E\u06CC\u062A\u0644\u06CC\u0648\u0645\u200C\u0647\u0627"] }
  ],
  microbiology: [
    { name: "\u0628\u0627\u06A9\u062A\u0631\u06CC\u200C\u0647\u0627\u06CC \u06AF\u0631\u0645 \u0645\u062B\u0628\u062A", children: ["\u0627\u0633\u062A\u0627\u0641\u06CC\u0644\u0648\u06A9\u0648\u06A9", "\u0627\u0633\u062A\u0631\u067E\u062A\u0648\u06A9\u0648\u06A9"] },
    { name: "\u0628\u0627\u06A9\u062A\u0631\u06CC\u200C\u0647\u0627\u06CC \u06AF\u0631\u0645 \u0645\u0646\u0641\u06CC", children: ["\u0622\u0646\u062A\u0631\u0648\u0628\u0627\u06A9\u062A\u0631\u06CC\u0627\u0633\u0647"] }
  ],
  immunology: [
    { name: "\u067E\u0627\u0633\u062E \u0627\u06CC\u0645\u0646\u06CC \u0647\u0648\u0645\u0648\u0631\u0627\u0644", children: ["\u0627\u06CC\u0645\u0648\u0646\u0648\u06AF\u0644\u0648\u0628\u0648\u0644\u06CC\u0646\u200C\u0647\u0627"] },
    { name: "\u0627\u06CC\u0645\u0646\u06CC \u0633\u0644\u0648\u0644\u06CC", children: ["\u0644\u0646\u0641\u0648\u0633\u06CC\u062A T"] }
  ],
  pathology: [{ name: "\u067E\u0627\u062A\u0648\u0644\u0648\u0698\u06CC \u062F\u0647\u0627\u0646", children: ["\u0636\u0627\u06CC\u0639\u0627\u062A \u067E\u06CC\u0634\u200C\u0628\u062F\u062E\u06CC\u0645"] }]
};
var QUESTIONS = [
  /* ═══════════════ فیزیولوژی (۱۵ سؤال) ═══════════════ */
  {
    id: "tb-phy-01",
    track: "medicine",
    subject: "physiology",
    topicPath: ["\u0642\u0644\u0628 \u0648 \u0639\u0631\u0648\u0642", "\u0686\u0631\u062E\u0647\u0654 \u0642\u0644\u0628\u06CC"],
    type: "memorization",
    difficulty: "easy",
    year: 1399,
    source: "official",
    tags: ["\u067E\u0631\u062A\u06A9\u0631\u0627\u0631"],
    stem: "\u0635\u062F\u0627\u06CC \u0627\u0648\u0644 \u0642\u0644\u0628 (S1) \u0639\u0645\u062F\u062A\u0627\u064B \u0628\u0647 \u0628\u0633\u062A\u0647\u200C\u0634\u062F\u0646 \u06A9\u062F\u0627\u0645 \u062F\u0631\u06CC\u0686\u0647\u200C\u0647\u0627 \u0645\u0631\u0628\u0648\u0637 \u0627\u0633\u062A\u061F",
    figure: null,
    options: [
      "\u062F\u0631\u06CC\u0686\u0647\u200C\u0647\u0627\u06CC \u0645\u06CC\u062A\u0631\u0627\u0644 \u0648 \u0633\u0647\u200C\u0644\u062E\u062A\u06CC (AV) \u062F\u0631 \u0627\u0628\u062A\u062F\u0627\u06CC \u0633\u06CC\u0633\u062A\u0648\u0644",
      "\u062F\u0631\u06CC\u0686\u0647\u200C\u0647\u0627\u06CC \u0622\u0626\u0648\u0631\u062A \u0648 \u0634\u0634\u06CC \u062F\u0631 \u0627\u0628\u062A\u062F\u0627\u06CC \u062F\u06CC\u0627\u0633\u062A\u0648\u0644",
      "\u062F\u0631\u06CC\u0686\u0647\u200C\u0647\u0627\u06CC \u0645\u06CC\u062A\u0631\u0627\u0644 \u0648 \u0633\u0647\u200C\u0644\u062E\u062A\u06CC \u062F\u0631 \u0627\u0628\u062A\u062F\u0627\u06CC \u062F\u06CC\u0627\u0633\u062A\u0648\u0644",
      "\u062F\u0631\u06CC\u0686\u0647\u200C\u0647\u0627\u06CC \u0622\u0626\u0648\u0631\u062A \u0648 \u0634\u0634\u06CC \u062F\u0631 \u0627\u0628\u062A\u062F\u0627\u06CC \u0633\u06CC\u0633\u062A\u0648\u0644"
    ],
    correctAnswer: 0,
    explanation: {
      summary: "S1 \u0635\u062F\u0627\u06CC \u0628\u0633\u062A\u0647\u200C\u0634\u062F\u0646 \u062F\u0631\u06CC\u0686\u0647\u200C\u0647\u0627\u06CC \u062F\u0647\u0644\u06CC\u0632\u06CC-\u0628\u0637\u0646\u06CC (\u0645\u06CC\u062A\u0631\u0627\u0644 \u0648 \u0633\u0647\u200C\u0644\u062E\u062A\u06CC) \u062F\u0631 \u0627\u0628\u062A\u062F\u0627\u06CC \u0633\u06CC\u0633\u062A\u0648\u0644 \u0627\u0633\u062A.",
      deep: "\u0628\u0627 \u0622\u063A\u0627\u0632 \u0633\u06CC\u0633\u062A\u0648\u0644 \u0628\u0637\u0646\u06CC \u0648 \u0627\u0641\u0632\u0627\u06CC\u0634 \u0641\u0634\u0627\u0631 \u062F\u0631\u0648\u0646\u200C\u0628\u0637\u0646\u06CC\u060C \u062F\u0631\u06CC\u0686\u0647\u200C\u0647\u0627\u06CC AV \u0628\u0633\u062A\u0647 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F\u061B \u062A\u0648\u0642\u0641 \u0646\u0627\u06AF\u0647\u0627\u0646\u06CC \u062C\u0631\u06CC\u0627\u0646 \u062E\u0648\u0646 \u0648 \u0627\u0631\u062A\u0639\u0627\u0634 \u062F\u0631\u0648\u0646 \u062F\u0631\u06CC\u0686\u0647\u200C\u0647\u0627 \u0648 \u0633\u0627\u062E\u062A\u0627\u0631\u0647\u0627\u06CC \u0627\u0637\u0631\u0627\u0641\u060C \u0635\u062F\u0627\u06CC S1 \u0631\u0627 \u062A\u0648\u0644\u06CC\u062F \u0645\u06CC\u200C\u06A9\u0646\u062F. \u0627\u06CC\u0646 \u0635\u062F\u0627 \u0628\u0644\u0646\u062F\u062A\u0631 \u0648 \u06A9\u0634\u06CC\u062F\u0647\u200C\u062A\u0631 \u0627\u0632 S2 \u0627\u0633\u062A \u0648 \u0622\u063A\u0627\u0632 \u0633\u06CC\u0633\u062A\u0648\u0644 \u0631\u0627 \u0646\u0634\u0627\u0646 \u0645\u06CC\u200C\u062F\u0647\u062F.",
      keyPoint: "S1 = \u0628\u0633\u062A\u0647\u200C\u0634\u062F\u0646 AV \u062F\u0631 \u0622\u063A\u0627\u0632 \u0633\u06CC\u0633\u062A\u0648\u0644 | S2 = \u0628\u0633\u062A\u0647\u200C\u0634\u062F\u0646 \u0633\u06CC\u0645\u06CC\u0648\u0644\u0646\u0627\u0631 \u062F\u0631 \u0622\u063A\u0627\u0632 \u062F\u06CC\u0627\u0633\u062A\u0648\u0644.",
      trap: "\u0641\u0627\u0635\u0644\u0647\u0654 S1 \u062A\u0627 S2 \u0633\u06CC\u0633\u062A\u0648\u0644 \u0627\u0633\u062A\u061B \u0628\u0633\u06CC\u0627\u0631\u06CC \u062A\u0635\u0648\u0631 \u0645\u06CC\u200C\u06A9\u0646\u0646\u062F S1 \u0628\u0627 \u0628\u0627\u0632 \u0634\u062F\u0646 \u062F\u0631\u06CC\u0686\u0647\u200C\u0647\u0627 \u0647\u0645\u0631\u0627\u0647 \u0627\u0633\u062A\u060C \u062F\u0631 \u062D\u0627\u0644\u06CC \u06A9\u0647 \u0635\u062F\u0627\u06CC \u062F\u0631\u06CC\u0686\u0647 \u0641\u0642\u0637 \u062F\u0631 \u0644\u062D\u0638\u0647\u0654 \u0628\u0633\u062A\u0647\u200C\u0634\u062F\u0646 \u0634\u0646\u06CC\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F.",
      whyWrong: [
        { index: 1, text: "\u0627\u06CC\u0646 \u062A\u0639\u0631\u06CC\u0641 S2 \u0627\u0633\u062A\u060C \u0646\u0647 S1." },
        { index: 2, text: "\u062F\u0631\u06CC\u0686\u0647\u200C\u0647\u0627\u06CC AV \u062F\u0631 \u062F\u06CC\u0627\u0633\u062A\u0648\u0644 \u0628\u0627\u0632 \u0645\u06CC\u200C\u0645\u0627\u0646\u0646\u062F\u061B \u0635\u062F\u0627\u06CC \u0628\u0633\u062A\u0647\u200C\u0634\u062F\u0646 \u0622\u0646\u200C\u0647\u0627 \u062F\u0631 \u062F\u06CC\u0627\u0633\u062A\u0648\u0644 \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F." },
        { index: 3, text: "\u0628\u0633\u062A\u0647\u200C\u0634\u062F\u0646 \u062F\u0631\u06CC\u0686\u0647\u200C\u0647\u0627\u06CC \u0633\u06CC\u0645\u06CC\u0648\u0644\u0646\u0627\u0631\u060C \u0635\u062F\u0627\u06CC S2 \u0631\u0627 \u0645\u06CC\u200C\u0633\u0627\u0632\u062F." }
      ]
    },
    stats: { solves: 4128, correctPercent: 78, optionPercents: [78, 9, 6, 7], avgTimeSec: 26, difficultyIndex: 0.78 },
    createdAt: "2025-11-02",
    updatedAt: "2026-08-19"
  },
  {
    id: "tb-phy-02",
    track: "medicine",
    subject: "physiology",
    topicPath: ["\u0642\u0644\u0628 \u0648 \u0639\u0631\u0648\u0642", "ECG"],
    type: "concept",
    difficulty: "medium",
    year: 1400,
    source: "official",
    tags: ["\u067E\u0631\u062A\u06A9\u0631\u0627\u0631"],
    stem: "\u062F\u0631 \u0646\u0648\u0627\u0631 ECG \u0646\u0631\u0645\u0627\u0644\u060C \u0645\u0648\u062C T \u0646\u0645\u0627\u06CC\u0646\u062F\u0647\u0654 \u06A9\u062F\u0627\u0645 \u0631\u062E\u062F\u0627\u062F \u0627\u0644\u06A9\u062A\u0631\u06CC\u06A9\u06CC \u0627\u0633\u062A\u061F",
    figure: null,
    options: [
      "\u062F\u067E\u0648\u0644\u0627\u0631\u06CC\u0632\u0627\u0633\u06CC\u0648\u0646 \u062F\u0647\u0644\u06CC\u0632\u0647\u0627",
      "\u062F\u067E\u0648\u0644\u0627\u0631\u06CC\u0632\u0627\u0633\u06CC\u0648\u0646 \u0628\u0637\u0646\u200C\u0647\u0627",
      "\u0631\u06CC\u067E\u0648\u0644\u0627\u0631\u06CC\u0632\u0627\u0633\u06CC\u0648\u0646 \u0628\u0637\u0646\u200C\u0647\u0627",
      "\u0631\u06CC\u067E\u0648\u0644\u0627\u0631\u06CC\u0632\u0627\u0633\u06CC\u0648\u0646 \u062F\u0647\u0644\u06CC\u0632\u0647\u0627"
    ],
    correctAnswer: 2,
    explanation: {
      summary: "\u0645\u0648\u062C T \u0646\u0645\u0627\u06CC\u0646\u062F\u0647\u0654 \u0631\u06CC\u067E\u0648\u0644\u0627\u0631\u06CC\u0632\u0627\u0633\u06CC\u0648\u0646 \u0628\u0637\u0646\u200C\u0647\u0627\u0633\u062A.",
      deep: "\u0631\u06CC\u067E\u0648\u0644\u0627\u0631\u06CC\u0632\u0627\u0633\u06CC\u0648\u0646 \u062F\u0647\u0644\u06CC\u0632\u0647\u0627 \u062F\u0631 \u062F\u0627\u062E\u0644 \u06A9\u0645\u067E\u0644\u06A9\u0633 QRS \u0645\u062F\u0641\u0648\u0646 \u0627\u0633\u062A \u0648 \u0645\u0648\u062C \u0645\u0633\u062A\u0642\u0644\u06CC \u0646\u062F\u0627\u0631\u062F\u061B \u0627\u0645\u0627 \u0631\u06CC\u067E\u0648\u0644\u0627\u0631\u06CC\u0632\u0627\u0633\u06CC\u0648\u0646 \u0628\u0637\u0646\u200C\u0647\u0627 \u0686\u0648\u0646 \u0627\u0632 \u0627\u067E\u06CC\u06A9\u0627\u0631\u062F \u0628\u0647 \u0627\u0646\u062F\u0648\u06A9\u0627\u0631\u062F \u0631\u062E \u0645\u06CC\u200C\u062F\u0647\u062F\u060C \u0645\u0648\u062C\u06CC \u0631\u0648 \u0628\u0647 \u0628\u0627\u0644\u0627 (\u062F\u0631 \u0627\u063A\u0644\u0628 \u0644\u06CC\u062F\u0647\u0627) \u0628\u0647 \u0646\u0627\u0645 T \u0627\u06CC\u062C\u0627\u062F \u0645\u06CC\u200C\u06A9\u0646\u062F \u06A9\u0647 \u067E\u0647\u0646 \u0648 \u0622\u0631\u0627\u0645 \u0627\u0633\u062A.",
      keyPoint: "P = \u062F\u067E\u0648\u0644\u0627\u0631\u06CC\u0632\u0627\u0633\u06CC\u0648\u0646 \u062F\u0647\u0644\u06CC\u0632 | QRS = \u062F\u067E\u0648\u0644\u0627\u0631\u06CC\u0632\u0627\u0633\u06CC\u0648\u0646 \u0628\u0637\u0646 | T = \u0631\u06CC\u067E\u0648\u0644\u0627\u0631\u06CC\u0632\u0627\u0633\u06CC\u0648\u0646 \u0628\u0637\u0646.",
      trap: "\u0631\u06CC\u067E\u0648\u0644\u0627\u0631\u06CC\u0632\u0627\u0633\u06CC\u0648\u0646 \u0628\u0631\u062E\u0644\u0627\u0641 \u062F\u067E\u0648\u0644\u0627\u0631\u06CC\u0632\u0627\u0633\u06CC\u0648\u0646 \u0631\u0648\u0646\u062F \u063A\u06CC\u0631\u0639\u0635\u0628\u06CC \u062F\u0627\u0631\u062F (\u0646\u0627\u0634\u06CC \u0627\u0632 \u06AF\u0631\u0627\u062F\u06CC\u0627\u0646 \u0641\u0634\u0627\u0631 \u0648 \u062F\u0645\u0627)\u061B \u0628\u0647 \u0647\u0645\u06CC\u0646 \u062F\u0644\u06CC\u0644 \u062C\u0647\u062A \u0645\u0648\u062C T \u0628\u0627 \u062C\u0647\u062A QRS \u0647\u0645\u200C\u062C\u0647\u062A \u0627\u0633\u062A.",
      whyWrong: [
        { index: 0, text: "\u062F\u067E\u0648\u0644\u0627\u0631\u06CC\u0632\u0627\u0633\u06CC\u0648\u0646 \u062F\u0647\u0644\u06CC\u0632\u0647\u0627 \u0645\u0648\u062C P \u0627\u0633\u062A." },
        { index: 1, text: "\u062F\u067E\u0648\u0644\u0627\u0631\u06CC\u0632\u0627\u0633\u06CC\u0648\u0646 \u0628\u0637\u0646\u200C\u0647\u0627 \u06A9\u0645\u067E\u0644\u06A9\u0633 QRS \u0627\u0633\u062A." },
        { index: 3, text: "\u0631\u06CC\u067E\u0648\u0644\u0627\u0631\u06CC\u0632\u0627\u0633\u06CC\u0648\u0646 \u062F\u0647\u0644\u06CC\u0632\u0647\u0627 \u0645\u0648\u062C \u0645\u0633\u062A\u0642\u0644 \u0646\u062F\u0627\u0631\u062F \u0648 \u062F\u0631 QRS \u067E\u0646\u0647\u0627\u0646 \u0627\u0633\u062A." }
      ]
    },
    stats: { solves: 5231, correctPercent: 71, optionPercents: [8, 13, 71, 8], avgTimeSec: 24, difficultyIndex: 0.71 },
    createdAt: "2025-10-21",
    updatedAt: "2026-07-30"
  },
  {
    id: "tb-phy-03",
    track: "medicine",
    subject: "physiology",
    topicPath: ["\u0642\u0644\u0628 \u0648 \u0639\u0631\u0648\u0642", "\u062A\u0646\u0638\u06CC\u0645 \u0641\u0634\u0627\u0631 \u062E\u0648\u0646"],
    type: "concept",
    difficulty: "medium",
    year: 1401,
    source: "official",
    tags: ["\u067E\u0631\u062A\u06A9\u0631\u0627\u0631", "\u0645\u0646\u062A\u062E\u0628"],
    stem: "\u0627\u0641\u0632\u0627\u06CC\u0634 \u0646\u0627\u06AF\u0647\u0627\u0646\u06CC \u0641\u0634\u0627\u0631 \u062E\u0648\u0646 \u0634\u0631\u06CC\u0627\u0646\u06CC\u060C \u0627\u0632 \u0637\u0631\u06CC\u0642 \u0631\u0641\u0644\u06A9\u0633 \u0628\u0627\u0631\u0648\u0631\u062A\u0631\u0628 \u0686\u0647 \u0627\u062B\u0631\u06CC \u0628\u0631 \u0641\u0639\u0627\u0644\u06CC\u062A \u0639\u0635\u0628 \u0648\u0627\u06AF \u0648 \u062A\u0639\u062F\u0627\u062F \u0636\u0631\u0628\u0627\u0646 \u0642\u0644\u0628 \u062F\u0627\u0631\u062F\u061F",
    figure: null,
    options: [
      "\u0627\u0641\u0632\u0627\u06CC\u0634 \u0641\u0639\u0627\u0644\u06CC\u062A \u0648\u0627\u06AF \u0648 \u0628\u0631\u0627\u062F\u06CC\u200C\u06A9\u0627\u0631\u062F\u06CC",
      "\u06A9\u0627\u0647\u0634 \u0641\u0639\u0627\u0644\u06CC\u062A \u0648\u0627\u06AF \u0648 \u062A\u0627\u06A9\u06CC\u200C\u06A9\u0627\u0631\u062F\u06CC",
      "\u0627\u0641\u0632\u0627\u06CC\u0634 \u0641\u0639\u0627\u0644\u06CC\u062A \u0648\u0627\u06AF \u0648 \u062A\u0627\u06A9\u06CC\u200C\u06A9\u0627\u0631\u062F\u06CC",
      "\u0628\u062F\u0648\u0646 \u0627\u062B\u0631 \u0628\u0631 \u0641\u0639\u0627\u0644\u06CC\u062A \u0648\u0627\u06AF\u061B \u0641\u0642\u0637 \u0627\u0641\u0632\u0627\u06CC\u0634 \u0645\u0642\u0627\u0648\u0645\u062A \u0645\u062D\u06CC\u0637\u06CC"
    ],
    correctAnswer: 0,
    explanation: {
      summary: "\u0627\u0633\u062A\u0631\u0686 \u0628\u0627\u0631\u0648\u0631\u062A\u0631\u0647\u0627 \u2192 \u0627\u0641\u0632\u0627\u06CC\u0634 \u0622\u062A\u0634 \u0639\u0635\u0628 \u0622\u0648\u0631\u0627\u0646 \u2192 \u062A\u062D\u0631\u06CC\u06A9 \u0647\u0633\u062A\u0647\u0654 \u0645\u0628\u0647\u0645 (\u0648\u0627\u06AF) \u0648 \u0645\u0647\u0627\u0631 \u0645\u0631\u06A9\u0632 \u0633\u0645\u067E\u0627\u062A\u06CC\u06A9 \u2192 \u0628\u0631\u0627\u062F\u06CC\u200C\u06A9\u0627\u0631\u062F\u06CC \u0648 \u06A9\u0627\u0647\u0634 \u0641\u0634\u0627\u0631.",
      deep: "\u0628\u0627\u0631\u0648\u0631\u062A\u0631\u0647\u0627\u06CC \u06A9\u0627\u0631\u0648\u062A\u06CC\u062F \u0648 \u0622\u0626\u0648\u0631\u062A\u06CC\u06A9 \u0628\u0627 \u0627\u0641\u0632\u0627\u06CC\u0634 \u0641\u0634\u0627\u0631 \u0628\u06CC\u0634\u062A\u0631 \u0627\u0633\u062A\u0631\u0686 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F \u0648 \u0622\u062A\u0634 \u0633\u0631\u06CC\u0639\u200C\u062A\u0631\u06CC \u0628\u0647 CNS \u0645\u06CC\u200C\u0641\u0631\u0633\u062A\u0646\u062F. \u0627\u06CC\u0646 \u0633\u06CC\u06AF\u0646\u0627\u0644 \u0647\u0645 \u0647\u0633\u062A\u0647\u0654 \u0648\u0627\u06AF \u0631\u0627 \u062A\u062D\u0631\u06CC\u06A9 \u0645\u06CC\u200C\u06A9\u0646\u062F (\u0627\u0641\u0632\u0627\u06CC\u0634 \u067E\u0627\u0631\u0627\u0633\u0645\u067E\u0627\u062A\u06CC\u06A9) \u0648 \u0647\u0645 \u0645\u0631\u06A9\u0632 \u0633\u0645\u067E\u0627\u062A\u06CC\u06A9 \u0642\u0644\u0628\u06CC-\u0639\u0631\u0648\u0642\u06CC \u0631\u0627 \u0645\u0647\u0627\u0631\u061B \u0646\u062A\u06CC\u062C\u0647 \u06A9\u0627\u0647\u0634 HR \u0648 \u0628\u0627\u0632\u062A\u0627\u0628\u06CC\u060C \u0627\u0641\u062A \u0641\u0634\u0627\u0631 \u0628\u0647 \u0633\u0645\u062A \u0646\u0631\u0645\u0627\u0644 \u0627\u0633\u062A. \u0627\u06CC\u0646 \u0628\u0627\u0632\u062A\u0627\u0628 \u062F\u0631 \u067E\u0627\u0633\u062E \u0628\u0647 \u062A\u0632\u0631\u06CC\u0642 \u0633\u0631\u06CC\u0639 \u0622\u062F\u0631\u0646\u0627\u0644\u06CC\u0646/\u0627\u0641\u0632\u0627\u06CC\u0634 \u062D\u062C\u0645 \u0646\u06CC\u0632 \u062F\u06CC\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F.",
      keyPoint: "\u0628\u0627\u0631\u0648\u0631\u062A\u0631\u0631\u0641\u0644\u06A9\u0633 = \u062D\u0633\u0627\u0633\u200C\u062A\u0631\u06CC\u0646 \u0645\u06A9\u0627\u0646\u06CC\u0633\u0645 \u06A9\u0648\u062A\u0627\u0647\u200C\u0645\u062F\u062A \u062A\u0646\u0638\u06CC\u0645 \u0641\u0634\u0627\u0631\u061B \u0627\u0641\u0632\u0627\u06CC\u0634 \u0641\u0634\u0627\u0631 \u2192 \u0628\u0631\u0627\u062F\u06CC\u200C\u06A9\u0627\u0631\u062F\u06CC \u0628\u0627\u0632\u062A\u0627\u0628\u06CC.",
      trap: "\u0622\u062F\u0631\u0646\u0627\u0644\u06CC\u0646 \u062F\u0631 \u062F\u0648\u0632 \u06A9\u0645\u060C \u062F\u0631\u0633\u062A \u067E\u0633 \u0627\u0632 \u062A\u0632\u0631\u06CC\u0642\u060C \u06AF\u0627\u0647\u06CC \u062A\u0627\u06A9\u06CC\u200C\u06A9\u0627\u0631\u062F\u06CC \u0645\u06CC\u200C\u062F\u0647\u062F\u061B \u0627\u0645\u0627 \u062F\u0631 \u067E\u0627\u0633\u062E \u0628\u0647 \u0627\u0641\u0632\u0627\u06CC\u0634 \u0641\u0634\u0627\u0631 \u062A\u0648\u0644\u06CC\u062F\u0634\u062F\u0647\u060C \u0631\u0641\u0644\u06A9\u0633 \u0628\u0627\u0631\u0648\u0631\u062A\u0631\u0628 \u0628\u0631\u0622\u0646 \u063A\u0644\u0628\u0647 \u0645\u06CC\u200C\u06A9\u0646\u062F \u0648 \u0628\u0631\u0627\u062F\u06CC\u200C\u06A9\u0627\u0631\u062F\u06CC \u062F\u06CC\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F (\u0628\u0627\u0632\u062A\u0627\u0628 \u0641\u0634\u0627\u0631\u06CC \u0645\u0639\u06A9\u0648\u0633).",
      whyWrong: [
        { index: 1, text: "\u06A9\u0627\u0647\u0634 \u0641\u0634\u0627\u0631 \u062E\u0648\u0646 (\u0646\u0647 \u0627\u0641\u0632\u0627\u06CC\u0634) \u0645\u0648\u062C\u0628 \u06A9\u0627\u0647\u0634 \u0641\u0639\u0627\u0644\u06CC\u062A \u0648\u0627\u06AF \u0648 \u062A\u0627\u06A9\u06CC\u200C\u06A9\u0627\u0631\u062F\u06CC \u0645\u06CC\u200C\u0634\u0648\u062F." },
        { index: 2, text: "\u0641\u0639\u0627\u0644\u06CC\u062A \u0648\u0627\u06AF \u0648 \u0636\u0631\u0628\u0627\u0646 \u0642\u0644\u0628 \u0647\u0645\u200C\u062C\u0647\u062A \u062A\u063A\u06CC\u06CC\u0631 \u0646\u0645\u06CC\u200C\u06A9\u0646\u0646\u062F\u061B \u0648\u0627\u06AF \u0642\u0644\u0628 \u0631\u0627 \u06A9\u0646\u062F \u0645\u06CC\u200C\u06A9\u0646\u062F." },
        { index: 3, text: "\u0645\u0647\u0627\u0631 \u0633\u0645\u067E\u0627\u062A\u06CC\u06A9 \u0647\u0645\u0631\u0627\u0647 \u0628\u0627 \u0627\u0641\u0632\u0627\u06CC\u0634 \u0641\u0639\u0627\u0644\u06CC\u062A \u0648\u0627\u06AF\u060C \u0645\u0642\u0627\u0648\u0645\u062A \u0645\u062D\u06CC\u0637\u06CC \u0631\u0627 \u06A9\u0627\u0647\u0634 \u0645\u06CC\u200C\u062F\u0647\u062F \u0646\u0647 \u0627\u0641\u0632\u0627\u06CC\u0634." }
      ]
    },
    stats: { solves: 3984, correctPercent: 63, optionPercents: [63, 17, 12, 8], avgTimeSec: 38, difficultyIndex: 0.63 },
    createdAt: "2025-12-08",
    updatedAt: "2026-08-02"
  },
  {
    id: "tb-phy-04",
    track: "medicine",
    subject: "physiology",
    topicPath: ["\u0642\u0644\u0628 \u0648 \u0639\u0631\u0648\u0642", "\u0627\u0644\u06A9\u062A\u0631\u0648\u0641\u06CC\u0632\u06CC\u0648\u0644\u0648\u0698\u06CC \u0642\u0644\u0628"],
    type: "image",
    difficulty: "hard",
    year: 1404,
    source: "tapesh",
    tags: ["\u0645\u0646\u062A\u062E\u0628"],
    stem: "\u062F\u0631 \u0634\u06A9\u0644 \u0645\u0642\u0627\u0628\u0644\u060C \u0646\u0645\u0648\u062F\u0627\u0631 \u067E\u062A\u0627\u0646\u0633\u06CC\u0644 \u0639\u0645\u0644 \u062F\u0648 \u0646\u0648\u0639 \u0633\u0644\u0648\u0644 \u0642\u0644\u0628\u06CC \u0631\u0633\u0645 \u0634\u062F\u0647 \u0627\u0633\u062A. \u0645\u0646\u062D\u0646\u06CC A \u0645\u0631\u0628\u0648\u0637 \u0628\u0647 \u0645\u06CC\u0648\u06A9\u0627\u0631\u062F \u0628\u0637\u0646\u06CC \u0648 \u0645\u0646\u062D\u0646\u06CC B \u0645\u0631\u0628\u0648\u0637 \u0628\u0647 \u0633\u0644\u0648\u0644 \u06AF\u0631\u0647\u06CC SA \u0627\u0633\u062A. \u0641\u0627\u0632 \u0635\u0639\u0648\u062F\u06CC \u0622\u0647\u0633\u062A\u0647\u0654 \u0645\u0646\u062D\u0646\u06CC B \u0646\u0627\u0634\u06CC \u0627\u0632 \u06A9\u062F\u0627\u0645 \u062C\u0631\u06CC\u0627\u0646 \u06CC\u0648\u0646\u06CC \u0627\u0633\u062A\u061F",
    figure: "cardiac-ap",
    options: [
      "\u0648\u0631\u0648\u062F \u0633\u0631\u06CC\u0639 \u0633\u062F\u06CC\u0645 \u0627\u0632 \u06A9\u0627\u0646\u0627\u0644\u200C\u0647\u0627\u06CC Fast Na",
      "\u0648\u0631\u0648\u062F \u06A9\u0644\u0633\u06CC\u0645 \u0627\u0632 \u06A9\u0627\u0646\u0627\u0644\u200C\u0647\u0627\u06CC \u0646\u0648\u0639 L",
      "\u062E\u0631\u0648\u062C \u067E\u062A\u0627\u0633\u06CC\u0645 \u0627\u0632 \u06A9\u0627\u0646\u0627\u0644\u200C\u0647\u0627\u06CC \u062A\u0623\u062E\u06CC\u0631\u06CC",
      "\u0648\u0631\u0648\u062F \u06A9\u0644\u0633\u06CC\u0645 \u0627\u0632 \u06A9\u0627\u0646\u0627\u0644\u200C\u0647\u0627\u06CC \u0646\u0648\u0639 T \u062F\u0631 \u0627\u0628\u062A\u062F\u0627\u06CC \u0641\u0627\u0632 \u0635\u0641\u0631"
    ],
    correctAnswer: 1,
    explanation: {
      summary: "\u0641\u0627\u0632 \u0635\u0641\u0631 \u0633\u0644\u0648\u0644 \u06AF\u0631\u0647\u06CC \u0627\u0632 \u062C\u0631\u06CC\u0627\u0646 \u0622\u0647\u0633\u062A\u0647\u0654 \u06A9\u0644\u0633\u06CC\u0645\u06CC \u06A9\u0627\u0646\u0627\u0644 L-type \u0627\u06CC\u062C\u0627\u062F \u0645\u06CC\u200C\u0634\u0648\u062F\u061B \u0628\u0631\u062E\u0644\u0627\u0641 \u0645\u06CC\u0648\u06A9\u0627\u0631\u062F \u06A9\u0647 \u0648\u0627\u0628\u0633\u062A\u0647 \u0628\u0647 \u0633\u062F\u06CC\u0645 \u0633\u0631\u06CC\u0639 \u0627\u0633\u062A.",
      deep: "\u0633\u0644\u0648\u0644\u200C\u0647\u0627\u06CC \u06AF\u0631\u0647\u06CC \u067E\u062A\u0627\u0646\u0633\u06CC\u0644 \u0627\u0633\u062A\u0631\u0627\u062D\u062A \u067E\u0627\u06CC\u062F\u0627\u0631 \u0646\u062F\u0627\u0631\u0646\u062F \u0648 \u0628\u0627 \u062F\u06CC\u200C\u067E\u0648\u0644\u0627\u0631\u06CC\u0632\u0627\u0633\u06CC\u0648\u0646 \u062E\u0648\u062F\u06A9\u0627\u0631 (\u0641\u0627\u0632 \u06F4 \u0628\u0627 \u062C\u0631\u06CC\u0627\u0646 funny If) \u0628\u0647 \u0622\u0633\u062A\u0627\u0646\u0647\u0654 \u0628\u0627\u0632 \u0634\u062F\u0646 \u06A9\u0627\u0646\u0627\u0644\u200C\u0647\u0627\u06CC T \u0648 \u0633\u067E\u0633 L \u0645\u06CC\u200C\u0631\u0633\u0646\u062F. \u0628\u062E\u0634 \u0627\u0635\u0644\u06CC \u0635\u0639\u0648\u062F\u06CC (\u0641\u0627\u0632 \u0635\u0641\u0631) \u0627\u0632 \u0648\u0631\u0648\u062F Ca\xB2\u207A \u06A9\u0627\u0646\u0627\u0644 L \u0627\u0633\u062A\u061B \u0628\u0647 \u0647\u0645\u06CC\u0646 \u062F\u0644\u06CC\u0644 \u0634\u06CC\u0628 \u0622\u0646 \u06A9\u0645 \u0648 \u0647\u062F\u0627\u06CC\u062A \u0622\u0646 \u0622\u0647\u0633\u062A\u0647 \u0627\u0633\u062A (AP \u0622\u0647\u0633\u062A\u0647).",
      keyPoint: "\u0645\u06CC\u0648\u06A9\u0627\u0631\u062F = \u0641\u0627\u0632 \u0635\u0641\u0631 \u0633\u062F\u06CC\u0645\u06CC \u0633\u0631\u06CC\u0639 | \u06AF\u0631\u0647 = \u0641\u0627\u0632 \u0635\u0641\u0631 \u06A9\u0644\u0633\u06CC\u0645\u06CC \u0622\u0647\u0633\u062A\u0647\u061B \u0628\u0647 \u0647\u0645\u06CC\u0646 \u062F\u0644\u06CC\u0644 \u06AF\u0631\u0647\u200C\u0647\u0627 \u0645\u062D\u0644 \u0628\u0644\u0648\u06A9\u200C\u0647\u0627\u06CC \u0647\u062F\u0627\u06CC\u062A\u06CC\u200C\u0627\u0646\u062F.",
      trap: "\u06A9\u0627\u0646\u0627\u0644\u200C\u0647\u0627\u06CC T \u0641\u0642\u0637 \u067E\u062A\u0627\u0646\u0633\u06CC\u0644 \u0631\u0627 \u062A\u0627 \u0622\u0633\u062A\u0627\u0646\u0647 \u067E\u06CC\u0634 \u0645\u06CC\u200C\u0628\u0631\u0646\u062F\u061B \u0641\u0627\u0632 \u0635\u0641\u0631 \u0627\u0635\u0644\u06CC \u0628\u0627 \u06A9\u0627\u0646\u0627\u0644 L \u0627\u0633\u062A. \u06AF\u0632\u06CC\u0646\u0647\u0654 \u06F4 \u0628\u062E\u0634\u06CC \u0627\u0632 \u0645\u0627\u062C\u0631\u0627 \u0631\u0627 \u062F\u0631\u0633\u062A \u06AF\u0641\u062A\u0647 \u0648\u0644\u06CC \u0639\u0627\u0645\u0644 \u0641\u0627\u0632 \u0635\u0641\u0631 \u0646\u06CC\u0633\u062A.",
      whyWrong: [
        { index: 0, text: "\u062C\u0631\u06CC\u0627\u0646 \u0633\u0631\u06CC\u0639 \u0633\u062F\u06CC\u0645 \u0639\u0627\u0645\u0644 \u0641\u0627\u0632 \u0635\u0641\u0631 \u0645\u0646\u062D\u0646\u06CC A (\u0645\u06CC\u0648\u06A9\u0627\u0631\u062F) \u0627\u0633\u062A." },
        { index: 2, text: "\u062E\u0631\u0648\u062C \u067E\u062A\u0627\u0633\u06CC\u0645 \u0639\u0627\u0645\u0644 \u0631\u06CC\u067E\u0648\u0644\u0627\u0631\u06CC\u0632\u0627\u0633\u06CC\u0648\u0646 (\u0641\u0627\u0632 \u06F3) \u0627\u0633\u062A." },
        { index: 3, text: "\u06A9\u0627\u0646\u0627\u0644 T \u0628\u0631\u0627\u06CC \u0631\u0633\u06CC\u062F\u0646 \u0628\u0647 \u0622\u0633\u062A\u0627\u0646\u0647 \u0646\u0642\u0634 \u062F\u0627\u0631\u062F\u061B \u0641\u0627\u0632 \u0635\u0641\u0631 \u0627\u0635\u0644\u06CC \u0631\u0627 \u062C\u0631\u06CC\u0627\u0646 \u06A9\u0627\u0646\u0627\u0644 L \u0645\u06CC\u200C\u0633\u0627\u0632\u062F." }
      ]
    },
    stats: { solves: 2412, correctPercent: 54, optionPercents: [21, 54, 10, 15], avgTimeSec: 47, difficultyIndex: 0.54 },
    createdAt: "2026-02-11",
    updatedAt: "2026-08-25"
  },
  {
    id: "tb-phy-05",
    track: "medicine",
    subject: "physiology",
    topicPath: ["\u062A\u0646\u0641\u0633", "\u062D\u062C\u0645\u200C\u0647\u0627 \u0648 \u0638\u0631\u0641\u06CC\u062A\u200C\u0647\u0627\u06CC \u0631\u06CC\u0648\u06CC"],
    type: "calculation",
    difficulty: "easy",
    year: 1398,
    source: "official",
    tags: [],
    stem: "\u062F\u0631 \u06CC\u06A9 \u0641\u0631\u062F \u0633\u0627\u0644\u0645\u060C \u062D\u062C\u0645 \u062C\u0627\u0631\u06CC (TV) \u0628\u0631\u0627\u0628\u0631 \u06F5\u06F0\u06F0 \u0645\u06CC\u0644\u06CC\u200C\u0644\u06CC\u062A\u0631\u060C \u062D\u062C\u0645 \u0630\u062E\u06CC\u0631\u0647\u0654 \u062F\u0645\u06CC (IRV) \u0628\u0631\u0627\u0628\u0631 \u06F3\u06F0\u06F0\u06F0 \u0645\u06CC\u0644\u06CC\u200C\u0644\u06CC\u062A\u0631 \u0648 \u062D\u062C\u0645 \u0630\u062E\u06CC\u0631\u0647\u0654 \u0628\u0627\u0632\u062F\u0645\u06CC (ERV) \u0628\u0631\u0627\u0628\u0631 \u06F1\u06F1\u06F0\u06F0 \u0645\u06CC\u0644\u06CC\u200C\u0644\u06CC\u062A\u0631 \u0627\u0633\u062A. \u062D\u062C\u0645 \u0627\u0646\u0642\u0636\u0627\u06CC \u0648\u0627\u062C\u0628 (VC) \u0686\u0642\u062F\u0631 \u0627\u0633\u062A\u061F",
    figure: null,
    options: ["\u06F4\u06F1\u06F0\u06F0 \u0645\u06CC\u0644\u06CC\u200C\u0644\u06CC\u062A\u0631", "\u06F4\u06F6\u06F0\u06F0 \u0645\u06CC\u0644\u06CC\u200C\u0644\u06CC\u062A\u0631", "\u06F5\u06F2\u06F0\u06F0 \u0645\u06CC\u0644\u06CC\u200C\u0644\u06CC\u062A\u0631", "\u06F5\u06F7\u06F0\u06F0 \u0645\u06CC\u0644\u06CC\u200C\u0644\u06CC\u062A\u0631"],
    correctAnswer: 1,
    explanation: {
      summary: "VC = TV + IRV + ERV = \u06F5\u06F0\u06F0 + \u06F3\u06F0\u06F0\u06F0 + \u06F1\u06F1\u06F0\u06F0 = \u06F4\u06F6\u06F0\u06F0 \u0645\u06CC\u0644\u06CC\u200C\u0644\u06CC\u062A\u0631.",
      deep: "\u0638\u0631\u0641\u06CC\u062A \u062D\u06CC\u0627\u062A\u06CC \u0645\u062C\u0645\u0648\u0639 \u062D\u062C\u0645\u200C\u0647\u0627\u06CC\u06CC \u0627\u0633\u062A \u06A9\u0647 \u0628\u0627 \u0628\u06CC\u0634\u062A\u0631\u06CC\u0646 \u062F\u0645 \u0648 \u0628\u0627\u0632\u062F\u0645 \u062C\u0627\u0628\u0647\u200C\u062C\u0627 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F\u061B RV \u062F\u0631 \u0622\u0646 \u0645\u0634\u0627\u0631\u06A9\u062A \u0646\u062F\u0627\u0631\u062F. TLC = VC + RV \u0627\u0633\u062A\u060C \u067E\u0633 \u0627\u06AF\u0631 \u0633\u0624\u0627\u0644 TLC \u0628\u0648\u062F \u0628\u0627\u06CC\u062F RV \u0647\u0645 \u062F\u0627\u062F\u0647 \u0645\u06CC\u200C\u0634\u062F.",
      keyPoint: "VC = TV + IRV + ERV\u061B \u0647\u0631 \u0633\u0647 \u0638\u0631\u0641\u06CC\u062A \u062C\u0645\u0639 \u062D\u062C\u0645\u200C\u0647\u0627\u06CC\u0646\u062F (\u0628\u062F\u0648\u0646 RV).",
      trap: "\u06F4\u06F1\u06F0\u06F0 \u062D\u0627\u0635\u0644 IRV + ERV \u0627\u0633\u062A (\u0628\u062F\u0648\u0646 TV) \u2014 \u062F\u0627\u0645 \u0631\u0627\u06CC\u062C \u062C\u0645\u0639\u200C\u0646\u06A9\u0631\u062F\u0646 \u062D\u062C\u0645 \u062C\u0627\u0631\u06CC.",
      whyWrong: [
        { index: 0, text: "\u0627\u06CC\u0646 IRV + ERV \u0627\u0633\u062A\u061B \u062D\u062C\u0645 \u062C\u0627\u0631\u06CC \u062C\u0645\u0639 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A." },
        { index: 2, text: "\u062C\u0645\u0639 \u0635\u062D\u06CC\u062D \u0645\u0624\u0644\u0641\u0647\u200C\u0647\u0627\u06CC \u062F\u0627\u062F\u0647\u200C\u0634\u062F\u0647 \u06F4\u06F6\u06F0\u06F0 \u0627\u0633\u062A\u061B \u0627\u06CC\u0646 \u0639\u062F\u062F \u0628\u0627 \u062C\u0645\u0639 \u0627\u0636\u0627\u0641\u06CC \u0628\u0647 \u062F\u0633\u062A \u0645\u06CC\u200C\u0622\u06CC\u062F." },
        { index: 3, text: "\u0627\u06CC\u0646 \u0639\u062F\u062F \u0628\u0627 \u0641\u0631\u0636 IRV \u0628\u0632\u0631\u06AF\u200C\u062A\u0631 \u0627\u0632 \u0645\u0642\u062F\u0627\u0631 \u062F\u0627\u062F\u0647\u200C\u0634\u062F\u0647 \u0628\u0647 \u062F\u0633\u062A \u0645\u06CC\u200C\u0622\u06CC\u062F." }
      ]
    },
    stats: { solves: 4890, correctPercent: 82, optionPercents: [11, 82, 4, 3], avgTimeSec: 31, difficultyIndex: 0.82 },
    createdAt: "2025-09-14",
    updatedAt: "2026-06-28"
  },
  {
    id: "tb-phy-06",
    track: "medicine",
    subject: "physiology",
    topicPath: ["\u062A\u0646\u0641\u0633", "\u0627\u0646\u062A\u0642\u0627\u0644 \u06AF\u0627\u0632\u0647\u0627"],
    type: "image",
    difficulty: "hard",
    year: 1402,
    source: "official",
    tags: ["\u067E\u0631\u062A\u06A9\u0631\u0627\u0631", "\u0645\u0646\u062A\u062E\u0628"],
    stem: "\u062F\u0631 \u0634\u06A9\u0644\u060C \u0645\u0646\u062D\u0646\u06CC \u062A\u0641\u06A9\u06CC\u06A9 \u0627\u06A9\u0633\u06CC\u200C\u0647\u0645\u0648\u06AF\u0644\u0648\u0628\u06CC\u0646 \u0641\u0631\u062F \u0633\u0627\u0644\u0645 (\u062E\u0637 \u0645\u0645\u062A\u062F) \u0648 \u0641\u0631\u062F\u06CC \u0628\u0627 \u0627\u0641\u0632\u0627\u06CC\u0634 \u062F\u0645\u0627\u06CC \u0628\u062F\u0646 (\u062E\u0637\u200C\u0686\u06CC\u0646) \u0631\u0633\u0645 \u0634\u062F\u0647 \u0627\u0633\u062A. \u062C\u0627\u0628\u0647\u200C\u062C\u0627\u06CC\u06CC \u0645\u0646\u062D\u0646\u06CC \u0628\u0647 \u0631\u0627\u0633\u062A \u0686\u0647 \u067E\u06CC\u0627\u0645\u062F\u06CC \u062F\u0627\u0631\u062F\u061F",
    figure: "o2-curve",
    options: [
      "\u0627\u0641\u0632\u0627\u06CC\u0634 P50 \u0648 \u0633\u0647\u0648\u0644\u062A \u0622\u0632\u0627\u062F\u0633\u0627\u0632\u06CC O\u2082 \u062F\u0631 \u0628\u0627\u0641\u062A\u200C\u0647\u0627",
      "\u06A9\u0627\u0647\u0634 P50 \u0648 \u0627\u0641\u0632\u0627\u06CC\u0634 \u062A\u0645\u0627\u06CC\u0644 Hb \u0628\u0647 \u0627\u06A9\u0633\u06CC\u0698\u0646",
      "\u06A9\u0627\u0647\u0634 \u0638\u0631\u0641\u06CC\u062A \u062D\u0645\u0644 O\u2082 \u0628\u062F\u0648\u0646 \u062A\u063A\u06CC\u06CC\u0631 P50",
      "\u0627\u0641\u0632\u0627\u06CC\u0634 \u0645\u06CC\u0632\u0627\u0646 \u062A\u0631\u06A9\u06CC\u0628 O\u2082 \u0628\u0627 Hb \u062F\u0631 \u0631\u06CC\u0647"
    ],
    correctAnswer: 0,
    explanation: {
      summary: "\u0627\u0646\u062A\u0642\u0627\u0644 \u0628\u0647 \u0631\u0627\u0633\u062A (CO\u2082\u2191\u060C H\u207A\u2191\u060C \u062F\u0645\u0627\u2191\u060C BPG\u2191) \u06CC\u0639\u0646\u06CC \u06A9\u0627\u0647\u0634 \u062A\u0645\u0627\u06CC\u0644 Hb \u0628\u0647 \u0627\u06A9\u0633\u06CC\u0698\u0646\u061B P50 \u0628\u0627\u0644\u0627 \u0645\u06CC\u200C\u0631\u0648\u062F \u0648 \u062A\u062E\u0644\u06CC\u0647\u0654 O\u2082 \u062F\u0631 \u0628\u0627\u0641\u062A \u0622\u0633\u0627\u0646\u200C\u062A\u0631 \u0645\u06CC\u200C\u0634\u0648\u062F.",
      deep: "\u0627\u0641\u0632\u0627\u06CC\u0634 \u062F\u0645\u0627 \u0633\u0627\u062E\u062A\u0627\u0631 Hb \u0631\u0627 \u062A\u063A\u06CC\u06CC\u0631 \u0645\u06CC\u200C\u062F\u0647\u062F \u0648 \u067E\u06CC\u0648\u0646\u062F \u0622\u0646 \u0628\u0627 O\u2082 \u0631\u0627 \u0633\u0633\u062A \u0645\u06CC\u200C\u06A9\u0646\u062F\u061B \u062F\u0631 \u0648\u0631\u06CC\u062F\u0647\u0627\u06CC \u0641\u0639\u0627\u0644 (\u06AF\u0631\u0645 \u0648 \u0627\u0633\u06CC\u062F\u06CC\u200C\u062A\u0631) \u0647\u0645\u06CC\u0646 \u0648\u06CC\u0698\u06AF\u06CC \u062A\u062E\u0644\u06CC\u0647\u0654 \u0627\u06A9\u0633\u06CC\u0698\u0646 \u0631\u0627 \u062A\u0633\u0647\u06CC\u0644 \u0645\u06CC\u200C\u06A9\u0646\u062F. P50 \u0641\u0634\u0627\u0631 \u062C\u0632\u0626\u06CC O\u2082\u06CC \u0627\u0633\u062A \u06A9\u0647 \u062F\u0631 \u0622\u0646 \u06F5\u06F0\u066A \u0627\u0632 \u0633\u0627\u06CC\u062A\u200C\u0647\u0627 \u0627\u0634\u063A\u0627\u0644 \u0634\u062F\u0647\u200C\u0627\u0646\u062F\u061B \u062F\u0631 \u0627\u0646\u062A\u0642\u0627\u0644 \u0628\u0647 \u0631\u0627\u0633\u062A \u0628\u0631\u0627\u06CC \u0647\u0645\u06CC\u0646 \u0627\u0634\u063A\u0627\u0644\u060C \u0641\u0634\u0627\u0631 \u0628\u06CC\u0634\u062A\u0631\u06CC \u0644\u0627\u0632\u0645 \u0627\u0633\u062A.",
      keyPoint: "\xAB\u0627\u0646\u062A\u0642\u0627\u0644 \u0628\u0647 \u0631\u0627\u0633\u062A = \u0622\u0632\u0627\u062F\u0633\u0627\u0632\u06CC \u0628\u06CC\u0634\u062A\u0631\xBB (P50\u2191)\u061B \u0627\u0646\u062A\u0642\u0627\u0644 \u0628\u0647 \u0686\u067E = \u062A\u0645\u0627\u06CC\u0644 \u0628\u06CC\u0634\u062A\u0631\u060C \u062A\u062E\u0644\u06CC\u0647\u0654 \u0633\u062E\u062A\u200C\u062A\u0631.",
      trap: "\u0638\u0631\u0641\u06CC\u062A \u062D\u0645\u0644 (\u06F1\u06F0\u06F0\u066A \u0627\u0634\u063A\u0627\u0644 \u062F\u0631 \u0641\u0634\u0627\u0631 \u0628\u0627\u0644\u0627) \u062A\u0642\u0631\u06CC\u0628\u0627\u064B \u062B\u0627\u0628\u062A \u0645\u06CC\u200C\u0645\u0627\u0646\u062F\u061B \u0622\u0646\u0686\u0647 \u0639\u0648\u0636 \u0645\u06CC\u200C\u0634\u0648\u062F \xAB\u062A\u0645\u0627\u06CC\u0644\xBB \u0627\u0633\u062A \u0646\u0647 \xAB\u0638\u0631\u0641\u06CC\u062A\xBB.",
      whyWrong: [
        { index: 1, text: "\u0627\u06CC\u0646 \u0648\u06CC\u0698\u06AF\u06CC \u0627\u0646\u062A\u0642\u0627\u0644 \u0628\u0647 \u0686\u067E \u0627\u0633\u062A." },
        { index: 2, text: "P50 \u062A\u063A\u06CC\u06CC\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F \u0648 \u0638\u0631\u0641\u06CC\u062A \u062D\u0645\u0644 \u062A\u0642\u0631\u06CC\u0628\u0627\u064B \u062B\u0627\u0628\u062A \u0627\u0633\u062A." },
        { index: 3, text: "\u062F\u0631 \u0631\u06CC\u0647 \u0627\u0634\u0628\u0627\u0639 \u062A\u0642\u0631\u06CC\u0628\u0627\u064B \u06A9\u0627\u0645\u0644 \u0628\u0627\u0642\u06CC \u0645\u06CC\u200C\u0645\u0627\u0646\u062F\u061B \u0627\u062B\u0631 \u0627\u0635\u0644\u06CC \u062F\u0631 \u0628\u0627\u0641\u062A\u200C\u0647\u0627 \u062F\u06CC\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F." }
      ]
    },
    stats: { solves: 3127, correctPercent: 58, optionPercents: [58, 20, 9, 13], avgTimeSec: 45, difficultyIndex: 0.58 },
    createdAt: "2026-01-09",
    updatedAt: "2026-08-11"
  },
  {
    id: "tb-phy-07",
    track: "medicine",
    subject: "physiology",
    topicPath: ["\u06A9\u0644\u06CC\u0647", "\u0641\u06CC\u0632\u06CC\u0648\u0644\u0648\u0698\u06CC \u0644\u0648\u0644\u0647\u200C\u0647\u0627\u06CC \u0646\u0641\u0631\u0648\u0646"],
    type: "concept",
    difficulty: "hard",
    year: 1403,
    source: "official",
    tags: ["\u067E\u0631\u062A\u06A9\u0631\u0627\u0631"],
    stem: "\u0642\u0633\u0645\u062A \u0635\u0639\u0648\u062F\u06CC \u0636\u062E\u06CC\u0645 \u062D\u0644\u0642\u0647\u0654 \u0647\u0646\u0644\u0647 (TAL) \u0628\u0627 \u0628\u0627\u0632\u062C\u0630\u0628 \u0641\u0639\u0627\u0644 NaK-2Cl\u060C \u062E\u0645\u06CC\u0631\u0627\u06CC \u063A\u0644\u0627\u0641\u06CC \u0645\u06CC\u0633\u0627\u0632\u062F. \u0627\u062B\u0631 \u062F\u06CC\u0648\u0631\u062A\u06CC\u06A9 \u0644\u0648\u067E (\u0641\u0648\u0631\u0648\u0632\u0645\u0627\u06CC\u062F) \u0631\u0648\u06CC \u0627\u06CC\u0646 \u0642\u0637\u0639\u0647 \u06A9\u062F\u0627\u0645 \u067E\u0627\u0631\u0627\u0645\u062A\u0631 \u0631\u0627 \u0628\u06CC\u0634\u062A\u0631\u06CC\u0646 \u062A\u063A\u06CC\u06CC\u0631 \u0645\u06CC\u200C\u062F\u0647\u062F\u061F",
    figure: null,
    options: [
      "\u0627\u0641\u0632\u0627\u06CC\u0634 \u0628\u0627\u0632\u062C\u0630\u0628 \u0622\u0628 \u062F\u0631 TAL",
      "\u0627\u0632 \u0628\u06CC\u0646 \u0631\u0641\u062A\u0646 \u06AF\u0631\u0627\u062F\u06CC\u0627\u0646 \u0627\u0648\u0632\u0645\u0648\u062A\u06CC\u06A9 \u062E\u0645\u06CC\u0631\u0627\u06CC \u063A\u0644\u0627\u0641\u06CC \u0648 \u0627\u0641\u0632\u0627\u06CC\u0634 \u062F\u0641\u0639 Na\u207A",
      "\u0627\u0641\u0632\u0627\u06CC\u0634 \u0628\u0627\u0632\u062C\u0630\u0628 \u06A9\u0644\u0633\u06CC\u0645 \u062F\u0631 \u0644\u0648\u0644\u0647\u0654 \u062F\u06CC\u0633\u062A\u0627\u0644",
      "\u06A9\u0627\u0647\u0634 \u062D\u062C\u0645 \u0627\u062F\u0631\u0627\u0631 \u0628\u0647 \u062F\u0644\u06CC\u0644 \u0628\u0627\u0632\u062C\u0630\u0628 \u062C\u0628\u0631\u0627\u0646\u06CC \u0622\u0628"
    ],
    correctAnswer: 1,
    explanation: {
      summary: "\u0641\u0648\u0631\u0648\u0632\u0645\u0627\u06CC\u062F \u06A9\u0627\u0646\u062A\u0631\u0627\u0633\u067E\u0648\u0631\u062A Na-K-2Cl \u0631\u0627 \u062F\u0631 TAL \u0645\u0633\u062F\u0648\u062F \u0645\u06CC\u200C\u06A9\u0646\u062F\u061B \u06AF\u0631\u0627\u062F\u06CC\u0627\u0646 \u0627\u0648\u0632\u0645\u0648\u062A\u06CC\u06A9 \u062E\u0645\u06CC\u0631\u0627\u06CC \u06A9\u0644\u06CC\u0647 (\u0645\u062F\u0648\u0644\u0627) \u0641\u0631\u0648 \u0645\u06CC\u200C\u0631\u06CC\u0632\u062F \u0648 \u062F\u0641\u0639 \u0622\u0628 \u0648 \u0646\u0645\u06A9 \u0628\u0647\u200C\u0634\u062F\u062A \u0627\u0641\u0632\u0627\u06CC\u0634 \u0645\u06CC\u200C\u06CC\u0627\u0628\u062F.",
      deep: "TAL \u0628\u0647 \u0622\u0628 \u0646\u0641\u0631\u0648\u067E\u0630\u06CC\u0631 \u0646\u06CC\u0633\u062A\u061B \u0628\u0627\u0632\u062C\u0630\u0628 \u0646\u0645\u06A9 \u0622\u0646 \u0628\u062F\u0648\u0646 \u0622\u0628\u060C \u06AF\u0631\u0627\u062F\u06CC\u0627\u0646 \u0627\u0648\u0632\u0645\u0648\u062A\u06CC\u06A9 \u0645\u062F\u0648\u0644\u0627 \u0631\u0627 \u0645\u06CC\u200C\u0633\u0627\u0632\u062F. \u0628\u0627 \u0645\u0647\u0627\u0631 \u0627\u06CC\u0646 \u0627\u0646\u062A\u0642\u0627\u0644\u060C \u0647\u0645 Na\u207A \u062F\u0641\u0639 \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u0647\u0645 \u06AF\u0631\u0627\u062F\u06CC\u0627\u0646 \u0645\u062F\u0648\u0644\u0627\u06CC\u06CC \u0641\u0631\u0648 \u0645\u06CC\u200C\u0631\u06CC\u0632\u062F\u061B \u0646\u062A\u06CC\u062C\u0647 \u0627\u062F\u0631\u0627\u0631 \u0631\u0642\u06CC\u0642 \u0648 \u0641\u0631\u0627\u0648\u0627\u0646 \u0627\u0633\u062A (\u062D\u062A\u06CC \u062F\u0631 \u062D\u0636\u0648\u0631 ADH). \u062F\u0631 \u0639\u0648\u0636 \u062F\u0641\u0639 Ca\xB2\u207A \u0647\u0645 \u0632\u06CC\u0627\u062F \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u0647\u06CC\u067E\u0648\u06A9\u0644\u0633\u0645\u06CC \u0645\u0648\u0642\u062A \u0645\u0645\u06A9\u0646 \u0627\u0633\u062A.",
      keyPoint: "\u0641\u0648\u0631\u0648\u0632\u0645\u0627\u06CC\u062F = \u0642\u0648\u06CC\u200C\u062A\u0631\u06CC\u0646 \u062F\u06CC\u0648\u0631\u062A\u06CC\u06A9\u061B \u0627\u062F\u0631\u0627\u0631 \u0628\u06CC\u0634\u06CC\u0646\u0647 \u0628\u0627 \u06A9\u0627\u0644\u0633\u06CC\u0648\u0631\u06CC \u06A9\u0648\u062A\u0627\u0647\u200C\u0645\u062F\u062A (\u0647\u06CC\u067E\u0648\u06A9\u0644\u0633\u0645\u06CC).",
      trap: '\u0686\u0648\u0646 TAL \u0628\u0647 \u0622\u0628 \u0646\u0641\u0648\u0630\u067E\u0630\u06CC\u0631 \u0646\u06CC\u0633\u062A\u060C "\u0627\u0641\u0632\u0627\u06CC\u0634 \u0628\u0627\u0632\u062C\u0630\u0628 \u0622\u0628 \u062F\u0631 TAL" \u0641\u06CC\u0632\u06CC\u0648\u0644\u0648\u0698\u06CC\u06A9\u06CC \u0628\u06CC\u200C\u0645\u0639\u0646\u0627\u0633\u062A\u061B \u0627\u06CC\u0646 \u06AF\u0632\u06CC\u0646\u0647 \u0641\u0642\u0637 \u0628\u0631\u0627\u06CC \u06AF\u0645\u0631\u0627\u0647\u06CC \u0646\u0648\u0634\u062A\u0647 \u0634\u062F\u0647.',
      whyWrong: [
        { index: 0, text: "TAL \u0628\u0647 \u0622\u0628 \u0646\u0641\u0648\u0630\u067E\u0630\u06CC\u0631 \u0646\u06CC\u0633\u062A\u061B \u0628\u0627\u0632\u062C\u0630\u0628 \u0622\u0628 \u062F\u0631 \u0622\u0646 \u0627\u062A\u0641\u0627\u0642 \u0646\u0645\u06CC\u200C\u0627\u0641\u062A\u062F." },
        { index: 2, text: "\u0627\u062B\u0631 \u0641\u0648\u0631\u0648\u0632\u0645\u0627\u06CC\u062F \u0628\u0631 Ca\xB2\u207A \u0645\u0639\u06A9\u0648\u0633 \u0627\u06CC\u0646 \u0627\u0633\u062A (\u06A9\u0627\u0647\u0634 \u0628\u0627\u0632\u062C\u0630\u0628 \u063A\u06CC\u0631\u0641\u0639\u0627\u0644 \u062E\u0627\u0644\u0635 \u0628\u0647 \u062F\u0644\u06CC\u0644 \u062D\u062C\u0645 \u06A9\u0645)." },
        { index: 3, text: "\u0627\u062B\u0631 \u062F\u0627\u0631\u0648 \u062F\u0642\u06CC\u0642\u0627\u064B \u0628\u0631\u0639\u06A9\u0633 \u0627\u0633\u062A\u061B \u062D\u062C\u0645 \u0627\u062F\u0631\u0627\u0631 \u0627\u0641\u0632\u0627\u06CC\u0634 \u0645\u06CC\u200C\u06CC\u0627\u0628\u062F." }
      ]
    },
    stats: { solves: 2948, correctPercent: 61, optionPercents: [7, 61, 12, 20], avgTimeSec: 43, difficultyIndex: 0.61 },
    createdAt: "2026-03-04",
    updatedAt: "2026-08-29"
  },
  {
    id: "tb-phy-08",
    track: "medicine",
    subject: "physiology",
    topicPath: ["\u06A9\u0644\u06CC\u0647", "\u062A\u0639\u0627\u062F\u0644 \u0627\u0633\u06CC\u062F-\u0628\u0627\u0632"],
    type: "clinical",
    difficulty: "hard",
    year: 1404,
    source: "official",
    tags: [],
    stem: "\u0632\u0646 \u06F2\u06F8 \u0633\u0627\u0644\u0647\u200C\u0627\u06CC \u0628\u0627 \u0633\u0627\u0628\u0642\u0647\u0654 \u0627\u0633\u062A\u0641\u0631\u0627\u063A \u0645\u06A9\u0631\u0631 \u0645\u0631\u0627\u062C\u0639\u0647 \u06A9\u0631\u062F\u0647 \u0627\u0633\u062A. \u06AF\u0627\u0632 \u062E\u0648\u0646: pH = \u06F7\u066B\u06F5\u06F0\u060C PaCO\u2082 = \u06F4\u06F5 mmHg\u060C HCO\u2083\u207B = \u06F3\u06F4 mEq/L. \u06A9\u062F\u0627\u0645 \u062A\u0641\u0633\u06CC\u0631 \u0635\u062D\u06CC\u062D \u0627\u0633\u062A\u061F",
    figure: null,
    options: [
      "\u0622\u0644\u06A9\u0627\u0644\u0648\u0632 \u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u06A9 \u0628\u0627 \u062C\u0628\u0631\u0627\u0646 \u062A\u0646\u0641\u0633\u06CC \u0646\u0627\u06A9\u0627\u0641\u06CC",
      "\u0622\u0644\u06A9\u0627\u0644\u0648\u0632 \u062A\u0646\u0641\u0633\u06CC \u0628\u0627 \u062C\u0628\u0631\u0627\u0646 \u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u06A9",
      "\u0627\u0633\u06CC\u062F\u0648\u0632 \u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u06A9 \u0628\u0627 \u062C\u0628\u0631\u0627\u0646 \u062A\u0646\u0641\u0633\u06CC",
      "\u0622\u0644\u06A9\u0627\u0644\u0648\u0632 \u0645\u062E\u0644\u0648\u0637 \u062A\u0646\u0641\u0633\u06CC-\u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u06A9"
    ],
    correctAnswer: 0,
    explanation: {
      summary: "pH \u0628\u0627\u0644\u0627 + HCO\u2083 \u0628\u0627\u0644\u0627 = \u0622\u0644\u06A9\u0627\u0644\u0648\u0632 \u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u06A9\u061B \u0627\u0641\u0632\u0627\u06CC\u0634 PaCO\u2082 \u062C\u0628\u0631\u0627\u0646 \u0647\u06CC\u067E\u0648\u0648\u0646\u062A\u06CC\u0644\u0627\u0633\u06CC\u0648\u0646 \u0627\u0633\u062A \u0627\u0645\u0627 \u06A9\u0645\u062A\u0631 \u0627\u0632 \u062D\u062F \u067E\u06CC\u0634\u200C\u0628\u06CC\u0646\u06CC\u200C\u0634\u062F\u0647.",
      deep: "\u0627\u0633\u062A\u0641\u0631\u0627\u063A\u060C \u0627\u0633\u06CC\u062F \u0645\u0639\u062F\u0647 \u0631\u0627 \u0627\u0632 \u0628\u062F\u0646 \u062E\u0627\u0631\u062C \u0645\u06CC\u200C\u06A9\u0646\u062F \u0648 \u0622\u0644\u06A9\u0627\u0644\u0648\u0632 \u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u06A9 \u0645\u06CC\u200C\u0633\u0627\u0632\u062F. \u062C\u0628\u0631\u0627\u0646 \u062A\u0646\u0641\u0633\u06CC (\u0647\u06CC\u067E\u0648\u0648\u0646\u062A\u06CC\u0644\u0627\u0633\u06CC\u0648\u0646) \u0627\u0646\u062A\u0638\u0627\u0631 \u0645\u06CC\u200C\u0631\u0648\u062F PaCO\u2082 \u0631\u0627 \u0628\u0647 \u062D\u062F\u0648\u062F \u06F4\u06F0 + \u06F0\u066B\u06F7\xD7\u0394HCO\u2083 \u2248 \u06F4\u06F7 mmHg \u0628\u0631\u0633\u0627\u0646\u062F\u061B \u0645\u0642\u062F\u0627\u0631 \u06F4\u06F5 \u06CC\u0639\u0646\u06CC \u062C\u0628\u0631\u0627\u0646 \u0646\u0627\u06A9\u0627\u0641\u06CC \u2014 \u06A9\u0647 \u062F\u0631 \u0627\u0633\u062A\u0641\u0631\u0627\u063A \u0637\u0628\u06CC\u0639\u06CC \u0627\u0633\u062A \u0686\u0648\u0646 \u0647\u06CC\u067E\u0648\u06A9\u0627\u0644\u0645\u06CC \u062E\u0648\u062F \u0647\u06CC\u067E\u0648\u0648\u0646\u062A\u06CC\u0644\u0627\u0633\u06CC\u0648\u0646 \u0631\u0627 \u0645\u062D\u062F\u0648\u062F \u0645\u06CC\u200C\u06A9\u0646\u062F.",
      keyPoint: "\u062F\u0631 \u0622\u0644\u06A9\u0627\u0644\u0648\u0632 \u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u06A9\u060C \u0633\u0642\u0641 \u062C\u0628\u0631\u0627\u0646 \u062A\u0646\u0641\u0633\u06CC \u0645\u062D\u062F\u0648\u062F \u0627\u0633\u062A\u061B PaCO\u2082 \u0628\u0647\u200C\u0646\u062F\u0631\u062A \u0627\u0632 \u06F5\u06F5 mmHg \u0639\u0628\u0648\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F.",
      trap: "\u0627\u0641\u0632\u0627\u06CC\u0634 HCO\u2083 \u0647\u0645\u0631\u0627\u0647 PaCO\u2082 \u0628\u0627\u0644\u0627\u06CC \u0646\u0631\u0645\u0627\u0644\u060C \u0627\u06AF\u0631 \u0628\u06CC\u200C\u062F\u0642\u062A \u0646\u06AF\u0627\u0647 \u0634\u0648\u062F \xAB\u0627\u0633\u06CC\u062F\u0648\u0632 \u062A\u0646\u0641\u0633\u06CC\xBB \u0628\u0647 \u0646\u0638\u0631 \u0645\u06CC\u200C\u0631\u0633\u062F\u061B \u062C\u0647\u062A\u200C\u06AF\u06CC\u0631\u06CC pH \u0627\u0633\u062A \u06A9\u0647 \u062A\u0641\u0633\u06CC\u0631 \u0627\u0635\u0644\u06CC \u0631\u0627 \u062A\u0639\u06CC\u06CC\u0646 \u0645\u06CC\u200C\u06A9\u0646\u062F.",
      whyWrong: [
        { index: 1, text: "\u062F\u0631 \u0622\u0644\u06A9\u0627\u0644\u0648\u0632 \u062A\u0646\u0641\u0633\u06CC HCO\u2083 \u067E\u0627\u06CC\u06CC\u0646 \u0645\u06CC\u200C\u0622\u06CC\u062F\u061B \u0627\u06CC\u0646\u062C\u0627 \u0628\u0627\u0644\u0627\u0633\u062A." },
        { index: 2, text: "\u062C\u0647\u062A pH \u0628\u0627 \u0627\u0633\u06CC\u062F\u0648\u0632 \u062F\u0631 \u062A\u0636\u0627\u062F \u0627\u0633\u062A." },
        { index: 3, text: "\u062F\u0631 \u0645\u062E\u0644\u0648\u0637\u060C pH \u0646\u0631\u0645\u0627\u0644 \u06CC\u0627 \u062F\u0648 \u0627\u062E\u062A\u0644\u0627\u0644 \u0647\u0645\u200C\u062C\u0647\u062A \u0641\u0634\u0627\u0631 \u0645\u06CC\u200C\u0622\u0648\u0631\u062F\u0646\u062F\u061B \u0627\u06CC\u0646\u062C\u0627 pH \u0628\u0627\u0644\u0627 \u0648 \u0631\u0648\u0627\u06CC\u062A \u0648\u0627\u062D\u062F \u0627\u0633\u062A." }
      ]
    },
    stats: { solves: 2035, correctPercent: 49, optionPercents: [49, 15, 14, 22], avgTimeSec: 52, difficultyIndex: 0.49 },
    createdAt: "2026-04-02",
    updatedAt: "2026-09-01"
  },
  {
    id: "tb-phy-09",
    track: "medicine",
    subject: "physiology",
    topicPath: ["\u0639\u0635\u0628", "\u0633\u06CC\u0646\u0627\u067E\u0633 \u0648 \u06AF\u06CC\u0631\u0646\u062F\u0647\u200C\u0647\u0627"],
    type: "concept",
    difficulty: "medium",
    year: 1400,
    source: "comprehensive",
    tags: ["\u067E\u0631\u062A\u06A9\u0631\u0627\u0631"],
    stem: "\u0627\u062B\u0631 \u0645\u0647\u0627\u0631\u06CC \u06AF\u06CC\u0631\u0646\u062F\u0647\u200C\u0647\u0627\u06CC GABA-A \u062F\u0631 \u0633\u06CC\u0646\u0627\u067E\u0633\u200C\u0647\u0627\u06CC CNS \u0639\u0645\u062F\u062A\u0627\u064B \u0627\u0632 \u0686\u0647 \u0633\u0627\u0632\u0648\u06A9\u0627\u0631\u06CC \u0646\u0627\u0634\u06CC \u0645\u06CC\u200C\u0634\u0648\u062F\u061F",
    figure: null,
    options: [
      "\u0641\u0639\u0627\u0644\u200C\u0633\u0627\u0632\u06CC \u06A9\u0627\u0646\u0627\u0644 \u06A9\u0627\u062A\u06CC\u0648\u0646\u06CC \u0648 \u0648\u0631\u0648\u062F Na\u207A",
      "\u0627\u0641\u0632\u0627\u06CC\u0634 \u0647\u062F\u0627\u06CC\u062A \u06A9\u0644\u0631\u06CC \u0648 \u0647\u06CC\u067E\u0631\u067E\u0644\u0627\u0631\u06CC\u0632\u0627\u0633\u06CC\u0648\u0646 \u063A\u0634\u0627",
      "\u06A9\u0627\u0647\u0634 \u0647\u062F\u0627\u06CC\u062A \u067E\u062A\u0627\u0633\u06CC\u0645\u06CC \u063A\u0634\u0627",
      "\u0645\u0647\u0627\u0631 \u0622\u0646\u0632\u06CC\u0645 \u0622\u062F\u0646\u06CC\u0644\u0627\u062A \u0633\u06CC\u06A9\u0644\u0627\u0632 \u062F\u0631 \u0633\u0644\u0648\u0644 \u067E\u0633\u200C\u0633\u06CC\u0646\u0627\u067E\u0633\u06CC"
    ],
    correctAnswer: 1,
    explanation: {
      summary: "GABA-A \u06AF\u06CC\u0631\u0646\u062F\u0647\u0654 \u06CC\u0648\u0646\u0648\u062A\u0631\u0648\u067E\u06CC\u06A9 \u06A9\u0627\u0646\u0627\u0644 Cl\u207B \u0627\u0633\u062A\u061B \u0648\u0631\u0648\u062F \u06A9\u0644\u0631 \u063A\u0634\u0627 \u0631\u0627 \u0647\u06CC\u067E\u0631\u067E\u0644\u0627\u0631\u06CC\u0632\u0647 \u0645\u06CC\u200C\u06A9\u0646\u062F (IPSC \u0633\u0631\u06CC\u0639).",
      deep: "\u06A9\u0627\u0646\u0627\u0644 \u06A9\u0644\u0631\u06CC \u0628\u0646\u0632\u0648\u062F\u06CC\u0627\u0632\u067E\u06CC\u0646-\u062D\u0633\u0627\u0633 GABA-A \u0628\u0627 \u0627\u062A\u0635\u0627\u0644 GABA \u0628\u0627\u0632 \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 Cl\u207B \u0648\u0627\u0631\u062F \u0633\u0644\u0648\u0644 \u0645\u06CC\u200C\u0634\u0648\u062F\u061B \u0686\u0648\u0646 \u067E\u062A\u0627\u0646\u0633\u06CC\u0644 \u062A\u0639\u0627\u062F\u0644 \u06A9\u0644\u0631 \u0646\u0632\u062F\u06CC\u06A9 \u067E\u062A\u0627\u0646\u0633\u06CC\u0644 \u0627\u0633\u062A\u0631\u0627\u062D\u062A \u0627\u0633\u062A\u060C \u063A\u0634\u0627 \u067E\u0627\u06CC\u062F\u0627\u0631 \u06CC\u0627 \u0647\u06CC\u067E\u0631\u067E\u0644\u0627\u0631\u06CC\u0632\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F. \u0627\u06CC\u0646 \u0645\u0647\u0627\u0631 \u0633\u0631\u06CC\u0639 \u0627\u0633\u062A\u061B \u0645\u0647\u0627\u0631 \u0622\u0647\u0633\u062A\u0647 (GABA-B) \u0627\u0632 \u0645\u0633\u06CC\u0631 G-\u067E\u0631\u0648\u062A\u0626\u06CC\u0646 \u0648 \u0627\u0641\u0632\u0627\u06CC\u0634 \u0647\u062F\u0627\u06CC\u062A \u067E\u062A\u0627\u0633\u06CC\u0645\u06CC/\u0645\u0647\u0627\u0631 \u06A9\u0627\u0646\u0627\u0644 \u06A9\u0644\u0633\u06CC\u0645\u06CC \u067E\u06CC\u0634\u200C\u0633\u06CC\u0646\u0627\u067E\u0633\u06CC \u0627\u0633\u062A.",
      keyPoint: "GABA-A = \u06A9\u0627\u0646\u0627\u0644 \u06A9\u0644\u0631\u06CC \u0633\u0631\u06CC\u0639 | GABA-B = \u0645\u062A\u0627\u0628\u0648\u062A\u0631\u0648\u067E\u06CC\u06A9 \u0622\u0647\u0633\u062A\u0647 (K\u207A\u2191).",
      trap: "\u06AF\u0632\u06CC\u0646\u0647\u0654 \u06F4 \u062A\u0648\u0635\u06CC\u0641 GABA-B \u0627\u0633\u062A \u0646\u0647 GABA-A\u061B \u062F\u0627\u0645 \xAB\u0634\u0628\u06CC\u0647 \u0628\u0648\u062F\u0646 \u0648\u0644\u06CC \u0633\u0637\u062D \u0645\u062A\u0641\u0627\u0648\u062A\xBB.",
      whyWrong: [
        { index: 0, text: "\u0648\u0631\u0648\u062F \u06A9\u0627\u062A\u06CC\u0648\u0646\u06CC \u062F\u067E\u0648\u0644\u0627\u0631\u06CC\u0632\u0627\u0633\u06CC\u0648\u0646 \u0648 \u062A\u062D\u0631\u06CC\u06A9 \u0627\u0633\u062A\u061B \u0639\u06A9\u0633 \u0627\u062B\u0631 \u0645\u0647\u0627\u0631\u06CC." },
        { index: 2, text: "\u06A9\u0627\u0647\u0634 K\u207A \u062F\u067E\u0648\u0644\u0627\u0631\u06CC\u0632\u0647 \u0645\u06CC\u200C\u06A9\u0646\u062F\u061B \u0627\u062B\u0631 \u0645\u0647\u0627\u0631\u06CC \u0627\u06CC\u0646\u062C\u0627 \u0627\u0632 Cl\u207B \u0627\u0633\u062A." },
        { index: 3, text: "\u0627\u06CC\u0646 \u0645\u0633\u06CC\u0631 \u0633\u06CC\u06AF\u0646\u0627\u0644\u06CC GABA-B \u0627\u0633\u062A (\u0648 \u063A\u06CC\u0631\u0645\u0633\u062A\u0642\u06CC\u0645)\u060C \u0646\u0647 \u0633\u0627\u0632\u0648\u06A9\u0627\u0631 \u0627\u0635\u0644\u06CC GABA-A." }
      ]
    },
    stats: { solves: 4471, correctPercent: 69, optionPercents: [9, 69, 7, 15], avgTimeSec: 33, difficultyIndex: 0.69 },
    createdAt: "2025-10-30",
    updatedAt: "2026-07-14"
  },
  {
    id: "tb-phy-10",
    track: "medicine",
    subject: "physiology",
    topicPath: ["\u0639\u0635\u0628", "\u0633\u06CC\u0633\u062A\u0645 \u0639\u0635\u0628\u06CC \u062E\u0648\u062F\u06A9\u0627\u0631"],
    type: "memorization",
    difficulty: "easy",
    year: 1398,
    source: "official",
    tags: [],
    stem: "\u0641\u0639\u0627\u0644\u200C\u0633\u0627\u0632\u06CC \u06AF\u06CC\u0631\u0646\u062F\u0647\u200C\u0647\u0627\u06CC \u0628\u062A\u0627-\u06F1 \u0642\u0644\u0628\u06CC\u060C \u06A9\u062F\u0627\u0645 \u0627\u062B\u0631 \u0631\u0627 \u0627\u06CC\u062C\u0627\u062F \u0645\u06CC\u200C\u06A9\u0646\u062F\u061F",
    figure: null,
    options: [
      "\u06A9\u0627\u0647\u0634 \u062A\u0639\u062F\u0627\u062F \u0636\u0631\u0628\u0627\u0646 \u0648 \u0642\u062F\u0631\u062A \u0627\u0646\u0642\u0628\u0627\u0636",
      "\u0627\u0641\u0632\u0627\u06CC\u0634 \u062A\u0639\u062F\u0627\u062F \u0636\u0631\u0628\u0627\u0646 \u0648 \u0642\u062F\u0631\u062A \u0627\u0646\u0642\u0628\u0627\u0636",
      "\u0627\u0641\u0632\u0627\u06CC\u0634 \u062A\u0639\u062F\u0627\u062F \u0636\u0631\u0628\u0627\u0646 \u0628\u0627 \u06A9\u0627\u0647\u0634 \u0642\u062F\u0631\u062A \u0627\u0646\u0642\u0628\u0627\u0636",
      "\u0627\u062A\u0633\u0627\u0639 \u0639\u0631\u0648\u0642 \u06A9\u0631\u0648\u0646\u0631 \u0628\u062F\u0648\u0646 \u0627\u062B\u0631 \u0628\u0631 \u0627\u0646\u0642\u0628\u0627\u0636"
    ],
    correctAnswer: 1,
    explanation: {
      summary: "\u0628\u062A\u0627-\u06F1 \u0628\u0627 Gs \u0648 cAMP\u060C \u0647\u0645 \u06A9\u0631\u0648\u0646\u0648\u062A\u0631\u0648\u067E \u0645\u062B\u0628\u062A \u0627\u0633\u062A \u0647\u0645 \u0627\u06CC\u0646\u0648\u062A\u0631\u0648\u067E \u0645\u062B\u0628\u062A.",
      deep: "\u062A\u062D\u0631\u06CC\u06A9 \u06AF\u06CC\u0631\u0646\u062F\u0647\u0654 \u03B2\u2081 \u0633\u06CC\u0646\u0627\u067E\u0633\u06CC \u0647\u0645\u0627\u0646 \u0633\u06CC\u0633\u062A\u0645 \u062F\u0648\u0645 cAMP-PKA \u0631\u0627 \u0641\u0639\u0627\u0644 \u0645\u06CC\u200C\u06A9\u0646\u062F \u06A9\u0647 \u0628\u0627\u0632 \u0634\u062F\u0646 \u06A9\u0627\u0646\u0627\u0644\u200C\u0647\u0627\u06CC \u06A9\u0644\u0633\u06CC\u0645\u06CC L \u0631\u0627 \u0628\u06CC\u0634\u062A\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F\u061B \u0646\u062A\u06CC\u062C\u0647 \u0627\u0641\u0632\u0627\u06CC\u0634 HR (\u06A9\u0631\u0648\u0646\u0648\u062A\u0631\u0648\u067E+)\u060C \u0642\u062F\u0631\u062A \u0627\u0646\u0642\u0628\u0627\u0636 (\u0627\u06CC\u0646\u0648\u062A\u0631\u0648\u067E+) \u0648 \u0647\u062F\u0627\u06CC\u062A (\u062F\u0631\u0648\u0645\u0627\u062A\u0631\u0648\u067E+) \u0627\u0633\u062A. \u0627\u06CC\u0646 \u067E\u0627\u06CC\u0647\u0654 \u0627\u062B\u0631 \u0628\u062A\u0627-\u0628\u0644\u0648\u06A9\u0631\u0647\u0627 \u062F\u0631 \u06A9\u0627\u0647\u0634 \u0645\u0635\u0631\u0641 \u0627\u06A9\u0633\u06CC\u0698\u0646 \u0642\u0644\u0628 \u0627\u0633\u062A.",
      keyPoint: "\u0642\u0644\u0628: \u03B2\u2081 = \u06A9\u0631\u0648\u0646\u0648\u062A\u0631\u0648\u067E \u0648 \u0627\u06CC\u0646\u0648\u062A\u0631\u0648\u067E \u0645\u062B\u0628\u062A | \u0639\u0631\u0648\u0642: \u03B2\u2082 = \u0627\u062A\u0633\u0627\u0639\u060C \u03B1\u2081 = \u0627\u0646\u0642\u0628\u0627\u0636.",
      trap: "\u0627\u062B\u0631 \u0645\u062A\u0627\u067E\u0648\u0644\u06CC\u06A9 \u03B2\u2082 \u0628\u0631 \u0639\u0631\u0648\u0642 (\u0627\u062A\u0633\u0627\u0639) \u0628\u0627 \u0627\u062B\u0631 \u03B2\u2081 \u0628\u0631 \u0642\u0644\u0628 \u0627\u0634\u062A\u0628\u0627\u0647 \u06AF\u0631\u0641\u062A\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F.",
      whyWrong: [
        { index: 0, text: "\u0627\u06CC\u0646 \u0627\u062B\u0631 \u062A\u062D\u0631\u06CC\u06A9 \u06A9\u0648\u0644\u06CC\u0646\u0631\u0698\u06CC\u06A9 \u0645\u0648\u0633\u06A9\u0627\u0631\u06CC\u0646\u06CC \u0627\u0633\u062A." },
        { index: 2, text: "\u0627\u06CC\u0646 \u062A\u0631\u06A9\u06CC\u0628 \u0646\u0627\u0645\u062A\u0639\u0627\u0631\u0641 \u062F\u0631 \u0641\u06CC\u0632\u06CC\u0648\u0644\u0648\u0698\u06CC \u0642\u0644\u0628\u06CC \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F." },
        { index: 3, text: "\u0627\u062A\u0633\u0627\u0639 \u06A9\u0631\u0648\u0646\u0631\u06CC \u0627\u062B\u0631 \u03B2\u2082 \u0627\u0633\u062A \u0648 \u03B2\u2081 \u0645\u0633\u062A\u0642\u06CC\u0645\u0627\u064B \u0628\u0631 \u0627\u0646\u0642\u0628\u0627\u0636 \u0627\u062B\u0631 \u062F\u0627\u0631\u062F." }
      ]
    },
    stats: { solves: 5612, correctPercent: 87, optionPercents: [4, 87, 4, 5], avgTimeSec: 19, difficultyIndex: 0.87 },
    createdAt: "2025-09-01",
    updatedAt: "2026-06-11"
  },
  {
    id: "tb-phy-11",
    track: "medicine",
    subject: "physiology",
    topicPath: ["\u06AF\u0648\u0627\u0631\u0634", "\u0647\u0648\u0631\u0645\u0648\u0646\u200C\u0647\u0627\u06CC \u06AF\u0648\u0627\u0631\u0634\u06CC"],
    type: "memorization",
    difficulty: "medium",
    year: 1401,
    source: "official",
    tags: ["\u0645\u0646\u062A\u062E\u0628"],
    stem: "\u0647\u0648\u0631\u0645\u0648\u0646\u06CC \u06A9\u0647 \u0628\u0627 \u06A9\u0627\u0647\u0634 \u0627\u0633\u06CC\u062F\u06CC\u062A\u0647\u0654 \u062F\u0648\u0627\u0632\u062F\u0647\u0647 \u0648 \u062A\u062D\u0631\u06CC\u06A9 \u067E\u0627\u0646\u06A9\u0631\u0627\u0633 \u0628\u0647 \u062A\u0631\u0634\u062D \u0628\u06CC\u06A9\u0631\u0628\u0646\u0627\u062A\u060C \u0645\u062D\u06CC\u0637 \u0644\u0627\u0632\u0645 \u0628\u0631\u0627\u06CC \u0622\u0646\u0632\u06CC\u0645\u200C\u0647\u0627\u06CC \u0631\u0648\u062F\u0647 \u0641\u0631\u0627\u0647\u0645 \u0645\u06CC\u200C\u06A9\u0646\u062F \u06A9\u062F\u0627\u0645 \u0627\u0633\u062A\u061F",
    figure: null,
    options: ["\u06AF\u0627\u0633\u062A\u0631\u06CC\u0646", "\u0633\u06A9\u0631\u062A\u06CC\u0646", "\u06A9\u0648\u0644\u0647\u200C\u0633\u06CC\u0633\u062A\u0648\u06A9\u06CC\u0646\u06CC\u0646 (CCK)", "\u0645\u0648\u062A\u0648\u0644\u06CC\u0646"],
    correctAnswer: 1,
    explanation: {
      summary: "\u0633\u06A9\u0631\u062A\u06CC\u0646 \u0628\u0627 \u0648\u0627\u06A9\u0646\u0634 \u0628\u0647 pH \u067E\u0627\u06CC\u06CC\u0646 \u0627\u0632 \u0633\u0644\u0648\u0644\u200C\u0647\u0627\u06CC S \u062F\u0648\u0627\u0632\u062F\u0647\u0647 \u062A\u0631\u0634\u062D \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u062A\u0631\u0634\u062D \u0628\u06CC\u06A9\u0631\u0628\u0646\u0627\u062A \u067E\u0627\u0646\u06A9\u0631\u0627\u0633 \u0631\u0627 \u062A\u062D\u0631\u06CC\u06A9 \u0645\u06CC\u200C\u06A9\u0646\u062F.",
      deep: "\u0648\u0642\u062A\u06CC \u06A9\u06CC\u0645\u0648\u0633 \u0627\u0633\u06CC\u062F\u06CC \u0648\u0627\u0631\u062F \u062F\u0648\u0627\u0632\u062F\u0647\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F\u060C \u0633\u06A9\u0631\u062A\u06CC\u0646 \u0622\u0632\u0627\u062F \u0645\u06CC\u200C\u06AF\u0631\u062F\u062F \u062A\u0627 \u0628\u06CC\u06A9\u0631\u0628\u0646\u0627\u062A \u067E\u0627\u0646\u06A9\u0631\u0627\u0633 \u0648 \u06A9\u0628\u062F \u0631\u0627 \u062A\u062D\u0631\u06CC\u06A9 \u06A9\u0646\u062F \u0648 pH \u0644\u0648\u0645\u0646 \u0631\u0627 \u0628\u0627\u0644\u0627 \u0628\u0628\u0631\u062F \u2014 \u0644\u0627\u0632\u0645\u0647\u0654 \u0641\u0639\u0627\u0644\u06CC\u062A \u0622\u0645\u06CC\u0644\u0627\u0632 \u0648 \u0644\u06CC\u067E\u0627\u0632 \u0627\u0633\u062A. CCK \u0622\u0646\u0632\u06CC\u0645\u200C\u0647\u0627 \u0648 \u0627\u0646\u0642\u0628\u0627\u0636 \u06A9\u06CC\u0633\u0647\u0654 \u0635\u0641\u0631\u0627 \u0631\u0627 \u062A\u062D\u0631\u06CC\u06A9 \u0645\u06CC\u200C\u06A9\u0646\u062F \u0648 \u06AF\u0627\u0633\u062A\u0631\u06CC\u0646 \u0627\u0633\u06CC\u062F \u0645\u0639\u062F\u0647 \u0631\u0627.",
      keyPoint: "\u0633\u06A9\u0631\u062A\u06CC\u0646 = \xAB\u0627\u0633\u06CC\u062F \u0631\u0627 \u062E\u0646\u062B\u06CC \u06A9\u0646\xBB | CCK = \xAB\u0622\u0646\u0632\u06CC\u0645 \u0648 \u0635\u0641\u0631\u0627 \u0631\u0627 \u0628\u06CC\u0627\u0648\u0631\xBB | \u06AF\u0627\u0633\u062A\u0631\u06CC\u0646 = \xAB\u0627\u0633\u06CC\u062F \u0628\u0633\u0627\u0632\xBB.",
      trap: "CCK \u0647\u0645 \u067E\u0627\u0646\u06A9\u0631\u0627\u0633 \u0631\u0627 \u062A\u062D\u0631\u06CC\u06A9 \u0645\u06CC\u200C\u06A9\u0646\u062F \u0648\u0644\u06CC \u0628\u062E\u0634 \u0622\u0646\u0632\u06CC\u0645\u06CC (\u0622\u0633\u06CC\u0646\u0627\u0631)\u060C \u0646\u0647 \u0628\u062E\u0634 \u06A9\u0627\u0646\u0627\u0644\u06CC\u0650 \u0628\u06CC\u06A9\u0631\u0628\u0646\u0627\u062A.",
      whyWrong: [
        { index: 0, text: "\u06AF\u0627\u0633\u062A\u0631\u06CC\u0646 \u062A\u0631\u0634\u062D HCl \u0645\u0639\u062F\u0647 \u0631\u0627 \u0632\u06CC\u0627\u062F \u0645\u06CC\u200C\u06A9\u0646\u062F\u061B \u0627\u062B\u0631\u0634 \u0639\u06A9\u0633 \u062E\u0646\u062B\u06CC\u200C\u0633\u0627\u0632\u06CC \u0627\u0633\u062A." },
        { index: 2, text: "CCK \u0627\u0646\u0632\u06CC\u0645\u200C\u0647\u0627\u06CC \u067E\u0631\u0648\u062A\u0626\u0648\u0644\u06CC\u062A\u06CC\u06A9 \u0648 \u0644\u06CC\u067E\u0627\u0632 \u0631\u0627 \u062A\u062D\u0631\u06CC\u06A9 \u0645\u06CC\u200C\u06A9\u0646\u062F \u0648 \u0635\u0641\u0631\u0627 \u0631\u0627 \u062A\u062E\u0644\u06CC\u0647 \u0645\u06CC\u200C\u06A9\u0646\u062F." },
        { index: 3, text: "\u0645\u0648\u062A\u0648\u0644\u06CC\u0646 \u0628\u0627 \u062D\u0631\u06A9\u0627\u062A \u0628\u06CC\u0646\u200C\u0648\u0639\u062F\u0647\u200C\u0627\u06CC (Migrating motor complex) \u0645\u0631\u062A\u0628\u0637 \u0627\u0633\u062A." }
      ]
    },
    stats: { solves: 3390, correctPercent: 66, optionPercents: [14, 66, 17, 3], avgTimeSec: 29, difficultyIndex: 0.66 },
    createdAt: "2025-12-18",
    updatedAt: "2026-07-22"
  },
  {
    id: "tb-phy-12",
    track: "medicine",
    subject: "physiology",
    topicPath: ["\u063A\u062F\u062F \u062F\u0631\u0648\u0646\u200C\u0631\u06CC\u0632", "\u063A\u062F\u0647\u0654 \u062A\u06CC\u0631\u0648\u0626\u06CC\u062F"],
    type: "concept",
    difficulty: "medium",
    year: 1402,
    source: "official",
    tags: ["\u067E\u0631\u062A\u06A9\u0631\u0627\u0631"],
    stem: "\u062F\u0631 \u0645\u0642\u0627\u06CC\u0633\u0647 \u0628\u0627 T4\u060C \u0647\u0648\u0631\u0645\u0648\u0646 T3 \u062F\u0627\u0631\u0627\u06CC \u06A9\u062F\u0627\u0645 \u0648\u06CC\u0698\u06AF\u06CC \u0628\u0631\u062C\u0633\u062A\u0647 \u0627\u0633\u062A\u061F",
    figure: null,
    options: [
      "\u063A\u0644\u0638\u062A \u067E\u0644\u0627\u0633\u0645\u0627\u06CC\u06CC \u0628\u0627\u0644\u0627\u062A\u0631 \u0648 \u0646\u06CC\u0645\u0647\u200C\u0639\u0645\u0631 \u0637\u0648\u0644\u0627\u0646\u06CC\u200C\u062A\u0631",
      "\u0641\u0639\u0627\u0644\u06CC\u062A \u0628\u06CC\u0648\u0644\u0648\u0698\u06CC\u06A9 \u0628\u06CC\u0634\u062A\u0631\u060C \u0627\u0645\u0627 \u063A\u0644\u0638\u062A \u067E\u0644\u0627\u0633\u0645\u0627\u06CC\u06CC \u06A9\u0645\u062A\u0631 \u0648 \u0646\u06CC\u0645\u0647\u200C\u0639\u0645\u0631 \u06A9\u0648\u062A\u0627\u0647\u200C\u062A\u0631",
      "\u0639\u062F\u0645 \u0627\u062A\u0635\u0627\u0644 \u0628\u0647 \u067E\u0631\u0648\u062A\u0626\u06CC\u0646\u200C\u0647\u0627\u06CC \u062D\u0627\u0645\u0644",
      "\u0633\u0627\u062E\u062A\u0647\u200C\u0634\u062F\u0646 \u0641\u0642\u0637 \u062F\u0631 \u063A\u062F\u0647\u0654 \u062A\u06CC\u0631\u0648\u0626\u06CC\u062F \u0648 \u0628\u062F\u0648\u0646 \u0648\u0627\u0628\u0633\u062A\u06AF\u06CC \u0628\u0647 \u06CC\u062F"
    ],
    correctAnswer: 1,
    explanation: {
      summary: "T3 \u062D\u062F\u0648\u062F \u06F3 \u062A\u0627 \u06F5 \u0628\u0631\u0627\u0628\u0631 \u0641\u0639\u0627\u0644\u200C\u062A\u0631 \u0627\u0632 T4 \u0627\u0633\u062A \u0648\u0644\u06CC \u06A9\u0645\u062A\u0631 \u062A\u0631\u0634\u062D \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u0646\u06CC\u0645\u0647\u200C\u0639\u0645\u0631 \u06A9\u0648\u062A\u0627\u0647\u200C\u062A\u0631\u06CC (\u062D\u062F\u0648\u062F \u06CC\u06A9 \u0631\u0648\u0632 \u062F\u0631 \u0628\u0631\u0627\u0628\u0631 \u06F6-\u06F7 \u0631\u0648\u0632) \u062F\u0627\u0631\u062F.",
      deep: "\u0628\u062E\u0634 \u0645\u0647\u0645 \u0627\u062B\u0631 \u0647\u0648\u0631\u0645\u0648\u0646 \u062A\u06CC\u0631\u0648\u0626\u06CC\u062F \u062F\u0631 \u0628\u0627\u0641\u062A\u200C\u0647\u0627\u06CC \u0647\u062F\u0641 \u0627\u0632 \u062A\u0628\u062F\u06CC\u0644 \u0645\u062D\u0644\u06CC T4 \u0628\u0647 T3 \u0628\u0627 \u0622\u0646\u0632\u06CC\u0645 \u06F5-\u062F\u0650\u06CC\u0648\u062F\u06CC\u0646\u0627\u0632 \u062D\u0627\u0635\u0644 \u0645\u06CC\u200C\u0634\u0648\u062F. T4 \u0628\u06CC\u0634\u062A\u0631 \u0628\u0647 TBG \u0645\u062A\u0635\u0644 \u0645\u06CC\u200C\u0634\u0648\u062F\u061B \u0647\u0645\u06CC\u0646 \u0627\u062A\u0635\u0627\u0644\u060C \u0646\u06CC\u0645\u0647\u200C\u0639\u0645\u0631 \u0637\u0648\u0644\u0627\u0646\u06CC\u200C\u0627\u0634 \u0631\u0627 \u062A\u0648\u0636\u06CC\u062D \u0645\u06CC\u200C\u062F\u0647\u062F. \u0647\u0631 \u062F\u0648 \u0647\u0648\u0631\u0645\u0648\u0646 \u0628\u0647 \u06CC\u062F \u0648\u0627\u0628\u0633\u062A\u0647\u200C\u0627\u0646\u062F.",
      keyPoint: "T4 = \u062E\u0632\u0627\u0646\u0647 \u0648 \u067E\u06CC\u0634\u200C\u0647\u0648\u0631\u0645\u0648\u0646 | T3 = \u0634\u06A9\u0644 \u0641\u0639\u0627\u0644\u061B \u0647\u0631 \u062F\u0648 \u067E\u0631\u0648\u062A\u0626\u06CC\u0646\u200C\u0645\u062A\u0635\u0644\u200C\u0627\u0646\u062F (99%+).",
      trap: "\u0686\u0648\u0646 T3 \xAB\u0647\u0648\u0631\u0645\u0648\u0646 \u0641\u0639\u0627\u0644\xBB \u0627\u0633\u062A\u060C \u062A\u0635\u0648\u0631 \u0645\u06CC\u200C\u0634\u0648\u062F \u063A\u0644\u0638\u062A\u0634 \u0647\u0645 \u0628\u06CC\u0634\u062A\u0631 \u0627\u0633\u062A\u061B \u062F\u0631 \u0648\u0627\u0642\u0639 \u0647\u0645\u0627\u0646 \u0646\u0633\u0628\u062A \u0627\u062A\u0635\u0627\u0644 \u0648 \u062A\u0631\u0634\u062D\u060C \u0628\u0631\u0639\u06A9\u0633 \u0639\u0645\u0644 \u0645\u06CC\u200C\u06A9\u0646\u062F.",
      whyWrong: [
        { index: 0, text: "\u0627\u06CC\u0646 \u0648\u06CC\u0698\u06AF\u06CC\u200C\u0647\u0627\u06CC T4 \u0627\u0633\u062A\u060C \u0646\u0647 T3." },
        { index: 2, text: "\u0628\u06CC\u0634 \u0627\u0632 \u06F9\u06F9\u066A \u0647\u0631 \u062F\u0648 \u0647\u0648\u0631\u0645\u0648\u0646 \u0628\u0647 \u067E\u0631\u0648\u062A\u0626\u06CC\u0646\u200C\u0647\u0627\u06CC \u067E\u0644\u0627\u0633\u0645\u0627 \u0645\u062A\u0635\u0644\u200C\u0627\u0646\u062F." },
        { index: 3, text: "\u0647\u0631 \u062F\u0648 \u062D\u0627\u0648\u06CC \u06CC\u062F \u0647\u0633\u062A\u0646\u062F\u061B T3 \u062D\u062A\u06CC \u0633\u0647 \u0627\u062A\u0645 \u06CC\u062F \u062F\u0627\u0631\u062F." }
      ]
    },
    stats: { solves: 3564, correctPercent: 64, optionPercents: [16, 64, 9, 11], avgTimeSec: 34, difficultyIndex: 0.64 },
    createdAt: "2026-01-20",
    updatedAt: "2026-07-29"
  },
  {
    id: "tb-phy-13",
    track: "medicine",
    subject: "physiology",
    topicPath: ["\u062E\u0648\u0646", "\u0627\u0646\u0639\u0642\u0627\u062F \u062E\u0648\u0646"],
    type: "clinical",
    difficulty: "hard",
    year: 1403,
    source: "comprehensive",
    tags: [],
    stem: "\u0647\u067E\u0627\u0631\u06CC\u0646 \u0628\u0627 \u0627\u062A\u0635\u0627\u0644 \u0628\u0647 \u0622\u0646\u062A\u06CC\u200C\u062A\u0631\u0648\u0645\u0628\u06CC\u0646 III \u06A9\u062F\u0627\u0645 \u0641\u0627\u06A9\u062A\u0648\u0631 \u0627\u0646\u0639\u0642\u0627\u062F\u06CC \u0631\u0627 \u0628\u06CC\u0634\u062A\u0631\u06CC\u0646 \u0647\u062F\u0641\u200C\u06AF\u06CC\u0631\u06CC \u0645\u06CC\u200C\u06A9\u0646\u062F \u0648 \u0628\u0631\u0627\u06CC \u067E\u0627\u06CC\u0634 \u0627\u062B\u0631 \u0622\u0646 \u06A9\u062F\u0627\u0645 \u0622\u0632\u0645\u0648\u0646 \u0628\u0647 \u06A9\u0627\u0631 \u0645\u06CC\u200C\u0631\u0648\u062F\u061F",
    figure: null,
    options: [
      "\u0641\u0627\u06A9\u062A\u0648\u0631 VII\u061B PT",
      "\u062A\u0631\u0648\u0645\u0628\u06CC\u0646 (IIa) \u0648 \u0641\u0627\u06A9\u062A\u0648\u0631 Xa\u061B aPTT",
      "\u0641\u0627\u06A9\u062A\u0648\u0631 XIII\u061B \u0632\u0645\u0627\u0646 \u062E\u0648\u0646\u0631\u06CC\u0632\u06CC",
      "\u0641\u06CC\u0628\u0631\u06CC\u0646\u0648\u0698\u0646\u061B INR"
    ],
    correctAnswer: 1,
    explanation: {
      summary: "\u06A9\u0645\u067E\u0644\u06A9\u0633 \u0647\u067E\u0627\u0631\u06CC\u0646-\u0622\u0646\u062A\u06CC\u200C\u062A\u0631\u0648\u0645\u0628\u06CC\u0646 \u0628\u06CC\u0634\u062A\u0631\u06CC\u0646 \u062A\u0627\u062B\u06CC\u0631 \u0631\u0627 \u0628\u0631 IIa \u0648 Xa \u062F\u0627\u0631\u062F\u061B \u067E\u0627\u06CC\u0634 \u0628\u0627\u0644\u06CC\u0646\u06CC \u0628\u0627 aPTT \u0627\u0646\u062C\u0627\u0645 \u0645\u06CC\u200C\u0634\u0648\u062F.",
      deep: "\u0647\u067E\u0627\u0631\u06CC\u0646\u060C \u0622\u0646\u062A\u06CC\u200C\u062A\u0631\u0648\u0645\u0628\u06CC\u0646 \u0631\u0627 \u06F2\u06F0\u06F0\u06F0 \u062A\u0627 \u06F4\u06F0\u06F0\u06F0 \u0628\u0631\u0627\u0628\u0631 \u0641\u0639\u0627\u0644\u200C\u062A\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F \u0648 \u0627\u06CC\u0646 \u06A9\u0645\u067E\u0644\u06A9\u0633 \u062A\u0631\u0648\u0645\u0628\u06CC\u0646 (IIa) \u0648 \u0641\u0627\u06A9\u062A\u0648\u0631 Xa \u0631\u0627 \u063A\u06CC\u0631\u0641\u0639\u0627\u0644 \u0645\u06CC\u200C\u0633\u0627\u0632\u062F. \u0647\u067E\u0627\u0631\u06CC\u0646\u200C\u0647\u0627\u06CC \u06A9\u0645\u200C\u0648\u0632\u0646 \u0645\u0648\u0644\u06A9\u0648\u0644\u06CC (LMWH) \u0627\u0646\u062A\u062E\u0627\u0628\u200C\u06AF\u0631\u062A\u0631 Xa \u0631\u0627 \u0645\u0647\u0627\u0631 \u0645\u06CC\u200C\u06A9\u0646\u0646\u062F \u0648 \u0628\u0631\u0627\u06CC \u067E\u0627\u06CC\u0634 \u0628\u0647 aPTT \u0646\u06CC\u0627\u0632 \u0646\u062F\u0627\u0631\u0646\u062F.",
      keyPoint: "\u0647\u067E\u0627\u0631\u06CC\u0646 = aPTT | \u0648\u0627\u0631\u0641\u0627\u0631\u06CC\u0646 = PT/INR | \u0645\u0633\u06CC\u0631 \u062F\u0631\u0648\u0646\u200C\u0632\u0627 = aPTT\u060C \u0628\u0631\u0648\u0646\u200C\u0632\u0627 = PT.",
      trap: "\u0648\u0627\u0631\u0641\u0627\u0631\u06CC\u0646 \u0628\u0631 \u0641\u0627\u06A9\u062A\u0648\u0631\u0647\u0627\u06CC \u0648\u06CC\u062A\u0627\u0645\u06CC\u0646-K \u0648\u0627\u0628\u0633\u062A\u0647 (II\u060C VII\u060C IX\u060C X) \u0627\u062B\u0631 \u062F\u0627\u0631\u062F\u061B \u0622\u0632\u0645\u0648\u0646 \u0622\u0646 PT/INR \u0627\u0633\u062A \u0646\u0647 aPTT.",
      whyWrong: [
        { index: 0, text: "\u0641\u0627\u06A9\u062A\u0648\u0631 VII \u0647\u062F\u0641 \u0648\u0627\u0631\u0641\u0627\u0631\u06CC\u0646 \u0627\u0633\u062A \u0648 PT \u0622\u0632\u0645\u0648\u0646 \u0645\u0633\u06CC\u0631 \u0628\u0631\u0648\u0646\u200C\u0632\u0627." },
        { index: 2, text: "\u0641\u0627\u06A9\u062A\u0648\u0631 XIII \u062F\u0631 \u062A\u062B\u0628\u06CC\u062A \u0644\u062E\u062A\u0647 \u0646\u0642\u0634 \u062F\u0627\u0631\u062F \u0648 \u0647\u062F\u0641 \u0627\u0635\u0644\u06CC \u0647\u067E\u0627\u0631\u06CC\u0646 \u0646\u06CC\u0633\u062A." },
        { index: 3, text: "\u0641\u06CC\u0628\u0631\u06CC\u0646\u0648\u0698\u0646 \u0647\u062F\u0641 \u0647\u067E\u0627\u0631\u06CC\u0646 \u0646\u06CC\u0633\u062A\u061B INR \u0647\u0645 \u067E\u0627\u06CC\u0634 \u0648\u0627\u0631\u0641\u0627\u0631\u06CC\u0646 \u0627\u0633\u062A." }
      ]
    },
    stats: { solves: 1892, correctPercent: 57, optionPercents: [18, 57, 6, 19], avgTimeSec: 41, difficultyIndex: 0.57 },
    createdAt: "2026-03-16",
    updatedAt: "2026-08-07"
  },
  {
    id: "tb-phy-14",
    track: "medicine",
    subject: "physiology",
    topicPath: ["\u0639\u0636\u0644\u0647", "\u0641\u06CC\u0632\u06CC\u0648\u0644\u0648\u0698\u06CC \u0627\u0646\u0642\u0628\u0627\u0636"],
    type: "concept",
    difficulty: "medium",
    year: 1399,
    source: "official",
    tags: ["\u067E\u0631\u062A\u06A9\u0631\u0627\u0631"],
    stem: "\u062F\u0631 \u0641\u0631\u0622\u06CC\u0646\u062F \u0627\u062A\u0635\u0627\u0644 \u0645\u06CC\u0648\u0632\u06CC\u0646 \u0628\u0647 \u0627\u06A9\u062A\u06CC\u0646\u060C \u0646\u0642\u0634 \u06A9\u0644\u0633\u06CC\u0645 \u0622\u0632\u0627\u062F\u0634\u062F\u0647 \u0627\u0632 \u0634\u0628\u06A9\u0647 \u0633\u0627\u0631\u06A9\u0648\u067E\u0644\u0627\u0633\u0645\u06CC \u0686\u06CC\u0633\u062A\u061F",
    figure: null,
    options: [
      "\u0627\u062A\u0635\u0627\u0644 \u0645\u0633\u062A\u0642\u06CC\u0645 \u0628\u0647 \u0645\u06CC\u0648\u0632\u06CC\u0646 \u0648 \u0641\u0639\u0627\u0644\u200C\u0633\u0627\u0632\u06CC ATPase \u0622\u0646",
      "\u0627\u062A\u0635\u0627\u0644 \u0628\u0647 \u062A\u0631\u0648\u067E\u0648\u0646\u06CC\u0646 C \u0648 \u062C\u0627\u0628\u0647\u200C\u062C\u0627\u06CC\u06CC \u062A\u0631\u0648\u067E\u0648\u0645\u06CC\u0648\u0632\u06CC\u0646 \u0627\u0632 \u0645\u062D\u0644 \u0627\u062A\u0635\u0627\u0644",
      "\u062A\u0633\u0631\u06CC\u0639 \u062A\u062C\u0632\u06CC\u0647 ATP \u0645\u0633\u062A\u0642\u0644 \u0627\u0632 \u062A\u0631\u0648\u067E\u0648\u0646\u06CC\u0646",
      "\u0627\u0641\u0632\u0627\u06CC\u0634 \u0647\u062F\u0627\u06CC\u062A \u0633\u062F\u06CC\u0645\u06CC \u063A\u0634\u0627\u06CC \u062A\u06CC\u200C\u062A\u0648\u0628\u0648\u0644"
    ],
    correctAnswer: 1,
    explanation: {
      summary: "Ca\xB2\u207A \u0628\u0647 \u062A\u0631\u0648\u067E\u0648\u0646\u06CC\u0646 C \u0645\u06CC\u200C\u0628\u0646\u062F\u062F\u061B \u062A\u0631\u0648\u067E\u0648\u0645\u06CC\u0648\u0632\u06CC\u0646 \u0627\u0632 \u0633\u0627\u06CC\u062A \u0627\u062A\u0635\u0627\u0644 \u0627\u06A9\u062A\u06CC\u0646 \u06A9\u0646\u0627\u0631 \u0645\u06CC\u200C\u0631\u0648\u062F \u0648 \u0686\u0631\u062E\u0647\u0654 \u0645\u062A\u0642\u0627\u0637\u0639 \u0622\u063A\u0627\u0632 \u0645\u06CC\u200C\u0634\u0648\u062F.",
      deep: "\u062F\u0631 \u0639\u0636\u0644\u0647\u0654 \u0645\u062E\u0637\u0637\u060C \u0627\u06A9\u062A\u06CC\u0646 \u062F\u0631 \u062D\u0627\u0644\u062A \u0627\u0633\u062A\u0631\u0627\u062D\u062A \u0628\u0627 \u062A\u0631\u0648\u067E\u0648\u0645\u06CC\u0648\u0632\u06CC\u0646 \u067E\u0648\u0634\u06CC\u062F\u0647 \u0634\u062F\u0647 \u0627\u0633\u062A. \u06A9\u0644\u0633\u06CC\u0645 \u0628\u0627 \u0627\u062A\u0635\u0627\u0644 \u0628\u0647 \u062A\u0631\u0648\u067E\u0648\u0646\u06CC\u0646-C\u060C \u067E\u0627\u06CC\u062F\u0627\u0631\u06CC \u0627\u06CC\u0646 \u067E\u0648\u0634\u0634 \u0631\u0627 \u0627\u0632 \u0628\u06CC\u0646 \u0645\u06CC\u200C\u0628\u0631\u062F \u0648 \u0633\u0627\u06CC\u062A \u0627\u062A\u0635\u0627\u0644 \u0645\u06CC\u0648\u0632\u06CC\u0646 \u0622\u0634\u06A9\u0627\u0631 \u0645\u06CC\u200C\u0634\u0648\u062F\u061B \u0633\u067E\u0633 ADP-PI \u0645\u06CC\u0648\u0632\u06CC\u0646 \u0628\u0647 \u0627\u06A9\u062A\u06CC\u0646 \u0645\u06CC\u200C\u0686\u0633\u0628\u062F \u0648 \u0628\u0627 \u0622\u0632\u0627\u062F\u0633\u0627\u0632\u06CC \u0641\u0633\u0641\u0627\u062A\u060C Power Stroke \u0631\u062E \u0645\u06CC\u200C\u062F\u0647\u062F.",
      keyPoint: "\u06A9\u0644\u06CC\u062F \u0627\u0646\u0642\u0628\u0627\u0636 \u0627\u0633\u06A9\u0644\u062A\u06CC = Ca\xB2\u207A-\u062A\u0631\u0648\u067E\u0648\u0646\u06CC\u0646 C\u061B \u062F\u0631 \u0639\u0636\u0644\u0647\u0654 \u0635\u0627\u0641 \u0647\u0645\u06CC\u0646 \u0646\u0642\u0634 \u0631\u0627 Ca\xB2\u207A-\u06A9\u0627\u0644\u0645\u0648\u062F\u0648\u0644\u06CC\u0646-MLCK \u062F\u0627\u0631\u062F.",
      trap: "\u06A9\u0644\u0633\u06CC\u0645 ATPase \u0645\u06CC\u0648\u0632\u06CC\u0646 \u0631\u0627 \u0645\u0633\u062A\u0642\u06CC\u0645 \u0641\u0639\u0627\u0644 \u0646\u0645\u06CC\u200C\u06A9\u0646\u062F\u061B \u0622\u0646\u0632\u06CC\u0645 \u0630\u0627\u062A\u06CC \u0633\u0631 \u0645\u06CC\u0648\u0632\u06CC\u0646 \u0627\u0633\u062A \u06A9\u0647 \u067E\u0633 \u0627\u0632 \u0627\u062A\u0635\u0627\u0644 \u0628\u0647 \u0627\u06A9\u062A\u06CC\u0646 \u0641\u0639\u0627\u0644 \u0645\u06CC\u200C\u0634\u0648\u062F.",
      whyWrong: [
        { index: 0, text: "\u0641\u0639\u0627\u0644\u200C\u0633\u0627\u0632\u06CC ATPase \u067E\u0633 \u0627\u0632 \u0627\u062A\u0635\u0627\u0644 \u0628\u0647 \u0627\u06A9\u062A\u06CC\u0646 \u0631\u062E \u0645\u06CC\u200C\u062F\u0647\u062F\u061B \u0646\u0642\u0634 \u06A9\u0644\u0633\u06CC\u0645\u060C \u0622\u0634\u06A9\u0627\u0631\u0633\u0627\u0632\u06CC \u0633\u0627\u06CC\u062A \u0627\u062A\u0635\u0627\u0644 \u0627\u0633\u062A." },
        { index: 2, text: "\u062A\u062C\u0632\u06CC\u0647\u0654 ATP \u0628\u062F\u0648\u0646 \u0622\u0634\u06A9\u0627\u0631 \u0634\u062F\u0646 \u0633\u0627\u06CC\u062A \u0627\u062A\u0635\u0627\u0644 \u0627\u0645\u06A9\u0627\u0646\u200C\u067E\u0630\u06CC\u0631 \u0646\u06CC\u0633\u062A." },
        { index: 3, text: "\u0647\u062F\u0627\u06CC\u062A \u0633\u062F\u06CC\u0645\u06CC \u062A\u06CC\u200C\u062A\u0648\u0628\u0648\u0644 \u0628\u0627 \u0622\u0632\u0627\u062F\u0633\u0627\u0632\u06CC \u06A9\u0644\u0633\u06CC\u0645 \u0627\u0632 SR \u0631\u0628\u0637 \u0633\u0627\u062E\u062A\u0627\u0631\u06CC \u0645\u0633\u062A\u0642\u06CC\u0645 \u0646\u062F\u0627\u0631\u062F." }
      ]
    },
    stats: { solves: 4305, correctPercent: 72, optionPercents: [10, 72, 9, 9], avgTimeSec: 30, difficultyIndex: 0.72 },
    createdAt: "2025-11-11",
    updatedAt: "2026-06-30"
  },
  {
    id: "tb-phy-15",
    track: "medicine",
    subject: "physiology",
    topicPath: ["\u0642\u0644\u0628 \u0648 \u0639\u0631\u0648\u0642", "\u0686\u0631\u062E\u0647\u0654 \u0642\u0644\u0628\u06CC"],
    type: "calculation",
    difficulty: "easy",
    year: 1404,
    source: "official",
    tags: [],
    stem: "\u0627\u06AF\u0631 \u062D\u062C\u0645 \u0636\u0631\u0628\u0647\u200C\u0627\u06CC (SV) \u0642\u0644\u0628\u06CC \u06F7\u06F0 \u0645\u06CC\u0644\u06CC\u200C\u0644\u06CC\u062A\u0631 \u0648 \u062A\u0639\u062F\u0627\u062F \u0636\u0631\u0628\u0627\u0646 \u06F7\u06F5 \u0628\u0627\u0631 \u062F\u0631 \u062F\u0642\u06CC\u0642\u0647 \u0628\u0627\u0634\u062F\u060C \u0628\u0631\u0648\u0646\u200C\u062F\u0647 \u0642\u0644\u0628\u06CC \u0686\u0642\u062F\u0631 \u0627\u0633\u062A\u061F",
    figure: null,
    options: ["\u06F5\u066B\u06F2\u06F5 \u0644\u06CC\u062A\u0631 \u062F\u0631 \u062F\u0642\u06CC\u0642\u0647", "\u06F4\u066B\u06F5 \u0644\u06CC\u062A\u0631 \u062F\u0631 \u062F\u0642\u06CC\u0642\u0647", "\u06F6\u066B\u06F7\u06F5 \u0644\u06CC\u062A\u0631 \u062F\u0631 \u062F\u0642\u06CC\u0642\u0647", "\u06F7 \u0644\u06CC\u062A\u0631 \u062F\u0631 \u062F\u0642\u06CC\u0642\u0647"],
    correctAnswer: 0,
    explanation: {
      summary: "CO = HR \xD7 SV = \u06F7\u06F5 \xD7 \u06F7\u06F0 = \u06F5\u06F2\u06F5\u06F0 \u0645\u06CC\u0644\u06CC\u200C\u0644\u06CC\u062A\u0631 \u2248 \u06F5\u066B\u06F2\u06F5 \u0644\u06CC\u062A\u0631 \u062F\u0631 \u062F\u0642\u06CC\u0642\u0647.",
      deep: "\u0628\u0631\u0648\u0646\u200C\u062F\u0647 \u0642\u0644\u0628\u06CC \u062D\u062C\u0645 \u062E\u0648\u0646 \u067E\u0645\u067E\u200C\u0634\u062F\u0647 \u062F\u0631 \u06CC\u06A9 \u062F\u0642\u06CC\u0642\u0647 \u0627\u0633\u062A \u0648 \u062F\u0631 \u0641\u0631\u062F \u0628\u0627\u0644\u063A \u0646\u0631\u0645\u0627\u0644 \u062D\u062F\u0648\u062F \u06F5 \u0644\u06CC\u062A\u0631 \u062F\u0631 \u062F\u0642\u06CC\u0642\u0647 \u06AF\u0632\u0627\u0631\u0634 \u0645\u06CC\u200C\u0634\u0648\u062F. \u0634\u0627\u062E\u0635 \u0642\u0644\u0628\u06CC (CI) \u0627\u06CC\u0646 \u0639\u062F\u062F \u0631\u0627 \u0628\u0647 \u0633\u0637\u062D \u0628\u062F\u0646 \u0646\u0631\u0645\u0627\u0644\u200C\u0633\u0627\u0632\u06CC \u0645\u06CC\u200C\u06A9\u0646\u062F.",
      keyPoint: "CO = HR \xD7 SV\u061B \u062F\u0631 \u0645\u0633\u0627\u0626\u0644 \u0645\u062D\u0627\u0633\u0628\u0627\u062A\u06CC \u0647\u0645\u06CC\u0634\u0647 \u0648\u0627\u062D\u062F \u0646\u0647\u0627\u06CC\u06CC (\u0644\u06CC\u062A\u0631 \u062F\u0631 \u062F\u0642\u06CC\u0642\u0647) \u0631\u0627 \u0686\u06A9 \u06A9\u0646\u06CC\u062F.",
      trap: "\u06F6\u066B\u06F7\u06F5 \u062D\u0627\u0635\u0644 \u0636\u0631\u0628 \u06F9\u06F0\xD7\u06F7\u06F5 \u0627\u0633\u062A\u061B \u0627\u0639\u062F\u0627\u062F \u0635\u0648\u0631\u062A \u0633\u0624\u0627\u0644 \u0631\u0627 \u062F\u0642\u06CC\u0642 \u0628\u06AF\u0630\u0627\u0631\u06CC\u062F.",
      whyWrong: [
        { index: 1, text: "\u0627\u06CC\u0646 \u062D\u0627\u0635\u0644 \u06F6\u06F0\xD7\u06F7\u06F5 \u0627\u0633\u062A\u061B \u062D\u062C\u0645 \u0636\u0631\u0628\u0647\u200C\u0627\u06CC \u062F\u0627\u062F\u0647\u200C\u0634\u062F\u0647 \u06F7\u06F0 \u0627\u0633\u062A." },
        { index: 2, text: "\u0639\u062F\u062F \u0628\u0627 \u0636\u0631\u0628 \u06F9\u06F0\xD7\u06F7\u06F5 \u0628\u0647 \u062F\u0633\u062A \u0645\u06CC\u200C\u0622\u06CC\u062F\u061B \u0646\u0627\u062F\u0631\u0633\u062A." },
        { index: 3, text: "\u06F7 \u0644\u06CC\u062A\u0631 \u0646\u06CC\u0627\u0632\u0645\u0646\u062F SV \u2248 \u06F9\u06F3 \u0645\u06CC\u0644\u06CC\u200C\u0644\u06CC\u062A\u0631 \u0627\u0633\u062A \u06A9\u0647 \u062F\u0631 \u0635\u0648\u0631\u062A \u0633\u0624\u0627\u0644 \u0646\u06CC\u0627\u0645\u062F\u0647." }
      ]
    },
    stats: { solves: 6103, correctPercent: 89, optionPercents: [89, 4, 5, 2], avgTimeSec: 22, difficultyIndex: 0.89 },
    createdAt: "2026-04-25",
    updatedAt: "2026-09-03"
  },
  /* ═══════════════ آناتومی (۱۰ سؤال) ═══════════════ */
  {
    id: "tb-ana-01",
    track: "medicine",
    subject: "anatomy",
    topicPath: ["\u0627\u0646\u062F\u0627\u0645 \u0641\u0648\u0642\u0627\u0646\u06CC", "\u0646\u0627\u062D\u06CC\u0647\u0654 \u0633\u0631\u0634\u0627\u0646\u0647 \u0648 \u0628\u0631\u0627\u06A9\u06CC\u0627\u0644 \u067E\u0644\u06A9\u0633\u0648\u0633"],
    type: "clinical",
    difficulty: "hard",
    year: 1402,
    source: "official",
    tags: ["\u067E\u0631\u062A\u06A9\u0631\u0627\u0631"],
    stem: "\u0646\u0648\u0632\u0627\u062F\u06CC \u067E\u0633 \u0627\u0632 \u0632\u0627\u06CC\u0645\u0627\u0646 \u062F\u06CC\u0633\u062A\u0648\u0633\u06CC\u06A9\u060C \u0628\u0627\u0632\u0648\u06CC \u0622\u0648\u06CC\u0632\u0627\u0646 \u0648 \u0686\u0631\u062E\u06CC\u062F\u0647 \u0628\u0647 \u062F\u0627\u062E\u0644 \u0648 \u0633\u0627\u0639\u062F \u067E\u0631\u0646\u0627\u062A\u0648\u0631 \u062F\u0627\u0631\u062F. \u06A9\u062F\u0627\u0645 \u0631\u06CC\u0634\u0647\u200C\u0647\u0627 \u0648 \u0622\u0633\u06CC\u0628 \u0645\u0633\u0626\u0648\u0644 \u0627\u06CC\u0646 \u062A\u0635\u0648\u06CC\u0631 \u0627\u0633\u062A\u061F",
    figure: null,
    options: [
      "C8-T1\u061B \u0641\u0644\u062C \u06A9\u0644\u0648\u0645\u067E\u06A9\u0647 (\u067E\u0627\u0631\u0627\u0644\u06CC\u0632 \u062A\u062D\u062A\u0627\u0646\u06CC \u0628\u0631\u0627\u06A9\u06CC\u0627\u0644 \u067E\u0644\u06A9\u0633\u0648\u0633)",
      "C5-C6\u061B \u0641\u0644\u062C \u0627\u0631\u0628 (\u067E\u0627\u0631\u0627\u0644\u06CC\u0632 \u0641\u0648\u0642\u0627\u0646\u06CC \u0628\u0631\u0627\u06A9\u06CC\u0627\u0644 \u067E\u0644\u06A9\u0633\u0648\u0633)",
      "C7\u061B \u0622\u0633\u06CC\u0628 \u0639\u0635\u0628 \u062A\u0648\u0631\u0627\u0633\u06CC\u06A9 \u0628\u0644\u0646\u062F",
      "C5-T1\u061B \u0622\u0633\u06CC\u0628 \u06A9\u0627\u0645\u0644 \u067E\u0644\u06A9\u0633\u0648\u0633"
    ],
    correctAnswer: 1,
    explanation: {
      summary: "\u0641\u0644\u062C \u0627\u0631\u0628 \u0627\u0632 \u06A9\u0634\u06CC\u062F\u06AF\u06CC \u0631\u06CC\u0634\u0647\u200C\u0647\u0627\u06CC \u0641\u0648\u0642\u0627\u0646\u06CC C5-C6 \u0627\u06CC\u062C\u0627\u062F \u0645\u06CC\u200C\u0634\u0648\u062F\u061B \u0648\u0636\u0639\u06CC\u062A \xABwaiter\u2019s tip\xBB (\u0628\u0627\u0632\u0648\u06CC \u0622\u0648\u06CC\u0632\u0627\u0646\u060C \u0627\u06A9\u0633\u062A\u0646\u0634\u0646 \u0648 \u067E\u0631\u0648\u0646\u06CC\u0634\u0646 \u0633\u0627\u0639\u062F) \u06A9\u0644\u0627\u0633\u06CC\u06A9 \u0627\u0633\u062A.",
      deep: "\u06A9\u0634\u0634 \u0633\u0631 \u0628\u0647 \u0633\u0645\u062A \u0645\u0642\u0627\u0628\u0644 \u0634\u0627\u0646\u0647 \u0647\u0646\u06AF\u0627\u0645 \u0632\u0627\u06CC\u0645\u0627\u0646\u060C \u0631\u06CC\u0634\u0647\u200C\u0647\u0627\u06CC C5-C6 \u0631\u0627 \u0645\u06CC\u200C\u06A9\u0634\u062F\u061B \u0639\u0636\u0644\u0627\u062A \u0627\u0628\u062F\u06A9\u062A\u0648\u0631 \u0648 \u0686\u0631\u062E\u0627\u0646\u0646\u062F\u0647\u0654 \u062E\u0627\u0631\u062C\u06CC \u0634\u0627\u0646\u0647 (\u062F\u0644\u062A\u0648\u0626\u06CC\u062F\u060C \u0627\u06CC\u0646\u0641\u0631\u0627\u0627\u0633\u067E\u06CC\u0646\u0627\u062A\u0648\u0633) \u0648 \u0641\u0644\u06A9\u0633\u0648\u0631\u0647\u0627/\u0633\u0648\u067E\u06CC\u0646\u0627\u062A\u0648\u0631\u0647\u0627\u06CC \u0633\u0627\u0639\u062F \u0641\u0644\u062C \u0645\u06CC\u200C\u0634\u0648\u0646\u062F \u0648 \u0641\u0631\u0645 \u06CC\u0627\u062F\u0634\u062F\u0647 \u0645\u06CC\u200C\u0622\u06CC\u062F. \u0641\u0644\u062C \u06A9\u0644\u0648\u0645\u067E\u06A9\u0647 (C8-T1) \u0628\u0631\u0639\u06A9\u0633\u060C \u0639\u0636\u0644\u0627\u062A \u062F\u0627\u062E\u0644\u200C\u062F\u0633\u062A\u06CC \u062F\u0633\u062A \u0631\u0627 \u06AF\u0631\u0641\u062A\u0627\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F (claw hand).",
      keyPoint: "\u0627\u0631\u0628 = C5-C6 (waiter\u2019s tip) | \u06A9\u0644\u0648\u0645\u067E\u06A9\u0647 = C8-T1 (claw hand).",
      trap: "\xAB\u062F\u06CC\u0633\u062A\u0648\u0633\u06CC\u06A9\xBB \u0648 \xAB\u06A9\u0634\u0634\xBB \u0646\u0634\u0627\u0646\u0647\u0654 \u0631\u06CC\u0634\u0647\u200C\u0647\u0627\u06CC \u0641\u0648\u0642\u0627\u0646\u06CC \u0627\u0633\u062A\u061B \u062F\u0631 \u062F\u06CC\u0633\u062A\u0648\u0633\u06CC\u06A9 (\u0628\u0627\u0644\u0627 \u0622\u0645\u062F\u0646 \u0628\u0627\u0632\u0648\u0647\u0627) \u0622\u0633\u06CC\u0628 \u0631\u06CC\u0634\u0647\u200C\u0647\u0627\u06CC \u062A\u062D\u062A\u0627\u0646\u06CC \u0645\u062D\u062A\u0645\u0644\u200C\u062A\u0631 \u0627\u0633\u062A.",
      whyWrong: [
        { index: 0, text: "\u06A9\u0644\u0648\u0645\u067E\u06A9\u0647 \u0628\u0627 \u062F\u06CC\u0633\u062A\u0648\u0633\u06CC\u06A9 \u0632\u0627\u06CC\u0645\u0627\u0646 \u0647\u0645\u0631\u0627\u0647 \u0627\u0633\u062A \u0648 \u062A\u0635\u0648\u06CC\u0631 \u0642\u0644\u0627\u0628\u200C\u062F\u0633\u062A \u0645\u06CC\u200C\u062F\u0647\u062F." },
        { index: 2, text: "\u0639\u0635\u0628 \u062A\u0648\u0631\u0627\u0633\u06CC\u06A9 \u0628\u0644\u0646\u062F (C5-C7) \u0628\u0627 winged scapula \u062A\u0638\u0627\u0647\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F." },
        { index: 3, text: "\u0622\u0633\u06CC\u0628 \u06A9\u0627\u0645\u0644 \u06A9\u0644 \u067E\u0644\u06A9\u0633\u0648\u0633 \u062A\u0635\u0648\u06CC\u0631 \u0628\u0633\u06CC\u0627\u0631 \u0648\u0633\u06CC\u0639\u200C\u062A\u0631 \u0648 \u063A\u06CC\u0631\u0648\u0627\u0627\u0642\u0639\u06CC\u200C\u062A\u0631 \u062F\u0627\u0631\u062F." }
      ]
    },
    stats: { solves: 2714, correctPercent: 61, optionPercents: [14, 61, 8, 17], avgTimeSec: 44, difficultyIndex: 0.61 },
    createdAt: "2026-01-28",
    updatedAt: "2026-08-16"
  },
  {
    id: "tb-ana-02",
    track: "medicine",
    subject: "anatomy",
    topicPath: ["\u0627\u0646\u062F\u0627\u0645 \u0641\u0648\u0642\u0627\u0646\u06CC", "\u0627\u0639\u0635\u0627\u0628 \u0627\u0646\u062F\u0627\u0645 \u0641\u0648\u0642\u0627\u0646\u06CC"],
    type: "clinical",
    difficulty: "medium",
    year: 1401,
    source: "official",
    tags: ["\u067E\u0631\u062A\u06A9\u0631\u0627\u0631"],
    stem: "\u0641\u0631\u062F\u06CC \u067E\u0633 \u0627\u0632 \u0634\u06A9\u0633\u062A\u06AF\u06CC \u0634\u0641\u062A \u0647\u06CC\u0648\u0645\u0631\u0648\u0633\u060C \u0627\u0641\u062A\u0627\u062F\u06AF\u06CC \u0645\u0686 \u062F\u0633\u062A (Wrist Drop) \u067E\u06CC\u062F\u0627 \u06A9\u0631\u062F\u0647 \u0627\u0633\u062A. \u06A9\u062F\u0627\u0645 \u0639\u0635\u0628 \u0622\u0633\u06CC\u0628 \u062F\u06CC\u062F\u0647 \u0627\u0633\u062A\u061F",
    figure: null,
    options: ["\u0639\u0635\u0628 \u0645\u062F\u06CC\u0627\u0646", "\u0639\u0635\u0628 \u0627\u0648\u0644\u0646\u0627\u0631", "\u0639\u0635\u0628 \u0631\u0627\u062F\u06CC\u0627\u0644", "\u0639\u0635\u0628 \u0645\u0648\u0633\u06A9\u0648\u0644\u0648\u06A9\u0648\u062A\u0627\u0646\u0626\u0648\u0633"],
    correctAnswer: 2,
    explanation: {
      summary: "\u0639\u0635\u0628 \u0631\u0627\u062F\u06CC\u0627\u0644 \u06A9\u0647 \u062F\u0631 \u06AF\u0648\u062F\u06CC \u0627\u0633\u067E\u06CC\u0631\u0627\u0644 \u0647\u06CC\u0648\u0645\u0631\u0648\u0633 \u0645\u06CC\u200C\u062E\u0648\u0627\u0628\u062F\u060C \u062F\u0631 \u0634\u06A9\u0633\u062A\u06AF\u06CC \u0634\u0641\u062A \u0647\u06CC\u0648\u0645\u0631\u0648\u0633 \u06AF\u0631\u0641\u062A\u0627\u0631 \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u0641\u0644\u062C \u0627\u06A9\u0633\u062A\u0646\u0633\u0648\u0631\u0647\u0627 \u2192 wrist drop.",
      deep: "\u0631\u0627\u062F\u06CC\u0627\u0644 \u062F\u0631 \u0634\u06CC\u0627\u0631 \u0627\u0633\u067E\u06CC\u0631\u0627\u0644 \u0647\u06CC\u0648\u0645\u0631\u0648\u0633 (\u0646\u0631\u0648 \u067E\u0627\u0633\u062A\u06CC\u0644 \u0631\u0627\u062F\u06CC\u0627\u0644) \u0622\u0633\u06CC\u0628\u200C\u067E\u0630\u06CC\u0631\u062A\u0631\u06CC\u0646 \u0645\u062D\u0644\u0634 \u0631\u0627 \u062F\u0627\u0631\u062F. \u0641\u0644\u062C \u0627\u06A9\u0633\u062A\u0646\u0633\u0648\u0631\u0647\u0627\u06CC \u0633\u0627\u0639\u062F \u0648 \u06AF\u0631\u0641\u062A\u0627\u0631\u06CC \u062D\u0633 \u067E\u0634\u062A \u062F\u0633\u062A (\u0628\u0647\u200C\u0648\u06CC\u0698\u0647 \u0641\u0636\u0627\u06CC \u0628\u06CC\u0646\u200C\u0627\u0646\u06AF\u0634\u062A\u06CC \u0627\u0648\u0644) \u0647\u0645\u0631\u0627\u0647 \u0627\u0633\u062A.",
      keyPoint: "\u0634\u0641\u062A \u0647\u06CC\u0648\u0645\u0631\u0648\u0633 \u2192 \u0631\u0627\u062F\u06CC\u0627\u0644 | \u0627\u067E\u06CC\u06A9\u0648\u0646\u062F\u06CC\u0644 \u0645\u062F\u06CC\u0627\u0644 \u2192 \u0627\u0648\u0644\u0646\u0627\u0631 | \u0633\u0648\u067E\u0631\u0627\u06A9\u0646\u062F\u06CC\u0644 \u0645\u062F\u06CC\u0627\u0644/\u06A9\u0627\u0631\u0633\u0627\u0644 \u062A\u0627\u0646\u0644 \u2192 \u0645\u062F\u06CC\u0627\u0646.",
      trap: "\u0645\u062F\u06CC\u0627\u0646 \u0628\u0627 \xAB\u062F\u0633\u062A \u0645\u06CC\u0645\u0648\u0646\u06CC\xBB (ape hand) \u0648 \u0627\u0648\u0644\u0646\u0627\u0631 \u0628\u0627 \xABclaw hand\xBB \u0634\u0646\u0627\u062E\u062A\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F\u061B wrist drop \u0627\u062E\u062A\u0635\u0627\u0635\u06CC \u0631\u0627\u062F\u06CC\u0627\u0644 \u0627\u0633\u062A.",
      whyWrong: [
        { index: 0, text: "\u0645\u062F\u06CC\u0627\u0646 \u0641\u0644\u062C \u062A\u0650\u0646\u0627\u0631 \u0648 \u0646\u0627\u062A\u0648\u0627\u0646\u06CC \u062F\u0631 \u0627\u0628\u0647\u200C\u062F\u0627\u06A9\u0634\u0646 \u0627\u0646\u06AF\u0634\u062A \u0634\u0633\u062A \u0645\u06CC\u200C\u062F\u0647\u062F\u060C \u0646\u0647 \u0627\u0641\u062A\u0627\u062F\u06AF\u06CC \u0645\u0686." },
        { index: 1, text: "\u0627\u0648\u0644\u0646\u0627\u0631 \u0628\u0627 \u0636\u0627\u06CC\u0639\u0647\u0654 \u0627\u067E\u06CC\u06A9\u0648\u0646\u062F\u06CC\u0644 \u0645\u062F\u06CC\u0627\u0644 \u0648 claw hand \u0645\u0631\u062A\u0628\u0637 \u0627\u0633\u062A." },
        { index: 3, text: "\u0645\u0648\u0633\u06A9\u0648\u0644\u0648\u06A9\u0648\u062A\u0627\u0646\u0626\u0648\u0633 \u0635\u0631\u0641\u0627\u064B \u0641\u0644\u06A9\u0633\u0648\u0631\u0647\u0627\u06CC \u0628\u0627\u0632\u0648 \u0631\u0627 \u0639\u0635\u0628\u200C\u062F\u0647\u06CC \u0645\u06CC\u200C\u06A9\u0646\u062F." }
      ]
    },
    stats: { solves: 3988, correctPercent: 76, optionPercents: [6, 5, 76, 13], avgTimeSec: 25, difficultyIndex: 0.76 },
    createdAt: "2025-12-02",
    updatedAt: "2026-07-08"
  },
  {
    id: "tb-ana-03",
    track: "medicine",
    subject: "anatomy",
    topicPath: ["\u0627\u0646\u062F\u0627\u0645 \u0641\u0648\u0642\u0627\u0646\u06CC", "\u0627\u0633\u062A\u062E\u0648\u0627\u0646\u200C\u0634\u0646\u0627\u0633\u06CC"],
    type: "memorization",
    difficulty: "medium",
    year: 1400,
    source: "official",
    tags: [],
    stem: "\u0633\u0627\u06CC\u062A\u06CC \u06A9\u0647 \u0634\u06A9\u0633\u062A\u06AF\u06CC \u0622\u0646 \u0628\u06CC\u0634\u062A\u0631\u06CC\u0646 \u062E\u0637\u0631 \u0622\u0633\u06CC\u0628 \u0628\u0647 \u0639\u0635\u0628 \u0622\u06AF\u0632\u06CC\u0644\u0627\u0631\u06CC \u0631\u0627 \u062F\u0627\u0631\u062F \u06A9\u062F\u0627\u0645 \u0627\u0633\u062A\u061F",
    figure: null,
    options: [
      "\u0622\u0646\u0627\u062A\u0648\u0645\u06CC\u06A9\u0627\u0644 \u0646\u06A9 \u0647\u06CC\u0648\u0645\u0631\u0648\u0633",
      "\u0633\u0648\u0631\u062C\u06CC\u06A9\u0627\u0644 \u0646\u06A9 \u0647\u06CC\u0648\u0645\u0631\u0648\u0633",
      "\u06AF\u0631\u06CC\u062A \u062A\u06CC\u0648\u0628\u0631\u0648\u0632\u06CC\u062A\u06CC",
      "\u06A9\u0644\u0645\u0647\u0654 \u067E\u0631\u0648\u06AF\u0632\u06CC\u0645\u0627\u0644 \u0647\u06CC\u0648\u0645\u0631\u0648\u0633 \u062F\u0631 \u0628\u0686\u0647\u200C\u0647\u0627"
    ],
    correctAnswer: 2,
    explanation: {
      summary: "\u0634\u06A9\u0633\u062A\u06AF\u06CC \u06AF\u0631\u06CC\u062A \u062A\u06CC\u0648\u0628\u0631\u0648\u0632\u06CC\u062A\u06CC (\u062C\u0627\u06CC \u0627\u062A\u0635\u0627\u0644 \u0633\u0648\u067E\u0631\u0627- \u0648 \u0627\u06CC\u0646\u0641\u0631\u0627\u0627\u0633\u067E\u06CC\u0646\u0627\u062A\u0648\u0633) \u0628\u06CC\u0634\u062A\u0631\u06CC\u0646 \u062E\u0637\u0631 \u0622\u0633\u06CC\u0628 \u0639\u0635\u0628 \u0622\u06AF\u0632\u06CC\u0644\u0627\u0631\u06CC \u0631\u0627 \u062F\u0627\u0631\u062F.",
      deep: "\u0639\u0635\u0628 \u0622\u06AF\u0632\u06CC\u0644\u0627\u0631\u06CC \u0628\u0627 \u0639\u0631\u0648\u0642 \u0627\u0637\u0631\u0627\u0641 \u0627\u0632 \u0641\u0636\u0627\u06CC \u0686\u0647\u0627\u0631\u0636\u0644\u0639\u06CC \u0639\u0628\u0648\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F \u0648 \u0628\u0647 \u062F\u0648\u0631 \u06AF\u0631\u06CC\u062A \u062A\u06CC\u0648\u0628\u0631\u0648\u0632\u06CC\u062A\u06CC \u0645\u06CC\u200C\u062E\u0648\u0627\u0628\u062F\u061B \u062F\u0631 \u0627\u06CC\u0646 \u0634\u06A9\u0633\u062A\u06AF\u06CC (\u06CC\u0627 \u062F\u06CC\u0633\u0644\u0648\u06A9\u06CC\u0634\u0646 \u06AF\u0644\u0646\u0648\u0647\u0648\u0645\u0631\u0627\u0644)\u060C \u0627\u06CC\u0646 \u0639\u0635\u0628 \u0622\u0633\u06CC\u0628 \u0645\u06CC\u200C\u0628\u06CC\u0646\u062F \u0648 \u062F\u0644\u062A\u0648\u0626\u06CC\u062F + \u062A\u0631\u06CC\u0633 \u0645\u06CC\u0646\u0648\u0631 \u0636\u0639\u06CC\u0641 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F (\u062D\u0633 \u0646\u0627\u062D\u06CC\u0647\u0654 \xAB\u067E\u06A9\u06CC\u0646\u06AF \u0644\u0650\u06CC\u0628\u0644\xBB \u0628\u0627\u0632\u0648).",
      keyPoint: "\u06AF\u0631\u06CC\u062A \u062A\u06CC\u0648\u0628\u0631\u0648\u0632\u06CC\u062A\u06CC + \u062F\u06CC\u0633\u0644\u0648\u06A9\u06CC\u0634\u0646 \u0634\u0627\u0646\u0647 \u2192 \u0622\u06AF\u0632\u06CC\u0644\u0627\u0631\u06CC \u0631\u0627 \u0647\u0645\u06CC\u0634\u0647 \u0686\u06A9 \u06A9\u0646.",
      trap: "\u0633\u0648\u0631\u062C\u06CC\u06A9\u0627\u0644 \u0646\u06A9 \u0628\u06CC\u0634\u062A\u0631 \u0628\u0627 \u0639\u0635\u0628 \u0631\u0627\u062F\u06CC\u0627\u0644\u061F \u0646\u0647 \u2014 \u0633\u0648\u0631\u062C\u06CC\u06A9\u0627\u0644 \u0646\u06A9 \u0634\u0627\u06CC\u0639\u200C\u062A\u0631\u06CC\u0646 \u0634\u06A9\u0633\u062A\u06AF\u06CC \u067E\u0631\u0648\u06AF\u0632\u06CC\u0645\u0627\u0644 \u0647\u06CC\u0648\u0645\u0631\u0648\u0633 \u062F\u0631 \u0633\u0627\u0644\u062E\u0648\u0631\u062F\u06AF\u0627\u0646 \u0627\u0633\u062A\u060C \u0648\u0644\u06CC \u0639\u0635\u0628 \u0622\u06AF\u0632\u06CC\u0644\u0627\u0631\u06CC \u0645\u062E\u062A\u0635 \u06AF\u0631\u06CC\u062A \u062A\u06CC\u0648\u0628\u0631\u0648\u0632\u06CC\u062A\u06CC \u0627\u0633\u062A.",
      whyWrong: [
        { index: 0, text: "\u0634\u06A9\u0633\u062A\u06AF\u06CC \u0622\u0646\u0627\u062A\u0648\u0645\u06CC\u06A9\u0627\u0644 \u0646\u06A9 \u062E\u0637\u0631 \u0646\u06A9\u0631\u0648\u0632 \u0622\u0648\u0633\u06A9\u0648\u0644\u0627\u0631 \u062F\u0627\u0631\u062F\u060C \u0646\u0647 \u0622\u0633\u06CC\u0628 \u0622\u06AF\u0632\u06CC\u0644\u0627\u0631\u06CC." },
        { index: 1, text: "\u0633\u0648\u0631\u062C\u06CC\u06A9\u0627\u0644 \u0646\u06A9 \u0634\u0627\u06CC\u0639 \u0627\u0633\u062A \u0627\u0645\u0627 \u0639\u0635\u0628 \u062E\u0627\u0635\u06CC \u0631\u0627 \u062A\u0647\u062F\u06CC\u062F \u0646\u0645\u06CC\u200C\u06A9\u0646\u062F." },
        { index: 3, text: "\u062F\u0631 \u06A9\u0648\u062F\u06A9\u0627\u0646\u060C \u0641\u06CC\u0632\u06CC\u0633 \u067E\u0631\u0648\u06AF\u0632\u06CC\u0645\u0627\u0644 \u062C\u0627\u06CC \u0634\u06A9\u0633\u062A\u06AF\u06CC \u0627\u0633\u062A\u061B \u0627\u0631\u062A\u0628\u0627\u0637 \u0628\u0627 \u0622\u06AF\u0632\u06CC\u0644\u0627\u0631\u06CC \u0636\u0639\u06CC\u0641\u200C\u062A\u0631 \u0627\u0633\u062A." }
      ]
    },
    stats: { solves: 2143, correctPercent: 52, optionPercents: [17, 22, 52, 9], avgTimeSec: 37, difficultyIndex: 0.52 },
    createdAt: "2025-10-15",
    updatedAt: "2026-06-25"
  },
  {
    id: "tb-ana-04",
    track: "medicine",
    subject: "anatomy",
    topicPath: ["\u0642\u0644\u0628 \u0648 \u062A\u0648\u0631\u0627\u06A9\u0633", "\u0622\u0646\u0627\u062A\u0648\u0645\u06CC \u0642\u0644\u0628"],
    type: "memorization",
    difficulty: "easy",
    year: 1399,
    source: "official",
    tags: [],
    stem: "\u0633\u0627\u062E\u062A\u0627\u0631\u06CC \u06A9\u0647 \u062F\u0631 \u0646\u0645\u0627\u06CC \u0622\u0646\u062A\u0631\u06CC\u0631 \u0642\u0644\u0628\u060C \u062F\u0631 \u0645\u0631\u0632 \u0628\u06CC\u0646 \u062F\u0647\u0644\u06CC\u0632 \u0631\u0627\u0633\u062A \u0648 \u0628\u0637\u0646 \u0631\u0627\u0633\u062A \u0642\u0631\u0627\u0631 \u062F\u0627\u0631\u062F \u0648 \u062F\u0631\u06CC\u0686\u0647\u0654 \u0633\u0647\u200C\u0644\u062E\u062A\u06CC \u0631\u0627 \u0646\u06AF\u0647 \u0645\u06CC\u200C\u062F\u0627\u0631\u062F\u060C \u062F\u0631 \u06A9\u062F\u0627\u0645 \u0646\u0627\u062D\u06CC\u0647 \u0627\u0633\u062A\u061F",
    figure: null,
    options: [
      "\u06AF\u0631\u0647\u0654 \u0633\u06CC\u0646\u0648\u0633\u06CC-\u062F\u0647\u0644\u06CC\u0632\u06CC",
      "\u0633\u0648\u0644\u06A9\u0648\u0633 \u06A9\u0631\u0648\u0646\u0627\u0631\u06CC (AV \u06AF\u0631\u0648\u0648)",
      "\u0627\u06CC\u0646\u062A\u0631\u0648\u0646\u062A\u0631\u06CC\u06A9\u0648\u0644\u0627\u0631 \u0622\u0646\u062A\u0631\u06CC\u0631",
      "\u0646\u0627\u0686 \u0622\u067E\u06CC\u06A9\u0627\u0644"
    ],
    correctAnswer: 1,
    explanation: {
      summary: "\u0633\u0648\u0644\u06A9\u0648\u0633 \u06A9\u0631\u0648\u0646\u0627\u0631\u06CC (\u0634\u06CC\u0627\u0631 \u062F\u0647\u0644\u06CC\u0632\u06CC-\u0628\u0637\u0646\u06CC) \u0645\u0631\u0632 \u062F\u0647\u0644\u06CC\u0632 \u0648 \u0628\u0637\u0646 \u0627\u0633\u062A \u0648 \u0634\u0631\u06CC\u0627\u0646\u200C\u0647\u0627\u06CC \u06A9\u0631\u0648\u0646\u0631\u06CC \u0631\u0627 \u062F\u0631 \u062E\u0648\u062F \u062C\u0627\u06CC \u0645\u06CC\u200C\u062F\u0647\u062F.",
      deep: "\u0631\u0648\u06CC \u0633\u0637\u062D \u0622\u0646\u062A\u0631\u06CC\u0631 \u0642\u0644\u0628\u060C \u0634\u06CC\u0627\u0631 AV \u062D\u0627\u0648\u06CC \u0634\u0631\u06CC\u0627\u0646 \u06A9\u0631\u0648\u0646\u0631\u06CC \u0631\u0627\u0633\u062A \u0627\u0633\u062A \u0648 \u062F\u0631\u06CC\u0686\u0647\u200C\u0647\u0627\u06CC AV \u0627\u0632 \u0627\u0633\u06A9\u0644\u062A \u0641\u06CC\u0628\u0631\u06CC \u0642\u0644\u0628 \u062F\u0631 \u0647\u0645\u06CC\u0646 \u062A\u0631\u0627\u0632 \u0622\u0648\u06CC\u0632\u0627\u0646\u0646\u062F. \u0634\u06CC\u0627\u0631 \u0627\u06CC\u0646\u062A\u0631\u0648\u0646\u062A\u0631\u06CC\u06A9\u0648\u0644\u0627\u0631 \u0622\u0646\u062A\u0631\u06CC\u0631 \u0645\u0631\u0632 \u062F\u0648 \u0628\u0637\u0646 \u0627\u0633\u062A \u0648 \u0634\u0627\u062E\u0647\u0654 LAD \u062F\u0631 \u0622\u0646 \u062C\u0627\u0631\u06CC\u0633\u062A.",
      keyPoint: "AV \u06AF\u0631\u0648\u0648 = \u0645\u0631\u0632 \u062F\u0647\u0644\u06CC\u0632/\u0628\u0637\u0646 + \u0634\u0631\u06CC\u0627\u0646 \u06A9\u0631\u0648\u0646\u0631\u06CC \u0631\u0627\u0633\u062A | IVD \u0622\u0646\u062A\u0631\u06CC\u0631 = \u0645\u0631\u0632 \u0628\u0637\u0646\u200C\u0647\u0627 + LAD.",
      trap: "\u06AF\u0631\u0648\u0648 \u0627\u06CC\u0646\u062A\u0631\u0648\u0646\u062A\u0631\u06CC\u06A9\u0648\u0644\u0627\u0631 \u0622\u0646\u062A\u0631\u06CC\u0631 \u0628\u0627 AV \u06AF\u0631\u0648\u0648 \u0639\u0645\u0648\u062F \u0627\u0633\u062A \u0648 \u0645\u0631\u0632 \u062F\u0647\u0644\u06CC\u0632\u06CC \u0646\u06CC\u0633\u062A.",
      whyWrong: [
        { index: 0, text: "\u06AF\u0631\u0647\u0654 \u0633\u06CC\u0646\u0648\u0633\u06CC-\u062F\u0647\u0644\u06CC\u0632\u06CC \u0633\u0627\u062E\u062A\u0627\u0631\u06CC \u062F\u0631 \u062F\u06CC\u0648\u0627\u0631\u0647\u0654 \u062F\u0647\u0644\u06CC\u0632 \u0631\u0627\u0633\u062A \u0627\u0633\u062A\u060C \u0646\u0647 \u0641\u0631\u0648\u0631\u0641\u062A\u06AF\u06CC \u0633\u0637\u062D\u06CC." },
        { index: 2, text: "\u0627\u06CC\u0646 \u06AF\u0631\u0648\u0648 \u0645\u0631\u0632 \u0628\u06CC\u0646 \u0628\u0637\u0646\u200C\u0647\u0627\u0633\u062A." },
        { index: 3, text: "\u0646\u0627\u0686 \u0622\u067E\u06CC\u06A9\u0627\u0644 \u0633\u0631 \u0646\u0648\u06A9 \u0642\u0644\u0628 \u0627\u0633\u062A\u060C \u0646\u0647 \u0646\u0627\u062D\u06CC\u0647\u0654 \u062F\u0631\u06CC\u0686\u0647." }
      ]
    },
    stats: { solves: 2876, correctPercent: 68, optionPercents: [11, 68, 17, 4], avgTimeSec: 27, difficultyIndex: 0.68 },
    createdAt: "2025-11-19",
    updatedAt: "2026-07-01"
  },
  {
    id: "tb-ana-05",
    track: "medicine",
    subject: "anatomy",
    topicPath: ["\u0642\u0644\u0628 \u0648 \u062A\u0648\u0631\u0627\u06A9\u0633", "\u062F\u06CC\u0627\u0641\u0631\u0627\u06AF\u0645"],
    type: "memorization",
    difficulty: "easy",
    year: 1398,
    source: "official",
    tags: ["\u067E\u0631\u062A\u06A9\u0631\u0627\u0631"],
    stem: "\u0639\u0635\u0628 \u062D\u0631\u06A9\u062A\u06CC \u062F\u06CC\u0627\u0641\u0631\u0627\u06AF\u0645 \u0627\u0632 \u06A9\u062F\u0627\u0645 \u0631\u06CC\u0634\u0647\u200C\u0647\u0627\u06CC \u0646\u062E\u0627\u0639\u06CC \u0645\u0646\u0634\u0623 \u0645\u06CC\u200C\u06AF\u06CC\u0631\u062F\u061F",
    figure: null,
    options: ["C3-C4-C5", "C5-C6-C7", "T1-T4", "C6-C7-C8"],
    correctAnswer: 0,
    explanation: {
      summary: "\u0639\u0635\u0628 \u0641\u0631\u0646\u06CC\u06A9 \u0627\u0632 \u0631\u06CC\u0634\u0647\u200C\u0647\u0627\u06CC C3-C4-C5 \u062A\u0634\u06A9\u06CC\u0644 \u0645\u06CC\u200C\u0634\u0648\u062F\u061B \u0639\u0628\u0627\u0631\u062A \u06CC\u0627\u062F\u06AF\u0627\u0631\u06CC \xABC3, 4, 5 keeps the diaphragm alive\xBB.",
      deep: "\u0641\u0631\u0646\u06CC\u06A9 \u0627\u0632 \u067E\u0644\u06A9\u0633\u0648\u0633 \u06AF\u0631\u062F\u0646\u06CC \u0628\u06CC\u0631\u0648\u0646 \u0645\u06CC\u200C\u0622\u06CC\u062F\u060C \u0627\u0632 \u0645\u06CC\u0627\u0646 \u0645\u062F\u06CC\u0627\u0633\u062A\u06CC\u0646 \u0628\u0647 \u067E\u0627\u06CC\u06CC\u0646 \u0645\u06CC\u200C\u0631\u0648\u062F \u0648 \u0646\u0647 \u062A\u0646\u0647\u0627 \u062D\u0631\u06A9\u062A \u062F\u06CC\u0627\u0641\u0631\u0627\u06AF\u0645 \u0631\u0627 \u062A\u0623\u0645\u06CC\u0646 \u0645\u06CC\u200C\u06A9\u0646\u062F\u060C \u0628\u0644\u06A9\u0647 \u062D\u0633 \u067E\u0631\u06CC\u06A9\u0627\u0631\u062F \u0648 \u067E\u0644\u0648\u0631 \u0645\u0631\u06A9\u0632\u06CC \u0631\u0627 \u0647\u0645 \u0645\u06CC\u200C\u062F\u0647\u062F. \u0622\u0633\u06CC\u0628 \u0622\u0646 (\u0645\u062B\u0644\u0627\u064B \u062F\u0631 \u062C\u0631\u0627\u062D\u06CC \u06AF\u0631\u062F\u0646 \u06CC\u0627 \u062A\u0648\u0645\u0648\u0631 \u0645\u062F\u06CC\u0627\u0633\u062A\u06CC\u0646) \u0641\u0644\u062C \u062A\u06A9\u200C\u0637\u0631\u0641\u06CC \u062F\u06CC\u0627\u0641\u0631\u0627\u06AF\u0645 \u0645\u06CC\u200C\u062F\u0647\u062F.",
      keyPoint: "\u0641\u0631\u0646\u06CC\u06A9 = C3-C4-C5 | \u062D\u0633 \u067E\u0631\u06CC\u200C\u06A9\u0627\u0631\u062F + \u067E\u0644\u0648\u0631 \u0645\u0631\u06A9\u0632\u06CC | \u062D\u0631\u06A9\u062A\u06CC \u062F\u06CC\u0627\u0641\u0631\u0627\u06AF\u0645.",
      trap: "\u062D\u0633 \u067E\u0631\u06CC\u0641\u0631\u0627\u0644 \u067E\u0644\u0648\u0631 \u0627\u0632 \u0627\u06CC\u0646\u062A\u0631\u06A9\u0648\u0633\u062A\u0627\u0644 \u0627\u0633\u062A\u061B \u0641\u0631\u0646\u06CC\u06A9 \u0641\u0642\u0637 \u0628\u062E\u0634 \u0645\u0631\u06A9\u0632\u06CC \u0631\u0627 \u0639\u0635\u0628\u200C\u062F\u0647\u06CC \u0645\u06CC\u200C\u06A9\u0646\u062F.",
      whyWrong: [
        { index: 1, text: "C5-C6-C7 \u0631\u06CC\u0634\u0647\u200C\u0647\u0627\u06CC \u067E\u0644\u06A9\u0633\u0648\u0633 \u0628\u0631\u0627\u06A9\u06CC\u0627\u0644 \u0631\u0627 \u0645\u06CC\u200C\u0633\u0627\u0632\u0646\u062F." },
        { index: 2, text: "\u0627\u06CC\u0646\u062A\u0631\u06A9\u0648\u0633\u062A\u0627\u0644\u200C\u0647\u0627 \u062D\u0633 \u062C\u0627\u0646\u0628\u06CC \u067E\u0644\u0648\u0631 \u0648 \u062F\u06CC\u0648\u0627\u0631\u0647\u0654 \u062A\u0648\u0631\u0627\u06A9\u0633 \u0631\u0627 \u0645\u06CC\u200C\u062F\u0647\u0646\u062F." },
        { index: 3, text: "C6-C8 \u0639\u0645\u062F\u062A\u0627\u064B \u0627\u0646\u062F\u0627\u0645 \u0641\u0648\u0642\u0627\u0646\u06CC \u0631\u0627 \u0639\u0635\u0628\u200C\u062F\u0647\u06CC \u0645\u06CC\u200C\u06A9\u0646\u0646\u062F." }
      ]
    },
    stats: { solves: 5432, correctPercent: 84, optionPercents: [84, 6, 6, 4], avgTimeSec: 18, difficultyIndex: 0.84 },
    createdAt: "2025-08-30",
    updatedAt: "2026-06-05"
  },
  {
    id: "tb-ana-06",
    track: "medicine",
    subject: "anatomy",
    topicPath: ["\u0627\u0646\u062F\u0627\u0645 \u062A\u062D\u062A\u0627\u0646\u06CC", "\u0627\u0639\u0635\u0627\u0628 \u0627\u0646\u062F\u0627\u0645 \u062A\u062D\u062A\u0627\u0646\u06CC"],
    type: "clinical",
    difficulty: "medium",
    year: 1400,
    source: "comprehensive",
    tags: [],
    stem: "\u0628\u0639\u062F \u0627\u0632 \u0634\u06A9\u0633\u062A\u06AF\u06CC \u0646\u06A9 \u0641\u06CC\u0628\u0648\u0644\u0627\u060C \u0641\u0631\u062F\u06CC \u0646\u0627\u062A\u0648\u0627\u0646\u06CC \u062F\u0631 \u062F\u0648\u0631\u0633\u0641\u0644\u06A9\u0634\u0646 \u067E\u0627 \u0648 \u0627\u0641\u062A\u0627\u062F\u06AF\u06CC \u067E\u0627 (Foot Drop) \u062F\u0627\u0631\u062F. \u06A9\u062F\u0627\u0645 \u0639\u0635\u0628 \u0622\u0633\u06CC\u0628 \u062F\u06CC\u062F\u0647 \u0627\u0633\u062A\u061F",
    figure: null,
    options: [
      "\u0639\u0635\u0628 \u062A\u06CC\u0628\u06CC\u0627\u0644",
      "\u0639\u0635\u0628 \u0641\u06CC\u0628\u06CC\u0627\u0644 \u06A9\u0627\u0645\u0648\u0646 (\u0639\u0635\u0628 \u067E\u0631\u06CC\u0648\u0646\u0626\u0627\u0644 \u06A9\u0627\u0645\u0648\u0646)",
      "\u0639\u0635\u0628 \u0641\u0645\u0648\u0631\u0627\u0644",
      "\u0639\u0635\u0628 \u0627\u0628\u062A\u0631\u062A\u0648\u0631"
    ],
    correctAnswer: 1,
    explanation: {
      summary: "\u0639\u0635\u0628 \u0641\u06CC\u0628\u06CC\u0627\u0644 \u06A9\u0627\u0645\u0648\u0646 \u06A9\u0647 \u062F\u0648\u0631 \u0646\u06A9 \u0641\u06CC\u0628\u0648\u0644\u0627 \u0645\u06CC\u200C\u062E\u0648\u0627\u0628\u062F\u060C \u0622\u0633\u06CC\u0628\u200C\u067E\u0630\u06CC\u0631\u062A\u0631\u06CC\u0646 \u0639\u0635\u0628 \u0627\u0646\u062F\u0627\u0645 \u062A\u062D\u062A\u0627\u0646\u06CC \u062F\u0631 \u0627\u06CC\u0646 \u0646\u0627\u062D\u06CC\u0647 \u0627\u0633\u062A\u061B \u0641\u0644\u062C \u062F\u0648\u0631\u0633\u200C\u0641\u0644\u06A9\u0633\u0648\u0631\u0647\u0627 \u2192 foot drop.",
      deep: "\u0627\u06CC\u0646 \u0639\u0635\u0628 \u062F\u0631 \u067E\u0634\u062A \u0633\u0631 \u0641\u06CC\u0628\u0648\u0644\u0627 \u062A\u0646\u0647\u0627 \u0632\u06CC\u0631 \u067E\u0648\u0633\u062A \u0648 \u0641\u0627\u0633\u06CC\u0627\u0633\u062A\u061B \u0641\u0634\u0631\u062F\u06AF\u06CC \u0637\u0648\u0644\u0627\u0646\u06CC (\u0646\u0634\u0633\u062A\u0646 \u0628\u0627 \u067E\u0627 \u0631\u0648\u06CC \u067E\u0627\u060C \u06AF\u0686 \u0646\u0627\u0645\u0646\u0627\u0633\u0628) \u06CC\u0627 \u0634\u06A9\u0633\u062A\u06AF\u06CC \u0646\u06A9 \u0641\u06CC\u0628\u0648\u0644\u0627 \u0622\u0646 \u0631\u0627 \u0645\u06CC\u200C\u06AF\u06CC\u0631\u062F. \u062A\u06CC\u0628\u06CC\u0627\u0644\u06CC\u0633 \u0622\u0646\u062A\u0631\u06CC\u0631 \u0648 \u0627\u06A9\u0633\u062A\u0646\u0633\u0648\u0631\u0647\u0627\u06CC \u0627\u0646\u06AF\u0634\u062A\u0627\u0646 \u0641\u0644\u062C \u0645\u06CC\u200C\u0634\u0648\u0646\u062F \u0648 \u0641\u0631\u062F \u062F\u0631 \u0641\u0627\u0632 \u0633\u0648\u06CC\u06CC\u0646\u06AF \u0631\u0627\u0647 \u0631\u0641\u062A\u0646 \u067E\u0627 \u0631\u0627 \u0628\u0627\u0644\u0627 \u0646\u0645\u06CC\u200C\u0628\u0631\u062F.",
      keyPoint: "\u0646\u06A9 \u0641\u06CC\u0628\u0648\u0644\u0627 \u2192 \u0641\u06CC\u0628\u06CC\u0627\u0644 \u06A9\u0627\u0645\u0648\u0646 | \u067E\u0634\u062A \u0645\u062F\u06CC\u0627\u0644 \u0645\u0627\u0644\u0626\u0648\u0644 \u2192 \u062A\u06CC\u0628\u06CC\u0627\u0644.",
      trap: "\u0639\u0635\u0628 \u062A\u06CC\u0628\u06CC\u0627\u0644 \u0641\u0644\u062C \u067E\u0644\u0627\u0646\u062A\u0627\u0631\u0641\u0644\u06A9\u0633\u0648\u0631 \u0645\u06CC\u200C\u062F\u0647\u062F (\u0641\u0631\u062F \u0631\u0648\u06CC \u067E\u0646\u062C\u0647 \u0631\u0627\u0647 \u0645\u06CC\u200C\u0631\u0648\u062F)\u060C \u0639\u06A9\u0633 \u0627\u06CC\u0646 \u062A\u0635\u0648\u06CC\u0631.",
      whyWrong: [
        { index: 0, text: "\u062A\u06CC\u0628\u06CC\u0627\u0644 \u067E\u0644\u0627\u0646\u062A\u0627\u0631\u0641\u0644\u06A9\u0634\u0646 \u0648 \u0627\u06CC\u0646\u0648\u0631\u0634\u0646 \u0631\u0627 \u06A9\u0646\u062A\u0631\u0644 \u0645\u06CC\u200C\u06A9\u0646\u062F." },
        { index: 2, text: "\u0641\u0645\u0648\u0631\u0627\u0644 \u0627\u06A9\u0633\u062A\u0646\u0634\u0646 \u0632\u0627\u0646\u0648 \u0631\u0627 \u0645\u06CC\u200C\u062F\u0647\u062F (\u0636\u0627\u06CC\u0639\u0647: \u0646\u0627\u062A\u0648\u0627\u0646\u06CC \u062F\u0631 \u0627\u06CC\u0633\u062A\u0627\u062F\u0646 \u0627\u0632 \u0646\u0634\u0633\u062A\u0647)." },
        { index: 3, text: "\u0627\u0628\u062A\u0631\u062A\u0648\u0631 \u0627\u062F\u0648\u06A9\u0634\u0646 \u0631\u0627\u0646 \u0631\u0627 \u0645\u06CC\u200C\u062F\u0647\u062F." }
      ]
    },
    stats: { solves: 3712, correctPercent: 74, optionPercents: [9, 74, 8, 9], avgTimeSec: 26, difficultyIndex: 0.74 },
    createdAt: "2025-10-25",
    updatedAt: "2026-07-04"
  },
  {
    id: "tb-ana-07",
    track: "medicine",
    subject: "anatomy",
    topicPath: ["\u0634\u06A9\u0645 \u0648 \u0644\u06AF\u0646", "\u06A9\u0627\u0646\u0627\u0644 \u0627\u06CC\u0646\u06AF\u0648\u06CC\u0646\u0627\u0644"],
    type: "memorization",
    difficulty: "hard",
    year: 1403,
    source: "official",
    tags: ["\u067E\u0631\u062A\u06A9\u0631\u0627\u0631"],
    stem: "\u062F\u06CC\u0648\u0627\u0631\u0647\u0654 \u062E\u0644\u0641\u06CC \u06A9\u0627\u0646\u0627\u0644 \u0627\u06CC\u0646\u06AF\u0648\u06CC\u0646\u0627\u0644 \u0628\u0647\u200C\u062A\u0631\u062A\u06CC\u0628 \u0627\u0632 \u0628\u0627\u0644\u0627 \u0628\u0647 \u067E\u0627\u06CC\u06CC\u0646 \u0627\u0632 \u0686\u0647 \u0633\u0627\u062E\u062A\u0627\u0631\u0647\u0627\u06CC\u06CC \u062A\u0634\u06A9\u06CC\u0644 \u0634\u062F\u0647 \u0627\u0633\u062A\u061F",
    figure: null,
    options: [
      "\u0622\u067E\u0648\u0646\u0648\u0631\u0648\u0632 \u062A\u0631\u0627\u0646\u0633\u0648\u0633\u0648\u0633 \u0627\u0628\u062F\u0648\u0645\u06CC\u0646\u06CC\u0633 \u0648 \u0641\u0627\u0633\u06CC\u0627\u06CC \u062A\u0631\u0627\u0646\u0633\u0648\u0631\u0633\u0627\u0644\u06CC\u0633",
      "\u0639\u0635\u0628 \u0627\u06CC\u0644\u0648\u06CC\u0646\u06AF\u0648\u06CC\u0646\u0627\u0644 \u0648 \u0641\u0627\u0633\u06CC\u0627\u06CC \u062A\u0631\u0627\u0646\u0633\u0648\u0631\u0633\u0627\u0644\u06CC\u0633",
      "\u0644\u06CC\u06AF\u0627\u0645\u0627\u0646 \u0627\u06CC\u0646\u06AF\u0648\u06CC\u0646\u0627\u0644 \u0648 \u0639\u0636\u0644\u0647\u0654 \u0631\u06A9\u062A\u0648\u0633 \u0627\u0628\u062F\u0648\u0645\u06CC\u0646\u06CC\u0633",
      "\u0631\u06CC\u0646\u06AF \u0627\u06CC\u0646\u06AF\u0648\u06CC\u0646\u0627\u0644 \u0633\u0637\u062D\u06CC \u0648 \u0641\u0627\u0633\u06CC\u0627 \u0627\u0633\u067E\u0631\u0645\u0627\u062A\u06CC\u06A9"
    ],
    correctAnswer: 0,
    explanation: {
      summary: "\u062F\u06CC\u0648\u0627\u0631\u0647\u0654 \u062E\u0644\u0641\u06CC \u06A9\u0627\u0646\u0627\u0644\u060C \u0622\u067E\u0648\u0646\u0648\u0631\u0648\u0632 \u062A\u0631\u0627\u0646\u0633\u0648\u0633\u0648\u0633 \u0627\u0628\u062F\u0648\u0645\u06CC\u0646\u06CC\u0633 \u0648 \u0641\u0627\u0633\u06CC\u0627\u06CC \u062A\u0631\u0627\u0646\u0633\u0648\u0631\u0633\u0627\u0644\u06CC\u0633 \u0627\u0633\u062A.",
      deep: "\u06A9\u0627\u0646\u0627\u0644 \u0627\u06CC\u0646\u06AF\u0648\u06CC\u0646\u0627\u0644 \u0686\u0647\u0627\u0631 \u062F\u06CC\u0648\u0627\u0631\u0647 \u062F\u0627\u0631\u062F: \u0622\u0646\u062A\u0631\u06CC\u0631 = \u0622\u067E\u0648\u0646\u0648\u0631\u0648\u0632 \u0627\u06A9\u0633\u062A\u0631\u0646\u0627\u0644 \u0627\u0628\u0644\u06CC\u06A9\u060C \u062E\u0644\u0641\u06CC = \u062A\u0631\u0627\u0646\u0633\u0648\u0631\u0633\u0627\u0644\u06CC\u0633 + \u0622\u067E\u0648\u0646\u0648\u0631\u0648\u0632 \u062A\u0631\u0627\u0646\u0633\u0648\u0633\u0648\u0633\u060C \u0633\u0642\u0641 = \u0627\u0644\u06CC\u0627\u0641 \u067E\u0627\u06CC\u06CC\u0646\u200C\u0631\u0648\u0646\u062F\u0647\u0654 \u0627\u06A9\u0633\u062A\u0631\u0646\u0627\u0644 \u0648 \u0627\u06CC\u0646\u062A\u0631\u0646\u0627\u0644 \u0627\u0628\u0644\u06CC\u06A9\u060C \u06A9\u0641 = \u0644\u06CC\u06AF\u0627\u0645\u0627\u0646 \u0627\u06CC\u0646\u06AF\u0648\u06CC\u0646\u0627\u0644. \u0636\u0639\u0641 \u062F\u06CC\u0648\u0627\u0631\u0647\u0654 \u062E\u0644\u0641\u06CC\u060C \u067E\u0627\u06CC\u0647\u0654 \u0647\u0631\u0646\u06CC\u0627\u06CC \u0645\u0633\u062A\u0642\u06CC\u0645 \u0627\u0633\u062A.",
      keyPoint: "\u0647\u0631\u0646\u06CC\u0627\u06CC \u0645\u0633\u062A\u0642\u06CC\u0645 \u0627\u0632 \u062F\u06CC\u0648\u0627\u0631\u0647\u0654 \u062E\u0644\u0641\u06CC (\u0647\u0627\u0633\u0644\u200C\u0628\u0627\u062E \u0645\u062B\u0644\u062B) \u0628\u06CC\u0631\u0648\u0646 \u0645\u06CC\u200C\u0632\u0646\u062F\u061B \u063A\u06CC\u0631\u0645\u0633\u062A\u0642\u06CC\u0645 \u0627\u0632 \u0631\u06CC\u0646\u06AF \u062F\u0627\u062E\u0644\u06CC.",
      trap: "\u0641\u0627\u0633\u06CC\u0627\u06CC \u062A\u0631\u0627\u0646\u0633\u0648\u0631\u0633\u0627\u0644\u06CC\u0633 \u0628\u0647 \u062A\u0646\u0647\u0627\u06CC\u06CC \u062F\u06CC\u0648\u0627\u0631\u0647\u0654 \u062E\u0644\u0641\u06CC \u0631\u0627 \u06A9\u0627\u0645\u0644 \u0646\u0645\u06CC\u200C\u06A9\u0646\u062F\u061B \u0622\u067E\u0648\u0646\u0648\u0631\u0648\u0632 \u062A\u0631\u0627\u0646\u0633\u0648\u0633\u0648\u0633 \u0647\u0645 \u0646\u0642\u0634 \u062F\u0627\u0631\u062F.",
      whyWrong: [
        { index: 1, text: "\u0639\u0635\u0628 \u0627\u06CC\u0644\u0648\u06CC\u0646\u06AF\u0648\u06CC\u0646\u0627\u0644 \u0627\u0632 \u062F\u0627\u062E\u0644 \u06A9\u0627\u0646\u0627\u0644 \u0639\u0628\u0648\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F\u060C \u062F\u06CC\u0648\u0627\u0631 \u0646\u0645\u06CC\u200C\u0633\u0627\u0632\u062F." },
        { index: 2, text: "\u0644\u06CC\u06AF\u0627\u0645\u0627\u0646 \u0627\u06CC\u0646\u06AF\u0648\u06CC\u0646\u0627\u0644 \u06A9\u0641 \u06A9\u0627\u0646\u0627\u0644 \u0627\u0633\u062A." },
        { index: 3, text: "\u0631\u06CC\u0646\u06AF \u0633\u0637\u062D\u06CC \u062F\u0647\u0627\u0646\u0647\u0654 \u062E\u0631\u0648\u062C\u06CC \u06A9\u0627\u0646\u0627\u0644 \u0627\u0633\u062A \u0648 \u0641\u0627\u0633\u06CC\u0627\u06CC \u0627\u0633\u067E\u0631\u0645\u0627\u062A\u06CC\u06A9 \u067E\u0648\u0634\u0634 \u0637\u0646\u0627\u0628." }
      ]
    },
    stats: { solves: 1604, correctPercent: 47, optionPercents: [47, 13, 23, 17], avgTimeSec: 49, difficultyIndex: 0.47 },
    createdAt: "2026-03-22",
    updatedAt: "2026-08-21"
  },
  {
    id: "tb-ana-08",
    track: "medicine",
    subject: "anatomy",
    topicPath: ["\u0633\u0631 \u0648 \u06AF\u0631\u062F\u0646", "\u062A\u0631\u0627\u06CC\u06AF\u0644\u200C\u0647\u0627\u06CC \u06AF\u0631\u062F\u0646"],
    type: "concept",
    difficulty: "medium",
    year: 1402,
    source: "official",
    tags: [],
    stem: "\u0645\u062D\u062A\u0648\u0627\u06CC \u0627\u0635\u0644\u06CC \u062A\u0631\u0627\u06CC\u06AF\u0644 \u062E\u0644\u0641\u06CC \u06AF\u0631\u062F\u0646 \u06A9\u062F\u0627\u0645 \u0633\u0627\u062E\u062A\u0627\u0631\u0647\u0627 \u0647\u0633\u062A\u0646\u062F\u061F",
    figure: null,
    options: [
      "\u0639\u0635\u0628 \u0647\u06CC\u067E\u0648\u06AF\u0644\u0648\u0633 \u0648 \u063A\u062F\u0647\u0654 \u062A\u06CC\u0631\u0648\u0626\u06CC\u062F",
      "\u0639\u0635\u0628 \u0627\u0633\u067E\u06CC\u0646\u0627\u0644 \u0627\u06A9\u0633\u0633\u0648\u0631\u06CC\u060C \u0631\u06CC\u0634\u0647\u200C\u0647\u0627\u06CC \u067E\u0644\u06A9\u0633\u0648\u0633 \u0628\u0631\u0627\u06A9\u06CC\u0627\u0644 \u0648 \u0639\u0636\u0644\u0647\u0654 \u0627\u0648\u0645\u0648\u0647\u06CC\u0648\u0626\u06CC\u062F",
      "\u0639\u0635\u0628 \u0641\u0631\u0646\u06CC\u06A9 \u0648 \u0634\u0631\u06CC\u0627\u0646 \u06A9\u0627\u0631\u0648\u062A\u06CC\u062F",
      "\u063A\u062F\u0647\u0654 \u0633\u0648\u0628\u200C\u0645\u0627\u0646\u062F\u06CC\u0628\u0648\u0644\u0627\u0631 \u0648 \u0639\u0635\u0628 \u0644\u06CC\u0646\u06AF\u0648\u0627\u0644"
    ],
    correctAnswer: 1,
    explanation: {
      summary: "\u062A\u0631\u0627\u06CC\u06AF\u0644 \u062E\u0644\u0641\u06CC (\u0645\u062D\u0635\u0648\u0631 \u0628\u06CC\u0646 SCM\u060C \u062A\u0631\u0627\u067E\u0632\u06CC\u0648\u0633 \u0648 \u06A9\u0644\u0627\u0648\u06CC\u06A9\u0644) \u0639\u0635\u0628 \u0627\u0633\u067E\u06CC\u0646\u0627\u0644 \u0627\u06A9\u0633\u0633\u0648\u0631\u06CC\u060C \u0631\u06CC\u0634\u0647\u200C\u0647\u0627\u06CC \u067E\u0644\u06A9\u0633\u0648\u0633 \u0628\u0631\u0627\u06A9\u06CC\u0627\u0644 \u0648 \u0639\u0636\u0644\u0647\u0654 \u0627\u0648\u0645\u0648\u0647\u06CC\u0648\u0626\u06CC\u062F (\u062F\u0631 \u0646\u06CC\u0645\u0647\u0654 \u062A\u062D\u062A\u0627\u0646\u06CC) \u0631\u0627 \u062F\u0627\u0631\u062F.",
      deep: "\u0627\u06CC\u0646 \u062A\u0631\u0627\u06CC\u06AF\u0644 \u0628\u0627 \u0639\u0636\u0644\u0647\u0654 \u0627\u0648\u0645\u0648\u0647\u06CC\u0648\u0626\u06CC\u062F \u0628\u0647 \u062F\u0648 \u0628\u062E\u0634 \u062A\u0642\u0633\u06CC\u0645 \u0645\u06CC\u200C\u0634\u0648\u062F\u061B \u0627\u06A9\u0633\u0633\u0648\u0631\u06CC (CN XI) \u06A9\u0647 \u062A\u0631\u0627\u067E\u0632\u06CC\u0648\u0633 \u0631\u0627 \u0639\u0635\u0628\u200C\u062F\u0647\u06CC \u0645\u06CC\u200C\u06A9\u0646\u062F \u0627\u0632 \u0622\u0646 \u0639\u0628\u0648\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F \u0648 \u062F\u0631 \u0628\u06CC\u0648\u067E\u0633\u06CC \u063A\u062F\u062F \u0644\u0646\u0641\u0627\u0648\u06CC \u0622\u0633\u06CC\u0628\u200C\u067E\u0630\u06CC\u0631 \u0627\u0633\u062A.",
      keyPoint: "\u062E\u0644\u0641\u06CC = \u0627\u06A9\u0633\u0633\u0648\u0631\u06CC + \u0628\u0631\u0627\u06A9\u06CC\u0627\u0644 \u067E\u0644\u06A9\u0633\u0648\u0633 + \u0627\u0648\u0645\u0648\u0647\u06CC\u0648\u0626\u06CC\u062F | \u0622\u0646\u062A\u0631\u06CC\u0631 = \u06A9\u0627\u0631\u0648\u062A\u06CC\u062F\u060C \u062A\u06CC\u0631\u0648\u0626\u06CC\u062F\u060C \u0647\u06CC\u067E\u0648\u06AF\u0644\u0648\u0633.",
      trap: "\u0647\u06CC\u067E\u0648\u06AF\u0644\u0648\u0633 \u062F\u0631 \u062A\u0631\u0627\u06CC\u06AF\u0644 \u0622\u0646\u062A\u0631\u06CC\u0631 (\u0633\u0627\u0628\u200C\u0645\u0627\u0646\u062F\u06CC\u0628\u0648\u0644\u0627\u0631) \u062D\u0631\u06A9\u062A \u0645\u06CC\u200C\u06A9\u0646\u062F\u061B \u062F\u0631 \u062E\u0644\u0641\u06CC \u0646\u06CC\u0633\u062A.",
      whyWrong: [
        { index: 0, text: "\u062A\u06CC\u0631\u0648\u0626\u06CC\u062F \u0648 \u0647\u06CC\u067E\u0648\u06AF\u0644\u0648\u0633 \u062F\u0631 \u062A\u0631\u0627\u06CC\u06AF\u0644 \u0622\u0646\u062A\u0631\u06CC\u0631\u0646\u062F." },
        { index: 2, text: "\u0641\u0631\u0646\u06CC\u06A9 \u0631\u0648\u06CC \u0627\u0633\u06A9\u0627\u0644\u0646 \u0622\u0646\u062A\u0631\u06CC\u0631 (\u067E\u0633\u062A\u0631\u06CC\u0631 \u062A\u0631\u0627\u06CC\u06AF\u0644 \u0622\u0646\u062A\u0631\u06CC\u0631) \u0627\u0633\u062A \u0648 \u06A9\u0627\u0631\u0648\u062A\u06CC\u062F \u062F\u0631 \u0622\u0646\u062A\u0631\u06CC\u0631." },
        { index: 3, text: "\u0633\u0648\u0628\u200C\u0645\u0627\u0646\u062F\u06CC\u0628\u0648\u0644\u0627\u0631 \u0648 \u0644\u06CC\u0646\u06AF\u0648\u0627\u0644 \u0645\u0631\u0628\u0648\u0637 \u0628\u0647 \u062A\u0631\u0627\u06CC\u06AF\u0644 \u0633\u0627\u0628\u200C\u0645\u0627\u0646\u062F\u06CC\u0628\u0648\u0644\u0627\u0631 \u062F\u0631 \u0622\u0646\u062A\u0631\u06CC\u0631\u0646\u062F." }
      ]
    },
    stats: { solves: 2388, correctPercent: 59, optionPercents: [15, 59, 14, 12], avgTimeSec: 36, difficultyIndex: 0.59 },
    createdAt: "2026-01-05",
    updatedAt: "2026-07-19"
  },
  {
    id: "tb-ana-09",
    track: "medicine",
    subject: "anatomy",
    topicPath: ["\u0646\u0648\u0631\u0648\u0622\u0646\u0627\u062A\u0648\u0645\u06CC", "\u0633\u06CC\u0633\u062A\u0645 \u0628\u06CC\u0646\u0627\u06CC\u06CC"],
    type: "clinical",
    difficulty: "hard",
    year: 1404,
    source: "official",
    tags: ["\u0645\u0646\u062A\u062E\u0628"],
    stem: "\u0628\u06CC\u0645\u0627\u0631\u06CC \u0628\u0627 \u0636\u0627\u06CC\u0639\u0647\u0654 \u06A9\u0627\u0645\u0644 \u062F\u0631 \u06A9\u06CC\u0627\u0633\u0645\u0627 \u0627\u067E\u062A\u06CC\u06A9\u0648\u0645 (\u0627\u0648\u0627\u0633\u0637 \u0622\u0646) \u0645\u0631\u0627\u062C\u0639\u0647 \u06A9\u0631\u062F\u0647 \u0627\u0633\u062A. \u06A9\u062F\u0627\u0645 \u0627\u062E\u062A\u0644\u0627\u0644 \u0645\u06CC\u062F\u0627\u0646 \u0628\u06CC\u0646\u0627\u06CC\u06CC \u0627\u0646\u062A\u0638\u0627\u0631 \u0645\u06CC\u200C\u0631\u0648\u062F\u061F",
    figure: null,
    options: [
      "\u0647\u0645\u0648\u0646\u06CC\u0645\u0648\u0633 \u0647\u0645\u06CC\u200C\u0622\u0646\u0648\u067E\u06CC \u0686\u067E",
      "\u0628\u06CC\u200C\u062A\u0645\u067E\u0648\u0631\u0627\u0644 \u0647\u0645\u06CC\u200C\u0622\u0646\u0648\u067E\u06CC",
      "\u0645\u0648\u0646\u0648\u06A9\u0648\u0644\u0627\u0631 \u0628\u06CC\u0646\u0627\u06CC\u06CC \u0627\u0632 \u062F\u0633\u062A \u0631\u0641\u062A\u0647 \u062F\u0631 \u0686\u0634\u0645 \u0686\u067E",
      "\u0628\u06CC\u200C\u0646\u0627\u0632\u0627\u0644 \u0647\u0645\u06CC\u200C\u0622\u0646\u0648\u067E\u06CC"
    ],
    correctAnswer: 1,
    explanation: {
      summary: "\u0627\u0644\u06CC\u0627\u0641 \u0646\u0627\u0632\u0627\u0644 (\u06A9\u0647 \u0645\u06CC\u062F\u0627\u0646 \u062A\u0645\u067E\u0648\u0631\u0627\u0644 \u0647\u0631 \u062F\u0648 \u0686\u0634\u0645 \u0631\u0627 \u062D\u0645\u0644 \u0645\u06CC\u200C\u06A9\u0646\u0646\u062F) \u062F\u0631 \u0648\u0633\u0637 \u06A9\u06CC\u0627\u0633\u0645\u0627 \u0642\u0637\u0639 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F \u2192 \u0627\u0632 \u062F\u0633\u062A \u0631\u0641\u062A\u0646 \u0645\u06CC\u062F\u0627\u0646\u200C\u0647\u0627\u06CC \u062A\u0645\u067E\u0648\u0631\u0627\u0644 = \u0628\u06CC\u200C\u062A\u0645\u067E\u0648\u0631\u0627\u0644 \u0647\u0645\u06CC\u200C\u0622\u0646\u0648\u067E\u06CC.",
      deep: "\u0627\u0644\u06CC\u0627\u0641 \u0646\u0627\u0632\u0627\u0644 \u0634\u0628\u06A9\u06CC\u0647 \u062F\u0631 \u06A9\u06CC\u0627\u0633\u0645\u0627 \u0628\u0647 \u0637\u0631\u0641 \u0645\u0642\u0627\u0628\u0644 \u06A9\u0631\u0627\u0633 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F\u061B \u0636\u0627\u06CC\u0639\u0647\u0654 \u0648\u0633\u0637 \u06A9\u06CC\u0627\u0633\u0645\u0627 (\u0645\u0639\u0645\u0648\u0644\u0627\u064B \u0622\u062F\u0646\u0648\u0645 \u0647\u06CC\u067E\u0648\u0641\u06CC\u0632 \u06A9\u0647 \u0627\u0632 \u067E\u0627\u06CC\u06CC\u0646 \u0641\u0634\u0627\u0631 \u0645\u06CC\u200C\u0622\u0648\u0631\u062F) \u0627\u06CC\u0646 \u0627\u0644\u06CC\u0627\u0641 \u0631\u0627 \u0645\u06CC\u200C\u06AF\u06CC\u0631\u062F. \u0636\u0627\u06CC\u0639\u0647\u0654 \u0631\u0648\u0646\u062F \u0627\u067E\u062A\u06CC\u06A9 \u06CC\u06A9 \u0686\u0634\u0645 \u2192 \u0645\u0648\u0646\u0648\u06A9\u0648\u0644\u0627\u0631\u061B \u0636\u0627\u06CC\u0639\u0647\u0654 \u067E\u0633 \u0627\u0632 \u06A9\u06CC\u0627\u0633\u0645\u0627 \u2192 \u0647\u0645\u0648\u0646\u06CC\u0645\u0648\u0633 \u0647\u0645\u06CC\u200C\u0622\u0646\u0648\u067E\u06CC \u0645\u0642\u0627\u0628\u0644.",
      keyPoint: "\u06A9\u06CC\u0627\u0633\u0645\u0627 \u0648\u0633\u0637 \u2192 \u0628\u06CC\u200C\u062A\u0645\u067E\u0648\u0631\u0627\u0644 | \u0644\u0650\u0698\u06CC\u0648\u0646 \u0631\u0648\u0646\u062F \u0627\u067E\u062A\u06CC\u06A9 \u2192 \u0647\u0645\u0648\u0646\u06CC\u0645\u0648\u0633 \u06A9\u0627\u0646\u062A\u0631\u0627\u0644\u062A\u0631\u0627\u0644.",
      trap: "\u0622\u062F\u0646\u0648\u0645 \u0647\u06CC\u067E\u0648\u0641\u06CC\u0632 \u0627\u0632 \u067E\u0627\u06CC\u06CC\u0646 \u0648 \u06A9\u0631\u0627\u0646\u06CC\u0648\u0641\u0627\u0631\u06CC\u0646\u06AF\u06CC\u0648\u0645 \u0627\u0632 \u0628\u0627\u0644\u0627 \u0641\u0634\u0627\u0631 \u0645\u06CC\u200C\u0622\u0648\u0631\u062F\u061B \u0645\u062D\u0644 \u0636\u0627\u06CC\u0639\u0647\u060C \u0627\u0644\u06AF\u0648\u06CC \u0634\u0631\u0648\u0639 \u0646\u0642\u0635 \u0645\u06CC\u062F\u0627\u0646 \u0631\u0627 \u0639\u0648\u0636 \u0645\u06CC\u200C\u06A9\u0646\u062F.",
      whyWrong: [
        { index: 0, text: "\u0647\u0645\u0648\u0646\u06CC\u0645\u0648\u0633 \u0647\u0645\u06CC\u200C\u0622\u0646\u0648\u067E\u06CC \u0636\u0627\u06CC\u0639\u0647\u0654 \u067E\u0634\u062A \u06A9\u06CC\u0627\u0633\u0645\u0627 (\u0631\u0648\u0646\u062F \u0627\u067E\u062A\u06CC\u06A9\u060C \u0631\u0627\u062F\u06CC\u0627\u0633\u06CC\u0648\u0646\u060C \u06A9\u0648\u0631\u062A\u06A9\u0633) \u0627\u0633\u062A." },
        { index: 2, text: "\u0645\u0648\u0646\u0648\u06A9\u0648\u0644\u0627\u0631 \u06A9\u0627\u0645\u0644\u060C \u0636\u0627\u06CC\u0639\u0647\u0654 \u0639\u0635\u0628 \u0627\u067E\u062A\u06CC\u06A9 \u0642\u0628\u0644 \u0627\u0632 \u06A9\u06CC\u0627\u0633\u0645\u0627\u0633\u062A." },
        { index: 3, text: "\u0628\u06CC\u200C\u0646\u0627\u0632\u0627\u0644 \u0647\u0645\u06CC\u200C\u0622\u0646\u0648\u067E\u06CC \u0628\u0631\u0627\u06CC \u0627\u0644\u06CC\u0627\u0641 \u062A\u0645\u067E\u0648\u0631\u0627\u0644 (\u0628\u062F\u0648\u0646 \u06A9\u0631\u0627\u0633) \u0627\u0633\u062A \u06A9\u0647 \u062F\u0631 \u062D\u0627\u0634\u06CC\u0647\u0654 \u06A9\u06CC\u0627\u0633\u0645\u0627\u0633\u062A\u060C \u0646\u0647 \u0648\u0633\u0637 \u0622\u0646." }
      ]
    },
    stats: { solves: 1421, correctPercent: 55, optionPercents: [18, 55, 14, 13], avgTimeSec: 48, difficultyIndex: 0.55 },
    createdAt: "2026-04-18",
    updatedAt: "2026-08-31"
  },
  {
    id: "tb-ana-10",
    track: "medicine",
    subject: "anatomy",
    topicPath: ["\u0646\u0648\u0631\u0648\u0622\u0646\u0627\u062A\u0648\u0645\u06CC", "\u0639\u0631\u0648\u0642 \u0645\u063A\u0632"],
    type: "clinical",
    difficulty: "hard",
    year: 1401,
    source: "comprehensive",
    tags: [],
    stem: "\u0633\u06A9\u062A\u0647\u0654 \u0627\u06CC\u0633\u06A9\u0645\u06CC\u06A9 \u062F\u0631 \u0646\u0627\u062D\u06CC\u0647\u0654 \u0642\u0634\u0646\u06AF\u06CC \u06A9\u0647 \u0646\u0645\u0627\u06CC \u062D\u0631\u06A9\u062A\u06CC \u0627\u0646\u062F\u0627\u0645 \u0641\u0648\u0642\u0627\u0646\u06CC \u0648 \u0635\u0648\u0631\u062A \u0631\u0627 \u062A\u063A\u0630\u06CC\u0647 \u0645\u06CC\u200C\u06A9\u0646\u062F\u060C \u0628\u06CC\u0634\u062A\u0631\u06CC\u0646 \u0627\u062D\u062A\u0645\u0627\u0644 \u0645\u0631\u0628\u0648\u0637 \u0628\u0647 \u06A9\u062F\u0627\u0645 \u0634\u0631\u06CC\u0627\u0646 \u0627\u0633\u062A\u061F",
    figure: null,
    options: [
      "\u0634\u0631\u06CC\u0627\u0646 \u0645\u063A\u0632\u06CC \u0642\u062F\u0627\u0645\u06CC (ACA)",
      "\u0634\u0631\u06CC\u0627\u0646 \u0645\u063A\u0632\u06CC \u0645\u06CC\u0627\u0646\u06CC (MCA)",
      "\u0634\u0631\u06CC\u0627\u0646 \u0645\u063A\u0632\u06CC \u062E\u0644\u0641\u06CC (PCA)",
      "\u0634\u0631\u06CC\u0627\u0646 \u0628\u0627\u0632\u06CC\u0644\u0627\u0631"
    ],
    correctAnswer: 1,
    explanation: {
      summary: "MCA \u0646\u0645\u0627\u06CC \u062D\u0631\u06A9\u062A\u06CC \u0635\u0648\u0631\u062A \u0648 \u0627\u0646\u062F\u0627\u0645 \u0641\u0648\u0642\u0627\u0646\u06CC (\u0648 \u0647\u0645\u0686\u0646\u06CC\u0646 \u06AF\u0641\u062A\u0627\u0631 \u062F\u0631 \u0646\u06CC\u0645\u06A9\u0631\u0647\u0654 \u063A\u0627\u0644\u0628) \u0631\u0627 \u062A\u063A\u0630\u06CC\u0647 \u0645\u06CC\u200C\u06A9\u0646\u062F.",
      deep: "\u0647\u0648\u0645\u0648\u0646\u06A9\u0648\u0644\u0648\u0633 \u062D\u0631\u06A9\u062A\u06CC: \u067E\u0627 \u0631\u0648\u06CC \u0633\u0637\u062D \u0645\u06CC\u0627\u0646\u06CC (ACA)\u060C \u062F\u0633\u062A \u0648 \u0635\u0648\u0631\u062A \u0631\u0648\u06CC \u0633\u0637\u062D \u06A9\u0646\u0627\u0631\u06CC (MCA). \u0633\u06A9\u062A\u0647\u0654 MCA \u0686\u067E \u0628\u0627 \u0622\u0641\u0627\u0632\u06CC\u060C \u0633\u06A9\u062A\u0647\u0654 \u0631\u0627\u0633\u062A \u0628\u0627 \u0646\u0650\u06AF\u0644\u06A9\u062A \u0645\u06A9\u0627\u0646\u06CC\u06A9\u06CC \u0647\u0645\u0631\u0627\u0647 \u0627\u0633\u062A. ACA \u067E\u0627 \u0631\u0627 \u0645\u06CC\u200C\u06AF\u06CC\u0631\u062F \u0648 PCA \u0628\u06CC\u0646\u0627\u06CC\u06CC \u0631\u0627.",
      keyPoint: "ACA = \u067E\u0627 | MCA = \u0635\u0648\u0631\u062A + \u062F\u0633\u062A + \u06AF\u0641\u062A\u0627\u0631 | PCA = \u0628\u06CC\u0646\u0627\u06CC\u06CC.",
      trap: "\xAB\u0647\u0648\u0645\u0648\u0646\u06A9\u0648\u0644\u0648\u0633 \u0627\u0632 \u0628\u0627\u0644\u0627 \u0628\u0647 \u067E\u0627\u06CC\u06CC\u0646: \u067E\u0627-\u062F\u0633\u062A-\u0635\u0648\u0631\u062A\xBB \u0648\u0644\u06CC \u0646\u06AF\u0627\u0634\u062A \u0639\u0631\u0648\u0642\u06CC \u0645\u0639\u06A9\u0648\u0633 \u0633\u0637\u062D \u0627\u0633\u062A\u061B \u067E\u0627 ACA \u0627\u0633\u062A.",
      whyWrong: [
        { index: 0, text: "ACA \u0646\u0627\u062D\u06CC\u0647\u0654 \u062D\u0631\u06A9\u062A\u06CC \u067E\u0627 (\u0633\u0637\u062D \u0645\u06CC\u0627\u0646\u06CC) \u0631\u0627 \u062A\u063A\u0630\u06CC\u0647 \u0645\u06CC\u200C\u06A9\u0646\u062F." },
        { index: 2, text: "PCA \u0646\u0627\u062D\u06CC\u0647\u0654 \u0628\u06CC\u0646\u0627\u06CC\u06CC (\u06A9\u0648\u0631\u062A\u06A9\u0633 \u0627\u06A9\u0633\u06CC\u067E\u06CC\u062A\u0627\u0644) \u0631\u0627 \u0645\u06CC\u200C\u062F\u0647\u062F." },
        { index: 3, text: "\u0628\u0627\u0632\u06CC\u0644\u0627\u0631 \u0633\u0627\u062E\u062A\u0627\u0631\u0647\u0627\u06CC \u067E\u0633\u200C\u062E\u0627\u0646\u06AF\u06CC (\u067E\u0648\u0646\u0633\u060C \u0645\u062E\u0686\u0647) \u0631\u0627 \u062A\u063A\u0630\u06CC\u0647 \u0645\u06CC\u200C\u06A9\u0646\u062F." }
      ]
    },
    stats: { solves: 2051, correctPercent: 62, optionPercents: [13, 62, 9, 16], avgTimeSec: 39, difficultyIndex: 0.62 },
    createdAt: "2025-12-26",
    updatedAt: "2026-07-26"
  },
  /* ═══════════════ بیوشیمی (۱۰ سؤال) ═══════════════ */
  {
    id: "tb-bio-01",
    track: "medicine",
    subject: "biochemistry",
    topicPath: ["\u0622\u0646\u0632\u06CC\u0645\u200C\u0647\u0627", "\u0633\u06CC\u0646\u062A\u06CC\u06A9 \u0622\u0646\u0632\u06CC\u0645\u06CC"],
    type: "image",
    difficulty: "medium",
    year: 1400,
    source: "official",
    tags: ["\u067E\u0631\u062A\u06A9\u0631\u0627\u0631", "\u0645\u0646\u062A\u062E\u0628"],
    stem: "\u062F\u0631 \u0634\u06A9\u0644 \u0645\u0642\u0627\u0628\u0644\u060C \u0645\u0646\u062D\u0646\u06CC \u0627\u0634\u0628\u0627\u0639 \u0633\u0648\u0628\u0633\u062A\u0631\u0627\u06CC \u06CC\u06A9 \u0622\u0646\u0632\u06CC\u0645 \u0631\u0633\u0645 \u0634\u062F\u0647 \u0627\u0633\u062A. \u0645\u0642\u062F\u0627\u0631 Km \u0628\u0631 \u0627\u0633\u0627\u0633 \u0627\u06CC\u0646 \u0646\u0645\u0648\u062F\u0627\u0631 \u06A9\u062F\u0627\u0645 \u0627\u0633\u062A\u061F",
    figure: "enzyme-kinetics",
    options: [
      "\u063A\u0644\u0638\u062A \u0633\u0648\u0628\u0633\u062A\u0631\u0627\u06CC\u06CC \u06A9\u0647 \u0633\u0631\u0639\u062A \u0648\u0627\u06A9\u0646\u0634 \u0631\u0627 \u0628\u0647 \u0646\u0635\u0641 Vmax \u0645\u06CC\u200C\u0631\u0633\u0627\u0646\u062F",
      "\u063A\u0644\u0638\u062A \u0633\u0648\u0628\u0633\u062A\u0631\u0627\u06CC\u06CC \u06A9\u0647 \u0622\u0646\u0632\u06CC\u0645 \u0631\u0627 \u06A9\u0627\u0645\u0644\u0627\u064B \u0627\u0634\u0628\u0627\u0639 \u0645\u06CC\u200C\u06A9\u0646\u062F",
      "\u0633\u0631\u0639\u062A \u0648\u0627\u06A9\u0646\u0634 \u062F\u0631 \u063A\u0644\u0638\u062A \u0646\u0635\u0641 \u0633\u0648\u0628\u0633\u062A\u0631\u0627\u06CC \u0627\u0634\u0628\u0627\u0639",
      "\u0628\u0631\u0639\u06A9\u0633\u0650 \u062B\u0627\u0628\u062A \u062A\u0641\u06A9\u06CC\u06A9 \u0622\u0646\u0632\u06CC\u0645-\u0645\u0647\u0627\u0631\u06A9\u0646\u0646\u062F\u0647"
    ],
    correctAnswer: 0,
    explanation: {
      summary: "Km \u063A\u0644\u0638\u062A \u0633\u0648\u0628\u0633\u062A\u0631\u0627\u06CC\u06CC \u0627\u0633\u062A \u06A9\u0647 \u062F\u0631 \u0622\u0646 v = \xBDVmax\u061B \u0634\u0627\u062E\u0635 \u062A\u0645\u0627\u06CC\u0644 \u0622\u0646\u0632\u06CC\u0645 \u0628\u0647 \u0633\u0648\u0628\u0633\u062A\u0631\u0627 (\u06A9\u0645\u062A\u0631 = \u062A\u0645\u0627\u06CC\u0644 \u0628\u06CC\u0634\u062A\u0631).",
      deep: "\u0627\u0632 \u0645\u0639\u0627\u062F\u0644\u0647\u0654 \u0645\u06CC\u06A9\u0627\u0626\u06CC\u0644\u06CC\u0633-\u0645\u0646\u062A\u0646 v = Vmax[S]/(Km+[S])\u060C \u062F\u0631 [S]=Km \u0645\u0642\u062F\u0627\u0631 v \u0646\u0635\u0641 Vmax \u0645\u06CC\u200C\u0634\u0648\u062F. Km \u0634\u0627\u062E\u0635 \u0630\u0627\u062A\u06CC \u0622\u0646\u0632\u06CC\u0645-\u0633\u0648\u0628\u0633\u062A\u0631\u0627 \u0627\u0633\u062A \u0648 \u0645\u0633\u062A\u0642\u0644 \u0627\u0632 \u063A\u0644\u0638\u062A \u0622\u0646\u0632\u06CC\u0645\u061B \u0644\u0650\u06CC\u0646\u06CC\u0648\u0650\u06CC\u0648\u0631-\u0628\u0631\u06A9 \u0628\u0627 1/v \u062F\u0631 \u0628\u0631\u0627\u0628\u0631 1/[S] \u0622\u0646 \u0631\u0627 \u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0645\u06CC\u200C\u06A9\u0646\u062F.",
      keyPoint: "Km = [S] \u062F\u0631 \xBDVmax | Vmax \u0645\u0633\u062A\u0642\u0644 \u0627\u0632 Km \u0641\u0642\u0637 \u0628\u0627 \u0627\u0641\u0632\u0627\u06CC\u0634 [E] \u062A\u063A\u06CC\u06CC\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F.",
      trap: "Vmax \u0633\u0631\u0639\u062A \u0627\u0633\u062A (\u0648\u0627\u062D\u062F v)\u060C Km \u063A\u0644\u0638\u062A \u0627\u0633\u062A (\u0648\u0627\u062D\u062F [S]) \u2014 \u0645\u0639\u0627\u0648\u0636\u0647\u0654 \u0627\u06CC\u0646 \u062F\u0648\u060C \u062F\u0627\u0645 \u06A9\u0644\u0627\u0633\u06CC\u06A9 \u0622\u0632\u0645\u0648\u0646\u200C\u0647\u0627\u0633\u062A.",
      whyWrong: [
        { index: 1, text: "\u0627\u0634\u0628\u0627\u0639 \u06A9\u0627\u0645\u0644 \u062F\u0631 [S] \u0628\u0633\u06CC\u0627\u0631 \u0628\u0627\u0644\u0627\u062A\u0631 \u0627\u0632 Km \u0631\u062E \u0645\u06CC\u200C\u062F\u0647\u062F." },
        { index: 2, text: "\u0627\u06CC\u0646 \u062A\u0639\u0631\u06CC\u0641 v \u0627\u0633\u062A \u0646\u0647 Km." },
        { index: 3, text: "Km \u0628\u0627 Ki \u0628\u0631\u0627\u0628\u0631 \u0646\u06CC\u0633\u062A\u061B \u0641\u0642\u0637 \u062F\u0631 \u0645\u0647\u0627\u0631 \u0631\u0642\u0627\u0628\u062A\u06CC Km \u0638\u0627\u0647\u0631\u06CC \u062A\u063A\u06CC\u06CC\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F." }
      ]
    },
    stats: { solves: 4612, correctPercent: 73, optionPercents: [73, 12, 11, 4], avgTimeSec: 32, difficultyIndex: 0.73 },
    createdAt: "2025-10-08",
    updatedAt: "2026-07-12"
  },
  {
    id: "tb-bio-02",
    track: "medicine",
    subject: "biochemistry",
    topicPath: ["\u0622\u0646\u0632\u06CC\u0645\u200C\u0647\u0627", "\u0645\u0647\u0627\u0631\u06A9\u0646\u0646\u062F\u0647\u200C\u0647\u0627\u06CC \u0622\u0646\u0632\u06CC\u0645\u06CC"],
    type: "concept",
    difficulty: "medium",
    year: 1399,
    source: "official",
    tags: ["\u067E\u0631\u062A\u06A9\u0631\u0627\u0631"],
    stem: "\u062F\u0631 \u0645\u0647\u0627\u0631 \u0631\u0642\u0627\u0628\u062A\u06CC\u060C \u0627\u0641\u0632\u0627\u06CC\u0634 \u063A\u0644\u0638\u062A \u0633\u0648\u0628\u0633\u062A\u0631\u0627 \u0686\u0647 \u0627\u062B\u0631\u06CC \u0628\u0631 Vmax \u0648 Km \u0638\u0627\u0647\u0631\u06CC \u062F\u0627\u0631\u062F\u061F",
    figure: null,
    options: [
      "Vmax \u06A9\u0627\u0647\u0634\u060C Km \u06A9\u0627\u0647\u0634",
      "Vmax \u062B\u0627\u0628\u062A\u060C Km \u0627\u0641\u0632\u0627\u06CC\u0634 \u0638\u0627\u0647\u0631\u06CC",
      "Vmax \u06A9\u0627\u0647\u0634\u060C Km \u062B\u0627\u0628\u062A",
      "Vmax \u0648 Km \u0647\u0631 \u062F\u0648 \u062B\u0627\u0628\u062A"
    ],
    correctAnswer: 1,
    explanation: {
      summary: "\u0645\u0647\u0627\u0631 \u0631\u0642\u0627\u0628\u062A\u06CC \u0628\u0627 \u0633\u0648\u0628\u0633\u062A\u0631\u0627 \u0628\u0631 \u0633\u0631 \u0633\u0627\u06CC\u062A \u0641\u0639\u0627\u0644 \u0631\u0642\u0627\u0628\u062A \u0645\u06CC\u200C\u06A9\u0646\u062F\u061B \u0628\u0627 [S] \u0632\u06CC\u0627\u062F \u0627\u062B\u0631 \u0645\u0647\u0627\u0631 \u0645\u06CC\u200C\u0634\u0648\u062F (Vmax \u062B\u0627\u0628\u062A) \u0627\u0645\u0627 \u063A\u0644\u0638\u062A \u0628\u06CC\u0634\u062A\u0631\u06CC \u0628\u0631\u0627\u06CC \u0646\u0635\u0641 Vmax \u0644\u0627\u0632\u0645 \u0627\u0633\u062A (Km \u0638\u0627\u0647\u0631\u06CC \u0628\u06CC\u0634\u062A\u0631).",
      deep: "\u0645\u0647\u0627\u0631\u06A9\u0646\u0646\u062F\u0647\u0654 \u0631\u0642\u0627\u0628\u062A\u06CC \u0633\u0627\u062E\u062A\u0627\u0631\u06CC \u0634\u0628\u06CC\u0647 \u0633\u0648\u0628\u0633\u062A\u0631\u0627 \u062F\u0627\u0631\u062F \u0648 \u0628\u0647 E \u0645\u062A\u0635\u0644 \u0645\u06CC\u200C\u0634\u0648\u062F \u0646\u0647 ES\u061B \u0644\u0650\u06CC\u0646\u06CC\u0648\u0650\u06CC\u0648\u0631-\u0628\u0631\u06A9 \u062E\u0637\u0648\u0637 \u062F\u0631 \u0646\u0642\u0637\u0647\u0654 \u0628\u0631\u062E\u0648\u0631\u062F \u0628\u0627 \u0645\u062D\u0648\u0631 y (1/Vmax) \u0647\u0645\u200C\u0646\u0642\u0637\u0647 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F. \u062F\u0631 \u0645\u0647\u0627\u0631 \u063A\u06CC\u0631\u0631\u0642\u0627\u0628\u062A\u06CC Vmax \u06A9\u0645 \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 Km \u062B\u0627\u0628\u062A \u0645\u06CC\u200C\u0645\u0627\u0646\u062F.",
      keyPoint: "\u0631\u0642\u0627\u0628\u062A\u06CC: Vmax\u2194\u060C Km\u2191 | \u063A\u06CC\u0631\u0631\u0642\u0627\u0628\u062A\u06CC: Vmax\u2193\u060C Km\u2194 | \u0646\u0627\u200C\u0631\u0642\u0627\u0628\u062A\u06CC (\u0622\u0646\u062A\u0627\u06AF\u0648\u0646\u06CC\u0633\u062A): \u0647\u0631 \u062F\u0648\u2193.",
      trap: "\xABKm \u0627\u0641\u0632\u0627\u06CC\u0634 \u0638\u0627\u0647\u0631\u06CC\xBB \u0628\u0647 \u0645\u0639\u0646\u06CC \u06A9\u0627\u0647\u0634 \u062A\u0645\u0627\u06CC\u0644 \u0648\u0627\u0642\u0639\u06CC \u0622\u0646\u0632\u06CC\u0645 \u0646\u06CC\u0633\u062A\u061B \u0633\u0627\u062E\u062A\u0627\u0631 \u0622\u0646\u0632\u06CC\u0645 \u062A\u063A\u06CC\u06CC\u0631 \u0646\u06A9\u0631\u062F\u0647 \u0627\u0633\u062A.",
      whyWrong: [
        { index: 0, text: "\u0647\u06CC\u0686\u200C\u06A9\u062F\u0627\u0645 \u0627\u0632 \u067E\u0627\u0631\u0627\u0645\u062A\u0631\u0647\u0627 \u062F\u0631 \u0627\u06CC\u0646 \u062D\u0627\u0644\u062A \u0628\u0647 \u0627\u06CC\u0646 \u0634\u06A9\u0644 \u062A\u063A\u06CC\u06CC\u0631 \u0646\u0645\u06CC\u200C\u06A9\u0646\u0646\u062F." },
        { index: 2, text: "Vmax \u06A9\u0627\u0647\u0634\u06CC\u060C \u0648\u06CC\u0698\u06AF\u06CC \u0645\u0647\u0627\u0631 \u063A\u06CC\u0631\u0631\u0642\u0627\u0628\u062A\u06CC \u0627\u0633\u062A." },
        { index: 3, text: "\u062D\u062F\u0627\u0642\u0644 Km \u0638\u0627\u0647\u0631\u06CC \u062A\u063A\u06CC\u06CC\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F\u061B \u062F\u0631 \u063A\u06CC\u0631 \u0627\u06CC\u0646 \u0635\u0648\u0631\u062A \u0645\u0647\u0627\u0631 \u0631\u0642\u0627\u0628\u062A\u06CC \u0642\u0627\u0628\u0644 \u062A\u0641\u06A9\u06CC\u06A9 \u0646\u0628\u0648\u062F." }
      ]
    },
    stats: { solves: 4988, correctPercent: 70, optionPercents: [8, 70, 13, 9], avgTimeSec: 28, difficultyIndex: 0.7 },
    createdAt: "2025-11-08",
    updatedAt: "2026-06-20"
  },
  {
    id: "tb-bio-03",
    track: "medicine",
    subject: "biochemistry",
    topicPath: ["\u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u0633\u0645 \u06A9\u0631\u0628\u0648\u0647\u06CC\u062F\u0631\u0627\u062A", "\u06AF\u0644\u06CC\u06A9\u0648\u0644\u06CC\u0632 \u0648 \u06AF\u0644\u0648\u06A9\u0648\u0646\u0626\u0648\u0698\u0646\u0632"],
    type: "calculation",
    difficulty: "hard",
    year: 1402,
    source: "comprehensive",
    tags: [],
    stem: "\u0633\u0648\u062F \u062E\u0627\u0644\u0635 ATP \u062A\u0648\u0644\u06CC\u062F\u0634\u062F\u0647 \u0627\u0632 \u0645\u0633\u06CC\u0631 \u0633\u0648\u0628\u0633\u062A\u0631\u0627-\u0633\u0637\u062D\u06CC (\u0628\u062F\u0648\u0646 \u0627\u062D\u062A\u0633\u0627\u0628 NADH \u0648 FADH\u2082) \u0627\u0632 \u06AF\u0644\u06CC\u06A9\u0648\u0644\u06CC\u0632 \u062A\u0627 \u067E\u0627\u06CC\u0627\u0646 \u0686\u0631\u062E\u0647\u0654 \u06A9\u0631\u0628\u0633 \u0628\u0631\u0627\u06CC \u06CC\u06A9 \u0645\u0648\u0644\u06A9\u0648\u0644 \u06AF\u0644\u0648\u06A9\u0632 \u0686\u0642\u062F\u0631 \u0627\u0633\u062A\u061F",
    figure: null,
    options: ["\u06F2 ATP", "\u06F4 ATP", "\u06F8 ATP (\u0628\u0627 \u0627\u062D\u062A\u0633\u0627\u0628 NADH)", "\u06F3\u06F0 \u062A\u0627 \u06F3\u06F2 ATP (\u0627\u06A9\u0633\u06CC\u062F\u0627\u0633\u06CC\u0648\u0646 \u06A9\u0627\u0645\u0644)"],
    correctAnswer: 1,
    explanation: {
      summary: "ATP \u0633\u0648\u0628\u0633\u062A\u0631\u0627-\u0633\u0637\u062D\u06CC: \u06F2 ATP \u062F\u0631 \u06AF\u0644\u06CC\u06A9\u0648\u0644\u06CC\u0632 + \u06F2 GTP \u062F\u0631 \u0686\u0631\u062E\u0647\u0654 \u06A9\u0631\u0628\u0633 = \u06F4 ATP.",
      deep: "\u062F\u0631 \u06AF\u0644\u06CC\u06A9\u0648\u0644\u06CC\u0632 \u06F4 ATP \u0645\u0633\u062A\u0642\u06CC\u0645 \u062A\u0648\u0644\u06CC\u062F \u0648 \u06F2 ATP \u0645\u0635\u0631\u0641 \u0645\u06CC\u200C\u0634\u0648\u062F (\u062E\u0627\u0644\u0635 \u06F2)\u061B \u062F\u0631 \u0686\u0631\u062E\u0647\u0654 \u06A9\u0631\u0628\u0633 \u0628\u0647\u200C\u0627\u0632\u0627\u06CC \u0647\u0631 \u06AF\u0644\u0648\u06A9\u0632 \u06F2 GTP \u0633\u0627\u062E\u062A\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F. \u062C\u0645\u0639 ATP \u0633\u0648\u0628\u0633\u062A\u0631\u0627-\u0633\u0637\u062D\u06CC \u062A\u0627 \u067E\u0627\u06CC\u0627\u0646 \u06A9\u0631\u0628\u0633 \u06F4 \u0627\u0633\u062A. NADH \u0648 FADH\u2082 \u0641\u0642\u0637 \u0648\u0642\u062A\u06CC \u0628\u0647 ATP \u062A\u0628\u062F\u06CC\u0644 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F \u06A9\u0647 \u0632\u0646\u062C\u06CC\u0631\u0647\u0654 \u062A\u0646\u0641\u0633\u06CC \u0647\u0645 \u0644\u062D\u0627\u0638 \u0634\u0648\u062F\u061B \u0622\u0646\u200C\u0648\u0642\u062A \u06A9\u0644 \u0627\u06A9\u0633\u06CC\u062F\u0627\u0633\u06CC\u0648\u0646 \u0628\u0647 \u06F3\u06F0 \u062A\u0627 \u06F3\u06F2 ATP \u0645\u06CC\u200C\u0631\u0633\u062F (\u0628\u0633\u062A\u0647 \u0628\u0647 \u0646\u0648\u0639 \u0634\u0627\u062A\u0644).",
      keyPoint: "ATP \u0633\u0648\u0628\u0633\u062A\u0631\u0627-\u0633\u0637\u062D\u06CC \u0641\u0642\u0637 \u062F\u0631 \u06AF\u0644\u06CC\u06A9\u0648\u0644\u06CC\u0632 (\u06F2) \u0648 \u06A9\u0631\u0628\u0633 (\u06F2 GTP)\u061B \u0628\u0642\u06CC\u0647 \u0627\u0632 \u0627\u06A9\u0633\u06CC\u062F\u0627\u062A\u06CC\u0648 \u0641\u0633\u0641\u0648\u0631\u06CC\u0644\u0627\u0633\u06CC\u0648\u0646.",
      trap: "\u062F\u0627\u0645 \u0628\u0632\u0631\u06AF: \u0642\u0627\u0637\u06CC\u200C\u06A9\u0631\u062F\u0646 \xAB\u062A\u0627 \u067E\u0627\u06CC\u0627\u0646 \u06A9\u0631\u0628\u0633\xBB \u0628\u0627 \xAB\u0627\u06A9\u0633\u06CC\u062F\u0627\u0633\u06CC\u0648\u0646 \u06A9\u0627\u0645\u0644\xBB. \u0635\u0648\u0631\u062A \u0633\u0624\u0627\u0644 \u0631\u0627 \u062F\u0642\u06CC\u0642 \u0628\u062E\u0648\u0627\u0646.",
      whyWrong: [
        { index: 0, text: "\u06F2 ATP \u062E\u0627\u0644\u0635 \u0641\u0642\u0637 \u06AF\u0644\u06CC\u06A9\u0648\u0644\u06CC\u0632 \u0627\u0633\u062A\u061B GTP\u0647\u0627\u06CC \u0686\u0631\u062E\u0647\u0654 \u06A9\u0631\u0628\u0633 \u062C\u0645\u0639 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A." },
        { index: 2, text: "\u0627\u06CC\u0646 \u0639\u062F\u062F \u0628\u0627 \u0627\u062D\u062A\u0633\u0627\u0628 ATP \u062D\u0627\u0635\u0644 \u0627\u0632 NADH \u0628\u0647 \u062F\u0633\u062A \u0645\u06CC\u200C\u0622\u06CC\u062F \u06A9\u0647 \u0633\u0624\u0627\u0644 \u0622\u0646 \u0631\u0627 \u06A9\u0646\u0627\u0631 \u06AF\u0630\u0627\u0634\u062A\u0647 \u0627\u0633\u062A." },
        { index: 3, text: "\u0627\u06CC\u0646 \u06A9\u0644 \u0627\u06A9\u0633\u06CC\u062F\u0627\u0633\u06CC\u0648\u0646 \u0647\u0648\u0627\u0632\u06CC \u06AF\u0644\u0648\u06A9\u0632 (\u0634\u0627\u0645\u0644 \u0632\u0646\u062C\u06CC\u0631\u0647\u0654 \u062A\u0646\u0641\u0633\u06CC) \u0627\u0633\u062A." }
      ]
    },
    stats: { solves: 1782, correctPercent: 44, optionPercents: [23, 44, 18, 15], avgTimeSec: 55, difficultyIndex: 0.44 },
    createdAt: "2026-01-14",
    updatedAt: "2026-08-09"
  },
  {
    id: "tb-bio-04",
    track: "medicine",
    subject: "biochemistry",
    topicPath: ["\u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u0633\u0645 \u06A9\u0631\u0628\u0648\u0647\u06CC\u062F\u0631\u0627\u062A", "\u0634\u0646\u062A \u0647\u06AF\u0632\u0648\u0632 \u0645\u0648\u0646\u0648\u0641\u0633\u0641\u0627\u062A"],
    type: "memorization",
    difficulty: "easy",
    year: 1398,
    source: "official",
    tags: [],
    stem: "\u06A9\u0645\u0628\u0648\u062F \u0622\u0646\u0632\u06CC\u0645 G6PD \u0639\u0645\u062F\u062A\u0627\u064B \u0628\u0627 \u06A9\u062F\u0627\u0645 \u067E\u06CC\u0627\u0645\u062F \u0628\u0627\u0644\u06CC\u0646\u06CC \u0647\u0645\u0631\u0627\u0647 \u0627\u0633\u062A\u061F",
    figure: null,
    options: [
      "\u06A9\u0645\u200C\u062E\u0648\u0646\u06CC \u0647\u0645\u0648\u0644\u06CC\u062A\u06CC\u06A9 \u0628\u0627 \u06AF\u0648\u06CC\u0686\u0647\u200C\u0647\u0627\u06CC bite cell",
      "\u06A9\u0645\u200C\u062E\u0648\u0646\u06CC \u0645\u06CC\u06A9\u0631\u0648\u0633\u06CC\u062A\u06CC\u06A9 \u0647\u06CC\u067E\u0648\u06A9\u0631\u0648\u0645",
      "\u0627\u0633\u06CC\u062F\u0648\u0632 \u0644\u0627\u06A9\u062A\u06CC\u06A9",
      "\u0647\u06CC\u067E\u0631\u06AF\u0644\u06CC\u0633\u0645\u06CC \u0639\u0635\u0628\u06CC"
    ],
    correctAnswer: 0,
    explanation: {
      summary: "G6PD \u0645\u0646\u0628\u0639 \u0627\u0635\u0644\u06CC NADPH \u06AF\u0644\u0628\u0648\u0644 \u0642\u0631\u0645\u0632 \u0627\u0633\u062A\u061B \u06A9\u0645\u0628\u0648\u062F \u0622\u0646 \u0645\u0648\u062C\u0628 \u0634\u06A9\u0633\u062A \u062D\u0641\u0627\u0638\u062A \u0627\u0632 \u0647\u0645\u0648\u06AF\u0644\u0648\u0628\u06CC\u0646 \u062F\u0631 \u0628\u0631\u0627\u0628\u0631 \u0627\u0633\u062A\u0631\u0633 \u0627\u06A9\u0633\u06CC\u062F\u0627\u062A\u06CC\u0648 \u0648 \u0647\u0645\u0648\u0644\u06CC\u0632 (bite cell/Heinz body) \u0645\u06CC\u200C\u0634\u0648\u062F.",
      deep: "\u0634\u0646\u062A HMP \u0646\u0642\u0634 NADPH \u062F\u0631 \u0628\u0627\u0632\u0633\u0627\u0632\u06CC \u06AF\u0644\u0648\u062A\u0627\u062A\u06CC\u0648\u0646 \u0627\u062D\u06CC\u0627 \u0631\u0627 \u062F\u0627\u0631\u062F\u061B \u0628\u062F\u0648\u0646 \u0622\u0646\u060C \u0627\u06A9\u0633\u06CC\u062F\u0627\u0646\u200C\u0647\u0627 (\u062F\u0627\u0631\u0648\u0647\u0627\u06CC \u0627\u06A9\u0633\u06CC\u062F\u06A9\u0646\u0646\u062F\u0647\u060C \u0644\u0648\u0628\u06CC\u0627\u060C \u0639\u0641\u0648\u0646\u062A) \u0633\u0648\u0644\u0641\u200C\u0647\u06CC\u062F\u0631\u06CC\u0644\u200C\u0647\u0627\u06CC Hb \u0631\u0627 \u0627\u06A9\u0633\u06CC\u062F \u0645\u06CC\u200C\u06A9\u0646\u0646\u062F \u0648 \u0631\u0633\u0648\u0628 \u0647\u0650\u06CC\u0646\u0632 \u0645\u06CC\u200C\u0633\u0627\u0632\u0646\u062F\u061B \u0637\u062D\u0627\u0644 \u0628\u062E\u0634\u06CC \u0627\u0632 \u06AF\u0648\u06CC\u0686\u0647 \u0631\u0627 \u0645\u06CC\u200C\u0628\u064F\u0631\u062F (bite cell).",
      keyPoint: "G6PD = \xAB\u062D\u0627\u0641\u0638 \u0622\u0646\u062A\u06CC\u200C\u0627\u06A9\u0633\u06CC\u062F\u0627\u0646 \u06AF\u0644\u0628\u0648\u0644 \u0642\u0631\u0645\u0632\xBB\u061B X-linked \u0648 \u0634\u0627\u06CC\u0639 \u062F\u0631 \u0645\u062F\u06CC\u062A\u0631\u0627\u0646\u0647/\u0622\u0641\u0631\u06CC\u0642\u0627.",
      trap: "\u06A9\u0645\u200C\u062E\u0648\u0646\u06CC \u062F\u0631 \u0627\u06CC\u0646 \u0628\u06CC\u0645\u0627\u0631\u06CC \u0646\u0631\u0645\u0627\u0644\u0648\u0633\u06CC\u062A\u06CC\u06A9 (\u0647\u0645\u0648\u0644\u06CC\u062A\u06CC\u06A9) \u0627\u0633\u062A\u060C \u0646\u0647 \u0645\u06CC\u06A9\u0631\u0648\u0633\u06CC\u062A\u06CC\u06A9 \u0622\u0647\u0646\u200C\u062F\u0627\u0631.",
      whyWrong: [
        { index: 1, text: "\u0645\u06CC\u06A9\u0631\u0648\u0633\u06CC\u062A\u06CC\u06A9 \u0647\u06CC\u067E\u0648\u06A9\u0631\u0648\u0645 \u0645\u0631\u0628\u0648\u0637 \u0628\u0647 \u06A9\u0645\u0628\u0648\u062F \u0622\u0647\u0646/\u062A\u0627\u0644\u0627\u0633\u0645\u06CC \u0627\u0633\u062A." },
        { index: 2, text: "\u0627\u0633\u06CC\u062F\u0648\u0632 \u0644\u0627\u06A9\u062A\u06CC\u06A9 \u0628\u0627 \u06A9\u0645\u0628\u0648\u062F \u067E\u06CC\u0631\u0648\u0648\u0627\u062A \u062F\u0647\u06CC\u062F\u0631\u0648\u0698\u0646\u0627\u0632 \u06CC\u0627 \u0647\u06CC\u067E\u0648\u06A9\u0633\u06CC \u0645\u0631\u062A\u0628\u0637 \u0627\u0633\u062A." },
        { index: 3, text: "\u0647\u06CC\u067E\u0631\u06AF\u0644\u06CC\u0633\u0645\u06CC \u0628\u0627 \u0645\u0633\u06CC\u0631 \u0627\u0646\u0633\u0648\u0644\u06CC\u0646/\u06AF\u0644\u0648\u06A9\u0648\u0646\u0626\u0648\u0698\u0646\u0632 \u0645\u0631\u062A\u0628\u0637 \u0627\u0633\u062A\u060C \u0646\u0647 G6PD." }
      ]
    },
    stats: { solves: 3567, correctPercent: 80, optionPercents: [80, 7, 6, 7], avgTimeSec: 24, difficultyIndex: 0.8 },
    createdAt: "2025-09-20",
    updatedAt: "2026-06-15"
  },
  {
    id: "tb-bio-05",
    track: "medicine",
    subject: "biochemistry",
    topicPath: ["\u0648\u06CC\u062A\u0627\u0645\u06CC\u0646\u200C\u0647\u0627", "\u0648\u06CC\u062A\u0627\u0645\u06CC\u0646\u200C\u0647\u0627\u06CC \u0645\u062D\u0644\u0648\u0644 \u062F\u0631 \u0686\u0631\u0628\u06CC"],
    type: "memorization",
    difficulty: "easy",
    year: 1400,
    source: "official",
    tags: ["\u067E\u0631\u062A\u06A9\u0631\u0627\u0631"],
    stem: "\u0648\u06CC\u062A\u0627\u0645\u06CC\u0646\u06CC \u06A9\u0647 \u0628\u0647\u200C\u0639\u0646\u0648\u0627\u0646 \u0622\u0646\u062A\u06CC\u200C\u0627\u06A9\u0633\u06CC\u062F\u0627\u0646 \u0632\u0646\u062C\u06CC\u0631\u0647\u200C\u0627\u06CC \u062F\u0631 \u063A\u0634\u0627\u0647\u0627\u06CC \u0633\u0644\u0648\u0644\u06CC \u0639\u0645\u0644 \u0645\u06CC\u200C\u06A9\u0646\u062F \u06A9\u062F\u0627\u0645 \u0627\u0633\u062A\u061F",
    figure: null,
    options: ["\u0648\u06CC\u062A\u0627\u0645\u06CC\u0646 A (\u0631\u062A\u06CC\u0646\u0648\u0644)", "\u0648\u06CC\u062A\u0627\u0645\u06CC\u0646 D (\u06A9\u0627\u0644\u0633\u06CC\u0641\u0631\u0648\u0644)", "\u0648\u06CC\u062A\u0627\u0645\u06CC\u0646 E (\u062A\u0648\u06A9\u0648\u0641\u0631\u0648\u0644)", "\u0648\u06CC\u062A\u0627\u0645\u06CC\u0646 K (\u0641\u06CC\u0644\u0648\u06A9\u06CC\u0646\u0648\u0646)"],
    correctAnswer: 2,
    explanation: {
      summary: "\u0648\u06CC\u062A\u0627\u0645\u06CC\u0646 E (\u062A\u0648\u06A9\u0648\u0641\u0631\u0648\u0644) \u0622\u0646\u062A\u06CC\u200C\u0627\u06A9\u0633\u06CC\u062F\u0627\u0646 \u063A\u0634\u0627\u06CC\u06CC \u0627\u0633\u062A\u061B \u0631\u0627\u062F\u06CC\u06A9\u0627\u0644\u200C\u0647\u0627\u06CC \u0644\u06CC\u067E\u06CC\u062F\u06CC \u063A\u0634\u0627 \u0631\u0627 \u0645\u0647\u0627\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F.",
      deep: "\u062A\u0648\u06A9\u0648\u0641\u0631\u0648\u0644 \u0628\u0627 \u062F\u0627\u062F\u0646 \u0647\u06CC\u062F\u0631\u0648\u0698\u0646 \u0628\u0647 \u067E\u0631\u0627\u06A9\u0633\u06CC\u062F\u0647\u0627\u06CC \u0644\u06CC\u067E\u06CC\u062F\u06CC\u060C \u0648\u0627\u06A9\u0646\u0634 \u0632\u0646\u062C\u06CC\u0631\u0647\u200C\u0627\u06CC \u067E\u0631\u0627\u06A9\u0633\u06CC\u062F\u0627\u0633\u06CC\u0648\u0646 \u0631\u0627 \u0642\u0637\u0639 \u0645\u06CC\u200C\u06A9\u0646\u062F\u061B \u0633\u067E\u0633 \u062E\u0648\u062F\u0634 \u0628\u0627 \u0648\u06CC\u062A\u0627\u0645\u06CC\u0646 C \u0627\u062D\u06CC\u0627 \u0645\u06CC\u200C\u0634\u0648\u062F. \u0631\u062A\u06CC\u0646\u0648\u0644 \u0628\u06CC\u0646\u0627\u06CC\u06CC/\u062A\u0645\u0627\u06CC\u0632\u060C D \u06A9\u0644\u0633\u06CC\u0645 \u0648 K \u0639\u0648\u0627\u0645\u0644 \u0627\u0646\u0639\u0642\u0627\u062F\u06CC \u0627\u0633\u062A.",
      keyPoint: "E = \u0622\u0646\u062A\u06CC\u200C\u0627\u06A9\u0633\u06CC\u062F\u0627\u0646 \u063A\u0634\u0627\u06CC\u06CC | A = \u0628\u06CC\u0646\u0627\u06CC\u06CC \u0648 \u062A\u0645\u0627\u06CC\u0632 | D = \u06A9\u0644\u0633\u06CC\u0645 | K = \u06A9\u0627\u0631\u0628\u0648\u06A9\u0633\u06CC\u0644\u0627\u0633\u06CC\u0648\u0646 \u06AF\u0644\u0648\u06AF\u0627\u0645\u0627\u062A.",
      trap: "\u0633\u0650\u0644\u0646\u06CC\u0648\u0645 \u0647\u0645 \u062F\u0631 \u0622\u0646\u062A\u06CC\u200C\u0627\u06A9\u0633\u06CC\u062F\u0627\u0646 \u0646\u0642\u0634 \u062F\u0627\u0631\u062F \u0648\u0644\u06CC \u0628\u0647\u200C\u0639\u0646\u0648\u0627\u0646 \u06A9\u0648\u0641\u0627\u06A9\u062A\u0648\u0631 \u06AF\u0644\u0648\u062A\u0627\u062A\u06CC\u0648\u0646 \u067E\u0631\u0627\u06A9\u0633\u06CC\u062F\u0627\u0632\u060C \u0646\u0647 \u0622\u0646\u062A\u06CC\u200C\u0627\u06A9\u0633\u06CC\u062F\u0627\u0646 \u063A\u0634\u0627\u06CC\u06CC \u0645\u0633\u062A\u0642\u06CC\u0645.",
      whyWrong: [
        { index: 0, text: "\u0631\u062A\u06CC\u0646\u0648\u0644 \u0646\u0642\u0634 \u0628\u06CC\u0646\u0627\u06CC\u06CC \u0648 \u062A\u0645\u0627\u06CC\u0632 \u0633\u0644\u0648\u0644\u06CC \u062F\u0627\u0631\u062F." },
        { index: 1, text: "\u06A9\u0627\u0644\u0633\u06CC\u0641\u0631\u0648\u0644 \u062A\u0646\u0638\u06CC\u0645 \u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u0633\u0645 \u06A9\u0644\u0633\u06CC\u0645-\u0641\u0633\u0641\u0627\u062A \u0627\u0633\u062A." },
        { index: 3, text: "\u0641\u06CC\u0644\u0648\u06A9\u06CC\u0646\u0648\u0646 \u06A9\u0648\u0641\u0627\u06A9\u062A\u0648\u0631 \u03B3-\u06A9\u0627\u0631\u0628\u0648\u06A9\u0633\u06CC\u0644\u0627\u0633\u06CC\u0648\u0646 \u0641\u0627\u06A9\u062A\u0648\u0631\u0647\u0627\u06CC \u0627\u0646\u0639\u0642\u0627\u062F\u06CC \u0627\u0633\u062A." }
      ]
    },
    stats: { solves: 4102, correctPercent: 83, optionPercents: [7, 5, 83, 5], avgTimeSec: 21, difficultyIndex: 0.83 },
    createdAt: "2025-10-02",
    updatedAt: "2026-06-22"
  },
  {
    id: "tb-bio-06",
    track: "medicine",
    subject: "biochemistry",
    topicPath: ["\u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u0633\u0645 \u0644\u06CC\u067E\u06CC\u062F", "\u0633\u0646\u062A\u0632 \u0627\u0633\u06CC\u062F \u0686\u0631\u0628"],
    type: "concept",
    difficulty: "medium",
    year: 1401,
    source: "official",
    tags: [],
    stem: "\u062F\u0631 \u0633\u0646\u062A\u0632 \u0627\u0633\u06CC\u062F \u0686\u0631\u0628\u060C \u0622\u0646\u0632\u06CC\u0645 \u0622\u0633\u06CC\u0644-CoA \u06A9\u0631\u0628\u0648\u06A9\u0633\u06CC\u0644\u0627\u0632 (ACC) \u0628\u0627 \u06A9\u062F\u0627\u0645 \u0645\u06A9\u0627\u0646\u06CC\u0633\u0645 \u062A\u0646\u0638\u06CC\u0645 \u0645\u06CC\u200C\u0634\u0648\u062F\u061F",
    figure: null,
    options: [
      "\u0641\u0639\u0627\u0644\u200C\u0633\u0627\u0632\u06CC \u0628\u0627 \u0641\u0633\u0641\u0648\u0631\u06CC\u0644\u0627\u0633\u06CC\u0648\u0646 \u062A\u0648\u0633\u0637 PKA",
      "\u0641\u0639\u0627\u0644\u200C\u0633\u0627\u0632\u06CC \u0628\u0627 \u062F\u0641\u0633\u0641\u0648\u0631\u06CC\u0644\u0627\u0633\u06CC\u0648\u0646 (\u0627\u0646\u0633\u0648\u0644\u06CC\u0646) \u0648 \u0622\u0644\u0648\u0633\u062A\u0631\u06CC \u0628\u0627 \u0633\u06CC\u062A\u0631\u0627\u062A",
      "\u0645\u0647\u0627\u0631 \u0628\u0627 \u0633\u06CC\u062A\u0631\u0627\u062A \u0648 \u0641\u0639\u0627\u0644\u200C\u0633\u0627\u0632\u06CC \u0628\u0627 \u067E\u0627\u0644\u0645\u06CC\u062A\u0627\u062A",
      "\u062A\u0646\u0638\u06CC\u0645 \u0645\u0633\u062A\u0642\u0644 \u0627\u0632 \u0648\u0636\u0639\u06CC\u062A \u0627\u0646\u0631\u0698\u06CC \u0633\u0644\u0648\u0644"
    ],
    correctAnswer: 1,
    explanation: {
      summary: "ACC (\u0622\u0646\u0632\u06CC\u0645 \u0633\u0631\u0639\u062A\u200C\u0633\u0627\u0632) \u0628\u0627 \u0627\u0646\u0633\u0648\u0644\u06CC\u0646 (\u062F\u0641\u0633\u0641\u0648\u0631\u06CC\u0644\u0627\u0633\u06CC\u0648\u0646) \u0648 \u0633\u06CC\u062A\u0631\u0627\u062A (\u0622\u0644\u0648\u0633\u062A\u0631\u06CC) \u0641\u0639\u0627\u0644 \u0648 \u0628\u0627 \u067E\u0627\u0644\u0645\u06CC\u062A\u0627\u062A \u0648 \u06AF\u0644\u0648\u06A9\u0627\u06AF\u0648\u0646/\u0627\u067E\u06CC\u200C\u0646\u0641\u0631\u06CC\u0646 (\u0641\u0633\u0641\u0648\u0631\u06CC\u0644\u0627\u0633\u06CC\u0648\u0646) \u0645\u0647\u0627\u0631 \u0645\u06CC\u200C\u0634\u0648\u062F.",
      deep: "ACC \u0645\u0627\u0644\u0648\u0646\u06CC\u0644-CoA \u0645\u06CC\u200C\u0633\u0627\u0632\u062F\u061B \u0645\u0627\u0644\u0648\u0646\u06CC\u0644 \u0647\u0645 \u0647\u0645 \u0633\u0648\u0628\u0633\u062A\u0631\u0627\u06CC \u0633\u0646\u062A\u0632 \u0627\u0633\u062A \u0647\u0645 \u0645\u0647\u0627\u0631\u06A9\u0646\u0646\u062F\u0647\u0654 CPT-1 (\u062C\u0644\u0648\u06AF\u06CC\u0631\u06CC \u0627\u0632 \u0647\u0645\u200C\u0632\u0645\u0627\u0646\u06CC \u0633\u0646\u062A\u0632 \u0648 \u0627\u06A9\u0633\u06CC\u062F\u0627\u0633\u06CC\u0648\u0646). \u0633\u06CC\u062A\u0631\u0627\u062A \u0646\u0634\u0627\u0646\u0647\u0654 \u0641\u0631\u0627\u0648\u0627\u0646\u06CC \u0627\u0646\u0631\u0698\u06CC (\u0627\u0632 \u06A9\u0631\u0628\u0633 \u0628\u0647 \u0633\u06CC\u062A\u0648\u067E\u0644\u0627\u0633\u0645) \u0627\u0633\u062A.",
      keyPoint: "\u0627\u0646\u0633\u0648\u0644\u06CC\u0646 = \xAB\u0633\u0627\u0632 \u0648 \u0630\u062E\u06CC\u0631\u0647 \u06A9\u0646\xBB | \u06AF\u0644\u0648\u06A9\u0627\u06AF\u0648\u0646 = \xAB\u0628\u0633\u0648\u0632\u0627\u0646\xBB\u061B \u0647\u0645\u0627\u0646 \u0645\u0646\u0637\u0642 ACC \u0631\u0627 \u0647\u0645 \u0645\u06CC\u200C\u0633\u0627\u0632\u062F.",
      trap: "\u062F\u0631 \u03B2-\u0627\u06A9\u0633\u06CC\u062F\u0627\u0633\u06CC\u0648\u0646 \u0628\u0631\u0639\u06A9\u0633 \u0627\u0633\u062A: \u0641\u0633\u0641\u0648\u0631\u06CC\u0644\u0627\u0633\u06CC\u0648\u0646 \u0644\u06CC\u067E\u0627\u0632 \u0647\u0648\u0631\u0645\u0648\u0646\u06CC \u0622\u0646 \u0631\u0627 \u0641\u0639\u0627\u0644 \u0645\u06CC\u200C\u06A9\u0646\u062F.",
      whyWrong: [
        { index: 0, text: "\u0641\u0633\u0641\u0648\u0631\u06CC\u0644\u0627\u0633\u06CC\u0648\u0646 ACC \u0631\u0627 \u0645\u0647\u0627\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F (\u0641\u0639\u0627\u0644\u200C\u0633\u0627\u0632\u06CC \u0644\u06CC\u067E\u0627\u0632 \u0686\u0631\u0628 \u0631\u0627 \u0645\u06CC\u200C\u06A9\u0646\u062F)." },
        { index: 2, text: "\u0633\u06CC\u062A\u0631\u0627\u062A \u0641\u0639\u0627\u0644\u200C\u06A9\u0646\u0646\u062F\u0647 \u0627\u0633\u062A\u061B \u067E\u0627\u0644\u0645\u06CC\u062A\u0627\u062A \u0645\u0647\u0627\u0631\u06A9\u0646\u0646\u062F\u0647 \u2014 \u0639\u06A9\u0633 \u0627\u06CC\u0646 \u06AF\u0632\u06CC\u0646\u0647." },
        { index: 3, text: "ACC \u06CC\u06A9\u06CC \u0627\u0632 \u062D\u0633\u0627\u0633\u200C\u062A\u0631\u06CC\u0646 \u0622\u0646\u0632\u06CC\u0645\u200C\u0647\u0627 \u0628\u0647 \u0648\u0636\u0639\u06CC\u062A \u0627\u0646\u0631\u0698\u06CC \u0627\u0633\u062A." }
      ]
    },
    stats: { solves: 2634, correctPercent: 60, optionPercents: [14, 60, 19, 7], avgTimeSec: 38, difficultyIndex: 0.6 },
    createdAt: "2025-12-12",
    updatedAt: "2026-07-17"
  },
  {
    id: "tb-bio-07",
    track: "medicine",
    subject: "biochemistry",
    topicPath: ["\u0628\u06CC\u0648\u0634\u06CC\u0645\u06CC \u0645\u0648\u0644\u06A9\u0648\u0644\u06CC", "\u062A\u0631\u062C\u0645\u0647\u0654 \u067E\u0631\u0648\u062A\u0626\u06CC\u0646"],
    type: "memorization",
    difficulty: "medium",
    year: 1403,
    source: "official",
    tags: [],
    stem: "\u06A9\u062F\u0648\u0646 \u0622\u063A\u0627\u0632 \u062A\u0631\u062C\u0645\u0647 \u062F\u0631 \u0628\u0627\u06A9\u062A\u0631\u06CC\u200C\u0647\u0627 \u06A9\u062F\u0627\u0645 \u0622\u0645\u06CC\u0646\u0648\u0627\u0633\u06CC\u062F \u0631\u0627 \u06A9\u062F\u06AF\u0630\u0627\u0631\u06CC \u0645\u06CC\u200C\u06A9\u0646\u062F\u061F",
    figure: null,
    options: ["\u0645\u062A\u06CC\u0648\u0646\u06CC\u0646", "N-\u0641\u0631\u0645\u06CC\u0644\u200C\u0645\u062A\u06CC\u0648\u0646\u06CC\u0646", "\u0644\u0648\u0633\u06CC\u0646", "\u0648\u0627\u0644\u06CC\u0646"],
    correctAnswer: 1,
    explanation: {
      summary: "\u062F\u0631 \u067E\u0631\u0648\u06A9\u0627\u0631\u06CC\u0648\u062A\u200C\u0647\u0627 \u0622\u063A\u0627\u0632\u06CC\u0646\u060C N-\u0641\u0631\u0645\u06CC\u0644\u200C\u0645\u062A\u06CC\u0648\u0646\u06CC\u0646 (fMet) \u0627\u0633\u062A\u061B \u062F\u0631 \u06CC\u0648\u06A9\u0627\u0631\u06CC\u0648\u062A\u200C\u0647\u0627 \u0645\u062A\u06CC\u0648\u0646\u06CC\u0646 \u0633\u0627\u062F\u0647.",
      deep: "tRNA \u0622\u063A\u0627\u0632\u06CC\u0646 \u067E\u0631\u0648\u06A9\u0627\u0631\u06CC\u0648\u062A (fMet-tRNA\u1DA0\u1D39\u1D49\u1D57) \u0628\u0627 \u0622\u0646\u0632\u06CC\u0645 \u062A\u0631\u0627\u0646\u0633\u0641\u0648\u0631\u0645\u06CC\u0644\u0627\u0632 \u0641\u0631\u0645\u06CC\u0644 \u0645\u06CC\u200C\u0634\u0648\u062F\u061B \u0627\u06CC\u0646 \u06AF\u0631\u0648\u0647 \u0628\u0639\u062F\u0627\u064B \u0627\u0632 \u067E\u067E\u062A\u06CC\u062F \u062D\u0630\u0641 \u0645\u06CC\u200C\u0634\u0648\u062F. AUG \u062F\u0631 \u062C\u0627\u06CC\u06AF\u0627\u0647\u200C\u0647\u0627\u06CC \u062F\u0627\u062E\u0644\u06CC mRNA \u0645\u062A\u06CC\u0648\u0646\u06CC\u0646 \u0631\u0627 \u0645\u06CC\u200C\u062F\u0647\u062F\u060C \u0648\u0644\u06CC \u062F\u0631 \u062C\u0627\u06CC\u06AF\u0627\u0647 \u0622\u063A\u0627\u0632 \u0628\u0627 IF-2 \u0648 fMet \u062A\u0631\u062C\u0645\u0647 \u0634\u0631\u0648\u0639 \u0645\u06CC\u200C\u0634\u0648\u062F.",
      keyPoint: "AUG = \u0622\u063A\u0627\u0632 (pro: fMet / euca: Met)\u061B \u062F\u0631 \u06CC\u0648\u06A9\u0627\u0631\u06CC\u0648\u062A\u200C\u0647\u0627 \u0641\u0631\u0645\u06CC\u0644\u200C\u062F\u0627\u0631 \u0634\u062F\u0646 \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F.",
      trap: "AUG \u0647\u0645\u06CC\u0634\u0647 \xAB\u0645\u062A\u06CC\u0648\u0646\u06CC\u0646\xBB \u0627\u0633\u062A\u061B \u0641\u0631\u0645\u06CC\u0644\u200C\u0634\u062F\u0646 \u0648\u06CC\u0698\u06AF\u06CC \u067E\u0631\u0648\u06A9\u0627\u0631\u06CC\u0648\u062A\u06CC\u0650 tRNA \u0622\u063A\u0627\u0632\u06CC\u0646 \u0627\u0633\u062A.",
      whyWrong: [
        { index: 0, text: "\u0645\u062A\u06CC\u0648\u0646\u06CC\u0646 \u0633\u0627\u062F\u0647\u060C \u0622\u063A\u0627\u0632\u06AF\u0631 \u06CC\u0648\u06A9\u0627\u0631\u06CC\u0648\u062A\u06CC \u0627\u0633\u062A." },
        { index: 2, text: "\u0644\u0648\u0633\u06CC\u0646 \u0622\u063A\u0627\u0632\u06AF\u0631 \u0646\u06CC\u0633\u062A (CTU/CUC...)." },
        { index: 3, text: "\u0648\u0627\u0644\u06CC\u0646 \u0631\u0627\u0628\u0637\u0647\u200C\u0627\u06CC \u0628\u0627 \u0622\u063A\u0627\u0632 \u062A\u0631\u062C\u0645\u0647 \u0646\u062F\u0627\u0631\u062F." }
      ]
    },
    stats: { solves: 2210, correctPercent: 65, optionPercents: [21, 65, 8, 6], avgTimeSec: 30, difficultyIndex: 0.65 },
    createdAt: "2026-03-09",
    updatedAt: "2026-08-05"
  },
  {
    id: "tb-bio-08",
    track: "medicine",
    subject: "biochemistry",
    topicPath: ["\u0628\u06CC\u0648\u0634\u06CC\u0645\u06CC \u0645\u0648\u0644\u06A9\u0648\u0644\u06CC", "\u062C\u0647\u0634\u200C\u0647\u0627"],
    type: "concept",
    difficulty: "hard",
    year: 1404,
    source: "official",
    tags: ["\u0645\u0646\u062A\u062E\u0628"],
    stem: "\u062C\u0647\u0634\u06CC \u06A9\u0647 \u06CC\u06A9 \u06A9\u062F\u0648\u0646 \u0645\u0639\u0646\u0627\u062F\u0627\u0631 \u0631\u0627 \u0628\u0647 \u06A9\u062F\u0648\u0646 \u062A\u0648\u0642\u0641 (UAA\u060C UAG\u060C UGA) \u062A\u0628\u062F\u06CC\u0644 \u0645\u06CC\u200C\u06A9\u0646\u062F \u0686\u0647 \u0646\u0627\u0645 \u062F\u0627\u0631\u062F\u061F",
    figure: null,
    options: ["\u0645\u06CC\u0633\u200C\u0633\u0646\u0633", "\u0646\u0627\u0646\u200C\u0633\u0646\u0633", "\u0633\u0627\u06CC\u0644\u0646\u062A", "\u0641\u0631\u06CC\u0645\u200C\u0634\u06CC\u0641\u062A"],
    correctAnswer: 1,
    explanation: {
      summary: "\u062C\u0647\u0634 \u0646\u0627\u0646\u200C\u0633\u0646\u0633 \u06A9\u062F\u0648\u0646 \u0645\u0639\u0646\u0627\u062F\u0627\u0631 \u0631\u0627 \u0628\u0647 \u06A9\u062F\u0648\u0646 \u0627\u0633\u062A\u0627\u067E \u062A\u0628\u062F\u06CC\u0644 \u0645\u06CC\u200C\u06A9\u0646\u062F \u0648 \u067E\u0631\u0648\u062A\u0626\u06CC\u0646 \u0631\u0627 \u06A9\u0648\u062A\u0627\u0647 (truncated) \u0645\u06CC\u200C\u0633\u0627\u0632\u062F.",
      deep: "\u0646\u0627\u0646\u200C\u0633\u0646\u0633 \u0645\u0639\u0645\u0648\u0644\u0627\u064B \u067E\u0631\u0648\u062A\u0626\u06CC\u0646 \u0646\u0627\u067E\u0627\u06CC\u062F\u0627\u0631 \u06CC\u0627 \u0628\u062F\u0648\u0646 \u0639\u0645\u0644\u06A9\u0631\u062F \u0645\u06CC\u200C\u062F\u0647\u062F\u061B \u0627\u06AF\u0631 \u062C\u0647\u0634 \u062F\u0631 \u0646\u06CC\u0645\u0647\u0654 \u0627\u0648\u0644 \u0698\u0646 \u0628\u0627\u0634\u062F\u060C NMD (\u0645\u0633\u06CC\u0631 \u062A\u062C\u0632\u06CC\u0647\u0654 mRNA \u0628\u0627 \u06A9\u062F\u0648\u0646 \u0627\u0633\u062A\u0627\u067E \u0632\u0648\u062F\u0631\u0633) mRNA \u0631\u0627 \u0647\u0645 \u0627\u0632 \u0628\u06CC\u0646 \u0645\u06CC\u200C\u0628\u0631\u062F. \u0645\u06CC\u0633\u200C\u0633\u0646\u0633 \u0641\u0642\u0637 \u06CC\u06A9 \u0622\u0645\u06CC\u0646\u0648\u0627\u0633\u06CC\u062F \u0631\u0627 \u0639\u0648\u0636 \u0645\u06CC\u200C\u06A9\u0646\u062F\u061B \u0633\u0627\u06CC\u0644\u0646\u062A \u0628\u062F\u0648\u0646 \u062A\u063A\u06CC\u06CC\u0631 \u0622\u0645\u06CC\u0646\u0648\u0627\u0633\u06CC\u062F\u06CC \u0627\u0633\u062A.",
      keyPoint: "\u0646\u0627\u0646\u200C\u0633\u0646\u0633 = \u0627\u0633\u062A\u0627\u067E \u0632\u0648\u062F\u0631\u0633 | \u0645\u06CC\u0633\u200C\u0633\u0646\u0633 = \u062A\u0639\u0648\u06CC\u0636 \u0627\u0633\u06CC\u062F | \u0633\u0627\u06CC\u0644\u0646\u062A = \u0628\u062F\u0648\u0646 \u0627\u062B\u0631 | \u0641\u0631\u06CC\u0645\u200C\u0634\u06CC\u0641\u062A = \u062C\u0627\u0628\u062C\u0627\u06CC\u06CC \u0686\u0627\u0631\u0686\u0648\u0628.",
      trap: "\u0647\u0645\u0647\u0654 \u0645\u06CC\u0633\u200C\u0633\u0646\u0633\u200C\u0647\u0627 \u0622\u0633\u06CC\u0628\u200C\u0632\u0627 \u0646\u06CC\u0633\u062A\u0646\u062F (\u06A9\u0646\u0633\u0631\u0648\u0627\u062A\u06CC\u0648)\u060C \u0648\u0644\u06CC \u0646\u0627\u0646\u200C\u0633\u0646\u0633 \u062A\u0642\u0631\u06CC\u0628\u0627\u064B \u0647\u0645\u06CC\u0634\u0647 \u0639\u0645\u0644\u06A9\u0631\u062F \u0631\u0627 \u0627\u0632 \u0628\u06CC\u0646 \u0645\u06CC\u200C\u0628\u0631\u062F.",
      whyWrong: [
        { index: 0, text: "\u0645\u06CC\u0633\u200C\u0633\u0646\u0633 \u06CC\u06A9 \u0622\u0645\u06CC\u0646\u0648\u0627\u0633\u06CC\u062F \u0631\u0627 \u0639\u0648\u0636 \u0645\u06CC\u200C\u06A9\u0646\u062F\u060C \u0627\u0633\u062A\u0627\u067E \u0646\u0645\u06CC\u200C\u0633\u0627\u0632\u062F." },
        { index: 2, text: "\u0633\u0627\u06CC\u0644\u0646\u062A \u0628\u0647 \u062F\u0644\u06CC\u0644 \u0648\u0633\u0627\u0632 \u0628\u0648\u062F\u0646 \u06A9\u062F\u0648\u0646\u060C \u067E\u0631\u0648\u062A\u0626\u06CC\u0646 \u0631\u0627 \u0628\u062F\u0648\u0646 \u062A\u063A\u06CC\u06CC\u0631 \u0645\u06CC\u200C\u06AF\u0630\u0627\u0631\u062F." },
        { index: 3, text: "\u0641\u0631\u06CC\u0645\u200C\u0634\u06CC\u0641\u062A \u0627\u0632 \u0627\u06CC\u0646\u0633\u0631\u0634\u0646/\u062F\u0644\u06CC\u0634\u0646 \u0628\u0647 \u062A\u0639\u062F\u0627\u062F \u063A\u06CC\u0631 \u0645\u0636\u0631\u0628 \u06F3 \u062D\u0631\u0641 \u0646\u0627\u0634\u06CC \u0645\u06CC\u200C\u0634\u0648\u062F." }
      ]
    },
    stats: { solves: 1953, correctPercent: 68, optionPercents: [12, 68, 6, 14], avgTimeSec: 33, difficultyIndex: 0.68 },
    createdAt: "2026-04-08",
    updatedAt: "2026-08-27"
  },
  {
    id: "tb-bio-09",
    track: "medicine",
    subject: "biochemistry",
    topicPath: ["\u062A\u0639\u0627\u062F\u0644 \u0627\u0633\u06CC\u062F-\u0628\u0627\u0632", "\u0628\u0627\u0641\u0631\u0647\u0627"],
    type: "calculation",
    difficulty: "hard",
    year: 1401,
    source: "comprehensive",
    tags: [],
    stem: "\u0628\u0631 \u0627\u0633\u0627\u0633 \u0645\u0639\u0627\u062F\u0644\u0647\u0654 \u0647\u0646\u062F\u0631\u0633\u0648\u0646-\u0647\u0627\u0633\u0644\u0628\u0627\u062E (pKa \u0628\u06CC\u06A9\u0631\u0628\u0646\u0627\u062A = \u06F6\u066B\u06F1)\u060C \u0627\u06AF\u0631 \u0646\u0633\u0628\u062A HCO\u2083\u207B \u0628\u0647 H\u2082CO\u2083 \u0628\u0631\u0627\u0628\u0631 \u06F2\u06F0 \u0628\u0627\u0634\u062F\u060C pH \u062E\u0648\u0646 \u0686\u0642\u062F\u0631 \u0627\u0633\u062A\u061F",
    figure: null,
    options: ["\u06F7\u066B\u06F1", "\u06F7\u066B\u06F4", "\u06F6\u066B\u06F9", "\u06F7\u066B\u06F8"],
    correctAnswer: 1,
    explanation: {
      summary: "pH = pKa + log([A\u207B]/[HA]) = \u06F6\u066B\u06F1 + log\u06F2\u06F0 = \u06F6\u066B\u06F1 + \u06F1\u066B\u06F3 \u2248 \u06F7\u066B\u06F4.",
      deep: "\u0646\u0633\u0628\u062A \u06F2\u06F0:\u06F1 \u0628\u06CC\u06A9\u0631\u0628\u0646\u0627\u062A \u0628\u0647 \u0627\u0633\u06CC\u062F \u06A9\u0631\u0628\u0646\u06CC\u06A9\u060C \u0646\u0642\u0637\u0647\u0654 \u06A9\u0627\u0631\u06A9\u0631\u062F \u0641\u06CC\u0632\u06CC\u0648\u0644\u0648\u0698\u06CC\u06A9 \u0628\u0627\u0641\u0631 \u0628\u06CC\u06A9\u0631\u0628\u0646\u0627\u062A \u0627\u0633\u062A\u061B \u0647\u0645\u06CC\u0646 \u0646\u0633\u0628\u062A \u0627\u0633\u062A \u06A9\u0647 pH \u0646\u0631\u0645\u0627\u0644 \u06F7\u066B\u06F4 \u0631\u0627 \u0645\u06CC\u200C\u0633\u0627\u0632\u062F. \u0686\u0648\u0646 log\u06F1\u06F0 = \u06F1\u060C \u0647\u0631 \u062F\u0647\u200C\u0628\u0631\u0627\u0628\u0631 \u0634\u062F\u0646 \u0646\u0633\u0628\u062A \u062F\u0642\u06CC\u0642\u0627\u064B \u06CC\u06A9 \u0648\u0627\u062D\u062F \u0628\u0647 pH \u0627\u0636\u0627\u0641\u0647 \u0645\u06CC\u200C\u06A9\u0646\u062F.",
      keyPoint: "\u062D\u0641\u0638 \u06A9\u0646\u06CC\u062F: log\u06F2 = \u06F0\u066B\u06F3 | log\u06F2\u06F0 = \u06F1\u066B\u06F3 | \u0628\u0627\u0641\u0631 \u0645\u0624\u062B\u0631\u062A\u0631\u06CC\u0646 \u062F\u0631 pH\u2248pKa \u0627\u0633\u062A.",
      trap: "pKa \u0628\u06CC\u06A9\u0631\u0628\u0646\u0627\u062A (\u06F6\u066B\u06F1) \u062F\u0648\u0631 \u0627\u0632 pH \u062E\u0648\u0646 \u0627\u0633\u062A\u061B \u0628\u0627 \u0627\u06CC\u0646 \u062D\u0627\u0644 \u0645\u0624\u062B\u0631\u062A\u0631\u06CC\u0646 \u0628\u0627\u0641\u0631 \u0628\u062F\u0646 \u0627\u0633\u062A \u0686\u0648\u0646 \u0628\u0627\u0632 \u0648 \u0631\u06CC\u0647\u200C\u0647\u0627 \u0647\u0631 \u062F\u0648 \u062C\u0632\u0621 \u0631\u0627 \u062A\u0646\u0638\u06CC\u0645 \u0645\u06CC\u200C\u06A9\u0646\u0646\u062F (\u0633\u06CC\u0633\u062A\u0645 \u0628\u0627\u0632).",
      whyWrong: [
        { index: 0, text: "\u06F7\u066B\u06F1 \u0628\u0627 \u0646\u0633\u0628\u062A \u06F1\u06F0:\u06F1 (log=\u06F1) \u0628\u0647\u200C\u062F\u0633\u062A \u0645\u06CC\u200C\u0622\u06CC\u062F." },
        { index: 2, text: "\u06F6\u066B\u06F9 \u0646\u06CC\u0627\u0632 \u0628\u0647 \u0646\u0633\u0628\u062A \u06A9\u0645\u062A\u0631 \u0627\u0632 \u06F1\u06F0 \u062F\u0627\u0631\u062F." },
        { index: 3, text: "\u06F7\u066B\u06F8 \u0628\u0627 \u0646\u0633\u0628\u062A \u06F5\u06F0:\u06F1 \u0628\u0647 \u062F\u0633\u062A \u0645\u06CC\u200C\u0622\u06CC\u062F\u061B \u0622\u0644\u06A9\u0627\u0644\u0648\u0632 \u0634\u062F\u06CC\u062F." }
      ]
    },
    stats: { solves: 1687, correctPercent: 51, optionPercents: [19, 51, 16, 14], avgTimeSec: 47, difficultyIndex: 0.51 },
    createdAt: "2025-12-04",
    updatedAt: "2026-07-24"
  },
  {
    id: "tb-bio-10",
    track: "medicine",
    subject: "biochemistry",
    topicPath: ["\u0686\u0631\u062E\u0647\u0654 \u0627\u0648\u0631\u0647"],
    type: "concept",
    difficulty: "hard",
    year: 1402,
    source: "official",
    tags: ["\u067E\u0631\u062A\u06A9\u0631\u0627\u0631"],
    stem: "\u062F\u0631 \u06A9\u0645\u0628\u0648\u062F \u0622\u0646\u0632\u06CC\u0645 \u0627\u0648\u0631\u0646\u06CC\u062A\u06CC\u0646 \u062A\u0631\u0627\u0646\u0633\u200C\u06A9\u0627\u0631\u0628\u0627\u0645\u06CC\u0644\u0627\u0632 (OTC)\u060C \u06A9\u062F\u0627\u0645 \u06CC\u0627\u0641\u062A\u0647\u0654 \u0622\u0632\u0645\u0627\u06CC\u0634\u06AF\u0627\u0647\u06CC \u062A\u06CC\u067E\u06CC\u06A9 \u0627\u0633\u062A\u061F",
    figure: null,
    options: [
      "\u0627\u0641\u0632\u0627\u06CC\u0634 \u0627\u0648\u0631\u0646\u06CC\u062A\u06CC\u0646 \u0648 \u0627\u0633\u06CC\u062F \u0627\u0648\u0631\u0648\u062A\u06CC\u06A9 \u062F\u0631 \u0627\u062F\u0631\u0627\u0631",
      "\u0627\u0641\u0632\u0627\u06CC\u0634 \u0633\u06CC\u062A\u0631\u0648\u0644\u06CC\u0646 \u0648 \u0627\u0633\u06CC\u062F \u0622\u0631\u0698\u06CC\u0646\u0648\u0633\u0648\u06A9\u0633\u06CC\u0646\u06CC\u06A9",
      "\u0627\u0641\u0632\u0627\u06CC\u0634 \u0647\u0645\u0648\u06AF\u0644\u0648\u0628\u06CC\u0646 \u06AF\u0644\u06CC\u06A9\u0648\u0632\u06CC\u0644\u0647",
      "\u06A9\u0627\u0647\u0634 \u0622\u0645\u0648\u0646\u06CC\u0627\u06A9 \u062E\u0648\u0646"
    ],
    correctAnswer: 0,
    explanation: {
      summary: "OTC \u06A9\u0645\u0628\u0648\u062F \u2192 \u062A\u062C\u0645\u0639 \u06A9\u0627\u0631\u0628\u0627\u0645\u0648\u0626\u06CC\u0644 \u0641\u0633\u0641\u0627\u062A \u06A9\u0647 \u0628\u0647 \u0645\u0633\u06CC\u0631 \u0633\u0646\u062A\u0632 \u067E\u0631\u06CC\u0645\u06CC\u062F\u06CC\u0646 \u0645\u06CC\u200C\u0631\u0648\u062F \u2192 \u0627\u0648\u0631\u0648\u062A\u06CC\u06A9 \u0627\u0633\u06CC\u062F \u0627\u062F\u0631\u0627\u0631\u06CC \u0628\u0627\u0644\u0627 \u0648 \u0627\u0648\u0631\u0646\u06CC\u062A\u06CC\u0646 \u0628\u0627\u0644\u0627\u061B \u0627\u0648\u0631\u0647 \u067E\u0627\u06CC\u06CC\u0646 \u0648 \u0622\u0645\u0648\u0646\u06CC\u0627\u06A9 \u0628\u0627\u0644\u0627.",
      deep: "OTC \u062F\u0631 \u0645\u06CC\u062A\u0648\u06A9\u0646\u062F\u0631\u06CC \u06A9\u0627\u0631\u0628\u0627\u0645\u0648\u0626\u06CC\u0644 \u0641\u0633\u0641\u0627\u062A \u0631\u0627 \u0628\u0647 \u0627\u0648\u0631\u0646\u06CC\u062A\u06CC\u0646 \u0645\u0646\u062A\u0642\u0644 \u0645\u06CC\u200C\u06A9\u0646\u062F\u061B \u0628\u062F\u0648\u0646 \u0622\u0646\u060C \u06A9\u0627\u0631\u0628\u0627\u0645\u0648\u0626\u06CC\u0644 \u0641\u0633\u0641\u0627\u062A \u0628\u0647 \u0633\u06CC\u062A\u0648\u067E\u0644\u0627\u0633\u0645 \u0645\u06CC\u200C\u0631\u0648\u062F \u0648 \u062F\u0631 \u0645\u0633\u06CC\u0631 \u0633\u0646\u062A\u0632 \u067E\u0631\u06CC\u0645\u06CC\u062F\u06CC\u0646 (ATCase) \u0645\u0635\u0631\u0641 \u0645\u06CC\u200C\u0634\u0648\u062F. \u0646\u062A\u06CC\u062C\u0647: \u0627\u0648\u0631\u0648\u062A\u06CC\u06A9\u200C\u0627\u0633\u06CC\u062F\u0648\u0631\u06CC \u0628\u0627 \u0633\u06CC\u062A\u0631\u0648\u0644\u06CC\u0646 \u0646\u0631\u0645\u0627\u0644 (\u062F\u0631 \u06A9\u0645\u0628\u0648\u062F \u0622\u0631\u0698\u06CC\u0646\u0648\u0633\u0648\u06A9\u0633\u06CC\u0646\u0627\u062A \u0633\u0646\u062A\u062A\u0627\u0632 \u0633\u06CC\u062A\u0631\u0648\u0644\u06CC\u0646 \u0628\u0627\u0644\u0627 \u0645\u06CC\u200C\u0631\u0648\u062F).",
      keyPoint: "OTC = \u0627\u0648\u0631\u0648\u062A\u06CC\u06A9 \u0627\u0633\u06CC\u062F \u2191 + \u0633\u06CC\u062A\u0631\u0648\u0644\u06CC\u0646 \u0646\u0631\u0645\u0627\u0644 | ASS = \u0633\u06CC\u062A\u0631\u0648\u0644\u06CC\u0646 \u2191.",
      trap: "\u0627\u0648\u0631\u0648\u062A\u06CC\u06A9\u200C\u0627\u0633\u06CC\u062F\u0648\u0631\u06CC \u062F\u0631 OTC \u0646\u0627\u0634\u06CC \u0627\u0632 \u0645\u0633\u06CC\u0631 \u0641\u0631\u0639\u06CC \u067E\u0631\u06CC\u0645\u06CC\u062F\u06CC\u0646 \u0627\u0633\u062A\u061B \u062F\u0631 \u06A9\u0645\u0628\u0648\u062F UMP \u0633\u0646\u062A\u062A\u0627\u0632 \u0647\u0645 \u062F\u06CC\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F \u0648\u0644\u06CC \u0628\u0627 \u0645\u0647\u0627\u0631 \u0628\u0627\u0632\u062E\u0648\u0631\u062F \u0641\u0631\u0642 \u062F\u0627\u0631\u062F.",
      whyWrong: [
        { index: 1, text: "\u0633\u06CC\u062A\u0631\u0648\u0644\u06CC\u0646 \u0628\u0627\u0644\u0627 \u0648\u06CC\u0698\u06AF\u06CC \u06A9\u0645\u0628\u0648\u062F \u0622\u0631\u0698\u06CC\u0646\u0648\u0633\u0648\u06A9\u0633\u06CC\u0646\u0627\u062A \u0633\u0646\u062A\u062A\u0627\u0632 \u0627\u0633\u062A." },
        { index: 2, text: "HbA1c \u0634\u0627\u062E\u0635 \u06A9\u0646\u062A\u0631\u0644 \u0642\u0646\u062F \u062F\u0631 \u062F\u06CC\u0627\u0628\u062A \u0627\u0633\u062A\u060C \u0631\u0628\u0637\u06CC \u0628\u0647 \u0686\u0631\u062E\u0647\u0654 \u0627\u0648\u0631\u0647 \u0646\u062F\u0627\u0631\u062F." },
        { index: 3, text: "\u062F\u0631 \u0647\u0645\u0647\u0654 \u0627\u062E\u062A\u0644\u0627\u0644\u0627\u062A \u0686\u0631\u062E\u0647\u0654 \u0627\u0648\u0631\u0647 \u0622\u0645\u0648\u0646\u06CC\u0627\u06A9 \u0628\u0627\u0644\u0627 \u0645\u06CC\u200C\u0631\u0648\u062F (\u0647\u06CC\u067E\u0631\u0622\u0645\u0648\u0646\u06CC\u0645\u06CC)." }
      ]
    },
    stats: { solves: 1502, correctPercent: 46, optionPercents: [46, 27, 5, 22], avgTimeSec: 51, difficultyIndex: 0.46 },
    createdAt: "2026-01-27",
    updatedAt: "2026-08-13"
  },
  /* ═══════════════ تألیفی تپش — علوم پایه پزشکی ═══════════════ */
  {
    id: "tb-phy-16",
    track: "medicine",
    subject: "physiology",
    topicPath: ["\u06A9\u0644\u06CC\u0647", "\u0641\u06CC\u0632\u06CC\u0648\u0644\u0648\u0698\u06CC \u0644\u0648\u0644\u0647\u200C\u0647\u0627\u06CC \u0646\u0641\u0631\u0648\u0646"],
    type: "concept",
    difficulty: "medium",
    year: 1404,
    source: "tapesh",
    tags: ["\u0645\u0646\u062A\u062E\u0628"],
    stem: "\u0647\u0648\u0631\u0645\u0648\u0646 ADH (\u0648\u0627\u0632\u0648\u067E\u0631\u0633\u06CC\u0646) \u062F\u0631 \u0633\u0644\u0648\u0644\u200C\u0647\u0627\u06CC \u0645\u062C\u0631\u0627\u06CC \u062C\u0645\u0639\u200C\u06A9\u0646\u0646\u062F\u0647\u0654 \u0646\u0641\u0631\u0648\u0646 \u0628\u0627 \u06A9\u062F\u0627\u0645 \u0645\u0633\u06CC\u0631\u060C \u0628\u0627\u0632\u062C\u0630\u0628 \u0622\u0628 \u0631\u0627 \u0627\u0641\u0632\u0627\u06CC\u0634 \u0645\u06CC\u200C\u062F\u0647\u062F\u061F",
    figure: null,
    options: [
      "\u0627\u062A\u0635\u0627\u0644 \u0628\u0647 \u06AF\u06CC\u0631\u0646\u062F\u0647\u0654 V2\u060C \u0627\u0641\u0632\u0627\u06CC\u0634 cAMP \u0648 \u062F\u0631\u062C \u0622\u06A9\u0648\u067E\u0648\u0631\u06CC\u0646-\u06F2 \u062F\u0631 \u063A\u0634\u0627\u06CC \u0627\u067E\u06CC\u06A9\u0627\u0644",
      "\u0627\u062A\u0635\u0627\u0644 \u0628\u0647 \u06AF\u06CC\u0631\u0646\u062F\u0647\u0654 V1\u060C \u0627\u0641\u0632\u0627\u06CC\u0634 IP\u2083 \u0648 \u0627\u0646\u0642\u0628\u0627\u0636 \u0639\u0636\u0644\u0647\u0654 \u0635\u0627\u0641 \u0639\u0631\u0648\u0642",
      "\u0645\u0647\u0627\u0631 \u0645\u0633\u062A\u0642\u06CC\u0645 \u06A9\u0627\u0646\u0627\u0644\u200C\u0647\u0627\u06CC \u0633\u062F\u06CC\u0645\u06CC \u0627\u067E\u06CC\u06A9\u0627\u0644 \u0628\u062F\u0648\u0646 \u0648\u0627\u0633\u0637\u0647\u0654 \u067E\u06CC\u0627\u0645\u200C\u0631\u0633\u0627\u0646 \u062B\u0627\u0646\u0648\u06CC\u0647",
      "\u0627\u062A\u0635\u0627\u0644 \u0628\u0647 \u06AF\u06CC\u0631\u0646\u062F\u0647\u0654 V2 \u0648 \u06A9\u0627\u0647\u0634 cAMP \u062F\u0631 \u0633\u0644\u0648\u0644 \u0645\u062C\u0631\u0627\u06CC \u062C\u0645\u0639\u200C\u06A9\u0646\u0646\u062F\u0647"
    ],
    correctAnswer: 0,
    explanation: {
      summary: "ADH \u0628\u0627 \u06AF\u06CC\u0631\u0646\u062F\u0647\u0654 V2 (Gs \u2192 cAMP \u2192 PKA) \u0648\u0632\u06CC\u06A9\u0648\u0644\u200C\u0647\u0627\u06CC \u062D\u0627\u0648\u06CC \u0622\u06A9\u0648\u067E\u0648\u0631\u06CC\u0646-\u06F2 \u0631\u0627 \u0628\u0647 \u063A\u0634\u0627\u06CC \u0627\u067E\u06CC\u06A9\u0627\u0644 \u0645\u06CC\u200C\u0622\u0648\u0631\u062F \u0648 \u0628\u0627\u0632\u062C\u0630\u0628 \u0622\u0628 \u0631\u0627 \u0632\u06CC\u0627\u062F \u0645\u06CC\u200C\u06A9\u0646\u062F.",
      deep: "\u06AF\u06CC\u0631\u0646\u062F\u0647\u0654 V2 \u0631\u0648\u06CC \u0633\u0644\u0648\u0644\u200C\u0647\u0627\u06CC \u0627\u0635\u0644\u06CC \u0645\u062C\u0631\u0627\u06CC \u062C\u0645\u0639\u200C\u06A9\u0646\u0646\u062F\u0647 \u0627\u0633\u062A \u0648 \u0627\u0632 \u0645\u0633\u06CC\u0631 cAMP-PKA\u060C \u0622\u06A9\u0648\u067E\u0648\u0631\u06CC\u0646-\u06F2 \u0631\u0627 \u0627\u0632 \u0648\u0632\u06CC\u06A9\u0648\u0644\u200C\u0647\u0627\u06CC \u0633\u06CC\u062A\u0648\u067E\u0644\u0627\u0633\u0645\u06CC \u0628\u0647 \u063A\u0634\u0627\u06CC \u0627\u067E\u06CC\u06A9\u0627\u0644 \u0645\u0646\u062A\u0642\u0644 \u0645\u06CC\u200C\u06A9\u0646\u062F\u061B \u0647\u0645\u200C\u0632\u0645\u0627\u0646 \u0622\u06A9\u0648\u067E\u0648\u0631\u06CC\u0646-\u06F3 \u0648 \u06F4 \u062F\u0631 \u063A\u0634\u0627\u06CC \u0628\u0627\u0632\u0627\u0644 \u0648\u0627\u0633\u0637\u0647\u0654 \u062E\u0631\u0648\u062C \u0622\u0628 \u0628\u0647 \u0627\u06CC\u0646\u062A\u0631\u0627\u0633\u062A\u06CC\u0634\u06CC\u0648\u0645 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F. \u0627\u062B\u0631 \u062F\u06CC\u06AF\u0631 ADH \u0628\u0631 V2\u060C \u0627\u0641\u0632\u0627\u06CC\u0634 \u0633\u0646\u062A\u0632 \u067E\u0631\u0648\u0633\u062A\u0627\u06AF\u0644\u0646\u062F\u06CC\u0646 \u0648 \u0622\u0632\u0627\u062F\u0633\u0627\u0632\u06CC \u0641\u0627\u06A9\u062A\u0648\u0631 \u0641\u0648\u0646\u200C\u0648\u06CC\u0644\u0628\u0631\u0627\u0646\u062F \u0627\u0633\u062A. \u06AF\u06CC\u0631\u0646\u062F\u0647\u0654 V1 \u062F\u0631 \u0639\u0636\u0644\u0647\u0654 \u0635\u0627\u0641 \u0639\u0631\u0648\u0642 \u0628\u0627 \u0645\u0633\u06CC\u0631 IP\u2083/Ca\xB2\u207A \u0627\u0646\u0642\u0628\u0627\u0636 \u0645\u06CC\u200C\u062F\u0647\u062F \u0648 \u0631\u0628\u0637\u06CC \u0628\u0647 \u0628\u0627\u0632\u062C\u0630\u0628 \u0622\u0628 \u0646\u062F\u0627\u0631\u062F.",
      keyPoint: "ADH: V2 (\u06A9\u0644\u06CC\u0647\u060C cAMP\u060C \u0622\u06A9\u0648\u067E\u0648\u0631\u06CC\u0646-\u06F2) | V1 (\u0639\u0631\u0648\u0642\u060C IP\u2083/Ca\xB2\u207A).",
      trap: "\u06AF\u06CC\u0631\u0646\u062F\u0647\u0654 V2 \u0628\u0627 Gs \u06A9\u0627\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F\u060C \u067E\u0633 cAMP \u0631\u0627 \u0628\u0627\u0644\u0627 \u0645\u06CC\u200C\u0628\u0631\u062F \u0646\u0647 \u067E\u0627\u06CC\u06CC\u0646\u061B \u06AF\u0632\u06CC\u0646\u0647\u0654 \xAB\u06A9\u0627\u0647\u0634 cAMP\xBB \u062F\u0627\u0645 \u0638\u0627\u0647\u0631\u06CC-\u0645\u062D\u062A\u0645\u0644 \u0627\u0633\u062A.",
      whyWrong: [
        { index: 1, text: "\u0627\u06CC\u0646 \u062A\u0648\u0635\u06CC\u0641 \u06AF\u06CC\u0631\u0646\u062F\u0647\u0654 V1 \u062F\u0631 \u0639\u0636\u0644\u0647\u0654 \u0635\u0627\u0641 \u0639\u0631\u0648\u0642 \u0627\u0633\u062A\u060C \u0646\u0647 \u0645\u0633\u06CC\u0631 \u0628\u0627\u0632\u062C\u0630\u0628 \u0622\u0628." },
        { index: 2, text: "ADH \u0627\u0632 \u0637\u0631\u06CC\u0642 \u067E\u06CC\u0627\u0645\u200C\u0631\u0633\u0627\u0646 \u062B\u0627\u0646\u0648\u06CC\u0647 (cAMP) \u0639\u0645\u0644 \u0645\u06CC\u200C\u06A9\u0646\u062F\u061B \u0627\u062B\u0631 \u0645\u0633\u062A\u0642\u06CC\u0645 \u0631\u0648\u06CC \u06A9\u0627\u0646\u0627\u0644 \u0633\u062F\u06CC\u0645\u06CC \u0646\u062F\u0627\u0631\u062F." },
        { index: 3, text: "V2 \u0628\u0627 Gs\u060C cAMP \u0631\u0627 \u0627\u0641\u0632\u0627\u06CC\u0634 \u0645\u06CC\u200C\u062F\u0647\u062F\u061B \u06A9\u0627\u0647\u0634 cAMP \u0627\u062B\u0631 ADH \u0631\u0627 \u062E\u0646\u062B\u06CC \u0645\u06CC\u200C\u06A9\u0631\u062F." }
      ]
    },
    stats: { solves: 1893, correctPercent: 62, optionPercents: [62, 19, 8, 11], avgTimeSec: 34, difficultyIndex: 0.62 },
    createdAt: "2026-05-04",
    updatedAt: "2026-09-05"
  },
  {
    id: "tb-ana-11",
    track: "medicine",
    subject: "anatomy",
    topicPath: ["\u0627\u0646\u062F\u0627\u0645 \u0641\u0648\u0642\u0627\u0646\u06CC", "\u0627\u0639\u0635\u0627\u0628 \u0627\u0646\u062F\u0627\u0645 \u0641\u0648\u0642\u0627\u0646\u06CC"],
    type: "clinical",
    difficulty: "medium",
    year: 1404,
    source: "tapesh",
    tags: ["\u067E\u0631\u062A\u06A9\u0631\u0627\u0631"],
    stem: "\u062F\u0631 \u0633\u0646\u062F\u0631\u0645 \u062A\u0648\u0646\u0644 \u06A9\u0627\u0631\u067E\u0627\u0644\u060C \u06A9\u062F\u0627\u0645 \u0639\u0635\u0628 \u0632\u06CC\u0631 \u0631\u062A\u06CC\u0646\u0627\u06A9\u0648\u0644\u0648\u0645 \u0641\u0644\u06A9\u0633\u0648\u0631 \u0641\u0634\u0631\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u0628\u06CC\u0634\u062A\u0631\u06CC\u0646 \u0627\u062E\u062A\u0644\u0627\u0644 \u062D\u0633 \u062F\u0631 \u06A9\u062F\u0627\u0645 \u0646\u0627\u062D\u06CC\u0647 \u0627\u0633\u062A\u061F",
    figure: null,
    options: [
      "\u0639\u0635\u0628 \u0627\u0648\u0644\u0646\u0627\u0631\u061B \u062D\u0633 \u0627\u0646\u06AF\u0634\u062A \u06A9\u0648\u0686\u06A9 \u0648 \u06A9\u0646\u0627\u0631\u0647\u0654 \u062F\u0627\u062E\u0644\u06CC \u062F\u0633\u062A",
      "\u0639\u0635\u0628 \u0645\u062F\u06CC\u0627\u0646\u061B \u062D\u0633 \u0633\u0637\u062D \u067E\u0627\u0644\u0645\u0627\u0631 \u0633\u0647 \u0627\u0646\u06AF\u0634\u062A \u0648 \u0646\u06CC\u0645 \u0627\u0648\u0644",
      "\u0639\u0635\u0628 \u0631\u0627\u062F\u06CC\u0627\u0644\u061B \u062D\u0633 \u067E\u0634\u062A \u062F\u0633\u062A \u0648 \u0641\u0636\u0627\u06CC \u0628\u06CC\u0646\u200C\u0627\u0646\u06AF\u0634\u062A\u06CC \u0627\u0648\u0644",
      "\u0639\u0635\u0628 \u0645\u062F\u06CC\u0627\u0646\u061B \u062D\u0633 \u062A\u0645\u0627\u0645 \u0627\u0646\u06AF\u0634\u062A\u0627\u0646 \u0634\u0627\u0645\u0644 \u0627\u0646\u06AF\u0634\u062A \u06A9\u0648\u0686\u06A9"
    ],
    correctAnswer: 1,
    explanation: {
      summary: "\u062F\u0631 \u062A\u0648\u0646\u0644 \u06A9\u0627\u0631\u067E\u0627\u0644 \u0639\u0635\u0628 \u0645\u062F\u06CC\u0627\u0646 \u0632\u06CC\u0631 \u0631\u062A\u06CC\u0646\u0627\u06A9\u0648\u0644\u0648\u0645 \u0641\u0634\u0631\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F\u061B \u062D\u0633 \u0633\u0647 \u0627\u0646\u06AF\u0634\u062A \u0648 \u0646\u06CC\u0645 \u0627\u0648\u0644 (\u0628\u0647\u200C\u062C\u0632 \u0634\u0627\u062E\u0647\u0654 \u067E\u0627\u0644\u0645\u0627\u0631 \u067E\u0648\u0633\u062A\u06CC) \u0648 \u0639\u0636\u0644\u0627\u062A \u062A\u0646\u0627\u0631 \u06AF\u0631\u0641\u062A\u0627\u0631 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F.",
      deep: "\u0639\u0635\u0628 \u0645\u062F\u06CC\u0627\u0646 \u0647\u0645\u0631\u0627\u0647 \u062A\u0627\u0646\u062F\u0648\u0646\u200C\u0647\u0627\u06CC \u0641\u0644\u06A9\u0633\u0648\u0631 \u0633\u0637\u062D\u06CC \u0648 \u0639\u0645\u0642\u06CC \u0627\u0632 \u062A\u0648\u0646\u0644 \u06A9\u0627\u0631\u067E\u0627\u0644 \u0645\u06CC\u200C\u06AF\u0630\u0631\u062F\u061B \u0641\u0634\u0631\u062F\u06AF\u06CC \u0645\u0632\u0645\u0646 \u0628\u0627\u0639\u062B \u067E\u0627\u0631\u0633\u062A\u0632\u06CC \u0634\u0628\u0627\u0646\u0647\u060C \u0636\u0639\u0641 \u0627\u0628\u062F\u0627\u06A9\u0634\u0646 \u0634\u0633\u062A (\u06A9\u0646\u0627\u0631 \u0631\u0641\u062A\u0646 \u0634\u0633\u062A) \u0648 \u0622\u062A\u0631\u0648\u0641\u06CC \u062A\u0646\u0627\u0631 \u0645\u06CC\u200C\u0634\u0648\u062F. \u0634\u0627\u062E\u0647\u0654 \u067E\u0627\u0644\u0645\u0627\u0631 \u067E\u0648\u0633\u062A\u06CC \u0645\u062F\u06CC\u0627\u0646 \u067E\u06CC\u0634 \u0627\u0632 \u0648\u0631\u0648\u062F \u0628\u0647 \u062A\u0648\u0646\u0644 \u062C\u062F\u0627 \u0645\u06CC\u200C\u0634\u0648\u062F\u060C \u067E\u0633 \u062D\u0633 \u067E\u0627\u06CC\u0647\u0654 \u062A\u0646\u0627\u0631 \u062F\u0633\u062A\u200C\u0646\u062E\u0648\u0631\u062F\u0647 \u0645\u06CC\u200C\u0645\u0627\u0646\u062F. \u0639\u0635\u0628 \u0627\u0648\u0644\u0646\u0627\u0631 \u0627\u0632 \u06A9\u0627\u0646\u0627\u0644 \u06AF\u0648\u06CC\u0648\u0646 (\u062E\u0627\u0631\u062C \u062A\u0648\u0646\u0644) \u0648 \u0631\u0627\u062F\u06CC\u0627\u0644 \u062F\u0631 \u067E\u0634\u062A \u0645\u0686 \u0639\u0628\u0648\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F.",
      keyPoint: "\u062A\u0648\u0646\u0644 \u06A9\u0627\u0631\u067E\u0627\u0644 = \u0645\u062F\u06CC\u0627\u0646\u061B \u0633\u0647\u200C\u0648\u0646\u06CC\u0645 \u0627\u0646\u06AF\u0634\u062A \u0627\u0648\u0644 + \u062A\u0646\u0627\u0631. \u0627\u0648\u0644\u0646\u0627\u0631 = \u06AF\u0648\u06CC\u0648\u0646\u061B claw hand. \u0631\u0627\u062F\u06CC\u0627\u0644 = wrist drop.",
      trap: "\xAB\u062A\u0645\u0627\u0645 \u0627\u0646\u06AF\u0634\u062A\u0627\u0646\xBB \u063A\u0644\u0637 \u0627\u0633\u062A\u061B \u0646\u06CC\u0645\u0647\u0654 \u062F\u0627\u062E\u0644\u06CC \u0627\u0646\u06AF\u0634\u062A \u0686\u0647\u0627\u0631\u0645 \u0648 \u0627\u0646\u06AF\u0634\u062A \u06A9\u0648\u0686\u06A9 \u0627\u0632 \u0639\u0635\u0628 \u0627\u0648\u0644\u0646\u0627\u0631 \u0645\u06CC\u200C\u06AF\u06CC\u0631\u0646\u062F.",
      whyWrong: [
        { index: 0, text: "\u0627\u0648\u0644\u0646\u0627\u0631 \u062F\u0631 \u06A9\u0627\u0646\u0627\u0644 \u06AF\u0648\u06CC\u0648\u0646 \u0641\u0634\u0631\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F\u060C \u0646\u0647 \u062F\u0631 \u062A\u0648\u0646\u0644 \u06A9\u0627\u0631\u067E\u0627\u0644." },
        { index: 2, text: "\u0631\u0627\u062F\u06CC\u0627\u0644 \u062D\u0633 \u067E\u0634\u062A \u062F\u0633\u062A \u0631\u0627 \u0645\u06CC\u200C\u062F\u0647\u062F \u0648 \u062F\u0631 \u062A\u0648\u0646\u0644 \u06A9\u0627\u0631\u067E\u0627\u0644 \u0646\u06CC\u0633\u062A." },
        { index: 3, text: "\u0646\u0627\u062D\u06CC\u0647\u0654 \u0627\u0646\u06AF\u0634\u062A \u06A9\u0648\u0686\u06A9 \u0627\u0632 \u0639\u0635\u0628 \u0627\u0648\u0644\u0646\u0627\u0631 \u0639\u0635\u0628\u200C\u06AF\u06CC\u0631\u06CC \u0645\u06CC\u200C\u06A9\u0646\u062F." }
      ]
    },
    stats: { solves: 2244, correctPercent: 71, optionPercents: [12, 71, 9, 8], avgTimeSec: 29, difficultyIndex: 0.71 },
    createdAt: "2026-05-11",
    updatedAt: "2026-09-06"
  },
  {
    id: "tb-bio-11",
    track: "medicine",
    subject: "biochemistry",
    topicPath: ["\u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u0633\u0645 \u06A9\u0631\u0628\u0648\u0647\u06CC\u062F\u0631\u0627\u062A", "\u06AF\u0644\u06CC\u06A9\u0648\u0644\u06CC\u0632 \u0648 \u06AF\u0644\u0648\u06A9\u0648\u0646\u0626\u0648\u0698\u0646\u0632"],
    type: "memorization",
    difficulty: "medium",
    year: 1404,
    source: "tapesh",
    tags: ["\u0645\u0646\u062A\u062E\u0628"],
    stem: "\u062F\u0631 \u06AF\u0644\u0648\u06A9\u0648\u0646\u0626\u0648\u0698\u0646\u0632\u060C \u06A9\u062F\u0627\u0645 \u0622\u0646\u0632\u06CC\u0645 \u0628\u0627 \u06A9\u0631\u0628\u0648\u06A9\u0633\u06CC\u0644\u0647\u200C\u06A9\u0631\u062F\u0646 \u067E\u06CC\u0631\u0648\u0627\u062A \u0628\u0647 \u0627\u06AF\u0632\u0627\u0644\u0648\u0627\u0633\u062A\u0627\u062A \u0627\u06CC\u0646 \u0646\u0642\u0637\u0647\u0654 \u06A9\u0646\u062A\u0631\u0644 \u06AF\u0644\u06CC\u06A9\u0648\u0644\u06CC\u0632 \u0631\u0627 \u062F\u0648\u0631 \u0645\u06CC\u200C\u0632\u0646\u062F \u0648 \u06A9\u0648\u0641\u0627\u06A9\u062A\u0648\u0631 \u0622\u0646 \u0686\u06CC\u0633\u062A\u061F",
    figure: null,
    options: [
      "\u067E\u06CC\u0631\u0648\u0627\u062A \u06A9\u0631\u0628\u0648\u06A9\u0633\u06CC\u0644\u0627\u0632\u061B \u0628\u06CC\u0648\u062A\u06CC\u0646",
      "\u067E\u06CC\u0631\u0648\u0627\u062A \u062F\u0647\u06CC\u062F\u0631\u0648\u0698\u0646\u0627\u0632\u061B NAD\u207A \u0648 \u062A\u06CC\u0627\u0645\u06CC\u0646",
      "\u0641\u0633\u0641\u0648\u0641\u0631\u0648\u06A9\u062A\u0648\u06A9\u06CC\u0646\u0627\u0632-\u06F1\u061B ATP",
      "\u067E\u06CC\u0631\u0648\u0627\u062A \u06A9\u06CC\u0646\u0627\u0632\u061B \u0641\u0631\u0648\u06A9\u062A\u0648\u0632-\u06F2\u066C\u06F6-\u0628\u06CC\u0633\u200C\u0641\u0633\u0641\u0627\u062A"
    ],
    correctAnswer: 0,
    explanation: {
      summary: "\u067E\u06CC\u0631\u0648\u0627\u062A \u06A9\u0631\u0628\u0648\u06A9\u0633\u06CC\u0644\u0627\u0632 \u062F\u0631 \u0645\u06CC\u062A\u0648\u06A9\u0646\u062F\u0631\u06CC \u0628\u0627 \u06A9\u0648\u0641\u0627\u06A9\u062A\u0648\u0631 \u0628\u06CC\u0648\u062A\u06CC\u0646 \u067E\u06CC\u0631\u0648\u0627\u062A \u0631\u0627 \u0628\u0647 \u0627\u06AF\u0632\u0627\u0644\u0648\u0627\u0633\u062A\u0627\u062A \u062A\u0628\u062F\u06CC\u0644 \u0645\u06CC\u200C\u06A9\u0646\u062F\u061B \u0627\u0648\u0644\u06CC\u0646 \u0648\u0627\u06A9\u0646\u0634 \u0627\u062E\u062A\u0635\u0627\u0635\u06CC \u06AF\u0644\u0648\u06A9\u0648\u0646\u0626\u0648\u0698\u0646\u0632.",
      deep: "\u067E\u06CC\u0631\u0648\u0627\u062A \u06A9\u0631\u0628\u0648\u06A9\u0633\u06CC\u0644\u0627\u0632 \u0628\u0627 \u0628\u06CC\u0648\u062A\u06CC\u0646 (\u06A9\u0631\u0628\u0648\u06A9\u0633\u06CC\u200C\u0628\u06CC\u0648\u062A\u06CC\u0646-\u0622\u0646\u0632\u06CC\u0645) ATP \u0645\u0635\u0631\u0641 \u0645\u06CC\u200C\u06A9\u0646\u062F \u0648 \u0627\u06AF\u0632\u0627\u0644\u0648\u0627\u0633\u062A\u0627\u062A \u0645\u06CC\u200C\u0633\u0627\u0632\u062F\u061B \u0627\u06AF\u0632\u0627\u0644\u0648\u0627\u0633\u062A\u0627\u062A \u0633\u067E\u0633 \u0628\u0647 PEP \u062A\u0628\u062F\u06CC\u0644 \u0645\u06CC\u200C\u0634\u0648\u062F (PEP \u06A9\u0631\u0628\u0648\u06A9\u0633\u06CC\u200C\u06A9\u06CC\u0646\u0627\u0632). \u0627\u06CC\u0646 \u0622\u0646\u0632\u06CC\u0645 \u0628\u0627 \u0627\u0633\u062A\u06CC\u0644-CoA \u0622\u0644\u0648\u0633\u062A\u0631\u06CC \u0641\u0639\u0627\u0644 \u0645\u06CC\u200C\u0634\u0648\u062F \u2014 \u06CC\u0639\u0646\u06CC \u0648\u0642\u062A\u06CC \u0627\u0646\u0631\u0698\u06CC \u0641\u0631\u0627\u0648\u0627\u0646 \u0627\u0633\u062A\u060C \u0645\u0627\u062F\u0647\u0654 \u0627\u0648\u0644\u06CC\u0647\u0654 \u0633\u0627\u062E\u062A \u06AF\u0644\u0648\u06A9\u0632 \u0641\u0631\u0627\u0647\u0645 \u0645\u06CC\u200C\u0634\u0648\u062F. \u062F\u0631 \u06AF\u0644\u06CC\u06A9\u0648\u0644\u06CC\u0632\u060C \u067E\u06CC\u0631\u0648\u0627\u062A \u06A9\u06CC\u0646\u0627\u0632 \u0647\u0645\u0627\u0646 \u0648\u0627\u06A9\u0646\u0634 \u0628\u0631\u06AF\u0634\u062A\u200C\u0646\u0627\u067E\u0630\u06CC\u0631 \u0631\u0627 \u062F\u0631 \u062C\u0647\u062A \u0645\u062E\u0627\u0644\u0641 \u0627\u0646\u062C\u0627\u0645 \u0645\u06CC\u200C\u062F\u0647\u062F.",
      keyPoint: "\u0633\u0647 \u062F\u0631\u0648\u0627\u0632\u0647\u0654 \u06AF\u0644\u0648\u06A9\u0648\u0646\u0626\u0648\u0698\u0646\u0632: \u067E\u06CC\u0631\u0648\u0627\u062A \u06A9\u0631\u0628\u0648\u06A9\u0633\u06CC\u0644\u0627\u0632 (\u0628\u06CC\u0648\u062A\u06CC\u0646)\u060C PEP \u06A9\u0631\u0628\u0648\u06A9\u0633\u06CC\u200C\u06A9\u06CC\u0646\u0627\u0632\u060C \u0641\u0631\u0648\u06A9\u062A\u0648\u0632-\u06F1\u066C\u06F6-\u0628\u06CC\u0633\u200C\u0641\u0633\u0641\u0627\u062A\u0627\u0632 \u0648 \u06AF\u0644\u0648\u06A9\u0632-\u06F6-\u0641\u0633\u0641\u0627\u062A\u0627\u0632.",
      trap: "\u06A9\u0645\u0628\u0648\u062F \u0628\u06CC\u0648\u062A\u06CC\u0646 (\u06CC\u0627 \u0622\u0646\u062A\u06CC\u200C\u0628\u06CC\u0648\u062A\u06CC\u06A9\u200C\u0647\u0627\u06CC \u0645\u0647\u0627\u0631\u06A9\u0646\u0646\u062F\u0647\u0654 \u062C\u0630\u0628 \u0628\u06CC\u0648\u062A\u06CC\u0646) \u062F\u0642\u06CC\u0642\u0627\u064B \u0647\u0645\u06CC\u0646 \u0648\u0627\u06A9\u0646\u0634 \u0631\u0627 \u0645\u06CC\u200C\u062E\u0648\u0627\u0628\u0627\u0646\u062F \u0648 \u0627\u0633\u06CC\u062F\u0648\u0632 \u0644\u0627\u06A9\u062A\u06CC\u06A9 \u0645\u06CC\u200C\u062F\u0647\u062F.",
      whyWrong: [
        { index: 1, text: "\u067E\u06CC\u0631\u0648\u0627\u062A \u062F\u0647\u06CC\u062F\u0631\u0648\u0698\u0646\u0627\u0632 \u067E\u06CC\u0631\u0648\u0627\u062A \u0631\u0627 \u0628\u0647 \u0627\u0633\u062A\u06CC\u0644-CoA \u0645\u06CC\u200C\u0628\u0631\u062F (\u0648\u0631\u0648\u062F \u0628\u0647 \u06A9\u0631\u0628\u0633)\u060C \u0646\u0647 \u0628\u0647 \u0627\u06AF\u0632\u0627\u0644\u0648\u0627\u0633\u062A\u0627\u062A." },
        { index: 2, text: "PFK-1 \u0622\u0646\u0632\u06CC\u0645 \u06AF\u0644\u06CC\u06A9\u0648\u0644\u06CC\u0632 \u0627\u0633\u062A \u0648 \u062F\u0631 \u06AF\u0644\u0648\u06A9\u0648\u0646\u0626\u0648\u0698\u0646\u0632 \u0628\u0627 \u0641\u0631\u0648\u06A9\u062A\u0648\u0632-\u06F1\u066C\u06F6-\u0628\u06CC\u0633\u200C\u0641\u0633\u0641\u0627\u062A\u0627\u0632 \u062F\u0648\u0631 \u0632\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F." },
        { index: 3, text: "\u067E\u06CC\u0631\u0648\u0627\u062A \u06A9\u06CC\u0646\u0627\u0632 \u0622\u0646\u0632\u06CC\u0645 \u06AF\u0644\u06CC\u06A9\u0648\u0644\u06CC\u0632 \u0627\u0633\u062A\u061B \u062F\u0648\u0631 \u0632\u062F\u0646 \u0622\u0646 \u06A9\u0627\u0631 PEP \u06A9\u0631\u0628\u0648\u06A9\u0633\u06CC\u200C\u06A9\u06CC\u0646\u0627\u0632 \u0627\u0633\u062A." }
      ]
    },
    stats: { solves: 1671, correctPercent: 59, optionPercents: [59, 21, 12, 8], avgTimeSec: 36, difficultyIndex: 0.59 },
    createdAt: "2026-05-18",
    updatedAt: "2026-09-07"
  },
  {
    id: "tb-imm-01",
    track: "medicine",
    subject: "immunology",
    topicPath: ["\u067E\u0627\u0633\u062E \u0627\u06CC\u0645\u0646\u06CC \u0647\u0648\u0645\u0648\u0631\u0627\u0644", "\u0627\u06CC\u0645\u0648\u0646\u0648\u06AF\u0644\u0648\u0628\u0648\u0644\u06CC\u0646\u200C\u0647\u0627"],
    type: "memorization",
    difficulty: "easy",
    year: 1404,
    source: "tapesh",
    tags: ["\u067E\u0631\u062A\u06A9\u0631\u0627\u0631"],
    stem: "\u0622\u0646\u062A\u06CC\u200C\u0628\u0627\u062F\u06CC \u063A\u0627\u0644\u0628 \u062F\u0631 \u062A\u0631\u0634\u062D\u0627\u062A \u0645\u062E\u0627\u0637\u06CC (\u0628\u0632\u0627\u0642\u060C \u0634\u06CC\u0631 \u0645\u0627\u062F\u0631\u060C \u062A\u0631\u0634\u062D \u0628\u06CC\u0646\u06CC) \u06A9\u062F\u0627\u0645 \u0627\u0633\u062A \u0648 \u0648\u06CC\u0698\u06AF\u06CC \u0633\u0627\u062E\u062A\u0627\u0631\u06CC \u0622\u0646 \u0686\u06CC\u0633\u062A\u061F",
    figure: null,
    options: [
      "IgM\u061B \u067E\u0646\u062A\u0627\u0645\u0631 \u0645\u062A\u0635\u0644 \u0628\u0627 \u0632\u0646\u062C\u06CC\u0631\u0647\u0654 J",
      "IgA \u062A\u0631\u0634\u062D\u06CC\u061B \u062F\u0627\u06CC\u0645\u0631 \u0645\u062A\u0635\u0644 \u0628\u0627 \u0632\u0646\u062C\u06CC\u0631\u0647\u0654 J \u0648 \u0642\u0637\u0639\u0647\u0654 \u062A\u0631\u0634\u062D\u06CC",
      "IgG\u061B \u0645\u0648\u0646\u0648\u0645\u0631 \u0628\u0627 \u062A\u0648\u0627\u0646 \u0639\u0628\u0648\u0631 \u0627\u0632 \u062C\u0641\u062A",
      "IgE\u061B \u0645\u0648\u0646\u0648\u0645\u0631 \u0645\u062A\u0635\u0644 \u0628\u0647 \u06AF\u06CC\u0631\u0646\u062F\u0647\u0654 \u0645\u0627\u0633\u062A\u200C\u0633\u0644"
    ],
    correctAnswer: 1,
    explanation: {
      summary: "IgA \u062A\u0631\u0634\u062D\u06CC \u062F\u0627\u06CC\u0645\u0631\u06CC \u0627\u0633\u062A \u06A9\u0647 \u0628\u0627 \u0632\u0646\u062C\u06CC\u0631\u0647\u0654 J \u0628\u0647 \u0647\u0645 \u0645\u06CC\u200C\u067E\u06CC\u0648\u0646\u062F\u062F \u0648 \u0628\u0627 \u0642\u0637\u0639\u0647\u0654 \u062A\u0631\u0634\u062D\u06CC (SC) \u062F\u0631 \u0628\u0631\u0627\u0628\u0631 \u067E\u0631\u0648\u062A\u0626\u0627\u0632\u0647\u0627\u06CC \u0645\u062E\u0627\u0637\u06CC \u0645\u062D\u0627\u0641\u0638\u062A \u0645\u06CC\u200C\u0634\u0648\u062F.",
      deep: "\u067E\u0644\u0627\u0633\u0645\u0627\u0633\u0644\u200C\u0647\u0627\u06CC \u0632\u06CC\u0631\u0627\u067E\u06CC\u062A\u0644\u06CC\u0627\u0644 IgA \u062F\u0627\u06CC\u0645\u0631 (\u062F\u0648 \u0645\u0648\u0646\u0648\u0645\u0631 + \u0632\u0646\u062C\u06CC\u0631\u0647\u0654 J) \u0645\u06CC\u200C\u0633\u0627\u0632\u0646\u062F\u061B \u0627\u06CC\u0646 \u06A9\u0645\u067E\u0644\u06A9\u0633 \u0628\u0627 \u06AF\u06CC\u0631\u0646\u062F\u0647\u0654 \u067E\u0644\u06CC-IgR \u0627\u0632 \u0633\u0644\u0648\u0644 \u0627\u067E\u06CC\u062A\u0644\u06CC\u0627\u0644 \u0639\u0628\u0648\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F \u0648 \u0628\u062E\u0634\u06CC \u0627\u0632 \u06AF\u06CC\u0631\u0646\u062F\u0647 \u0628\u0647\u200C\u0639\u0646\u0648\u0627\u0646 \u0642\u0637\u0639\u0647\u0654 \u062A\u0631\u0634\u062D\u06CC \u0628\u0647 \u0622\u0646 \u0645\u06CC\u200C\u0686\u0633\u0628\u062F. IgA \u062A\u0631\u0634\u062D\u06CC \u0645\u06A9\u0627\u0646\u06CC\u0633\u0645 \u0627\u0635\u0644\u06CC \u0627\u06CC\u0645\u0646\u06CC \u0645\u062E\u0627\u0637\u06CC \u0627\u0633\u062A \u0648 \u0627\u0632 \u0686\u0633\u0628\u06CC\u062F\u0646 \u067E\u0627\u062A\u0648\u0698\u0646 \u0628\u0647 \u0627\u067E\u06CC\u062A\u0644\u06CC\u0648\u0645 \u062C\u0644\u0648\u06AF\u06CC\u0631\u06CC \u0645\u06CC\u200C\u06A9\u0646\u062F (\u062D\u0630\u0641 \u0627\u06CC\u0645\u0646\u06CC). IgM \u062A\u0646\u0647\u0627 \u0627\u06CC\u0645\u0648\u0646\u0648\u06AF\u0644\u0648\u0628\u0648\u0644\u06CC\u0646 \u067E\u0646\u062A\u0627\u0645\u0631\u06CC \u0627\u0633\u062A\u061B IgG \u0628\u0627 FcRn \u0627\u0632 \u062C\u0641\u062A \u0645\u06CC\u200C\u06AF\u0630\u0631\u062F \u0648 IgE \u0628\u0647 \u0645\u0627\u0633\u062A\u200C\u0633\u0644 \u0645\u06CC\u200C\u0686\u0633\u0628\u062F.",
      keyPoint: "IgA \u062A\u0631\u0634\u062D\u06CC = \u062F\u0627\u06CC\u0645\u0631 + \u0632\u0646\u062C\u06CC\u0631\u0647\u0654 J + \u0642\u0637\u0639\u0647\u0654 \u062A\u0631\u0634\u062D\u06CC | IgM = \u067E\u0646\u062A\u0627\u0645\u0631 | IgG = \u0639\u0628\u0648\u0631 \u0627\u0632 \u062C\u0641\u062A.",
      trap: "\u0632\u0646\u062C\u06CC\u0631\u0647\u0654 J \u0647\u0645 \u062F\u0631 IgM \u0648 \u0647\u0645 \u062F\u0631 IgA \u062F\u0627\u06CC\u0645\u0631 \u0648\u062C\u0648\u062F \u062F\u0627\u0631\u062F\u061B \u062A\u0641\u06A9\u06CC\u06A9\u200C\u06A9\u0646\u0646\u062F\u0647\u0654 \u0627\u0635\u0644\u06CC IgA \u062A\u0631\u0634\u062D\u06CC \xAB\u0642\u0637\u0639\u0647\u0654 \u062A\u0631\u0634\u062D\u06CC\xBB \u0627\u0633\u062A.",
      whyWrong: [
        { index: 0, text: "IgM \u067E\u0646\u062A\u0627\u0645\u0631\u06CC \u0627\u0633\u062A \u0648 \u062F\u0631 \u062A\u0631\u0634\u062D\u0627\u062A \u0645\u062E\u0627\u0637\u06CC \u0622\u0646\u062A\u06CC\u200C\u0628\u0627\u062F\u06CC \u063A\u0627\u0644\u0628 \u0646\u06CC\u0633\u062A." },
        { index: 2, text: "IgG \u0639\u0645\u062F\u062A\u0627\u064B \u062F\u0631 \u0633\u0631\u0645 \u0648 \u0645\u0627\u06CC\u0639 \u0628\u06CC\u0646\u200C\u0628\u0627\u0641\u062A\u06CC \u0627\u0633\u062A \u0648 \u0627\u0632 \u062C\u0641\u062A \u0645\u06CC\u200C\u06AF\u0630\u0631\u062F." },
        { index: 3, text: "IgE \u0628\u0627 \u0622\u0644\u0631\u0698\u06CC \u0648 \u0627\u0646\u06AF\u0644 \u0645\u0631\u062A\u0628\u0637 \u0627\u0633\u062A\u060C \u0646\u0647 \u0627\u06CC\u0645\u0646\u06CC \u0645\u062E\u0627\u0637\u06CC \u063A\u0627\u0644\u0628." }
      ]
    },
    stats: { solves: 3102, correctPercent: 76, optionPercents: [10, 76, 8, 6], avgTimeSec: 24, difficultyIndex: 0.76 },
    createdAt: "2026-05-22",
    updatedAt: "2026-09-08"
  },
  {
    id: "tb-mic-01",
    track: "medicine",
    subject: "microbiology",
    topicPath: ["\u0628\u0627\u06A9\u062A\u0631\u06CC\u200C\u0647\u0627\u06CC \u06AF\u0631\u0645 \u0645\u062B\u0628\u062A", "\u0627\u0633\u062A\u0627\u0641\u06CC\u0644\u0648\u06A9\u0648\u06A9"],
    type: "concept",
    difficulty: "medium",
    year: 1404,
    source: "tapesh",
    tags: ["\u0645\u0646\u062A\u062E\u0628"],
    stem: "\u0645\u0637\u0645\u0626\u0646\u200C\u062A\u0631\u06CC\u0646 \u0622\u0632\u0645\u0648\u0646 \u0622\u0632\u0645\u0627\u06CC\u0634\u06AF\u0627\u0647\u06CC \u0628\u0631\u0627\u06CC \u062A\u0641\u06A9\u06CC\u06A9 \u0627\u0633\u062A\u0627\u0641\u06CC\u0644\u0648\u06A9\u0648\u06A9\u0648\u0633 \u0627\u0648\u0631\u0626\u0648\u0633 \u0627\u0632 \u0633\u0627\u06CC\u0631 \u06AF\u0648\u0646\u0647\u200C\u0647\u0627\u06CC \u06A9\u0648\u0622\u06AF\u0648\u0644\u0627\u0632-\u0645\u0646\u0641\u06CC \u0627\u06CC\u0646 \u062C\u0646\u0633 \u06A9\u062F\u0627\u0645 \u0627\u0633\u062A\u061F",
    figure: null,
    options: [
      "\u06A9\u0627\u062A\u0627\u0644\u0627\u0632 \u0645\u062B\u0628\u062A \u0628\u0648\u062F\u0646",
      "\u0622\u0632\u0645\u0648\u0646 \u06A9\u0648\u0622\u06AF\u0648\u0644\u0627\u0632 (\u0644\u062E\u062A\u0647\u200C\u0634\u062F\u0646 \u067E\u0644\u0627\u0633\u0645\u0627)",
      "\u0647\u0645\u0648\u0644\u06CC\u0632 \u0628\u062A\u0627 \u0631\u0648\u06CC \u0628\u0644\u0627\u062F \u0622\u06AF\u0627\u0631",
      "\u0631\u0634\u062F \u0631\u0648\u06CC \u0645\u062D\u06CC\u0637 \u0645\u0627\u0646\u06CC\u062A\u0648\u0644 \u0633\u0627\u0644\u062A \u0622\u06AF\u0627\u0631"
    ],
    correctAnswer: 1,
    explanation: {
      summary: "\u06A9\u0648\u0622\u06AF\u0648\u0644\u0627\u0632 \u0622\u0646\u0632\u06CC\u0645\u06CC \u0627\u0633\u062A \u06A9\u0647 \u0641\u06CC\u0628\u0631\u06CC\u0646\u0648\u0698\u0646 \u0631\u0627 \u0628\u0647 \u0641\u06CC\u0628\u0631\u06CC\u0646 \u062A\u0628\u062F\u06CC\u0644 \u0645\u06CC\u200C\u06A9\u0646\u062F\u061B \u0627\u0633\u062A\u0627\u0641 \u0627\u0648\u0631\u0626\u0648\u0633 \u06A9\u0648\u0622\u06AF\u0648\u0644\u0627\u0632-\u0645\u062B\u0628\u062A \u0648 \u0628\u0642\u06CC\u0647\u0654 \u06AF\u0648\u0646\u0647\u200C\u0647\u0627 \u06A9\u0648\u0622\u06AF\u0648\u0644\u0627\u0632-\u0645\u0646\u0641\u06CC\u200C\u0627\u0646\u062F.",
      deep: "\u06A9\u0648\u0622\u06AF\u0648\u0644\u0627\u0632 (\u0686\u0647 \u0622\u0632\u0627\u062F \u0648 \u0686\u0647 \u0645\u062A\u0635\u0644 \u0628\u0647 \u062F\u06CC\u0648\u0627\u0631\u0647) \u067E\u0644\u0627\u0633\u0645\u0627\u06CC \u0627\u0646\u0633\u0627\u0646\u06CC \u0631\u0627 \u0644\u062E\u062A\u0647 \u0645\u06CC\u200C\u06A9\u0646\u062F \u0648 \u067E\u0627\u0633\u062E \u0642\u0637\u0639\u06CC \u0628\u0631\u0627\u06CC \u0634\u0646\u0627\u0633\u0627\u06CC\u06CC S. aureus \u0627\u0633\u062A. \u06A9\u0627\u062A\u0627\u0644\u0627\u0632 \u0628\u06CC\u0646 \u0627\u0633\u062A\u0627\u0641 \u0648 \u0627\u0633\u062A\u0631\u067E\u062A\u0648\u06A9\u0648\u06A9 \u062A\u0641\u06A9\u06CC\u06A9 \u0645\u06CC\u200C\u06A9\u0646\u062F (\u0627\u0633\u062A\u0627\u0641 \u0645\u062B\u0628\u062A)\u060C \u067E\u0633 \u062F\u0631 \u0633\u0637\u062D \u062C\u0646\u0633 \u0627\u0633\u062A \u0646\u0647 \u06AF\u0648\u0646\u0647. \u0647\u0645\u0648\u0644\u06CC\u0632 \u0628\u062A\u0627 \u062F\u0631 \u0628\u0631\u062E\u06CC \u06AF\u0648\u0646\u0647\u200C\u0647\u0627 \u062F\u06CC\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u0627\u062E\u062A\u0635\u0627\u0635\u06CC \u0646\u06CC\u0633\u062A\u061B \u0631\u0634\u062F \u0631\u0648\u06CC \u0645\u0627\u0646\u06CC\u062A\u0648\u0644 \u0633\u0627\u0644\u062A \u0622\u06AF\u0627\u0631 \u0622\u0632\u0645\u0648\u0646 \u063A\u0631\u0628\u0627\u0644\u06AF\u0631\u06CC \u0645\u0641\u06CC\u062F\u06CC \u0627\u0633\u062A \u0648\u0644\u06CC \u0628\u0631\u062E\u06CC \u06AF\u0648\u0646\u0647\u200C\u0647\u0627\u06CC \u06A9\u0648\u0622\u06AF\u0648\u0644\u0627\u0632-\u0645\u0646\u0641\u06CC \u0647\u0645 \u0645\u0627\u0646\u06CC\u062A\u0648\u0644 \u0631\u0627 \u062A\u062E\u0645\u06CC\u0631 \u0645\u06CC\u200C\u06A9\u0646\u0646\u062F.",
      keyPoint: "\u06A9\u0627\u062A\u0627\u0644\u0627\u0632 \u2192 \u062A\u0641\u06A9\u06CC\u06A9 \u062C\u0646\u0633 (\u0627\u0633\u062A\u0627\u0641 \u0627\u0632 \u0627\u0633\u062A\u0631\u067E) | \u06A9\u0648\u0622\u06AF\u0648\u0644\u0627\u0632 \u2192 \u062A\u0641\u06A9\u06CC\u06A9 S. aureus \u0627\u0632 \u0633\u0627\u06CC\u0631 \u0627\u0633\u062A\u0627\u0641\u200C\u0647\u0627.",
      trap: "\u0645\u0627\u0646\u06CC\u062A\u0648\u0644 \u0633\u0627\u0644\u062A \u0622\u06AF\u0627\u0631 \xAB\u0627\u0646\u062A\u062E\u0627\u0628\u06CC-\u062A\u0641\u0631\u06CC\u0642\u06CC\xBB \u0627\u0633\u062A \u0648 \u0628\u0631\u0627\u06CC \u063A\u0631\u0628\u0627\u0644\u06AF\u0631\u06CC \u062E\u0648\u0628 \u0627\u0633\u062A\u060C \u0627\u0645\u0627 \u0628\u0631\u0627\u06CC \u062A\u0634\u062E\u06CC\u0635 \u0642\u0637\u0639\u06CC \u06A9\u0648\u0622\u06AF\u0648\u0644\u0627\u0632 \u0627\u0633\u062A\u0627\u0646\u062F\u0627\u0631\u062F \u0637\u0644\u0627\u06CC\u06CC \u0645\u062D\u0633\u0648\u0628 \u0645\u06CC\u200C\u0634\u0648\u062F.",
      whyWrong: [
        { index: 0, text: "\u06A9\u0627\u062A\u0627\u0644\u0627\u0632 \u0645\u062B\u0628\u062A \u0628\u0648\u062F\u0646 \u062F\u0631 \u0647\u0645\u0647\u0654 \u0627\u0633\u062A\u0627\u0641\u06CC\u0644\u0648\u06A9\u0648\u06A9\u200C\u0647\u0627 (\u0627\u0632 \u062C\u0645\u0644\u0647 \u06A9\u0648\u0622\u06AF\u0648\u0644\u0627\u0632-\u0645\u0646\u0641\u06CC\u200C\u0647\u0627) \u062F\u06CC\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F." },
        { index: 2, text: "\u0647\u0645\u0648\u0644\u06CC\u0632 \u0628\u062A\u0627 \u062F\u0631 \u0686\u0646\u062F \u06AF\u0648\u0646\u0647\u0654 \u062F\u06CC\u06AF\u0631 \u0647\u0645 \u062F\u06CC\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u0627\u062E\u062A\u0635\u0627\u0635\u06CC \u0646\u06CC\u0633\u062A." },
        { index: 3, text: "\u0627\u06CC\u0646 \u0645\u062D\u06CC\u0637 \u063A\u0631\u0628\u0627\u0644\u06AF\u0631\u06CC \u0627\u0633\u062A \u0648 \u062A\u0639\u062F\u0627\u062F\u06CC \u0627\u0632 \u06A9\u0648\u0622\u06AF\u0648\u0644\u0627\u0632-\u0645\u0646\u0641\u06CC\u200C\u0647\u0627 \u0647\u0645 \u0631\u0648\u06CC \u0622\u0646 \u062A\u062E\u0645\u06CC\u0631 \u0645\u06CC\u200C\u062F\u0647\u0646\u062F." }
      ]
    },
    stats: { solves: 2760, correctPercent: 68, optionPercents: [19, 68, 7, 6], avgTimeSec: 27, difficultyIndex: 0.68 },
    createdAt: "2026-05-26",
    updatedAt: "2026-09-09"
  },
  /* ═══════════════ علوم پایه دندان‌پزشکی ═══════════════ */
  {
    id: "tb-den-01",
    track: "dentistry",
    subject: "anatomy",
    topicPath: ["\u0633\u0631 \u0648 \u06AF\u0631\u062F\u0646", "\u0639\u0635\u0628 \u0633\u0647\u200C\u0642\u0644\u0648 \u0648 \u0634\u0627\u062E\u0647\u200C\u0647\u0627"],
    type: "memorization",
    difficulty: "medium",
    year: 1403,
    source: "official",
    tags: ["\u067E\u0631\u062A\u06A9\u0631\u0627\u0631"],
    stem: "\u0639\u0635\u0628 \u0622\u0644\u0648\u0626\u0648\u0644\u0627\u0631 \u062A\u062D\u062A\u0627\u0646\u06CC (IAN) \u0634\u0627\u062E\u0647\u0654 \u06A9\u062F\u0627\u0645 \u062A\u0642\u0633\u06CC\u0645 \u0639\u0635\u0628 \u0633\u0647\u200C\u0642\u0644\u0648 \u0627\u0633\u062A \u0648 \u0627\u0632 \u06A9\u062F\u0627\u0645 \u0645\u0633\u06CC\u0631 \u0639\u0628\u0648\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F\u061F",
    figure: null,
    options: [
      "\u0634\u0627\u062E\u0647\u0654 V2 (\u0645\u0627\u06AF\u0632\u06CC\u0644\u0627\u0631\u06CC)\u061B \u0627\u0632 \u0633\u06CC\u0646\u0648\u0633 \u0645\u0627\u06AF\u0632\u06CC\u0644\u0627\u0631\u06CC",
      "\u0634\u0627\u062E\u0647\u0654 V3 (\u0645\u0627\u0646\u062F\u06CC\u0628\u0648\u0644\u0627\u0631)\u061B \u0627\u0632 \u06A9\u0627\u0646\u0627\u0644 \u0645\u0627\u0646\u062F\u06CC\u0628\u0648\u0644",
      "\u0634\u0627\u062E\u0647\u0654 V1 (\u0627\u0641\u062A\u0627\u0644\u0645\u06CC\u06A9)\u061B \u0627\u0632 \u0634\u06A9\u0627\u0641 \u0627\u0648\u0631\u0628\u06CC\u062A\u0627\u0644 \u0641\u0648\u0642\u0627\u0646\u06CC",
      "\u0634\u0627\u062E\u0647\u0654 V3\u061B \u0627\u0632 \u0633\u0648\u0631\u0627\u062E \u0645\u0650\u0646\u062A\u0627\u0644 \u0628\u0647 \u0633\u0645\u062A \u062F\u0627\u062E\u0644"
    ],
    correctAnswer: 1,
    explanation: {
      summary: "IAN \u0627\u0632 \u062A\u0642\u0633\u06CC\u0645 \u0645\u0627\u0646\u062F\u06CC\u0628\u0648\u0644\u0627\u0631 (V3) \u062C\u062F\u0627 \u0645\u06CC\u200C\u0634\u0648\u062F\u060C \u0627\u0632 \u0633\u0648\u0631\u0627\u062E \u0645\u0627\u0646\u062F\u06CC\u0628\u0648\u0644 \u0648\u0627\u0631\u062F \u06A9\u0627\u0646\u0627\u0644 \u0645\u0627\u0646\u062F\u06CC\u0628\u0648\u0644 \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u062D\u0633 \u062F\u0646\u062F\u0627\u0646\u200C\u0647\u0627\u06CC \u067E\u0627\u06CC\u06CC\u0646 \u0631\u0627 \u0645\u06CC\u200C\u062F\u0647\u062F.",
      deep: "V3 \u067E\u0633 \u0627\u0632 \u062E\u0631\u0648\u062C \u0627\u0632 \u0633\u0648\u0631\u0627\u062E \u0627\u0648\u0627\u0644\u060C \u0634\u0627\u062E\u0647\u200C\u0647\u0627\u06CC \u062D\u0631\u06A9\u062A\u06CC (\u0645\u0627\u0633\u0650\u062A\u0631\u060C \u062A\u0650\u0631\u06CC\u06AF\u0648\u06CC\u06CC\u062F \u062F\u0627\u062E\u0644\u06CC \u0648 \u062E\u0627\u0631\u062C\u06CC\u060C \u067E\u062A\u0631\u06CC\u06AF\u0648\u06CC\u06CC\u062F) \u0648 \u062D\u0633\u06CC (\u0628\u0648\u06A9\u0627\u0644\u060C \u0644\u06CC\u0646\u06AF\u0648\u0627\u0644\u060C \u0622\u0644\u0648\u0626\u0648\u0644\u0627\u0631 \u062A\u062D\u062A\u0627\u0646\u06CC\u060C \u0627\u0648\u0631\u06CC\u06A9\u0648\u0644\u0648\u062A\u0650\u0631\u0645\u067E\u0648\u0631\u0627\u0644) \u0645\u06CC\u200C\u062F\u0647\u062F. IAN \u0647\u0645\u0631\u0627\u0647 \u0634\u0631\u06CC\u0627\u0646 \u0648 \u0648\u0631\u06CC\u062F \u0622\u0644\u0648\u0626\u0648\u0644\u0627\u0631 \u062A\u062D\u062A\u0627\u0646\u06CC \u062F\u0631 \u06A9\u0627\u0646\u0627\u0644 \u0645\u0627\u0646\u062F\u06CC\u0628\u0648\u0644 \u062D\u0631\u06A9\u062A \u0645\u06CC\u200C\u06A9\u0646\u062F \u0648 \u062F\u0631 \u0646\u0627\u062D\u06CC\u0647\u0654 \u067E\u0631\u0645\u0648\u0644\u0627\u0631 \u0628\u0647 \u062F\u0648 \u0634\u0627\u062E\u0647\u0654 \u0645\u0650\u0646\u062A\u0627\u0644 (\u062D\u0633 \u0686\u0627\u0646\u0647 \u0648 \u0644\u0628 \u067E\u0627\u06CC\u06CC\u0646) \u0648 \u0627\u06CC\u0646\u0633\u06CC\u0632\u06CC\u0648 (\u062D\u0633 \u062F\u0646\u062F\u0627\u0646\u200C\u0647\u0627\u06CC \u0642\u062F\u0627\u0645\u06CC) \u062A\u0642\u0633\u06CC\u0645 \u0645\u06CC\u200C\u0634\u0648\u062F. \u0628\u06CC\u200C\u062D\u0633\u06CC IAN \u062F\u0631 \u062C\u0631\u0627\u062D\u06CC \u062F\u0646\u062F\u0627\u0646 \u0639\u0642\u0644 \u0648 \u0627\u06CC\u0645\u067E\u0644\u0646\u062A \u0627\u0647\u0645\u06CC\u062A \u0628\u0627\u0644\u06CC\u0646\u06CC \u0632\u06CC\u0627\u062F\u06CC \u062F\u0627\u0631\u062F.",
      keyPoint: "V1 = \u0686\u0634\u0645 \u0648 \u0628\u06CC\u0646\u06CC | V2 = \u06AF\u0648\u0646\u0647\u060C \u0628\u06CC\u0646\u06CC\u060C \u062F\u0646\u062F\u0627\u0646\u200C\u0647\u0627\u06CC \u0628\u0627\u0644\u0627 | V3 = \u062F\u0646\u062F\u0627\u0646\u200C\u0647\u0627\u06CC \u067E\u0627\u06CC\u06CC\u0646\u060C \u0632\u0628\u0627\u0646\u060C \u0639\u0636\u0644\u0627\u062A \u062C\u0648\u06CC\u062F\u0646.",
      trap: "\u0639\u0635\u0628 \u0644\u06CC\u0646\u06AF\u0648\u0627\u0644 \u0647\u0645 \u0627\u0632 V3 \u0627\u0633\u062A \u0648\u0644\u06CC \u0645\u0633\u06CC\u0631\u0634 \u062C\u062F\u0627 \u0648 \u0635\u0631\u0641\u0627\u064B \u062D\u0633\u06CC \u0627\u0633\u062A\u061B \u0628\u0627 IAN \u0627\u0634\u062A\u0628\u0627\u0647 \u06AF\u0631\u0641\u062A\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F.",
      whyWrong: [
        { index: 0, text: "V2 \u0634\u0627\u062E\u0647\u0654 \u0645\u0627\u06AF\u0632\u06CC\u0644\u0627\u0631\u06CC \u0627\u0633\u062A \u0648 \u062D\u0633 \u062F\u0646\u062F\u0627\u0646\u200C\u0647\u0627\u06CC \u0628\u0627\u0644\u0627 \u0631\u0627 \u0645\u06CC\u200C\u062F\u0647\u062F." },
        { index: 2, text: "V1 \u0634\u0627\u062E\u0647\u0654 \u0627\u0641\u062A\u0627\u0644\u0645\u06CC\u06A9 \u0627\u0633\u062A \u0648 \u0628\u0647 \u062F\u0646\u062F\u0627\u0646\u200C\u0647\u0627 \u0634\u0627\u062E\u0647\u200C\u0627\u06CC \u0646\u0645\u06CC\u200C\u062F\u0647\u062F." },
        { index: 3, text: "\u0633\u0648\u0631\u0627\u062E \u0645\u0650\u0646\u062A\u0627\u0644 \u0645\u062D\u0644 \u062E\u0631\u0648\u062C IAN \u0627\u0633\u062A\u060C \u0646\u0647 \u0645\u062D\u0644 \u0648\u0631\u0648\u062F \u0622\u0646 \u0628\u0647 \u06A9\u0627\u0646\u0627\u0644." }
      ]
    },
    stats: { solves: 1988, correctPercent: 66, optionPercents: [13, 66, 8, 13], avgTimeSec: 31, difficultyIndex: 0.66 },
    createdAt: "2026-02-03",
    updatedAt: "2026-08-20"
  },
  {
    id: "tb-den-02",
    track: "dentistry",
    subject: "histology",
    topicPath: ["\u0628\u0627\u0641\u062A\u200C\u0634\u0646\u0627\u0633\u06CC \u062F\u0647\u0627\u0646 \u0648 \u062F\u0646\u062F\u0627\u0646", "\u0645\u06CC\u0646\u0627 \u0648 \u0639\u0627\u062C"],
    type: "concept",
    difficulty: "easy",
    year: 1402,
    source: "official",
    tags: ["\u067E\u0631\u062A\u06A9\u0631\u0627\u0631"],
    stem: "\u0645\u06CC\u0646\u0627\u06CC \u062F\u0646\u062F\u0627\u0646 \u062A\u0648\u0633\u0637 \u06A9\u062F\u0627\u0645 \u0633\u0644\u0648\u0644 \u0633\u0627\u062E\u062A\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u0645\u0647\u0645\u200C\u062A\u0631\u06CC\u0646 \u0648\u06CC\u0698\u06AF\u06CC \u0622\u0646 \u0646\u0633\u0628\u062A \u0628\u0647 \u0633\u0627\u06CC\u0631 \u0628\u0627\u0641\u062A\u200C\u0647\u0627\u06CC \u0628\u062F\u0646 \u0686\u06CC\u0633\u062A\u061F",
    figure: null,
    options: [
      "\u0627\u062F\u0648\u0646\u062A\u0648\u0628\u0644\u0627\u0633\u062A\u061B \u0628\u0627\u0641\u062A\u06CC \u0632\u0646\u062F\u0647 \u0628\u0627 \u0628\u0627\u0632\u0633\u0627\u0632\u06CC \u0645\u062F\u0627\u0648\u0645 \u062F\u0631 \u0637\u0648\u0644 \u0639\u0645\u0631",
      "\u0622\u0645\u0644\u0648\u0628\u0644\u0627\u0633\u062A\u061B \u0633\u062E\u062A\u200C\u062A\u0631\u06CC\u0646 \u0628\u0627\u0641\u062A \u0628\u062F\u0646 \u0648 \u0628\u062F\u0648\u0646 \u062A\u0648\u0627\u0646 \u0628\u0627\u0632\u0633\u0627\u0632\u06CC \u067E\u0633 \u0627\u0632 \u062A\u06A9\u0627\u0645\u0644",
      "\u0633\u0645\u0646\u062A\u0648\u0628\u0644\u0627\u0633\u062A\u061B \u0628\u0627\u0641\u062A\u06CC \u0634\u0628\u06CC\u0647 \u0627\u0633\u062A\u062E\u0648\u0627\u0646 \u0628\u0627 \u0639\u0631\u0648\u0642 \u0641\u0631\u0627\u0648\u0627\u0646",
      "\u0641\u06CC\u0628\u0631\u0648\u0628\u0644\u0627\u0633\u062A \u067E\u0627\u0644\u067E\u061B \u0645\u06CC\u0646\u0627\u06CC \u062B\u0627\u0646\u0648\u06CC\u0647 \u0631\u0627 \u062F\u0631 \u062A\u0645\u0627\u0645 \u0639\u0645\u0631 \u0645\u06CC\u200C\u0633\u0627\u0632\u062F"
    ],
    correctAnswer: 1,
    explanation: {
      summary: "\u0622\u0645\u0644\u0648\u0628\u0644\u0627\u0633\u062A\u200C\u0647\u0627 \u0645\u06CC\u0646\u0627 \u0631\u0627 \u0645\u06CC\u200C\u0633\u0627\u0632\u0646\u062F\u061B \u067E\u0633 \u0627\u0632 \u062A\u06A9\u0627\u0645\u0644 \u0648 \u0631\u0648\u06CC\u0634 \u062F\u0646\u062F\u0627\u0646 \u0627\u06CC\u0646 \u0633\u0644\u0648\u0644\u200C\u0647\u0627 \u0627\u0632 \u0628\u06CC\u0646 \u0645\u06CC\u200C\u0631\u0648\u0646\u062F\u060C \u067E\u0633 \u0645\u06CC\u0646\u0627 \u0628\u0627\u0632\u0633\u0627\u0632\u06CC \u0646\u0645\u06CC\u200C\u0634\u0648\u062F.",
      deep: "\u0622\u0645\u0644\u0648\u0628\u0644\u0627\u0633\u062A\u200C\u0647\u0627 \u0628\u0647\u200C\u0635\u0648\u0631\u062A \u0644\u0627\u06CC\u0647\u200C\u0627\u06CC \u0627\u0632 \u0633\u0637\u062D \u0628\u0647 \u0639\u0645\u0642 \u0645\u06CC\u0646\u0627 \u0631\u0627 \u0645\u06CC\u200C\u0633\u0627\u0632\u0646\u062F \u0648 \u0628\u0627 \u0627\u062A\u0645\u0627\u0645 \u0622\u0645\u06CC\u200C\u0644\u0648\u0698\u0646\u0650\u0632\u060C \u062F\u0631 \u0645\u0631\u062D\u0644\u0647\u0654 \u0631\u0648\u06CC\u0634 \u0627\u0632 \u0628\u06CC\u0646 \u0645\u06CC\u200C\u0631\u0648\u0646\u062F\u061B \u0628\u0647 \u0647\u0645\u06CC\u0646 \u062F\u0644\u06CC\u0644 \u0645\u06CC\u0646\u0627\u06CC \u0628\u0627\u0644\u063A \u0633\u0644\u0648\u0644 \u0646\u062F\u0627\u0631\u062F \u0648 \u0636\u0627\u06CC\u0639\u0627\u062A \u0622\u0646 (\u067E\u0648\u0633\u06CC\u062F\u06AF\u06CC\u060C \u0633\u0627\u06CC\u0634) \u062E\u0648\u062F\u0628\u0647\u200C\u062E\u0648\u062F \u062A\u0631\u0645\u06CC\u0645 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F. \u062F\u0631 \u0645\u0642\u0627\u0628\u0644\u060C \u0639\u0627\u062C \u062A\u0648\u0633\u0637 \u0627\u062F\u0648\u0646\u062A\u0648\u0628\u0644\u0627\u0633\u062A\u200C\u0647\u0627 \u0633\u0627\u062E\u062A\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F \u06A9\u0647 \u067E\u0633 \u0627\u0632 \u0631\u0648\u06CC\u0634 \u0647\u0645 \u0628\u0627\u0642\u06CC \u0645\u06CC\u200C\u0645\u0627\u0646\u0646\u062F \u0648 \u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u0646\u062F \u0639\u0627\u062C \u062B\u0627\u0646\u0648\u06CC\u0647 \u0648 \u062A\u0631\u0645\u06CC\u0645\u06CC \u0628\u0633\u0627\u0632\u0646\u062F.",
      keyPoint: "\u0645\u06CC\u0646\u0627 = \u0622\u0645\u0644\u0648\u0628\u0644\u0627\u0633\u062A (\u067E\u0627\u06CC\u0627\u0646\u200C\u067E\u0630\u06CC\u0631\u060C \u0628\u062F\u0648\u0646 \u0628\u0627\u0632\u0633\u0627\u0632\u06CC) | \u0639\u0627\u062C = \u0627\u062F\u0648\u0646\u062A\u0648\u0628\u0644\u0627\u0633\u062A (\u0642\u0627\u0628\u0644 \u0628\u0627\u0632\u0633\u0627\u0632\u06CC).",
      trap: "\u0633\u062E\u062A\u200C\u062A\u0631\u06CC\u0646 \u0628\u0627\u0641\u062A \u0628\u062F\u0646 \u0645\u06CC\u0646\u0627\u0633\u062A\u060C \u0627\u0645\u0627 \u0628\u06CC\u0634\u062A\u0631\u06CC\u0646 \u0627\u0633\u062A\u062D\u06A9\u0627\u0645 \u06A9\u0634\u0634\u06CC \u0648 \u062A\u0648\u0627\u0646 \u062A\u0631\u0645\u06CC\u0645 \u0645\u062A\u0639\u0644\u0642 \u0628\u0647 \u0639\u0627\u062C \u0627\u0633\u062A.",
      whyWrong: [
        { index: 0, text: "\u0627\u062F\u0648\u0646\u062A\u0648\u0628\u0644\u0627\u0633\u062A \u0639\u0627\u062C \u0645\u06CC\u200C\u0633\u0627\u0632\u062F \u0648 \u0645\u06CC\u0646\u0627 \u0628\u0627\u0632\u0633\u0627\u0632\u06CC \u0646\u0645\u06CC\u200C\u0634\u0648\u062F." },
        { index: 2, text: "\u0633\u0645\u0646\u062A\u0648\u0628\u0644\u0627\u0633\u062A \u0633\u0650\u0645\u0627\u0646 \u0631\u06CC\u0634\u0647 \u0631\u0627 \u0645\u06CC\u200C\u0633\u0627\u0632\u062F\u061B \u0633\u0650\u0645\u0627\u0646 \u0639\u0631\u0648\u0642 \u0646\u062F\u0627\u0631\u062F." },
        { index: 3, text: "\u067E\u0627\u0644\u067E \u0645\u06CC\u0646\u0627 \u0646\u0645\u06CC\u200C\u0633\u0627\u0632\u062F\u061B \u062A\u0646\u0647\u0627 \u0639\u0627\u062C \u062B\u0627\u0646\u0648\u06CC\u0647/\u062A\u0631\u0645\u06CC\u0645\u06CC \u0627\u0632 \u0627\u062F\u0648\u0646\u062A\u0648\u0628\u0644\u0627\u0633\u062A\u200C\u0647\u0627\u06CC \u067E\u0627\u0644\u067E \u0645\u06CC\u200C\u0622\u06CC\u062F." }
      ]
    },
    stats: { solves: 2340, correctPercent: 74, optionPercents: [14, 74, 7, 5], avgTimeSec: 26, difficultyIndex: 0.74 },
    createdAt: "2026-02-10",
    updatedAt: "2026-08-22"
  },
  {
    id: "tb-den-03",
    track: "dentistry",
    subject: "histology",
    topicPath: ["\u0628\u0627\u0641\u062A\u200C\u0634\u0646\u0627\u0633\u06CC \u062F\u0647\u0627\u0646 \u0648 \u062F\u0646\u062F\u0627\u0646", "\u0645\u06CC\u0646\u0627 \u0648 \u0639\u0627\u062C"],
    type: "concept",
    difficulty: "medium",
    year: 1404,
    source: "tapesh",
    tags: ["\u0645\u0646\u062A\u062E\u0628"],
    stem: "\u0639\u0627\u062C (Dentin) \u062A\u0648\u0633\u0637 \u06A9\u062F\u0627\u0645 \u0633\u0644\u0648\u0644 \u0648 \u0628\u0627 \u0686\u0647 \u0627\u0644\u06AF\u0648\u06CC\u06CC \u0633\u0627\u062E\u062A\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F\u061F",
    figure: null,
    options: [
      "\u0622\u0645\u0644\u0648\u0628\u0644\u0627\u0633\u062A\u061B \u0628\u0627 \u062A\u0631\u0634\u062D \u0644\u0627\u06CC\u0647\u200C\u0628\u0647\u200C\u0644\u0627\u06CC\u0647 \u0627\u0632 \u062E\u0627\u0631\u062C \u0628\u0647 \u062F\u0627\u062E\u0644",
      "\u0627\u062F\u0648\u0646\u062A\u0648\u0628\u0644\u0627\u0633\u062A\u061B \u0628\u0627 \u0639\u0642\u0628\u200C\u0646\u0634\u06CC\u0646\u06CC \u062A\u062F\u0631\u06CC\u062C\u06CC \u0648 \u062C\u0627\u06CC\u200C\u06AF\u0630\u0627\u0634\u062A\u0646 \u0632\u0627\u0626\u062F\u0647\u0654 \u0633\u0644\u0648\u0644\u06CC \u062F\u0631 \u06A9\u0627\u0646\u0627\u0644\u06CC\u06A9\u0648\u0644",
      "\u0633\u0645\u0646\u062A\u0648\u0628\u0644\u0627\u0633\u062A\u061B \u0641\u0642\u0637 \u062F\u0631 \u0631\u06CC\u0634\u0647 \u0648 \u067E\u0633 \u0627\u0632 \u0628\u0633\u062A\u0647\u200C\u0634\u062F\u0646 \u0622\u067E\u06A9\u0633",
      "\u0641\u06CC\u0628\u0631\u0648\u0628\u0644\u0627\u0633\u062A\u061B \u0628\u0627 \u0631\u0633\u0648\u0628 \u06A9\u0644\u0627\u0698\u0646 \u0646\u0648\u0639 I \u0628\u062F\u0648\u0646 \u0633\u0644\u0648\u0644 \u0627\u062E\u062A\u0635\u0627\u0635\u06CC"
    ],
    correctAnswer: 1,
    explanation: {
      summary: "\u0627\u062F\u0648\u0646\u062A\u0648\u0628\u0644\u0627\u0633\u062A\u200C\u0647\u0627 \u0628\u0627 \u062A\u0631\u0634\u062D \u0645\u0627\u062A\u0631\u06CC\u06A9\u0633 \u0648 \u0639\u0642\u0628\u200C\u0646\u0634\u06CC\u0646\u06CC \u0628\u0647\u200C\u0633\u0645\u062A \u067E\u0627\u0644\u067E\u060C \u0632\u0627\u0626\u062F\u0647\u0654 \u0633\u0644\u0648\u0644\u06CC \u062E\u0648\u062F \u0631\u0627 \u062F\u0631 \u06A9\u0627\u0646\u0627\u0644\u06CC\u06A9\u0648\u0644 \u062F\u0646\u062A\u06CC\u0646\u06CC \u0628\u0627\u0642\u06CC \u0645\u06CC\u200C\u06AF\u0630\u0627\u0631\u0646\u062F.",
      deep: "\u0627\u062F\u0648\u0646\u062A\u0648\u0628\u0644\u0627\u0633\u062A\u200C\u0647\u0627 \u0627\u0632 \u067E\u0627\u067E\u06CC\u0644\u0627\u06CC \u062F\u0646\u062A\u0627\u0644 \u0645\u0646\u0634\u0623 \u0645\u06CC\u200C\u06AF\u06CC\u0631\u0646\u062F \u0648 \u067E\u0633 \u0627\u0632 \u062A\u0645\u0627\u06CC\u0632\u060C \u067E\u06CC\u0634\u200C\u0639\u0627\u062C (predentin) \u0645\u06CC\u200C\u0633\u0627\u0632\u0646\u062F \u06A9\u0647 \u0628\u0639\u062F\u0627\u064B \u0645\u0639\u062F\u0646\u06CC \u0645\u06CC\u200C\u0634\u0648\u062F. \u0628\u0627 \u0647\u0631 \u0644\u0627\u06CC\u0647 \u062A\u0631\u0634\u062D\u060C \u062C\u0633\u0645 \u0633\u0644\u0648\u0644\u06CC \u0628\u0647\u200C\u0633\u0645\u062A \u067E\u0627\u0644\u067E \u0639\u0642\u0628 \u0645\u06CC\u200C\u0631\u0648\u062F \u0648 \u0632\u0627\u0626\u062F\u0647 (Tomes fiber) \u062F\u0631 \u06A9\u0627\u0646\u0627\u0644\u06CC\u06A9\u0648\u0644 \u0628\u0627\u0642\u06CC \u0645\u06CC\u200C\u0645\u0627\u0646\u062F\u061B \u0647\u0645\u06CC\u0646 \u0633\u0627\u062E\u062A\u0627\u0631 \u0645\u0633\u06CC\u0631 \u0627\u0646\u062A\u0642\u0627\u0644 \u062D\u0633 \u0648 \u062A\u063A\u0630\u06CC\u0647 \u062F\u0631 \u0639\u0627\u062C \u0631\u0627 \u0645\u06CC\u200C\u0633\u0627\u0632\u062F. \u0639\u0627\u062C \u0628\u0631\u062E\u0644\u0627\u0641 \u0645\u06CC\u0646\u0627 \u067E\u0633 \u0627\u0632 \u0631\u0648\u06CC\u0634 \u0647\u0645 \u0633\u0627\u062E\u062A\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F (\u0639\u0627\u062C \u062B\u0627\u0646\u0648\u06CC\u0647 \u0648 \u062A\u0631\u0645\u06CC\u0645\u06CC).",
      keyPoint: "\u0639\u0627\u062C = \u0627\u062F\u0648\u0646\u062A\u0648\u0628\u0644\u0627\u0633\u062A + \u06A9\u0627\u0646\u0627\u0644\u06CC\u06A9\u0648\u0644\u200C\u0647\u0627\u06CC \u062F\u0646\u062A\u06CC\u0646\u06CC | \u0645\u06CC\u0646\u0627 = \u0622\u0645\u0644\u0648\u0628\u0644\u0627\u0633\u062A \u0628\u062F\u0648\u0646 \u0633\u0644\u0648\u0644 \u0628\u0627\u0642\u06CC\u200C\u0645\u0627\u0646\u062F\u0647.",
      trap: "\u0639\u0627\u062C \u0648 \u0645\u06CC\u0646\u0627 \u0647\u0631 \u062F\u0648 \u0627\u0632 \u0633\u0644\u0648\u0644\u200C\u0647\u0627\u06CC \u0627\u06A9\u062A\u0648\u0645\u0632\u0627\u0646\u0634\u06CC\u0645\u0627\u0644/\u0627\u067E\u06CC\u062A\u0644\u06CC\u0627\u0644\u06CC \u0633\u0627\u062E\u062A\u0647 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F \u0648\u0644\u06CC \u0641\u0642\u0637 \u0639\u0627\u062C \u0633\u0644\u0648\u0644 \u0632\u0646\u062F\u0647\u0654 \u0628\u0627\u0642\u06CC\u200C\u0645\u0627\u0646\u062F\u0647 \u062F\u0627\u0631\u062F.",
      whyWrong: [
        { index: 0, text: "\u0622\u0645\u0644\u0648\u0628\u0644\u0627\u0633\u062A \u0645\u06CC\u0646\u0627 \u0631\u0627 \u0645\u06CC\u200C\u0633\u0627\u0632\u062F \u0648 \u067E\u0633 \u0627\u0632 \u062A\u06A9\u0627\u0645\u0644 \u0627\u0632 \u0628\u06CC\u0646 \u0645\u06CC\u200C\u0631\u0648\u062F." },
        { index: 2, text: "\u0633\u0645\u0646\u062A\u0648\u0628\u0644\u0627\u0633\u062A \u0644\u0627\u06CC\u0647\u0654 \u0633\u0650\u0645\u0627\u0646 \u0633\u0637\u062D \u0631\u06CC\u0634\u0647 \u0631\u0627 \u0645\u06CC\u200C\u0633\u0627\u0632\u062F\u060C \u0646\u0647 \u0639\u0627\u062C \u062A\u0627\u062C." },
        { index: 3, text: "\u0641\u06CC\u0628\u0631\u0648\u0628\u0644\u0627\u0633\u062A \u067E\u0627\u0644\u067E \u06A9\u0644\u0627\u0698\u0646 \u067E\u0627\u0644\u067E \u0631\u0627 \u0645\u06CC\u200C\u0633\u0627\u0632\u062F\u061B \u0639\u0627\u062C \u0633\u0644\u0648\u0644 \u0627\u062E\u062A\u0635\u0627\u0635\u06CC \u062E\u0648\u062F (\u0627\u062F\u0648\u0646\u062A\u0648\u0628\u0644\u0627\u0633\u062A) \u0631\u0627 \u062F\u0627\u0631\u062F." }
      ]
    },
    stats: { solves: 1614, correctPercent: 69, optionPercents: [11, 69, 9, 11], avgTimeSec: 28, difficultyIndex: 0.69 },
    createdAt: "2026-05-30",
    updatedAt: "2026-09-10"
  },
  {
    id: "tb-den-04",
    track: "dentistry",
    subject: "microbiology",
    topicPath: ["\u0628\u0627\u06A9\u062A\u0631\u06CC\u200C\u0647\u0627\u06CC \u06AF\u0631\u0645 \u0645\u062B\u0628\u062A", "\u0627\u0633\u062A\u0631\u067E\u062A\u0648\u06A9\u0648\u06A9"],
    type: "concept",
    difficulty: "medium",
    year: 1401,
    source: "official",
    tags: ["\u067E\u0631\u062A\u06A9\u0631\u0627\u0631", "\u0645\u0646\u062A\u062E\u0628"],
    stem: "\u0639\u0627\u0645\u0644 \u0627\u0635\u0644\u06CC \u0634\u0631\u0648\u0639 \u067E\u0648\u0633\u06CC\u062F\u06AF\u06CC \u0645\u06CC\u0646\u0627 \u06A9\u062F\u0627\u0645 \u0628\u0627\u06A9\u062A\u0631\u06CC \u0627\u0633\u062A \u0648 \u0645\u06A9\u0627\u0646\u06CC\u0633\u0645 \u0686\u0633\u0628\u06CC\u062F\u0646 \u0622\u0646 \u0628\u0647 \u0633\u0637\u062D \u062F\u0646\u062F\u0627\u0646 \u0686\u06CC\u0633\u062A\u061F",
    figure: null,
    options: [
      "\u0644\u0627\u06A9\u062A\u0648\u0628\u0627\u0633\u06CC\u0644\u0648\u0633\u061B \u062A\u0648\u0644\u06CC\u062F \u067E\u0631\u0648\u062A\u0626\u0627\u0632 \u062A\u062E\u0631\u06CC\u0628\u200C\u06A9\u0646\u0646\u062F\u0647\u0654 \u0645\u0627\u062A\u0631\u06CC\u06A9\u0633 \u0645\u06CC\u0646\u0627",
      "\u0627\u0633\u062A\u0631\u067E\u062A\u0648\u06A9\u0648\u06A9\u0648\u0633 \u0645\u0648\u062A\u0627\u0646\u0633\u061B \u062A\u0648\u0644\u06CC\u062F \u06AF\u0644\u0648\u06A9\u0627\u0646 \u0646\u0627\u0645\u062D\u0644\u0648\u0644 \u0627\u0632 \u0633\u0627\u06A9\u0627\u0631\u0632 \u0648 \u062A\u0634\u06A9\u06CC\u0644 \u0628\u06CC\u0648\u0641\u06CC\u0644\u0645",
      "\u067E\u0648\u0631\u0641\u06CC\u0631\u0648\u0645\u0648\u0646\u0627\u0633 \u0698\u06CC\u0646\u0698\u06CC\u0648\u0627\u0644\u06CC\u0633\u061B \u062A\u062E\u0631\u06CC\u0628 \u06A9\u0644\u0627\u0698\u0646 \u067E\u0631\u06CC\u0648\u062F\u0646\u0634\u06CC\u0648\u0645",
      "\u06A9\u0627\u0646\u062F\u06CC\u062F\u0627 \u0622\u0644\u0628\u06CC\u06A9\u0627\u0646\u0633\u061B \u062A\u062E\u0631\u06CC\u0628 \u06A9\u0644\u0627\u0698\u0646 \u0639\u0627\u062C \u062F\u0631 \u062F\u0646\u062F\u0627\u0646\u200C\u0647\u0627\u06CC \u067E\u0648\u0633\u06CC\u062F\u0647"
    ],
    correctAnswer: 1,
    explanation: {
      summary: "S. mutans \u0628\u0627 \u0622\u0646\u0632\u06CC\u0645 \u06AF\u0644\u0648\u06A9\u0648\u0632\u06CC\u0644\u200C\u062A\u0631\u0627\u0646\u0633\u0641\u0631\u0627\u0632 \u0627\u0632 \u0633\u0627\u06A9\u0627\u0631\u0632\u060C \u06AF\u0644\u0648\u06A9\u0627\u0646 \u0646\u0627\u0645\u062D\u0644\u0648\u0644 (\u062F\u06A9\u0633\u062A\u0631\u0627\u0646) \u0645\u06CC\u200C\u0633\u0627\u0632\u062F \u0648 \u0628\u0647\u200C\u0634\u06A9\u0644 \u0628\u06CC\u0648\u0641\u06CC\u0644\u0645 \u0645\u062D\u06A9\u0645 \u0628\u0647 \u0645\u06CC\u0646\u0627 \u0645\u06CC\u200C\u0686\u0633\u0628\u062F.",
      deep: "\u067E\u0648\u0633\u06CC\u062F\u06AF\u06CC \u0646\u062A\u06CC\u062C\u0647\u0654 \u062A\u0639\u0627\u062F\u0644 \u0645\u06CC\u0627\u0646 \u062F\u0645\u06CC\u0646\u0631\u0627\u0644\u06CC\u0632\u0627\u0633\u06CC\u0648\u0646 \u0627\u0633\u06CC\u062F\u06CC \u0648 \u0631\u0645\u06CC\u0646\u0631\u0627\u0644\u06CC\u0632\u0627\u0633\u06CC\u0648\u0646 \u0627\u0633\u062A. S. mutans \u0628\u0647\u200C\u0639\u0646\u0648\u0627\u0646 \u0628\u0627\u06A9\u062A\u0631\u06CC \u0622\u063A\u0627\u0632\u06AF\u0631 \u06A9\u0644\u0648\u0646\u06CC\u0632\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F\u060C \u06AF\u0644\u0648\u06A9\u0627\u0646 \u0646\u0627\u0645\u062D\u0644\u0648\u0644 \u0645\u06CC\u200C\u0633\u0627\u0632\u062F \u06A9\u0647 \u067E\u0627\u06CC\u0647\u0654 \u0645\u0627\u062A\u0631\u06CC\u06A9\u0633 \u067E\u0644\u0627\u06A9 \u0627\u0633\u062A \u0648 \u0628\u0627 \u062A\u062E\u0645\u06CC\u0631 \u0633\u0627\u06A9\u0627\u0631\u0632 \u0627\u0633\u06CC\u062F \u0644\u0627\u06A9\u062A\u06CC\u06A9 \u062A\u0648\u0644\u06CC\u062F \u0645\u06CC\u200C\u06A9\u0646\u062F. \u0644\u0627\u06A9\u062A\u0648\u0628\u0627\u0633\u06CC\u0644\u200C\u0647\u0627 \u062F\u0631 \u067E\u06CC\u0634\u0631\u0641\u062A \u0636\u0627\u06CC\u0639\u0647 (\u0639\u0627\u062C) \u0646\u0642\u0634 \u062F\u0627\u0631\u0646\u062F \u0648 \u067E\u0648\u0631\u0641\u06CC\u0631\u0648\u0645\u0648\u0646\u0627\u0633 \u0698\u06CC\u0646\u0698\u06CC\u0648\u0627\u0644\u06CC\u0633 \u0639\u0627\u0645\u0644 \u0627\u0635\u0644\u06CC \u0628\u06CC\u0645\u0627\u0631\u06CC \u067E\u0631\u06CC\u0648\u062F\u0646\u062A\u0627\u0644 \u0627\u0633\u062A\u060C \u0646\u0647 \u067E\u0648\u0633\u06CC\u062F\u06AF\u06CC.",
      keyPoint: "\u067E\u0648\u0633\u06CC\u062F\u06AF\u06CC: S. mutans (\u0622\u063A\u0627\u0632\u06AF\u0631) + \u0644\u0627\u06A9\u062A\u0648\u0628\u0627\u0633\u06CC\u0644\u0648\u0633 (\u067E\u06CC\u0634\u0631\u0641\u062A) | \u067E\u0631\u06CC\u0648\u062F\u0646\u062A\u06CC\u062A: P. gingivalis \u0648 \u0628\u06CC\u200C\u0647\u0648\u0627\u06CC \u06AF\u0631\u0645-\u0645\u0646\u0641\u06CC.",
      trap: "\u0644\u0627\u06A9\u062A\u0648\u0628\u0627\u0633\u06CC\u0644\u0648\u0633 \u0627\u0633\u06CC\u062F \u0628\u06CC\u0634\u062A\u0631\u06CC \u062A\u0648\u0644\u06CC\u062F \u0645\u06CC\u200C\u06A9\u0646\u062F \u0648\u0644\u06CC \u062A\u0648\u0627\u0646 \u06A9\u0644\u0648\u0646\u06CC\u0632\u0627\u0633\u06CC\u0648\u0646 \u0627\u0648\u0644\u06CC\u0647 \u0631\u0648\u06CC \u0645\u06CC\u0646\u0627\u06CC \u0633\u0627\u0644\u0645 \u0631\u0627 \u0646\u062F\u0627\u0631\u062F\u061B \u0646\u0642\u0634 \xAB\u0622\u063A\u0627\u0632\u06AF\u0631\xBB \u0645\u062E\u0635\u0648\u0635 S. mutans \u0627\u0633\u062A.",
      whyWrong: [
        { index: 0, text: "\u0644\u0627\u06A9\u062A\u0648\u0628\u0627\u0633\u06CC\u0644\u200C\u0647\u0627 \u062F\u0631 \u067E\u06CC\u0634\u0631\u0641\u062A \u0636\u0627\u06CC\u0639\u0647 \u0646\u0642\u0634 \u062F\u0627\u0631\u0646\u062F \u0648\u0644\u06CC \u0622\u063A\u0627\u0632\u06AF\u0631 \u0686\u0633\u0628\u06CC\u062F\u0646 \u0628\u0647 \u0645\u06CC\u0646\u0627 \u0646\u06CC\u0633\u062A\u0646\u062F." },
        { index: 2, text: "P. gingivalis \u0639\u0627\u0645\u0644 \u067E\u0631\u06CC\u0648\u062F\u0646\u062A\u06CC\u062A \u0627\u0633\u062A\u060C \u0646\u0647 \u067E\u0648\u0633\u06CC\u062F\u06AF\u06CC." },
        { index: 3, text: "\u06A9\u0627\u0646\u062F\u06CC\u062F\u0627 \u062F\u0631 \u0639\u0641\u0648\u0646\u062A\u200C\u0647\u0627\u06CC \u0641\u0631\u0635\u062A\u200C\u0637\u0644\u0628 \u0645\u062E\u0627\u0637\u06CC \u0645\u0637\u0631\u062D \u0627\u0633\u062A\u060C \u0646\u0647 \u0634\u0631\u0648\u0639 \u067E\u0648\u0633\u06CC\u062F\u06AF\u06CC." }
      ]
    },
    stats: { solves: 2871, correctPercent: 72, optionPercents: [12, 72, 9, 7], avgTimeSec: 27, difficultyIndex: 0.72 },
    createdAt: "2026-02-16",
    updatedAt: "2026-08-24"
  },
  {
    id: "tb-den-05",
    track: "dentistry",
    subject: "physiology",
    topicPath: ["\u063A\u062F\u062F \u0628\u0632\u0627\u0642\u06CC", "\u062A\u0631\u0634\u062D \u0648 \u062A\u0646\u0638\u06CC\u0645 \u0628\u0632\u0627\u0642"],
    type: "concept",
    difficulty: "medium",
    year: 1400,
    source: "official",
    tags: ["\u067E\u0631\u062A\u06A9\u0631\u0627\u0631"],
    stem: "\u062A\u0631\u0634\u062D \u0622\u0628\u06A9\u06CC \u0628\u0632\u0627\u0642 (\u062D\u062C\u0645 \u0648 \u062C\u0631\u06CC\u0627\u0646) \u0639\u0645\u062F\u062A\u0627\u064B \u062A\u062D\u062A \u06A9\u0646\u062A\u0631\u0644 \u06A9\u062F\u0627\u0645 \u0628\u062E\u0634 \u062F\u0633\u062A\u06AF\u0627\u0647 \u0639\u0635\u0628\u06CC \u0648 \u06A9\u062F\u0627\u0645 \u06AF\u06CC\u0631\u0646\u062F\u0647 \u0627\u0633\u062A\u061F",
    figure: null,
    options: [
      "\u0633\u0645\u067E\u0627\u062A\u06CC\u06A9\u061B \u0646\u0648\u0631\u0627\u067E\u06CC\u200C\u0646\u0641\u0631\u06CC\u0646 \u0628\u0627 \u06AF\u06CC\u0631\u0646\u062F\u0647\u0654 \u03B1\u2081",
      "\u067E\u0627\u0631\u0627\u0633\u0645\u067E\u0627\u062A\u06CC\u06A9\u061B \u0627\u0633\u062A\u06CC\u0644\u200C\u06A9\u0648\u0644\u06CC\u0646 \u0628\u0627 \u06AF\u06CC\u0631\u0646\u062F\u0647\u0654 \u0645\u0648\u0633\u06A9\u0627\u0631\u06CC\u0646\u06CC (M\u2083)",
      "\u067E\u0627\u0631\u0627\u0633\u0645\u067E\u0627\u062A\u06CC\u06A9\u061B \u0627\u0633\u062A\u06CC\u0644\u200C\u06A9\u0648\u0644\u06CC\u0646 \u0628\u0627 \u06AF\u06CC\u0631\u0646\u062F\u0647\u0654 \u0646\u06CC\u06A9\u0648\u062A\u06CC\u0646\u06CC \u0631\u0648\u06CC \u0633\u0644\u0648\u0644 \u0622\u0633\u06CC\u0646\u0627\u0631",
      "\u0633\u0645\u067E\u0627\u062A\u06CC\u06A9\u061B \u062F\u0648\u067E\u0627\u0645\u06CC\u0646 \u0628\u0627 \u06AF\u06CC\u0631\u0646\u062F\u0647\u0654 D\u2081"
    ],
    correctAnswer: 1,
    explanation: {
      summary: "\u0628\u0632\u0627\u0642 \u063A\u0627\u0644\u0628\u0627\u064B \u067E\u0627\u0631\u0627\u0633\u0645\u067E\u0627\u062A\u06CC\u06A9 \u0627\u0633\u062A\u061B ACh \u0631\u0648\u06CC \u06AF\u06CC\u0631\u0646\u062F\u0647\u0654 M\u2083 \u0633\u0644\u0648\u0644 \u0622\u0633\u06CC\u0646\u0627\u0631 \u0628\u0627 \u0645\u0633\u06CC\u0631 IP\u2083/Ca\xB2\u207A \u062A\u0631\u0634\u062D \u0622\u0628\u06A9\u06CC \u0648 \u0641\u0631\u0627\u0648\u0627\u0646 \u0627\u06CC\u062C\u0627\u062F \u0645\u06CC\u200C\u06A9\u0646\u062F.",
      deep: "\u0639\u0635\u0628\u200C\u062F\u0647\u06CC \u067E\u0627\u0631\u0627\u0633\u0645\u067E\u0627\u062A\u06CC\u06A9 \u063A\u062F\u062F \u0628\u0632\u0627\u0642\u06CC \u0627\u0632 \u0639\u0635\u0628 \u0632\u0648\u062C VII (\u0632\u06CC\u0631\u0632\u0628\u0627\u0646\u06CC \u0648 \u0632\u06CC\u0631\u0641\u06A9\u06CC) \u0648 \u0632\u0648\u062C IX (\u067E\u0627\u0631\u0648\u062A\u06CC\u062F) \u0645\u06CC\u200C\u0622\u06CC\u062F \u0648 \xAB\u062A\u0631\u0634\u062D \u0622\u0628\u06A9\u06CC \u063A\u0646\u06CC \u0627\u0632 \u0627\u0644\u06A9\u062A\u0631\u0648\u0644\u06CC\u062A\xBB \u0645\u06CC\u200C\u0633\u0627\u0632\u062F\u061B \u0647\u0645\u06CC\u0646 \u0627\u0633\u062A \u06A9\u0647 \u062F\u0631 \u062E\u0634\u06A9\u06CC \u062F\u0647\u0627\u0646 \u0622\u0646\u062A\u06CC\u200C\u06A9\u0648\u0644\u06CC\u0646\u0631\u0698\u06CC\u06A9\u200C\u0647\u0627 (\u0645\u062B\u0644 \u0622\u062A\u0631\u0648\u067E\u06CC\u0646) \u062F\u06CC\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F. \u062A\u062D\u0631\u06CC\u06A9 \u0633\u0645\u067E\u0627\u062A\u06CC\u06A9 \u0647\u0645 \u062A\u0631\u0634\u062D \u0645\u06CC\u200C\u0622\u0648\u0631\u062F \u0648\u0644\u06CC \u062D\u062C\u0645 \u06A9\u0645 \u0648 \u0645\u062D\u062A\u0648\u0627\u06CC \u067E\u0631\u0648\u062A\u0626\u06CC\u0646\u06CC/\u0645\u0648\u06A9\u0648\u0633\u06CC \u0628\u06CC\u0634\u062A\u0631 \u062F\u0627\u0631\u062F\u061B \u0628\u0647 \u0647\u0645\u06CC\u0646 \u062F\u0644\u06CC\u0644 \xAB\u062D\u062C\u0645 \u0627\u0635\u0644\u06CC \u0628\u0632\u0627\u0642\xBB \u0628\u0647 \u067E\u0627\u0631\u0627\u0633\u0645\u067E\u0627\u062A\u06CC\u06A9 \u0646\u0633\u0628\u062A \u062F\u0627\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F.",
      keyPoint: "\u0628\u0632\u0627\u0642: \u067E\u0627\u0631\u0627\u0633\u0645\u067E\u0627\u062A\u06CC\u06A9 = \u062D\u062C\u0645 \u0632\u06CC\u0627\u062F \u0648 \u0622\u0628\u06A9\u06CC (M\u2083) | \u0633\u0645\u067E\u0627\u062A\u06CC\u06A9 = \u062D\u062C\u0645 \u06A9\u0645 \u0648 \u067E\u0631\u0648\u062A\u0626\u06CC\u0646\u06CC.",
      trap: "\u06AF\u06CC\u0631\u0646\u062F\u0647\u0654 \u0645\u0648\u0633\u06A9\u0627\u0631\u06CC\u0646\u06CC \u062F\u0631 \u0633\u0644\u0648\u0644 \u0622\u0633\u06CC\u0646\u0627\u0631 \u0627\u0633\u062A\u060C \u0646\u0647 \u0646\u06CC\u06A9\u0648\u062A\u06CC\u0646\u06CC\u061B \u0646\u06CC\u06A9\u0648\u062A\u06CC\u0646\u06CC \u06AF\u06CC\u0631\u0646\u062F\u0647\u0654 \u06AF\u0627\u0646\u06AF\u0644\u06CC\u0648\u0646 \u067E\u0627\u0631\u0627\u0633\u0645\u067E\u0627\u062A\u06CC\u06A9 \u0627\u0633\u062A.",
      whyWrong: [
        { index: 0, text: "\u0633\u0645\u067E\u0627\u062A\u06CC\u06A9 \u03B1\u2081 \u062A\u0631\u0634\u062D \u067E\u0631\u0648\u062A\u0626\u06CC\u0646\u06CC \u06A9\u0645\u200C\u062D\u062C\u0645 \u0645\u06CC\u200C\u062F\u0647\u062F\u060C \u0646\u0647 \u062C\u0631\u06CC\u0627\u0646 \u0627\u0635\u0644\u06CC \u0622\u0628\u06A9\u06CC." },
        { index: 2, text: "\u06AF\u06CC\u0631\u0646\u062F\u0647\u0654 \u0646\u06CC\u06A9\u0648\u062A\u06CC\u0646\u06CC \u062F\u0631 \u06AF\u0627\u0646\u06AF\u0644\u06CC\u0648\u0646 \u0627\u0633\u062A\u061B \u0633\u0644\u0648\u0644 \u0622\u0633\u06CC\u0646\u0627\u0631 \u06AF\u06CC\u0631\u0646\u062F\u0647\u0654 \u0645\u0648\u0633\u06A9\u0627\u0631\u06CC\u0646\u06CC \u062F\u0627\u0631\u062F." },
        { index: 3, text: "\u062F\u0648\u067E\u0627\u0645\u06CC\u0646 \u0646\u0642\u0634 \u0641\u06CC\u0632\u06CC\u0648\u0644\u0648\u0698\u06CC\u06A9 \u0627\u0635\u0644\u06CC \u062F\u0631 \u062A\u0646\u0638\u06CC\u0645 \u062A\u0631\u0634\u062D \u0628\u0632\u0627\u0642 \u0646\u062F\u0627\u0631\u062F." }
      ]
    },
    stats: { solves: 2065, correctPercent: 64, optionPercents: [17, 64, 12, 7], avgTimeSec: 30, difficultyIndex: 0.64 },
    createdAt: "2026-02-22",
    updatedAt: "2026-08-26"
  },
  {
    id: "tb-den-06",
    track: "dentistry",
    subject: "biochemistry",
    topicPath: ["\u0628\u06CC\u0648\u0634\u06CC\u0645\u06CC \u0645\u0648\u0644\u06A9\u0648\u0644\u06CC", "\u0633\u0627\u062E\u062A\u0627\u0631 \u06A9\u0644\u0627\u0698\u0646"],
    type: "concept",
    difficulty: "hard",
    year: 1404,
    source: "tapesh",
    tags: ["\u0645\u0646\u062A\u062E\u0628"],
    stem: "\u06A9\u062F\u0627\u0645 \u062A\u063A\u06CC\u06CC\u0631 \u067E\u0633 \u0627\u0632 \u062A\u0631\u062C\u0645\u0647\u060C \u067E\u0627\u06CC\u062F\u0627\u0631\u06CC \u0645\u0627\u0631\u067E\u06CC\u0686 \u0633\u0647\u200C\u06AF\u0627\u0646\u0647\u0654 \u06A9\u0644\u0627\u0698\u0646 \u0631\u0627 \u062A\u0623\u0645\u06CC\u0646 \u0645\u06CC\u200C\u06A9\u0646\u062F \u0648 \u06A9\u0645\u0628\u0648\u062F \u0648\u06CC\u062A\u0627\u0645\u06CC\u0646 C \u0686\u06AF\u0648\u0646\u0647 \u0628\u0647 \u0644\u0642\u200C\u0634\u062F\u0646 \u062F\u0646\u062F\u0627\u0646 \u0648 \u062E\u0648\u0646\u0631\u06CC\u0632\u06CC \u0644\u062B\u0647 \u0645\u06CC\u200C\u0627\u0646\u062C\u0627\u0645\u062F\u061F",
    figure: null,
    options: [
      "\u0647\u06CC\u062F\u0631\u0648\u06A9\u0633\u06CC\u0644\u0627\u0633\u06CC\u0648\u0646 \u067E\u0631\u0648\u0644\u06CC\u0646 \u0648 \u0644\u06CC\u0632\u06CC\u0646\u061B \u06A9\u0645\u0628\u0648\u062F \u0648\u06CC\u062A\u0627\u0645\u06CC\u0646 C \u0627\u06CC\u0646 \u0648\u0627\u06A9\u0646\u0634 \u0631\u0627 \u0645\u062A\u0648\u0642\u0641 \u0648 \u0645\u0627\u0631\u067E\u06CC\u0686 \u0631\u0627 \u0646\u0627\u067E\u0627\u06CC\u062F\u0627\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F",
      "\u0641\u0633\u0641\u0648\u0631\u06CC\u0644\u0627\u0633\u06CC\u0648\u0646 \u0633\u0631\u06CC\u0646 \u062F\u0631 \u0627\u0646\u062A\u0647\u0627\u06CC \u0632\u0646\u062C\u06CC\u0631\u0647\u061B \u06A9\u0645\u0628\u0648\u062F \u0648\u06CC\u062A\u0627\u0645\u06CC\u0646 C \u06A9\u06CC\u0646\u0627\u0632 \u0631\u0627 \u0645\u0647\u0627\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F",
      "\u06AF\u0644\u06CC\u06A9\u0648\u0632\u06CC\u0644\u0627\u0633\u06CC\u0648\u0646 \u0622\u0633\u067E\u0627\u0631\u0627\u0698\u06CC\u0646\u061B \u06A9\u0645\u0628\u0648\u062F \u0648\u06CC\u062A\u0627\u0645\u06CC\u0646 C \u0645\u0633\u06CC\u0631 N-\u06AF\u0644\u06CC\u06A9\u0648\u0632\u06CC\u0644\u0627\u0633\u06CC\u0648\u0646 \u0631\u0627 \u0645\u06CC\u200C\u0628\u0646\u062F\u062F",
      "\u06A9\u0631\u0627\u0633\u200C\u0644\u06CC\u0646\u06A9 \u062F\u06CC\u200C\u0633\u0648\u0644\u0641\u06CC\u062F\u06CC \u0628\u06CC\u0646 \u0632\u0646\u062C\u06CC\u0631\u0647\u200C\u0647\u0627\u061B \u06A9\u0645\u0628\u0648\u062F \u0648\u06CC\u062A\u0627\u0645\u06CC\u0646 C \u0627\u06A9\u0633\u06CC\u062F\u0627\u0633\u06CC\u0648\u0646 \u0633\u06CC\u0633\u062A\u0626\u06CC\u0646 \u0631\u0627 \u0645\u06CC\u200C\u062E\u0648\u0627\u0628\u0627\u0646\u062F"
    ],
    correctAnswer: 0,
    explanation: {
      summary: "\u067E\u0631\u0648\u0644\u06CC\u0644 \u0648 \u0644\u06CC\u0632\u06CC\u0644 \u0647\u06CC\u062F\u0631\u0648\u06A9\u0633\u06CC\u0644\u0627\u0632 \u0628\u0647 \u0648\u06CC\u062A\u0627\u0645\u06CC\u0646 C (\u0622\u0633\u06A9\u0648\u0631\u0628\u0627\u062A) \u0646\u06CC\u0627\u0632 \u062F\u0627\u0631\u0646\u062F\u061B \u0628\u062F\u0648\u0646 \u0647\u06CC\u062F\u0631\u0648\u06A9\u0633\u06CC\u0644\u0627\u0633\u06CC\u0648\u0646\u060C \u0645\u0627\u0631\u067E\u06CC\u0686 \u0633\u0647\u200C\u06AF\u0627\u0646\u0647 \u0646\u0627\u067E\u0627\u06CC\u062F\u0627\u0631 \u0645\u06CC\u200C\u0634\u0648\u062F.",
      deep: "\u06A9\u0644\u0627\u0698\u0646 \u067E\u0633 \u0627\u0632 \u062A\u0631\u062C\u0645\u0647 \u062F\u0633\u062A\u062E\u0648\u0634 \u0647\u06CC\u062F\u0631\u0648\u06A9\u0633\u06CC\u0644\u0627\u0633\u06CC\u0648\u0646 \u067E\u0631\u0648\u0644\u06CC\u0646 \u0648 \u0644\u06CC\u0632\u06CC\u0646 \u0645\u06CC\u200C\u0634\u0648\u062F \u06A9\u0647 \u067E\u06CC\u0648\u0646\u062F\u0647\u0627\u06CC \u0647\u06CC\u062F\u0631\u0648\u0698\u0646\u06CC \u062F\u0631\u0648\u0646 \u0648 \u0628\u06CC\u0646 \u0632\u0646\u062C\u06CC\u0631\u0647\u200C\u0647\u0627 \u0631\u0627 \u0645\u0645\u06A9\u0646 \u0645\u06CC\u200C\u06A9\u0646\u062F \u0648 \u062F\u0645\u0627\u06CC \u0630\u0648\u0628 \u0645\u0627\u0631\u067E\u06CC\u0686 \u0631\u0627 \u0628\u0627\u0644\u0627 \u0645\u06CC\u200C\u0628\u0631\u062F. \u0622\u0633\u06A9\u0648\u0631\u0628\u0627\u062A \u06A9\u0648\u0641\u0627\u06A9\u062A\u0648\u0631 \u0622\u0646\u0632\u06CC\u0645\u200C\u0647\u0627\u06CC \u067E\u0631\u0648\u0644\u06CC\u0644/\u0644\u06CC\u0632\u06CC\u0644 \u0647\u06CC\u062F\u0631\u0648\u06A9\u0633\u06CC\u0644\u0627\u0632 \u0627\u0633\u062A \u0648 \u062F\u0631 \u0686\u0631\u062E\u0647\u0654 \u0627\u062D\u06CC\u0627\u06CC \u0622\u0647\u0646 \u0641\u0639\u0627\u0644 \u0646\u0642\u0634 \u062F\u0627\u0631\u062F. \u06A9\u0645\u0628\u0648\u062F \u0622\u0646 (\u0627\u0633\u06A9\u0648\u0631\u0628\u0648\u062A) \u2192 \u06A9\u0644\u0627\u0698\u0646 \u0645\u0639\u06CC\u0648\u0628 \u2192 \u0634\u06A9\u0646\u0646\u062F\u06AF\u06CC \u0639\u0631\u0648\u0642 (\u067E\u062A\u0634\u06CC\u0627)\u060C \u062E\u0648\u0646\u0631\u06CC\u0632\u06CC \u0644\u062B\u0647\u060C \u0644\u0642\u200C\u0634\u062F\u0646 \u062F\u0646\u062F\u0627\u0646 (\u0627\u0632 \u062F\u0633\u062A \u0631\u0641\u062A\u0646 \u0644\u06CC\u06AF\u0627\u0645\u0627\u0646 \u067E\u0631\u06CC\u0648\u062F\u0646\u062A\u0627\u0644) \u0648 \u0627\u062E\u062A\u0644\u0627\u0644 \u062A\u0631\u0645\u06CC\u0645 \u0632\u062E\u0645. \u06A9\u0631\u0627\u0633\u200C\u0644\u06CC\u0646\u06A9\u200C\u0647\u0627\u06CC \u06A9\u0644\u0627\u0698\u0646 \u0627\u0632 \u0646\u0648\u0639 \u0644\u06CC\u0632\u06CC\u0646-\u0627\u06A9\u0633\u06CC\u062F\u0627\u0632 (\u0645\u0633\u200C\u0648\u0627\u0628\u0633\u062A\u0647) \u0647\u0633\u062A\u0646\u062F\u060C \u0646\u0647 \u062F\u06CC\u200C\u0633\u0648\u0644\u0641\u06CC\u062F\u06CC.",
      keyPoint: "\u0648\u06CC\u062A\u0627\u0645\u06CC\u0646 C = \u06A9\u0648\u0641\u0627\u06A9\u062A\u0648\u0631 \u0647\u06CC\u062F\u0631\u0648\u06A9\u0633\u06CC\u0644\u0627\u0633\u06CC\u0648\u0646 \u067E\u0631\u0648\u0644\u06CC\u0646/\u0644\u06CC\u0632\u06CC\u0646 | \u0645\u0633 = \u06A9\u0648\u0641\u0627\u06A9\u062A\u0648\u0631 \u0644\u06CC\u0632\u06CC\u0644 \u0627\u06A9\u0633\u06CC\u062F\u0627\u0632 (\u06A9\u0631\u0627\u0633\u200C\u0644\u06CC\u0646\u06A9).",
      trap: "\u06A9\u0631\u0627\u0633\u200C\u0644\u06CC\u0646\u06A9 \u06A9\u0644\u0627\u0698\u0646 \u0628\u0627 \u067E\u06CC\u0648\u0646\u062F \u06A9\u0648\u0648\u0627\u0644\u0627\u0646 \u0628\u06CC\u0646 \u0644\u06CC\u0632\u06CC\u0646\u200C\u0647\u0627 (\u0644\u06CC\u0632\u06CC\u0644 \u0627\u06A9\u0633\u06CC\u062F\u0627\u0632\u060C \u0645\u0633\u200C\u0648\u0627\u0628\u0633\u062A\u0647) \u0633\u0627\u062E\u062A\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F\u061B \u067E\u06CC\u0648\u0646\u062F \u062F\u06CC\u200C\u0633\u0648\u0644\u0641\u06CC\u062F\u06CC \u062F\u0631 \u06A9\u0644\u0627\u0698\u0646 \u0646\u0642\u0634\u06CC \u0646\u062F\u0627\u0631\u062F.",
      whyWrong: [
        { index: 1, text: "\u0641\u0633\u0641\u0648\u0631\u06CC\u0644\u0627\u0633\u06CC\u0648\u0646 \u062F\u0631 \u067E\u0627\u06CC\u062F\u0627\u0631\u06CC \u0645\u0627\u0631\u067E\u06CC\u0686 \u0633\u0647\u200C\u06AF\u0627\u0646\u0647\u0654 \u06A9\u0644\u0627\u0698\u0646 \u0646\u0642\u0634 \u0646\u062F\u0627\u0631\u062F." },
        { index: 2, text: "\u06A9\u0644\u0627\u0698\u0646 \u0639\u0645\u062F\u062A\u0627\u064B O-\u06AF\u0644\u06CC\u06A9\u0648\u0632\u06CC\u0644\u0647 \u0627\u0633\u062A \u0648 \u0645\u0633\u06CC\u0631 N-\u06AF\u0644\u06CC\u06A9\u0648\u0632\u06CC\u0644\u0627\u0633\u06CC\u0648\u0646 \u0639\u0627\u0645\u0644 \u067E\u0627\u06CC\u062F\u0627\u0631\u06CC \u0622\u0646 \u0646\u06CC\u0633\u062A." },
        { index: 3, text: "\u06A9\u0631\u0627\u0633\u200C\u0644\u06CC\u0646\u06A9 \u06A9\u0644\u0627\u0698\u0646 \u0644\u06CC\u0632\u06CC\u0646\u06CC (\u0645\u0633\u200C\u0648\u0627\u0628\u0633\u062A\u0647) \u0627\u0633\u062A\u060C \u0646\u0647 \u062F\u06CC\u200C\u0633\u0648\u0644\u0641\u06CC\u062F\u06CC." }
      ]
    },
    stats: { solves: 1422, correctPercent: 52, optionPercents: [52, 14, 12, 22], avgTimeSec: 44, difficultyIndex: 0.52 },
    createdAt: "2026-06-02",
    updatedAt: "2026-09-11"
  },
  {
    id: "tb-den-07",
    track: "dentistry",
    subject: "pathology",
    topicPath: ["\u067E\u0627\u062A\u0648\u0644\u0648\u0698\u06CC \u062F\u0647\u0627\u0646", "\u0636\u0627\u06CC\u0639\u0627\u062A \u067E\u06CC\u0634\u200C\u0628\u062F\u062E\u06CC\u0645"],
    type: "clinical",
    difficulty: "medium",
    year: 1403,
    source: "official",
    tags: ["\u067E\u0631\u062A\u06A9\u0631\u0627\u0631"],
    stem: "\u06A9\u062F\u0627\u0645 \u0636\u0627\u06CC\u0639\u0647\u060C \u0634\u0627\u06CC\u0639\u200C\u062A\u0631\u06CC\u0646 \u0627\u062E\u062A\u0644\u0627\u0644 \u0628\u0627\u0644\u0642\u0648\u0647 \u0628\u062F\u062E\u06CC\u0645 \u0645\u062E\u0627\u0637 \u062F\u0647\u0627\u0646 \u0627\u0633\u062A \u0648 \u0628\u0647\u200C\u0635\u0648\u0631\u062A \u067E\u0644\u0627\u06A9 \u0633\u0641\u06CC\u062F\u06CC \u062F\u06CC\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F \u06A9\u0647 \u0642\u0627\u0628\u0644 \u062C\u062F\u0627 \u06A9\u0631\u062F\u0646 \u0646\u06CC\u0633\u062A\u061F",
    figure: null,
    options: [
      "\u06A9\u0627\u0646\u062F\u06CC\u062F\u06CC\u0627\u0632\u06CC\u0633 \u062F\u0647\u0627\u0646\u06CC",
      "\u0644\u0648\u06A9\u0648\u067E\u0644\u0627\u06A9\u06CC\u0627",
      "\u0622\u0641\u062A \u0631\u0627\u062C\u0639\u0647\u0654 \u062F\u0647\u0627\u0646\u06CC",
      "\u0644\u06CC\u06A9\u0646 \u067E\u0644\u0627\u0646\u0648\u0633 \u0627\u0631\u0648\u0632\u06CC\u0648"
    ],
    correctAnswer: 1,
    explanation: {
      summary: "\u0644\u0648\u06A9\u0648\u067E\u0644\u0627\u06A9\u06CC\u0627 \u0627\u0635\u0637\u0644\u0627\u062D\u06CC \u0628\u0627\u0644\u06CC\u0646\u06CC \u0628\u0631\u0627\u06CC \u067E\u0644\u0627\u06A9 \u0633\u0641\u06CC\u062F \u0628\u062F\u0648\u0646 \u0639\u0644\u062A \u0645\u0634\u062E\u0635 \u062F\u06CC\u06AF\u0631 \u0627\u0633\u062A \u0648 \u0634\u0627\u06CC\u0639\u200C\u062A\u0631\u06CC\u0646 \u0636\u0627\u06CC\u0639\u0647\u0654 \u0628\u0627\u0644\u0642\u0648\u0647 \u0628\u062F\u062E\u06CC\u0645 \u0645\u062E\u0627\u0637 \u062F\u0647\u0627\u0646 \u0645\u062D\u0633\u0648\u0628 \u0645\u06CC\u200C\u0634\u0648\u062F.",
      deep: "\u062A\u0634\u062E\u06CC\u0635 \u0644\u0648\u06A9\u0648\u067E\u0644\u0627\u06A9\u06CC\u0627 \xAB\u062A\u0634\u062E\u06CC\u0635 \u0637\u0631\u062F\u06CC\xBB \u0627\u0633\u062A: \u0647\u0631 \u067E\u0644\u0627\u06A9 \u0633\u0641\u06CC\u062F \u0645\u062E\u0627\u0637\u06CC \u06A9\u0647 \u0628\u0627 \u062A\u0631\u0627\u0634\u06CC\u062F\u0646 \u062C\u062F\u0627 \u0646\u0634\u0648\u062F \u0648 \u0628\u0647 \u0628\u06CC\u0645\u0627\u0631\u06CC \u0634\u0646\u0627\u062E\u062A\u0647\u200C\u0634\u062F\u0647\u0654 \u062F\u06CC\u06AF\u0631\u06CC (\u06A9\u0627\u0646\u062F\u06CC\u062F\u06CC\u0627\u0632\u06CC\u0633\u060C \u0644\u06CC\u06A9\u0646 \u067E\u0644\u0627\u0646\u0648\u0633\u060C \u0644\u06A9\u0648\u0627\u062F\u0645\u0627\u06CC \u0627\u0635\u0637\u06A9\u0627\u06A9\u06CC) \u0646\u0633\u0628\u062A \u062F\u0627\u062F\u0647 \u0646\u0634\u0648\u062F\u060C \u0644\u0648\u06A9\u0648\u067E\u0644\u0627\u06A9\u06CC\u0627 \u0646\u0627\u0645 \u0645\u06CC\u200C\u06AF\u06CC\u0631\u062F. \u0631\u06CC\u0633\u06A9 \u062A\u0628\u062F\u06CC\u0644 \u0628\u062F\u062E\u06CC\u0645 \u0622\u0646 \u062D\u062F\u0648\u062F \u06F1 \u062A\u0627 \u06F5 \u062F\u0631\u0635\u062F \u0627\u0633\u062A \u0648 \u062F\u0631 \u0646\u0648\u0627\u062D\u06CC \u06A9\u0641 \u062F\u0647\u0627\u0646\u060C \u06A9\u0646\u0627\u0631\u0647\u0654 \u0632\u0628\u0627\u0646 \u0648 \u0648\u0633\u062A\u06CC\u0628\u0648\u0644\u0627\u0631 \u0628\u06CC\u0634\u062A\u0631 \u0627\u0633\u062A. \u0627\u0631\u06CC\u062A\u0631\u0648\u067E\u0644\u0627\u06A9\u06CC\u0627 (\u067E\u0644\u0627\u06A9 \u0642\u0631\u0645\u0632) \u0634\u06CC\u0648\u0639 \u06A9\u0645\u062A\u0631\u06CC \u062F\u0627\u0631\u062F \u0627\u0645\u0627 \u0631\u06CC\u0633\u06A9 \u0628\u062F\u062E\u06CC\u0645\u06CC \u0622\u0646 \u0628\u0633\u06CC\u0627\u0631 \u0628\u0627\u0644\u0627\u062A\u0631 \u0627\u0633\u062A.",
      keyPoint: "\u0644\u0648\u06A9\u0648\u067E\u0644\u0627\u06A9\u06CC\u0627 = \u0634\u0627\u06CC\u0639\u200C\u062A\u0631\u06CC\u0646 \u0636\u0627\u06CC\u0639\u0647\u0654 \u0628\u0627\u0644\u0642\u0648\u0647 \u0628\u062F\u062E\u06CC\u0645 | \u0627\u0631\u06CC\u062A\u0631\u0648\u067E\u0644\u0627\u06A9\u06CC\u0627 = \u06A9\u0645\u200C\u0634\u06CC\u0648\u0639\u200C\u062A\u0631 \u0648\u0644\u06CC \u067E\u0631\u062E\u0637\u0631\u062A\u0631.",
      trap: "\u0644\u06CC\u06A9\u0646 \u067E\u0644\u0627\u0646\u0648\u0633 \u0647\u0645 \u067E\u062A\u0627\u0646\u0633\u06CC\u0644 \u0628\u062F\u062E\u06CC\u0645\u06CC \u062F\u0627\u0631\u062F \u0648\u0644\u06CC \xAB\u067E\u0644\u0627\u06A9 \u0633\u0641\u06CC\u062F \u0628\u062F\u0648\u0646 \u062A\u0634\u062E\u06CC\u0635 \u062F\u06CC\u06AF\u0631\xBB \u062A\u0639\u0631\u06CC\u0641 \u0644\u0648\u06A9\u0648\u067E\u0644\u0627\u06A9\u06CC\u0627 \u0627\u0633\u062A \u0648 \u06A9\u0627\u0646\u062F\u06CC\u062F\u06CC\u0627\u0632\u06CC\u0633 \u0628\u0627 \u0636\u062F\u0642\u0627\u0631\u0686 \u0628\u0631\u0637\u0631\u0641 \u0645\u06CC\u200C\u0634\u0648\u062F.",
      whyWrong: [
        { index: 0, text: "\u06A9\u0627\u0646\u062F\u06CC\u062F\u06CC\u0627\u0632\u06CC\u0633 \u0639\u0641\u0648\u0646\u06CC \u0627\u0633\u062A \u0648 \u0628\u0627 \u062F\u0631\u0645\u0627\u0646 \u0636\u062F\u0642\u0627\u0631\u0686 \u0628\u0631\u0637\u0631\u0641 \u0645\u06CC\u200C\u0634\u0648\u062F\u061B \u062A\u0634\u062E\u06CC\u0635 \u0637\u0631\u062F\u06CC \u0646\u06CC\u0633\u062A." },
        { index: 2, text: "\u0622\u0641\u062A \u0631\u0627\u062C\u0639\u0647\u0654 \u062F\u0647\u0627\u0646\u06CC \u0632\u062E\u0645 \u062F\u0631\u062F\u0646\u0627\u06A9 \u0639\u0648\u062F\u06A9\u0646\u0646\u062F\u0647 \u0627\u0633\u062A\u060C \u0646\u0647 \u067E\u0644\u0627\u06A9 \u0633\u0641\u06CC\u062F." },
        { index: 3, text: "\u0644\u06CC\u06A9\u0646 \u067E\u0644\u0627\u0646\u0648\u0633 \u0627\u0644\u06AF\u0648\u06CC \u0628\u0627\u0644\u06CC\u0646\u06CC \u0648 \u0647\u06CC\u0633\u062A\u0648\u0644\u0648\u0698\u06CC\u06A9 \u0634\u0646\u0627\u062E\u062A\u0647\u200C\u0634\u062F\u0647\u0654 \u062E\u0648\u062F \u0631\u0627 \u062F\u0627\u0631\u062F \u0648 \u062F\u0631 \u062A\u0634\u062E\u06CC\u0635 \u0637\u0631\u062F\u06CC \u06A9\u0646\u0627\u0631 \u06AF\u0630\u0627\u0634\u062A\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F." }
      ]
    },
    stats: { solves: 1755, correctPercent: 61, optionPercents: [12, 61, 11, 16], avgTimeSec: 32, difficultyIndex: 0.61 },
    createdAt: "2026-03-02",
    updatedAt: "2026-08-28"
  }
];
var questionById = (id) => QUESTIONS.find((question) => question.id === id) ?? null;
var buildStats = (questions = QUESTIONS) => ({
  totalQuestions: questions.length,
  subjectsCovered: [...new Set(questions.map((question) => question.subject))].length,
  yearsCovered: [...new Set(questions.map((question) => question.year))].length,
  totalSolves: questions.reduce((sum, question) => sum + question.stats.solves, 0),
  averageCorrect: questions.length ? Math.round(questions.reduce((sum, question) => sum + question.stats.correctPercent, 0) / questions.length) : 0
});
var BANK_STATS = buildStats(QUESTIONS);

// src/services/testBank/testBankService.js
var STATE_KEY_PREFIX = "tapesh:testbank:v1:";
var EMPTY_STATE = {
  sessions: [],
  //Attempt-like: {id, mode, title, subtitle, blueprint, questionIds, answers, marked, ...}
  bookmarks: [],
  // qid[] — نشان‌شده‌ها
  review: [],
  // qid[] — نیاز به مرور
  reports: [],
  // {questionId, reason, note, at}
  savedFilters: [],
  // {id, name, createdAt, blueprint}
  seeded: false
};
function resolveUserKey(userRef) {
  if (typeof userRef === "string") return userRef || "guest";
  const identity = userRef?.id ?? userRef?.phone;
  return identity ? String(identity) : "guest";
}
var stateKey = (userId) => `${STATE_KEY_PREFIX}${resolveUserKey(userId)}`;
function loadState(userId) {
  if (typeof window === "undefined") return { ...EMPTY_STATE };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(stateKey(userId)) || "null");
    return parsed && typeof parsed === "object" ? { ...EMPTY_STATE, ...parsed } : { ...EMPTY_STATE };
  } catch {
    return { ...EMPTY_STATE };
  }
}
function fetchSubmittedSessions(userId) {
  return loadState(userId).sessions.filter((session) => session.status === "submitted");
}

// src/services/analytics/mockData.js
var DAY_MS = 864e5;
var HISTORY_DAYS = 84;
function hashSeed(input) {
  let hash = 2166136261;
  const text = String(input ?? "guest");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function mulberry32(seed) {
  let state = seed >>> 0;
  return function random() {
    state = state + 1831565813 >>> 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
var pick = (random, array) => array[Math.floor(random() * array.length)];
function lognormal(random, sigma = 0.32) {
  const u1 = Math.max(random(), 1e-9);
  const u2 = random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.exp(z * sigma);
}
var clamp01 = (value) => Math.min(0.97, Math.max(0.05, value));
var TOPIC_ABILITY = {
  "\u0642\u0644\u0628 \u0648 \u0639\u0631\u0648\u0642": 0.94,
  "\u0639\u0635\u0628": 0.88,
  "\u062A\u0646\u0641\u0633": 0.88,
  "\u062E\u0648\u0646": 0.89,
  "\u06A9\u0644\u06CC\u0647": 0.76,
  "\u063A\u062F\u062F \u062F\u0631\u0648\u0646\u200C\u0631\u06CC\u0632": 0.8,
  "\u06AF\u0648\u0627\u0631\u0634": 0.82,
  "\u0639\u0636\u0644\u0647": 0.82,
  "\u0627\u0646\u062F\u0627\u0645 \u0641\u0648\u0642\u0627\u0646\u06CC": 0.68,
  "\u0642\u0644\u0628 \u0648 \u062A\u0648\u0631\u0627\u06A9\u0633": 0.76,
  "\u0646\u0648\u0631\u0648\u0622\u0646\u0627\u062A\u0648\u0645\u06CC": 0.8,
  "\u0627\u0646\u062F\u0627\u0645 \u062A\u062D\u062A\u0627\u0646\u06CC": 0.72,
  "\u0633\u0631 \u0648 \u06AF\u0631\u062F\u0646": 0.72,
  "\u0634\u06A9\u0645 \u0648 \u0644\u06AF\u0646": 0.76,
  "\u0622\u0646\u0632\u06CC\u0645\u200C\u0647\u0627": 0.8,
  "\u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u0633\u0645 \u06A9\u0631\u0628\u0648\u0647\u06CC\u062F\u0631\u0627\u062A": 0.66,
  "\u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u0633\u0645 \u0644\u06CC\u067E\u06CC\u062F": 0.64,
  "\u0628\u06CC\u0648\u0634\u06CC\u0645\u06CC \u0645\u0648\u0644\u06A9\u0648\u0644\u06CC": 0.76,
  "\u0648\u06CC\u062A\u0627\u0645\u06CC\u0646\u200C\u0647\u0627": 0.8,
  "\u062A\u0639\u0627\u062F\u0644 \u0627\u0633\u06CC\u062F-\u0628\u0627\u0632": 0.72,
  "\u0686\u0631\u062E\u0647\u0654 \u0627\u0648\u0631\u0647": 0.74
};
var OVERCONFIDENT_TOPICS = /* @__PURE__ */ new Set(["\u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u0633\u0645 \u06A9\u0631\u0628\u0648\u0647\u06CC\u062F\u0631\u0627\u062A", "\u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u0633\u0645 \u0644\u06CC\u067E\u06CC\u062F", "\u062A\u0639\u0627\u062F\u0644 \u0627\u0633\u06CC\u062F-\u0628\u0627\u0632"]);
var SUBJECT_SPEED = { physiology: 0.95, anatomy: 1.08, biochemistry: 1.12 };
var DIFFICULTY_PROB_SHIFT = { easy: 0.09, medium: 0, hard: -0.11, very_hard: -0.2 };
var DIFFICULTY_BASE_TIME = { easy: 24, medium: 40, hard: 62, very_hard: 84 };
function abilityOn(topic, dayIndex, hour, random) {
  const topicAbility = TOPIC_ABILITY[topic] ?? 0.7;
  const growth = 0.9 + 0.2 * (dayIndex / (HISTORY_DAYS - 1));
  const midtermDip = dayIndex >= 28 && dayIndex <= 36 ? 0.93 : 1;
  const eveningDip = hour >= 17 ? 0.88 : 1;
  const wobble = 0.94 + random() * 0.12;
  return clamp01(topicAbility * growth * midtermDip * eveningDip * wobble);
}
function sessionPlan(random) {
  const sessions = [];
  let dayCursor = HISTORY_DAYS - 2;
  let index = 0;
  const exams = [
    { day: 74, count: 25, duration: 50, title: "\u0622\u0632\u0645\u0648\u0646 \u062C\u0627\u0645\u0639 \u0647\u0645\u0627\u0647\u0646\u06AF \u0639\u0644\u0648\u0645 \u067E\u0627\u06CC\u0647 \u062A\u067E\u0634", subtitle: "\u062F\u0648\u0631\u0647\u0654 \u0627\u0648\u0644 \u2014 \u0627\u0631\u0632\u06CC\u0627\u0628\u06CC \u067E\u0627\u06CC\u0647", kind: "coordinated", rank: true },
    { day: 63, count: 20, duration: 40, title: "\u0622\u0632\u0645\u0648\u0646\u06A9 \u0647\u0641\u062A\u06AF\u06CC \u062A\u067E\u0634", subtitle: "\u0647\u0641\u062A\u0647\u0654 \u06F8 \u2014 \u0641\u06CC\u0632\u06CC\u0648\u0644\u0648\u0698\u06CC \u0648 \u0628\u06CC\u0648\u0634\u06CC\u0645\u06CC", kind: "weekly" },
    { day: 52, count: 25, duration: 50, title: "\u0622\u0632\u0645\u0648\u0646 \u0639\u0644\u0648\u0645 \u067E\u0627\u06CC\u0647 \u0648\u0632\u0627\u0631\u062A \u0628\u0647\u062F\u0627\u0634\u062A \u2014 \u06F1\u06F4\u06F0\u06F2", subtitle: "\u0646\u0648\u0628\u062A \u062F\u0648\u0645 \xB7 \u0646\u0645\u0631\u0647\u0654 \u0645\u0646\u0641\u06CC \u06F3/\u06F1", kind: "official", official: true },
    { day: 41, count: 20, duration: 40, title: "\u0622\u0632\u0645\u0648\u0646 \u0645\u0648\u0636\u0648\u0639\u06CC \u0628\u06CC\u0648\u0634\u06CC\u0645\u06CC \u2014 \u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u0633\u0645", subtitle: "\u062A\u0645\u0631\u06A9\u0632: \u06A9\u0631\u0628\u0648\u0647\u06CC\u062F\u0631\u0627\u062A \u0648 \u0644\u06CC\u067E\u06CC\u062F", kind: "topic" },
    { day: 30, count: 25, duration: 45, title: "\u0622\u0632\u0645\u0648\u0646 \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC \u0639\u0644\u0648\u0645 \u067E\u0627\u06CC\u0647 \u2014 \u0645\u0631\u062F\u0627\u062F", subtitle: "\u0634\u0628\u06CC\u0647\u200C\u0633\u0627\u0632 \u0622\u0632\u0645\u0648\u0646 \u0627\u0635\u0644\u06CC", kind: "mock", timedOut: true },
    { day: 16, count: 30, duration: 60, title: "\u0622\u0632\u0645\u0648\u0646 \u062C\u0627\u0645\u0639 \u0627\u0648\u0644 \u062A\u0631\u0645 \u2014 \u0622\u0628\u0627\u0646", subtitle: "\u067E\u0648\u0634\u0634 \u06A9\u0627\u0645\u0644 \u0633\u0647 \u062F\u0631\u0633", kind: "comprehensive", rank: true },
    { day: 5, count: 20, duration: 40, title: "\u0622\u0632\u0645\u0648\u0646\u06A9 \u0647\u0641\u062A\u06AF\u06CC \u062A\u067E\u0634", subtitle: "\u0647\u0641\u062A\u0647\u0654 \u06F2 \u2014 \u0645\u0631\u0648\u0631 \u0639\u0645\u0648\u0645\u06CC", kind: "weekly" }
  ];
  for (const exam of exams) {
    sessions.push({ ...exam, mode: "exam" });
  }
  const practiceTitles = [
    { title: "\u062A\u0645\u0631\u06CC\u0646 \u062F\u0631\u0633\u06CC \u0641\u06CC\u0632\u06CC\u0648\u0644\u0648\u0698\u06CC", subject: "physiology" },
    { title: "\u062A\u0645\u0631\u06CC\u0646 \u0645\u0628\u062D\u062B\u06CC \u2014 \u0642\u0644\u0628 \u0648 \u0639\u0631\u0648\u0642", subject: "physiology", topics: ["\u0642\u0644\u0628 \u0648 \u0639\u0631\u0648\u0642"] },
    { title: "\u062A\u0645\u0631\u06CC\u0646 \u062F\u0631\u0633\u06CC \u0628\u06CC\u0648\u0634\u06CC\u0645\u06CC", subject: "biochemistry" },
    { title: "\u062A\u0645\u0631\u06CC\u0646 \u062F\u0631\u0633\u06CC \u0622\u0646\u0627\u062A\u0648\u0645\u06CC", subject: "anatomy" },
    { title: "\u0645\u0631\u0648\u0631 \u0627\u0634\u062A\u0628\u0627\u0647\u200C\u0647\u0627", mistakes: true },
    { title: "\u062A\u0645\u0631\u06CC\u0646 \u0627\u062E\u062A\u0644\u0627\u0637\u06CC \u0631\u0648\u0632\u0627\u0646\u0647", mixed: true },
    { title: "\u062A\u0645\u0631\u06CC\u0646 \u0645\u0628\u062D\u062B\u06CC \u2014 \u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u0633\u0645", subject: "biochemistry", topics: ["\u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u0633\u0645 \u06A9\u0631\u0628\u0648\u0647\u06CC\u062F\u0631\u0627\u062A", "\u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u0633\u0645 \u0644\u06CC\u067E\u06CC\u062F", "\u0686\u0631\u062E\u0647\u0654 \u0627\u0648\u0631\u0647"] },
    { title: "\u062A\u0645\u0631\u06CC\u0646 \u0645\u0628\u062D\u062B\u06CC \u2014 \u0627\u0646\u062F\u0627\u0645 \u0641\u0648\u0642\u0627\u0646\u06CC", subject: "anatomy", topics: ["\u0627\u0646\u062F\u0627\u0645 \u0641\u0648\u0642\u0627\u0646\u06CC"] },
    { title: "\u062A\u0645\u0631\u06CC\u0646 \u0645\u0628\u062D\u062B\u06CC \u2014 \u0639\u0635\u0628 \u0648 \u0646\u0648\u0631\u0648\u0622\u0646\u0627\u062A\u0648\u0645\u06CC", subject: "physiology", topics: ["\u0639\u0635\u0628"], mixedWith: ["anatomy|\u0646\u0648\u0631\u0648\u0622\u0646\u0627\u062A\u0648\u0645\u06CC"] },
    { title: "\u062A\u0645\u0631\u06CC\u0646 \u0633\u0637\u062D \u0633\u062E\u062A", hard: true }
  ];
  while (dayCursor > 0) {
    const plan = practiceTitles[index % practiceTitles.length];
    index += 1;
    sessions.push({
      day: dayCursor,
      mode: "practice",
      count: 8 + Math.floor(random() * 7),
      // ۸ تا ۱۴ سؤال
      ...plan
    });
    dayCursor -= 2 + Math.floor(random() * 2);
  }
  return sessions;
}
function selectQuestions(random, plan) {
  const pool = QUESTIONS.filter((question) => {
    if (plan.mixed || plan.mistakes) return true;
    if (plan.topics && !plan.mixedWith) return plan.topics.includes(question.topicPath[0]);
    if (plan.mixedWith && plan.topics) {
      return plan.topics.includes(question.topicPath[0]) || plan.mixedWith.some((pair) => question.subject === pair.split("|")[0] && question.topicPath[0] === pair.split("|")[1]);
    }
    if (plan.subject) return question.subject === plan.subject;
    return true;
  });
  const source = plan.hard ? pool.filter((question) => question.difficulty === "hard") : pool;
  const base = source.length ? source : pool;
  const shuffled = [...base];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const need = Math.min(plan.count ?? 10, 30);
  const selected = [];
  while (selected.length < need) {
    for (const question of shuffled) {
      if (selected.length >= need) break;
      selected.push(question);
    }
  }
  return selected;
}
function buildAttempt(random, { session, question, order, total, timestamp, hour, dayIndex }) {
  const topic = question.topicPath[0];
  const ability = abilityOn(topic, dayIndex, hour, random);
  const isExam = session.mode === "exam";
  const progress = total > 1 ? order / (total - 1) : 0;
  const examPressure = isExam ? session.examKind === "official" || session.examKind === "coordinated" ? -0.14 : -0.11 : 0;
  let unanswered = false;
  if (isExam) {
    const pressure = session.timedOut ? 0.4 : 0.07;
    if (progress > 0.72 && random() < pressure) unanswered = true;
  } else if (random() < 0.015) {
    unanswered = true;
  }
  const probCorrect = clamp01(ability + (DIFFICULTY_PROB_SHIFT[question.difficulty] ?? 0) + examPressure);
  const correct = !unanswered && random() < probCorrect;
  const baseTime = question.stats?.avgTimeSec ?? DIFFICULTY_BASE_TIME[question.difficulty] ?? 40;
  let timeSpent = Math.round(
    baseTime * (SUBJECT_SPEED[question.subject] ?? 1) * lognormal(random) * (isExam ? 1 + 0.12 * progress : 1)
  );
  const carelessRush = !unanswered && !correct && random() < 0.22;
  if (carelessRush) timeSpent = Math.max(4, Math.round(timeSpent * (0.12 + random() * 0.25)));
  if (unanswered) timeSpent = random() < 0.5 ? 0 : Math.max(1, Math.round(timeSpent * 0.15));
  timeSpent = Math.min(240, timeSpent);
  let confidence = null;
  if (!unanswered && random() > 0.14) {
    const overconfident = OVERCONFIDENT_TOPICS.has(topic);
    const pHigh = correct ? 0.5 + 0.35 * ability : overconfident ? 0.62 : 0.16 + 0.2 * ability;
    confidence = random() < pHigh ? "high" : random() < 0.55 ? "medium" : "low";
  }
  let errorType = null;
  if (!unanswered && !correct && random() > 0.18) {
    const weights = [
      ["KNOWLEDGE_GAP", 0.26],
      ["CONCEPTUAL_ERROR", 0.18],
      ["CARELESS_MISTAKE", timeSpent < 12 ? 0.34 : 0.08],
      ["MISREADING", 0.07],
      ["TIME_PRESSURE", isExam && progress > 0.6 ? 0.16 : 0.02],
      ["CALCULATION_ERROR", question.type === "calculation" ? 0.3 : 0.02],
      ["MEMORY_FAILURE", 0.09],
      ["UNCERTAIN_GUESS", confidence === "low" ? 0.3 : 0.04]
    ];
    const totalWeight = sumWeights(weights);
    let roll = random() * totalWeight;
    for (const [type, weight] of weights) {
      roll -= weight;
      if (roll <= 0) {
        errorType = type;
        break;
      }
    }
  }
  const wrongOptions = question.options.map((_, index) => index).filter((index) => index !== question.correctAnswer);
  return {
    id: `at-${session.id}-${question.id}-${order}`,
    questionId: question.id,
    sessionId: session.id,
    examId: isExam ? session.id : null,
    mode: session.mode,
    selected: unanswered ? null : correct ? question.correctAnswer : pick(random, wrongOptions),
    correct: unanswered ? null : correct,
    timeSpent,
    confidence,
    errorType,
    skipped: unanswered && random() < 0.35,
    timestamp
  };
}
var sumWeights = (weights) => weights.reduce((total, [, weight]) => total + weight, 0);
function generateMockHistory(userId) {
  const random = mulberry32(hashSeed(userId));
  const now2 = Date.now();
  const endOfToday = /* @__PURE__ */ new Date();
  endOfToday.setHours(23, 59, 59, 0);
  const plans = sessionPlan(random);
  const sessions = [];
  const attempts = [];
  for (const plan of plans) {
    const dayIndex = HISTORY_DAYS - 1 - plan.day;
    const hour = pick(random, plan.mode === "exam" ? [9, 10, 11, 15, 16] : [10, 14, 16, 19, 20, 21, 22]);
    const startedAt = endOfToday.getTime() - plan.day * DAY_MS - (23 - hour) * 36e5 - Math.floor(random() * 50) * 6e4;
    const questions = selectQuestions(random, plan);
    if (!questions.length) continue;
    const durationMinutes = plan.mode === "exam" ? plan.duration : null;
    const session = {
      id: `an-${plan.mode === "exam" ? "ex" : "pr"}-${dayIndex}-${Math.floor(random() * 1e6).toString(36)}`,
      mode: plan.mode,
      title: plan.title,
      subtitle: plan.subtitle ?? "",
      startedAt,
      submittedAt: startedAt + Math.round(questions.reduce((total2, question) => total2 + (question.stats?.avgTimeSec ?? 40) * (plan.mode === "exam" ? 0.95 : 1.1), 0) * 1e3),
      durationMinutes,
      status: "submitted",
      negativeMarking: plan.official ? -0.25 : plan.mode === "exam" ? 0 : 0,
      examKind: plan.kind ?? (plan.mode === "exam" ? "personal" : null),
      timedOut: Boolean(plan.timedOut),
      rank: null,
      percentile: null,
      source: "mock"
    };
    const total = questions.length;
    const secondsPerQuestion = (session.submittedAt - session.startedAt) / total / 1e3;
    const sessionAttempts = questions.map(
      (question, order) => buildAttempt(random, {
        session,
        question,
        order,
        total,
        timestamp: startedAt + Math.round((order + 0.5) * secondsPerQuestion) * 1e3,
        hour,
        dayIndex
      })
    );
    if (plan.mode === "exam") {
      const answered = sessionAttempts.filter((attempt) => attempt.correct !== null);
      const sessionAccuracy = answered.length ? answered.filter((attempt) => attempt.correct).length / answered.length : 0.5;
      session.percentile = Math.round(Math.min(99, Math.max(8, sessionAccuracy * 100 + (random() * 16 - 8))));
      if (plan.rank) {
        const cohort = 80 + Math.floor(random() * 160);
        session.rank = Math.max(1, Math.round(cohort * (1 - session.percentile / 100)));
        session.cohort = cohort;
      }
    }
    sessions.push(session);
    attempts.push(...sessionAttempts);
  }
  sessions.sort((a, b) => a.startedAt - b.startedAt);
  attempts.sort((a, b) => a.timestamp - b.timestamp);
  return { sessions, attempts, generatedAt: now2 };
}

// src/services/analytics/analyticsService.js
var STATE_KEY_PREFIX2 = "tapesh:analytics:v1:";
var resolveUserKey2 = (userRef) => {
  if (typeof userRef === "string") return userRef || "guest";
  const identity = userRef?.id ?? userRef?.phone;
  return identity ? String(identity) : "guest";
};
var stateKey2 = (userId) => `${STATE_KEY_PREFIX2}${resolveUserKey2(userId)}`;
function loadMockHistory(userId) {
  if (typeof window === "undefined") return generateMockHistory(userId);
  try {
    const cached = JSON.parse(window.localStorage.getItem(stateKey2(userId)) || "null");
    if (cached?.attempts?.length) return cached;
  } catch {
  }
  const fresh = generateMockHistory(userId);
  try {
    window.localStorage.setItem(stateKey2(userId), JSON.stringify(fresh));
  } catch {
  }
  return fresh;
}
var subjectMeta = new Map(SUBJECTS.map((subject) => [subject.id, subject]));
function enrichAttempt(attempt) {
  const question = questionById(attempt.questionId);
  if (!question) return null;
  const subject = subjectMeta.get(question.subject);
  return {
    ...attempt,
    subject: question.subject,
    subjectName: subject?.name ?? question.subject,
    subjectAccent: subject?.accent ?? "#9aa5b1",
    topicPath: question.topicPath,
    difficulty: question.difficulty,
    type: question.type,
    year: question.year,
    source: question.source,
    expectedTime: question.stats?.avgTimeSec ?? null,
    stem: question.stem
    /* برای پیش‌نمایش در تحلیل سؤال */
  };
}
function mapLiveSession(session) {
  const mode = session.mode === "exam" ? "exam" : "practice";
  const mapped = {
    id: session.id,
    mode,
    title: session.title,
    subtitle: session.subtitle ?? "",
    startedAt: session.startedAt,
    submittedAt: session.submittedAt,
    durationMinutes: session.endsAt ? Math.round((session.endsAt - session.startedAt) / 6e4) : null,
    status: session.status,
    negativeMarking: session.negativeMarking ?? 0,
    examKind: session.blueprint?.kind === "year" ? "official" : session.blueprint?.examId ? "personal" : mode === "exam" ? "personal" : null,
    timedOut: session.result?.reason === "timeout",
    rank: null,
    percentile: null,
    source: "live"
  };
  const attempts = (session.questionIds ?? []).map((questionId, order) => {
    const question = questionById(questionId);
    if (!question) return null;
    const answer = session.answers?.[questionId] ?? null;
    const correct = answer ? answer.selected === question.correctAnswer : null;
    return {
      id: `live-${session.id}-${questionId}-${order}`,
      questionId,
      sessionId: session.id,
      examId: mode === "exam" ? session.id : null,
      mode,
      selected: answer?.selected ?? null,
      correct,
      timeSpent: answer?.timeSpent ?? 0,
      confidence: null,
      /* بانک فعلی اطمینان ثبت نمی‌کند — تحلیل صادقانه می‌ماند */
      errorType: null,
      skipped: false,
      timestamp: answer?.answeredAt ?? session.submittedAt ?? session.startedAt
    };
  }).filter(Boolean);
  return { session: mapped, attempts };
}
function loadAttemptHistory(userId) {
  const mock = loadMockHistory(userId);
  let records = [
    ...mock.sessions.map((session) => ({ session, attempts: mock.attempts.filter((attempt) => attempt.sessionId === session.id) }))
  ];
  try {
    const live = fetchSubmittedSessions ? fetchSubmittedSessions(userId) : [];
    records = [...records, ...live.map(mapLiveSession)];
  } catch {
  }
  const sessions = records.map((record) => record.session).sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0));
  const attempts = records.flatMap((record) => record.attempts).map(enrichAttempt).filter(Boolean).sort((a, b) => a.timestamp - b.timestamp);
  return { sessions, attempts };
}

// src/services/knowledge/graphData.js
var KNOWLEDGE_NODES = [
  /* ── مرکز شبکه: دیابت ─────────────────────────────────────── */
  {
    id: "diabetes",
    slug: "diabetes",
    title: "\u062F\u06CC\u0627\u0628\u062A",
    englishTitle: "Diabetes Mellitus",
    type: "disease",
    courses: ["pathology", "physiology"],
    description: "\u0627\u062E\u062A\u0644\u0627\u0644 \u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u06A9 \u0645\u0632\u0645\u0646 \u0628\u0627 \u0647\u06CC\u067E\u0631\u06AF\u0644\u06CC\u0633\u0645\u06CC \u0645\u0632\u0645\u0646\u060C \u0646\u0627\u0634\u06CC \u0627\u0632 \u0646\u0642\u0635 \u062A\u0631\u0634\u062D \u0627\u0646\u0633\u0648\u0644\u06CC\u0646\u060C \u0639\u0645\u0644\u06A9\u0631\u062F \u0622\u0646 \u06CC\u0627 \u0647\u0631 \u062F\u0648\u061B \u06CC\u06A9\u06CC \u0627\u0632 \u067E\u0631\u062A\u06A9\u0631\u0627\u0631\u062A\u0631\u06CC\u0646 \u0645\u062D\u0648\u0631\u0647\u0627\u06CC \u0639\u0644\u0648\u0645 \u067E\u0627\u06CC\u0647 \u0648 \u0628\u0627\u0644\u06CC\u0646.",
    whyImportant: "\u062F\u06CC\u0627\u0628\u062A \u0646\u0645\u0648\u0646\u0647\u0654 \u06A9\u0627\u0645\u0644 \u06CC\u06A9 \u0645\u0648\u0636\u0648\u0639 \u0628\u06CC\u0646\u200C\u062F\u0631\u0633\u06CC \u0627\u0633\u062A: \u0641\u0647\u0645\u0634 \u0628\u062F\u0648\u0646 \u0622\u0646\u0627\u062A\u0648\u0645\u06CC \u067E\u0627\u0646\u06A9\u0631\u0627\u0633\u060C \u0641\u06CC\u0632\u06CC\u0648\u0644\u0648\u0698\u06CC \u0627\u0646\u0633\u0648\u0644\u06CC\u0646\u060C \u0628\u06CC\u0648\u0634\u06CC\u0645\u06CC \u06AF\u0644\u0648\u06A9\u0632 \u0648 \u067E\u0627\u062A\u0648\u0644\u0648\u0698\u06CC \u0639\u0648\u0627\u0631\u0636 \u0645\u0645\u06A9\u0646 \u0646\u06CC\u0633\u062A\u061B \u0628\u0647 \u0647\u0645\u06CC\u0646 \u062F\u0644\u06CC\u0644 \u0645\u0631\u06A9\u0632 \u0634\u0628\u06A9\u0647\u0654 \u062F\u0627\u0646\u0634 \u0627\u0633\u062A.",
    keywords: ["\u062F\u06CC\u0627\u0628\u062A", "\u0642\u0646\u062F \u062E\u0648\u0646", "diabetes", "hyperglycemia", "\u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u0633\u0645 \u06AF\u0644\u0648\u06A9\u0632"],
    aliases: ["\u062F\u06CC\u0627\u0628\u062A \u0634\u06CC\u0631\u06CC\u0646", "\u0645\u0631\u0636 \u0642\u0646\u062F", "Diabetes"],
    prerequisites: ["pancreas", "insulin", "glucose-regulation", "glycolysis", "insulin-resistance"],
    importance: 5,
    difficulty: "\u0645\u062A\u0648\u0633\u0637"
  },
  {
    id: "t1d",
    slug: "diabetes-type-1",
    title: "\u062F\u06CC\u0627\u0628\u062A \u0646\u0648\u0639 \u06F1",
    englishTitle: "Type 1 Diabetes",
    type: "disease",
    courses: ["pathology", "immunology"],
    description: "\u062F\u06CC\u0627\u0628\u062A \u0648\u0627\u0628\u0633\u062A\u0647 \u0628\u0647 \u0627\u0646\u0633\u0648\u0644\u06CC\u0646 \u0628\u0627 \u062A\u062E\u0631\u06CC\u0628 \u0627\u062A\u0648\u0627\u06CC\u0645\u06CC\u0648\u0646 \u0633\u0644\u0648\u0644\u200C\u0647\u0627\u06CC \u0628\u062A\u0627\u06CC \u062C\u0632\u0627\u06CC\u0631 \u0644\u0627\u0646\u06AF\u0631\u0647\u0627\u0646\u0633 \u0648 \u06A9\u0645\u0628\u0648\u062F \u0645\u0637\u0644\u0642 \u0627\u0646\u0633\u0648\u0644\u06CC\u0646\u061B \u0634\u0627\u06CC\u0639 \u062F\u0631 \u062C\u0648\u0627\u0646\u06CC \u0648 \u0645\u0633\u062A\u0639\u062F \u06A9\u062A\u0648\u0627\u0633\u06CC\u062F\u0648\u0632.",
    whyImportant: "\u0627\u0644\u06AF\u0648\u06CC \u06A9\u0644\u0627\u0633\u06CC\u06A9 \u0628\u06CC\u0645\u0627\u0631\u06CC \u0627\u062A\u0648\u0627\u06CC\u0645\u06CC\u0648\u0646 \u0627\u0646\u062F\u0648\u06A9\u0631\u06CC\u0646 \u0648 \u062A\u0641\u06A9\u06CC\u06A9 \u0622\u0646 \u0627\u0632 \u0646\u0648\u0639 \u06F2\u060C \u0646\u0642\u0637\u0647\u0654 \u0627\u0645\u062A\u062D\u0627\u0646\u06CC \u067E\u0631\u062A\u06A9\u0631\u0627\u0631 \u0627\u0633\u062A.",
    keywords: ["\u062F\u06CC\u0627\u0628\u062A \u0646\u0648\u0639 \u06F1", "\u0627\u0646\u0633\u0648\u0644\u06CC\u0646\u200C\u0648\u0627\u0628\u0633\u062A\u0647", "type 1", "t1d", "juvenile diabetes"],
    aliases: ["\u062F\u06CC\u0627\u0628\u062A \u062C\u0648\u0627\u0646\u06CC", "IDDM"],
    prerequisites: ["diabetes", "beta-cell", "autoimmune-beta-destruction"],
    importance: 5,
    difficulty: "\u0645\u062A\u0648\u0633\u0637"
  },
  {
    id: "t2d",
    slug: "diabetes-type-2",
    title: "\u062F\u06CC\u0627\u0628\u062A \u0646\u0648\u0639 \u06F2",
    englishTitle: "Type 2 Diabetes",
    type: "disease",
    courses: ["pathology"],
    description: "\u062F\u06CC\u0627\u0628\u062A \u0645\u0633\u062A\u0642\u0644 \u0627\u0632 \u0627\u0646\u0633\u0648\u0644\u06CC\u0646 \u0628\u0627 \u0645\u0642\u0627\u0648\u0645\u062A \u0628\u0647 \u0627\u0646\u0633\u0648\u0644\u06CC\u0646 \u0648 \u0646\u0642\u0635 \u0646\u0633\u0628\u06CC \u062A\u0631\u0634\u062D\u061B \u06F9\u06F0\u066A \u062F\u06CC\u0627\u0628\u062A\u200C\u0647\u0627\u060C \u0628\u0627 \u0632\u0645\u06CC\u0646\u0647\u0654 \u0686\u0627\u0642\u06CC \u0648 \u0633\u0646\u062F\u0631\u0645 \u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u06A9.",
    whyImportant: "\u0634\u0627\u06CC\u0639\u200C\u062A\u0631\u06CC\u0646 \u0628\u06CC\u0645\u0627\u0631\u06CC \u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u06A9 \u062F\u0646\u06CC\u0627 \u0648 \u0647\u062F\u0641 \u0627\u0635\u0644\u06CC \u062F\u0627\u0631\u0648\u0647\u0627\u06CC \u062E\u0648\u0631\u0627\u06A9\u06CC \u0636\u062F\u062F\u06CC\u0627\u0628\u062A.",
    keywords: ["\u062F\u06CC\u0627\u0628\u062A \u0646\u0648\u0639 \u06F2", "\u0645\u0633\u062A\u0642\u0644 \u0627\u0632 \u0627\u0646\u0633\u0648\u0644\u06CC\u0646", "type 2", "t2d", "NIDDM"],
    aliases: ["\u062F\u06CC\u0627\u0628\u062A \u0628\u0632\u0631\u06AF\u0633\u0627\u0644\u06CC", "NIDDM"],
    prerequisites: ["diabetes", "insulin-resistance"],
    importance: 5,
    difficulty: "\u0645\u062A\u0648\u0633\u0637"
  },
  {
    id: "prediabetes",
    slug: "prediabetes",
    title: "\u067E\u06CC\u0634\u200C\u062F\u06CC\u0627\u0628\u062A",
    englishTitle: "Prediabetes",
    type: "disease",
    courses: ["pathology"],
    description: "\u0645\u0631\u062D\u0644\u0647\u0654 \u0645\u0631\u0632\u06CC \u0628\u06CC\u0646 \u0646\u0631\u0645\u0627\u0644 \u0648 \u062F\u06CC\u0627\u0628\u062A\u061B \u06AF\u0644\u0648\u06A9\u0632 \u0646\u0627\u0634\u062A\u0627 \u06CC\u0627 \u062A\u062D\u0645\u0644 \u06AF\u0644\u0648\u06A9\u0632 \u0645\u062E\u062A\u0644 \u0648 HbA1c \u0628\u06CC\u0646 \u06F5.\u06F7 \u062A\u0627 \u06F6.\u06F4 \u062F\u0631\u0635\u062F \u2014 \u0641\u0631\u0635\u062A \u0637\u0644\u0627\u06CC\u06CC \u067E\u06CC\u0634\u06AF\u06CC\u0631\u06CC.",
    keywords: ["\u067E\u0631\u06CC\u200C\u062F\u06CC\u0627\u0628\u062A", "pre-diabetes", "\u0645\u0631\u062D\u0644\u0647 \u0645\u0631\u0632\u06CC"],
    aliases: ["\u0627\u062E\u062A\u0644\u0627\u0644 \u062A\u062D\u0645\u0644 \u06AF\u0644\u0648\u06A9\u0632", "IGT", "IFG"],
    prerequisites: ["diabetes", "hba1c"],
    importance: 3,
    difficulty: "\u067E\u0627\u06CC\u0647"
  },
  {
    id: "insulin-resistance",
    slug: "insulin-resistance",
    title: "\u0645\u0642\u0627\u0648\u0645\u062A \u0628\u0647 \u0627\u0646\u0633\u0648\u0644\u06CC\u0646",
    englishTitle: "Insulin Resistance",
    type: "concept",
    courses: ["physiology", "pathology"],
    description: "\u06A9\u0627\u0647\u0634 \u067E\u0627\u0633\u062E \u0628\u0627\u0641\u062A\u200C\u0647\u0627\u06CC \u0647\u062F\u0641 \u0628\u0647 \u0627\u0646\u0633\u0648\u0644\u06CC\u0646\u061B \u067E\u0627\u0646\u06A9\u0631\u0627\u0633 \u0628\u0627 \u0647\u0627\u06CC\u067E\u0631\u0627\u0646\u0633\u0648\u0644\u06CC\u0646\u0645\u06CC \u062C\u0628\u0631\u0627\u0646 \u0645\u06CC\u200C\u06A9\u0646\u062F \u062A\u0627 \u0648\u0642\u062A\u06CC \u0638\u0631\u0641\u06CC\u062A \u062A\u0631\u0634\u062D \u0641\u0631\u0633\u0648\u062F\u0647 \u0634\u0648\u062F.",
    whyImportant: "\u062D\u0644\u0642\u0647\u0654 \u0627\u062A\u0635\u0627\u0644 \u0686\u0627\u0642\u06CC\u060C \u0633\u0646\u062F\u0631\u0645 \u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u06A9\u060C \u06A9\u0628\u062F \u0686\u0631\u0628 \u0648 \u062F\u06CC\u0627\u0628\u062A \u0646\u0648\u0639 \u06F2 \u2014 \u0633\u062A\u0648\u0646 \u0641\u0642\u0631\u0627\u062A \u067E\u0627\u062A\u0648\u0641\u06CC\u0632\u06CC\u0648\u0644\u0648\u0698\u06CC \u0646\u0648\u0639 \u06F2.",
    keywords: ["\u0645\u0642\u0627\u0648\u0645\u062A \u0627\u0646\u0633\u0648\u0644\u06CC\u0646", "insulin resistance", "\u0647\u0627\u06CC\u067E\u0631\u0627\u0646\u0633\u0648\u0644\u06CC\u0646\u0645\u06CC"],
    aliases: ["Insulin Resistance Syndrome"],
    prerequisites: ["insulin", "insulin-receptor"],
    importance: 5,
    difficulty: "\u0645\u062A\u0648\u0633\u0637"
  },
  {
    id: "metabolic-syndrome",
    slug: "metabolic-syndrome",
    title: "\u0633\u0646\u062F\u0631\u0645 \u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u06A9",
    englishTitle: "Metabolic Syndrome",
    type: "disease",
    courses: ["pathology"],
    description: "\u062E\u0648\u0634\u0647\u0654 \u0686\u0627\u0642\u06CC \u0645\u0631\u06A9\u0632\u06CC\u060C \u062F\u06CC\u0633\u200C\u0644\u06CC\u067E\u06CC\u062F\u0645\u06CC\u060C \u0647\u06CC\u067E\u0631\u062A\u0646\u0634\u0646\u060C \u0647\u06CC\u067E\u0631\u06AF\u0644\u06CC\u0633\u0645\u06CC \u0648 \u0645\u0642\u0627\u0648\u0645\u062A \u0628\u0647 \u0627\u0646\u0633\u0648\u0644\u06CC\u0646\u061B \u062E\u0637\u0631 \u0642\u0644\u0628\u06CC-\u0639\u0631\u0648\u0642\u06CC \u0631\u0627 \u0686\u0646\u062F \u0628\u0631\u0627\u0628\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F.",
    keywords: ["\u0633\u0646\u062F\u0631\u0645 \u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u06A9", "metabolic syndrome", "\u0686\u0627\u0642\u06CC \u0645\u0631\u06A9\u0632\u06CC"],
    aliases: ["\u0633\u0646\u062F\u0631\u0645 X"],
    prerequisites: ["insulin-resistance"],
    importance: 3,
    difficulty: "\u067E\u0627\u06CC\u0647"
  },
  {
    id: "dka",
    slug: "diabetic-ketoacidosis",
    title: "\u06A9\u062A\u0648\u0627\u0633\u06CC\u062F\u0648\u0632 \u062F\u06CC\u0627\u0628\u062A\u06CC",
    englishTitle: "Diabetic Ketoacidosis (DKA)",
    type: "disease",
    courses: ["pathology", "physiology"],
    description: "\u0639\u0627\u0631\u0636\u0647\u0654 \u062D\u0627\u062F \u06A9\u0645\u0628\u0648\u062F \u0645\u0637\u0644\u0642 \u0627\u0646\u0633\u0648\u0644\u06CC\u0646: \u06A9\u062A\u0648\u0698\u0646\u0632 \u0645\u0647\u0627\u0631\u0646\u0627\u0634\u062F\u0646\u06CC\u060C \u0627\u0633\u06CC\u062F\u0648\u0632 \u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u06A9 \u0628\u0627 \u0634\u06A9\u0627\u0641 \u0622\u0646\u06CC\u0648\u0646\u06CC \u0648 \u06A9\u0645\u200C\u0622\u0628\u06CC\u061B \u0627\u0648\u0631\u0698\u0627\u0646\u0633 \u062A\u06CC\u067E \u06F1.",
    whyImportant: "\u062A\u0631\u06A9\u06CC\u0628 \u06A9\u0644\u0627\u0633\u06CC\u06A9 \u0628\u06CC\u0648\u0634\u06CC\u0645\u06CC (\u06A9\u062A\u0648\u0698\u0646\u0632) \u0648 \u0641\u06CC\u0632\u06CC\u0648\u0644\u0648\u0698\u06CC (\u0627\u0633\u06CC\u062F-\u0628\u0627\u0632) \u062F\u0631 \u06CC\u06A9 \u0628\u06CC\u0645\u0627\u0631\u06CC\u061B \u0645\u0648\u0631\u062F \u0645\u062D\u0628\u0648\u0628 \u0622\u0632\u0645\u0648\u0646\u200C\u0647\u0627.",
    keywords: ["\u06A9\u062A\u0648\u0627\u0633\u06CC\u062F\u0648\u0632", "dka", "ketoacidosis", "\u0634\u06A9\u0627\u0641 \u0622\u0646\u06CC\u0648\u0646\u06CC"],
    aliases: ["DKA"],
    prerequisites: ["ketogenesis", "t1d", "insulin"],
    importance: 4,
    difficulty: "\u067E\u06CC\u0634\u0631\u0641\u062A\u0647"
  },
  {
    id: "hypoglycemia",
    slug: "hypoglycemia",
    title: "\u0647\u06CC\u067E\u0648\u06AF\u0644\u06CC\u0633\u0645\u06CC",
    englishTitle: "Hypoglycemia",
    type: "disease",
    courses: ["physiology"],
    description: "\u0627\u0641\u062A \u06AF\u0644\u0648\u06A9\u0632 \u062E\u0648\u0646 \u0632\u06CC\u0631 \u06F5\u06F5 \u0645\u06CC\u0644\u06CC\u200C\u06AF\u0631\u0645/\u062F\u0633\u06CC\u200C\u0644\u06CC\u062A\u0631 \u0628\u0627 \u062A\u0631\u06CC\u0627\u062F \u0648\u06CC\u062A\u0627\u0644\u060C \u0639\u0644\u0627\u0626\u0645 \u0646\u0648\u0631\u0648\u06AF\u0644\u06CC\u06A9\u0648\u067E\u0646\u06CC\u06A9 \u0648 \u0628\u0647\u0628\u0648\u062F \u0628\u0627 \u062E\u0648\u0631\u0627\u06A9\u06CC\u061B \u0634\u0627\u06CC\u0639\u200C\u062A\u0631\u06CC\u0646 \u0639\u0627\u0631\u0636\u0647\u0654 \u0627\u0646\u0633\u0648\u0644\u06CC\u0646\u200C\u062F\u0631\u0645\u0627\u0646\u06CC.",
    keywords: ["\u0647\u06CC\u067E\u0648\u06AF\u0644\u06CC\u0633\u0645\u06CC", "hypoglycemia", "\u0627\u0641\u062A \u0642\u0646\u062F"],
    aliases: ["\u0627\u0641\u062A \u0642\u0646\u062F \u062E\u0648\u0646"],
    prerequisites: ["glucose-regulation", "insulin"],
    importance: 4,
    difficulty: "\u067E\u0627\u06CC\u0647"
  },
  {
    id: "gestational-diabetes",
    slug: "gestational-diabetes",
    title: "\u062F\u06CC\u0627\u0628\u062A \u0628\u0627\u0631\u062F\u0627\u0631\u06CC",
    englishTitle: "Gestational Diabetes",
    type: "disease",
    courses: ["pathology", "physiology"],
    description: "\u0647\u06CC\u067E\u0631\u06AF\u0644\u06CC\u0633\u0645\u06CC \u0646\u062E\u0633\u062A\u06CC\u0646\u200C\u0628\u0627\u0631 \u062F\u0631 \u0628\u0627\u0631\u062F\u0627\u0631\u06CC\u061B \u0647\u0648\u0631\u0645\u0648\u0646\u200C\u0647\u0627\u06CC \u062C\u0641\u062A \u0645\u0642\u0627\u0648\u0645\u062A \u0628\u0647 \u0627\u0646\u0633\u0648\u0644\u06CC\u0646 \u0631\u0627 \u062A\u0634\u062F\u06CC\u062F \u0645\u06CC\u200C\u06A9\u0646\u0646\u062F \u0648 \u062E\u0637\u0631 \u062F\u06CC\u0627\u0628\u062A \u0646\u0648\u0639 \u06F2 \u0622\u06CC\u0646\u062F\u0647 \u0631\u0627 \u0628\u0627\u0644\u0627 \u0645\u06CC\u200C\u0628\u0631\u0646\u062F.",
    keywords: ["\u062F\u06CC\u0627\u0628\u062A \u0628\u0627\u0631\u062F\u0627\u0631\u06CC", "gestational", "\u0628\u0627\u0631\u062F\u0627\u0631\u06CC"],
    aliases: ["GDM"],
    prerequisites: ["diabetes", "insulin-resistance"],
    importance: 3,
    difficulty: "\u067E\u0627\u06CC\u0647"
  },
  /* ── عوارض مزمن ───────────────────────────────────────────── */
  {
    id: "diabetic-neuropathy",
    slug: "diabetic-neuropathy",
    title: "\u0646\u0648\u0631\u0648\u067E\u0627\u062A\u06CC \u062F\u06CC\u0627\u0628\u062A\u06CC",
    englishTitle: "Diabetic Neuropathy",
    type: "disease",
    courses: ["pathology"],
    description: "\u0622\u0633\u06CC\u0628 \u0639\u0635\u0628\u06CC \u0645\u062D\u06CC\u0637\u06CC \u0648 \u0627\u062A\u0648\u0646\u0648\u0645 \u0628\u0647\u200C\u062F\u0644\u06CC\u0644 \u0647\u06CC\u067E\u0631\u06AF\u0644\u06CC\u0633\u0645\u06CC \u0645\u0632\u0645\u0646 \u0648 \u0645\u06CC\u06A9\u0631\u0648\u0622\u0646\u0698\u06CC\u0648\u067E\u0627\u062A\u06CC\u061B \u0634\u0627\u06CC\u0639\u200C\u062A\u0631\u06CC\u0646 \u0634\u06A9\u0644\u060C \u067E\u0644\u06CC\u200C\u0646\u0648\u0631\u0648\u067E\u0627\u062A\u06CC \u062D\u0633\u06AF\u06CC\u0631\u0627\u0646 \u0645\u062A\u0642\u0627\u0631\u0646 \xAB\u062C\u0648\u0631\u0627\u0628 \u0648 \u062F\u0633\u062A\u06A9\u0634\xBB.",
    keywords: ["\u0646\u0648\u0631\u0648\u067E\u0627\u062A\u06CC", "neuropathy", "\u0627\u0639\u0635\u0627\u0628 \u0645\u062D\u06CC\u0637\u06CC"],
    aliases: ["\u0622\u0633\u06CC\u0628 \u0639\u0635\u0628 \u062F\u06CC\u0627\u0628\u062A\u06CC"],
    prerequisites: ["diabetes", "hyperglycemia"],
    importance: 3,
    difficulty: "\u0645\u062A\u0648\u0633\u0637"
  },
  {
    id: "diabetic-retinopathy",
    slug: "diabetic-retinopathy",
    title: "\u0631\u062A\u06CC\u0646\u0648\u067E\u0627\u062A\u06CC \u062F\u06CC\u0627\u0628\u062A\u06CC",
    englishTitle: "Diabetic Retinopathy",
    type: "disease",
    courses: ["pathology"],
    description: "\u0645\u06CC\u06A9\u0631\u0648\u0622\u0646\u0698\u06CC\u0648\u067E\u0627\u062A\u06CC \u0634\u0628\u06A9\u06CC\u0647 \u0627\u0632 \u0645\u06CC\u06A9\u0631\u0648\u0622\u0646\u0648\u0631\u06CC\u0633\u0645 \u0648 \u062E\u0648\u0646\u0631\u06CC\u0632\u06CC \u062A\u0627 \u0646\u0626\u0648\u0648\u0627\u0633\u06A9\u0648\u0644\u0627\u0631\u06CC\u0632\u0627\u0633\u06CC\u0648\u0646\u061B \u0639\u0644\u062A \u0646\u062E\u0633\u062A \u06A9\u0648\u0631\u06CC \u062F\u0631 \u0628\u0632\u0631\u06AF\u0633\u0627\u0644\u0627\u0646 \u0641\u0639\u0627\u0644.",
    keywords: ["\u0631\u062A\u06CC\u0646\u0648\u067E\u0627\u062A\u06CC", "retinopathy", "\u0634\u0628\u06A9\u06CC\u0647"],
    aliases: ["\u0628\u06CC\u0645\u0627\u0631\u06CC \u0634\u0628\u06A9\u06CC\u0647 \u062F\u06CC\u0627\u0628\u062A\u06CC"],
    prerequisites: ["diabetes", "hyperglycemia"],
    importance: 3,
    difficulty: "\u0645\u062A\u0648\u0633\u0637"
  },
  {
    id: "diabetic-nephropathy",
    slug: "diabetic-nephropathy",
    title: "\u0646\u0641\u0631\u0648\u067E\u0627\u062A\u06CC \u062F\u06CC\u0627\u0628\u062A\u06CC",
    englishTitle: "Diabetic Nephropathy",
    type: "disease",
    courses: ["pathology"],
    description: "\u0646\u0641\u0631\u0648\u0632 \u06A9\u0644\u0627\u0633\u06CC\u06A9 \u0646\u0648\u062F\u0648\u0644\u06CC (Kimmelstiel-Wilson)\u060C \u0622\u0644\u0628\u0648\u0645\u06CC\u0646\u0648\u0631\u06CC \u0648 \u0627\u0641\u062A GFR\u061B \u0639\u0644\u062A \u0646\u062E\u0633\u062A ESRD \u0648 \u0647\u062F\u0641 \u062F\u0631\u0645\u0627\u0646\u06CC \u0645\u0647\u0627\u0631\u06A9\u0646\u0646\u062F\u0647\u200C\u0647\u0627\u06CC SGLT2/RAAS.",
    keywords: ["\u0646\u0641\u0631\u0648\u067E\u0627\u062A\u06CC", "nephropathy", "\u0622\u0644\u0628\u0648\u0645\u06CC\u0646\u0648\u0631\u06CC", "\u06A9\u0644\u06CC\u0647"],
    aliases: ["\u0628\u06CC\u0645\u0627\u0631\u06CC \u06A9\u0644\u06CC\u0648\u06CC \u062F\u06CC\u0627\u0628\u062A\u06CC"],
    prerequisites: ["diabetes", "hyperglycemia"],
    importance: 3,
    difficulty: "\u0645\u062A\u0648\u0633\u0637"
  },
  {
    id: "diabetic-foot",
    slug: "diabetic-foot",
    title: "\u067E\u0627\u06CC \u062F\u06CC\u0627\u0628\u062A\u06CC",
    englishTitle: "Diabetic Foot",
    type: "finding",
    courses: ["pathology", "microbiology"],
    description: "\u0632\u062E\u0645 \u0645\u0632\u0645\u0646 \u067E\u0627 \u0627\u0632 \u062A\u0642\u0627\u0637\u0639 \u0646\u0648\u0631\u0648\u067E\u0627\u062A\u06CC (\u0628\u06CC\u200C\u062D\u0633\u06CC \u0648 \u062A\u063A\u06CC\u06CC\u0631 \u0634\u06A9\u0644)\u060C \u0627\u06CC\u0633\u06A9\u0645\u06CC \u0648 \u0639\u0641\u0648\u0646\u062A\u061B \u0634\u0627\u06CC\u0639\u200C\u062A\u0631\u06CC\u0646 \u0639\u0644\u062A \u0622\u0645\u067E\u0648\u062A\u0627\u0633\u06CC\u0648\u0646 \u063A\u06CC\u0631\u062A\u0631\u0648\u0645\u0627\u062A\u06CC\u06A9.",
    keywords: ["\u067E\u0627\u06CC \u062F\u06CC\u0627\u0628\u062A\u06CC", "diabetic foot", "\u0632\u062E\u0645 \u067E\u0627"],
    aliases: ["\u0632\u062E\u0645 \u067E\u0627\u06CC \u062F\u06CC\u0627\u0628\u062A\u06CC"],
    prerequisites: ["diabetic-neuropathy", "atherosclerosis", "diabetic-infections"],
    importance: 3,
    difficulty: "\u067E\u0627\u06CC\u0647"
  },
  {
    id: "atherosclerosis",
    slug: "atherosclerosis",
    title: "\u0622\u062A\u0631\u0648\u0627\u0633\u06A9\u0644\u0631\u0648\u0632",
    englishTitle: "Atherosclerosis",
    type: "disease",
    courses: ["pathology"],
    description: "\u062A\u0634\u06A9\u06CC\u0644 \u067E\u0644\u0627\u06A9 \u0644\u06CC\u067E\u06CC\u062F\u06CC-\u0627\u0644\u062A\u0647\u0627\u0628\u06CC \u062F\u0631 \u0634\u0631\u06CC\u0627\u0646\u200C\u0647\u0627\u061B \u062F\u06CC\u0627\u0628\u062A \u0645\u0633\u06CC\u0631 \u0622\u0646 \u0631\u0627 \u0628\u0627 \u06AF\u0644\u06CC\u06A9\u0627\u0633\u06CC\u0648\u0646\u060C \u062F\u06CC\u0633\u200C\u0644\u06CC\u067E\u06CC\u062F\u0645\u06CC \u0648 \u0627\u062E\u062A\u0644\u0627\u0644 \u0627\u0646\u062F\u0648\u062A\u0644\u06CC\u0648\u0645 \u0634\u062A\u0627\u0628 \u0645\u06CC\u200C\u062F\u0647\u062F.",
    keywords: ["\u0622\u062A\u0631\u0648\u0627\u0633\u06A9\u0644\u0631\u0648\u0632", "atherosclerosis", "\u067E\u0644\u0627\u06A9", "\u0642\u0644\u0628 \u0648 \u0639\u0631\u0648\u0642"],
    aliases: ["\u062A\u0635\u0644\u0628 \u0634\u0631\u0627\u06CC\u06CC\u0646"],
    prerequisites: ["diabetes"],
    importance: 3,
    difficulty: "\u0645\u062A\u0648\u0633\u0637"
  },
  /* ── آناتومی و سلول ───────────────────────────────────────── */
  {
    id: "pancreas",
    slug: "pancreas",
    title: "\u067E\u0627\u0646\u06A9\u0631\u0627\u0633",
    englishTitle: "Pancreas",
    type: "anatomy",
    courses: ["anatomy"],
    description: "\u063A\u062F\u0647\u0654 \u062F\u0648\u06A9\u0627\u0631\u0647\u0654 \u0635\u0641\u0627\u0642\u06CC \u062E\u0644\u0641\u06CC: \u0628\u062E\u0634 \u0627\u06AF\u0632\u0648\u06A9\u0631\u06CC\u0646 \u0622\u0646\u0632\u06CC\u0645 \u06AF\u0648\u0627\u0631\u0634\u06CC \u0648 \u0628\u062E\u0634 \u0627\u0646\u062F\u0648\u06A9\u0631\u06CC\u0646 (\u062C\u0632\u0627\u06CC\u0631 \u0644\u0627\u0646\u06AF\u0631\u0647\u0627\u0646\u0633) \u0647\u0648\u0631\u0645\u0648\u0646\u200C\u0647\u0627\u06CC \u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u06A9 \u062A\u0631\u0634\u062D \u0645\u06CC\u200C\u06A9\u0646\u062F.",
    keywords: ["\u067E\u0627\u0646\u06A9\u0631\u0627\u0633", "pancreas", "\u0644\u0648\u0632\u0627\u0644\u0645\u0639\u062F\u0647"],
    aliases: ["\u0644\u0648\u0632\u0627\u0644\u0645\u0639\u062F\u0647"],
    prerequisites: [],
    importance: 4,
    difficulty: "\u067E\u0627\u06CC\u0647"
  },
  {
    id: "islets",
    slug: "islets-of-langerhans",
    title: "\u062C\u0632\u0627\u06CC\u0631 \u0644\u0627\u0646\u06AF\u0631\u0647\u0627\u0646\u0633",
    englishTitle: "Islets of Langerhans",
    type: "anatomy",
    courses: ["anatomy", "histology"],
    description: "\u062C\u0632\u06CC\u0631\u0647\u200C\u0647\u0627\u06CC \u0627\u0646\u062F\u0648\u06A9\u0631\u06CC\u0646 \u067E\u0631\u0627\u06A9\u0646\u062F\u0647 \u062F\u0631 \u067E\u0627\u0646\u06A9\u0631\u0627\u0633\u061B \u0633\u0644\u0648\u0644\u200C\u0647\u0627\u06CC \u0628\u062A\u0627 (\u0645\u0631\u06A9\u0632\u060C ~\u06F7\u06F0\u066A)\u060C \u0622\u0644\u0641\u0627\u060C \u062F\u0644\u062A\u0627 \u0648 PP \u0631\u0627 \u062F\u0631 \u0686\u06CC\u062F\u0645\u0627\u0646 \u0645\u0646\u0638\u0645 \u0646\u06AF\u0647 \u0645\u06CC\u200C\u062F\u0627\u0631\u062F.",
    whyImportant: "\u067E\u0644 \u0628\u0627\u0641\u062A\u200C\u0634\u0646\u0627\u0633\u06CC \u0648 \u0641\u06CC\u0632\u06CC\u0648\u0644\u0648\u0698\u06CC: \u0647\u0631 \u0647\u0648\u0631\u0645\u0648\u0646 \u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u06A9 \u0627\u0632 \u0647\u0645\u06CC\u0646 \u062C\u0632\u06CC\u0631\u0647\u200C\u0647\u0627 \u0628\u06CC\u0631\u0648\u0646 \u0645\u06CC\u200C\u0622\u06CC\u062F.",
    keywords: ["\u062C\u0632\u0627\u06CC\u0631 \u0644\u0627\u0646\u06AF\u0631\u0647\u0627\u0646\u0633", "islets", "langerhans", "\u067E\u0627\u0646\u06A9\u0631\u0627\u0633 \u0627\u0646\u062F\u0648\u06A9\u0631\u06CC\u0646"],
    aliases: ["\u067E\u0627\u0646\u06A9\u0631\u0627\u0633 \u0627\u0646\u062F\u0648\u06A9\u0631\u06CC\u0646"],
    prerequisites: ["pancreas"],
    importance: 4,
    difficulty: "\u067E\u0627\u06CC\u0647"
  },
  {
    id: "liver",
    slug: "liver",
    title: "\u06A9\u0628\u062F",
    englishTitle: "Liver",
    type: "anatomy",
    courses: ["anatomy"],
    description: "\u06A9\u0627\u0631\u062E\u0627\u0646\u0647\u0654 \u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u06A9 \u0628\u062F\u0646: \u0645\u062D\u0644 \u06AF\u0644\u06CC\u06A9\u0648\u0698\u0646\u200C\u0633\u0627\u0632\u06CC\u060C \u06AF\u0644\u0648\u06A9\u0648\u0646\u0626\u0648\u0698\u0646\u0632\u060C \u06A9\u062A\u0648\u0698\u0646\u0632 \u0648 \u0644\u06CC\u067E\u0648\u0698\u0646\u0632\u061B \u067E\u0627\u0633\u062E\u200C\u062F\u0647\u0646\u062F\u0647\u0654 \u0627\u0635\u0644\u06CC \u0628\u0647 \u0627\u0646\u0633\u0648\u0644\u06CC\u0646 \u0648 \u06AF\u0644\u0648\u06A9\u0627\u06AF\u0648\u0646.",
    keywords: ["\u06A9\u0628\u062F", "liver", "\u062C\u06AF\u0631"],
    aliases: ["\u062C\u06AF\u0631"],
    prerequisites: [],
    importance: 3,
    difficulty: "\u067E\u0627\u06CC\u0647"
  },
  {
    id: "skeletal-muscle",
    slug: "skeletal-muscle",
    title: "\u0639\u0636\u0644\u0647\u0654 \u0627\u0633\u06A9\u0644\u062A\u06CC",
    englishTitle: "Skeletal Muscle",
    type: "anatomy",
    courses: ["anatomy"],
    description: "\u0628\u0632\u0631\u06AF\u200C\u062A\u0631\u06CC\u0646 \u0628\u0627\u0641\u062A \u0645\u0635\u0631\u0641\u200C\u06A9\u0646\u0646\u062F\u0647\u0654 \u06AF\u0644\u0648\u06A9\u0632 \u067E\u0633\u200C\u0627\u0632 \u063A\u0630\u0627\u061B \u0628\u0631\u062F\u0627\u0634\u062A \u06AF\u0644\u0648\u06A9\u0632 \u0648\u0627\u0628\u0633\u062A\u0647 \u0628\u0647 \u0627\u0646\u0633\u0648\u0644\u06CC\u0646 \u0622\u0646 \u0627\u0632 \u0637\u0631\u06CC\u0642 GLUT4 \u0627\u0646\u062C\u0627\u0645 \u0645\u06CC\u200C\u0634\u0648\u062F.",
    keywords: ["\u0639\u0636\u0644\u0647 \u0627\u0633\u06A9\u0644\u062A\u06CC", "skeletal muscle", "\u0645\u0627\u0647\u06CC\u0686\u0647"],
    aliases: ["\u0645\u0627\u0647\u06CC\u0686\u0647\u0654 \u0627\u0633\u06A9\u0644\u062A\u06CC"],
    prerequisites: [],
    importance: 3,
    difficulty: "\u067E\u0627\u06CC\u0647"
  },
  {
    id: "adipose-tissue",
    slug: "adipose-tissue",
    title: "\u0628\u0627\u0641\u062A \u0686\u0631\u0628\u06CC",
    englishTitle: "Adipose Tissue",
    type: "anatomy",
    courses: ["anatomy", "histology"],
    description: "\u0627\u0646\u062F\u0627\u0645 \u0627\u0646\u062F\u0648\u06A9\u0631\u06CC\u0646 \u0641\u0639\u0627\u0644: \u0622\u062F\u06CC\u067E\u0648\u06A9\u0627\u06CC\u0646\u200C\u0647\u0627\u06CC \u0686\u0627\u0642\u06CC (\u0644\u067E\u062A\u06CC\u0646\u060C TNF-\u03B1\u060C \u0631\u0632\u06CC\u0633\u062A\u06CC\u0646) \u0645\u0642\u0627\u0648\u0645\u062A \u0628\u0647 \u0627\u0646\u0633\u0648\u0644\u06CC\u0646 \u0631\u0627 \u062A\u063A\u0630\u06CC\u0647 \u0645\u06CC\u200C\u06A9\u0646\u0646\u062F.",
    keywords: ["\u0628\u0627\u0641\u062A \u0686\u0631\u0628\u06CC", "adipose", "\u0686\u0627\u0642\u06CC", "\u0622\u062F\u06CC\u067E\u0648\u06A9\u0627\u06CC\u0646"],
    aliases: ["\u0646\u0633\u062C \u0686\u0631\u0628\u06CC"],
    prerequisites: [],
    importance: 2,
    difficulty: "\u067E\u0627\u06CC\u0647"
  },
  {
    id: "beta-cell",
    slug: "beta-cell",
    title: "\u0633\u0644\u0648\u0644 \u0628\u062A\u0627",
    englishTitle: "Beta Cell",
    type: "cell",
    courses: ["histology"],
    description: "\u0633\u0644\u0648\u0644 \u063A\u0627\u0644\u0628 \u062C\u0632\u0627\u06CC\u0631\u060C \u062A\u0631\u0634\u062D\u200C\u06A9\u0646\u0646\u062F\u0647\u0654 \u0627\u0646\u0633\u0648\u0644\u06CC\u0646 \u0648 \u067E\u067E\u062A\u06CC\u062F C\u061B \u062D\u0633\u0627\u0633\u200C\u062A\u0631\u06CC\u0646 \u0633\u0646\u062C\u0634\u200C\u06AF\u0631 \u06AF\u0644\u0648\u06A9\u0632 \u062E\u0648\u0646 \u0628\u0627 \u06AF\u06CC\u0631\u0646\u062F\u0647\u0654 GLUT2/\u06AF\u0644\u0648\u06A9\u0648\u06A9\u06CC\u0646\u0627\u0632.",
    keywords: ["\u0633\u0644\u0648\u0644 \u0628\u062A\u0627", "beta cell", "\u03B2-cell"],
    aliases: ["\u0628\u062A\u0627 \u0633\u0644\u0648\u0644"],
    prerequisites: ["islets"],
    importance: 4,
    difficulty: "\u067E\u0627\u06CC\u0647"
  },
  {
    id: "alpha-cell",
    slug: "alpha-cell",
    title: "\u0633\u0644\u0648\u0644 \u0622\u0644\u0641\u0627",
    englishTitle: "Alpha Cell",
    type: "cell",
    courses: ["histology"],
    description: "\u0633\u0644\u0648\u0644 \u067E\u0631\u06CC\u200C\u0641\u0631\u0631\u06CC \u062C\u0632\u06CC\u0631\u0647\u060C \u062A\u0631\u0634\u062D\u200C\u06A9\u0646\u0646\u062F\u0647\u0654 \u06AF\u0644\u0648\u06A9\u0627\u06AF\u0648\u0646\u061B \u0648\u0627\u06A9\u0646\u0634 \u0627\u0648\u0644 \u0628\u062F\u0646 \u0628\u0647 \u0647\u06CC\u067E\u0648\u06AF\u0644\u06CC\u0633\u0645\u06CC.",
    keywords: ["\u0633\u0644\u0648\u0644 \u0622\u0644\u0641\u0627", "alpha cell"],
    aliases: ["\u0622\u0644\u0641\u0627 \u0633\u0644\u0648\u0644"],
    prerequisites: ["islets"],
    importance: 3,
    difficulty: "\u067E\u0627\u06CC\u0647"
  },
  {
    id: "delta-cell",
    slug: "delta-cell",
    title: "\u0633\u0644\u0648\u0644 \u062F\u0644\u062A\u0627",
    englishTitle: "Delta Cell",
    type: "cell",
    courses: ["histology"],
    description: "\u062A\u0631\u0634\u062D\u200C\u06A9\u0646\u0646\u062F\u0647\u0654 \u0633\u0648\u0645\u0627\u062A\u0648\u0633\u062A\u0627\u062A\u06CC\u0646\u061B \u062A\u0646\u0638\u06CC\u0645\u200C\u06AF\u0631 \u0628\u0627\u0632\u062F\u0627\u0631\u0646\u062F\u0647\u0654 \u0647\u0645\u200C\u0632\u0645\u0627\u0646 \u0627\u0646\u0633\u0648\u0644\u06CC\u0646 \u0648 \u06AF\u0644\u0648\u06A9\u0627\u06AF\u0648\u0646.",
    keywords: ["\u0633\u0644\u0648\u0644 \u062F\u0644\u062A\u0627", "delta cell", "\u0633\u0648\u0645\u0627\u062A\u0648\u0633\u062A\u0627\u062A\u06CC\u0646"],
    aliases: ["\u062F\u0644\u062A\u0627 \u0633\u0644\u0648\u0644"],
    prerequisites: ["islets"],
    importance: 2,
    difficulty: "\u067E\u0627\u06CC\u0647"
  },
  /* ── مولکول‌ها و هورمون‌ها ─────────────────────────────────── */
  {
    id: "insulin",
    slug: "insulin",
    title: "\u0627\u0646\u0633\u0648\u0644\u06CC\u0646",
    englishTitle: "Insulin",
    type: "molecule",
    courses: ["physiology", "biochemistry"],
    description: "\u0647\u0648\u0631\u0645\u0648\u0646 \u0627\u0646\u0628\u0627\u0631\u0634 \u0627\u0646\u0631\u0698\u06CC: \u06AF\u0644\u0648\u06A9\u0632 \u0648 \u0627\u0633\u06CC\u062F \u0622\u0645\u06CC\u0646\u0647 \u0631\u0627 \u0628\u0647 \u062F\u0627\u062E\u0644 \u0633\u0644\u0648\u0644 \u0645\u06CC\u200C\u0628\u0631\u062F\u060C \u06AF\u0644\u06CC\u06A9\u0648\u0698\u0646/\u0686\u0631\u0628\u06CC/\u067E\u0631\u0648\u062A\u0626\u06CC\u0646\u200C\u0633\u0627\u0632\u06CC \u0631\u0627 \u0631\u0648\u0634\u0646 \u0648 \u062A\u062C\u0632\u06CC\u0647 \u0631\u0627 \u062E\u0627\u0645\u0648\u0634 \u0645\u06CC\u200C\u06A9\u0646\u062F.",
    whyImportant: "\u067E\u0631\u06A9\u0627\u0631\u0628\u0631\u062F\u062A\u0631\u06CC\u0646 \u0647\u0648\u0631\u0645\u0648\u0646 \u062F\u0631 \u0622\u0645\u0648\u0632\u0634 \u067E\u0632\u0634\u06A9\u06CC: \u0647\u0631 \u062F\u0631\u0633\u06CC \u2014 \u0627\u0632 \u0628\u06CC\u0648\u0634\u06CC\u0645\u06CC \u062A\u0627 \u0641\u0627\u0631\u0645\u0627 \u2014 \u0627\u0632 \u0622\u0646 \u0634\u0631\u0648\u0639 \u0645\u06CC\u200C\u0634\u0648\u062F.",
    keywords: ["\u0627\u0646\u0633\u0648\u0644\u06CC\u0646", "insulin", "\u0647\u0648\u0631\u0645\u0648\u0646 \u0644\u0648\u0632\u0627\u0644\u0645\u0639\u062F\u0647"],
    aliases: ["Insulin"],
    prerequisites: ["beta-cell"],
    importance: 5,
    difficulty: "\u067E\u0627\u06CC\u0647"
  },
  {
    id: "glucagon",
    slug: "glucagon",
    title: "\u06AF\u0644\u0648\u06A9\u0627\u06AF\u0648\u0646",
    englishTitle: "Glucagon",
    type: "molecule",
    courses: ["physiology"],
    description: "\u0647\u0648\u0631\u0645\u0648\u0646 \u0631\u0641\u0639\u200C\u0641\u0642\u0631 \u0633\u0648\u062E\u062A\u06CC: \u062F\u0631 \u06A9\u0628\u062F \u06AF\u0644\u06CC\u06A9\u0648\u0698\u0646\u0648\u0644\u06CC\u0632 \u0648 \u06AF\u0644\u0648\u06A9\u0648\u0646\u0626\u0648\u0698\u0646\u0632 \u0631\u0627 \u0631\u0648\u0634\u0646 \u0648 \u062F\u0631 \u0628\u0627\u0641\u062A \u0686\u0631\u0628\u06CC \u0644\u06CC\u067E\u0648\u0644\u06CC\u0632 \u0631\u0627 \u0641\u0639\u0627\u0644 \u0645\u06CC\u200C\u06A9\u0646\u062F.",
    keywords: ["\u06AF\u0644\u0648\u06A9\u0627\u06AF\u0648\u0646", "glucagon"],
    aliases: [],
    prerequisites: ["alpha-cell"],
    importance: 4,
    difficulty: "\u067E\u0627\u06CC\u0647"
  },
  {
    id: "glucose",
    slug: "blood-glucose",
    title: "\u06AF\u0644\u0648\u06A9\u0632 \u062E\u0648\u0646",
    englishTitle: "Blood Glucose",
    type: "molecule",
    courses: ["biochemistry", "physiology"],
    description: "\u0633\u0648\u062E\u062A \u062A\u0631\u062C\u06CC\u062D\u06CC \u0645\u063A\u0632 \u0648 \u0645\u062D\u0648\u0631 \u062A\u0646\u0638\u06CC\u0645 \u0647\u0648\u0631\u0645\u0648\u0646\u06CC\u061B \u0628\u0627\u0632\u0647\u0654 \u0637\u0628\u06CC\u0639\u06CC \u0646\u0627\u0634\u062A\u0627 \u06F7\u06F0 \u062A\u0627 \u06F1\u06F0\u06F0 \u0648 \u0628\u0639\u062F \u0627\u0632 \u063A\u0630\u0627 \u0632\u06CC\u0631 \u06F1\u06F4\u06F0 \u0645\u06CC\u0644\u06CC\u200C\u06AF\u0631\u0645/\u062F\u0633\u06CC\u200C\u0644\u06CC\u062A\u0631.",
    keywords: ["\u06AF\u0644\u0648\u06A9\u0632", "glucose", "\u0642\u0646\u062F \u062E\u0648\u0646"],
    aliases: ["\u062F\u06A9\u0633\u062A\u0631\u0648\u0632"],
    prerequisites: [],
    importance: 5,
    difficulty: "\u067E\u0627\u06CC\u0647"
  },
  {
    id: "insulin-receptor",
    slug: "insulin-receptor",
    title: "\u06AF\u06CC\u0631\u0646\u062F\u0647\u0654 \u0627\u0646\u0633\u0648\u0644\u06CC\u0646",
    englishTitle: "Insulin Receptor",
    type: "molecule",
    courses: ["biochemistry"],
    description: "\u062A\u06CC\u0631\u0648\u0632\u06CC\u0646\u200C\u06A9\u06CC\u0646\u0627\u0632 \u0686\u0647\u0627\u0631\u0632\u0646\u062C\u06CC\u0631\u0647\u200C\u0627\u06CC (\u03B1\u2082\u03B2\u2082)\u061B \u0627\u062A\u0648\u0641\u0633\u0641\u0648\u0631\u06CC\u0644\u0627\u0633\u06CC\u0648\u0646 \u0648 \u0641\u0639\u0627\u0644\u200C\u0633\u0627\u0632\u06CC \u0622\u0628\u0634\u0627\u0631 IRS/PI3K/Akt \u2014 \u0646\u0645\u0648\u0646\u0647\u0654 \u062F\u0631\u0633\u06CC \u06AF\u06CC\u0631\u0646\u062F\u0647\u200C\u0647\u0627\u06CC \u06A9\u06CC\u0646\u0627\u0632\u06CC.",
    keywords: ["\u06AF\u06CC\u0631\u0646\u062F\u0647 \u0627\u0646\u0633\u0648\u0644\u06CC\u0646", "insulin receptor", "\u062A\u06CC\u0631\u0648\u0632\u06CC\u0646 \u06A9\u06CC\u0646\u0627\u0632"],
    aliases: ["INSR", "RTK"],
    prerequisites: ["insulin"],
    importance: 4,
    difficulty: "\u0645\u062A\u0648\u0633\u0637"
  },
  {
    id: "glut4",
    slug: "glut4",
    title: "\u0646\u0627\u0642\u0644 GLUT4",
    englishTitle: "GLUT4 Transporter",
    type: "molecule",
    courses: ["biochemistry"],
    description: "\u0646\u0627\u0642\u0644 \u06AF\u0644\u0648\u06A9\u0632 \u062D\u0633\u0627\u0633 \u0628\u0647 \u0627\u0646\u0633\u0648\u0644\u06CC\u0646 \u062F\u0631 \u062D\u0628\u0627\u0628\u200C\u0647\u0627\u06CC \u062F\u0631\u0648\u0646\u200C\u0633\u0644\u0648\u0644\u06CC\u061B \u0628\u0627 Akt \u0628\u0647 \u063A\u0634\u0627 \u0645\u0646\u062A\u0642\u0644 \u0648 Vmax \u0628\u0631\u062F\u0627\u0634\u062A \u06AF\u0644\u0648\u06A9\u0632 \u0631\u0627 \u0686\u0646\u062F \u0628\u0631\u0627\u0628\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F.",
    keywords: ["glut4", "\u0646\u0627\u0642\u0644 \u06AF\u0644\u0648\u06A9\u0632", "glucose transporter"],
    aliases: ["GLUT-4", "SLC2A4"],
    prerequisites: ["insulin-receptor"],
    importance: 4,
    difficulty: "\u0645\u062A\u0648\u0633\u0637"
  },
  {
    id: "glp1",
    slug: "glp-1",
    title: "\u0647\u0648\u0631\u0645\u0648\u0646 GLP-1",
    englishTitle: "GLP-1 (Incretin)",
    type: "molecule",
    courses: ["physiology"],
    description: "\u0627\u06CC\u0646\u06A9\u0631\u062A\u06CC\u0646 \u0631\u0648\u062F\u0647\u200C\u0627\u06CC: \u062A\u0631\u0634\u062D \u0648\u0627\u0628\u0633\u062A\u0647 \u0628\u0647 \u06AF\u0644\u0648\u06A9\u0632\u0650 \u0627\u0646\u0633\u0648\u0644\u06CC\u0646 \u0631\u0627 \u062A\u0642\u0648\u06CC\u062A\u060C \u06AF\u0644\u0648\u06A9\u0627\u06AF\u0648\u0646 \u0631\u0627 \u0645\u0647\u0627\u0631 \u0648 \u062A\u062E\u0644\u06CC\u0647\u0654 \u0645\u0639\u062F\u0647 \u0631\u0627 \u06A9\u0646\u062F \u0645\u06CC\u200C\u06A9\u0646\u062F.",
    keywords: ["glp-1", "\u0627\u06CC\u0646\u06A9\u0631\u062A\u06CC\u0646", "incretin", "\u06AF\u0644\u0648\u06A9\u0627\u06AF\u0648\u0646\u200C\u0645\u0627\u0646\u0646\u062F"],
    aliases: ["\u067E\u067E\u062A\u06CC\u062F \u0634\u0628\u0647 \u06AF\u0644\u0648\u06A9\u0627\u06AF\u0648\u0646"],
    prerequisites: ["insulin-secretion"],
    importance: 3,
    difficulty: "\u0645\u062A\u0648\u0633\u0637"
  },
  {
    id: "c-peptide",
    slug: "c-peptide",
    title: "\u067E\u067E\u062A\u06CC\u062F C",
    englishTitle: "C-Peptide",
    type: "molecule",
    courses: ["physiology"],
    description: "\u0632\u0646\u062C\u06CC\u0631\u0647\u0654 \u0627\u062A\u0635\u0627\u0644\u06CC \u067E\u0631\u0648\u0627\u0646\u0633\u0648\u0644\u06CC\u0646 \u06A9\u0647 \u0647\u0645\u200C\u0627\u0631\u0632 \u0627\u0646\u0633\u0648\u0644\u06CC\u0646 \u062A\u0631\u0634\u062D \u0645\u06CC\u200C\u0634\u0648\u062F\u061B \u0646\u0634\u0627\u0646\u06AF\u0631 \u062F\u0631\u0648\u0646\u200C\u0632\u0627\u06CC \u0639\u0645\u0644\u06A9\u0631\u062F \u0633\u0644\u0648\u0644 \u0628\u062A\u0627 \u0648 \u062A\u0641\u06A9\u06CC\u06A9 \u0647\u06CC\u067E\u0648\u06AF\u0644\u06CC\u0633\u0645\u06CC \u062F\u0631\u0648\u0646\u200C\u0632\u0627 \u0627\u0632 \u062A\u0632\u0631\u06CC\u0642\u06CC.",
    keywords: ["c-peptide", "\u067E\u067E\u062A\u06CC\u062F c", "\u067E\u0631\u0648\u0627\u0646\u0633\u0648\u0644\u06CC\u0646"],
    aliases: ["Connecting Peptide"],
    prerequisites: ["insulin"],
    importance: 2,
    difficulty: "\u067E\u06CC\u0634\u0631\u0641\u062A\u0647"
  },
  {
    id: "gad-antibodies",
    slug: "gad-antibodies",
    title: "\u0622\u0646\u062A\u06CC\u200C\u0628\u0627\u062F\u06CC\u200C\u0647\u0627\u06CC \u0636\u062F GAD",
    englishTitle: "Anti-GAD Antibodies",
    type: "molecule",
    courses: ["immunology"],
    description: "\u067E\u0631\u0634\u0627\u06CC\u0639\u200C\u062A\u0631\u06CC\u0646 \u0646\u0634\u0627\u0646\u06AF\u0631 \u0627\u062A\u0648\u0627\u06CC\u0645\u06CC\u0648\u0646 \u062F\u0631 \u062F\u06CC\u0627\u0628\u062A \u0646\u0648\u0639 \u06F1\u061B \u0647\u0645\u0631\u0627\u0647 IA-2\u060C ZnT8 \u0648 \u0622\u0646\u062A\u06CC\u200C\u0628\u0627\u062F\u06CC \u0633\u0644\u0648\u0644 \u062C\u0632\u06CC\u0631\u0647\u060C \u0633\u0627\u0644\u200C\u0647\u0627 \u067E\u06CC\u0634 \u0627\u0632 \u0628\u0631\u0648\u0632 \u0628\u06CC\u0645\u0627\u0631\u06CC \u0645\u062B\u0628\u062A \u0645\u06CC\u200C\u0634\u0648\u062F.",
    keywords: ["gad", "\u0622\u0646\u062A\u06CC\u200C\u0628\u0627\u062F\u06CC", "autoantibody", "\u0627\u062A\u0648\u0627\u06CC\u0645\u06CC\u0648\u0646"],
    aliases: ["Anti-GAD65", "IA-2"],
    prerequisites: ["autoimmune-beta-destruction"],
    importance: 3,
    difficulty: "\u0645\u062A\u0648\u0633\u0637"
  },
  /* ── فرایندهای فیزیولوژیک ─────────────────────────────────── */
  {
    id: "glucose-regulation",
    slug: "glucose-homeostasis",
    title: "\u062A\u0646\u0638\u06CC\u0645 \u0642\u0646\u062F \u062E\u0648\u0646",
    englishTitle: "Glucose Homeostasis",
    type: "process",
    courses: ["physiology"],
    description: "\u062A\u0639\u0627\u062F\u0644 \u062F\u0648\u0633\u0648\u06CC\u0647\u0654 \u0627\u0646\u0633\u0648\u0644\u06CC\u0646 (\u0630\u062E\u06CC\u0631\u0647) \u0648 \u06AF\u0644\u0648\u06A9\u0627\u06AF\u0648\u0646 (\u0645\u0635\u0631\u0641) \u0628\u0631 \u0633\u0631 \u06AF\u0644\u0648\u06A9\u0632 \u062E\u0648\u0646\u061B \u0646\u0645\u0648\u0646\u0647\u0654 \u0622\u0645\u0648\u0632\u0634\u06CC \u0628\u0627\u0632\u062E\u0648\u0631\u062F \u0645\u0646\u0641\u06CC \u062F\u0631 \u0628\u062F\u0646.",
    keywords: ["\u062A\u0646\u0638\u06CC\u0645 \u0642\u0646\u062F", "homeostasis", "\u0647\u0645\u0626\u0648\u0633\u062A\u0627\u0632 \u06AF\u0644\u0648\u06A9\u0632"],
    aliases: ["\u0647\u0645\u0626\u0648\u0633\u062A\u0627\u0632 \u06AF\u0644\u0648\u06A9\u0632"],
    prerequisites: ["insulin", "glucagon"],
    importance: 5,
    difficulty: "\u067E\u0627\u06CC\u0647"
  },
  {
    id: "insulin-secretion",
    slug: "insulin-secretion",
    title: "\u062A\u0631\u0634\u062D \u0627\u0646\u0633\u0648\u0644\u06CC\u0646",
    englishTitle: "Insulin Secretion",
    type: "process",
    courses: ["physiology"],
    description: "\u06AF\u0644\u0648\u06A9\u0632 \u0627\u0632 GLUT2 \u0648\u0627\u0631\u062F \u0648 \u0628\u0627 \u06AF\u0644\u0648\u06A9\u0648\u06A9\u06CC\u0646\u0627\u0632 \u0641\u0633\u0641\u0648\u0631\u06CC\u0644\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F\u061B ATP/ADP \u0628\u0627\u0644\u0627\u062A\u0631\u060C \u0628\u0633\u062A\u0646 \u06A9\u0627\u0646\u0627\u0644 K-ATP\u060C \u062F\u067E\u0648\u0644\u0627\u0631\u06CC\u0632\u0627\u0633\u06CC\u0648\u0646\u060C \u0648\u0631\u0648\u062F \u06A9\u0644\u0633\u06CC\u0645 \u0648 \u0627\u06AF\u0632\u0648\u0633\u06CC\u062A\u0648\u0632.",
    whyImportant: "\u0646\u0645\u0648\u0646\u0647\u0654 \u062F\u0631\u0633\u06CC \u0627\u062A\u0635\u0627\u0644 \u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u0633\u0645 \u0628\u0647 \u0627\u0644\u06A9\u062A\u0631\u06CC\u0633\u06CC\u062A\u0647\u0654 \u0633\u0644\u0648\u0644\u06CC \u2014 \u0648 \u0647\u062F\u0641 \u0645\u0633\u062A\u0642\u06CC\u0645 \u0633\u0648\u0644\u0641\u0648\u0646\u06CC\u0644\u200C\u0627\u0648\u0631\u0647\u200C\u0647\u0627.",
    keywords: ["\u062A\u0631\u0634\u062D \u0627\u0646\u0633\u0648\u0644\u06CC\u0646", "insulin secretion", "\u06A9\u0627\u0646\u0627\u0644 k-atp", "\u06AF\u0644\u0648\u06A9\u0648\u06A9\u06CC\u0646\u0627\u0632"],
    aliases: [],
    prerequisites: ["beta-cell", "glucose"],
    importance: 4,
    difficulty: "\u0645\u062A\u0648\u0633\u0637"
  },
  {
    id: "glucose-uptake",
    slug: "glucose-uptake",
    title: "\u0628\u0631\u062F\u0627\u0634\u062A \u06AF\u0644\u0648\u06A9\u0632",
    englishTitle: "Cellular Glucose Uptake",
    type: "process",
    courses: ["physiology", "biochemistry"],
    description: "\u0648\u0631\u0648\u062F \u06AF\u0644\u0648\u06A9\u0632 \u0628\u0647 \u0639\u0636\u0644\u0647 \u0648 \u0628\u0627\u0641\u062A \u0686\u0631\u0628\u06CC \u0627\u0632 GLUT4 \u0648\u0627\u0628\u0633\u062A\u0647 \u0628\u0647 \u0627\u0646\u0633\u0648\u0644\u06CC\u0646\u061B \u06AF\u0644\u0648\u06A9\u0632 \u067E\u0633 \u0627\u0632 \u0641\u0633\u0641\u0648\u0631\u06CC\u0644\u0627\u0633\u06CC\u0648\u0646 \u0628\u0627 \u0647\u06AF\u0632\u0648\u06A9\u06CC\u0646\u0627\u0632 \u0627\u0632 \u0633\u0644\u0648\u0644 \u062E\u0627\u0631\u062C \u0646\u0645\u06CC\u200C\u0634\u0648\u062F.",
    keywords: ["\u0628\u0631\u062F\u0627\u0634\u062A \u06AF\u0644\u0648\u06A9\u0632", "glucose uptake", "\u0627\u0646\u062A\u0642\u0627\u0644 \u06AF\u0644\u0648\u06A9\u0632"],
    aliases: [],
    prerequisites: ["glut4", "insulin-signaling"],
    importance: 4,
    difficulty: "\u0645\u062A\u0648\u0633\u0637"
  },
  {
    id: "autoimmune-beta-destruction",
    slug: "autoimmune-beta-cell-destruction",
    title: "\u062A\u062E\u0631\u06CC\u0628 \u0627\u062A\u0648\u0627\u06CC\u0645\u06CC\u0648\u0646 \u0633\u0644\u0648\u0644 \u0628\u062A\u0627",
    englishTitle: "Autoimmune Beta-Cell Destruction",
    type: "process",
    courses: ["immunology"],
    description: "\u0646\u0641\u0648\u0630 \u0644\u0646\u0641\u0648\u0633\u06CC\u062A\u200C\u0647\u0627\u06CC T \u0633\u06CC\u062A\u06CC\u062A\u0648\u062A\u0648\u06A9\u0633\u06CC\u06A9 \u0648 \u0627\u0644\u062A\u0647\u0627\u0628 \u062C\u0632\u06CC\u0631\u0647\u200C\u0627\u06CC (Insulitis)\u061B \u06A9\u0645\u0628\u0648\u062F \u0627\u0646\u0633\u0648\u0644\u06CC\u0646 \u0648\u0642\u062A\u06CC \u0638\u0627\u0647\u0631 \u0645\u06CC\u200C\u0634\u0648\u062F \u06A9\u0647 ~\u06F8\u06F0\u066A \u062C\u0631\u0645 \u0633\u0644\u0648\u0644\u06CC \u0627\u0632 \u0628\u06CC\u0646 \u0631\u0641\u062A\u0647 \u0628\u0627\u0634\u062F.",
    keywords: ["\u0627\u062A\u0648\u0627\u06CC\u0645\u06CC\u0648\u0646", "autoimmune", "insulitis", "\u062A\u062E\u0631\u06CC\u0628 \u0633\u0644\u0648\u0644 \u0628\u062A\u0627"],
    aliases: ["\u0627\u0644\u062A\u0647\u0627\u0628 \u062C\u0632\u0627\u06CC\u0631", "Insulitis"],
    prerequisites: ["beta-cell", "insulin"],
    importance: 4,
    difficulty: "\u0645\u062A\u0648\u0633\u0637"
  },
  /* ── مسیرهای بیوشیمیایی ───────────────────────────────────── */
  {
    id: "insulin-signaling",
    slug: "insulin-signaling",
    title: "\u067E\u06CC\u0627\u0645\u200C\u0631\u0633\u0627\u0646\u06CC \u0627\u0646\u0633\u0648\u0644\u06CC\u0646",
    englishTitle: "Insulin Signaling Pathway",
    type: "pathway",
    courses: ["biochemistry"],
    description: "\u0622\u0628\u0634\u0627\u0631 IRS \u2192 PI3K \u2192 PIP3 \u2192 Akt\u061B Akt \u0627\u0646\u062A\u0642\u0627\u0644 GLUT4\u060C \u0633\u0646\u062A\u0632 \u06AF\u0644\u06CC\u06A9\u0648\u0698\u0646 (\u0645\u0647\u0627\u0631 GSK-3) \u0648 \u0644\u06CC\u067E\u0648\u0698\u0646\u0632 \u0631\u0627 \u0647\u0645\u0627\u0647\u0646\u06AF \u0645\u06CC\u200C\u06A9\u0646\u062F.",
    keywords: ["insulin signaling", "pi3k", "akt", "irs"],
    aliases: ["\u0622\u0628\u0634\u0627\u0631 PI3K-Akt"],
    prerequisites: ["insulin-receptor"],
    importance: 4,
    difficulty: "\u067E\u06CC\u0634\u0631\u0641\u062A\u0647"
  },
  {
    id: "glycolysis",
    slug: "glycolysis",
    title: "\u06AF\u0644\u06CC\u06A9\u0648\u0644\u06CC\u0632",
    englishTitle: "Glycolysis",
    type: "pathway",
    courses: ["biochemistry"],
    description: "\u062A\u062C\u0632\u06CC\u0647\u0654 \u06AF\u0644\u0648\u06A9\u0632 \u0628\u0647 \u062F\u0648 \u067E\u06CC\u0631\u0648\u0648\u0627\u062A \u062F\u0631 \u0633\u06CC\u062A\u0648\u067E\u0644\u0627\u0633\u0645 \u0628\u0627 \u062E\u0627\u0644\u0635 \u06F2 ATP \u0648 \u06F2 NADH\u061B \u0622\u0646\u0632\u06CC\u0645 \u0646\u0631\u062E\u200C\u0633\u0627\u0632 \u0641\u0633\u0641\u0648\u0641\u0631\u0648\u06A9\u062A\u0648\u06A9\u06CC\u0646\u0627\u0632-\u06F1 (PFK-1).",
    keywords: ["\u06AF\u0644\u06CC\u06A9\u0648\u0644\u06CC\u0632", "glycolysis", "pfk-1", "\u067E\u06CC\u0631\u0648\u0648\u0627\u062A"],
    aliases: ["\u0645\u0633\u06CC\u0631 \u0627\u0645\u0628\u062F\u0646-\u0645\u0627\u06CC\u0631\u0647\u0648\u0641"],
    prerequisites: ["glucose"],
    importance: 5,
    difficulty: "\u0645\u062A\u0648\u0633\u0637"
  },
  {
    id: "gluconeogenesis",
    slug: "gluconeogenesis",
    title: "\u06AF\u0644\u0648\u06A9\u0648\u0646\u0626\u0648\u0698\u0646\u0632",
    englishTitle: "Gluconeogenesis",
    type: "pathway",
    courses: ["biochemistry"],
    description: "\u0633\u0627\u062E\u062A \u06AF\u0644\u0648\u06A9\u0632 \u062A\u0627\u0632\u0647 \u0627\u0632 \u0644\u0627\u06A9\u062A\u0627\u062A\u060C \u06AF\u0644\u06CC\u0633\u0631\u0648\u0644 \u0648 \u0627\u0633\u06CC\u062F\u0647\u0627\u06CC \u0622\u0645\u06CC\u0646\u0647 \u06AF\u0644\u0648\u06A9\u0648\u0698\u0646\u06CC\u06A9 \u062F\u0631 \u06A9\u0628\u062F\u061B \u0686\u0647\u0627\u0631 \u0622\u0646\u0632\u06CC\u0645 \u06A9\u0644\u06CC\u062F\u06CC \u062F\u0648\u0631 \u0632\u062F\u0646 \u06AF\u0627\u0645\u200C\u0647\u0627\u06CC \u0628\u0631\u06AF\u0634\u062A\u200C\u0646\u0627\u067E\u0630\u06CC\u0631 \u06AF\u0644\u06CC\u06A9\u0648\u0644\u06CC\u0632.",
    keywords: ["\u06AF\u0644\u0648\u06A9\u0648\u0646\u0626\u0648\u0698\u0646\u0632", "gluconeogenesis", "\u067E\u06CC\u0631\u0648\u0648\u0627\u062A \u06A9\u0631\u0628\u0648\u06A9\u0633\u06CC\u0644\u0627\u0632"],
    aliases: ["\u0646\u0648\u0633\u0627\u0632\u06CC \u06AF\u0644\u0648\u06A9\u0632"],
    prerequisites: ["glycolysis"],
    importance: 4,
    difficulty: "\u067E\u06CC\u0634\u0631\u0641\u062A\u0647"
  },
  {
    id: "glycogenesis",
    slug: "glycogenesis",
    title: "\u06AF\u0644\u06CC\u06A9\u0648\u0698\u0646\u0632",
    englishTitle: "Glycogenesis",
    type: "pathway",
    courses: ["biochemistry"],
    description: "\u0633\u0646\u062A\u0632 \u06AF\u0644\u06CC\u06A9\u0648\u0698\u0646 \u062F\u0631 \u06A9\u0628\u062F \u0648 \u0639\u0636\u0644\u0647 \u0628\u0627 \u06AF\u0644\u06CC\u06A9\u0648\u0698\u0646\u200C\u0633\u06CC\u0646\u062A\u0627\u0632\u061B \u0627\u0646\u0633\u0648\u0644\u06CC\u0646 \u0622\u0646 \u0631\u0627 \u0641\u0639\u0627\u0644 \u0648 GSK-3 \u0631\u0627 \u0645\u0647\u0627\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F \u2014 \u0627\u0646\u0628\u0627\u0631\u0634 \u06AF\u0644\u0648\u06A9\u0632 \u0645\u0627\u0632\u0627\u062F.",
    keywords: ["\u06AF\u0644\u06CC\u06A9\u0648\u0698\u0646\u0632", "glycogenesis", "\u06AF\u0644\u06CC\u06A9\u0648\u0698\u0646", "\u06AF\u0644\u06CC\u06A9\u0648\u0698\u0646 \u0633\u06CC\u0646\u062A\u0627\u0632"],
    aliases: ["\u0633\u0646\u062A\u0632 \u06AF\u0644\u06CC\u06A9\u0648\u0698\u0646"],
    prerequisites: ["glycolysis"],
    importance: 3,
    difficulty: "\u0645\u062A\u0648\u0633\u0637"
  },
  {
    id: "glycogenolysis",
    slug: "glycogenolysis",
    title: "\u06AF\u0644\u06CC\u06A9\u0648\u0698\u0646\u0648\u0644\u06CC\u0632",
    englishTitle: "Glycogenolysis",
    type: "pathway",
    courses: ["biochemistry"],
    description: "\u062A\u062C\u0632\u06CC\u0647\u0654 \u06AF\u0644\u06CC\u06A9\u0648\u0698\u0646 \u0628\u0647 \u06AF\u0644\u0648\u06A9\u0632-\u06F1-\u0641\u0633\u0641\u0627\u062A \u0628\u0627 \u06AF\u0644\u06CC\u06A9\u0648\u0698\u0646\u200C\u0641\u0633\u0641\u0648\u0631\u06CC\u0644\u0627\u0632\u061B \u062F\u0631 \u06A9\u0628\u062F \u0628\u0631\u0627\u06CC \u062E\u0648\u0646\u060C \u062F\u0631 \u0639\u0636\u0644\u0647 \u0641\u0642\u0637 \u0628\u0631\u0627\u06CC \u062E\u0648\u062F\u0634 \u2014 \u062A\u0641\u0627\u0648\u062A \u06A9\u0644\u06CC\u062F\u06CC \u0622\u0632\u0645\u0648\u0646\u06CC.",
    keywords: ["\u06AF\u0644\u06CC\u06A9\u0648\u0698\u0646\u0648\u0644\u06CC\u0632", "glycogenolysis", "\u0641\u0633\u0641\u0648\u0631\u06CC\u0644\u0627\u0632"],
    aliases: ["\u062A\u062C\u0632\u06CC\u0647 \u06AF\u0644\u06CC\u06A9\u0648\u0698\u0646"],
    prerequisites: ["glycogenesis"],
    importance: 3,
    difficulty: "\u0645\u062A\u0648\u0633\u0637"
  },
  {
    id: "tca-cycle",
    slug: "tca-cycle",
    title: "\u0686\u0631\u062E\u0647\u0654 \u06A9\u0631\u0628\u0633",
    englishTitle: "TCA / Krebs Cycle",
    type: "pathway",
    courses: ["biochemistry"],
    description: "\u0647\u0633\u062A\u0647\u0654 \u0647\u0648\u0627\u0632\u06CC \u0645\u062A\u0627\u0628\u0648\u0644\u06CC\u0633\u0645 \u062F\u0631 \u0645\u06CC\u062A\u0648\u06A9\u0646\u062F\u0631\u06CC: \u0627\u0633\u062A\u06CC\u0644-CoA \u0628\u0647 CO\u2082\u060C NADH \u0648 FADH\u2082 \u0628\u0631\u0627\u06CC \u0632\u0646\u062C\u06CC\u0631\u0647\u0654 \u0627\u0646\u062A\u0642\u0627\u0644 \u0627\u0644\u06A9\u062A\u0631\u0648\u0646\u061B \u062A\u0642\u0627\u0637\u0639 \u0647\u0645\u0647\u0654 \u0645\u0633\u06CC\u0631\u0647\u0627.",
    keywords: ["\u06A9\u0631\u0628\u0633", "tca", "krebs", "\u0686\u0631\u062E\u0647 \u0627\u0633\u06CC\u062F \u0633\u06CC\u062A\u0631\u06CC\u06A9"],
    aliases: ["\u0686\u0631\u062E\u0647 \u0627\u0633\u06CC\u062F \u0633\u06CC\u062A\u0631\u06CC\u06A9", "\u0686\u0631\u062E\u0647 \u06A9\u0631\u0628\u0633"],
    prerequisites: ["glycolysis"],
    importance: 4,
    difficulty: "\u0645\u062A\u0648\u0633\u0637"
  },
  {
    id: "beta-oxidation",
    slug: "beta-oxidation",
    title: "\u0628\u062A\u0627-\u0627\u06A9\u0633\u06CC\u062F\u0627\u0633\u06CC\u0648\u0646",
    englishTitle: "Fatty Acid Beta-Oxidation",
    type: "pathway",
    courses: ["biochemistry"],
    description: "\u0628\u0631\u0634 \u067E\u06CC\u0648\u0633\u062A\u0647\u0654 \u062F\u0648\u06A9\u0631\u0628\u0646\u06CC \u0627\u0633\u06CC\u062F\u0647\u0627\u06CC \u0686\u0631\u0628 \u0628\u0647 \u0627\u0633\u062A\u06CC\u0644-CoA \u062F\u0631 \u0645\u06CC\u062A\u0648\u06A9\u0646\u062F\u0631\u06CC\u061B \u0645\u0646\u0628\u0639 \u0633\u0648\u0628\u0633\u062A\u0631\u0627 \u06A9\u062A\u0648\u0698\u0646\u0632 \u062F\u0631 \u0631\u0648\u0632\u0647\u200C\u062F\u0627\u0631\u06CC \u0648 DKA.",
    keywords: ["\u0628\u062A\u0627 \u0627\u06A9\u0633\u06CC\u062F\u0627\u0633\u06CC\u0648\u0646", "beta oxidation", "\u0627\u0633\u06CC\u062F \u0686\u0631\u0628"],
    aliases: ["\u0627\u06A9\u0633\u06CC\u062F\u0627\u0633\u06CC\u0648\u0646 \u0627\u0633\u06CC\u062F \u0686\u0631\u0628"],
    prerequisites: ["tca-cycle"],
    importance: 3,
    difficulty: "\u0645\u062A\u0648\u0633\u0637"
  },
  {
    id: "ketogenesis",
    slug: "ketogenesis",
    title: "\u06A9\u062A\u0648\u0698\u0646\u0632",
    englishTitle: "Ketogenesis",
    type: "pathway",
    courses: ["biochemistry"],
    description: "\u0633\u0627\u062E\u062A \u0627\u0633\u062A\u0648\u0627\u0633\u062A\u0627\u062A\u060C \u0628\u062A\u0627\u0647\u06CC\u062F\u0631\u0648\u06A9\u0633\u06CC\u200C\u0628\u0648\u062A\u06CC\u0631\u0627\u062A \u0648 \u0627\u0633\u062A\u0648\u0646 \u0627\u0632 \u0627\u0633\u062A\u06CC\u0644-CoA \u062F\u0631 \u06A9\u0628\u062F\u061B \u0633\u0648\u062E\u062A \u0645\u063A\u0632 \u062F\u0631 \u0642\u062D\u0637\u06CC \u2014 \u0648 \u0622\u062A\u0634 DKA \u0628\u06CC\u200C\u0627\u0646\u0633\u0648\u0644\u06CC\u0646.",
    keywords: ["\u06A9\u062A\u0648\u0698\u0646\u0632", "ketogenesis", "\u06A9\u062A\u0648\u0646", "\u0627\u0633\u062A\u06CC\u0644 coa"],
    aliases: ["\u0633\u0627\u062E\u062A \u0627\u062C\u0633\u0627\u0645 \u06A9\u062A\u0648\u0646\u06CC"],
    prerequisites: ["beta-oxidation"],
    importance: 4,
    difficulty: "\u067E\u06CC\u0634\u0631\u0641\u062A\u0647"
  },
  /* ── داروشناسی ────────────────────────────────────────────── */
  {
    id: "insulin-therapy",
    slug: "insulin-therapy",
    title: "\u0627\u0646\u0633\u0648\u0644\u06CC\u0646 \u062F\u0631\u0645\u0627\u0646\u06CC",
    englishTitle: "Insulin Therapy",
    type: "drug",
    courses: ["pharmacology"],
    description: "\u062A\u0646\u0647\u0627 \u062F\u0631\u0645\u0627\u0646 \u062A\u06CC\u067E \u06F1 \u0648 \u067E\u0627\u06CC\u0647\u0654 \u062F\u0631\u0645\u0627\u0646 \u067E\u06CC\u0634\u0631\u0641\u062A\u0647\u0654 \u062A\u06CC\u067E \u06F2\u061B \u062E\u0627\u0646\u0648\u0627\u062F\u0647\u200C\u0647\u0627\u06CC \u0633\u0631\u06CC\u0639\u060C \u06A9\u0648\u062A\u0627\u0647\u060C \u0645\u06CC\u0627\u0646\u200C\u0627\u062B\u0631 \u0648 \u0637\u0648\u0644\u200C\u0627\u062B\u0631 \u0628\u0627 \u0641\u0627\u0631\u0645\u0627\u06A9\u0648\u06A9\u06CC\u0646\u062A\u06CC\u06A9 \u0645\u062A\u0641\u0627\u0648\u062A.",
    keywords: ["\u0627\u0646\u0633\u0648\u0644\u06CC\u0646 \u062F\u0631\u0645\u0627\u0646\u06CC", "insulin therapy", "\u0627\u0646\u0633\u0648\u0644\u06CC\u0646 \u0628\u0627\u0633\u0648\u0644\u0627\u0631"],
    aliases: ["\u0627\u0646\u0633\u0648\u0644\u06CC\u0646 \u062A\u0632\u0631\u06CC\u0642\u06CC"],
    prerequisites: ["insulin", "t1d"],
    importance: 5,
    difficulty: "\u0645\u062A\u0648\u0633\u0637"
  },
  {
    id: "metformin",
    slug: "metformin",
    title: "\u0645\u062A\u0641\u0648\u0631\u0645\u06CC\u0646",
    englishTitle: "Metformin",
    type: "drug",
    courses: ["pharmacology"],
    description: "\u062E\u0637 \u0627\u0648\u0644 \u062F\u06CC\u0627\u0628\u062A \u0646\u0648\u0639 \u06F2: \u0641\u0639\u0627\u0644\u200C\u0633\u0627\u0632\u06CC AMPK \u0648 \u0645\u0647\u0627\u0631 \u06AF\u0644\u0648\u06A9\u0648\u0646\u0626\u0648\u0698\u0646\u0632 \u06A9\u0628\u062F\u06CC\u061B \u0648\u0632\u0646\u200C\u062E\u0646\u062B\u06CC\u060C \u0628\u062F\u0648\u0646 \u0647\u06CC\u067E\u0648\u06AF\u0644\u06CC\u0633\u0645\u06CC \u062A\u06A9\u200C\u062F\u0627\u0631\u0648\u06CC\u06CC\u060C \u0627\u062D\u062A\u06CC\u0627\u0637 \u062F\u0631 \u0646\u0627\u0631\u0633\u0627\u06CC\u06CC \u06A9\u0644\u06CC\u0647.",
    keywords: ["\u0645\u062A\u0641\u0648\u0631\u0645\u06CC\u0646", "metformin", "\u06AF\u0644\u0648\u06A9\u0648\u0641\u0627\u0698"],
    aliases: ["\u06AF\u0644\u0648\u06A9\u0648\u0641\u0627\u0698"],
    prerequisites: ["gluconeogenesis", "t2d"],
    importance: 5,
    difficulty: "\u067E\u0627\u06CC\u0647"
  },
  {
    id: "sulfonylureas",
    slug: "sulfonylureas",
    title: "\u0633\u0648\u0644\u0641\u0648\u0646\u06CC\u0644\u200C\u0627\u0648\u0631\u0647\u200C\u0647\u0627",
    englishTitle: "Sulfonylureas",
    type: "drug",
    courses: ["pharmacology"],
    description: "\u0628\u0633\u062A\u0646 \u06A9\u0627\u0646\u0627\u0644 K-ATP \u0633\u0644\u0648\u0644 \u0628\u062A\u0627 \u0648 \u062A\u0631\u0634\u062D \u0648\u0627\u0628\u0633\u062A\u0647 \u0628\u0647 \u06A9\u0644\u0633\u06CC\u0645 \u0627\u0646\u0633\u0648\u0644\u06CC\u0646\u061B \u0627\u062B\u0631\u0645\u0646\u062F \u0641\u0642\u0637 \u0628\u0627 \u0628\u0627\u0641\u062A \u0628\u062A\u0627\u06CC \u0632\u0646\u062F\u0647 \u2014 \u062E\u0637\u0631 \u0647\u06CC\u067E\u0648\u06AF\u0644\u06CC\u0633\u0645\u06CC \u0648 \u0627\u0641\u0632\u0627\u06CC\u0634 \u0648\u0632\u0646.",
    keywords: ["\u0633\u0648\u0644\u0641\u0648\u0646\u06CC\u0644 \u0627\u0648\u0631\u0647", "sulfonylurea", "\u06AF\u0644\u06CC\u0628\u0648\u0631\u06CC\u062F"],
    aliases: ["\u06AF\u0644\u06CC\u0628\u0648\u0631\u06CC\u062F", "\u06AF\u0644\u06CC\u200C\u0628\u0646\u06A9\u0644\u0627\u0645\u06CC\u062F"],
    prerequisites: ["insulin-secretion", "t2d"],
    importance: 3,
    difficulty: "\u067E\u0627\u06CC\u0647"
  },
  {
    id: "glp1-agonists",
    slug: "glp1-agonists",
    title: "\u0622\u06AF\u0648\u0646\u06CC\u0633\u062A\u200C\u0647\u0627\u06CC GLP-1",
    englishTitle: "GLP-1 Receptor Agonists",
    type: "drug",
    courses: ["pharmacology"],
    description: "\u062A\u0642\u0644\u06CC\u062F \u0627\u06CC\u0646\u06A9\u0631\u062A\u06CC\u0646 \u0628\u0627 \u0645\u0642\u0627\u0648\u0645\u062A \u0628\u0647 \u062F\u06CC\u200C\u067E\u067E\u062A\u06CC\u062F\u06CC\u0644\u200C\u067E\u067E\u062A\u06CC\u062F\u0627\u0632-\u06F4\u061B \u062A\u0631\u0634\u062D \u0648\u0627\u0628\u0633\u062A\u0647 \u0628\u0647 \u06AF\u0644\u0648\u06A9\u0632\u060C \u0633\u06CC\u0631\u06CC \u0648 \u06A9\u0627\u0647\u0634 \u0648\u0632\u0646 \u2014 \u0644\u06CC\u0631\u0627\u06AF\u0644\u0648\u062A\u06CC\u062F \u0648 \u0633\u0645\u06AF\u0644\u0648\u062A\u06CC\u062F.",
    keywords: ["glp-1", "\u0633\u0645\u06AF\u0644\u0648\u062A\u06CC\u062F", "\u0644\u06CC\u0631\u0627\u06AF\u0644\u0648\u062A\u06CC\u062F", "\u0627\u06AF\u0632\u0646\u0627\u062A\u06CC\u062F"],
    aliases: ["\u0644\u06CC\u0631\u0627\u06AF\u0644\u0648\u062A\u06CC\u062F", "\u0633\u0645\u06AF\u0644\u0648\u062A\u06CC\u062F"],
    prerequisites: ["glp1", "t2d"],
    importance: 3,
    difficulty: "\u0645\u062A\u0648\u0633\u0637"
  },
  {
    id: "sglt2-inhibitors",
    slug: "sglt2-inhibitors",
    title: "\u0645\u0647\u0627\u0631\u06A9\u0646\u0646\u062F\u0647\u200C\u0647\u0627\u06CC SGLT2",
    englishTitle: "SGLT2 Inhibitors",
    type: "drug",
    courses: ["pharmacology"],
    description: "\u062F\u0641\u0639 \u06AF\u0644\u0648\u06A9\u0632 \u0627\u0632 \u0627\u062F\u0631\u0627\u0631 \u0628\u0627 \u0645\u0647\u0627\u0631 \u0646\u0627\u0642\u0644 SGLT2 \u0646\u0641\u0631\u0648\u0646\u061B \u062D\u0641\u0627\u0638\u062A \u0642\u0644\u0628\u06CC-\u06A9\u0644\u06CC\u0648\u06CC \u0645\u0633\u062A\u0642\u0644 \u0627\u0632 \u06A9\u0627\u0647\u0634 \u0642\u0646\u062F \u2014 \u0627\u062F\u0627\u06AF\u0644\u06CC\u0641\u0644\u0648\u0632\u06CC\u0646 \u0648 \u0627\u0645\u067E\u0627\u06AF\u0644\u06CC\u0641\u0644\u0648\u0632\u06CC\u0646.",
    keywords: ["sglt2", "\u0627\u062F\u0627\u06AF\u0644\u06CC\u0641\u0644\u0648\u0632\u06CC\u0646", "\u0627\u0645\u067E\u0627\u06AF\u0644\u06CC\u0641\u0644\u0648\u0632\u06CC\u0646", "\u06AF\u0644\u0648\u06A9\u0648\u0632\u0648\u0631\u06CC \u062F\u0627\u0631\u0648\u06CC\u06CC"],
    aliases: ["\u06AF\u0644\u06CC\u0641\u0644\u0648\u0632\u06CC\u0646\u200C\u0647\u0627", "Flozins"],
    prerequisites: ["t2d", "diabetic-nephropathy"],
    importance: 3,
    difficulty: "\u0645\u062A\u0648\u0633\u0637"
  },
  /* ── ایمنی‌شناسی و میکروب ─────────────────────────────────── */
  {
    id: "diabetic-infections",
    slug: "diabetes-related-infections",
    title: "\u0639\u0641\u0648\u0646\u062A\u200C\u0647\u0627\u06CC \u0645\u0631\u062A\u0628\u0637 \u0628\u0627 \u062F\u06CC\u0627\u0628\u062A",
    englishTitle: "Diabetes-Related Infections",
    type: "concept",
    courses: ["microbiology"],
    description: "\u0647\u06CC\u067E\u0631\u06AF\u0644\u06CC\u0633\u0645\u06CC \u0639\u0645\u0644\u06A9\u0631\u062F \u0646\u0648\u062A\u0631\u0648\u0641\u06CC\u0644 \u0648 \u0627\u06CC\u0645\u0646\u06CC \u0633\u0644\u0648\u0644\u06CC \u0631\u0627 \u06A9\u0648\u0631 \u0645\u06CC\u200C\u06A9\u0646\u062F: \u0639\u0641\u0648\u0646\u062A\u200C\u0647\u0627\u06CC \u0645\u06A9\u0631\u0631 \u0627\u062F\u0631\u0627\u0631\u06CC\u060C \u06A9\u0627\u0646\u062F\u06CC\u062F\u06CC\u0627\u0632\u06CC\u0633 \u0648 \u0639\u0641\u0648\u0646\u062A\u200C\u0647\u0627\u06CC \u0639\u0645\u06CC\u0642 \u0628\u0627\u0641\u062A \u0646\u0631\u0645.",
    keywords: ["\u0639\u0641\u0648\u0646\u062A", "infection", "\u0646\u0648\u062A\u0631\u0648\u0641\u06CC\u0644", "\u0627\u06CC\u0645\u0646\u06CC"],
    aliases: ["\u0627\u0633\u062A\u0639\u062F\u0627\u062F \u0639\u0641\u0648\u0646\u06CC \u062F\u06CC\u0627\u0628\u062A"],
    prerequisites: ["hyperglycemia"],
    importance: 2,
    difficulty: "\u067E\u0627\u06CC\u0647"
  },
  {
    id: "mucormycosis",
    slug: "mucormycosis",
    title: "\u0645\u0648\u06A9\u0648\u0631\u0645\u06CC\u06A9\u0648\u0632",
    englishTitle: "Mucormycosis",
    type: "microorganism",
    courses: ["microbiology"],
    description: "\u0642\u0627\u0631\u0686 \u0641\u0644\u0627\u0633\u0641\u0648\u0645 \u0628\u0627 \u0645\u06CC\u0644 \u0622\u0647\u0646\u06CC\u061B \u0631\u06CC\u0646\u0648\u0633\u0631\u0628\u0627\u0644\u060C \u062A\u0647\u0627\u062C\u0645\u06CC \u0648 \u06A9\u0634\u0646\u062F\u0647 \u062F\u0631 \u0632\u0645\u06CC\u0646\u0647\u0654 \u06A9\u062A\u0648\u0627\u0633\u06CC\u062F\u0648\u0632 \u2014 \u0627\u0648\u0631\u0698\u0627\u0646\u0633 \u062A\u0634\u062E\u06CC\u0635\u06CC \u0627\u0646\u06A9\u0648\u0698\u0646\u0648\u0644\u0648\u0698\u06CC\u06A9\u0650 \u062F\u06CC\u0627\u0628\u062A.",
    keywords: ["\u0645\u0648\u06A9\u0648\u0631", "mucormycosis", "\u0632\u06CC\u06AF\u0648\u0645\u0627\u06CC\u06A9\u0648\u0632", "\u0641\u0644\u0627\u0633\u0641\u0648\u0645"],
    aliases: ["\u0632\u06CC\u06AF\u0648\u0645\u0627\u06CC\u06A9\u0648\u0632"],
    prerequisites: ["dka"],
    importance: 2,
    difficulty: "\u067E\u06CC\u0634\u0631\u0641\u062A\u0647"
  },
  /* ── یافته‌ها و آزمایش‌ها ──────────────────────────────────── */
  {
    id: "hyperglycemia",
    slug: "hyperglycemia",
    title: "\u0647\u06CC\u067E\u0631\u06AF\u0644\u06CC\u0633\u0645\u06CC",
    englishTitle: "Hyperglycemia",
    type: "finding",
    courses: ["pathology", "physiology"],
    description: "\u06AF\u0644\u0648\u06A9\u0632 \u0628\u0627\u0644\u0627\u062A\u0631 \u0627\u0632 \u0622\u0633\u062A\u0627\u0646\u0647\u0654 \u06A9\u0644\u06CC\u0648\u06CC (~\u06F1\u06F8\u06F0) \u0628\u0627 \u06AF\u0644\u0648\u06A9\u0648\u0632\u0648\u0631\u06CC \u0627\u0633\u0645\u0648\u062A\u06CC\u06A9\u061B \u062D\u0627\u062F: \u067E\u0644\u06CC\u200C\u0627\u0648\u0631\u06CC \u0648 \u067E\u0631\u0646\u0648\u0634\u06CC\u060C \u0645\u0632\u0645\u0646: \u06AF\u0644\u06CC\u06A9\u0627\u0633\u06CC\u0648\u0646 \u067E\u0631\u0648\u062A\u0626\u06CC\u0646 \u0648 \u0639\u0648\u0627\u0631\u0636 \u0631\u06CC\u0632\u0639\u0631\u0648\u0642\u06CC.",
    keywords: ["\u0647\u06CC\u067E\u0631\u06AF\u0644\u06CC\u0633\u0645\u06CC", "hyperglycemia", "\u0642\u0646\u062F \u0628\u0627\u0644\u0627"],
    aliases: ["\u0642\u0646\u062F \u062E\u0648\u0646 \u0628\u0627\u0644\u0627"],
    prerequisites: ["glucose-regulation"],
    importance: 4,
    difficulty: "\u067E\u0627\u06CC\u0647"
  },
  {
    id: "polyuria",
    slug: "polyuria",
    title: "\u067E\u0631\u0627\u062F\u0631\u0627\u0631\u06CC (\u067E\u0644\u06CC\u200C\u0627\u0648\u0631\u06CC)",
    englishTitle: "Polyuria",
    type: "finding",
    courses: ["physiology"],
    description: "\u0627\u062F\u0631\u0627\u0631 \u062D\u062C\u0645 \u0628\u0627\u0644\u0627 \u0627\u0632 \u06A9\u0634\u06CC\u062F\u06AF\u06CC \u0627\u0633\u0645\u0648\u062A\u06CC\u06A9 \u06AF\u0644\u0648\u06A9\u0632 \u0627\u062F\u0631\u0627\u0631\u06CC\u061B \u0627\u0648\u0644\u06CC\u0646 \u062D\u0644\u0642\u0647\u0654 \u0645\u062B\u0644\u062B \u06A9\u0644\u0627\u0633\u06CC\u06A9 \u067E\u0644\u06CC\u200C\u0627\u0648\u0631\u06CC\u060C \u067E\u0644\u06CC\u200C\u062F\u06CC\u067E\u0633\u06CC\u060C \u06A9\u0627\u0647\u0634 \u0648\u0632\u0646.",
    keywords: ["\u067E\u0644\u06CC \u0627\u0648\u0631\u06CC", "polyuria", "\u0627\u062F\u0631\u0627\u0631 \u0632\u06CC\u0627\u062F"],
    aliases: ["\u067E\u0644\u06CC\u200C\u0627\u0648\u0631\u06CC"],
    prerequisites: ["hyperglycemia"],
    importance: 3,
    difficulty: "\u067E\u0627\u06CC\u0647"
  },
  {
    id: "polydipsia",
    slug: "polydipsia",
    title: "\u067E\u0631\u0646\u0648\u0634\u06CC (\u067E\u0644\u06CC\u200C\u062F\u06CC\u067E\u0633\u06CC)",
    englishTitle: "Polydipsia",
    type: "finding",
    courses: ["physiology"],
    description: "\u062A\u0634\u0646\u06AF\u06CC \u0634\u062F\u06CC\u062F \u062C\u0628\u0631\u0627\u0646\u06CC \u06A9\u0645\u200C\u0622\u0628\u06CC \u067E\u0644\u06CC\u200C\u0627\u0648\u0631\u06CC\u061B \u0647\u0645\u0631\u0627\u0647 \u0647\u0645\u06CC\u0634\u06AF\u06CC \u067E\u0631\u0627\u062F\u0631\u0627\u0631\u06CC \u062F\u0631 \u0634\u0631\u0648\u0639 \u062F\u06CC\u0627\u0628\u062A.",
    keywords: ["\u067E\u0644\u06CC \u062F\u06CC\u067E\u0633\u06CC", "polydipsia", "\u062A\u0634\u0646\u06AF\u06CC"],
    aliases: ["\u067E\u0644\u06CC\u200C\u062F\u06CC\u067E\u0633\u06CC"],
    prerequisites: ["polyuria"],
    importance: 2,
    difficulty: "\u067E\u0627\u06CC\u0647"
  },
  {
    id: "fasting-glucose",
    slug: "fasting-plasma-glucose",
    title: "\u0642\u0646\u062F \u062E\u0648\u0646 \u0646\u0627\u0634\u062A\u0627 (FPG)",
    englishTitle: "Fasting Plasma Glucose",
    type: "labTest",
    courses: ["physiology"],
    description: "\u06AF\u0644\u0648\u06A9\u0632 \u067E\u0633 \u0627\u0632 \u06F8 \u0633\u0627\u0639\u062A \u0646\u0627\u0634\u062A\u0627: \u0646\u0631\u0645\u0627\u0644 \u0632\u06CC\u0631 \u06F1\u06F0\u06F0\u060C \u067E\u06CC\u0634\u200C\u062F\u06CC\u0627\u0628\u062A \u06F1\u06F0\u06F0-\u06F1\u06F2\u06F5\u060C \u062F\u06CC\u0627\u0628\u062A \u06F1\u06F2\u06F6 \u0628\u0647 \u0628\u0627\u0644\u0627 (\u062F\u0631 \u062F\u0648 \u0646\u0648\u0628\u062A) \u0645\u06CC\u0644\u06CC\u200C\u06AF\u0631\u0645/\u062F\u0633\u06CC\u200C\u0644\u06CC\u062A\u0631.",
    keywords: ["fpg", "\u0642\u0646\u062F \u0646\u0627\u0634\u062A\u0627", "fasting glucose"],
    aliases: ["FPG"],
    prerequisites: ["glucose"],
    importance: 4,
    difficulty: "\u067E\u0627\u06CC\u0647"
  },
  {
    id: "hba1c",
    slug: "hba1c",
    title: "\u0647\u0645\u0648\u06AF\u0644\u0648\u0628\u06CC\u0646 A1c",
    englishTitle: "Hemoglobin A1c",
    type: "labTest",
    courses: ["pathology", "physiology"],
    description: "\u062D\u0627\u0641\u0638\u0647\u0654 \u06F3 \u0645\u0627\u0647\u0647\u0654 \u0642\u0646\u062F \u062E\u0648\u0646: \u06AF\u0644\u06CC\u06A9\u0627\u0633\u06CC\u0648\u0646 \u063A\u06CC\u0631\u0622\u0646\u0632\u06CC\u0645\u06CC \u0647\u0645\u0648\u06AF\u0644\u0648\u0628\u06CC\u0646 \u0628\u062A\u0627\u061B \u062F\u06CC\u0627\u0628\u062A \u0627\u0632 \u06F6.\u06F5 \u062F\u0631\u0635\u062F \u2014 \u0645\u0639\u06CC\u0627\u0631 \u06A9\u0646\u062A\u0631\u0644 \u0648 \u0647\u062F\u0641 \u062F\u0631\u0645\u0627\u0646.",
    whyImportant: "\u067E\u0644 \u0628\u06CC\u0646 \u0628\u06CC\u0648\u0634\u06CC\u0645\u06CC (\u06AF\u0644\u06CC\u06A9\u0627\u0633\u06CC\u0648\u0646) \u0648 \u0628\u0627\u0644\u06CC\u0646 (\u067E\u0627\u06CC\u0634 \u062F\u0631\u0645\u0627\u0646) \u2014 \u067E\u0631\u062A\u06A9\u0631\u0627\u0631\u062A\u0631\u06CC\u0646 \u0622\u0632\u0645\u0627\u06CC\u0634 \u0627\u06CC\u0646 \u062D\u0648\u0632\u0647.",
    keywords: ["hba1c", "a1c", "\u0647\u0645\u0648\u06AF\u0644\u0648\u0628\u06CC\u0646 \u06AF\u0644\u06CC\u06A9\u0648\u0632\u06CC\u0644\u0647"],
    aliases: ["\u0647\u0645\u0648\u06AF\u0644\u0648\u0628\u06CC\u0646 \u06AF\u0644\u06CC\u06A9\u0648\u0632\u06CC\u0644\u0647"],
    prerequisites: ["glucose"],
    importance: 5,
    difficulty: "\u067E\u0627\u06CC\u0647"
  },
  {
    id: "ogtt",
    slug: "ogtt",
    title: "\u062A\u0633\u062A \u062A\u062D\u0645\u0644 \u06AF\u0644\u0648\u06A9\u0632 (OGTT)",
    englishTitle: "Oral Glucose Tolerance Test",
    type: "labTest",
    courses: ["physiology"],
    description: "\u06F7\u06F5 \u06AF\u0631\u0645 \u06AF\u0644\u0648\u06A9\u0632 \u062E\u0648\u0631\u0627\u06A9\u06CC \u0648 \u0633\u0646\u062C\u0634 \u06F2 \u0633\u0627\u0639\u062A \u0628\u0639\u062F: \u0632\u06CC\u0631 \u06F1\u06F4\u06F0 \u0646\u0631\u0645\u0627\u0644\u060C \u06F1\u06F4\u06F0-\u06F1\u06F9\u06F9 \u0645\u062E\u062A\u0644\u060C \u06F2\u06F0\u06F0 \u0628\u0647 \u0628\u0627\u0644\u0627 \u062F\u06CC\u0627\u0628\u062A\u061B \u0627\u0633\u062A\u0627\u0646\u062F\u0627\u0631\u062F \u0628\u0627\u0631\u062F\u0627\u0631\u06CC.",
    keywords: ["ogtt", "\u062A\u062D\u0645\u0644 \u06AF\u0644\u0648\u06A9\u0632", "\u062A\u0633\u062A \u062A\u062D\u0645\u0644"],
    aliases: ["\u06A9\u0631\u0627\u06CC\u0647\u200C\u0627\u06CC \u06AF\u0644\u0648\u06A9\u0632"],
    prerequisites: ["fasting-glucose"],
    importance: 3,
    difficulty: "\u067E\u0627\u06CC\u0647"
  },
  {
    id: "ketones",
    slug: "blood-ketones",
    title: "\u06A9\u062A\u0648\u0646\u200C\u0647\u0627\u06CC \u062E\u0648\u0646",
    englishTitle: "Blood Ketones",
    type: "labTest",
    courses: ["pathology"],
    description: "\u0633\u0646\u062C\u0634 \u0628\u062A\u0627\u0647\u06CC\u062F\u0631\u0648\u06A9\u0633\u06CC\u200C\u0628\u0648\u062A\u06CC\u0631\u0627\u062A\u061B \u0633\u062A\u0648\u0646 \u062A\u0634\u062E\u06CC\u0635 \u0648 \u067E\u06CC\u06AF\u06CC\u0631\u06CC \u06A9\u062A\u0648\u0627\u0633\u06CC\u062F\u0648\u0632\u060C \u0647\u0645\u0631\u0627\u0647 \u0628\u0627 \u06AF\u0627\u0632 \u062E\u0648\u0646 \u0648 \u0634\u06A9\u0627\u0641 \u0622\u0646\u06CC\u0648\u0646\u06CC.",
    keywords: ["\u06A9\u062A\u0648\u0646", "ketones", "\u0628\u062A\u0627 \u0647\u06CC\u062F\u0631\u0648\u06A9\u0633\u06CC \u0628\u0648\u062A\u06CC\u0631\u0627\u062A"],
    aliases: ["\u0627\u062C\u0633\u0627\u0645 \u06A9\u062A\u0648\u0646\u06CC"],
    prerequisites: ["ketogenesis"],
    importance: 3,
    difficulty: "\u0645\u062A\u0648\u0633\u0637"
  }
];

// src/services/greenPath/curriculumEngine.js
var normalize = (value) => String(value ?? "").toLowerCase().replace(/[يى]/g, "\u06CC").replace(/ك/g, "\u06A9").replace(/[أإآ]/g, "\u0627").replace(/[^a-z0-9\u0600-\u06FF]+/g, " ").replace(/\s+/g, " ").trim();
var slug = (value) => normalize(value).replace(/\s+/g, "-").replace(/^-+|-+$/g, "") || "topic";
var topicIdOf = (courseId, title, index) => `${courseId}:${slug(title)}:${index}`;
var questionCounts = QUESTIONS.reduce((map, question) => {
  const path = question.topicPath ?? [];
  if (!path.length) return map;
  const courseId = question.subject;
  const parent = `${courseId}|${normalize(path[0])}`;
  const leaf = `${parent}|${normalize(path[path.length - 1])}`;
  map.set(parent, (map.get(parent) ?? 0) + 1);
  map.set(leaf, (map.get(leaf) ?? 0) + 1);
  return map;
}, /* @__PURE__ */ new Map());
var findKnowledgeNode = (courseId, title) => {
  const wanted = normalize(title);
  return KNOWLEDGE_NODES.find((node) => {
    const titleMatches = [node.title, node.englishTitle, ...node.keywords ?? [], ...node.aliases ?? []].map(normalize).some((term) => term && (term === wanted || term.includes(wanted) || wanted.includes(term)));
    return titleMatches && (!courseId || (node.courses ?? []).includes(courseId));
  }) ?? null;
};
var importanceFrom = (questionCount, knowledgeNode) => {
  const questionImportance = questionCount >= 8 ? 5 : questionCount >= 4 ? 4 : questionCount >= 2 ? 3 : 2;
  return Math.max(questionImportance, knowledgeNode?.importance ?? 1);
};
function buildCourseTopics(courseId, entries, now2) {
  const topics = [];
  const topicIds = [];
  let order = 0;
  entries.forEach((entry, parentIndex) => {
    const parentId = topicIdOf(courseId, entry.name, parentIndex);
    const parentQuestions = questionCounts.get(`${courseId}|${normalize(entry.name)}`) ?? 0;
    const parentNode = findKnowledgeNode(courseId, entry.name);
    const parent = {
      id: parentId,
      entityType: "CourseTopic",
      courseId,
      title: entry.name,
      path: [entry.name],
      parentId: null,
      depth: 0,
      order: order++,
      weight: Math.max(1, parentQuestions || entry.children?.length || 1),
      importance: importanceFrom(parentQuestions, parentNode),
      difficulty: parentNode?.difficulty ?? "\u0645\u062A\u0648\u0633\u0637",
      knowledgeNodeId: parentNode?.id ?? null,
      prerequisiteTopicIds: [],
      estimatedMinutes: Math.max(28, 24 + parentQuestions * 3),
      questionCount: parentQuestions,
      createdAt: now2,
      updatedAt: now2
    };
    topics.push(parent);
    topicIds.push(parentId);
    (entry.children ?? []).forEach((childTitle, childIndex) => {
      const childId = topicIdOf(courseId, `${entry.name}-${childTitle}`, childIndex);
      const childQuestions = questionCounts.get(`${courseId}|${normalize(entry.name)}|${normalize(childTitle)}`) ?? 0;
      const childNode = findKnowledgeNode(courseId, childTitle) ?? parentNode;
      const child = {
        id: childId,
        entityType: "Subtopic",
        courseId,
        title: childTitle,
        path: [entry.name, childTitle],
        parentId,
        depth: 1,
        order: order++,
        weight: Math.max(1, childQuestions || 1),
        importance: importanceFrom(childQuestions, childNode),
        difficulty: childNode?.difficulty ?? parent.difficulty,
        knowledgeNodeId: childNode?.id ?? null,
        prerequisiteTopicIds: [parentId],
        estimatedMinutes: Math.max(20, 18 + childQuestions * 3),
        questionCount: childQuestions,
        createdAt: now2,
        updatedAt: now2
      };
      topics.push(child);
      topicIds.push(childId);
    });
  });
  return { topics, topicIds };
}
function buildCurriculumGraph({ now: now2 = (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const courses = [];
  const topics = [];
  const topicIdsByKnowledgeNode = /* @__PURE__ */ new Map();
  SUBJECTS.forEach((subject, courseIndex) => {
    const sourceEntries = TOPIC_TREE[subject.id] ?? [];
    const built = buildCourseTopics(subject.id, sourceEntries, now2);
    const course = {
      id: subject.id,
      entityType: "Course",
      title: subject.name,
      track: "medicine",
      order: courseIndex,
      topicIds: built.topicIds,
      topicCount: built.topics.length,
      importance: built.topics.length ? Math.max(...built.topics.map((topic) => topic.importance)) : 1,
      createdAt: now2,
      updatedAt: now2
    };
    courses.push(course);
    topics.push(...built.topics);
    built.topics.forEach((topic) => {
      if (topic.knowledgeNodeId) topicIdsByKnowledgeNode.set(topic.knowledgeNodeId, topic.id);
    });
  });
  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  topics.forEach((topic) => {
    const node = KNOWLEDGE_NODES.find((candidate) => candidate.id === topic.knowledgeNodeId);
    const mappedPrerequisites = (node?.prerequisites ?? []).map((nodeId) => topicIdsByKnowledgeNode.get(nodeId)).filter(Boolean);
    const previousSameCourse = topics.filter((candidate) => candidate.courseId === topic.courseId && candidate.order < topic.order).sort((a, b) => b.order - a.order)[0];
    const prerequisites = [.../* @__PURE__ */ new Set([
      ...topic.prerequisiteTopicIds,
      ...mappedPrerequisites,
      ...previousSameCourse && topic.depth === 0 ? [previousSameCourse.id] : []
    ])].filter((id) => id !== topic.id && topicById.has(id));
    topic.prerequisiteTopicIds = prerequisites;
  });
  const edges = topics.flatMap(
    (topic) => topic.prerequisiteTopicIds.map((source) => ({
      id: `${source}->${topic.id}`,
      source,
      target: topic.id,
      type: "prerequisite"
    }))
  );
  return {
    entityType: "CurriculumGraph",
    courses,
    topics,
    topicById,
    courseById: new Map(courses.map((course) => [course.id, course])),
    edges,
    stats: {
      courseCount: courses.length,
      topicCount: topics.length,
      edgeCount: edges.length
    }
  };
}
var curriculumNormalize = normalize;

// src/services/greenPath/resourceEngine.js
var route = (layer, view) => {
  const params = new URLSearchParams({ l: layer, v: JSON.stringify(view) });
  return `#dashboard?${params.toString()}`;
};
var resourceId = (type, topicId) => `resource:${type}:${topicId}`;
var sectionForResourceType = (type) => ({
  [RESOURCE_TYPES.MICRO_LESSON]: "course-micro",
  [RESOURCE_TYPES.COMPREHENSIVE_LESSON]: "course-comprehensive",
  [RESOURCE_TYPES.QUESTION_BANK]: "test-bank",
  [RESOURCE_TYPES.WIKI]: "wiki",
  [RESOURCE_TYPES.KNOWLEDGE_NETWORK]: "knowledge",
  [RESOURCE_TYPES.REFERENCE]: "reference",
  [RESOURCE_TYPES.FLASHCARD]: "flashcards",
  [RESOURCE_TYPES.COORDINATED_EXAM]: "coordinated-exam"
})[type] ?? "course-micro";
var withSection = (resource) => {
  const sectionId = sectionForResourceType(resource.type);
  const section = GREEN_PATH_SECTIONS[sectionId];
  return { ...resource, sectionId, sectionLabel: section?.label ?? resourceLabel(resource.type), accent: section?.accent ?? "var(--green-ink)" };
};
function buildResourcesForTopic({ topic, course, knowledgeNodeId = null, now: now2 = (/* @__PURE__ */ new Date()).toISOString() }) {
  const resources = [
    {
      id: resourceId(RESOURCE_TYPES.MICRO_LESSON, topic.id),
      entityType: "Resource",
      type: RESOURCE_TYPES.MICRO_LESSON,
      title: `${topic.title} \u2014 \u0645\u0631\u0648\u0631 \u0633\u0631\u06CC\u0639`,
      courseId: course.id,
      topicId: topic.id,
      entityId: topic.id,
      route: route("course-micro", { filter: "all", subject: course.id, deep: { topicId: topic.id } }),
      metadata: { minutes: 12, action: "learn" },
      createdAt: now2,
      updatedAt: now2
    },
    {
      id: resourceId(RESOURCE_TYPES.COMPREHENSIVE_LESSON, topic.id),
      entityType: "Resource",
      type: RESOURCE_TYPES.COMPREHENSIVE_LESSON,
      title: `${course.title} \u2014 ${topic.title}`,
      courseId: course.id,
      topicId: topic.id,
      entityId: topic.id,
      route: route("course-comprehensive", { deep: { subject: course.id, topicId: topic.id } }),
      metadata: { section: topic.path.join(" \u203A "), action: "learn" },
      createdAt: now2,
      updatedAt: now2
    },
    {
      id: resourceId(RESOURCE_TYPES.QUESTION_BANK, topic.id),
      entityType: "Resource",
      type: RESOURCE_TYPES.QUESTION_BANK,
      title: `\u062A\u0633\u062A ${topic.title}`,
      courseId: course.id,
      topicId: topic.id,
      entityId: topic.id,
      route: route("test-bank", { name: "topics", subjectId: course.id, topicPath: topic.path }),
      metadata: { count: topic.questionCount, action: "practice" },
      createdAt: now2,
      updatedAt: now2
    },
    {
      id: resourceId(RESOURCE_TYPES.WIKI, topic.id),
      entityType: "Resource",
      type: RESOURCE_TYPES.WIKI,
      title: `\u0648\u06CC\u06A9\u06CC \u062A\u067E\u0634 \u2014 ${topic.title}`,
      courseId: course.id,
      topicId: topic.id,
      entityId: topic.title,
      route: route("wiki", { mode: "results", query: topic.title, filters: {}, sort: "relevance" }),
      metadata: { action: "clarify" },
      createdAt: now2,
      updatedAt: now2
    },
    {
      id: resourceId(RESOURCE_TYPES.KNOWLEDGE_NETWORK, topic.id),
      entityType: "Resource",
      type: RESOURCE_TYPES.KNOWLEDGE_NETWORK,
      title: "\u0627\u0631\u062A\u0628\u0627\u0637 \u062F\u0631 \u0634\u0628\u06A9\u0647 \u062F\u0627\u0646\u0634",
      courseId: course.id,
      topicId: topic.id,
      entityId: knowledgeNodeId,
      route: route("knowledge", { mode: "graph", topicId: knowledgeNodeId, selectedId: knowledgeNodeId }),
      metadata: { action: "integrate", optional: !knowledgeNodeId },
      createdAt: now2,
      updatedAt: now2
    },
    {
      id: resourceId(RESOURCE_TYPES.REFERENCE, topic.id),
      entityType: "Resource",
      type: RESOURCE_TYPES.REFERENCE,
      title: `\u0631\u0641\u0631\u0646\u0633 \u067E\u06CC\u0634\u0646\u0647\u0627\u062F\u06CC \u2014 ${topic.title}`,
      courseId: course.id,
      topicId: topic.id,
      entityId: course.id === "physiology" ? "guyton" : course.id === "anatomy" ? "gray" : course.id === "histology" ? "junqueira" : null,
      route: route("course-reference", { mode: "shelf", topicId: topic.id }),
      metadata: { action: "deep-dive", recommendation: topic.importance >= 4 ? "essential" : "recommended" },
      createdAt: now2,
      updatedAt: now2
    }
  ];
  return resources.map(withSection);
}
function resourceLabel(type) {
  return RESOURCE_LABELS[type] ?? type;
}

// src/services/greenPath/progressEngine.js
var clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
var round = (value, digits = 0) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
var daysBetween = (from, to) => Math.max(0, (new Date(to).getTime() - new Date(from).getTime()) / 864e5);
var topicMatchesAttempt = (topic, attempt) => {
  const path = (attempt.topicPath ?? []).map(curriculumNormalize);
  const wanted = topic.path.map(curriculumNormalize);
  if (!path.length || !wanted.length) return false;
  return wanted.every((part) => path.some((candidate) => candidate === part || candidate.includes(part) || part.includes(candidate)));
};
var defaultTopicPerformance = (topic) => ({
  entityType: "TopicPerformance",
  topicId: topic.id,
  courseId: topic.courseId,
  completion: 0,
  accuracy: null,
  attemptCount: 0,
  correctCount: 0,
  errorCount: 0,
  reviewCount: 0,
  confidence: null,
  lastStudyAt: null,
  lastReviewAt: null,
  retentionEstimate: null,
  mastery: 0
});
function buildTopicPerformanceForTopic(topic, attempts, taskPatches, now2) {
  const matched = attempts.filter((attempt) => topicMatchesAttempt(topic, attempt));
  const answered = matched.filter((attempt) => attempt.correct !== null && attempt.correct !== void 0);
  const correctCount = answered.filter((attempt) => attempt.correct === true).length;
  const accuracy = answered.length ? round(correctCount / answered.length * 100, 1) : null;
  const taskEntries = Object.entries(taskPatches ?? {}).filter(([, patch]) => patch.topicId === topic.id);
  const learningTasks = taskEntries.filter(([, patch]) => patch.type === "LEARN" || patch.type === "PRACTICE" || patch.type === "TEST");
  const completedTasks = learningTasks.filter(([, patch]) => patch.state === "completed").length;
  const completion = learningTasks.length ? clamp(completedTasks / learningTasks.length * 100) : 0;
  const reviewCount = taskEntries.filter(([, patch]) => patch.type === "REVIEW" && patch.state === "completed").length;
  const lastAttemptAt = matched.map((attempt) => attempt.timestamp).filter(Boolean).sort().pop() ?? null;
  const lastStudyAt = taskEntries.map(([, patch]) => patch.completedAt ?? patch.updatedAt ?? null).filter(Boolean).sort().pop() ?? null;
  const confidenceValues = taskEntries.map(([, patch]) => Number(patch.confidence)).filter(Number.isFinite);
  const confidence = confidenceValues.length ? round(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length * 20, 1) : null;
  const recency = lastStudyAt ? clamp(100 - daysBetween(lastStudyAt, now2) * 8) : 0;
  const testScore = accuracy ?? 0;
  const reviewScore = clamp(reviewCount * 25);
  const confidenceScore = confidence ?? 50;
  const mastery = round(
    clamp(completion * 0.25 + testScore * 0.35 + reviewScore * 0.15 + recency * 0.15 + confidenceScore * 0.1)
  );
  return {
    ...defaultTopicPerformance(topic),
    completion: round(completion),
    accuracy,
    attemptCount: matched.length,
    correctCount,
    errorCount: answered.length - correctCount,
    reviewCount,
    confidence,
    lastStudyAt,
    lastReviewAt: reviewCount ? lastStudyAt : null,
    retentionEstimate: mastery ? round(clamp(mastery * 0.92 + recency * 0.08)) : null,
    mastery
  };
}
function buildTopicPerformance({ graph, attempts = [], taskPatches = {}, now: now2 = (/* @__PURE__ */ new Date()).toISOString() }) {
  return graph.topics.map((topic) => buildTopicPerformanceForTopic(topic, attempts, taskPatches, now2));
}
var weightedAverage = (entries, valueOf, weightOf = () => 1) => {
  const usable = entries.filter((entry) => Number.isFinite(valueOf(entry)));
  const totalWeight = usable.reduce((sum, entry) => sum + Math.max(0, weightOf(entry)), 0);
  return totalWeight ? usable.reduce((sum, entry) => sum + valueOf(entry) * weightOf(entry), 0) / totalWeight : null;
};
function buildCourseProgress({ graph, topicPerformance }) {
  const performanceById = new Map(topicPerformance.map((entry) => [entry.topicId, entry]));
  return graph.courses.map((course) => {
    const topics = course.topicIds.map((topicId) => graph.topicById.get(topicId)).filter(Boolean);
    const entries = topics.map((topic) => performanceById.get(topic.id)).filter(Boolean);
    const weightOf = (entry) => graph.topicById.get(entry.topicId)?.weight ?? 1;
    return {
      entityType: "CourseProgress",
      courseId: course.id,
      title: course.title,
      topicCount: topics.length,
      completedTopics: entries.filter((entry) => entry.completion >= 80).length,
      coverage: round(weightedAverage(entries, (entry) => entry.completion, weightOf) ?? 0),
      mastery: round(weightedAverage(entries, (entry) => entry.mastery, weightOf) ?? 0),
      accuracy: weightedAverage(entries, (entry) => entry.accuracy, weightOf),
      testing: round(weightedAverage(entries, (entry) => entry.attemptCount ? clamp(entry.attemptCount * 12) : 0, weightOf) ?? 0),
      reviewCount: entries.reduce((sum, entry) => sum + entry.reviewCount, 0),
      weakTopics: entries.filter((entry) => entry.mastery < 45 || entry.accuracy !== null && entry.accuracy < 50).map((entry) => entry.topicId)
    };
  });
}
var courseIdFromLabel = (label, graph) => {
  const wanted = curriculumNormalize(label);
  return graph.courses.find((course) => {
    const title = curriculumNormalize(course.title);
    return title === wanted || title.includes(wanted) || wanted.includes(title);
  })?.id ?? null;
};
function buildExamReadiness({ exams = [], graph, topicPerformance, now: now2 = (/* @__PURE__ */ new Date()).toISOString(), config = DEFAULT_PLANNING_CONFIG }) {
  const performanceByCourse = new Map(buildCourseProgress({ graph, topicPerformance }).map((entry) => [entry.courseId, entry]));
  const performanceByTopic = new Map(topicPerformance.map((entry) => [entry.topicId, entry]));
  return exams.map((exam) => {
    const examCourseIds = [...new Set((exam.topics ?? []).map((label) => courseIdFromLabel(label, graph)).filter(Boolean))];
    const relevantTopics = topicPerformance.filter((entry) => examCourseIds.includes(entry.courseId));
    const coverage = relevantTopics.length ? round(relevantTopics.filter((entry) => entry.completion >= 60).length / relevantTopics.length * 100) : round(weightedAverage(examCourseIds.map((id) => performanceByCourse.get(id)).filter(Boolean), (entry) => entry.coverage) ?? 0);
    const accuracy = weightedAverage(relevantTopics, (entry) => entry.accuracy);
    const revision = relevantTopics.length ? round(relevantTopics.filter((entry) => entry.reviewCount > 0).length / relevantTopics.length * 100) : 0;
    const volume = relevantTopics.length ? round(relevantTopics.reduce((sum, entry) => sum + entry.attemptCount, 0) / (relevantTopics.length * 4) * 100) : 0;
    const readiness = round(
      coverage * config.readinessWeights.coverage + (accuracy ?? 0) * config.readinessWeights.accuracy + revision * config.readinessWeights.revision + clamp(volume) * config.readinessWeights.volume
    );
    const daysRemaining = Math.ceil(daysBetween(now2, exam.date));
    return {
      entityType: "ExamReadiness",
      examId: exam.id,
      title: exam.title,
      date: exam.date,
      daysRemaining,
      coverage,
      accuracy,
      revision,
      practiceVolume: volume,
      readiness,
      risk: daysRemaining <= 7 && readiness < 65 ? "high" : daysRemaining <= 14 && readiness < 70 ? "medium" : "low",
      riskAreas: relevantTopics.filter((entry) => entry.mastery < 45 || entry.accuracy !== null && entry.accuracy < 50).slice(0, 4).map((entry) => entry.topicId)
    };
  });
}
function buildOverallProgress({ courseProgress, topicPerformance, roadmap = null }) {
  const coverage = weightedAverage(courseProgress, (entry) => entry.coverage, (entry) => entry.topicCount) ?? 0;
  const mastery = weightedAverage(courseProgress, (entry) => entry.mastery, (entry) => entry.topicCount) ?? 0;
  const testedTopics = topicPerformance.filter((entry) => entry.attemptCount > 0).length;
  const reviewCount = topicPerformance.reduce((sum, entry) => sum + entry.reviewCount, 0);
  const taskProgress = roadmap?.tasks?.length ? roadmap.tasks.filter((task) => task.state === "completed").length / roadmap.tasks.length * 100 : 0;
  return {
    entityType: "ProgressSummary",
    coverage: round(coverage),
    mastery: round(mastery),
    testedTopics,
    reviewCount,
    taskCompletion: round(taskProgress),
    overall: round(coverage * 0.35 + mastery * 0.4 + taskProgress * 0.25)
  };
}
function buildRiskSignals({ courseProgress, topicPerformance, examReadiness, backlogMinutes = 0, now: now2 = (/* @__PURE__ */ new Date()).toISOString() }) {
  const risks = [];
  courseProgress.filter((course) => course.coverage < 35 || course.mastery < 40).slice(0, 4).forEach((course) => {
    risks.push({
      id: `course-risk:${course.courseId}`,
      type: "Academic Risk",
      severity: course.coverage < 20 ? "high" : "medium",
      title: course.title,
      reason: `\u067E\u0648\u0634\u0634 ${round(course.coverage)}\u066A \u0648 \u062A\u0633\u0644\u0637 ${round(course.mastery)}\u066A \u0627\u0633\u062A.`,
      action: "\u06CC\u06A9 \u0645\u0628\u062D\u062B \u0628\u0627 \u0627\u0648\u0644\u0648\u06CC\u062A \u0628\u0627\u0644\u0627 \u0631\u0627 \u0627\u0632 \u0628\u0631\u0646\u0627\u0645\u0647 \u0627\u0645\u0631\u0648\u0632 \u0634\u0631\u0648\u0639 \u06A9\u0646."
    });
  });
  examReadiness.filter((exam) => exam.risk !== "low").slice(0, 3).forEach((exam) => {
    risks.push({
      id: `exam-risk:${exam.examId}`,
      type: "Exam Risk",
      severity: exam.risk,
      title: exam.title,
      reason: `${exam.daysRemaining} \u0631\u0648\u0632 \u062A\u0627 \u0622\u0632\u0645\u0648\u0646 \u0648 \u0622\u0645\u0627\u062F\u06AF\u06CC ${exam.readiness}\u066A \u0628\u0627\u0642\u06CC \u0645\u0627\u0646\u062F\u0647 \u0627\u0633\u062A.`,
      action: "\u0645\u0628\u0627\u062D\u062B \u0636\u0639\u06CC\u0641 \u0622\u0632\u0645\u0648\u0646 \u0631\u0627 \u062F\u0631 \u0628\u0631\u0646\u0627\u0645\u0647 \u0627\u06CC\u0646 \u0647\u0641\u062A\u0647 \u062C\u0644\u0648 \u0628\u06CC\u0627\u0648\u0631."
    });
  });
  if (backlogMinutes > 0) {
    risks.push({
      id: "backlog-risk",
      type: "Backlog Risk",
      severity: backlogMinutes > 240 ? "high" : "medium",
      title: "\u0639\u0642\u0628\u200C\u0627\u0641\u062A\u0627\u062F\u06AF\u06CC \u0628\u0631\u0646\u0627\u0645\u0647",
      reason: `${backlogMinutes} \u062F\u0642\u06CC\u0642\u0647 \u0641\u0639\u0627\u0644\u06CC\u062A \u0627\u0646\u062C\u0627\u0645\u200C\u0646\u0634\u062F\u0647 \u0628\u0627\u0642\u06CC \u0645\u0627\u0646\u062F\u0647 \u0627\u0633\u062A.`,
      action: "\u0627\u0632 Recovery Plan \u0645\u062A\u0639\u0627\u062F\u0644 \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u06A9\u0646\u061B \u0647\u0645\u0647 \u0631\u0627 \u0628\u0647 \u0641\u0631\u062F\u0627 \u0645\u0646\u062A\u0642\u0644 \u0646\u06A9\u0646."
    });
  }
  topicPerformance.filter((entry) => entry.accuracy !== null && entry.accuracy < 50).slice(0, 4).forEach((entry) => {
    risks.push({
      id: `weak-topic:${entry.topicId}`,
      type: "Weak Topic Risk",
      severity: entry.accuracy < 35 ? "high" : "medium",
      title: entry.topicId,
      reason: `\u062F\u0642\u062A \u0627\u062E\u06CC\u0631 ${entry.accuracy}\u066A \u062F\u0631 ${entry.attemptCount} \u062A\u0644\u0627\u0634 \u062B\u0628\u062A \u0634\u062F\u0647 \u0627\u0633\u062A.`,
      action: "\u0645\u0631\u0648\u0631 \u062F\u0631\u0633\u0646\u0627\u0645\u0647\u060C \u0648\u06CC\u06A9\u06CC \u0648 \u062A\u0633\u062A \u0622\u0645\u0648\u0632\u0634\u06CC \u0631\u0627 \u0642\u0628\u0644 \u0627\u0632 \u062A\u0633\u062A \u0632\u0645\u0627\u0646\u200C\u062F\u0627\u0631 \u0627\u0646\u062C\u0627\u0645 \u0628\u062F\u0647."
    });
  });
  return risks.slice(0, 8);
}
var progressClamp = clamp;
var progressRound = round;

// src/services/greenPath/priorityEngine.js
var daysUntil = (date, now2) => Math.ceil((new Date(date).getTime() - new Date(now2).getTime()) / 864e5);
var courseHasExam = (courseId, exams, graph) => exams.some((exam) => (exam.courseIds ?? []).includes(courseId) || (exam.topicIds ?? []).some((topicId) => graph.topicById.get(topicId)?.courseId === courseId));
var nearestDeadline = (topic, deadlines = []) => deadlines.filter((deadline) => !deadline.completed && (!deadline.topicIds?.length || deadline.topicIds.includes(topic.id))).sort((a, b) => new Date(a.date) - new Date(b.date))[0] ?? null;
var examWeightFor = (topic, exams = [], graph, now2) => {
  const matching = exams.filter((exam) => {
    if (exam.topicIds?.includes(topic.id)) return true;
    if (exam.courseIds?.includes(topic.courseId)) return true;
    return (exam.topics ?? []).some((label) => String(label).includes(graph.courseById.get(topic.courseId)?.title ?? "___"));
  });
  if (!matching.length) return 0.25;
  const highest = Math.max(...matching.map((exam) => {
    const days = Math.max(1, daysUntil(exam.date, now2));
    return progressClamp((exam.importance ?? 0.7) * 100 + Math.max(0, 30 - days) * 1.5, 0, 100);
  }));
  return highest / 100;
};
function calculateTopicPriority({
  topic,
  performance,
  graph,
  goals = [],
  exams = [],
  deadlines = [],
  now: now2 = (/* @__PURE__ */ new Date()).toISOString(),
  config = DEFAULT_PLANNING_CONFIG
}) {
  const weights = config.priorityWeights;
  const mastery = performance?.mastery ?? 0;
  const weakness = progressClamp(100 - mastery) / 100;
  const accuracyWeakness = performance?.accuracy === null || performance?.accuracy === void 0 ? 0.65 : progressClamp(100 - performance.accuracy) / 100;
  const weaknessScore = weakness * 0.65 + accuracyWeakness * 0.35;
  const deadline = nearestDeadline(topic, deadlines);
  const relevantExam = exams.find((exam) => exam.topicIds?.includes(topic.id) || exam.courseIds?.includes(topic.courseId));
  const urgentDate = deadline?.date ?? relevantExam?.date ?? null;
  const days = urgentDate ? Math.max(0, daysUntil(urgentDate, now2)) : null;
  const urgency = days === null ? 0.28 : progressClamp(100 - days * 4.5) / 100;
  const examWeight = examWeightFor(topic, exams, graph, now2);
  const goalRelevance = goals.reduce((sum, goal) => {
    const profile = GOAL_PROFILES[goal.kind] ?? GOAL_PROFILES.balanced;
    const basicScience = goal.kind.includes("basic") ? profile.relevance.basicSciences : profile.relevance.basicSciences * 0.7;
    const courseSignal = courseHasExam(topic.courseId, exams, graph) ? profile.relevance.exam : profile.relevance.semester;
    return sum + (goal.weight ?? 0) * ((basicScience + courseSignal) / 2);
  }, 0);
  const dependents = graph.topics.filter((candidate) => candidate.prerequisiteTopicIds.includes(topic.id));
  const unresolvedDependents = dependents.filter((candidate) => (candidate.mastery ?? 0) < 60).length;
  const dependency = progressClamp(unresolvedDependents * 22 + topic.importance * 5) / 100;
  const historicalError = performance?.attemptCount ? progressClamp(performance.errorCount / performance.attemptCount * 100) / 100 : 0.5;
  const importance = progressClamp(topic.importance * 20) / 100;
  const score = progressRound(
    100 * (importance * weights.importance + urgency * weights.urgency + weaknessScore * weights.weakness + examWeight * weights.examWeight + Math.min(1, goalRelevance) * weights.goalRelevance + dependency * weights.dependency + historicalError * weights.historicalError),
    1
  );
  const reasons = [];
  if (weaknessScore >= 0.55) reasons.push(`\u062A\u0633\u0644\u0637 \u0641\u0639\u0644\u06CC ${progressRound(mastery)}\u066A \u0627\u0633\u062A`);
  if (accuracyWeakness >= 0.5 && performance?.accuracy !== null && performance?.accuracy !== void 0) reasons.push(`\u062F\u0642\u062A \u062A\u0633\u062A ${progressRound(performance.accuracy)}\u066A \u062B\u0628\u062A \u0634\u062F\u0647`);
  if (days !== null && days <= 14) reasons.push(`${days} \u0631\u0648\u0632 \u062A\u0627 \u0646\u0632\u062F\u06CC\u06A9\u200C\u062A\u0631\u06CC\u0646 \u062F\u062F\u0644\u0627\u06CC\u0646/\u0622\u0632\u0645\u0648\u0646 \u0645\u0627\u0646\u062F\u0647`);
  if (topic.importance >= 4) reasons.push("\u0627\u0647\u0645\u06CC\u062A \u0645\u062D\u062A\u0648\u0627\u06CC\u06CC \u0648 \u0622\u0632\u0645\u0648\u0646\u06CC \u0628\u0627\u0644\u0627\u0633\u062A");
  if (unresolvedDependents > 0) reasons.push(`${unresolvedDependents} \u0645\u0628\u062D\u062B \u0628\u0639\u062F\u06CC \u0628\u0647 \u0627\u06CC\u0646 \u067E\u06CC\u0634\u200C\u0646\u06CC\u0627\u0632 \u0648\u0627\u0628\u0633\u062A\u0647 \u0627\u0633\u062A`);
  if (!reasons.length) reasons.push("\u0628\u0631\u0627\u06CC \u062D\u0641\u0638 \u0631\u06CC\u062A\u0645 \u0647\u0641\u062A\u06AF\u06CC \u062F\u0631 \u0635\u0641 \u0628\u0631\u0646\u0627\u0645\u0647 \u0642\u0631\u0627\u0631 \u06AF\u0631\u0641\u062A\u0647 \u0627\u0633\u062A");
  return {
    topicId: topic.id,
    score,
    factors: {
      importance: progressRound(importance * 100),
      urgency: progressRound(urgency * 100),
      weakness: progressRound(weaknessScore * 100),
      examWeight: progressRound(examWeight * 100),
      goalRelevance: progressRound(Math.min(1, goalRelevance) * 100),
      dependency: progressRound(dependency * 100),
      historicalError: progressRound(historicalError * 100)
    },
    reasons,
    nearestDeadline: urgentDate
  };
}
function buildPriorityQueue({ graph, topicPerformance, goals, exams, deadlines, now: now2, config }) {
  const performanceById = new Map(topicPerformance.map((entry) => [entry.topicId, entry]));
  return graph.topics.map((topic) => ({
    topic,
    priority: calculateTopicPriority({
      topic,
      performance: performanceById.get(topic.id),
      graph,
      goals,
      exams,
      deadlines,
      now: now2,
      config
    })
  })).sort((a, b) => b.priority.score - a.priority.score || a.topic.order - b.topic.order);
}

// src/services/greenPath/schedulingEngine.js
var DAY_MS2 = 864e5;
var dateKeyOf = (value) => new Date(value).toISOString().slice(0, 10);
var dateFromKey = (key) => /* @__PURE__ */ new Date(`${key}T00:00:00.000Z`);
var addDays = (value, amount) => new Date(new Date(value).getTime() + amount * DAY_MS2);
function buildCapacityMap({ profile, startDate, horizonDays = DEFAULT_PLANNING_CONFIG.horizonDays, config = DEFAULT_PLANNING_CONFIG }) {
  const capacityByWeekday = profile?.capacityByWeekday ?? { 0: 180, 1: 180, 2: 240, 3: 180, 4: 240, 5: 120, 6: 90 };
  const map = /* @__PURE__ */ new Map();
  for (let index = 0; index < horizonDays; index += 1) {
    const date = addDays(startDate, index);
    const weekday = date.getUTCDay();
    const raw = Number(capacityByWeekday[weekday] ?? profile?.defaultDailyMinutes ?? 180);
    const effective = Math.max(0, Math.floor(raw * (1 - config.bufferRatio)));
    map.set(dateKeyOf(date), {
      date: dateKeyOf(date),
      weekday,
      rawMinutes: raw,
      plannedMinutes: 0,
      effectiveMinutes: effective,
      bufferMinutes: raw - effective,
      taskIds: []
    });
  }
  return map;
}
var taskSort = (a, b) => b.priorityScore - a.priorityScore || new Date(a.dueDate ?? "2999-01-01") - new Date(b.dueDate ?? "2999-01-01");
function earliestAvailableDate({ candidate, capacityMap, topicDates, nowKey }) {
  const dependencyDates = (candidate.dependsOnTopicIds ?? []).map((id) => topicDates.get(id)).filter(Boolean);
  const dependencyDate = dependencyDates.length ? dependencyDates.sort().pop() : nowKey;
  const start = dateFromKey(dependencyDate) > dateFromKey(nowKey) ? addDays(dependencyDate, 1) : dateFromKey(nowKey);
  for (let index = 0; index < capacityMap.size; index += 1) {
    const key = dateKeyOf(addDays(start, index));
    const capacity = capacityMap.get(key);
    if (!capacity) continue;
    if (candidate.dueDate && key > dateKeyOf(candidate.dueDate)) break;
    if (capacity.plannedMinutes + candidate.durationMinutes <= capacity.effectiveMinutes) return key;
  }
  return null;
}
function makeTask(candidate, date, capacity, patch = {}) {
  const plannedStart = 9 * 60 + capacity.plannedMinutes;
  return {
    id: candidate.id,
    entityType: "Task",
    type: candidate.type,
    sourceId: candidate.sourceId ?? null,
    sourceLabel: candidate.sourceLabel ?? candidate.type,
    sourceAccent: candidate.sourceAccent ?? "var(--green-ink)",
    state: patch.state ?? TASK_STATES.PLANNED,
    title: candidate.title,
    courseId: candidate.courseId,
    topicId: candidate.topicId,
    topicTitle: candidate.topicTitle,
    phaseId: candidate.phaseId,
    plannedDate: patch.plannedDate ?? date,
    plannedStartMinute: patch.plannedStartMinute ?? plannedStart,
    durationMinutes: candidate.durationMinutes,
    priorityScore: candidate.priorityScore,
    priorityFactors: candidate.priorityFactors,
    deadline: candidate.dueDate ?? null,
    dependsOn: candidate.dependsOnTopicIds ?? [],
    resourceIds: candidate.resourceIds ?? [],
    reason: candidate.reason,
    metadata: candidate.metadata ?? {},
    actualMinutes: patch.actualMinutes ?? null,
    confidence: patch.confidence ?? null,
    difficulty: patch.difficulty ?? null,
    completedAt: patch.completedAt ?? null,
    createdAt: candidate.createdAt,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    rescheduledFrom: patch.rescheduledFrom ?? null
  };
}
function scheduleCandidates({
  candidates = [],
  profile,
  startDate = /* @__PURE__ */ new Date(),
  horizonDays = DEFAULT_PLANNING_CONFIG.horizonDays,
  taskPatches = {},
  config = DEFAULT_PLANNING_CONFIG
}) {
  const capacityMap = buildCapacityMap({ profile, startDate, horizonDays, config });
  const nowKey = dateKeyOf(startDate);
  const topicDates = /* @__PURE__ */ new Map();
  const tasks = [];
  const unscheduled = [];
  [...candidates].sort(taskSort).forEach((candidate) => {
    const patch = taskPatches[candidate.id] ?? {};
    const requestedDate = patch.plannedDate ? dateKeyOf(patch.plannedDate) : null;
    let date = requestedDate && capacityMap.has(requestedDate) ? requestedDate : earliestAvailableDate({ candidate, capacityMap, topicDates, nowKey });
    if (!date) {
      unscheduled.push({ ...candidate, reason: [...candidate.reason ?? [], "\u0638\u0631\u0641\u06CC\u062A \u0627\u06CC\u0646 \u0628\u0627\u0632\u0647 \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u0641\u0639\u0627\u0644\u06CC\u062A \u06A9\u0627\u0641\u06CC \u0646\u0628\u0648\u062F"] });
      return;
    }
    const capacity = capacityMap.get(date);
    if (capacity.plannedMinutes + candidate.durationMinutes > capacity.effectiveMinutes) {
      const fallback = earliestAvailableDate({ candidate, capacityMap, topicDates, nowKey });
      if (fallback) date = fallback;
      else {
        unscheduled.push({ ...candidate, reason: [...candidate.reason ?? [], "\u062A\u0639\u0627\u0631\u0636 \u0638\u0631\u0641\u06CC\u062A"] });
        return;
      }
    }
    const finalCapacity = capacityMap.get(date);
    const patchWithState = requestedDate && requestedDate !== candidate.defaultDate ? { ...patch, state: patch.state ?? TASK_STATES.RESCHEDULED, rescheduledFrom: candidate.defaultDate } : patch;
    const task = makeTask(candidate, date, finalCapacity, patchWithState);
    finalCapacity.plannedMinutes += task.durationMinutes;
    finalCapacity.taskIds.push(task.id);
    tasks.push(task);
    if (!topicDates.has(candidate.topicId) || date < topicDates.get(candidate.topicId)) topicDates.set(candidate.topicId, date);
  });
  const byDate = [...capacityMap.values()].map((entry) => ({
    ...entry,
    utilization: entry.effectiveMinutes ? Math.round(entry.plannedMinutes / entry.effectiveMinutes * 100) : 0,
    tasks: tasks.filter((task) => task.plannedDate === entry.date).sort((a, b) => a.plannedStartMinute - b.plannedStartMinute)
  })).filter((entry) => entry.tasks.length || entry.date === nowKey);
  const scheduledMinutes = tasks.reduce((sum, task) => sum + task.durationMinutes, 0);
  const capacityMinutes = [...capacityMap.values()].reduce((sum, entry) => sum + entry.effectiveMinutes, 0);
  return {
    tasks: tasks.sort((a, b) => a.plannedDate.localeCompare(b.plannedDate) || a.plannedStartMinute - b.plannedStartMinute),
    byDate,
    unscheduled,
    capacity: {
      totalMinutes: capacityMinutes,
      scheduledMinutes,
      remainingMinutes: Math.max(0, capacityMinutes - scheduledMinutes),
      utilization: capacityMinutes ? Math.round(scheduledMinutes / capacityMinutes * 100) : 0,
      bufferRatio: config.bufferRatio
    }
  };
}
var dateKey = dateKeyOf;

// src/services/greenPath/roadmapEngine.js
var clamp2 = (value, min, max) => Math.min(max, Math.max(min, value));
var round2 = (value) => Math.round(value * 10) / 10;
var addDays2 = (value, days) => new Date(new Date(value).getTime() + days * 864e5);
var dateKey2 = (value) => new Date(value).toISOString().slice(0, 10);
var nearestDeadline2 = (topic, deadlines = [], exams = []) => {
  const topicDeadlines = deadlines.filter((deadline) => !deadline.completed && (!deadline.topicIds?.length || deadline.topicIds.includes(topic.id)));
  const topicExams = exams.filter((exam) => (exam.topicIds ?? []).includes(topic.id) || (exam.courseIds ?? []).includes(topic.courseId));
  return [...topicDeadlines, ...topicExams].sort((a, b) => new Date(a.date) - new Date(b.date))[0] ?? null;
};
function buildPhases({ profile, goals, now: now2, deadlines, exams }) {
  const selected = goals.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0)).map((goal) => GOAL_PROFILES[goal.kind] ?? GOAL_PROFILES.balanced);
  const order = [...new Set(selected.flatMap((goal) => goal.phaseOrder))];
  const totalWeeks = Math.max(1, profile.totalWeeks ?? 14);
  const currentWeek = clamp2(profile.currentWeek ?? 1, 1, totalWeeks);
  const remainingWeeks = Math.max(1, totalWeeks - currentWeek + 1);
  const allocation = order.map((phaseId, index) => {
    const share = index === order.length - 1 ? 1 / Math.max(1, order.length) : 1 / Math.max(1, order.length) * (index === 0 ? 1.2 : 0.9);
    return { phaseId, weeks: Math.max(1, Math.round(remainingWeeks * share)) };
  });
  const phaseWeeksTotal = allocation.reduce((sum, item) => sum + item.weeks, 0);
  let cursorWeek = currentWeek;
  return allocation.map(({ phaseId, weeks }, index) => {
    const meta = PHASE_META[phaseId] ?? PHASE_META.foundation;
    const startWeek = cursorWeek;
    const endWeek = index === allocation.length - 1 ? totalWeeks : Math.min(totalWeeks, cursorWeek + Math.max(1, Math.round(weeks / phaseWeeksTotal * remainingWeeks)) - 1);
    cursorWeek = endWeek + 1;
    const relatedExam = exams.filter((exam) => new Date(exam.date) >= new Date(now2)).sort((a, b) => new Date(a.date) - new Date(b.date))[0] ?? null;
    return {
      id: `phase:${phaseId}`,
      entityType: "RoadmapPhase",
      phaseId,
      title: meta.title,
      label: meta.label,
      description: meta.description,
      order: index,
      status: currentWeek >= startWeek && currentWeek <= endWeek ? "active" : currentWeek > endWeek ? "completed" : "upcoming",
      startWeek,
      endWeek,
      startDate: dateKey2(addDays2(now2, Math.max(0, (startWeek - currentWeek) * 7))),
      endDate: dateKey2(addDays2(now2, Math.max(0, (endWeek - currentWeek + 1) * 7 - 1))),
      nextExamId: relatedExam?.id ?? null,
      deadlineIds: deadlines.filter((deadline) => new Date(deadline.date) >= new Date(now2)).slice(0, 3).map((deadline) => deadline.id)
    };
  });
}
function taskTemplate({ type, topic, course, priority, phase, resourceIds, dependencyTopicIds, dueDate, sequence, now: now2, taskMix }) {
  const baseDuration = {
    [TASK_TYPES.LEARN]: topic.estimatedMinutes,
    [TASK_TYPES.REVIEW]: 18,
    [TASK_TYPES.PRACTICE]: Math.max(20, Math.min(45, topic.questionCount * 4 || 25)),
    [TASK_TYPES.TEST]: Math.max(18, Math.min(40, topic.questionCount * 3 || 20)),
    [TASK_TYPES.ANALYZE]: 18,
    [TASK_TYPES.READ_REFERENCE]: 24,
    [TASK_TYPES.WIKI_REVIEW]: 12,
    [TASK_TYPES.KNOWLEDGE_LINK]: 15
  }[type] ?? 15;
  const typeLabel = {
    [TASK_TYPES.LEARN]: "\u06CC\u0627\u062F\u06AF\u06CC\u0631\u06CC",
    [TASK_TYPES.REVIEW]: "\u0645\u0631\u0648\u0631",
    [TASK_TYPES.PRACTICE]: "\u062A\u0633\u062A \u0622\u0645\u0648\u0632\u0634\u06CC",
    [TASK_TYPES.TEST]: "\u062A\u0633\u062A \u0632\u0645\u0627\u0646\u200C\u062F\u0627\u0631",
    [TASK_TYPES.ANALYZE]: "\u062A\u062D\u0644\u06CC\u0644 \u062A\u0633\u062A",
    [TASK_TYPES.READ_REFERENCE]: "\u0645\u0637\u0627\u0644\u0639\u0647 \u0631\u0641\u0631\u0646\u0633",
    [TASK_TYPES.WIKI_REVIEW]: "\u0645\u0631\u0648\u0631 \u0648\u06CC\u06A9\u06CC",
    [TASK_TYPES.KNOWLEDGE_LINK]: "\u0627\u062A\u0635\u0627\u0644 \u0634\u0628\u06A9\u0647 \u062F\u0627\u0646\u0634"
  }[type] ?? type;
  const resourceFor = (wantedType) => resourceIds.find((id) => id.includes(`:${wantedType}:`));
  return {
    id: `gp-task:${topic.id}:${type.toLowerCase()}:${sequence}`,
    type,
    sourceId: SECTION_BY_TASK_TYPE[type] ?? "course-micro",
    sourceLabel: GREEN_PATH_SECTIONS[SECTION_BY_TASK_TYPE[type] ?? "course-micro"]?.label ?? typeLabel,
    sourceAccent: GREEN_PATH_SECTIONS[SECTION_BY_TASK_TYPE[type] ?? "course-micro"]?.accent ?? "var(--green-ink)",
    title: `${typeLabel} ${course.title} \u2014 ${topic.title}`,
    courseId: course.id,
    topicId: topic.id,
    topicTitle: topic.title,
    phaseId: phase.phaseId,
    durationMinutes: Math.max(12, Math.round(baseDuration)),
    priorityScore: round2(priority.score * (0.75 + (taskMix[type] ?? 0.1))),
    priorityFactors: priority.factors,
    dueDate,
    dependsOnTopicIds: dependencyTopicIds,
    resourceIds: type === TASK_TYPES.READ_REFERENCE ? [resourceFor("reference")].filter(Boolean) : type === TASK_TYPES.WIKI_REVIEW ? [resourceFor("wiki")].filter(Boolean) : type === TASK_TYPES.KNOWLEDGE_LINK ? [resourceFor("knowledge_network")].filter(Boolean) : type === TASK_TYPES.PRACTICE || type === TASK_TYPES.TEST ? [resourceFor("question_bank")].filter(Boolean) : [resourceFor("micro_lesson"), resourceFor("comprehensive_lesson")].filter(Boolean),
    reason: [
      ...priority.reasons,
      type === TASK_TYPES.READ_REFERENCE ? "\u0627\u0647\u0645\u06CC\u062A \u06CC\u0627 \u062F\u0634\u0648\u0627\u0631\u06CC \u0627\u06CC\u0646 \u0645\u0628\u062D\u062B \u0645\u0637\u0627\u0644\u0639\u0647 \u0639\u0645\u06CC\u0642 \u0631\u0627 \u062A\u0648\u062C\u06CC\u0647 \u0645\u06CC\u200C\u06A9\u0646\u062F." : null,
      type === TASK_TYPES.KNOWLEDGE_LINK ? "\u0627\u06CC\u0646 \u0627\u062A\u0635\u0627\u0644 \u0641\u0642\u0637 \u0628\u0647\u200C\u062F\u0644\u06CC\u0644 \u0627\u0631\u0632\u0634 \u0648\u0627\u0642\u0639\u06CC \u0628\u06CC\u0646\u200C\u062F\u0631\u0633\u06CC \u067E\u06CC\u0634\u0646\u0647\u0627\u062F \u0634\u062F\u0647 \u0627\u0633\u062A." : null
    ].filter(Boolean),
    metadata: {
      action: type,
      timeBudget: baseDuration,
      explainability: priority
    },
    defaultDate: dateKey2(now2),
    createdAt: now2
  };
}
function candidateTypesFor({ performance, topic, phaseId, knowledgeNodeId, profile }) {
  const mastery = performance?.mastery ?? 0;
  const accuracy = performance?.accuracy;
  const types = [];
  if (mastery < 45) types.push(TASK_TYPES.LEARN, TASK_TYPES.PRACTICE);
  else if (mastery < 72) types.push(TASK_TYPES.REVIEW, TASK_TYPES.PRACTICE);
  else types.push(TASK_TYPES.REVIEW);
  if (phaseId === "foundation" || phaseId === "recovery") types.unshift(TASK_TYPES.LEARN);
  if (phaseId === "testing" || phaseId === "final-review") types.push(TASK_TYPES.TEST, TASK_TYPES.ANALYZE);
  if (accuracy !== null && accuracy !== void 0 && accuracy < 50) types.push(TASK_TYPES.WIKI_REVIEW, TASK_TYPES.READ_REFERENCE, TASK_TYPES.TEST);
  if (knowledgeNodeId && phaseId === "integration") types.push(TASK_TYPES.KNOWLEDGE_LINK);
  const limit = profile?.currentWeek >= 9 ? 4 : 3;
  return [...new Set(types)].slice(0, limit);
}
function buildCandidates({ graph, priorityQueue, topicPerformance, resources, phases, goals, profile, deadlines, exams, now: now2, config }) {
  const performanceById = new Map(topicPerformance.map((entry) => [entry.topicId, entry]));
  const resourceByTopic = /* @__PURE__ */ new Map();
  resources.forEach((resource) => {
    const list = resourceByTopic.get(resource.topicId) ?? [];
    list.push(resource);
    resourceByTopic.set(resource.topicId, list);
  });
  const activePhase = phases.find((phase) => phase.status === "active") ?? phases[0];
  const mainGoal = GOAL_PROFILES[goals[0]?.kind] ?? GOAL_PROFILES.balanced;
  const candidates = [];
  priorityQueue.slice(0, 18).forEach(({ topic, priority }, topicIndex) => {
    const course = graph.courseById.get(topic.courseId);
    if (!course) return;
    const phase = phases.find((candidate) => candidate.phaseId === (topicIndex < 6 ? activePhase.phaseId : phases[Math.min(phases.length - 1, Math.floor(topicIndex / 6))]?.phaseId)) ?? activePhase;
    const deadline = nearestDeadline2(topic, deadlines, exams);
    const topicResources = resourceByTopic.get(topic.id) ?? [];
    const types = candidateTypesFor({
      performance: performanceById.get(topic.id),
      topic,
      phaseId: phase.phaseId,
      knowledgeNodeId: topic.knowledgeNodeId,
      profile
    });
    types.forEach((type, actionIndex) => {
      const candidate = taskTemplate({
        type,
        topic,
        course,
        priority,
        phase,
        resourceIds: topicResources.map((resource) => resource.id),
        dependencyTopicIds: topic.prerequisiteTopicIds,
        dueDate: deadline?.date ?? dateKey2(addDays2(now2, Math.min(config.horizonDays - 1, 14 + topicIndex))),
        sequence: actionIndex,
        now: now2,
        taskMix: mainGoal.taskMix
      });
      candidates.push(candidate);
    });
  });
  return candidates;
}
function buildRoadmapModel({
  profile,
  goals,
  graph,
  topicPerformance,
  exams = [],
  deadlines = [],
  taskPatches = {},
  resources = [],
  now: now2 = (/* @__PURE__ */ new Date()).toISOString(),
  config = DEFAULT_PLANNING_CONFIG
}) {
  const phases = buildPhases({ profile, goals: [...goals], now: now2, deadlines, exams });
  const priorityQueue = buildPriorityQueue({ graph, topicPerformance, goals, exams, deadlines, now: now2, config });
  const candidates = buildCandidates({ graph, priorityQueue, topicPerformance, resources, phases, goals, profile, deadlines, exams, now: now2, config });
  const schedule = scheduleCandidates({
    candidates,
    profile,
    startDate: new Date(now2),
    horizonDays: config.horizonDays,
    taskPatches,
    config
  });
  const milestones = buildMilestones({ profile, phases, exams, deadlines, now: now2 });
  return {
    entityType: "Roadmap",
    id: `roadmap:${profile.userId}:${dateKey2(now2)}`,
    horizon: { start: dateKey2(now2), days: config.horizonDays, end: dateKey2(addDays2(now2, config.horizonDays - 1)) },
    currentWeek: profile.currentWeek,
    totalWeeks: profile.totalWeeks,
    phases,
    milestones,
    priorityQueue,
    candidates,
    tasks: schedule.tasks,
    byDate: schedule.byDate,
    capacity: schedule.capacity,
    unscheduled: schedule.unscheduled,
    createdAt: now2,
    updatedAt: now2
  };
}
function buildMilestones({ profile, phases, exams, deadlines, now: now2 }) {
  const planEnd = profile.planEnd ?? profile.semesterEnd;
  const list = [
    {
      id: "milestone:semester-start",
      entityType: "Milestone",
      title: "\u0634\u0631\u0648\u0639 \u06CC\u0627 \u0628\u0627\u0632\u062A\u0646\u0638\u06CC\u0645 \u0645\u0633\u06CC\u0631",
      date: profile.semesterStart,
      type: "semester",
      status: new Date(now2) >= new Date(profile.semesterStart) ? "completed" : "upcoming"
    },
    {
      id: "milestone:mid-coverage",
      entityType: "Milestone",
      title: "\u062A\u06A9\u0645\u06CC\u0644 \u06F5\u06F0\u066A \u0645\u0628\u0627\u062D\u062B \u062A\u0631\u0645",
      date: dateKey2(addDays2(now2, Math.max(7, Math.round((new Date(planEnd) - new Date(now2)) / 864e5 / 2)))),
      type: "coverage",
      status: "upcoming"
    },
    {
      id: "milestone:semester-end",
      entityType: "Milestone",
      title: "\u067E\u0627\u06CC\u0627\u0646 \u062A\u0631\u0645",
      date: planEnd,
      type: "semester",
      status: "upcoming"
    }
  ];
  exams.forEach((exam) => list.push({ id: `milestone:exam:${exam.id}`, entityType: "Milestone", title: exam.title, date: exam.date, type: "exam", examId: exam.id, status: "upcoming" }));
  deadlines.forEach((deadline) => list.push({ id: `milestone:deadline:${deadline.id}`, entityType: "Milestone", title: deadline.title, date: deadline.date, type: "deadline", deadlineId: deadline.id, status: deadline.completed ? "completed" : "upcoming" }));
  return list.sort((a, b) => new Date(a.date) - new Date(b.date)).map((item, index) => ({ ...item, order: index, phaseId: phases.find((phase) => new Date(item.date) >= new Date(phase.startDate) && new Date(item.date) <= new Date(phase.endDate))?.phaseId ?? null }));
}

// src/services/greenPath/recoveryEngine.js
function backlogFromTasks(tasks = [], now2 = /* @__PURE__ */ new Date()) {
  return tasks.filter((task) => ["skipped", "expired", "failed"].includes(task.state) || task.plannedDate < dateKey(now2) && task.state !== "completed").reduce((sum, task) => sum + task.durationMinutes, 0);
}
function buildRecoveryPlan({
  tasks = [],
  profile,
  now: now2 = /* @__PURE__ */ new Date(),
  mode = "balanced",
  config = DEFAULT_PLANNING_CONFIG
}) {
  const selected = RECOVERY_MODES[mode] ?? RECOVERY_MODES.balanced;
  const backlog = backlogFromTasks(tasks, now2);
  const dailyCapacity = profile?.defaultDailyMinutes ?? 180;
  const maxExtraPerDay = Math.floor(dailyCapacity * Math.min(config.maxRecoveryRatio, selected.maxExtraRatio));
  const pending = tasks.filter((task) => task.state !== "completed" && task.plannedDate >= dateKey(now2)).sort((a, b) => b.priorityScore - a.priorityScore);
  const recoveryTasks = [];
  let remaining = backlog;
  for (let dayIndex = 0; dayIndex < 14 && remaining > 0; dayIndex += 1) {
    const date = dateKey(addDays(now2, dayIndex + 1));
    const extraMinutes = Math.min(maxExtraPerDay, remaining);
    if (extraMinutes <= 0) continue;
    const anchor = pending[dayIndex % Math.max(1, pending.length)] ?? null;
    recoveryTasks.push({
      id: `recovery:${date}:${dayIndex}`,
      entityType: "RecoveryTask",
      type: anchor?.type === TASK_TYPES.REVIEW && selected.preserveReview ? TASK_TYPES.REVIEW : TASK_TYPES.BUFFER,
      title: anchor ? `\u062C\u0628\u0631\u0627\u0646 ${anchor.topicTitle}` : "\u062C\u0628\u0631\u0627\u0646 \u0641\u0639\u0627\u0644\u06CC\u062A\u200C\u0647\u0627\u06CC \u0639\u0642\u0628\u200C\u0627\u0641\u062A\u0627\u062F\u0647",
      topicId: anchor?.topicId ?? null,
      plannedDate: date,
      durationMinutes: extraMinutes,
      sourceTaskId: anchor?.id ?? null,
      reason: selected.preserveReview ? "\u062C\u0628\u0631\u0627\u0646 \u0628\u0627 \u062D\u0641\u0638 \u0645\u0631\u0648\u0631\u0647\u0627\u06CC \u0646\u0632\u062F\u06CC\u06A9 \u0648 \u0638\u0631\u0641\u06CC\u062A \u06A9\u0646\u062A\u0631\u0644\u200C\u0634\u062F\u0647 \u062A\u0648\u0632\u06CC\u0639 \u0634\u062F\u0647 \u0627\u0633\u062A." : "\u062D\u0627\u0644\u062A \u0633\u0631\u06CC\u0639 \u0628\u062E\u0634\u06CC \u0627\u0632 \u0645\u0631\u0648\u0631 \u06A9\u0645\u200C\u0631\u06CC\u0633\u06A9 \u0631\u0627 \u0628\u0631\u0627\u06CC \u062C\u0645\u0639\u200C\u06A9\u0631\u062F\u0646 \u0639\u0642\u0628\u200C\u0627\u0641\u062A\u0627\u062F\u06AF\u06CC \u0641\u0634\u0631\u062F\u0647 \u0645\u06CC\u200C\u06A9\u0646\u062F."
    });
    remaining -= extraMinutes;
  }
  return {
    entityType: "RecoveryPlan",
    mode,
    modeLabel: selected.label,
    status: backlog === 0 ? "not-needed" : remaining === 0 ? "planned" : "capacity-limited",
    backlogMinutes: backlog,
    plannedRecoveryMinutes: recoveryTasks.reduce((sum, task) => sum + task.durationMinutes, 0),
    remainingMinutes: remaining,
    tasks: recoveryTasks,
    reason: backlog === 0 ? "\u062F\u0631 \u062D\u0627\u0644 \u062D\u0627\u0636\u0631 \u0641\u0639\u0627\u0644\u06CC\u062A \u0639\u0642\u0628\u200C\u0627\u0641\u062A\u0627\u062F\u0647\u200C\u0627\u06CC \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A." : `${backlog} \u062F\u0642\u06CC\u0642\u0647 \u0639\u0642\u0628\u200C\u0627\u0641\u062A\u0627\u062F\u06AF\u06CC \u0628\u0627 \u0633\u0642\u0641 ${maxExtraPerDay} \u062F\u0642\u06CC\u0642\u0647 \u0627\u0636\u0627\u0641\u0647 \u062F\u0631 \u0631\u0648\u0632 \u062A\u0648\u0632\u06CC\u0639 \u0634\u062F.`
  };
}

// src/services/greenPath/adaptiveEngine.js
var round3 = (value) => Math.round(value * 10) / 10;
function assessAdaptation({ tasks = [], studySessions = [], now: now2 = (/* @__PURE__ */ new Date()).toISOString() }) {
  const relevant = tasks.filter((task) => task.plannedDate <= now2.slice(0, 10));
  const completed = relevant.filter((task) => task.state === TASK_STATES.COMPLETED);
  const plannedMinutes = relevant.reduce((sum, task) => sum + task.durationMinutes, 0);
  const actualMinutes = completed.reduce((sum, task) => sum + (task.actualMinutes ?? task.durationMinutes), 0) + studySessions.filter((session) => session.startedAt >= new Date(now2).getTime() - 7 * 864e5).reduce((sum, session) => sum + (session.actualMinutes ?? 0), 0);
  const completionRate = relevant.length ? round3(completed.length / relevant.length * 100) : null;
  const loadRatio = plannedMinutes ? round3(actualMinutes / plannedMinutes * 100) : null;
  const backlogMinutes = backlogFromTasks(tasks, new Date(now2));
  const status = completionRate === null ? "insufficient-data" : completionRate >= 85 ? "ahead" : completionRate >= 65 ? "on-track" : completionRate >= 45 ? "at-risk" : "behind";
  return {
    entityType: "AdaptiveAssessment",
    asOf: now2,
    status,
    completionRate,
    plannedMinutes,
    actualMinutes,
    loadRatio,
    backlogMinutes,
    completedCount: completed.length,
    dueCount: relevant.length,
    shouldRecalculate: status === "at-risk" || status === "behind" || backlogMinutes > 0,
    explanation: status === "ahead" ? "\u0646\u0631\u062E \u062A\u06A9\u0645\u06CC\u0644 \u0627\u0632 \u0628\u0631\u0646\u0627\u0645\u0647 \u062C\u0644\u0648\u062A\u0631 \u0627\u0633\u062A\u061B \u0638\u0631\u0641\u06CC\u062A \u0627\u0636\u0627\u0641\u0647 \u0628\u0631\u0627\u06CC \u0645\u0631\u0648\u0631 \u0639\u0645\u06CC\u0642 \u06CC\u0627 \u0627\u0633\u062A\u0631\u0627\u062D\u062A \u062D\u0641\u0638 \u0645\u06CC\u200C\u0634\u0648\u062F." : status === "on-track" ? "\u0631\u06CC\u062A\u0645 \u0627\u062C\u0631\u0627 \u0628\u0627 \u0628\u0631\u0646\u0627\u0645\u0647 \u0647\u0645\u200C\u062E\u0648\u0627\u0646 \u0627\u0633\u062A\u061B \u0627\u0648\u0644\u0648\u06CC\u062A\u200C\u0647\u0627\u06CC \u0641\u0639\u0644\u06CC \u062D\u0641\u0638 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F." : status === "insufficient-data" ? "\u0628\u0631\u0627\u06CC \u062A\u0635\u0645\u06CC\u0645 \u062A\u0637\u0628\u06CC\u0642\u06CC \u0647\u0646\u0648\u0632 \u062F\u0627\u062F\u0647\u0654 \u06A9\u0627\u0641\u06CC \u0627\u0632 \u0641\u0639\u0627\u0644\u06CC\u062A\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632 \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F." : `\u0628\u0647 \u062F\u0644\u06CC\u0644 \u062A\u06A9\u0645\u06CC\u0644 ${completionRate ?? 0}\u066A \u0627\u0632 \u0641\u0639\u0627\u0644\u06CC\u062A\u200C\u0647\u0627\u06CC \u0633\u0631\u0631\u0633\u06CC\u062F\u0634\u062F\u0647\u060C \u0628\u0631\u0646\u0627\u0645\u0647 \u0628\u0627\u06CC\u062F \u062F\u0648\u0628\u0627\u0631\u0647 \u0645\u062D\u0627\u0633\u0628\u0647 \u0634\u0648\u062F.`
  };
}

// src/services/greenPath/recommendationEngine.js
function buildRecommendations({ graph, topicPerformance = [], courseProgress = [], examReadiness = [], tasks = [], adaptation = null }) {
  const recommendations = [];
  const topicTitle = (topicId) => graph.topicById.get(topicId)?.title ?? topicId;
  topicPerformance.filter((entry) => entry.accuracy !== null && entry.accuracy < 50).sort((a, b) => (a.accuracy ?? 100) - (b.accuracy ?? 100)).slice(0, 3).forEach((entry) => {
    recommendations.push({
      id: `recommendation:weak:${entry.topicId}`,
      type: "error-driven",
      priority: "high",
      title: `\u0686\u0631\u062E\u0647\u0654 \u062C\u0628\u0631\u0627\u0646 \u0628\u0631\u0627\u06CC ${topicTitle(entry.topicId)}`,
      reason: `\u062F\u0631 ${entry.attemptCount} \u062A\u0644\u0627\u0634\u060C \u062F\u0642\u062A ${entry.accuracy}\u066A \u062B\u0628\u062A \u0634\u062F\u0647 \u0627\u0633\u062A.`,
      action: "\u0645\u0631\u0648\u0631 \u062F\u0631\u0633\u0646\u0627\u0645\u0647 \u2192 \u0648\u06CC\u06A9\u06CC \u062A\u067E\u0634 \u2192 \u06F1\u06F0 \u062A\u0633\u062A \u0622\u0645\u0648\u0632\u0634\u06CC \u2192 \u0628\u0627\u0632\u0622\u0632\u0645\u0627\u06CC\u06CC",
      topicId: entry.topicId
    });
  });
  examReadiness.filter((exam) => exam.daysRemaining >= 0 && exam.daysRemaining <= 14 && exam.readiness < 70).slice(0, 2).forEach((exam) => {
    recommendations.push({
      id: `recommendation:exam:${exam.examId}`,
      type: "deadline",
      priority: exam.daysRemaining <= 7 ? "high" : "medium",
      title: `\u0622\u0645\u0627\u062F\u06AF\u06CC \u0628\u0631\u0627\u06CC ${exam.title}`,
      reason: `${exam.daysRemaining} \u0631\u0648\u0632 \u0645\u0627\u0646\u062F\u0647 \u0648 \u067E\u0648\u0634\u0634 \u0641\u0639\u0644\u06CC ${exam.coverage}\u066A \u0627\u0633\u062A.`,
      action: "\u0645\u0628\u0627\u062D\u062B \u067E\u0631\u0631\u06CC\u0633\u06A9 \u0631\u0627 \u062C\u0644\u0648 \u0628\u06CC\u0627\u0648\u0631 \u0648 \u062A\u0633\u062A \u0632\u0645\u0627\u0646\u200C\u062F\u0627\u0631 \u0631\u0627 \u062D\u0630\u0641 \u0646\u06A9\u0646.",
      examId: exam.examId
    });
  });
  const underusedCourse = [...courseProgress].sort((a, b) => a.coverage - b.coverage)[0];
  if (underusedCourse && underusedCourse.coverage < 45) {
    recommendations.push({
      id: `recommendation:course:${underusedCourse.courseId}`,
      type: "coverage",
      priority: "medium",
      title: `\u06CC\u06A9 \u06AF\u0627\u0645 \u06A9\u0648\u0686\u06A9 \u062F\u0631 ${underusedCourse.title}`,
      reason: `\u067E\u0648\u0634\u0634 \u0627\u06CC\u0646 \u062F\u0631\u0633 ${underusedCourse.coverage}\u066A \u0627\u0633\u062A \u0648 \u0638\u0631\u0641\u06CC\u062A \u0622\u0646 \u0647\u0646\u0648\u0632 \u067E\u0627\u06CC\u06CC\u0646\u200C\u062A\u0631 \u0627\u0632 \u0645\u0633\u06CC\u0631 \u062A\u0631\u0645 \u0627\u0633\u062A.`,
      action: "\u0627\u0645\u0631\u0648\u0632 \u06CC\u06A9 Micro Lesson \u06A9\u0648\u062A\u0627\u0647 \u0631\u0627 \u0642\u0628\u0644 \u0627\u0632 \u062A\u0633\u062A \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646.",
      courseId: underusedCourse.courseId
    });
  }
  const todayTasks = tasks.filter((task) => task.plannedDate === (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) && task.state !== "completed");
  const todayMinutes = todayTasks.reduce((sum, task) => sum + task.durationMinutes, 0);
  if (todayMinutes > 300) {
    recommendations.push({
      id: "recommendation:capacity",
      type: "capacity",
      priority: "high",
      title: "\u0628\u0631\u0646\u0627\u0645\u0647 \u0627\u0645\u0631\u0648\u0632 \u0641\u0634\u0631\u062F\u0647 \u0627\u0633\u062A",
      reason: `${todayMinutes} \u062F\u0642\u06CC\u0642\u0647 \u0641\u0639\u0627\u0644\u06CC\u062A \u0628\u0631\u0627\u06CC \u0627\u0645\u0631\u0648\u0632 \u0686\u06CC\u062F\u0647 \u0634\u062F\u0647\u061B \u0628\u062E\u0634\u06CC \u0627\u0632 \u0638\u0631\u0641\u06CC\u062A \u0628\u0627\u06CC\u062F Buffer \u0628\u0645\u0627\u0646\u062F.`,
      action: "\u06CC\u06A9 \u0641\u0639\u0627\u0644\u06CC\u062A \u06A9\u0645\u200C\u0627\u0648\u0644\u0648\u06CC\u062A \u0631\u0627 \u0628\u0647 \u0627\u0648\u0644\u06CC\u0646 \u0638\u0631\u0641\u06CC\u062A \u0622\u0632\u0627\u062F \u0645\u0646\u062A\u0642\u0644 \u06A9\u0646."
    });
  }
  if (adaptation?.status === "behind" || adaptation?.status === "at-risk") {
    recommendations.push({
      id: "recommendation:adaptive",
      type: "adaptive",
      priority: "high",
      title: "\u0628\u0631\u0646\u0627\u0645\u0647 \u0646\u06CC\u0627\u0632 \u0628\u0647 \u0628\u0627\u0632\u062A\u0646\u0638\u06CC\u0645 \u062F\u0627\u0631\u062F",
      reason: adaptation.explanation,
      action: "Recovery \u0645\u062A\u0639\u0627\u062F\u0644 \u0631\u0627 \u0641\u0639\u0627\u0644 \u06A9\u0646 \u0648 \u0645\u0631\u0648\u0631\u0647\u0627\u06CC \u0646\u0632\u062F\u06CC\u06A9 \u0631\u0627 \u0646\u06AF\u0647 \u062F\u0627\u0631."
    });
  }
  const hasTest = tasks.some((task) => task.type === TASK_TYPES.TEST);
  if (!hasTest) {
    recommendations.push({
      id: "recommendation:testing",
      type: "testing",
      priority: "medium",
      title: "\u062A\u0633\u062A \u0631\u0627 \u0648\u0627\u0631\u062F \u0686\u0631\u062E\u0647 \u06A9\u0646",
      reason: "\u062F\u0631 \u0627\u0641\u0642 \u0641\u0639\u0644\u06CC Task \u0632\u0645\u0627\u0646\u200C\u062F\u0627\u0631 \u06A9\u0627\u0641\u06CC \u0628\u0631\u0627\u06CC \u0633\u0646\u062C\u0634 \u0627\u0646\u062A\u0642\u0627\u0644 \u06CC\u0627\u062F\u06AF\u06CC\u0631\u06CC \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F.",
      action: "\u0628\u0639\u062F \u0627\u0632 \u0645\u0637\u0627\u0644\u0639\u0647 \u0627\u0648\u0644\u06CC\u0646 \u0645\u0628\u062D\u062B\u060C \u062A\u0633\u062A \u0622\u0645\u0648\u0632\u0634\u06CC \u0648 \u062A\u062D\u0644\u06CC\u0644 \u0631\u0627 \u0627\u062C\u0631\u0627 \u06A9\u0646."
    });
  }
  return recommendations.slice(0, 6);
}

// src/services/greenPath/periodEngine.js
var DAY_MS3 = 864e5;
var addDays3 = (value, amount) => new Date(new Date(value).getTime() + amount * DAY_MS3);
var addMonths = (value, amount) => {
  const date = new Date(value);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + amount);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date;
};
var dateKey3 = (value) => new Date(value).toISOString().slice(0, 10);
var overlap = (startA, endA, startB, endB) => new Date(startA) <= new Date(endB) && new Date(endA) >= new Date(startB);
var clamp3 = (value, min, max) => Math.min(max, Math.max(min, value));
var round4 = (value) => Math.round(value * 10) / 10;
var monthFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "long", year: "numeric" });
var shortMonthFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "long" });
var primaryTarget = (goals = [], metric) => {
  const targets = goals.flatMap((goal) => goal.targets ?? []).filter((target) => target.metric === metric && Number.isFinite(target.target));
  return targets.length ? Math.max(...targets.map((target) => target.target)) : null;
};
function phaseForRange(phases, start, end) {
  return phases.filter((phase) => overlap(start, end, phase.startDate, phase.endDate)).map((phase) => phase.phaseId);
}
function phaseLabel(phaseIds) {
  return phaseIds.map((phaseId) => PHASE_META[phaseId]?.label ?? phaseId).join("\u060C ") || "\u062A\u0646\u0638\u06CC\u0645 \u0648 \u067E\u0627\u06CC\u0634";
}
function aggregateForRange({ tasks, milestones, exams, start, end }) {
  const scopedTasks = tasks.filter((task) => task.plannedDate >= dateKey3(start) && task.plannedDate <= dateKey3(end));
  const scopedMilestones = milestones.filter((milestone) => overlap(start, end, milestone.date, milestone.date));
  const scopedExams = exams.filter((exam) => overlap(start, end, exam.date, exam.date));
  const minutes = scopedTasks.reduce((sum, task) => sum + task.durationMinutes, 0);
  const sourceCounts = scopedTasks.reduce((map, task) => {
    map[task.sourceId ?? task.type] = (map[task.sourceId ?? task.type] ?? 0) + 1;
    return map;
  }, {});
  return { tasks: scopedTasks, milestones: scopedMilestones, exams: scopedExams, plannedMinutes: minutes, taskCount: scopedTasks.length, sourceCounts };
}
function buildWeeks({ profile, phases, tasks, milestones, exams, goals, now: now2 }) {
  const start = new Date(profile.planStart ?? now2);
  const end = new Date(profile.planEnd ?? addDays3(start, 364));
  const totalWeeks = Math.max(1, Math.ceil((end - start) / (7 * DAY_MS3)));
  const coverageTarget = primaryTarget(goals, "coverage");
  return Array.from({ length: totalWeeks }, (_, index) => {
    const weekStart = addDays3(start, index * 7);
    const weekEnd = new Date(Math.min(end.getTime(), addDays3(weekStart, 6).getTime()));
    const phaseIds = phaseForRange(phases, weekStart, weekEnd);
    const aggregate = aggregateForRange({ tasks, milestones, exams, start: weekStart, end: weekEnd });
    const current = overlap(now2, now2, weekStart, weekEnd);
    const completed = weekEnd < new Date(now2);
    const targetProgress = coverageTarget === null ? null : round4(clamp3((index + 1) / totalWeeks * coverageTarget, 0, coverageTarget));
    return {
      entityType: "WeekPlan",
      id: `week:${dateKey3(weekStart)}`,
      index: index + 1,
      startDate: dateKey3(weekStart),
      endDate: dateKey3(weekEnd),
      phaseIds,
      phaseLabel: phaseLabel(phaseIds),
      taskCount: aggregate.taskCount,
      plannedMinutes: aggregate.plannedMinutes,
      sourceCounts: aggregate.sourceCounts,
      milestoneIds: aggregate.milestones.map((milestone) => milestone.id),
      examIds: aggregate.exams.map((exam) => exam.id),
      targetCoverage: targetProgress,
      status: current ? "current" : completed ? "completed" : "upcoming"
    };
  });
}
function buildMonths({ profile, phases, tasks, milestones, exams, goals, now: now2 }) {
  const start = new Date(profile.planStart ?? now2);
  const end = new Date(profile.planEnd ?? addDays3(start, 364));
  const totalMonths = Math.max(1, Math.min(12, Math.ceil((end - start) / (31 * DAY_MS3))));
  const coverageTarget = primaryTarget(goals, "coverage");
  return Array.from({ length: totalMonths }, (_, index) => {
    const monthStart2 = addMonths(start, index);
    const monthEnd = new Date(Math.min(end.getTime(), addDays3(addMonths(start, index + 1), -1).getTime()));
    const phaseIds = phaseForRange(phases, monthStart2, monthEnd);
    const aggregate = aggregateForRange({ tasks, milestones, exams, start: monthStart2, end: monthEnd });
    const current = overlap(now2, now2, monthStart2, monthEnd);
    const completed = monthEnd < new Date(now2);
    const targetProgress = coverageTarget === null ? null : round4(clamp3((index + 1) / Math.min(12, totalMonths) * coverageTarget, 0, coverageTarget));
    const weeks = buildWeeks({ profile: { planStart: monthStart2, planEnd: monthEnd }, phases, tasks, milestones, exams, goals, now: now2 });
    return {
      entityType: "MonthPlan",
      id: `month:${dateKey3(monthStart2)}`,
      index: index + 1,
      startDate: dateKey3(monthStart2),
      endDate: dateKey3(monthEnd),
      label: monthFormatter.format(monthStart2),
      shortLabel: shortMonthFormatter.format(monthStart2),
      phaseIds,
      phaseLabel: phaseLabel(phaseIds),
      focus: PHASE_META[phaseIds[0]]?.description ?? "\u067E\u06CC\u0634\u0631\u0648\u06CC \u0628\u0631 \u0627\u0633\u0627\u0633 \u0627\u0648\u0644\u0648\u06CC\u062A\u200C\u0647\u0627\u06CC \u0648\u0627\u0642\u0639\u06CC \u0645\u0633\u06CC\u0631.",
      taskCount: aggregate.taskCount,
      plannedMinutes: aggregate.plannedMinutes,
      sourceCounts: aggregate.sourceCounts,
      milestoneIds: aggregate.milestones.map((milestone) => milestone.id),
      examIds: aggregate.exams.map((exam) => exam.id),
      targetCoverage: targetProgress,
      status: current ? "current" : completed ? "completed" : "upcoming",
      weeks
    };
  });
}
function buildYearPlan({ profile, goals = [], phases = [], tasks = [], milestones = [], exams = [], now: now2 = (/* @__PURE__ */ new Date()).toISOString() }) {
  const start = new Date(profile.planStart ?? now2);
  const end = new Date(profile.planEnd ?? addDays3(start, 364));
  const months = buildMonths({ profile, phases, tasks, milestones, exams, goals, now: now2 });
  const weeks = buildWeeks({ profile, phases, tasks, milestones, exams, goals, now: now2 });
  const annualAggregate = aggregateForRange({ tasks, milestones, exams, start, end });
  return {
    entityType: "YearPlan",
    id: `year:${dateKey3(start)}`,
    startDate: dateKey3(start),
    endDate: dateKey3(end),
    label: `${monthFormatter.format(start)} \u062A\u0627 ${monthFormatter.format(end)}`,
    horizonDays: Math.ceil((end - start) / DAY_MS3) + 1,
    goalIds: goals.map((goal) => goal.id),
    phaseIds: phases.map((phase) => phase.phaseId),
    monthCount: months.length,
    weekCount: weeks.length,
    taskCount: annualAggregate.taskCount,
    plannedMinutes: annualAggregate.plannedMinutes,
    milestoneIds: annualAggregate.milestones.map((milestone) => milestone.id),
    examIds: annualAggregate.exams.map((exam) => exam.id),
    months,
    weeks
  };
}
var periodDateKey = dateKey3;

// src/services/greenPath/calendarEngine.js
var DAY_MS4 = 864e5;
var addDays4 = (value, amount) => new Date(new Date(value).getTime() + amount * DAY_MS4);
var dateKey4 = periodDateKey;
var monthStart = (value) => {
  const date = new Date(value);
  date.setUTCDate(1);
  return date;
};
var sourceMeta = (sourceId) => GREEN_PATH_SECTIONS[sourceId] ?? GREEN_PATH_SECTIONS.milestone;
var event = ({ id, date, title, sourceId, kind, durationMinutes = 0, startMinute = null, state = null, entityId = null, metadata = {} }) => {
  const section = sourceMeta(sourceId);
  return {
    id,
    entityType: "CalendarEvent",
    date: dateKey4(date),
    title,
    sourceId: section.id,
    sourceLabel: section.label,
    sourceShortLabel: section.shortLabel,
    sourceGroup: section.group,
    accent: section.accent,
    kind,
    durationMinutes,
    startMinute,
    state,
    entityId,
    metadata
  };
};
function buildCalendarEvents({ roadmap, deadlines = [], exams = [], milestones = [], studySessions = [], recovery = null }) {
  const events = [];
  (roadmap?.tasks ?? []).forEach((task) => events.push(event({
    id: `calendar:task:${task.id}`,
    date: task.plannedDate,
    title: task.title,
    sourceId: task.sourceId ?? "course-micro",
    kind: "task",
    durationMinutes: task.durationMinutes,
    startMinute: task.plannedStartMinute,
    state: task.state,
    entityId: task.id,
    metadata: { topicId: task.topicId, phaseId: task.phaseId, reason: task.reason }
  })));
  deadlines.forEach((deadline) => events.push(event({
    id: `calendar:deadline:${deadline.id}`,
    date: deadline.date,
    title: deadline.title,
    sourceId: "deadline",
    kind: "deadline",
    state: deadline.completed ? "completed" : "planned",
    entityId: deadline.id,
    metadata: { importance: deadline.importance, examId: deadline.examId }
  })));
  exams.forEach((exam) => events.push(event({
    id: `calendar:exam:${exam.id}`,
    date: exam.date,
    title: exam.title,
    sourceId: exam.type === "national" || exam.type === "mock" ? "coordinated-exam" : "test-bank",
    kind: "exam",
    durationMinutes: exam.durationMinutes ?? 0,
    state: exam.status,
    entityId: exam.id,
    metadata: { topicIds: exam.topicIds, courseIds: exam.courseIds, type: exam.type }
  })));
  milestones.forEach((milestone) => events.push(event({
    id: `calendar:milestone:${milestone.id}`,
    date: milestone.date,
    title: milestone.title,
    sourceId: milestone.type === "exam" ? "coordinated-exam" : "milestone",
    kind: "milestone",
    state: milestone.status,
    entityId: milestone.id,
    metadata: { phaseId: milestone.phaseId }
  })));
  (recovery?.tasks ?? []).forEach((task) => events.push(event({
    id: `calendar:recovery:${task.id}`,
    date: task.plannedDate,
    title: task.title,
    sourceId: task.type === "REVIEW" ? "course-comprehensive" : "analytics",
    kind: "recovery",
    durationMinutes: task.durationMinutes,
    state: "planned",
    entityId: task.id,
    metadata: { reason: task.reason }
  })));
  studySessions.forEach((session) => events.push(event({
    id: `calendar:session:${session.id}`,
    date: session.startedAt,
    title: session.title ?? "\u062C\u0644\u0633\u0647\u0654 \u0645\u0637\u0627\u0644\u0639\u0647 \u062B\u0628\u062A\u200C\u0634\u062F\u0647",
    sourceId: session.sourceId ?? "analytics",
    kind: "session",
    durationMinutes: session.actualMinutes ?? 0,
    state: "completed",
    entityId: session.id,
    metadata: { taskId: session.taskId, topicId: session.topicId }
  })));
  return events.sort((a, b) => a.date.localeCompare(b.date) || (a.startMinute ?? 9999) - (b.startMinute ?? 9999));
}
function buildCalendarMonth({ month, events = [], weekStartsOn = 6 }) {
  const anchor = monthStart(month);
  const firstWeekday = anchor.getUTCDay();
  const leading = (firstWeekday - weekStartsOn + 7) % 7;
  const firstCell = addDays4(anchor, -leading);
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = addDays4(firstCell, index);
    const key = dateKey4(date);
    return {
      date: key,
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === anchor.getUTCMonth(),
      isToday: key === dateKey4(/* @__PURE__ */ new Date()),
      events: events.filter((entry) => entry.date === key)
    };
  });
  return { month: dateKey4(anchor), days };
}
function eventsForDate(events, date) {
  return events.filter((entry) => entry.date === date);
}
function calendarSourceSummary(events = []) {
  return [...events.reduce((map, entry) => {
    const current = map.get(entry.sourceId) ?? { sourceId: entry.sourceId, label: entry.sourceLabel, accent: entry.accent, count: 0 };
    current.count += 1;
    map.set(entry.sourceId, current);
    return map;
  }, /* @__PURE__ */ new Map()).values()].sort((a, b) => b.count - a.count);
}

// src/services/greenPath/greenPathRepository.js
var DAY_MS5 = 864e5;
var PERSIAN_DIGITS = "\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9";
var nowIso = (value = /* @__PURE__ */ new Date()) => new Date(value).toISOString();
var dateKey5 = (value) => new Date(value).toISOString().slice(0, 10);
var addDays5 = (value, days) => new Date(new Date(value).getTime() + days * DAY_MS5);
var addWeeks = (value, weeks) => addDays5(value, weeks * 7);
var asNumber = (value, fallback) => {
  if (value === null || value === void 0 || String(value).trim() === "") return fallback;
  const normalized = String(value).replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)));
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};
var safeUserId = (userRef) => String(typeof userRef === "string" ? userRef : userRef?.id ?? userRef?.phone ?? "guest");
var safeRead = (key, fallback) => {
  if (typeof window === "undefined") return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "null");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};
var safeWrite = (key, value) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
  }
};
var stateKey3 = (userId) => `${GREEN_PATH_STORAGE_KEY}:${userId}`;
var emptyState = () => ({ version: 1, profile: null, goals: null, taskPatches: {}, studySessions: [], deadlines: [], recoveryMode: "balanced", onboardingCompleted: false, updatedAt: null });
function loadState2(userId) {
  const state = safeRead(stateKey3(userId), emptyState());
  return { ...emptyState(), ...state && typeof state === "object" ? state : {} };
}
function saveState(userId, state) {
  const next = { ...state, version: 1, updatedAt: nowIso() };
  safeWrite(stateKey3(userId), next);
  return next;
}
function createProfile(userRef, state, now2) {
  const userProfile = typeof userRef === "object" ? userRef?.profile ?? {} : {};
  const saved = state.profile ?? {};
  const defaultCurrentWeek = 1;
  const totalWeeks = Math.max(1, asNumber(saved.totalWeeks ?? userProfile.totalWeeks, 52));
  const currentWeek = Math.min(totalWeeks, Math.max(1, asNumber(saved.currentWeek ?? userProfile.currentWeek, defaultCurrentWeek)));
  const start = saved.planStart ?? userProfile.planStart ?? saved.semesterStart ?? userProfile.semesterStart ?? now2;
  const end = saved.planEnd ?? userProfile.planEnd ?? saved.semesterEnd ?? userProfile.semesterEnd ?? addWeeks(start, totalWeeks);
  const weekdayCapacity = saved.capacityByWeekday ?? userProfile.capacityByWeekday ?? {
    0: 180,
    1: 240,
    2: 180,
    3: 300,
    4: 240,
    5: 120,
    6: 90
  };
  return {
    entityType: "AcademicProfile",
    id: `academic-profile:${safeUserId(userRef)}`,
    userId: safeUserId(userRef),
    university: saved.university ?? userProfile.university ?? "\u062F\u0627\u0646\u0634\u06AF\u0627\u0647 \u0639\u0644\u0648\u0645 \u067E\u0632\u0634\u06A9\u06CC",
    degree: saved.degree ?? userProfile.degree ?? "\u067E\u0632\u0634\u06A9\u06CC",
    semester: asNumber(saved.semester ?? userProfile.term, 4),
    academicYear: saved.academicYear ?? userProfile.academicYear ?? "\u06F1\u06F4\u06F0\u06F5\u2013\u06F1\u06F4\u06F0\u06F6",
    planStart: nowIso(start),
    planEnd: nowIso(end),
    semesterStart: nowIso(saved.semesterStart ?? userProfile.semesterStart ?? start),
    semesterEnd: nowIso(saved.semesterEnd ?? userProfile.semesterEnd ?? end),
    currentWeek,
    totalWeeks,
    capacityByWeekday: weekdayCapacity,
    defaultDailyMinutes: asNumber(saved.defaultDailyMinutes ?? userProfile.defaultDailyMinutes, 180),
    freeHoursPerWeek: Object.values(weekdayCapacity).reduce((sum, value) => sum + asNumber(value, 0), 0) / 60,
    updatedAt: nowIso()
  };
}
function createGoals(state) {
  if (Array.isArray(state.goals) && state.goals.length) return state.goals;
  return [
    {
      id: "goal:semester-excellence",
      entityType: "Goal",
      kind: "semester-excellence",
      title: GOAL_PROFILES["semester-excellence"].title,
      weight: 0.7,
      priority: 1,
      targets: [
        { id: "target:semester-coverage", entityType: "GoalTarget", metric: "coverage", target: 85, unit: "percent" },
        { id: "target:exam-readiness", entityType: "GoalTarget", metric: "examReadiness", target: 75, unit: "percent" }
      ]
    },
    {
      id: "goal:basic-sciences",
      entityType: "Goal",
      kind: "basic-sciences",
      title: GOAL_PROFILES["basic-sciences"].title,
      weight: 0.3,
      priority: 2,
      targets: [
        { id: "target:basic-coverage", entityType: "GoalTarget", metric: "coverage", target: 70, unit: "percent" },
        { id: "target:basic-accuracy", entityType: "GoalTarget", metric: "accuracy", target: 75, unit: "percent" }
      ]
    }
  ];
}
function mapCourseIds(graph, labels = []) {
  return [...new Set(labels.map((label) => {
    const wanted = String(label).toLowerCase();
    return graph.courses.find((course) => wanted.includes(course.title.toLowerCase()) || course.title.toLowerCase().includes(wanted))?.id ?? null;
  }).filter(Boolean))];
}
function createExams(graph, now2) {
  return EXAMS.map((exam) => {
    const courseIds = mapCourseIds(graph, exam.topics ?? [exam.subject]);
    const topicIds = graph.topics.filter((topic) => courseIds.includes(topic.courseId)).map((topic) => topic.id);
    return {
      entityType: "Exam",
      id: exam.id,
      title: exam.title,
      type: exam.type,
      date: nowIso(exam.startTime),
      topics: exam.topics ?? [],
      courseIds,
      topicIds,
      weight: exam.type === "national" || exam.type === "mock" ? 1 : exam.type === "subject" ? 0.8 : 0.55,
      importance: exam.type === "national" || exam.type === "mock" ? 1 : 0.75,
      status: new Date(exam.startTime) >= new Date(now2) ? "upcoming" : "finished",
      sourceExamId: exam.id,
      createdAt: nowIso(now2),
      updatedAt: nowIso(now2)
    };
  });
}
function createDeadlines(profile, state, exams, now2) {
  const standard = [
    {
      id: "deadline:semester-final",
      entityType: "Deadline",
      title: "\u0627\u0645\u062A\u062D\u0627\u0646 \u067E\u0627\u06CC\u0627\u0646\u200C\u062A\u0631\u0645",
      date: profile.semesterEnd,
      type: "semester-final",
      importance: 1,
      topicIds: [],
      completed: false
    },
    {
      id: "deadline:mid-coverage",
      entityType: "Deadline",
      title: "\u0647\u062F\u0641 \u067E\u0648\u0634\u0634 \u0646\u06CC\u0645\u0647\u0654 \u062A\u0631\u0645",
      date: nowIso(addDays5(now2, Math.max(7, Math.round((new Date(profile.semesterEnd) - new Date(now2)) / 864e5 / 2)))),
      type: "coverage-target",
      importance: 0.7,
      topicIds: [],
      completed: false
    }
  ];
  const custom = (state.deadlines ?? []).map((deadline) => ({
    ...deadline,
    entityType: "Deadline",
    date: nowIso(deadline.date),
    topicIds: deadline.topicIds ?? []
  }));
  const examDeadlines = exams.filter((exam) => new Date(exam.date) >= new Date(now2)).map((exam) => ({
    id: `deadline:exam:${exam.id}`,
    entityType: "Deadline",
    title: exam.title,
    date: exam.date,
    type: "exam",
    examId: exam.id,
    importance: exam.importance,
    topicIds: exam.topicIds,
    completed: false
  }));
  return [...standard, ...custom, ...examDeadlines].sort((a, b) => new Date(a.date) - new Date(b.date));
}
function serializeGraph(graph) {
  return {
    courses: graph.courses,
    topics: graph.topics,
    edges: graph.edges,
    stats: graph.stats
  };
}
function currentPlans(roadmap, now2) {
  const today = dateKey5(now2);
  const todayPlan = roadmap.byDate.find((day) => day.date === today) ?? { date: today, tasks: [], plannedMinutes: 0, effectiveMinutes: 0, utilization: 0 };
  const weekEnd = dateKey5(addDays5(now2, 6));
  const weekTasks = roadmap.tasks.filter((task) => task.plannedDate >= today && task.plannedDate <= weekEnd);
  return {
    dailyPlan: { entityType: "DailyPlan", date: today, tasks: todayPlan.tasks, plannedMinutes: todayPlan.plannedMinutes, capacity: todayPlan.effectiveMinutes, utilization: todayPlan.utilization },
    weeklyPlan: { entityType: "WeeklyPlan", startDate: today, endDate: weekEnd, tasks: weekTasks, plannedMinutes: weekTasks.reduce((sum, task) => sum + task.durationMinutes, 0) }
  };
}
function pathStatus({ adaptation, risks, overall, examReadiness }) {
  if (adaptation.status === "behind") return { code: "behind", label: "Behind Schedule", reason: adaptation.explanation };
  if (adaptation.status === "at-risk" || risks.some((risk) => risk.severity === "high")) return { code: "at-risk", label: "At Risk", reason: risks[0]?.reason ?? adaptation.explanation };
  if (adaptation.status === "ahead" || overall.overall >= 75) return { code: "ahead", label: "Ahead of Schedule", reason: "\u0646\u0631\u062E \u062A\u06A9\u0645\u06CC\u0644 \u0648 \u062A\u0633\u0644\u0637 \u0627\u0632 \u062D\u062F\u0627\u0642\u0644 \u0645\u0633\u06CC\u0631 \u0641\u0639\u0644\u06CC \u062C\u0644\u0648\u062A\u0631 \u0627\u0633\u062A." };
  const nearest = examReadiness.find((exam) => exam.daysRemaining >= 0);
  return { code: "on-track", label: "On Track", reason: nearest ? `\u062A\u0627 ${nearest.title} \u0647\u0646\u0648\u0632 \u0638\u0631\u0641\u06CC\u062A \u0627\u0635\u0644\u0627\u062D \u0648 \u067E\u06CC\u0634\u0631\u0648\u06CC \u0648\u062C\u0648\u062F \u062F\u0627\u0631\u062F.` : "\u0628\u0631\u0646\u0627\u0645\u0647 \u0628\u0627 \u0638\u0631\u0641\u06CC\u062A \u0641\u0639\u0644\u06CC \u0647\u0645\u200C\u062E\u0648\u0627\u0646 \u0627\u0633\u062A." };
}
function createGreenPathMockRepository() {
  return {
    async getSnapshot(userRef, { now: now2 = /* @__PURE__ */ new Date() } = {}) {
      const userId = safeUserId(userRef);
      const state = loadState2(userId);
      const graph = buildCurriculumGraph({ now: nowIso(now2) });
      const profile = createProfile(userRef, state, now2);
      const goals = createGoals(state).sort((a, b) => a.priority - b.priority);
      const exams = createExams(graph, now2);
      const deadlines = createDeadlines(profile, state, exams, now2);
      const resources = graph.topics.flatMap((topic) => buildResourcesForTopic({ topic, course: graph.courseById.get(topic.courseId), knowledgeNodeId: topic.knowledgeNodeId, now: nowIso(now2) }));
      let history = { attempts: [], sessions: [] };
      try {
        history = loadAttemptHistory(userId);
      } catch {
      }
      const topicPerformance = buildTopicPerformance({ graph, attempts: history.attempts, taskPatches: state.taskPatches, now: nowIso(now2) });
      const courseProgress = buildCourseProgress({ graph, topicPerformance });
      const examReadiness = buildExamReadiness({ exams, graph, topicPerformance, now: nowIso(now2) });
      const roadmap = buildRoadmapModel({ profile, goals, graph, topicPerformance, exams, deadlines, taskPatches: state.taskPatches, resources, now: nowIso(now2), config: DEFAULT_PLANNING_CONFIG });
      const adaptation = assessAdaptation({ tasks: roadmap.tasks, studySessions: state.studySessions, now: nowIso(now2) });
      const recovery = buildRecoveryPlan({ tasks: roadmap.tasks, profile, now: now2, mode: state.recoveryMode ?? "balanced", config: DEFAULT_PLANNING_CONFIG });
      const overall = buildOverallProgress({ courseProgress, topicPerformance, roadmap });
      const risks = buildRiskSignals({ courseProgress, topicPerformance, examReadiness, backlogMinutes: adaptation.backlogMinutes, now: nowIso(now2) });
      const recommendations = buildRecommendations({ graph, topicPerformance, courseProgress, examReadiness, tasks: roadmap.tasks, adaptation });
      const status = pathStatus({ adaptation, risks, overall, examReadiness });
      const plans = currentPlans(roadmap, now2);
      const yearPlan = buildYearPlan({ profile, goals, phases: roadmap.phases, tasks: roadmap.tasks, milestones: roadmap.milestones, exams, now: nowIso(now2) });
      const calendarEvents = buildCalendarEvents({ roadmap, deadlines, exams, milestones: roadmap.milestones, studySessions: state.studySessions, recovery });
      return {
        entityType: "GreenPathSnapshot",
        userId,
        academicProfile: profile,
        goals,
        onboardingCompleted: Boolean(state.onboardingCompleted),
        needsOnboarding: !state.onboardingCompleted,
        curriculumGraph: serializeGraph(graph),
        roadmap,
        yearPlan,
        calendarEvents,
        ...plans,
        courses: courseProgress,
        topicPerformance,
        exams,
        examReadiness,
        deadlines,
        resources,
        progress: overall,
        adaptation,
        recovery,
        risks,
        recommendations,
        status,
        dataStatus: {
          curriculum: "connected",
          performance: history.attempts.length ? "partial" : "empty",
          exams: exams.length ? "connected" : "empty",
          resources: resources.length ? "connected" : "partial"
        },
        lastCalculatedAt: nowIso(now2)
      };
    },
    getState(userRef) {
      return loadState2(safeUserId(userRef));
    },
    saveProfile(userRef, patch) {
      const userId = safeUserId(userRef);
      const state = loadState2(userId);
      state.profile = { ...state.profile ?? {}, ...patch };
      saveState(userId, state);
      return state.profile;
    },
    saveGoals(userRef, goals) {
      const userId = safeUserId(userRef);
      const state = loadState2(userId);
      state.goals = goals;
      saveState(userId, state);
      return goals;
    },
    completeOnboarding(userRef, { profilePatch = {}, goals = [], deadline = null } = {}) {
      const userId = safeUserId(userRef);
      const state = loadState2(userId);
      state.profile = { ...state.profile ?? {}, ...profilePatch };
      state.goals = goals;
      if (deadline) state.deadlines = [...state.deadlines ?? [], { ...deadline, id: deadline.id ?? `deadline:${Date.now()}`, createdAt: nowIso() }];
      state.onboardingCompleted = true;
      saveState(userId, state);
      return state;
    },
    patchTask(userRef, task, patch) {
      const userId = safeUserId(userRef);
      const state = loadState2(userId);
      state.taskPatches[task.id] = {
        ...state.taskPatches[task.id] ?? {},
        topicId: task.topicId,
        type: task.type,
        ...patch,
        updatedAt: nowIso()
      };
      saveState(userId, state);
      return state.taskPatches[task.id];
    },
    saveStudySession(userRef, session) {
      const userId = safeUserId(userRef);
      const state = loadState2(userId);
      state.studySessions = [...state.studySessions ?? [], { ...session, entityType: "StudySession", id: session.id ?? `session:${Date.now()}`, createdAt: nowIso() }];
      saveState(userId, state);
      return state.studySessions.at(-1);
    },
    addDeadline(userRef, deadline) {
      const userId = safeUserId(userRef);
      const state = loadState2(userId);
      state.deadlines = [...state.deadlines ?? [], { ...deadline, id: deadline.id ?? `deadline:${Date.now()}`, createdAt: nowIso() }];
      saveState(userId, state);
      return state.deadlines.at(-1);
    },
    setRecoveryMode(userRef, mode) {
      const userId = safeUserId(userRef);
      const state = loadState2(userId);
      state.recoveryMode = mode;
      saveState(userId, state);
      return mode;
    },
    reset(userRef) {
      const userId = safeUserId(userRef);
      safeWrite(stateKey3(userId), emptyState());
    }
  };
}

// src/services/greenPath/greenPathService.js
var repository = createGreenPathMockRepository();
async function fetchGreenPathBundle(userRef, options = {}) {
  return repository.getSnapshot(userRef, options);
}

// src/layout/dashboard/greenPath/greenPathShared.jsx
import { jsx, jsxs } from "react/jsx-runtime";
var PERSIAN_DATE = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "long", year: "numeric" });
var PERSIAN_SHORT_DATE = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "long" });
var PERSIAN_WEEKDAY = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long" });
var formatDate = (value, { short = false } = {}) => {
  if (!value) return "\u2014";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "\u2014" : (short ? PERSIAN_SHORT_DATE : PERSIAN_DATE).format(date);
};
var formatMinutes = (value) => {
  const minutes = Math.max(0, Number(value) || 0);
  if (minutes < 60) return `${toFa(minutes)} \u062F\u0642\u06CC\u0642\u0647`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${toFa(hours)} \u0633\u0627\u0639\u062A \u0648 ${toFa(rest)} \u062F\u0642\u06CC\u0642\u0647` : `${toFa(hours)} \u0633\u0627\u0639\u062A`;
};
var TASK_TYPE_LABELS = {
  [TASK_TYPES.LEARN]: "\u06CC\u0627\u062F\u06AF\u06CC\u0631\u06CC",
  [TASK_TYPES.REVIEW]: "\u0645\u0631\u0648\u0631",
  [TASK_TYPES.PRACTICE]: "\u062A\u0633\u062A \u0622\u0645\u0648\u0632\u0634\u06CC",
  [TASK_TYPES.TEST]: "\u062A\u0633\u062A \u0632\u0645\u0627\u0646\u200C\u062F\u0627\u0631",
  [TASK_TYPES.ANALYZE]: "\u062A\u062D\u0644\u06CC\u0644 \u062A\u0633\u062A",
  [TASK_TYPES.READ_REFERENCE]: "\u0631\u0641\u0631\u0646\u0633",
  [TASK_TYPES.WIKI_REVIEW]: "\u0648\u06CC\u06A9\u06CC",
  [TASK_TYPES.KNOWLEDGE_LINK]: "\u0634\u0628\u06A9\u0647 \u062F\u0627\u0646\u0634",
  [TASK_TYPES.FLASHCARD_REVIEW]: "\u0641\u0644\u0634\u200C\u06A9\u0627\u0631\u062A",
  [TASK_TYPES.MOCK_EXAM]: "\u0622\u0632\u0645\u0648\u0646",
  [TASK_TYPES.BUFFER]: "\u0628\u0627\u0641\u0631"
};
var courseAccent = (courseId) => COURSE_COLORS[courseId] ?? "var(--green-ink)";
var resourceLabel2 = (type) => RESOURCE_LABELS[type] ?? type;
function ArrowIcon({ direction = "left", className = "gp-icon" }) {
  return /* @__PURE__ */ jsx("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: direction === "right" ? /* @__PURE__ */ jsx("path", { d: "m14 5-7 7 7 7M8 12h12" }) : /* @__PURE__ */ jsx("path", { d: "m10 5 7 7-7 7M4 12h12" }) });
}
function CheckIcon({ className = "gp-icon" }) {
  return /* @__PURE__ */ jsx("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ jsx("path", { d: "m5 12 4.2 4.2L19 6.5" }) });
}
function SparkIcon({ className = "gp-icon" }) {
  return /* @__PURE__ */ jsxs("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.7", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx("path", { d: "m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7z" }),
    /* @__PURE__ */ jsx("path", { d: "m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" })
  ] });
}
function CalendarIcon({ className = "gp-icon" }) {
  return /* @__PURE__ */ jsxs("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.7", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx("rect", { x: "3", y: "5", width: "18", height: "16", rx: "2" }),
    /* @__PURE__ */ jsx("path", { d: "M8 3v4M16 3v4M3 10h18" })
  ] });
}
function TargetIcon({ className = "gp-icon" }) {
  return /* @__PURE__ */ jsxs("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.7", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "8.5" }),
    /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "4.5" }),
    /* @__PURE__ */ jsx("path", { d: "m16.5 7.5 4-4M17.5 3.5h3v3" })
  ] });
}
function ProgressRing({ value = 0, size = 116, label = "\u067E\u06CC\u0634\u0631\u0641\u062A", tone = "green" }) {
  const normalized = Math.min(100, Math.max(0, Number(value) || 0));
  const radius = 47;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - normalized / 100);
  return /* @__PURE__ */ jsxs("div", { className: `gp-ring gp-ring--${tone}`, style: { "--gp-ring-size": `${size}px` }, children: [
    /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 110 110", "aria-label": `${label} ${toFa(Math.round(normalized))} \u062F\u0631\u0635\u062F`, role: "img", children: [
      /* @__PURE__ */ jsx("circle", { className: "gp-ring__track", cx: "55", cy: "55", r: radius }),
      /* @__PURE__ */ jsx("circle", { className: "gp-ring__value", cx: "55", cy: "55", r: radius, strokeDasharray: circumference, strokeDashoffset: offset })
    ] }),
    /* @__PURE__ */ jsxs("span", { className: "gp-ring__text", children: [
      /* @__PURE__ */ jsxs("strong", { children: [
        toFa(Math.round(normalized)),
        "\u066A"
      ] }),
      /* @__PURE__ */ jsx("small", { children: label })
    ] })
  ] });
}
function StatusPill({ status }) {
  const meta = {
    "on-track": { label: "On Track", className: "is-on-track" },
    "at-risk": { label: "At Risk", className: "is-at-risk" },
    behind: { label: "Behind Schedule", className: "is-behind" },
    ahead: { label: "Ahead of Schedule", className: "is-ahead" }
  }[status] ?? { label: "\u062F\u0631 \u062D\u0627\u0644 \u062A\u062D\u0644\u06CC\u0644", className: "is-neutral" };
  return /* @__PURE__ */ jsxs("span", { className: `gp-status ${meta.className}`, children: [
    /* @__PURE__ */ jsx("i", { "aria-hidden": "true" }),
    meta.label
  ] });
}
function SectionHeader({ eyebrow, title, description, action = null }) {
  return /* @__PURE__ */ jsxs("header", { className: "gp-section-header", children: [
    /* @__PURE__ */ jsxs("div", { children: [
      eyebrow && /* @__PURE__ */ jsx("span", { className: "gp-eyebrow", children: eyebrow }),
      /* @__PURE__ */ jsx("h2", { children: title }),
      description && /* @__PURE__ */ jsx("p", { children: description })
    ] }),
    action
  ] });
}
function EmptyState({ title = "\u062F\u0627\u062F\u0647\u200C\u0627\u06CC \u0628\u0631\u0627\u06CC \u0646\u0645\u0627\u06CC\u0634 \u0646\u06CC\u0633\u062A", description = "\u0628\u0627 \u062B\u0628\u062A \u0627\u0648\u0644\u06CC\u0646 \u0641\u0639\u0627\u0644\u06CC\u062A\u060C \u0627\u06CC\u0646 \u0628\u062E\u0634 \u0632\u0646\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F.", action = null }) {
  return /* @__PURE__ */ jsxs("div", { className: "gp-empty", children: [
    /* @__PURE__ */ jsx("span", { className: "gp-empty__mark", "aria-hidden": "true", children: /* @__PURE__ */ jsx(SparkIcon, {}) }),
    /* @__PURE__ */ jsx("strong", { children: title }),
    /* @__PURE__ */ jsx("p", { children: description }),
    action
  ] });
}

// src/layout/dashboard/greenPath/GreenPathCards.jsx
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function ResourceAction({ resource, onOpen }) {
  if (!resource) return null;
  return /* @__PURE__ */ jsxs2("button", { type: "button", className: "gp-resource", style: { "--gp-resource-accent": resource.accent }, onClick: () => onOpen?.(resource), title: `\u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 ${resource.title}`, children: [
    /* @__PURE__ */ jsx2("span", { className: "gp-resource__dot", "aria-hidden": "true" }),
    /* @__PURE__ */ jsx2("span", { children: resourceLabel2(resource.type) }),
    /* @__PURE__ */ jsx2(ArrowIcon, { className: "gp-icon gp-icon--small" })
  ] });
}
function TaskCard({ task, resources = [], onComplete, onFocus, onOpenResource, onReschedule, compact = false }) {
  const isCompleted = task.state === "completed";
  const reason = Array.isArray(task.reason) ? task.reason[0] : task.reason;
  return /* @__PURE__ */ jsxs2("article", { className: `gp-task ${isCompleted ? "is-completed" : ""} ${compact ? "gp-task--compact" : ""}`, style: { "--gp-course-accent": task.sourceAccent ?? courseAccent(task.courseId), "--gp-task-course-accent": courseAccent(task.courseId) }, children: [
    /* @__PURE__ */ jsx2("div", { className: "gp-task__rail", "aria-hidden": "true" }),
    /* @__PURE__ */ jsxs2("div", { className: "gp-task__main", children: [
      /* @__PURE__ */ jsxs2("div", { className: "gp-task__topline", children: [
        /* @__PURE__ */ jsx2("span", { className: "gp-task__type", children: TASK_TYPE_LABELS[task.type] ?? task.type }),
        /* @__PURE__ */ jsx2("span", { className: "gp-task__source", children: task.sourceLabel ?? "\u0645\u0633\u06CC\u0631 \u0633\u0628\u0632" }),
        /* @__PURE__ */ jsx2("span", { className: "gp-task__duration", children: formatMinutes(task.durationMinutes) })
      ] }),
      /* @__PURE__ */ jsx2("h3", { children: task.title }),
      !compact && /* @__PURE__ */ jsx2("p", { className: "gp-task__reason", children: reason ?? "\u0628\u0631\u0627\u06CC \u0627\u062F\u0627\u0645\u0647 \u0645\u0633\u06CC\u0631 \u0627\u0645\u0631\u0648\u0632 \u067E\u06CC\u0634\u0646\u0647\u0627\u062F \u0634\u062F\u0647 \u0627\u0633\u062A." }),
      !compact && /* @__PURE__ */ jsxs2("div", { className: "gp-task__meta", children: [
        /* @__PURE__ */ jsxs2("span", { children: [
          /* @__PURE__ */ jsx2(CalendarIcon, { className: "gp-icon gp-icon--small" }),
          " ",
          formatDate(task.plannedDate, { short: true })
        ] }),
        /* @__PURE__ */ jsxs2("span", { children: [
          "\u0627\u0648\u0644\u0648\u06CC\u062A ",
          toFa(Math.round(task.priorityScore))
        ] }),
        task.deadline && /* @__PURE__ */ jsxs2("span", { children: [
          "\u062F\u062F\u0644\u0627\u06CC\u0646 ",
          formatDate(task.deadline, { short: true })
        ] })
      ] }),
      !compact && resources.length > 0 && /* @__PURE__ */ jsx2("div", { className: "gp-task__resources", "aria-label": "\u0645\u0646\u0627\u0628\u0639 \u0641\u0639\u0627\u0644\u06CC\u062A", children: resources.slice(0, 4).map((resource) => /* @__PURE__ */ jsx2(ResourceAction, { resource, onOpen: onOpenResource }, resource.id)) })
    ] }),
    /* @__PURE__ */ jsxs2("div", { className: "gp-task__actions", children: [
      !isCompleted ? /* @__PURE__ */ jsxs2("button", { type: "button", className: "gp-task__complete", onClick: () => onComplete?.(task), children: [
        /* @__PURE__ */ jsx2(CheckIcon, { className: "gp-icon" }),
        " \u0627\u0646\u062C\u0627\u0645 \u0634\u062F"
      ] }) : /* @__PURE__ */ jsxs2("span", { className: "gp-task__done", children: [
        /* @__PURE__ */ jsx2(CheckIcon, { className: "gp-icon" }),
        " \u062B\u0628\u062A \u0634\u062F"
      ] }),
      !compact && !isCompleted && /* @__PURE__ */ jsxs2("div", { className: "gp-task__secondary", children: [
        /* @__PURE__ */ jsx2("button", { type: "button", onClick: () => onFocus?.(task), children: "\u062A\u0645\u0631\u06A9\u0632" }),
        /* @__PURE__ */ jsx2("button", { type: "button", onClick: () => onReschedule?.(task), children: "\u0641\u0631\u062F\u0627" })
      ] })
    ] })
  ] });
}
function CourseProgressCard({ course, onOpen }) {
  return /* @__PURE__ */ jsxs2("button", { type: "button", className: "gp-course-card", style: { "--gp-course-accent": courseAccent(course.courseId) }, onClick: () => onOpen?.(course.courseId), children: [
    /* @__PURE__ */ jsxs2("span", { className: "gp-course-card__head", children: [
      /* @__PURE__ */ jsx2("span", { className: "gp-course-card__dot", "aria-hidden": "true" }),
      /* @__PURE__ */ jsx2("strong", { children: course.title }),
      /* @__PURE__ */ jsx2(ArrowIcon, { className: "gp-icon gp-icon--small" })
    ] }),
    /* @__PURE__ */ jsxs2("span", { className: "gp-course-card__numbers", children: [
      /* @__PURE__ */ jsxs2("span", { children: [
        toFa(course.completedTopics),
        " / ",
        toFa(course.topicCount),
        " \u0645\u0628\u062D\u062B"
      ] }),
      /* @__PURE__ */ jsx2("span", { children: course.accuracy === null ? "\u2014" : `${toFa(Math.round(course.accuracy))}\u066A \u062F\u0642\u062A` })
    ] }),
    /* @__PURE__ */ jsx2("span", { className: "gp-progress", children: /* @__PURE__ */ jsx2("span", { style: { width: `${course.coverage}%` } }) }),
    /* @__PURE__ */ jsxs2("span", { className: "gp-course-card__footer", children: [
      /* @__PURE__ */ jsxs2("span", { children: [
        "\u067E\u0648\u0634\u0634 ",
        toFa(Math.round(course.coverage)),
        "\u066A"
      ] }),
      /* @__PURE__ */ jsxs2("span", { children: [
        "\u062A\u0633\u0644\u0637 ",
        toFa(Math.round(course.mastery)),
        "\u066A"
      ] })
    ] })
  ] });
}
function Timeline({ phases = [], milestones = [], onOpenPhase }) {
  const visible = milestones.filter((milestone) => milestone.status !== "completed").slice(0, 8);
  return /* @__PURE__ */ jsxs2("section", { className: "gp-panel gp-timeline-panel", children: [
    /* @__PURE__ */ jsx2(SectionHeader, { eyebrow: "ROADMAP", title: "\u0646\u0642\u0634\u0647 \u0631\u0627\u0647 \u062A\u0631\u0645", description: "\u0647\u0631 \u0646\u0642\u0637\u0647 \u06CC\u06A9 \u062A\u0635\u0645\u06CC\u0645 \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC\u200C\u0634\u062F\u0647 \u0627\u0633\u062A\u060C \u0646\u0647 \u06CC\u06A9 \u062A\u0632\u0626\u06CC\u0646 \u0628\u0635\u0631\u06CC." }),
    /* @__PURE__ */ jsx2("div", { className: "gp-timeline", role: "list", "aria-label": "\u062E\u0637 \u0632\u0645\u0627\u0646\u06CC \u0645\u0633\u06CC\u0631", children: phases.map((phase) => /* @__PURE__ */ jsxs2("button", { type: "button", className: `gp-timeline__phase ${phase.status === "active" ? "is-active" : ""} ${phase.status === "completed" ? "is-completed" : ""}`, onClick: () => onOpenPhase?.(phase.phaseId), children: [
      /* @__PURE__ */ jsx2("span", { className: "gp-timeline__node", "aria-hidden": "true" }),
      /* @__PURE__ */ jsxs2("span", { className: "gp-timeline__body", children: [
        /* @__PURE__ */ jsx2("strong", { children: phase.label }),
        /* @__PURE__ */ jsxs2("small", { children: [
          phase.startDate,
          " \u2014 ",
          phase.endDate
        ] }),
        /* @__PURE__ */ jsx2("em", { children: phase.description })
      ] })
    ] }, phase.id)) }),
    visible.length > 0 && /* @__PURE__ */ jsx2("div", { className: "gp-milestones", "aria-label": "\u0646\u0642\u0627\u0637 \u0639\u0637\u0641 \u0622\u06CC\u0646\u062F\u0647", children: visible.map((milestone) => /* @__PURE__ */ jsxs2("div", { className: "gp-milestone", children: [
      /* @__PURE__ */ jsx2("span", { className: `gp-milestone__mark gp-milestone__mark--${milestone.type}`, "aria-hidden": "true", children: /* @__PURE__ */ jsx2(TargetIcon, { className: "gp-icon gp-icon--small" }) }),
      /* @__PURE__ */ jsxs2("span", { children: [
        /* @__PURE__ */ jsx2("strong", { children: milestone.title }),
        /* @__PURE__ */ jsx2("small", { children: formatDate(milestone.date, { short: true }) })
      ] })
    ] }, milestone.id)) })
  ] });
}
function DeadlineCard({ item, readiness }) {
  const entry = readiness?.find((candidate) => candidate.examId === item.examId);
  return /* @__PURE__ */ jsxs2("article", { className: `gp-deadline gp-deadline--${entry?.risk ?? "neutral"}`, children: [
    /* @__PURE__ */ jsx2("div", { className: "gp-deadline__icon", children: /* @__PURE__ */ jsx2(CalendarIcon, {}) }),
    /* @__PURE__ */ jsxs2("div", { className: "gp-deadline__body", children: [
      /* @__PURE__ */ jsx2("strong", { children: item.title }),
      /* @__PURE__ */ jsx2("span", { children: formatDate(item.date) }),
      entry && /* @__PURE__ */ jsxs2("small", { children: [
        "\u0622\u0645\u0627\u062F\u06AF\u06CC ",
        toFa(Math.round(entry.readiness)),
        "\u066A \xB7 \u067E\u0648\u0634\u0634 ",
        toFa(Math.round(entry.coverage)),
        "\u066A"
      ] })
    ] }),
    entry && /* @__PURE__ */ jsx2("span", { className: "gp-deadline__days", children: entry.daysRemaining < 0 ? "\u06AF\u0630\u0634\u062A\u0647" : `${toFa(entry.daysRemaining)} \u0631\u0648\u0632` })
  ] });
}
function RiskCard({ risk }) {
  return /* @__PURE__ */ jsxs2("article", { className: `gp-risk gp-risk--${risk.severity}`, children: [
    /* @__PURE__ */ jsxs2("div", { className: "gp-risk__head", children: [
      /* @__PURE__ */ jsx2("span", { className: "gp-risk__signal", "aria-hidden": "true" }),
      /* @__PURE__ */ jsx2("span", { children: risk.type }),
      /* @__PURE__ */ jsx2("strong", { children: risk.title })
    ] }),
    /* @__PURE__ */ jsx2("p", { children: risk.reason }),
    /* @__PURE__ */ jsx2("small", { children: risk.action })
  ] });
}
function RecommendationCard({ recommendation }) {
  return /* @__PURE__ */ jsxs2("article", { className: `gp-recommendation gp-recommendation--${recommendation.priority}`, children: [
    /* @__PURE__ */ jsx2("span", { className: "gp-recommendation__icon", "aria-hidden": "true", children: /* @__PURE__ */ jsx2(SparkIcon, {}) }),
    /* @__PURE__ */ jsxs2("div", { children: [
      /* @__PURE__ */ jsx2("strong", { children: recommendation.title }),
      /* @__PURE__ */ jsx2("p", { children: recommendation.reason }),
      /* @__PURE__ */ jsxs2("small", { children: [
        "\u06AF\u0627\u0645 \u0628\u0639\u062F\u06CC: ",
        recommendation.action
      ] })
    ] })
  ] });
}
function MiniMetric({ label, value, note, tone = "green" }) {
  return /* @__PURE__ */ jsxs2("div", { className: `gp-mini-metric gp-mini-metric--${tone}`, children: [
    /* @__PURE__ */ jsx2("span", { children: label }),
    /* @__PURE__ */ jsx2("strong", { children: value }),
    note && /* @__PURE__ */ jsx2("small", { children: note })
  ] });
}

// src/layout/dashboard/greenPath/GreenPathViews.jsx
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
function GreenPathOverview({ snapshot: snapshot2, onOpenOnboarding, onOpenCourse, onOpenTask, onComplete, onFocus, onOpenResource, onReschedule, onOpenPhase }) {
  const activePhase = snapshot2.roadmap.phases.find((phase) => phase.status === "active") ?? snapshot2.roadmap.phases[0];
  const nextMilestone = snapshot2.roadmap.milestones.find((milestone) => milestone.status !== "completed" && new Date(milestone.date) >= /* @__PURE__ */ new Date());
  const todayTasks = snapshot2.dailyPlan.tasks ?? [];
  const upcomingDeadlines = snapshot2.deadlines.filter((deadline) => !deadline.completed && new Date(deadline.date) >= /* @__PURE__ */ new Date()).slice(0, 4);
  const examReadiness = snapshot2.examReadiness.filter((exam) => exam.daysRemaining >= 0).slice(0, 3);
  const taskResources = (task) => (snapshot2.resources ?? []).filter((resource) => (task.resourceIds ?? []).includes(resource.id));
  return /* @__PURE__ */ jsxs3("div", { className: "gp-view gp-overview", children: [
    /* @__PURE__ */ jsxs3("section", { className: "gp-hero", children: [
      /* @__PURE__ */ jsxs3("div", { className: "gp-hero__copy", children: [
        /* @__PURE__ */ jsx3("span", { className: "gp-eyebrow", children: "PERSONAL ACADEMIC OPERATING SYSTEM" }),
        /* @__PURE__ */ jsx3("h1", { children: "\u0645\u0633\u06CC\u0631 \u062A\u0648 \u062A\u0627 \u0645\u0642\u0635\u062F" }),
        /* @__PURE__ */ jsx3("p", { children: "\u0645\u0633\u06CC\u0631 \u0633\u0628\u0632 \u0648\u0636\u0639\u06CC\u062A \u0627\u0645\u0631\u0648\u0632\u062A \u0631\u0627 \u0628\u0627 \u0647\u062F\u0641\u060C \u0638\u0631\u0641\u06CC\u062A\u060C \u0639\u0645\u0644\u06A9\u0631\u062F \u0648 \u062F\u062F\u0644\u0627\u06CC\u0646\u200C\u0647\u0627\u06CC \u0648\u0627\u0642\u0639\u06CC \u062A\u0631\u06A9\u06CC\u0628 \u0645\u06CC\u200C\u06A9\u0646\u062F \u062A\u0627 \u0628\u062F\u0627\u0646\u06CC \u0642\u062F\u0645 \u0628\u0639\u062F\u06CC \u062F\u0642\u06CC\u0642\u0627\u064B \u0686\u06CC\u0633\u062A." }),
        /* @__PURE__ */ jsxs3("div", { className: "gp-hero__actions", children: [
          /* @__PURE__ */ jsxs3("button", { type: "button", className: "gp-button gp-button--primary", onClick: () => onOpenTask?.(todayTasks[0]), disabled: !todayTasks[0], children: [
            "\u0634\u0631\u0648\u0639 \u0641\u0639\u0627\u0644\u06CC\u062A \u0628\u0639\u062F\u06CC ",
            /* @__PURE__ */ jsx3(ArrowIcon, {})
          ] }),
          /* @__PURE__ */ jsx3("button", { type: "button", className: "gp-button gp-button--ghost", onClick: onOpenOnboarding, children: "\u062A\u0646\u0638\u06CC\u0645 \u0645\u0633\u06CC\u0631" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs3("div", { className: "gp-hero__position", children: [
        /* @__PURE__ */ jsx3(ProgressRing, { value: snapshot2.progress.overall, label: "\u067E\u06CC\u0634\u0631\u0641\u062A \u0645\u0633\u06CC\u0631", size: 148, tone: "green" }),
        /* @__PURE__ */ jsxs3("div", { children: [
          /* @__PURE__ */ jsx3(StatusPill, { status: snapshot2.status.code }),
          /* @__PURE__ */ jsxs3("strong", { children: [
            "\u0647\u0641\u062A\u0647 ",
            toFa(snapshot2.academicProfile.currentWeek),
            " \u0627\u0632 ",
            toFa(snapshot2.academicProfile.totalWeeks)
          ] }),
          /* @__PURE__ */ jsx3("span", { children: activePhase?.label ?? "\u062F\u0631 \u062D\u0627\u0644 \u062A\u062D\u0644\u06CC\u0644" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs3("section", { className: "gp-overview-grid gp-overview-grid--metrics", "aria-label": "\u062E\u0644\u0627\u0635\u0647 \u0648\u0636\u0639\u06CC\u062A \u0645\u0633\u06CC\u0631", children: [
      /* @__PURE__ */ jsx3(MiniMetric, { label: "\u067E\u0648\u0634\u0634 \u0645\u0628\u0627\u062D\u062B", value: `${toFa(snapshot2.progress.coverage)}\u066A`, note: "\u0648\u0632\u0646\u200C\u062F\u0627\u0631 \u0628\u0631 \u0627\u0633\u0627\u0633 Topic", tone: "blue" }),
      /* @__PURE__ */ jsx3(MiniMetric, { label: "\u062A\u0633\u0644\u0637 \u0648\u0627\u0642\u0639\u06CC", value: `${toFa(snapshot2.progress.mastery)}\u066A`, note: "Completion \u2260 Mastery", tone: "purple" }),
      /* @__PURE__ */ jsx3(MiniMetric, { label: "\u0638\u0631\u0641\u06CC\u062A \u0627\u06CC\u0646 \u0647\u0641\u062A\u0647", value: formatMinutes(snapshot2.weeklyPlan.plannedMinutes), note: `${toFa(snapshot2.roadmap.capacity.utilization)}\u066A \u0627\u0632 \u0638\u0631\u0641\u06CC\u062A \u0645\u0624\u062B\u0631`, tone: "green" }),
      /* @__PURE__ */ jsx3(MiniMetric, { label: "\u0645\u0631\u0648\u0631\u0647\u0627\u06CC \u062B\u0628\u062A\u200C\u0634\u062F\u0647", value: toFa(snapshot2.progress.reviewCount), note: "\u0628\u0627\u0632\u062E\u0648\u0631\u062F \u0648\u0627\u0631\u062F \u0645\u0648\u062A\u0648\u0631 \u0634\u062F", tone: "gold" })
    ] }),
    /* @__PURE__ */ jsxs3("section", { className: "gp-panel gp-today-panel", children: [
      /* @__PURE__ */ jsx3(SectionHeader, { eyebrow: "TODAY", title: "\u0627\u0645\u0631\u0648\u0632 \u0686\u0647 \u06A9\u0627\u0631 \u06A9\u0646\u0645\u061F", description: snapshot2.status.reason, action: /* @__PURE__ */ jsxs3("span", { className: "gp-date-chip", children: [
        /* @__PURE__ */ jsx3(CalendarIcon, { className: "gp-icon gp-icon--small" }),
        " ",
        formatDate(snapshot2.dailyPlan.date)
      ] }) }),
      /* @__PURE__ */ jsxs3("div", { className: "gp-today-panel__goal", children: [
        /* @__PURE__ */ jsx3(TargetIcon, { className: "gp-icon" }),
        /* @__PURE__ */ jsxs3("span", { children: [
          /* @__PURE__ */ jsx3("strong", { children: "\u0647\u062F\u0641 \u0627\u0645\u0631\u0648\u0632" }),
          /* @__PURE__ */ jsx3("small", { children: activePhase?.description ?? "\u06CC\u06A9 \u06AF\u0627\u0645 \u0648\u0627\u0642\u0639\u06CC \u062F\u0631 \u0645\u0633\u06CC\u0631\u062A \u0628\u0631\u062F\u0627\u0631." })
        ] })
      ] }),
      todayTasks.length ? /* @__PURE__ */ jsx3("div", { className: "gp-task-list", children: todayTasks.map((task) => /* @__PURE__ */ jsx3(TaskCard, { task, resources: taskResources(task), onComplete, onFocus, onOpenResource, onReschedule }, task.id)) }) : /* @__PURE__ */ jsx3(EmptyState, { title: "\u0628\u0631\u0627\u06CC \u0627\u0645\u0631\u0648\u0632 \u0641\u0639\u0627\u0644\u06CC\u062A\u06CC \u062B\u0628\u062A \u0646\u0634\u062F\u0647", description: "\u0628\u0627 \u062A\u0646\u0638\u06CC\u0645 \u0638\u0631\u0641\u06CC\u062A \u06CC\u0627 \u062A\u0648\u0644\u06CC\u062F \u062F\u0648\u0628\u0627\u0631\u0647\u0654 \u0646\u0642\u0634\u0647 \u0631\u0627\u0647\u060C \u0628\u0631\u0646\u0627\u0645\u0647 \u0631\u0648\u0632\u062A \u0633\u0627\u062E\u062A\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F.", action: /* @__PURE__ */ jsx3("button", { type: "button", className: "gp-button gp-button--ghost", onClick: onOpenOnboarding, children: "\u062A\u0646\u0638\u06CC\u0645 \u0638\u0631\u0641\u06CC\u062A" }) })
    ] }),
    /* @__PURE__ */ jsx3(Timeline, { phases: snapshot2.roadmap.phases, milestones: snapshot2.roadmap.milestones, onOpenPhase }),
    /* @__PURE__ */ jsxs3("div", { className: "gp-two-column", children: [
      /* @__PURE__ */ jsxs3("section", { className: "gp-panel", children: [
        /* @__PURE__ */ jsx3(SectionHeader, { eyebrow: "COURSES", title: "\u0648\u0636\u0639\u06CC\u062A \u062F\u0631\u0633\u200C\u0647\u0627", description: "\u0627\u0648\u0644\u0648\u06CC\u062A \u0647\u0631 \u062F\u0631\u0633 \u0627\u0632 \u0645\u0628\u062D\u062B\u060C \u0639\u0645\u0644\u06A9\u0631\u062F \u0648 \u062F\u062F\u0644\u0627\u06CC\u0646 \u0633\u0627\u062E\u062A\u0647 \u0634\u062F\u0647 \u0627\u0633\u062A." }),
        /* @__PURE__ */ jsx3("div", { className: "gp-course-grid", children: snapshot2.courses.slice(0, 8).map((course) => /* @__PURE__ */ jsx3(CourseProgressCard, { course, onOpen: onOpenCourse }, course.courseId)) })
      ] }),
      /* @__PURE__ */ jsxs3("section", { className: "gp-panel", children: [
        /* @__PURE__ */ jsx3(SectionHeader, { eyebrow: "UPCOMING", title: "\u0646\u0642\u0627\u0637 \u0645\u0647\u0645 \u0628\u0639\u062F\u06CC", description: "\u062F\u062F\u0644\u0627\u06CC\u0646\u200C\u0647\u0627 \u0631\u0648\u06CC \u0647\u0645\u0627\u0646 Timeline \u0628\u0631\u0646\u0627\u0645\u0647 \u0627\u062B\u0631 \u0645\u06CC\u200C\u06AF\u0630\u0627\u0631\u0646\u062F." }),
        /* @__PURE__ */ jsx3("div", { className: "gp-deadline-list", children: upcomingDeadlines.length ? upcomingDeadlines.map((item) => /* @__PURE__ */ jsx3(DeadlineCard, { item, readiness: examReadiness }, item.id)) : /* @__PURE__ */ jsx3(EmptyState, { title: "\u062F\u062F\u0644\u0627\u06CC\u0646 \u0622\u06CC\u0646\u062F\u0647\u200C\u0627\u06CC \u062B\u0628\u062A \u0646\u0634\u062F\u0647", description: "\u0627\u0645\u062A\u062D\u0627\u0646 \u06CC\u0627 \u0647\u062F\u0641 \u0634\u062E\u0635\u06CC\u200C\u0627\u062A \u0631\u0627 \u0627\u0636\u0627\u0641\u0647 \u06A9\u0646." }) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs3("div", { className: "gp-two-column", children: [
      /* @__PURE__ */ jsxs3("section", { className: "gp-panel", children: [
        /* @__PURE__ */ jsx3(SectionHeader, { eyebrow: "RISK", title: "\u06A9\u062C\u0627 \u0645\u0645\u06A9\u0646 \u0627\u0633\u062A \u0639\u0642\u0628 \u0628\u06CC\u0641\u062A\u06CC\u061F", description: "\u0631\u06CC\u0633\u06A9\u200C\u0647\u0627 \u0628\u0627 \u062F\u0644\u06CC\u0644 \u0648 \u0627\u0642\u062F\u0627\u0645 \u0628\u0639\u062F\u06CC \u0646\u0645\u0627\u06CC\u0634 \u062F\u0627\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F." }),
        /* @__PURE__ */ jsx3("div", { className: "gp-risk-list", children: snapshot2.risks.length ? snapshot2.risks.slice(0, 4).map((risk) => /* @__PURE__ */ jsx3(RiskCard, { risk }, risk.id)) : /* @__PURE__ */ jsx3(EmptyState, { title: "\u0631\u06CC\u0633\u06A9 \u0645\u0647\u0645\u06CC \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F", description: "\u0628\u0627 \u062B\u0628\u062A \u062A\u0633\u062A \u0648 \u0641\u0639\u0627\u0644\u06CC\u062A\u060C \u062A\u062D\u0644\u06CC\u0644 \u062F\u0642\u06CC\u0642\u200C\u062A\u0631 \u0645\u06CC\u200C\u0634\u0648\u062F." }) })
      ] }),
      /* @__PURE__ */ jsxs3("section", { className: "gp-panel", children: [
        /* @__PURE__ */ jsx3(SectionHeader, { eyebrow: "NEXT BEST ACTION", title: "\u067E\u06CC\u0634\u0646\u0647\u0627\u062F\u0647\u0627\u06CC \u0647\u0648\u0634\u0645\u0646\u062F", description: "\u0642\u0627\u0646\u0648\u0646\u200C\u0645\u062D\u0648\u0631\u060C \u062A\u0648\u0636\u06CC\u062D\u200C\u067E\u0630\u06CC\u0631 \u0648 \u0645\u062A\u0635\u0644 \u0628\u0647 \u0645\u0646\u0627\u0628\u0639 \u062A\u067E\u0634." }),
        /* @__PURE__ */ jsx3("div", { className: "gp-recommendation-list", children: snapshot2.recommendations.length ? snapshot2.recommendations.slice(0, 4).map((recommendation) => /* @__PURE__ */ jsx3(RecommendationCard, { recommendation }, recommendation.id)) : /* @__PURE__ */ jsx3(EmptyState, { title: "\u067E\u06CC\u0634\u0646\u0647\u0627\u062F \u062A\u0627\u0632\u0647\u200C\u0627\u06CC \u0646\u062F\u0627\u0631\u06CC\u0645", description: "\u0627\u0648\u0644\u06CC\u0646 \u0641\u0639\u0627\u0644\u06CC\u062A \u0631\u0627 \u0627\u0646\u062C\u0627\u0645 \u0628\u062F\u0647 \u062A\u0627 \u0686\u0631\u062E\u0647 \u0628\u0627\u0632\u062E\u0648\u0631\u062F \u0634\u0631\u0648\u0639 \u0634\u0648\u062F." }) })
      ] })
    ] })
  ] });
}

// src/layout/dashboard/greenPath/GreenPathCalendar.jsx
import { useMemo, useState } from "react";
import { jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
var WEEKDAYS = ["\u0634\u0646\u0628\u0647", "\u06CC\u06A9\u0634\u0646\u0628\u0647", "\u062F\u0648\u0634\u0646\u0628\u0647", "\u0633\u0647\u200C\u0634\u0646\u0628\u0647", "\u0686\u0647\u0627\u0631\u0634\u0646\u0628\u0647", "\u067E\u0646\u062C\u0634\u0646\u0628\u0647", "\u062C\u0645\u0639\u0647"];
var addMonths2 = (value, amount) => {
  const date = new Date(value);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date;
};
var monthKey = (value) => new Date(value).toISOString().slice(0, 7);
var monthLabel = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "long", year: "numeric" });
function EventChip({ event: event2, onSelect }) {
  return /* @__PURE__ */ jsxs4("button", { type: "button", className: `gp-calendar__event gp-calendar__event--${event2.kind}`, style: { "--gp-event-accent": event2.accent }, onClick: () => onSelect?.(event2), title: event2.title, children: [
    /* @__PURE__ */ jsx4("i", { "aria-hidden": "true" }),
    /* @__PURE__ */ jsx4("span", { children: event2.title })
  ] });
}
function EventDetails({ date, events, onClose }) {
  return /* @__PURE__ */ jsxs4("aside", { className: "gp-calendar__details", "aria-label": `\u0641\u0639\u0627\u0644\u06CC\u062A\u200C\u0647\u0627\u06CC ${formatDate(date)}`, children: [
    /* @__PURE__ */ jsxs4("header", { children: [
      /* @__PURE__ */ jsxs4("div", { children: [
        /* @__PURE__ */ jsx4("span", { className: "gp-eyebrow", children: "SELECTED DAY" }),
        /* @__PURE__ */ jsx4("h3", { children: formatDate(date) })
      ] }),
      /* @__PURE__ */ jsx4("button", { type: "button", onClick: onClose, "aria-label": "\u0628\u0633\u062A\u0646 \u062C\u0632\u0626\u06CC\u0627\u062A", children: "\xD7" })
    ] }),
    events.length ? /* @__PURE__ */ jsx4("div", { className: "gp-calendar__detail-list", children: events.map((event2) => /* @__PURE__ */ jsxs4("article", { className: "gp-calendar__detail", style: { "--gp-event-accent": event2.accent }, children: [
      /* @__PURE__ */ jsxs4("div", { className: "gp-calendar__detail-head", children: [
        /* @__PURE__ */ jsxs4("span", { children: [
          /* @__PURE__ */ jsx4("i", { "aria-hidden": "true" }),
          event2.sourceLabel
        ] }),
        /* @__PURE__ */ jsx4("small", { children: event2.kind === "task" ? formatMinutes(event2.durationMinutes) : event2.kind === "exam" ? "\u0622\u0632\u0645\u0648\u0646" : event2.kind === "deadline" ? "\u062F\u062F\u0644\u0627\u06CC\u0646" : "\u0646\u0642\u0637\u0647 \u0639\u0637\u0641" })
      ] }),
      /* @__PURE__ */ jsx4("strong", { children: event2.title }),
      event2.state && /* @__PURE__ */ jsx4("small", { children: event2.state === "completed" ? "\u0627\u0646\u062C\u0627\u0645\u200C\u0634\u062F\u0647" : event2.state === "planned" ? "\u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC\u200C\u0634\u062F\u0647" : event2.state })
    ] }, event2.id)) }) : /* @__PURE__ */ jsx4("p", { className: "gp-calendar__no-events", children: "\u062F\u0631 \u0627\u06CC\u0646 \u0631\u0648\u0632 \u0641\u0639\u0627\u0644\u06CC\u062A\u06CC \u0627\u0632 \u0645\u0633\u06CC\u0631 \u0633\u0628\u0632 \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A." })
  ] });
}
function GreenPathCalendar({ snapshot: snapshot2, month, selectedDate, sourceFilter = "all", onMonthChange, onSelectDate, onSourceChange, onOpenEvent }) {
  const [localMonth, setLocalMonth] = useState(() => month ? /* @__PURE__ */ new Date(`${month}-01T00:00:00.000Z`) : /* @__PURE__ */ new Date());
  const activeMonth = month ? /* @__PURE__ */ new Date(`${month}-01T00:00:00.000Z`) : localMonth;
  const events = useMemo(() => {
    const all = snapshot2?.calendarEvents ?? [];
    return sourceFilter === "all" ? all : all.filter((event2) => event2.sourceId === sourceFilter);
  }, [snapshot2?.calendarEvents, sourceFilter]);
  const calendar2 = useMemo(() => buildCalendarMonth({ month: activeMonth, events }), [activeMonth, events]);
  const sourceSummary = useMemo(() => calendarSourceSummary(snapshot2?.calendarEvents ?? []), [snapshot2?.calendarEvents]);
  const selectedEvents = selectedDate ? eventsForDate(snapshot2?.calendarEvents ?? [], selectedDate) : [];
  const moveMonth = (amount) => {
    const next = addMonths2(activeMonth, amount);
    const key = monthKey(next);
    setLocalMonth(next);
    onMonthChange?.(key);
  };
  return /* @__PURE__ */ jsx4("div", { className: "gp-view gp-calendar-view", children: /* @__PURE__ */ jsxs4("section", { className: "gp-calendar-shell", children: [
    /* @__PURE__ */ jsxs4("header", { className: "gp-calendar-shell__header", children: [
      /* @__PURE__ */ jsxs4("div", { children: [
        /* @__PURE__ */ jsx4("span", { className: "gp-eyebrow", children: "ECOSYSTEM CALENDAR" }),
        /* @__PURE__ */ jsx4("h1", { children: "\u062A\u0642\u0648\u06CC\u0645 \u0645\u0633\u06CC\u0631 \u0633\u0628\u0632" }),
        /* @__PURE__ */ jsx4("p", { children: "\u0647\u0645\u0647\u0654 Task\u0647\u0627\u060C \u0622\u0632\u0645\u0648\u0646\u200C\u0647\u0627\u060C \u062F\u062F\u0644\u0627\u06CC\u0646\u200C\u0647\u0627 \u0648 \u0646\u0642\u0627\u0637 \u0639\u0637\u0641 \u0645\u0633\u06CC\u0631 \u062F\u0631 \u06CC\u06A9 \u062A\u0642\u0648\u06CC\u0645 \u0648\u0627\u062D\u062F\u061B \u0631\u0646\u06AF \u0647\u0631 \u06A9\u0627\u0631\u062A \u0627\u0632 \u0628\u062E\u0634 \u0627\u0635\u0644\u06CC \u062A\u067E\u0634 \u0645\u06CC\u200C\u0622\u06CC\u062F." })
      ] }),
      /* @__PURE__ */ jsxs4("div", { className: "gp-calendar-shell__tools", children: [
        /* @__PURE__ */ jsx4("button", { type: "button", className: "gp-calendar__today", onClick: () => {
          const today = /* @__PURE__ */ new Date();
          const key = monthKey(today);
          setLocalMonth(today);
          onMonthChange?.(key);
          onSelectDate?.(today.toISOString().slice(0, 10));
        }, children: "\u0627\u0645\u0631\u0648\u0632" }),
        /* @__PURE__ */ jsx4("button", { type: "button", "aria-label": "\u0645\u0627\u0647 \u0642\u0628\u0644", onClick: () => moveMonth(-1), children: /* @__PURE__ */ jsx4(ArrowIcon, { direction: "right" }) }),
        /* @__PURE__ */ jsx4("button", { type: "button", "aria-label": "\u0645\u0627\u0647 \u0628\u0639\u062F", onClick: () => moveMonth(1), children: /* @__PURE__ */ jsx4(ArrowIcon, {}) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs4("div", { className: "gp-calendar__month-label", children: [
      /* @__PURE__ */ jsx4(CalendarIcon, { className: "gp-icon" }),
      /* @__PURE__ */ jsx4("strong", { children: monthLabel.format(activeMonth) }),
      /* @__PURE__ */ jsxs4("span", { children: [
        toFa(calendar2.days.filter((day) => day.inMonth && day.events.length).length),
        " \u0631\u0648\u0632 \u062F\u0627\u0631\u0627\u06CC \u0641\u0639\u0627\u0644\u06CC\u062A"
      ] })
    ] }),
    /* @__PURE__ */ jsxs4("div", { className: "gp-calendar__source-filter", role: "group", "aria-label": "\u0641\u06CC\u0644\u062A\u0631 \u0628\u062E\u0634\u200C\u0647\u0627\u06CC \u062A\u0642\u0648\u06CC\u0645", children: [
      /* @__PURE__ */ jsxs4("button", { type: "button", className: sourceFilter === "all" ? "is-active" : "", onClick: () => onSourceChange?.("all"), children: [
        "\u0647\u0645\u0647 ",
        /* @__PURE__ */ jsx4("small", { children: toFa((snapshot2?.calendarEvents ?? []).length) })
      ] }),
      sourceSummary.slice(0, 8).map((entry) => /* @__PURE__ */ jsxs4("button", { type: "button", className: sourceFilter === entry.sourceId ? "is-active" : "", style: { "--gp-filter-accent": entry.accent }, onClick: () => onSourceChange?.(entry.sourceId), children: [
        /* @__PURE__ */ jsx4("i", { "aria-hidden": "true" }),
        entry.label,
        /* @__PURE__ */ jsx4("small", { children: toFa(entry.count) })
      ] }, entry.sourceId))
    ] }),
    /* @__PURE__ */ jsxs4("div", { className: "gp-calendar__layout", children: [
      /* @__PURE__ */ jsxs4("div", { className: "gp-calendar__grid", role: "grid", "aria-label": "\u062A\u0642\u0648\u06CC\u0645 \u0645\u0627\u0647\u0627\u0646\u0647", children: [
        /* @__PURE__ */ jsx4("div", { className: "gp-calendar__weekdays", children: WEEKDAYS.map((weekday) => /* @__PURE__ */ jsx4("span", { children: weekday }, weekday)) }),
        /* @__PURE__ */ jsx4("div", { className: "gp-calendar__days", children: calendar2.days.map((day) => {
          const dayEvents = day.events;
          const isSelected = selectedDate === day.date;
          return /* @__PURE__ */ jsxs4("button", { type: "button", role: "gridcell", className: `gp-calendar__day ${day.inMonth ? "" : "is-outside"} ${day.isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}`, onClick: () => onSelectDate?.(day.date), children: [
            /* @__PURE__ */ jsx4("span", { className: "gp-calendar__day-number", children: toFa(day.day) }),
            /* @__PURE__ */ jsxs4("span", { className: "gp-calendar__day-events", children: [
              dayEvents.slice(0, 3).map((event2) => /* @__PURE__ */ jsx4(EventChip, { event: event2, onSelect: (item) => {
                onSelectDate?.(day.date);
                onOpenEvent?.(item);
              } }, event2.id)),
              dayEvents.length > 3 && /* @__PURE__ */ jsxs4("em", { children: [
                "+",
                toFa(dayEvents.length - 3),
                " \u0645\u0648\u0631\u062F \u062F\u06CC\u06AF\u0631"
              ] })
            ] })
          ] }, day.date);
        }) })
      ] }),
      selectedDate && /* @__PURE__ */ jsx4(EventDetails, { date: selectedDate, events: selectedEvents, onClose: () => onSelectDate?.(null) })
    ] })
  ] }) });
}

// src/layout/dashboard/greenPath/GreenPathPeriodViews.jsx
import { useMemo as useMemo2 } from "react";
import { jsx as jsx5, jsxs as jsxs5 } from "react/jsx-runtime";
function PeriodBadge({ status }) {
  const label = status === "current" ? "\u0627\u06A9\u0646\u0648\u0646" : status === "completed" ? "\u067E\u0634\u062A \u0633\u0631 \u06AF\u0630\u0627\u0634\u062A\u0647 \u0634\u062F" : "\u067E\u06CC\u0634 \u0631\u0648";
  return /* @__PURE__ */ jsx5("span", { className: `gp-period-badge gp-period-badge--${status}`, children: label });
}
function SourceBars({ counts = {}, total = 0 }) {
  const entries = Object.entries(counts);
  if (!entries.length) return /* @__PURE__ */ jsx5("div", { className: "gp-period-empty", children: "\u062F\u0631 \u0627\u06CC\u0646 \u0628\u0627\u0632\u0647 Task \u0631\u06CC\u0632 \u0633\u0627\u062E\u062A\u0647 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A\u061B \u062A\u0645\u0631\u06A9\u0632 \u0627\u06CC\u0646 \u0628\u0627\u0632\u0647 \u0627\u0632 \u0641\u0627\u0632 \u0648 \u0647\u062F\u0641 \u0645\u06CC\u200C\u0622\u06CC\u062F." });
  return /* @__PURE__ */ jsx5("div", { className: "gp-source-bars", children: entries.map(([sourceId, count]) => {
    const source = GREEN_PATH_SECTIONS[sourceId] ?? { label: sourceId, accent: "var(--green-ink)" };
    return /* @__PURE__ */ jsxs5("div", { className: "gp-source-bar", style: { "--gp-source-accent": source.accent }, children: [
      /* @__PURE__ */ jsxs5("div", { children: [
        /* @__PURE__ */ jsx5("span", { children: source.label }),
        /* @__PURE__ */ jsx5("strong", { children: toFa(count) })
      ] }),
      /* @__PURE__ */ jsx5("span", { className: "gp-source-bar__track", children: /* @__PURE__ */ jsx5("i", { style: { width: `${total ? count / total * 100 : 0}` } }) })
    ] }, sourceId);
  }) });
}
function GreenPathYearView({ snapshot: snapshot2, onOpenMonth, onOpenCalendar }) {
  const yearPlan = snapshot2.yearPlan;
  const currentMonth = yearPlan.months.find((month) => month.status === "current") ?? yearPlan.months[0];
  return /* @__PURE__ */ jsxs5("div", { className: "gp-view gp-period-view", children: [
    /* @__PURE__ */ jsxs5("section", { className: "gp-period-hero", children: [
      /* @__PURE__ */ jsxs5("div", { children: [
        /* @__PURE__ */ jsx5("span", { className: "gp-eyebrow", children: "YEAR PLAN" }),
        /* @__PURE__ */ jsx5("h1", { children: "\u0646\u0642\u0634\u0647\u0654 \u06CC\u06A9\u200C\u0633\u0627\u0644\u0647" }),
        /* @__PURE__ */ jsx5("p", { children: "\u0633\u0627\u0644 \u0628\u0647 \u0645\u0631\u062D\u0644\u0647\u200C\u0647\u0627\u06CC \u0642\u0627\u0628\u0644 \u0627\u062C\u0631\u0627 \u062A\u0642\u0633\u06CC\u0645 \u0634\u062F\u0647\u061B \u0647\u0631 \u0645\u0627\u0647 \u06CC\u06A9 \u062A\u0645\u0631\u06A9\u0632\u060C \u0647\u0631 \u0647\u0641\u062A\u0647 \u06CC\u06A9 \u062A\u0639\u0647\u062F \u0648 \u0647\u0631 \u0631\u0648\u0632 \u06CC\u06A9 \u0642\u062F\u0645 \u062F\u0627\u0631\u062F." }),
        /* @__PURE__ */ jsxs5("div", { className: "gp-period-hero__actions", children: [
          /* @__PURE__ */ jsxs5("button", { type: "button", className: "gp-button gp-button--primary", onClick: () => onOpenMonth?.(currentMonth?.id), children: [
            "\u0645\u0627\u0647 \u062C\u0627\u0631\u06CC ",
            /* @__PURE__ */ jsx5(ArrowIcon, {})
          ] }),
          /* @__PURE__ */ jsx5("button", { type: "button", className: "gp-button gp-button--ghost", onClick: onOpenCalendar, children: "\u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u062A\u0642\u0648\u06CC\u0645" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs5("div", { className: "gp-year-stats", children: [
        /* @__PURE__ */ jsxs5("span", { children: [
          /* @__PURE__ */ jsx5("strong", { children: toFa(yearPlan.monthCount) }),
          /* @__PURE__ */ jsx5("small", { children: "\u0645\u0627\u0647 \u0628\u0631\u0646\u0627\u0645\u0647" })
        ] }),
        /* @__PURE__ */ jsxs5("span", { children: [
          /* @__PURE__ */ jsx5("strong", { children: toFa(yearPlan.weekCount) }),
          /* @__PURE__ */ jsx5("small", { children: "\u0647\u0641\u062A\u0647 \u0628\u0631\u0646\u0627\u0645\u0647" })
        ] }),
        /* @__PURE__ */ jsxs5("span", { children: [
          /* @__PURE__ */ jsx5("strong", { children: toFa(yearPlan.taskCount) }),
          /* @__PURE__ */ jsx5("small", { children: "\u0641\u0639\u0627\u0644\u06CC\u062A \u0642\u0627\u0628\u0644 \u0631\u062F\u06CC\u0627\u0628\u06CC" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs5("section", { className: "gp-panel", children: [
      /* @__PURE__ */ jsx5(SectionHeader, { eyebrow: "ANNUAL ARC", title: "\u062F\u0648\u0627\u0632\u062F\u0647 \u0645\u0627\u0647\u060C \u062F\u0648\u0627\u0632\u062F\u0647 \u062A\u0635\u0645\u06CC\u0645", description: "\u0645\u0627\u0647\u200C\u0647\u0627 \u0628\u0631 \u0627\u0633\u0627\u0633 \u0648\u0636\u0639\u06CC\u062A \u0647\u062F\u0641 \u0648 \u0641\u0627\u0632\u0647\u0627\u06CC Curriculum \u0633\u0627\u062E\u062A\u0647 \u0634\u062F\u0647\u200C\u0627\u0646\u062F\u061B \u0628\u062F\u0648\u0646 \u067E\u0631\u06A9\u0631\u062F\u0646 \u062A\u0642\u0648\u06CC\u0645 \u0628\u0627 \u062F\u0627\u062F\u0647\u0654 \u0633\u0627\u062E\u062A\u06AF\u06CC." }),
      /* @__PURE__ */ jsx5("div", { className: "gp-month-grid", children: yearPlan.months.map((month) => /* @__PURE__ */ jsxs5("button", { type: "button", className: `gp-month-card ${month.status === "current" ? "is-current" : ""}`, onClick: () => onOpenMonth?.(month.id), children: [
        /* @__PURE__ */ jsxs5("header", { children: [
          /* @__PURE__ */ jsx5("span", { children: toFa(month.index) }),
          /* @__PURE__ */ jsx5(PeriodBadge, { status: month.status })
        ] }),
        /* @__PURE__ */ jsx5("strong", { children: month.label }),
        /* @__PURE__ */ jsx5("small", { children: month.phaseLabel }),
        /* @__PURE__ */ jsxs5("div", { className: "gp-month-card__line", children: [
          /* @__PURE__ */ jsxs5("span", { children: [
            toFa(month.taskCount),
            " \u0641\u0639\u0627\u0644\u06CC\u062A"
          ] }),
          /* @__PURE__ */ jsx5("span", { children: formatMinutes(month.plannedMinutes) })
        ] }),
        /* @__PURE__ */ jsx5("span", { className: "gp-progress", children: /* @__PURE__ */ jsx5("i", { style: { width: `${month.targetCoverage ?? Math.min(100, month.taskCount * 4)}%` } }) }),
        /* @__PURE__ */ jsx5("em", { children: month.focus })
      ] }, month.id)) })
    ] }),
    /* @__PURE__ */ jsxs5("section", { className: "gp-panel", children: [
      /* @__PURE__ */ jsx5(SectionHeader, { eyebrow: "ANNUAL SOURCES", title: "\u0633\u0647\u0645 \u0628\u062E\u0634\u200C\u0647\u0627\u06CC \u062A\u067E\u0634 \u062F\u0631 \u0633\u0627\u0644", description: "\u062A\u0641\u06A9\u06CC\u06A9 \u0628\u062E\u0634\u200C\u0647\u0627 \u062F\u0631 \u062A\u0645\u0627\u0645 \u0633\u0637\u0648\u062D \u062D\u0641\u0638 \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u0631\u0646\u06AF \u0647\u0631 \u0645\u0646\u0628\u0639 \u062F\u0631 \u062A\u0642\u0648\u06CC\u0645 \u0647\u0645 \u0647\u0645\u06CC\u0646 \u0627\u0633\u062A." }),
      /* @__PURE__ */ jsx5(SourceBars, { counts: yearPlan.months.reduce((all, month) => {
        Object.entries(month.sourceCounts ?? {}).forEach(([id, count]) => {
          all[id] = (all[id] ?? 0) + count;
        });
        return all;
      }, {}), total: yearPlan.taskCount })
    ] })
  ] });
}

// .green-path-render.mjs
var snapshot = await fetchGreenPathBundle({ id: "render-user", profile: { university: "Test", term: 4 } }, { now: /* @__PURE__ */ new Date("2026-09-17T08:00:00.000Z") });
var noop = () => {
};
var overview = renderToStaticMarkup(React.createElement(GreenPathOverview, { snapshot, onOpenOnboarding: noop, onOpenCourse: noop, onOpenTask: noop, onComplete: noop, onFocus: noop, onOpenResource: noop, onReschedule: noop, onOpenPhase: noop }));
var year = renderToStaticMarkup(React.createElement(GreenPathYearView, { snapshot, onOpenMonth: noop, onOpenCalendar: noop }));
var calendar = renderToStaticMarkup(React.createElement(GreenPathCalendar, { snapshot, month: snapshot.yearPlan.months[0].startDate.slice(0, 7), onMonthChange: noop, onSelectDate: noop, onSourceChange: noop, onOpenEvent: noop }));
for (const [name, markup] of [["overview", overview], ["year", year], ["calendar", calendar]]) {
  if (!markup || markup.length < 500) throw new Error(`${name} render too short`);
  console.log(`${name}: ${markup.length}`);
}
if (!overview.includes("\u0645\u0633\u06CC\u0631 \u062A\u0648 \u062A\u0627 \u0645\u0642\u0635\u062F")) throw new Error("overview heading missing");
if (!year.includes("\u0646\u0642\u0634\u0647\u0654 \u06CC\u06A9\u200C\u0633\u0627\u0644\u0647")) throw new Error("year heading missing");
if (!calendar.includes("\u062A\u0642\u0648\u06CC\u0645 \u0645\u0633\u06CC\u0631 \u0633\u0628\u0632")) throw new Error("calendar heading missing");
