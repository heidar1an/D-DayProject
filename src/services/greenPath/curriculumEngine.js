/*
 * موتور Curriculum Graph مسیر سبز.
 *
 * منبع اصلی درخت، همان TOPIC_TREE بانک تست تپش است؛ بنابراین مسیر سبز دروس و
 * مباحث را دوباره به‌صورت لیست موازی تعریف نمی‌کند. نودهای شبکه دانش فقط برای
 * افزودن وابستگی و اتصال بین‌درسی استفاده می‌شوند.
 */
import { SUBJECTS, QUESTIONS, TOPIC_TREE } from '../testBank/mockData';
import { KNOWLEDGE_NODES } from '../knowledge/graphData';

const normalize = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const slug = (value) =>
  normalize(value)
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '') || 'topic';

const topicIdOf = (courseId, title, index) => `${courseId}:${slug(title)}:${index}`;

const questionCounts = QUESTIONS.reduce((map, question) => {
  const path = question.topicPath ?? [];
  if (!path.length) return map;
  const courseId = question.subject;
  const parent = `${courseId}|${normalize(path[0])}`;
  const leaf = `${parent}|${normalize(path[path.length - 1])}`;
  map.set(parent, (map.get(parent) ?? 0) + 1);
  map.set(leaf, (map.get(leaf) ?? 0) + 1);
  return map;
}, new Map());

const findKnowledgeNode = (courseId, title) => {
  const wanted = normalize(title);
  return KNOWLEDGE_NODES.find((node) => {
    const titleMatches = [node.title, node.englishTitle, ...(node.keywords ?? []), ...(node.aliases ?? [])]
      .map(normalize)
      .some((term) => term && (term === wanted || term.includes(wanted) || wanted.includes(term)));
    return titleMatches && (!courseId || (node.courses ?? []).includes(courseId));
  }) ?? null;
};

const importanceFrom = (questionCount, knowledgeNode) => {
  const questionImportance = questionCount >= 8 ? 5 : questionCount >= 4 ? 4 : questionCount >= 2 ? 3 : 2;
  return Math.max(questionImportance, knowledgeNode?.importance ?? 1);
};

function buildCourseTopics(courseId, entries, now) {
  const topics = [];
  const topicIds = [];
  let order = 0;

  entries.forEach((entry, parentIndex) => {
    const parentId = topicIdOf(courseId, entry.name, parentIndex);
    const parentQuestions = questionCounts.get(`${courseId}|${normalize(entry.name)}`) ?? 0;
    const parentNode = findKnowledgeNode(courseId, entry.name);
    const parent = {
      id: parentId,
      entityType: 'CourseTopic',
      courseId,
      title: entry.name,
      path: [entry.name],
      parentId: null,
      depth: 0,
      order: order++,
      weight: Math.max(1, parentQuestions || entry.children?.length || 1),
      importance: importanceFrom(parentQuestions, parentNode),
      difficulty: parentNode?.difficulty ?? 'متوسط',
      knowledgeNodeId: parentNode?.id ?? null,
      prerequisiteTopicIds: [],
      estimatedMinutes: Math.max(28, 24 + parentQuestions * 3),
      questionCount: parentQuestions,
      createdAt: now,
      updatedAt: now,
    };
    topics.push(parent);
    topicIds.push(parentId);

    (entry.children ?? []).forEach((childTitle, childIndex) => {
      const childId = topicIdOf(courseId, `${entry.name}-${childTitle}`, childIndex);
      const childQuestions = questionCounts.get(`${courseId}|${normalize(entry.name)}|${normalize(childTitle)}`) ?? 0;
      const childNode = findKnowledgeNode(courseId, childTitle) ?? parentNode;
      const child = {
        id: childId,
        entityType: 'Subtopic',
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
        createdAt: now,
        updatedAt: now,
      };
      topics.push(child);
      topicIds.push(childId);
    });
  });

  return { topics, topicIds };
}

export function buildCurriculumGraph({ now = new Date().toISOString() } = {}) {
  const courses = [];
  const topics = [];
  const topicIdsByKnowledgeNode = new Map();

  SUBJECTS.forEach((subject, courseIndex) => {
    const sourceEntries = TOPIC_TREE[subject.id] ?? [];
    const built = buildCourseTopics(subject.id, sourceEntries, now);
    const course = {
      id: subject.id,
      entityType: 'Course',
      title: subject.name,
      track: 'medicine',
      order: courseIndex,
      topicIds: built.topicIds,
      topicCount: built.topics.length,
      importance: built.topics.length ? Math.max(...built.topics.map((topic) => topic.importance)) : 1,
      createdAt: now,
      updatedAt: now,
    };
    courses.push(course);
    topics.push(...built.topics);
    built.topics.forEach((topic) => {
      if (topic.knowledgeNodeId) topicIdsByKnowledgeNode.set(topic.knowledgeNodeId, topic.id);
    });
  });

  const topicById = new Map(topics.map((topic) => [topic.id, topic]));

  /* وابستگی‌های cross-course از prerequisites شبکه دانش به Topicهای واقعی نگاشت می‌شوند. */
  topics.forEach((topic) => {
    const node = KNOWLEDGE_NODES.find((candidate) => candidate.id === topic.knowledgeNodeId);
    const mappedPrerequisites = (node?.prerequisites ?? [])
      .map((nodeId) => topicIdsByKnowledgeNode.get(nodeId))
      .filter(Boolean);
    const previousSameCourse = topics
      .filter((candidate) => candidate.courseId === topic.courseId && candidate.order < topic.order)
      .sort((a, b) => b.order - a.order)[0];

    const prerequisites = [...new Set([
      ...topic.prerequisiteTopicIds,
      ...mappedPrerequisites,
      ...(previousSameCourse && topic.depth === 0 ? [previousSameCourse.id] : []),
    ])].filter((id) => id !== topic.id && topicById.has(id));

    topic.prerequisiteTopicIds = prerequisites;
  });

  const edges = topics.flatMap((topic) =>
    topic.prerequisiteTopicIds.map((source) => ({
      id: `${source}->${topic.id}`,
      source,
      target: topic.id,
      type: 'prerequisite',
    })),
  );

  return {
    entityType: 'CurriculumGraph',
    courses,
    topics,
    topicById,
    courseById: new Map(courses.map((course) => [course.id, course])),
    edges,
    stats: {
      courseCount: courses.length,
      topicCount: topics.length,
      edgeCount: edges.length,
    },
  };
}

export function topologicalTopics(graph) {
  const remaining = new Map(graph.topics.map((topic) => [topic.id, new Set(topic.prerequisiteTopicIds)]));
  const ordered = [];

  while (remaining.size) {
    const ready = [...remaining.entries()]
      .filter(([, dependencies]) => [...dependencies].every((id) => ordered.some((topic) => topic.id === id)))
      .map(([id]) => id);

    if (!ready.length) {
      /* داده ناقص نباید موتور را متوقف کند؛ کم‌عمق‌ترین مبحث بعدی را برمی‌داریم. */
      const fallback = [...remaining.keys()][0];
      ready.push(fallback);
    }

    ready.forEach((id) => {
      const topic = graph.topicById.get(id);
      if (topic) ordered.push(topic);
      remaining.delete(id);
    });
  }

  return ordered;
}

export const curriculumSlug = slug;
export const curriculumNormalize = normalize;
