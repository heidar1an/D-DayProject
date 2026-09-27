/*
 * لایهٔ «اعلان‌ها» — تنها سطح اعلان‌های کاربر، بازشو از زنگولهٔ هدر اصلی.
 *
 * دو منبع را در یک فهرست واحد جمع می‌کند (هر دو Mock با قرارداد API واقعی):
 *   همخوان‌ها → GET /api/league/friends/notifications  (اقدام، نتیجه، دستاورد دوستان)
 *   لیگ       → GET /api/league/notifications          (رتبه، رقیب، نبرد، رویداد)
 * اعلان‌های جدید تا پایان همین بازدید جدید می‌مانند؛ هنگام خروج خوانده می‌شوند.
 *
 * ظاهر: پیام‌رسان — هر اعلان یک ردیف با آواتار و «حباب پیام» است. فقط نمایش است؛
 * ورودی/پاسخ ندارد و متن‌ها عمداً درشت‌اند تا از فاصلهٔ معمول خوانا بمانند.
 */
import { Fragment, useCallback, useEffect, useState } from 'react';
import {
  fetchFriendsLeagueNotifications,
  fetchLeagueNotifications,
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

const KIND_META = {
  action: { label: 'اقدام', icon: 'flame', accent: '#b3a3e8' },
  result: { label: 'نتیجه', icon: 'trophy', accent: '#77b787' },
  achievement: { label: 'دستاورد', icon: 'star', accent: '#e0b45c' },
};

const LEAGUE_ACCENT = '#937fcd';

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

/* منبع «همخوان‌ها» → ردیف‌های فهرست واحد */
function fromFriends(data) {
  const friendsById = new Map((data?.friends ?? []).map((friend) => [friend.id, friend]));

  return (data?.items ?? []).map((item) => {
    const friend = friendsById.get(item.friendId);
    const kind = KIND_META[item.kind] ?? KIND_META.action;

    return {
      id: `friend-${item.id}`,
      avatar: friend?.avatar ?? null,
      icon: item.icon ?? kind.icon,
      accent: kind.accent,
      name: friend?.name ?? 'همخوان',
      tag: kind.label,
      tagIcon: kind.icon,
      text: item.text,
      note: item.note ?? null,
      rarity: item.rarity ?? null,
      hearts: typeof item.hearts === 'number' ? item.hearts : null,
      time: item.time,
      unread: Boolean(item.unread),
    };
  });
}

/* منبع «لیگ» → ردیف‌های فهرست واحد */
function fromLeague(data) {
  return (data?.items ?? []).map((item) => ({
    id: `league-${item.id}`,
    avatar: null,
    icon: item.icon ?? 'bell',
    accent: LEAGUE_ACCENT,
    name: 'لیگ تپش',
    tag: null,
    tagIcon: null,
    text: item.text,
    note: null,
    rarity: null,
    hearts: null,
    time: item.time,
    unread: Boolean(item.unread),
  }));
}

/* ── ردیف اعلان — ظاهر پیام‌رسان: آواتار + حباب پیام ── */
function NotificationRow({ item, index }) {
  const rarity = item.rarity ? RARITY_COLOR[item.rarity] : null;

  return (
    <li
      className={`notifications__row ${item.unread ? 'notifications__row--unread' : ''}`}
      style={{ '--n-i': index }}
    >
      {item.avatar ? (
        <span className="notifications__row-avatar">
          <UserAvatar avatar={item.avatar} size={48} />
        </span>
      ) : (
        <span className="notifications__row-icon" style={{ color: item.accent }} aria-hidden="true">
          <Icon name={item.icon} className="notifications__row-glyph" />
        </span>
      )}

      <span className="notifications__row-body">
        <span className="notifications__row-head">
          <strong className="notifications__row-name">{item.name}</strong>
          {item.tag && (
            <span className="notifications__row-tag" style={{ color: item.accent }}>
              <Icon name={item.tagIcon} className="notifications__row-tag-icon" />
              {item.tag}
            </span>
          )}
          <span className="notifications__row-time">{item.time}</span>
        </span>

        <span className="notifications__row-bubble">
          <span className="notifications__row-text">{item.text}</span>
          {item.note && <span className="notifications__row-note">{item.note}</span>}
        </span>

        {(item.hearts !== null || rarity) && (
          <span className="notifications__row-meta">
            {item.hearts !== null && (
              <span className="notifications__row-hearts" aria-label={`${faNum(item.hearts)} قلب`}>
                <IconHeart className="notifications__row-heart" />
                {faNum(item.hearts)}
              </span>
            )}
            {rarity && (
              <span className="notifications__row-rarity" style={{ color: rarity }}>
                {RARITY_LABEL[item.rarity] ?? 'ویژه'}
              </span>
            )}
          </span>
        )}
      </span>
    </li>
  );
}

export default function NotificationsSection({ pendingRead }) {
  const [state, setState] = useState({ items: null, unreadCount: 0, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);

  /* بارگذاری هر دو منبع با هم؛ Retry دستی همان الگوی بقیهٔ لایه‌ها */
  useEffect(() => {
    let alive = true;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    Promise.resolve(pendingRead)
      .then(() => Promise.all([fetchFriendsLeagueNotifications(), fetchLeagueNotifications()]))
      .then(([friends, league]) => {
        if (!alive) return;
        const items = [...fromFriends(friends), ...fromLeague(league)]
          .sort((a, b) => Number(b.unread) - Number(a.unread));

        setState({
          items,
          unreadCount: items.filter((item) => item.unread).length,
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (alive) setState({ items: null, unreadCount: 0, loading: false, error });
      });

    return () => {
      alive = false;
    };
  }, [attempt, pendingRead]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  const items = state.items ?? [];

  return (
    <section dir="rtl" aria-label="اعلان ها" className="notifications dashboard-layer-reveal">
      <div className="notifications__panel dash-stagger">
        <header className="notifications__header">
          <h1 className="notifications__title">اعلان ها</h1>
          {state.unreadCount > 0 && (
            <span className="notifications__badge" aria-live="polite">
              {toFa(state.unreadCount)} جدید
            </span>
          )}
        </header>

        {state.loading && (
          <ul className="notifications__list" aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => (
              <li key={index} className="notifications__row notifications__row--skeleton">
                <Skeleton className="notifications__sk-avatar" />
                <span className="notifications__sk-lines">
                  <Skeleton className="notifications__sk-line" />
                  <Skeleton className="notifications__sk-bubble" />
                </span>
              </li>
            ))}
          </ul>
        )}

        {state.error && (
          <div className="notifications__error">
            <p>اعلان‌ها بارگذاری نشد.</p>
            <button type="button" className="notifications__retry" onClick={retry}>
              تلاش دوباره
            </button>
          </div>
        )}

        {!state.loading && !state.error && (
          <>
            {items.length === 0 ? (
              <EmptyState
                icon="bell"
                title="فعلاً خبری نیست"
                note="وقتی همخوان‌هات در لیگ تپش اقدامی بکنند، نتیجه بگیرند یا دستاورد باز کنند — و هر خبر تازه‌ای از لیگ — همین‌جا می‌بینی."
              />
            ) : (
              <ul className="notifications__list">
                {items.map((item, index) => (
                  <Fragment key={item.id}>
                    {index > 0 && !item.unread && items[index - 1].unread && (
                      <li className="notifications__divider">پیام‌های پیشین</li>
                    )}
                    <NotificationRow item={item} index={index} />
                  </Fragment>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}
