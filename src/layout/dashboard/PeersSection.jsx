import { useCallback, useEffect, useRef, useState } from 'react';
import { SolidIcon } from './heart-chart/chartIcons';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toFa = (value) => String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);

/*
 * همخوان‌ها — کادر کوچک ولی پرکاربردِ داشبورد.
 * فلسفهٔ وجودش «پیوستگی مطالعه» است، پس هر ردیف فقط دو عدد می‌آورد:
 *   قلب امروز (چه‌قدر امروز خوانده) و روزهای متوالی (چند روز پشت‌سرهم ادامه داده).
 * هر دو عدد با آیکن نشان داده می‌شوند تا در عرض کم کارت، خوانا و بی‌ابهام بمانند.
 *
 * تعداد زیاد همخوان: لیست داخل خودش اسکرول می‌شود (اسکرول‌بار نازک + محو تدریجی بالا/پایین
 * به‌عنوان نشانهٔ «بیشتر هست») و ردیف «افزودن همخوان» بیرون از ناحیهٔ اسکرول می‌ماند تا
 * همیشه در دسترس باشد. پس هر تعداد همخوان، کارت از قالب بیرون نمی‌زند.
 */
const peers = [
  { id: 'alireza', name: 'علیرضا', initial: 'ع', tint: '#e26d6d', heartsToday: 124, streak: 12 },
  { id: 'leila', name: 'لیلا', initial: 'ل', tint: '#5b8cc7', heartsToday: 91, streak: 5 },
  { id: 'mohammad', name: 'محمد', initial: 'م', tint: '#937fcd', heartsToday: 68, streak: 3 },
  { id: 'sara', name: 'سارا', initial: 'س', tint: '#77b787', heartsToday: 57, streak: 9 },
  { id: 'reza', name: 'رضا', initial: 'ر', tint: '#e0b45c', heartsToday: 44, streak: 2 },
  { id: 'negar', name: 'نگار', initial: 'ن', tint: '#ab8e7c', heartsToday: 31, streak: 4 },
];

export default function PeersSection() {
  const listRef = useRef(null);
  const [edges, setEdges] = useState({ above: false, below: false });

  const measureEdges = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const above = el.scrollTop > 4;
    const below = el.scrollHeight - el.scrollTop - el.clientHeight > 4;
    setEdges((current) => (current.above === above && current.below === below ? current : { above, below }));
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return undefined;

    measureEdges();
    el.addEventListener('scroll', measureEdges, { passive: true });

    const observer = new ResizeObserver(measureEdges);
    observer.observe(el);

    return () => {
      el.removeEventListener('scroll', measureEdges);
      observer.disconnect();
    };
  }, [measureEdges]);

  return (
    <div className="peers-section">
      <header className="peers-section__header">
        <h3 className="peers-section__title">همخوان‌ها</h3>
        <span className="peers-section__count">{toFa(peers.length)} همخوان فعال</span>
      </header>

      <div className={`peers-section__list-wrap ${edges.above ? 'has-above' : ''} ${edges.below ? 'has-below' : ''}`}>
        <ul className="peers-section__list" ref={listRef}>
          {peers.map((peer) => (
            <li key={peer.id}>
              <button
                type="button"
                className="peers-section__peer"
                style={{ '--peer-tint': peer.tint }}
                aria-label={`${peer.name}؛ ${toFa(peer.heartsToday)} قلب امروز؛ ${toFa(peer.streak)} روز متوالی`}
              >
                <span className="peers-section__avatar" aria-hidden="true">{peer.initial}</span>
                <span className="peers-section__name">{peer.name}</span>

                <span className="peers-section__metrics" aria-hidden="true">
                  <span className="peers-section__metric peers-section__metric--hearts" title="قلب امروز">
                    <SolidIcon name="heart" size={13} />
                    {toFa(peer.heartsToday)}
                  </span>
                  <span className="peers-section__metric peers-section__metric--streak" title="روزهای متوالی">
                    <SolidIcon name="flame" size={13} />
                    {toFa(peer.streak)}
                  </span>
                </span>

                <svg
                  className="peers-section__chevron"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  aria-hidden="true"
                >
                  <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>

        <span className="peers-section__fade peers-section__fade--top" aria-hidden="true" />
        <span className="peers-section__fade peers-section__fade--bottom" aria-hidden="true" />
      </div>

      <button type="button" className="peers-section__add" aria-label="افزودن همخوان">
        <span className="peers-section__avatar peers-section__avatar--add" aria-hidden="true">+</span>
        <span className="peers-section__add-label">افزودن همخوان تازه</span>
      </button>
    </div>
  );
}
