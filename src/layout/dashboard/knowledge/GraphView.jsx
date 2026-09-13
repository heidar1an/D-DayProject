/* ── Graph View — قلب شبکه دانش ──
   گراف SVG تعاملی بدون وابستگی خارجی:
     · Zoom با چرخ موس (روی نشانگر) + دکمه‌ها، Pan با درگ پس‌زمینه، Pinch دو‌انگشتی
     · درگ نودها، Hover با هایلایت همسایه‌ها، Click انتخاب، Double-Click ورود به موضوع
     · Tooltip نوع رابطه روی یال هنگام hover
     · فیلتر درس (کم‌رنگ‌شدن نه حذف) + عمق اکتشاف ۱ تا ۳ هاپ
     · Progressive Disclosure: در نمای پیش‌فرض فقط مفاهیم اصلی دیده می‌شوند؛
       «نمایش شاخه‌ها» همسایه‌های نود انتخاب‌شده را به شبکه اضافه می‌کند.
   دوربین با lerp نرم حرکت می‌کند و به prefers-reduced-motion احترام می‌گذارد. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GRAPH,
  LAYOUT,
  courseAccent,
  primaryCourse,
  nodeStatus,
  statusAccent,
  STATUS_META,
} from '../../../services/knowledge/knowledgeService';
import { getNeighborhood, nodeRadius } from '../../../services/knowledge/graphModel';
import { relationLabel } from '../../../services/knowledge/graphData';
import { ZoomInIcon, ZoomOutIcon, FitIcon, ResetIcon, ExpandIcon } from './knowledgeIcons';
import { faCount } from './knowledgeShared';

const MIN_ZOOM = 0.28;
const MAX_ZOOM = 2.6;
const LABEL_MIN_ZOOM = 0.52;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function GraphView({
  nodes,
  edges,
  selectedId,
  onSelect,
  onEnterTopic,
  courseFilter,
  expandDepth = 1,
  showAll = false,
  progressMap = {},
  focusToken = 0,
  onExpand,
  expandedIds,
}) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const cameraRef = useRef({ x: 0, y: 0, k: 0.9 });
  const [cameraTick, setCameraTick] = useState(0);
  const [hoverNodeId, setHoverNodeId] = useState(null);
  const [hoverEdgeId, setHoverEdgeId] = useState(null);
  const [dragging, setDragging] = useState(false);

  /* جابه‌جایی‌های کاربر روی نودها — لایهٔ روی layout پایه */
  const posOverridesRef = useRef(new Map());
  const [posVersion, setPosVersion] = useState(0);
  const nodeDragRef = useRef(null);
  const panRef = useRef(null);
  const pinchRef = useRef(null);
  const pointersRef = useRef(new Map());
  const animationRef = useRef(0);
  const didInitFitRef = useRef(false);
  const suppressClickRef = useRef(false);

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const positions = useCallback(
    (id) => {
      const override = posOverridesRef.current.get(id);
      if (override) return override;
      return LAYOUT.positions[id] ?? { x: 0, y: 0 };
    },
    [posVersion],
  );

  /* ── مجموعهٔ هایلایت: نود انتخاب‌شده + همسایه‌ها تا عمق expandDepth ── */
  const highlight = useMemo(() => {
    if (!selectedId) return null;
    const { nodeSet, edges: innerEdges } = getNeighborhood(GRAPH, selectedId, Math.max(1, expandDepth));
    return { nodeSet, edgeSet: new Set(innerEdges.map((edge) => edgeKey(edge))) };
  }, [selectedId, expandDepth]);

  const hoveredHighlight = useMemo(() => {
    if (!hoverNodeId) return null;
    const { nodeSet, edges: innerEdges } = getNeighborhood(GRAPH, hoverNodeId, 1);
    return { nodeSet, edgeSet: new Set(innerEdges.map((edge) => edgeKey(edge))) };
  }, [hoverNodeId]);

  /* ── کدام نودها دیده شوند (Progressive Disclosure) ── */
  const visibleNodes = useMemo(() => {
    if (showAll) return nodes;
    const hub = nodes.filter((node) => node.importance >= 4);
    const visible = new Set(hub.map((node) => node.id));
    (expandedIds ?? []).forEach((id) => {
      const { nodeSet } = getNeighborhood(GRAPH, id, Math.max(1, expandDepth));
      nodeSet.forEach((nodeId) => visible.add(nodeId));
    });
    if (selectedId) {
      const { nodeSet } = getNeighborhood(GRAPH, selectedId, Math.max(1, expandDepth));
      nodeSet.forEach((nodeId) => visible.add(nodeId));
    }
    return nodes.filter((node) => visible.has(node.id));
  }, [nodes, showAll, expandedIds, selectedId, expandDepth]);

  const visibleIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);

  const visibleEdges = useMemo(
    () => edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)),
    [edges, visibleIds],
  );

  /* شمارندهٔ همسایه‌های پنهان برای نشان +N */
  const hiddenNeighborCount = useCallback(
    (nodeId) =>
      GRAPH.neighborsOf(nodeId).filter(({ node }) => !visibleIds.has(node.id) && node.importance < 4).length,
    [visibleIds],
  );

  /* ── دوربین ── */
  const applyCamera = () => setCameraTick((tick) => tick + 1);

  const animateCameraTo = useCallback((target, { duration = 420 } = {}) => {
    cancelAnimationFrame(animationRef.current);
    const start = { ...cameraRef.current };
    if (prefersReducedMotion()) {
      cameraRef.current = { ...target };
      applyCamera();
      return;
    }
    const startTime = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);

    const step = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      const e = ease(t);
      cameraRef.current = {
        x: start.x + (target.x - start.x) * e,
        y: start.y + (target.y - start.y) * e,
        k: start.k + (target.k - start.k) * e,
      };
      applyCamera();
      if (t < 1) animationRef.current = requestAnimationFrame(step);
    };
    animationRef.current = requestAnimationFrame(step);
  }, []);

  /* اندازهٔ فعلی کانتینر */
  const viewSize = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    return { w: rect?.width ?? 800, h: rect?.height ?? 560 };
  }, []);

  const fitToNodes = useCallback(
    (nodeIds, { animate = true } = {}) => {
      const list = nodeIds?.length ? nodeIds : visibleNodes.map((node) => node.id);
      if (list.length === 0) return;
      const points = list.map((id) => positions(id));
      const minX = Math.min(...points.map((p) => p.x));
      const maxX = Math.max(...points.map((p) => p.x));
      const minY = Math.min(...points.map((p) => p.y));
      const maxY = Math.max(...points.map((p) => p.y));
      const { w, h } = viewSize();
      const k = clamp(
        Math.min(w / (maxX - minX + 160), h / (maxY - minY + 160)),
        MIN_ZOOM,
        MAX_ZOOM,
      );
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const target = { x: w / 2 - cx * k, y: h / 2 - cy * k, k };
      if (animate) animateCameraTo(target);
      else {
        cameraRef.current = target;
        applyCamera();
      }
    },
    [visibleNodes, positions, viewSize, animateCameraTo],
  );

  /* بار اول: فیت روی نودهای نمایان — سینک و بدون rAF تا cleanup دوبار‌اجرای
     StrictMode نتواند فیت اولیه را لغو کند (همان دامِ شناخته‌شدهٔ داشبورد) */
  useEffect(() => {
    if (didInitFitRef.current || visibleNodes.length === 0) return;
    if (!containerRef.current) return;
    didInitFitRef.current = true;
    fitToNodes(null, { animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleNodes.length]);

  /* فوکوس نود (از جست‌وجو/انتخاب) */
  const lastFocusTokenRef = useRef(focusToken);
  useEffect(() => {
    if (focusToken === lastFocusTokenRef.current || !selectedId) return undefined;
    lastFocusTokenRef.current = focusToken;
    const position = positions(selectedId);
    const { w, h } = viewSize();
    animateCameraTo({ x: w / 2 - position.x * 1.35, y: h / 2 - position.y * 1.35, k: 1.35 });
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken, selectedId]);

  /* چرخ موس: زوم روی نشانگر */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const handleWheel = (event) => {
      event.preventDefault();
      const { w, h } = viewSize();
      const rect = svg.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const cam = cameraRef.current;
      const wx = (px - cam.x) / cam.k;
      const wy = (py - cam.y) / cam.k;
      const factor = Math.exp(-event.deltaY * 0.0016);
      const k = clamp(cam.k * factor, MIN_ZOOM, MAX_ZOOM);
      cameraRef.current = { x: px - wx * k, y: py - wy * k, k };
      applyCamera();
    };
    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [viewSize]);

  useEffect(() => () => cancelAnimationFrame(animationRef.current), []);

  /* ── تعامل اشاره‌گر: pan / drag نود / pinch ── */
  const handlePointerDown = (event) => {
    const isBackground = event.target.dataset?.role === 'graph-background';
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 2) {
      /* شروع pinch */
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        k: cameraRef.current.k,
      };
      panRef.current = null;
      nodeDragRef.current = null;
      return;
    }

    const nodeId = event.target.closest?.('[data-node-id]')?.dataset.nodeId;
    if (nodeId && !isBackground) {
      const position = positions(nodeId);
      const cam = cameraRef.current;
      nodeDragRef.current = { id: nodeId, moved: false, offset: { x: position.x, y: position.y } };
      setDragging(true);
      svgRef.current?.setPointerCapture?.(event.pointerId);
      return;
    }

    if (isBackground) {
      panRef.current = { x: event.clientX, y: event.clientY, moved: false };
      svgRef.current?.setPointerCapture?.(event.pointerId);
    }
  };

  const handlePointerMove = (event) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    /* pinch zoom */
    if (pinchRef.current && pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const cam = cameraRef.current;
      const { w, h } = viewSize();
      const cx = (w / 2 - cam.x) / cam.k;
      const cy = (h / 2 - cam.y) / cam.k;
      const k = clamp(cam.k * (distance / pinchRef.current.distance), MIN_ZOOM, MAX_ZOOM);
      cameraRef.current = { x: w / 2 - cx * k, y: h / 2 - cy * k, k };
      pinchRef.current = { distance, k };
      applyCamera();
      return;
    }

    /* درگ نود */
    if (nodeDragRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const cam = cameraRef.current;
      const drag = nodeDragRef.current;
      const wx = (event.clientX - rect.left - cam.x) / cam.k;
      const wy = (event.clientY - rect.top - cam.y) / cam.k;
      const start = LAYOUT.positions[drag.id] ?? { x: 0, y: 0 };
      if (
        !drag.moved &&
        Math.hypot(wx - drag.offset.x, wy - drag.offset.y) < 3 / cam.k
      ) {
        return;
      }
      drag.moved = true;
      posOverridesRef.current.set(drag.id, { x: wx, y: wy });
      setPosVersion((version) => version + 1);
      return;
    }

    /* pan */
    if (panRef.current) {
      const dx = event.clientX - panRef.current.x;
      const dy = event.clientY - panRef.current.y;
      panRef.current.x = event.clientX;
      panRef.current.y = event.clientY;
      panRef.current.moved = panRef.current.moved || Math.hypot(dx, dy) > 4;
      cameraRef.current = { ...cameraRef.current, x: cameraRef.current.x + dx, y: cameraRef.current.y + dy };
      applyCamera();
    }
  };

  const handlePointerUp = (event) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;

    if (nodeDragRef.current) {
      const drag = nodeDragRef.current;
      nodeDragRef.current = null;
      setDragging(false);
      if (!drag.moved) {
        /* کلیک بدون حرکت = انتخاب نود */
        onSelect?.(nodeById.get(drag.id) ?? null);
      }
      return;
    }
    /* pan تمام‌شده: اگر واقعاً حرکت کرده بود، کلیکِ بعدی نباید انتخاب را لغو کند */
    suppressClickRef.current = Boolean(panRef.current?.moved);
    panRef.current = null;
  };

  const handleClick = (event) => {
    /* کلیک روی پس‌زمینه بدون حرکت = لغو انتخاب (pan واقعی لغو نمی‌کند) */
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (event.target.dataset?.role === 'graph-background') {
      onSelect?.(null);
    }
  };

  const handleDoubleClick = (event) => {
    const nodeId = event.target.closest?.('[data-node-id]')?.dataset.nodeId;
    if (nodeId) onEnterTopic?.(nodeById.get(nodeId));
  };

  /* دکمه‌های کنترل */
  const zoomBy = (factor) => {
    const { w, h } = viewSize();
    const cam = cameraRef.current;
    const cx = (w / 2 - cam.x) / cam.k;
    const cy = (h / 2 - cam.y) / cam.k;
    const k = clamp(cam.k * factor, MIN_ZOOM, MAX_ZOOM);
    animateCameraTo({ x: w / 2 - cx * k, y: h / 2 - cy * k, k }, { duration: 220 });
  };

  const resetView = () => {
    posOverridesRef.current.clear();
    setPosVersion((version) => version + 1);
    fitToNodes(null);
  };

  /* ── رندر ── */
  const cam = cameraRef.current;
  void cameraTick; /* رندر با هر تغییر دوربین دوباره اجرا شود */

  const labelScale = cam.k < LABEL_MIN_ZOOM ? Math.min(1 / cam.k, 1.9) : 1 / cam.k;
  const showLabels = cam.k >= LABEL_MIN_ZOOM;

  const activeFilter = courseFilter && courseFilter.size > 0 ? courseFilter : null;

  const nodeState = (nodeId) => {
    if (selectedId === nodeId) return 'selected';
    if (hoverNodeId === nodeId) return 'hover';
    if (highlight?.nodeSet.has(nodeId)) return 'neighbor';
    if (hoveredHighlight?.nodeSet.has(nodeId)) return 'neighbor';
    if (highlight || hoveredHighlight) return 'dim';
    return 'normal';
  };

  const edgeState = (edge) => {
    const key = edgeKey(edge);
    if (hoverEdgeId === key) return 'hover';
    if (highlight?.edgeSet.has(key)) return 'neighbor';
    if (hoveredHighlight?.edgeSet.has(key)) return 'neighbor';
    if (highlight || hoveredHighlight) return 'dim';
    return 'normal';
  };

  const nodeFadedByFilter = (node) => activeFilter && !node.courses.some((c) => activeFilter.has(c));

  return (
    <div className={`kn-graph ${dragging ? 'is-dragging' : ''}`} ref={containerRef}>
      <svg
        ref={svgRef}
        className="kn-graph__svg"
        role="application"
        aria-label="نقشهٔ تعاملی شبکه دانش — با درگ جابه‌جا و با چرخ موس زوم کنید"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <defs>
          <radialGradient id="kn-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(91,140,199,0.16)" />
            <stop offset="100%" stopColor="rgba(91,140,199,0)" />
          </radialGradient>
        </defs>

        <rect
          data-role="graph-background"
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="transparent"
        />

        <g transform={`translate(${cam.x},${cam.y}) scale(${cam.k})`}>
          <circle cx={LAYOUT.width / 2} cy={LAYOUT.height / 2} r={340} fill="url(#kn-glow)" />

          <g className="kn-graph__edges">
            {visibleEdges.map((edge) => {
              const from = positions(edge.source);
              const to = positions(edge.target);
              const state = edgeState(edge);
              const accent =
                state === 'normal' || state === 'dim'
                  ? 'rgba(255,255,255,0.16)'
                  : courseAccent(primaryCourse(nodeById.get(edge.target))) ;
              const isDim = state === 'dim' || nodeFadedByFilter(nodeById.get(edge.source)) || nodeFadedByFilter(nodeById.get(edge.target));
              const isDirected = ['causes', 'produces', 'activates', 'leads_to', 'part_of', 'regulates'].includes(edge.type);
              return (
                <g key={edgeKey(edge)} className={`kn-edge is-${state} ${isDim ? 'is-filtered' : ''}`}>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={isDim ? 'rgba(255,255,255,0.05)' : accent}
                    strokeWidth={state === 'hover' ? 2.4 : state === 'neighbor' ? 2 : 1.4}
                    markerEnd={isDirected && !isDim ? `url(#kn-arrow-${state === 'normal' ? 'base' : 'hot'})` : undefined}
                  />
                  {/* ناحیهٔ hover پهن و نامرئی برای یال */}
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke="transparent"
                    strokeWidth={14}
                    onPointerEnter={() => setHoverEdgeId(edgeKey(edge))}
                    onPointerLeave={() => setHoverEdgeId(null)}
                  />
                  {state === 'hover' ? (
                    <EdgeLabel from={from} to={to} label={relationLabel(edge.type)} scale={labelScale} />
                  ) : null}
                </g>
              );
            })}
          </g>

          <g className="kn-graph__nodes">
            {visibleNodes.map((node) => {
              const position = positions(node.id);
              const radius = nodeRadius(node, GRAPH.degreeOf(node.id));
              const state = nodeState(node.id);
              const accent = courseAccent(primaryCourse(node));
              const status = nodeStatus(progressMap, node.id);
              const faded = nodeFadedByFilter(node);
              const hidden = hiddenNeighborCount(node.id);
              return (
                <g
                  key={node.id}
                  data-node-id={node.id}
                  className={`kn-node is-${state} ${faded ? 'is-filtered' : ''}`}
                  transform={`translate(${position.x},${position.y})`}
                  onPointerEnter={() => setHoverNodeId(node.id)}
                  onPointerLeave={() => setHoverNodeId(null)}
                >
                  {state === 'selected' ? (
                    <circle r={radius + 7} className="kn-node__halo" stroke={accent} />
                  ) : null}
                  <circle r={radius + 4} className="kn-node__hit" fill="transparent" />
                  <circle r={radius} className="kn-node__body" style={{ '--accent': accent }} />
                  <g className="kn-node__glyph" transform={`scale(${Math.max(0.85, radius / 18)})`}>
                    <NodeGlyphInner type={node.type} />
                  </g>
                  {status !== 'unstarted' ? (
                    <g transform={`translate(${radius * 0.72},${-radius * 0.72})`}>
                      <circle r={3.6} fill={statusAccent(status)} stroke="#181818" strokeWidth="1.4" />
                    </g>
                  ) : null}
                  <g transform={`translate(0,${radius + 12}) scale(${labelScale})`}>
                    <text
                      className={`kn-node__label ${showLabels || state !== 'normal' ? '' : 'is-hidden'}`}
                      textAnchor="middle"
                    >
                      {node.title}
                    </text>
                    {hidden > 0 ? (
                      <text className="kn-node__more" textAnchor="middle" y="15" >
                        +{faCount(hidden)} مفهوم
                      </text>
                    ) : null}
                  </g>
                </g>
              );
            })}
          </g>
        </g>

        <defs>
          <marker id="kn-arrow-base" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0.8 L7 4 L0 7.2" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.4" />
          </marker>
          <marker id="kn-arrow-hot" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
            <path d="M0 0.8 L7 4 L0 7.2" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.4" />
          </marker>
        </defs>
      </svg>

      {/* کنترل‌های سمت چپ (پایان RTL) */}
      <div className="kn-graph__controls">
        <button type="button" aria-label="زوم به داخل" onClick={() => zoomBy(1.25)}>
          <ZoomInIcon />
        </button>
        <button type="button" aria-label="زوم به خارج" onClick={() => zoomBy(0.8)}>
          <ZoomOutIcon />
        </button>
        <button type="button" aria-label="جای‌دادن شبکه در صفحه" onClick={() => fitToNodes(null)}>
          <FitIcon />
        </button>
        <button type="button" aria-label="بازنشانی نما و جابه‌جایی‌ها" onClick={resetView}>
          <ResetIcon />
        </button>
      </div>

      {!showAll ? (
        <button type="button" className="kn-graph__expand" onClick={() => onExpand?.(selectedId ?? 'diabetes')}>
          <ExpandIcon />
          {selectedId
            ? `نمایش شاخه‌های «${nodeById.get(selectedId)?.title ?? ''}»`
            : 'نمایش شاخه‌های دیابت'}
        </button>
      ) : null}

      <p className="kn-graph__hint">درگ = جابه‌جایی نقشه · چرخ موس = زوم · درگ نود = جابه‌جایی مفهوم · دوبار کلیک = ورود به موضوع</p>
    </div>
  );
}

/* ── گلیف درون نود: رنگ سفید شفاف، مرکز دایره ── */
function NodeGlyphInner({ type }) {
  const paths = {
    disease: <path d="M-5 0l2.6-4.4h4.8L5 0l-2.6 4.4h-4.8z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />,
    concept: <path d="M0-5 1.5-1.5 5 0 1.5 1.5 0 5-1.5 1.5-5 0-1.5-1.5z" fill="currentColor" opacity="0.85" />,
    anatomy: <path d="M0-4.6 4.4 4H-4.4z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />,
    process: (
      <>
        <path d="M4.4 0a4.4 4.4 0 1 1-1.3-3.1" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M4.6-4.4V-1.6H1.8" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    pathway: <path d="M-5 3.4-2-3l2.4 3.8L2.8-4l2.2 4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />,
    drug: (
      <>
        <rect x="-5" y="-2.2" width="10" height="4.4" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <line x1="0" y1="-2.2" x2="0" y2="2.2" stroke="currentColor" strokeWidth="1.2" />
      </>
    ),
    cell: (
      <>
        <circle r="4.4" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <circle r="1.4" fill="currentColor" opacity="0.8" />
      </>
    ),
    molecule: (
      <>
        <circle cx="-2" cy="0" r="2.7" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="2" cy="0" r="2.7" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </>
    ),
    microorganism: <path d="M0-4.6V4.6M-4-2.3 4 2.3M4-2.3-4 2.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />,
    finding: <path d="M-5 0h2l1.2-2.8 1.8 5.6L1.2 0h3.8" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />,
    labTest: (
      <>
        <path d="M-1.8-4.4v6a1.8 1.8 0 0 0 3.6 0v-6" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="-1.8" y1="-1.6" x2="1.8" y2="-1.6" stroke="currentColor" strokeWidth="1.2" />
      </>
    ),
  };
  return <svg viewBox="-6 -6 12 12" width="12" height="12" aria-hidden="true">{paths[type] ?? paths.concept}</svg>;
}

/* برچسب رابطه روی یال — pill کوچک در میانه با مقیاس ثابت */
function EdgeLabel({ from, to, label, scale }) {
  const x = (from.x + to.x) / 2;
  const y = (from.y + to.y) / 2;
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <g className="kn-edge__label">
        <rect x={-(label.length * 4.4 + 12)} y="-11" width={label.length * 8.8 + 24} height="22" rx="11" />
        <text textAnchor="middle" dy="4">
          {label}
        </text>
      </g>
    </g>
  );
}

const edgeKey = (edge) => `${edge.source}→${edge.target}:${edge.type}`;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
