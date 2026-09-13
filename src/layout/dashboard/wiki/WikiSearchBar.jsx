/* ── نوار جست‌وجوی ویکی تپش ──
   تجربه از Google الهام گرفته شده اما با هویت «موتور دانش پزشکی»:
   پیشنهاد زنده با نوع هر پیشنهاد (موجودیت/مخفف/کلیدواژه/درس)، ناوبری کامل کیبورد،
   پیشنهاد فازی غلط تایپی، و در حالت خالی: تاریخچه + عبارت‌های داغ. */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../../../services/wiki/wikiService';
import { Icon, toFa } from './wikiShared';

const SUGGESTION_KIND_META = {
  entity: { label: 'موضوع', icon: 'layers' },
  abbr: { label: 'مخفف', icon: 'sparkle' },
  keyword: { label: 'کلیدواژه', icon: 'search' },
  subject: { label: 'درس', icon: 'filter' },
  topic: { label: 'موضوع', icon: 'layers' },
  spell: { label: 'اصلاح عبارت', icon: 'history' },
  history: { label: 'جست‌وجوی اخیر', icon: 'history' },
  hot: { label: 'پرجست‌وجو', icon: 'trend' },
};

export default function WikiSearchBar({
  value,
  onChange,
  onSubmit,
  onOpenArticle,
  size = 'hero',
  autoFocus = false,
  placeholder = 'موضوع، بیماری، دارو یا مخفف را جست‌وجو کنید…',
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const skipNextSuggestRef = useRef(false);

  /* پیشنهادها همیشه از سرویس می‌آیند (الان محلی؛ بعداً debounce+fetch) */
  useEffect(() => {
    const term = value.trim();

    if (skipNextSuggestRef.current) {
      skipNextSuggestRef.current = false;
      setSuggestions([]);
      return;
    }

    if (term.length >= 2) {
      setSuggestions(api.suggestWiki(term, { limit: 8 }));
    } else {
      setSuggestions([]);
    }
    setActiveIndex(-1);
  }, [value]);

  /* بستن با کلیک بیرون */
  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const emptySuggest = useMemo(
    () => (value.trim().length < 2 ? api.getEmptyQuerySuggestions() : null),
    [value],
  );

  const hasDropdown = open && (suggestions.length > 0 || emptySuggest);
  const flatItems = useMemo(() => {
    if (!hasDropdown) return [];
    if (suggestions.length > 0) return suggestions;
    return [...emptySuggest.recents, ...emptySuggest.hot];
  }, [hasDropdown, suggestions, emptySuggest]);

  const runSearch = (term) => {
    if (!term.trim()) return;
    setOpen(false);
    inputRef.current?.blur();
    onSubmit(term.trim());
  };

  const runSuggestion = (item) => {
    /* جست‌وجوی اخیر و داغ و درس/کلیدواژه → جست‌وجو؛ موضوع و مخفف و اصلاح → ورود مستقیم */
    setOpen(false);
    inputRef.current?.blur();

    if (item.kind === 'history' || item.kind === 'hot') {
      if (item.slug && item.kind === 'hot') {
        api.saveRecentSearch(item.term);
        onOpenArticle(item.slug);
        return;
      }
      onSubmit(item.term);
      return;
    }

    if (item.slug && (item.kind === 'entity' || item.kind === 'abbr' || item.kind === 'spell')) {
      api.saveRecentSearch(item.label);
      onOpenArticle(item.slug);
      return;
    }

    onChange(item.label);
    onSubmit(item.label);
  };

  const handleKeyDown = (event) => {
    if (!hasDropdown && event.key === 'Escape') {
      event.stopPropagation(); /* لایه والد با Escape جابه‌جا نشود */
      onChange('');
      inputRef.current?.blur();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!hasDropdown || flatItems.length === 0) return;
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => {
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        return (current + delta + flatItems.length) % flatItems.length;
      });
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (activeIndex >= 0 && flatItems[activeIndex]) {
        runSuggestion(flatItems[activeIndex]);
      } else {
        runSearch(value);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.stopPropagation(); /* فقط پیشنهادها بسته شود، نه کل نما */
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const renderKindTag = (kind) => {
    const meta = SUGGESTION_KIND_META[kind];
    if (!meta) return null;
    return (
      <span className={`wiki-suggest__kind wiki-suggest__kind--${kind}`}>
        <Icon name={meta.icon} size={13} />
        {meta.label}
      </span>
    );
  };

  return (
    <div className={`wiki-search wiki-search--${size} ${hasDropdown ? 'is-open' : ''}`} ref={rootRef}>
      <div className="wiki-search__field">
        <span className="wiki-search__icon" aria-hidden="true">
          <Icon name="search" size={size === 'hero' ? 21 : 18} />
        </span>
        <input
          ref={inputRef}
          type="search"
          className="wiki-search__input"
          value={value}
          placeholder={placeholder}
          aria-label="جست‌وجو در ویکی تپش"
          autoComplete="off"
          spellCheck="false"
          role="combobox"
          aria-expanded={hasDropdown}
          aria-controls="wiki-search-suggestions"
          aria-autocomplete="list"
          onChange={(event) => {
            setOpen(true);
            onChange(event.target.value);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {value && (
          <button
            type="button"
            className="wiki-search__clear"
            aria-label="پاک کردن عبارت"
            onClick={() => {
              skipNextSuggestRef.current = true;
              onChange('');
              inputRef.current?.focus();
            }}
          >
            <Icon name="close" size={15} />
          </button>
        )}
        <button
          type="button"
          className="wiki-search__submit"
          onClick={() => runSearch(value)}
          disabled={!value.trim()}
        >
          جست‌وجو
        </button>
      </div>

      {hasDropdown && (
        <div className="wiki-suggest" id="wiki-search-suggestions" role="listbox">
          {suggestions.length > 0 &&
            suggestions.map((item, index) => (
              <button
                key={`${item.kind}-${item.label}-${item.slug ?? ''}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={`wiki-suggest__item ${index === activeIndex ? 'is-active' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runSuggestion(item)}
              >
                <span className="wiki-suggest__body">
                  <span className="wiki-suggest__label">{item.label}</span>
                  {item.hint && item.hint !== item.label && (
                    <span className="wiki-suggest__hint">{item.hint}</span>
                  )}
                </span>
                {renderKindTag(item.kind)}
              </button>
            ))}

          {suggestions.length === 0 && emptySuggest && (
            <>
              {emptySuggest.recents.length > 0 && (
                <>
                  <div className="wiki-suggest__group">
                    جست‌وجوهای اخیر
                    <button
                      type="button"
                      className="wiki-suggest__clear-history"
                      onClick={() => {
                        api.clearRecentSearches();
                        onChange(value);
                      }}
                    >
                      پاک‌سازی
                    </button>
                  </div>
                  {emptySuggest.recents.map((item, index) => (
                    <button
                      key={`recent-${item.term}`}
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      className={`wiki-suggest__item ${index === activeIndex ? 'is-active' : ''}`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => runSuggestion(item)}
                    >
                      <span className="wiki-suggest__body">
                        <span className="wiki-suggest__label">{item.term}</span>
                      </span>
                      {renderKindTag('history')}
                    </button>
                  ))}
                </>
              )}

              <div className="wiki-suggest__group">پرجست‌وجوهای ویکی</div>
              {emptySuggest.hot.map((item, index) => {
                const flatIndex = emptySuggest.recents.length + index;
                return (
                  <button
                    key={`hot-${item.term}`}
                    type="button"
                    role="option"
                    aria-selected={flatIndex === activeIndex}
                    className={`wiki-suggest__item ${flatIndex === activeIndex ? 'is-active' : ''}`}
                    onMouseEnter={() => setActiveIndex(flatIndex)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => runSuggestion(item)}
                  >
                    <span className="wiki-suggest__body">
                      <span className="wiki-suggest__label">{item.term}</span>
                    </span>
                    {renderKindTag('hot')}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
