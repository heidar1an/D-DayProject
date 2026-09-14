/*
 * لایهٔ «اعلان‌های لیگِ همخوان‌ها» — بازشو از آیکون چتِ کادر پروفایل داشبورد.
 *
 * داده از سرویس لیگ می‌آید (فعلاً Mock، قرارداد API واقعی:
 *   GET /api/league/friends/notifications) و فقط رویدادهای «دوستان» را شامل می‌شود:
 *     action      → اقدامات دوستان (چالش، تست، مطالعه، پیوستن به نبرد)
 *     result      → نتایج (رتبه، سکو، امتیاز نبرد، صعود)
 *     achievement → دستاوردهای باز‌شده با کمیابی
 * بعد از باز شدن پنل، unreadها خوانده می‌شوند (PATCH سمت سرور در نسخهٔ واقعی).
 * کامپوننت کاملاً مستقل از لیگ است؛ فقط قطعات مشترک لایهٔ لیگ را مصرف می‌کند.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchFriendsLeagueNotifications,
  markFriendsLeagueNotificationsRead,
} from '../../services/league/leagueService';
import {
  EmptyState,
  Icon,
  IconHeart,
  Skeleton,
  UserAvatar,
  faNum,
  toFa,
} from './league/leagueShared';
import './friendsLeagueNotifications.css';

const KIND_META = {
  action: { label: 'اقدام', icon: 'flame', accent: '#b3a3e8' },
  result: { label: 'نتیجه', icon: 'trophy', accent: '#77b787' },
  achievement: { label: 'دستاورد', icon: 'star', accent: '#e0b45c' },
};

const RARITY_LABEL = {
  common: 'معمولی',
  rare: 'کمیاب',
  epic: 'حماسی',
  legendary: 'افسانه‌ای',
};

const RARITY_COLOR = {
  common: '#b9c2cc',
  rare: '#5b8cc7',
  epic: '#937fcd',
  legendary: '#e0b45c',
};

/* ── ردیف اعلان ── */
function NotificationRow({ item, friend, index }) {
  const kind = KIND_META[item.kind] ?? KIND_META.action;
  const rarity = item.rarity ? RARITY_COLOR[item.rarity] : null;

  return (
    <li
      className={`fln-row ${item.unread ? 'fln-row--unread' : ''}`}
      style={{ '--fln-i': index }}
    >
      <span className="fln-row__avatar" aria-hidden="true">
        <UserAvatar config={friend?.avatar} size={42} />
      </span>

      <span className="fln-row__body">
        <span className="fln-row__head">
          <strong className="fln-row__name">{friend?.name ?? 'همخوان'}</strong>
          <span className="fln-row__kind" style={{ color: kind.accent }}>
            <Icon name={kind.icon} className="fln-row__kind-icon" />
            {kind.label}
          </span>
        </span>

        <span className="fln-row__text">{item.text}</span>

        {item.note && <span className="fln-row__note">{item.note}</span>}

        <span className="fln-row__meta">
          <span className="fln-row__time">{item.time}</span>
          {rarity && (
            <span className="fln-row__rarity" style={{ color: rarity }}>
              {RARITY_LABEL[item.rarity] ?? 'ویژه'}
            </span>
          )}
        </span>
      </span>

      {typeof item.hearts === 'number' && (
        <span className="fln-row__hearts" aria-label={`${faNum(item.hearts)} قلب`}>
          <IconHeart className="fln-row__heart-icon" />
          {faNum(item.hearts)}
        </span>
      )}
    </li>
  );
}

/* ── پنل اعلان‌ها ── */
export default function FriendsLeagueNotifications({ onOpenLeague }) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);
  const readTimerRef = useRef(null);

  /* بارگذاری داده با Retry دستی (بدون وابستگی به useAsyncData لایهٔ لیگ) */
  useEffect(() => {
    let alive = true;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    fetchFriendsLeagueNotifications()
      .then((data) => {
        if (alive) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (alive) setState({ data: null, loading: false, error });
      });

    return () => {
      alive = false;
    };
  }, [attempt]);

  /* بعد از باز شدن پنل، unreadها خوانده شوند — کمی دیرتر تا کاربر رنگ «جدید» را ببیند */
  useEffect(() => {
    if (state.loading || state.error || !state.data) return undefined;
    if (state.data.unreadCount === 0) return undefined;

    readTimerRef.current = window.setTimeout(() => {
      markFriendsLeagueNotificationsRead().then(() => {
        setState((prev) =>
          prev.data
            ? {
                ...prev,
                data: {
                  ...prev.data,
                  unreadCount: 0,
                  items: prev.data.items.map((item) => ({ ...item, unread: false })),
                },
              }
            : prev,
        );
      });
    }, 1400);

    return () => window.clearTimeout(readTimerRef.current);
  }, [state.loading, state.error, state.data]);

  /* بستن با Escape — هم‌رفتار با پنل اعلان‌های لیگ */
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') onOpenLeague?.close?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onOpenLeague]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  const items = state.data?.items ?? [];
  const friendsById = new Map((state.data?.friends ?? []).map((friend) => [friend.id, friend]));
  const unreadCount = state.data?.unreadCount ?? 0;

  return (
    <div className="fln-panel" dir="rtl" role="dialog" aria-label="اعلان‌های لیگ همخوان‌ها">
      <span className="fln-panel__arrow" aria-hidden="true" />

      <header className="fln-panel__header">
        <span className="fln-panel__titles">
          <strong className="fln-panel__title">لیگ همخوان‌ها</strong>
          <span className="fln-panel__subtitle">اقدامات، نتایج و دستاوردهای دوستانت</span>
        </span>

        {unreadCount > 0 && (
          <span className="fln-panel__badge" aria-live="polite">
            {toFa(unreadCount)} جدید
          </span>
        )}
      </header>

      {state.loading && (
        <ul className="fln-panel__list" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <li key={index} className="fln-row fln-row--skeleton">
              <Skeleton className="fln-sk-avatar" />
              <span className="fln-sk-lines">
                <Skeleton className="fln-sk-line fln-sk-line--lg" />
                <Skeleton className="fln-sk-line" />
              </span>
            </li>
          ))}
        </ul>
      )}

      {state.error && (
        <div className="fln-panel__error">
          <p>اعلان‌های همخوان‌ها بارگذاری نشد.</p>
          <button type="button" className="fln-panel__retry" onClick={retry}>
            تلاش دوباره
          </button>
        </div>
      )}

      {!state.loading && !state.error && (
        <>
          {items.length === 0 ? (
            <EmptyState
              icon="users"
              title="فعلاً خبری نیست"
              note="وقتی همخوان‌هات در لیگ تپش اقدامی بکنند، نتیجه بگیرند یا دستاورد باز کنند، همین‌جا می‌بینی."
            />
          ) : (
            <ul className="fln-panel__list">
              {items.map((item, index) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  friend={friendsById.get(item.friendId)}
                  index={index}
                />
              ))}
            </ul>
          )}

          {onOpenLeague && (
            <button
              type="button"
              className="fln-panel__cta"
              onClick={() => onOpenLeague?.go?.()}
            >
              <Icon name="trophy" className="fln-panel__cta-icon" />
              مشاهدهٔ لیگ تپش
            </button>
          )}
        </>
      )}
    </div>
  );
}
