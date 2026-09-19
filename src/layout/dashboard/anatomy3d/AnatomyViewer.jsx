/*
 * AnatomyViewer — ترکیب موتور سه‌بعدی + پنل‌های کنترل.
 *
 * موتور خارج از چرخهٔ رندر React زندگی می‌کند (useRef) و فقط با callback با UI حرف
 * می‌زند؛ state های React فقط برای پنل‌هاست و هیچ‌وقت صحنه را re-render نمی‌کند.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnatomyEngine } from './engine/AnatomyEngine';
import { ANATOMY_CATEGORIES, defaultVisibility } from './data/anatomyCategories';
import LoadingOverlay from './components/LoadingOverlay';
import ErrorOverlay from './components/ErrorOverlay';
import LayerPanel from './components/LayerPanel';
import StructureInfo from './components/StructureInfo';
import StructureSearch from './components/StructureSearch';
import CameraControls from './components/CameraControls';
import './anatomy3d.css';

const catById = Object.fromEntries(ANATOMY_CATEGORIES.map((c) => [c.id, c]));

/* شکل تحویلی ساختار به UI — جدا از آبجکت موتور تا بدون تابع/بافر serialize شود */
function toStructureView(structure) {
  if (!structure) return null;
  const cat = catById[structure.cat];
  return {
    key: structure.key,
    label: structure.label,
    side: structure.side,
    fa: structure.fa,
    cat: structure.cat,
    catColor: cat?.color,
    catFa: cat?.fa,
    selectable: structure.selectable,
  };
}

export default function AnatomyViewer() {
  const hostRef = useRef(null);
  const engineRef = useRef(null);
  const [loading, setLoading] = useState({ percent: 0, systemLabel: null, done: false });
  const [error, setError] = useState(null);
  const [visibility, setVisibility] = useState(defaultVisibility);
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  const [mobilePanel, setMobilePanel] = useState(null); /* null | 'layers' */
  const [engineReady, setEngineReady] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    /* canvas در هر mount تازه ساخته می‌شود — استفادهٔ مجدد از کانتکست WebGL روی یک
       canvas مشترک (رفتار StrictMode در dev) صحنهٔ خالی می‌سازد. */
    const canvas = document.createElement('canvas');
    canvas.className = 'anatomy-viewer__canvas';
    host.appendChild(canvas);

    const engine = new AnatomyEngine(canvas, {
      onProgress: ({ percent, systemLabel }) => {
        setLoading((prev) => (prev.done ? prev : { percent, systemLabel, done: false }));
      },
      onLoadingDone: () => setLoading({ percent: 100, systemLabel: null, done: true }),
      onHover: (s) => setHovered(toStructureView(s)),
      onSelect: (s) => setSelected(toStructureView(s)),
      onError: (message) => setError(message),
    });
    engine.visibility = defaultVisibility();
    engineRef.current = engine;
    engine.init();
    setEngineReady(true);
    if (import.meta.env.DEV) window.__anatomy = engine; /* دیباگ توسعه */

    return () => {
      engine.dispose();
      engineRef.current = null;
      canvas.remove();
    };
  }, [reloadKey]);

  /* ── کنترل لایه‌ها ── */
  const handleToggle = useCallback((catId) => {
    setVisibility((prev) => {
      const next = { ...prev, [catId]: !prev[catId] };
      engineRef.current?.setCategoryVisible(catId, next[catId]);
      return next;
    });
  }, []);

  const handleShowAll = useCallback(() => {
    const next = {};
    for (const cat of ANATOMY_CATEGORIES) next[cat.id] = true;
    setVisibility(next);
    engineRef.current?.applyVisibilityMap(next);
  }, []);

  const handleHideAll = useCallback(() => {
    const next = {};
    for (const cat of ANATOMY_CATEGORIES) next[cat.id] = false;
    setVisibility(next);
    engineRef.current?.applyVisibilityMap(next);
  }, []);

  const handleResetVisibility = useCallback(() => {
    const next = defaultVisibility();
    setVisibility(next);
    engineRef.current?.applyVisibilityMap(next);
  }, []);

  /* ── انتخاب و جست‌وجو ── */
  const handleSelectStructure = useCallback((structure) => {
    const engine = engineRef.current;
    if (!engine || !structure) return;
    /* اگر دستهٔ ساختار خاموش است، روشن شود تا انتخاب معنا داشته باشد */
    if (!visibility[structure.cat]) {
      const next = { ...visibility, [structure.cat]: true };
      setVisibility(next);
      engine.setCategoryVisible(structure.cat, true);
    }
    engine.select(structure.key);
    engine.focusStructure(structure.key);
  }, [visibility]);

  const handleClearSelection = useCallback(() => {
    engineRef.current?.select(null);
  }, []);

  const handleView = useCallback((view) => {
    engineRef.current?.setView(view);
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    setLoading({ percent: 0, systemLabel: null, done: false });
    setReloadKey((k) => k + 1);
  }, []);

  const hoverText = useMemo(
    () => (hovered ? `${hovered.fa || hovered.label}${hovered.side ? ` (${hovered.side})` : ''}` : null),
    [hovered],
  );

  return (
    <div className={`anatomy-viewer${loading.done && !error ? ' is-ready' : ''}`}>
      <div ref={hostRef} className="anatomy-viewer__host" />

      {/* نوار بالای صحنه: جست‌وجو + کنترل دوربین */}
      <div className="anatomy-viewer__topbar">
        <StructureSearch engine={engineReady ? engineRef.current : null} onSelect={handleSelectStructure} />
        <CameraControls onView={handleView} />
      </div>

      {/* پنل لایه‌ها — در موبایل به شیت پایین تبدیل می‌شود */}
      <button
        type="button"
        className="anatomy-viewer__panel-toggle"
        onClick={() => setMobilePanel((p) => (p === 'layers' ? null : 'layers'))}
        aria-expanded={mobilePanel === 'layers'}
      >
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m12 3.6 8.6 4.6L12 12.8 3.4 8.2 12 3.6Z" />
          <path d="m3.4 13.2 8.6 4.6 8.6-4.6" />
        </svg>
        لایه‌ها
      </button>

      <div className={`anatomy-viewer__side${mobilePanel === 'layers' ? ' is-open' : ''}`}>
        <LayerPanel
          visibility={visibility}
          onToggle={handleToggle}
          onShowAll={handleShowAll}
          onHideAll={handleHideAll}
          onReset={handleResetVisibility}
        />
      </div>

      {/* پنل اطلاعات ساختار */}
      <div className="anatomy-viewer__info">
        <StructureInfo structure={selected} categoryFa={selected?.catFa} onClear={handleClearSelection} />
      </div>

      {/* نشانگر hover — گوشهٔ پایین صحنه */}
      {hoverText && !selected ? (
        <div className="anatomy-viewer__hover" aria-hidden="true">{hoverText}</div>
      ) : null}

      {/* راهنمای تعامل */}
      {loading.done && !error ? (
        <div className="anatomy-viewer__hints" aria-hidden="true">
          <span>چرخش: درگ</span>
          <span>زوم: اسکرول</span>
          <span>جابه‌جایی: درگ دو انگشت / راست‌کلیک</span>
          <span>انتخاب: کلیک</span>
        </div>
      ) : null}

      {!loading.done && !error ? (
        <LoadingOverlay percent={loading.percent} systemLabel={loading.systemLabel} />
      ) : null}

      {error ? <ErrorOverlay message={error} onRetry={handleRetry} /> : null}
    </div>
  );
}
