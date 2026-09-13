/* ── نوار جست‌وجوی هوشمند شبکه دانش ──
   پیشنهاد زنده هنگام تایپ (نود/مترادف/کلیدواژه)، ناوبری کیبورد،
   و پیشنهاد «ارتباطات مهم» نودِ انتخاب‌شده. Escape بستن و پاک‌کردن. */

import { useEffect, useMemo, useRef, useState } from 'react';
import { searchKnowledge, courseAccent, GRAPH } from '../../../services/knowledge/knowledgeService';
import { GraphSearchIcon } from './knowledgeIcons';
import { NodeGlyph, CourseChip } from './knowledgeShared';

export default function KnowledgeSearchBar({ onSelect, placeholder, autoFocus = false }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [cursorAtEnd, setCursorAtEnd] = useState(true);
  const inputRef = useRef(null);
  const rootRef = useRef(null);

  /* نتایج جست‌وجو + پیشنهاد همسایه‌های نتیجهٔ اول (جست‌وجوی مرتبط) */
  const results = useMemo(() => (query.trim().length >= 2 ? searchKnowledge(query, { limit: 7 }) : []), [query]);

  useEffect(() => setActiveIndex(0), [results]);

  /* کلیک بیرون بستن می‌کند */
  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const commit = (node, { keepQuery = false } = {}) => {
    if (!node) return;
    setOpen(false);
    if (!keepQuery) {
      setQuery('');
      inputRef.current?.blur();
    }
    onSelect?.(node);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      if (open) {
        setOpen(false);
        return;
      }
      setQuery('');
      inputRef.current?.blur();
      return;
    }
    if (!open || results.length === 0) {
      if (event.key === 'Enter' && results.length > 0) commit(results[0].node);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursorAtEnd(false);
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursorAtEnd(false);
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      commit(results[activeIndex]?.node ?? results[0].node);
    }
  };

  return (
    <div className={`kn-search ${open && results.length > 0 ? 'is-open' : ''}`} ref={rootRef}>
      <span className="kn-search__icon" aria-hidden="true">
        <GraphSearchIcon />
      </span>
      <input
        ref={inputRef}
        type="search"
        dir="rtl"
        value={query}
        placeholder={placeholder ?? 'جست‌وجوی مفهوم… مثلاً انسولین، گلیکولیز، دیابت'}
        aria-label="جست‌وجو در شبکه دانش"
        autoComplete="off"
        autoFocus={autoFocus}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setCursorAtEnd(true);
        }}
        onKeyDown={handleKeyDown}
      />
      {query ? (
        <button
          type="button"
          className="kn-search__clear"
          aria-label="پاک‌کردن جست‌وجو"
          onClick={() => {
            setQuery('');
            setOpen(false);
            inputRef.current?.focus();
          }}
        >
          ×
        </button>
      ) : null}

      {open && query.trim().length >= 2 ? (
        <div className="kn-search__panel" role="listbox" aria-label="نتیجه‌های جست‌وجو">
          {results.length === 0 ? (
            <p className="kn-search__empty">مفهومی با این نام پیدا نشد؛ عبارت دیگری امتحان کنید.</p>
          ) : (
            <>
              {results.map((result, index) => {
                const isActive = cursorAtEnd ? index === activeIndex : index === activeIndex;
                return (
                  <button
                    key={result.node.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    className={`kn-search__item ${isActive ? 'is-active' : ''}`}
                    onMouseEnter={() => {
                      setCursorAtEnd(true);
                      setActiveIndex(index);
                    }}
                    onClick={() => commit(result.node)}
                  >
                    <span
                      className="kn-search__dot"
                      style={{ '--accent': courseAccent(result.node.courses?.[0]) }}
                      aria-hidden="true"
                    >
                      <NodeGlyph type={result.node.type} size={11} />
                    </span>
                    <span className="kn-search__label">
                      <strong>{result.node.title}</strong>
                      <small>{result.node.englishTitle}</small>
                    </span>
                    <span className="kn-search__meta">
                      <CourseChip courseId={result.node.courses?.[0]} compact />
                    </span>
                  </button>
                );
              })}
              <p className="kn-search__hint">Enter برای رفتن به مفهوم · Esc برای بستن</p>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ── انتخابگر نود — نسخهٔ فشردهٔ سرچ‌بار برای Path View و فرم‌ها ── */
export function NodePicker({ label, value, onChange }) {
  const current = value ? GRAPH.nodeById.get(value) : null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  const results = useMemo(
    () => (query.trim().length >= 1 ? searchKnowledge(query, { limit: 6 }) : []),
    [query],
  );

  return (
    <label className="kn-picker">
      {label ? <span className="kn-picker__label">{label}</span> : null}
      <div className={`kn-picker__control ${open ? 'is-open' : ''}`} ref={rootRef}>
        <button type="button" onClick={() => setOpen((wasOpen) => !wasOpen)} aria-expanded={open}>
          <span
            className="kn-picker__dot"
            style={{ '--accent': courseAccent(current?.courses?.[0]) }}
            aria-hidden="true"
          >
            {current ? <NodeGlyph type={current.type} size={11} /> : null}
          </span>
          <strong>{current?.title ?? 'انتخاب مفهوم'}</strong>
        </button>

        {open ? (
          <div className="kn-picker__menu">
            <input
              type="search"
              dir="rtl"
              autoFocus
              value={query}
              placeholder="جست‌وجو…"
              onChange={(event) => setQuery(event.target.value)}
              aria-label="جست‌وجوی مفهوم"
            />
            {results.map((result) => (
              <button
                key={result.node.id}
                type="button"
                className="kn-search__item"
                onClick={() => {
                  onChange(result.node.id);
                  setOpen(false);
                  setQuery('');
                }}
              >
                <span
                  className="kn-search__dot"
                  style={{ '--accent': courseAccent(result.node.courses?.[0]) }}
                  aria-hidden="true"
                >
                  <NodeGlyph type={result.node.type} size={11} />
                </span>
                <span className="kn-search__label">
                  <strong>{result.node.title}</strong>
                  <small>{result.node.englishTitle}</small>
                </span>
              </button>
            ))}
            {query.trim().length >= 1 && results.length === 0 ? (
              <p className="kn-search__empty">پیدا نشد؛ عبارت دیگری امتحان کنید.</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </label>
  );
}
