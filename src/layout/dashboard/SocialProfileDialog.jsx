import { useEffect, useMemo, useState } from 'react';
import { fetchHeartSeries } from '../../services/hearts/heartStatsService';
import { UserAvatar, faNum } from './league/leagueShared';
import { Modal } from './notes/notesShared';
import { getFollowingProfiles, SOCIAL_CHANGE_EVENT, toggleFollowingProfile } from '../../services/social/socialService';
import './heart-chart/heartChart.css';

export const SOCIAL_PEOPLE = [
  { id: 'sara-m', name: 'سارا محمدی', username: 'sara.m', avatar: '07', university: 'دانشگاه علوم پزشکی تهران', term: 'ترم ۶', grade: 'علوم پایه', today: 42, total: 8640, level: 18, study: [12, 18, 0, 24, 31, 18, 40, 25, 0, 37, 41, 29, 48, 42] },
  { id: 'amir-k', name: 'امیرمحمد کاظمی', username: 'amirkazemi', avatar: '12', university: 'دانشگاه علوم پزشکی قم', term: 'ترم ۸', grade: 'فیزیوپاتولوژی', today: 56, total: 15420, level: 31, study: [22, 30, 18, 42, 36, 0, 52, 48, 25, 54, 40, 62, 58, 56] },
  { id: 'negin-s', name: 'نگین شریفی', username: 'negin.sh', avatar: '19', university: 'دانشگاه علوم پزشکی اصفهان', term: 'ترم ۴', grade: 'علوم پایه', today: 28, total: 7350, level: 15, study: [0, 18, 24, 15, 0, 31, 26, 19, 32, 0, 23, 34, 20, 28] },
  { id: 'alireza-r', name: 'علیرضا رضایی', username: 'alireza.r', avatar: '23', university: 'دانشگاه علوم پزشکی قم', term: 'ترم ۱۰', grade: 'استاژ (کارآمینی)', today: 35, total: 11210, level: 23, study: [32, 0, 27, 35, 44, 20, 0, 48, 33, 29, 50, 38, 41, 35] },
  { id: 'maryam-h', name: 'مریم حسینی', username: 'maryam.h', avatar: '04', university: 'دانشگاه علوم پزشکی شیراز', term: 'ترم ۲', grade: 'علوم پایه', today: 31, total: 4920, level: 10, study: [10, 0, 15, 21, 18, 22, 0, 25, 18, 30, 26, 21, 38, 31] },
];

const toFa = (value) => String(value ?? '').replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
const chartNumber = new Intl.NumberFormat('fa-IR');
const chartSmoothPath = (coords) => {
  if (!coords.length) return '';
  if (coords.length === 1) return `M${coords[0].x},${coords[0].y}`;
  let path = `M${coords[0].x},${coords[0].y}`;
  coords.slice(1).forEach((point, index) => {
    const previous = coords[index];
    const before = coords[index - 1] ?? previous;
    const after = coords[index + 2] ?? point;
    const tension = 0.18;
    path += ` C${previous.x + (point.x - before.x) * tension},${previous.y + (point.y - before.y) * tension} ${point.x - (after.x - previous.x) * tension},${point.y - (after.y - previous.y) * tension} ${point.x},${point.y}`;
  });
  return path;
};

export function toSocialPerson(entry = {}) {
  if (entry.id && SOCIAL_PEOPLE.some((profile) => profile.id === entry.id)) {
    return SOCIAL_PEOPLE.find((profile) => profile.id === entry.id);
  }
  const name = entry.name || 'کاربر تپش';
  const hearts = Number(entry.hearts ?? entry.total ?? 0);
  const seed = Number(entry.rank ?? String(entry.id ?? name).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0));
  const study = Array.from({ length: 14 }, (_, index) => {
    const variation = Math.abs(Math.sin(seed * 0.73 + index * 1.91));
    return Math.round(variation * Math.min(80, Math.max(12, hearts / 180)));
  });
  return {
    id: String(entry.id ?? `league:${name}`),
    name,
    username: entry.username || `tapesh${seed}`,
    avatar: entry.avatar ?? (entry.seed !== undefined ? String(entry.seed % 35 + 1).padStart(2, '0') : null),
    university: entry.university || 'ثبت نشده',
    term: entry.term ? `ترم ${entry.term}` : 'ثبت نشده',
    grade: entry.grade || 'ثبت نشده',
    today: study.at(-1),
    total: hearts,
    level: Math.floor(hearts / 500) + 1,
    isSelf: Boolean(entry.isYou || entry.id === 'me'),
    study,
  };
}

function ContactList({ people, onOpen }) {
  if (!people.length) return <p className="rounded-xl bg-white/5 p-4 text-sm text-[var(--muted)]">فهرست خالی است.</p>;
  return <ul className="grid gap-2">
    {people.map((contact) => (
      <li key={contact.id}>
          <button type="button" onClick={() => onOpen(contact)} className="flex w-full items-center gap-3 rounded-2xl bg-white/[0.035] p-3 text-right transition-colors hover:bg-white/[0.08]">
          <UserAvatar avatar={contact.avatar} size={42} />
          <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{contact.name}</strong><span className="block truncate text-xs text-[var(--faint)]" dir="ltr">@{contact.username}</span></span>
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-[var(--faint)]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
      </li>
    ))}
  </ul>;
}

export default function SocialProfileDialog({ type, people, person, userData, userId, defaultFollowing = [], onClose, onOpenPerson, onBack }) {
  const [ownSeries, setOwnSeries] = useState([]);
  const [ownTotal, setOwnTotal] = useState(0);
  const [tab, setTab] = useState('overview');
  const [followingIds, setFollowingIds] = useState(() => getFollowingProfiles(userId, defaultFollowing).map((entry) => entry.id));
  const [profileTrail, setProfileTrail] = useState([]);
  const title = person ? (tab === 'followers' ? 'دنبال‌کنندگان' : tab === 'following' ? 'دنبال‌شوندگان' : '') : (type === 'followers' ? 'دنبال‌کنندگان' : 'دنبال‌شوندگان');
  const profile = userData?.profile ?? {};
  const ownName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() || profile.username || 'من';

  useEffect(() => {
    const refresh = (event) => {
      if (event.detail?.userId === String(userId || 'current')) {
        setFollowingIds(getFollowingProfiles(userId, defaultFollowing).map((entry) => entry.id));
      }
    };
    window.addEventListener(SOCIAL_CHANGE_EVENT, refresh);
    return () => window.removeEventListener(SOCIAL_CHANGE_EVENT, refresh);
  }, [userId, defaultFollowing]);

  useEffect(() => {
    let alive = true;
    fetchHeartSeries({ range: 'daily' }).then((result) => {
      if (!alive) return;
      setOwnSeries(result.points.map((point) => point.hearts));
      setOwnTotal(result.allTimeTotal ?? result.summary.total ?? 0);
    }).catch(() => { if (alive) setOwnSeries([]); });
    return () => { alive = false; };
  }, [userData?.id]);

  const profileNetwork = useMemo(() => {
    if (!person) return { followers: [], following: [] };
    const others = SOCIAL_PEOPLE.filter((entry) => entry.id !== person.id);
    const index = SOCIAL_PEOPLE.findIndex((entry) => entry.id === person.id);
    return {
      followers: others.filter((_entry, i) => (i + index) % 2 === 0),
      following: others.filter((_entry, i) => (i + index) % 3 !== 0),
    };
  }, [person]);

  const ownProfile = {
    id: String(userId || 'current'),
    name: ownName,
    username: profile.username || userData?.phone || 'tapesh-user',
    avatar: profile.avatar,
    university: profile.university || 'ثبت نشده',
    term: profile.term ? `ترم ${profile.term}` : 'ثبت نشده',
    grade: profile.grade || 'ثبت نشده',
    level: Math.floor(ownTotal / 500) + 1,
    today: ownSeries.at(-1) ?? 0,
    total: ownTotal,
  };
  const ownContact = { ...ownProfile, isSelf: true };
  const profileFollowers = person && followingIds.includes(person.id)
    ? [ownContact, ...profileNetwork.followers]
    : profileNetwork.followers;
  const friendSeries = (person?.study ?? []).slice(-7);
  const openPerson = (entry) => {
    setProfileTrail((trail) => [...trail, { person, tab }]);
    setTab('overview');
    onOpenPerson(entry);
  };
  const backToProfile = () => {
    if (profileTrail.length) {
      const previous = profileTrail.at(-1);
      setProfileTrail((trail) => trail.slice(0, -1));
      onOpenPerson(previous.person);
      setTab(previous.tab);
      return;
    }
    if (onBack) onBack();
    else onClose?.();
  };

  const recentOwnSeries = ownSeries.slice(-7);
  const chartPoints = Array.from({ length: 7 }, (_, index) => ({ person: friendSeries[index] ?? 0, own: recentOwnSeries[index] ?? 0 }));
  const chartMax = Math.max(1, ...chartPoints.flatMap(({ person: theirs, own }) => [theirs, own]));
  const chartTop = 16;
  const chartBase = 126;
  const chartLeft = 14;
  const chartRight = 310;
  const chartCoords = (key) => chartPoints.map((point, index) => ({
    x: chartLeft + (chartRight - chartLeft) * index / Math.max(1, chartPoints.length - 1),
    y: chartBase - ((point[key] / chartMax) * (chartBase - chartTop)),
  }));
  const friendPath = chartSmoothPath(chartCoords('person'));
  const ownPath = chartSmoothPath(chartCoords('own'));
  const chartGuides = [0, 1, 2, 3].map((index) => ({ y: chartTop + (chartBase - chartTop) * index / 3, value: Math.round(chartMax * (3 - index) / 3) }));

  return (
    <Modal open onClose={onClose} title={title} wide>
      <div key={person?.id ?? `list-${type}`} className="social-profile-content">
      {!person ? (
        <>
          <p className="mb-4 text-sm text-[var(--muted)]">{faNum(people.length)} نفر در این فهرست</p>
          <ContactList people={people} onOpen={openPerson} />
        </>
      ) : tab !== 'overview' ? (
        <div className="social-profile-content space-y-3">
          <button type="button" onClick={() => setTab('overview')} className="flex items-center gap-2 rounded-xl px-2 py-1 text-sm text-[var(--muted)] hover:bg-white/5 hover:text-white"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>بازگشت به پروفایل</button>
          <p className="text-sm text-[var(--muted)]">{faNum((tab === 'followers' ? profileFollowers : profileNetwork.following).length)} نفر در این فهرست</p>
          <ContactList people={tab === 'followers' ? profileFollowers : profileNetwork.following} onOpen={openPerson} />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="social-profile-identity">
            <button type="button" onClick={backToProfile} className="social-profile-back"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>بازگشت</button>
            <div className="social-profile-person">
              <UserAvatar avatar={person.avatar} size={92} />
              <span><strong className="block text-lg">{person.name}</strong><span className="text-sm text-[var(--muted)]" dir="ltr">@{person.username}</span></span>
            </div>
            <div className="social-profile-academics">
              <div className="social-profile-academic"><span>دانشگاه</span><strong>{person.university}</strong></div>
              <div className="social-profile-academic social-profile-academic--study"><div><span>مقطع</span><strong>{person.grade}</strong></div><div><span>ترم</span><strong>{person.term}</strong></div><div><span>سطح</span><strong>{faNum(person.level)}</strong></div></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" aria-expanded={tab === 'followers'} onClick={() => setTab('followers')} className="social-profile-network-stat"><strong>{faNum(profileFollowers.length)}</strong><span>دنبال‌کننده</span></button>
            <button type="button" aria-expanded={tab === 'following'} onClick={() => setTab('following')} className="social-profile-network-stat"><strong>{faNum(profileNetwork.following.length)}</strong><span>دنبال‌شونده</span></button>
          </div>
          {!person.isSelf && <button type="button" aria-pressed={followingIds.includes(person.id)} onClick={() => {
            toggleFollowingProfile(userId, person, defaultFollowing);
            setFollowingIds(getFollowingProfiles(userId, defaultFollowing).map((entry) => entry.id));
          }} className={`social-profile-follow ${followingIds.includes(person.id) ? 'is-following' : ''}`}>
            {followingIds.includes(person.id) ? 'دنبال می‌کنی' : 'دنبال کردن'}
          </button>}

          <section aria-label="مقایسهٔ نمودار مطالعه" className="rounded-2xl border border-white/6 bg-white/[0.035] p-4">
              <svg viewBox="0 0 350 155" className="social-profile-line-chart" role="img" aria-label="نمودار مقایسه‌ای قلب‌های روزانه">
                <defs>
                  <linearGradient id="social-person-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff6969" stopOpacity=".23"/><stop offset="100%" stopColor="#ff6969" stopOpacity="0"/></linearGradient>
                  <linearGradient id="social-own-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#937fcd" stopOpacity=".2"/><stop offset="100%" stopColor="#937fcd" stopOpacity="0"/></linearGradient>
                </defs>
                {chartGuides.map(({ y, value }) => <g key={y}><line className="heart-chart__grid" x1="14" x2="310" y1={y} y2={y} strokeDasharray="3 6"/><text className="heart-chart__ylabel" x="344" y={y + 3} textAnchor="end">{chartNumber.format(value)}</text></g>)}
                {chartPoints.length > 1 && <><path className="heart-chart__line-area" d={`${friendPath} L${chartRight},${chartBase} L${chartLeft},${chartBase} Z`} fill="url(#social-person-area)"/><path className="heart-chart__line-area" d={`${ownPath} L${chartRight},${chartBase} L${chartLeft},${chartBase} Z`} fill="url(#social-own-area)"/></>}
                <path className="heart-chart__line-stroke" d={friendPath} pathLength="1" style={{ stroke: '#ff6969' }}/>
                <path className="heart-chart__line-stroke social-profile-line-stroke--own" d={ownPath} pathLength="1" style={{ stroke: '#937fcd' }}/>
                {chartCoords('person').map((coord, index) => <g key={index} className="heart-chart__dot-wrap" style={{ '--i': index }}><circle className="heart-chart__dot" cx={coord.x} cy={coord.y} r="2.7" style={{ stroke: '#ff6969' }}/></g>)}
                {chartCoords('own').map((coord, index) => <g key={index} className="heart-chart__dot-wrap social-profile-dot--own" style={{ '--i': index }}><circle className="heart-chart__dot" cx={coord.x} cy={coord.y} r="2.7" style={{ stroke: '#937fcd' }}/></g>)}
                {chartPoints.map((_point, index) => (index % 2 === 0 || index === 6) && <text key={index} className={`heart-chart__xlabel ${index === 6 ? 'is-current' : ''}`} x={chartLeft + (chartRight - chartLeft) * index / 6} y="147" textAnchor="middle">{toFa(index === 6 ? 'امروز' : 6 - index)}</text>)}
              </svg>
              <div className="social-profile-heart-summary"><strong>قلب‌های روزانه</strong><span><b>♥ {faNum(person.today)}</b> قلب امروز</span><span><b>♥ {faNum(person.total)}</b> قلب کل</span></div>
              {!ownSeries.length && <p className="mt-2 text-xs text-[var(--faint)]">آمار مطالعهٔ حساب شما در دسترس نیست.</p>}
          </section>
        </div>
      )}
      </div>
    </Modal>
  );
}
