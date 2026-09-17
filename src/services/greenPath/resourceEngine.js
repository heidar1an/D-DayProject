/* Resource abstraction مسیر سبز.
 * Task فقط به Resource شناسه‌دار وصل می‌شود؛ مقصدهای UI در یک مبدل محدود می‌مانند
 * تا تغییر ساختار صفحات، موتور برنامه‌ریزی را مجبور به بازنویسی نکند. */
import { GREEN_PATH_SECTIONS, RESOURCE_LABELS, RESOURCE_TYPES } from './greenPathConfig';

const route = (layer, view) => {
  const params = new URLSearchParams({ l: layer, v: JSON.stringify(view) });
  return `#dashboard?${params.toString()}`;
};

const resourceId = (type, topicId) => `resource:${type}:${topicId}`;
const sectionForResourceType = (type) => ({
  [RESOURCE_TYPES.MICRO_LESSON]: 'course-micro',
  [RESOURCE_TYPES.COMPREHENSIVE_LESSON]: 'course-comprehensive',
  [RESOURCE_TYPES.QUESTION_BANK]: 'test-bank',
  [RESOURCE_TYPES.WIKI]: 'wiki',
  [RESOURCE_TYPES.KNOWLEDGE_NETWORK]: 'knowledge',
  [RESOURCE_TYPES.REFERENCE]: 'reference',
  [RESOURCE_TYPES.FLASHCARD]: 'flashcards',
  [RESOURCE_TYPES.COORDINATED_EXAM]: 'coordinated-exam',
}[type] ?? 'course-micro');

const withSection = (resource) => {
  const sectionId = sectionForResourceType(resource.type);
  const section = GREEN_PATH_SECTIONS[sectionId];
  return { ...resource, sectionId, sectionLabel: section?.label ?? resourceLabel(resource.type), accent: section?.accent ?? 'var(--green-ink)' };
};

export function buildResourcesForTopic({ topic, course, knowledgeNodeId = null, now = new Date().toISOString() }) {
  const resources = [
    {
      id: resourceId(RESOURCE_TYPES.MICRO_LESSON, topic.id),
      entityType: 'Resource',
      type: RESOURCE_TYPES.MICRO_LESSON,
      title: `${topic.title} — مرور سریع`,
      courseId: course.id,
      topicId: topic.id,
      entityId: topic.id,
      route: route('course-micro', { filter: 'all', subject: course.id, deep: { topicId: topic.id } }),
      metadata: { minutes: 12, action: 'learn' },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: resourceId(RESOURCE_TYPES.COMPREHENSIVE_LESSON, topic.id),
      entityType: 'Resource',
      type: RESOURCE_TYPES.COMPREHENSIVE_LESSON,
      title: `${course.title} — ${topic.title}`,
      courseId: course.id,
      topicId: topic.id,
      entityId: topic.id,
      route: route('course-comprehensive', { deep: { subject: course.id, topicId: topic.id } }),
      metadata: { section: topic.path.join(' › '), action: 'learn' },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: resourceId(RESOURCE_TYPES.QUESTION_BANK, topic.id),
      entityType: 'Resource',
      type: RESOURCE_TYPES.QUESTION_BANK,
      title: `تست ${topic.title}`,
      courseId: course.id,
      topicId: topic.id,
      entityId: topic.id,
      route: route('test-bank', { name: 'topics', subjectId: course.id, topicPath: topic.path }),
      metadata: { count: topic.questionCount, action: 'practice' },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: resourceId(RESOURCE_TYPES.WIKI, topic.id),
      entityType: 'Resource',
      type: RESOURCE_TYPES.WIKI,
      title: `ویکی تپش — ${topic.title}`,
      courseId: course.id,
      topicId: topic.id,
      entityId: topic.title,
      route: route('wiki', { mode: 'results', query: topic.title, filters: {}, sort: 'relevance' }),
      metadata: { action: 'clarify' },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: resourceId(RESOURCE_TYPES.KNOWLEDGE_NETWORK, topic.id),
      entityType: 'Resource',
      type: RESOURCE_TYPES.KNOWLEDGE_NETWORK,
      title: 'ارتباط در شبکه دانش',
      courseId: course.id,
      topicId: topic.id,
      entityId: knowledgeNodeId,
      route: route('knowledge', { mode: 'graph', topicId: knowledgeNodeId, selectedId: knowledgeNodeId }),
      metadata: { action: 'integrate', optional: !knowledgeNodeId },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: resourceId(RESOURCE_TYPES.REFERENCE, topic.id),
      entityType: 'Resource',
      type: RESOURCE_TYPES.REFERENCE,
      title: `رفرنس پیشنهادی — ${topic.title}`,
      courseId: course.id,
      topicId: topic.id,
      entityId: course.id === 'physiology' ? 'guyton' : course.id === 'anatomy' ? 'gray' : course.id === 'histology' ? 'junqueira' : null,
      route: route('course-reference', { mode: 'shelf', topicId: topic.id }),
      metadata: { action: 'deep-dive', recommendation: topic.importance >= 4 ? 'essential' : 'recommended' },
      createdAt: now,
      updatedAt: now,
    },
  ];

  return resources.map(withSection);
}

export function resourceLabel(type) {
  return RESOURCE_LABELS[type] ?? type;
}

export function resourcesById(resources = []) {
  return new Map(resources.map((resource) => [resource.id, resource]));
}

export function getResource(resources, resourceIdValue) {
  return resources.find((resource) => resource.id === resourceIdValue) ?? null;
}

export const buildResourceRoute = route;
