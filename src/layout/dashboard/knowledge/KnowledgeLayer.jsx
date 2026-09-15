/* ── لایهٔ «شبکهٔ دانش» — پوستهٔ اصلی feature ──
   یک ماشین حالت ساده:
     mode      → گراف | درخت | موضوعات | درس‌ها | مسیر
     topicId   → صفحهٔ اختصاصی موضوع (روی هر modeای سوار می‌شود و Back برمی‌گرداند)
     selectedId→ پنل جزئیات در نمای گراف
   Escape: بستن موضوع → لغو انتخاب → خروج از لایه.
   داده با useAsyncData (لودینگ/خطا/تلاش مجدد) بارگذاری می‌شود. */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAsyncData } from '../league/useAsyncData';
import * as api from '../../../services/knowledge/knowledgeService';
import { COURSES } from '../../../services/knowledge/graphData';
import GraphView from './GraphView';
import NodeDetailPanel from './NodeDetailPanel';
import TopicPage from './TopicPage';
import TreeView from './TreeView';
import TopicsView from './TopicsView';
import CourseView from './CourseView';
import PathView from './PathView';
import KnowledgeSearchBar from './KnowledgeSearchBar';
import { LAYER_IDS, useLayerRoute } from '../dashboardRoute';
import {
  GraphSkeleton,
  ErrorState,
  KnBackButton,
  KnButton,
  faCount,
} from './knowledgeShared';
import './knowledge.css';

/* نمای آغازین لایه: تب گراف، بدون مبحث باز و بدون انتخاب */
const KNOWLEDGE_VIEW = { mode: 'graph', topicId: null, selectedId: null };

const VIEW_TABS = [
  { id: 'graph', label: 'گراف' },
  { id: 'tree', label: 'درخت' },
  { id: 'topics', label: 'موضوعات' },
  { id: 'courses', label: 'درس‌ها' },
  { id: 'paths', label: 'مسیر' },
];

const DEPTH_OPTIONS = [
  { value: 1, label: '۱ هاپ' },
  { value: 2, label: '۲ هاپ' },
  { value: 3, label: '۳ هاپ' },
];

export default function KnowledgeLayer({ userData, onBack }) {
  const { data, loading, error, retry } = useAsyncData(() => api.getGraph(), []);

  /* نمای لایه (تب شبکه/درخت/… و صفحهٔ مبحث) روی مسیر داشبورد می‌نشیند:
     رفرش همان تب و همان مبحث را برمی‌گرداند و Back مراحل را عقب می‌رود. */
  const [view, , patchView] = useLayerRoute(LAYER_IDS.knowledge, KNOWLEDGE_VIEW, {
    screenOf: (current) => (current?.topicId ? `topic:${current.topicId}` : current?.mode ?? 'graph'),
  });
  const { mode, topicId, selectedId } = view;
  const setMode = useCallback((next) => patchView({ mode: next }), [patchView]);
  const setTopicId = useCallback((next) => patchView({ topicId: next }), [patchView]);
  const setSelectedId = useCallback((next) => patchView({ selectedId: next }), [patchView]);
  const [focusToken, setFocusToken] = useState(0);
  const [courseFilter, setCourseFilter] = useState(() => new Set());
  const [depth, setDepth] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [expandedIds, setExpandedIds] = useState([]);
  const [progressVersion, setProgressVersion] = useState(0);

  const userId = userData?.phone ?? userData?.id ?? null;

  /* وضعیت یادگیری کاربر — با تغییر نسخه دوباره خوانده می‌شود */
  const progressMap = useMemo(() => {
    void progressVersion;
    return api.getProgress(userId);
  }, [userId, progressVersion]);

  const refreshProgress = useCallback(() => setProgressVersion((version) => version + 1), []);

  /* Escape: لایه‌به‌لایه به عقب */
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (topicId) {
        setTopicId(null);
        return;
      }
      if (selectedId) {
        setSelectedId(null);
        return;
      }
      onBack?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [topicId, selectedId, onBack]);

  const handleSelect = useCallback((node) => {
    setSelectedId(node?.id ?? null);
    if (node) setFocusToken((token) => token + 1);
  }, []);

  /* انتخاب از جست‌وجو: فوکوس دوربین + باز شدن پنل */
  const handleSearchSelect = useCallback(
    (node) => {
      setSelectedId(node.id);
      setFocusToken((token) => token + 1);
    },
    [],
  );

  const handleEnterTopic = useCallback((nodeOrId) => {
    const id = typeof nodeOrId === 'string' ? nodeOrId : nodeOrId?.id;
    if (!id) return;
    setTopicId(id);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const handleExpand = useCallback((nodeId) => {
    if (!nodeId) return;
    setExpandedIds((ids) => (ids.includes(nodeId) ? ids : [...ids, nodeId]));
  }, []);

  const toggleCourse = useCallback((courseId) => {
    setCourseFilter((current) => {
      const next = new Set(current);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  }, []);

  if (loading) {
    return (
      <section className="kn-layer" dir="rtl" aria-label="شبکهٔ دانش">
        <div className="kn-layer__inner">
          <LayerIntro stats={null} />
          <GraphSkeleton />
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="kn-layer" dir="rtl" aria-label="شبکهٔ دانش">
        <div className="kn-layer__inner">
          <LayerIntro stats={null} />
          <ErrorState
            title="شبکهٔ دانش بارگذاری نشد"
            description="اتصال را بررسی کنید و دوباره تلاش کنید؛ داده‌های شبکه روی همین دستگاه هم ذخیره می‌شوند."
            onRetry={retry}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="kn-layer" dir="rtl" aria-label="شبکهٔ دانش — نقشهٔ زندهٔ دانش پزشکی">
      <div className="kn-layer__inner">
        <LayerIntro stats={data.stats} />

        {topicId ? (
          <TopicPage
            nodeId={topicId}
            userId={userId}
            progressMap={progressMap}
            onProgressChange={refreshProgress}
            onOpenNode={handleEnterTopic}
            onBack={() => setTopicId(null)}
            onSelect={(nodeId) => {
              setTopicId(null);
              setSelectedId(nodeId);
              setFocusToken((token) => token + 1);
              setMode('graph');
            }}
          />
        ) : (
          <>
            <div className="kn-toolbar">
              <div className="kn-toolbar__views" role="tablist" aria-label="نمایش شبکه">
                {VIEW_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={mode === tab.id}
                    className={`kn-toolbar__view ${mode === tab.id ? 'is-active' : ''}`}
                    onClick={() => setMode(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <KnowledgeSearchBar onSelect={handleSearchSelect} />
            </div>

            {mode === 'graph' ? (
              <div className={`kn-graph-zone ${selectedId ? 'has-panel' : ''}`}>
                <div className="kn-graph-side">
                  <div className="kn-filters" role="group" aria-label="فیلتر بر اساس درس">
                    <span className="kn-filters__title">درس‌ها</span>
                    <div className="kn-filters__chips">
                      <button
                        type="button"
                        className={`kn-chip kn-chip--action ${courseFilter.size === 0 ? 'is-active' : ''}`}
                        onClick={() => setCourseFilter(new Set())}
                      >
                        همه
                      </button>
                      {COURSES.map((course) => (
                        <button
                          key={course.id}
                          type="button"
                          className={`kn-chip kn-chip--action ${courseFilter.has(course.id) ? 'is-active' : ''}`}
                          style={{ '--accent': course.accent }}
                          aria-pressed={courseFilter.has(course.id)}
                          onClick={() => toggleCourse(course.id)}
                        >
                          {course.label}
                          <small>{faCount(data.stats.byCourse[course.id] ?? 0)}</small>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="kn-depth" role="group" aria-label="عمق اکتشاف ارتباطات">
                    <span className="kn-filters__title">اکتشاف ارتباطات</span>
                    <div className="kn-depth__options">
                      {DEPTH_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`kn-depth__option ${depth === option.value ? 'is-active' : ''}`}
                          aria-pressed={depth === option.value}
                          onClick={() => setDepth(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <KnButton
                    className="kn-showall"
                    variant={showAll ? 'kn-button--accent' : ''}
                    onClick={() => setShowAll((value) => !value)}
                  >
                    {showAll ? 'نمایش مفاهیم اصلی' : 'نمایش کامل شبکه'}
                  </KnButton>
                </div>

                <GraphView
                  nodes={data.nodes}
                  edges={data.edges}
                  selectedId={selectedId}
                  onSelect={handleSelect}
                  onEnterTopic={handleEnterTopic}
                  courseFilter={courseFilter}
                  expandDepth={depth}
                  showAll={showAll}
                  progressMap={progressMap}
                  focusToken={focusToken}
                  onExpand={handleExpand}
                  expandedIds={expandedIds}
                />

                {selectedId ? (
                  <NodeDetailPanel
                    nodeId={selectedId}
                    userId={userId}
                    progressMap={progressMap}
                    onProgressChange={refreshProgress}
                    onOpenNode={(nodeId) => {
                      setSelectedId(nodeId);
                      setFocusToken((token) => token + 1);
                    }}
                    onEnterTopic={handleEnterTopic}
                    onExpand={handleExpand}
                    onClose={() => setSelectedId(null)}
                  />
                ) : null}
              </div>
            ) : null}

            {mode === 'tree' ? (
              <TreeView
                rootNodeId={selectedId}
                onOpenNode={handleEnterTopic}
                onSelect={(nodeId) => {
                  setSelectedId(nodeId);
                  setMode('graph');
                }}
              />
            ) : null}

            {mode === 'topics' ? (
              <TopicsView
                progressMap={progressMap}
                onOpenNode={handleEnterTopic}
                onEnterTopic={handleEnterTopic}
              />
            ) : null}

            {mode === 'courses' ? (
              <CourseView onOpenNode={handleEnterTopic} onEnterTopic={handleEnterTopic} />
            ) : null}

            {mode === 'paths' ? (
              <PathView
                progressMap={progressMap}
                onOpenNode={handleEnterTopic}
                onEnterTopic={handleEnterTopic}
              />
            ) : null}
          </>
        )}

        {!topicId ? (
          <div className="kn-layer__exit">
            <KnBackButton onClick={onBack}>خروج از شبکهٔ دانش</KnBackButton>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* سربرگ معرفی لایه — آمار زنده از خود شبکه */
function LayerIntro({ stats }) {
  return (
    <header className="kn-intro">
      <div>
        <h1>
          شبکهٔ دانش
          <small>نقشهٔ زندهٔ دانش پزشکی</small>
        </h1>
        <p>
          موضوعات پزشکی از هم جدا نیستند؛ این‌جا دانش را بر اساس ارتباط میان مفاهیم می‌بینی —
          از پانکراس تا انسولین تا گلیکولیز تا دیابت، همه یک شبکه‌اند.
        </p>
      </div>

      {stats ? (
        <dl className="kn-intro__stats">
          <div>
            <dt>مفهوم</dt>
            <dd>{faCount(stats.nodes)}</dd>
          </div>
          <div>
            <dt>ارتباط علمی</dt>
            <dd>{faCount(stats.edges)}</dd>
          </div>
          <div>
            <dt>مفهوم بین‌درسی</dt>
            <dd>{faCount(stats.interdisciplinary)}</dd>
          </div>
        </dl>
      ) : (
        <div className="kn-intro__stats kn-intro__stats--loading" aria-hidden="true">
          <span /><span /><span />
        </div>
      )}
    </header>
  );
}
