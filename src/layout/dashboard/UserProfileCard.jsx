import { useEffect, useState } from 'react';
import { avatarSrc } from './setting/avatar/avatarOptions';
import SocialProfileDialog, { SOCIAL_PEOPLE } from './SocialProfileDialog';
import { getFollowingProfiles, SOCIAL_CHANGE_EVENT } from '../../services/social/socialService';

function getProfileName(userData) {
  const profile = userData?.profile || {};
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();

  return name || profile.username || 'کاربر تپش';
}

function getTimeGreeting(hour) {
  if (hour >= 8 && hour < 12) return 'صبح بخیر دکتر';
  if (hour >= 12 && hour < 15) return 'ظهر بخیر دکتر';
  if (hour >= 15 && hour < 19) return 'عصر بخیر دکتر';
  if (hour >= 19 && hour < 24) return 'شبت بخیر دکتر';
  return 'نیمه‌شب بخیر دکتر'; // بازه ۲۴ (۰) الی ۸ صبح
}

function useTimeGreeting() {
  const [greeting, setGreeting] = useState(() => getTimeGreeting(new Date().getHours()));

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setGreeting(getTimeGreeting(new Date().getHours()));
    }, 60 * 1000);

    return () => window.clearInterval(timerId);
  }, []);

  return greeting;
}

/*
 * کادر پروفایل کاربر — سمت راست داشبورد.
 * فقط هویت و آمار کاربر را نشان می‌دهد؛ اعلان‌ها یک سطح واحد دارند و از زنگولهٔ هدر اصلی
 * (لایهٔ NotificationsSection) خوانده می‌شوند.
 */
export default function UserProfileCard({ userData }) {
  const profile = userData?.profile || {};
  const name = getProfileName(userData);
  const username = profile.username || userData?.phone || 'tapesh-user';
  const greeting = useTimeGreeting();
  const userId = userData?.id || 'current';
  const defaultFollowing = SOCIAL_PEOPLE.slice(2, 5);
  const [listType, setListType] = useState(null);
  const [activePerson, setActivePerson] = useState(null);
  const [following, setFollowing] = useState(() => getFollowingProfiles(userId, defaultFollowing));
  const [shareStatus, setShareStatus] = useState('');
  const followers = SOCIAL_PEOPLE.slice(0, 4);
  useEffect(() => {
    const refreshFollowing = (event) => {
      if (event.detail?.userId === String(userId)) setFollowing(getFollowingProfiles(userId, defaultFollowing));
    };
    window.addEventListener(SOCIAL_CHANGE_EVENT, refreshFollowing);
    return () => window.removeEventListener(SOCIAL_CHANGE_EVENT, refreshFollowing);
  }, [userId]);
  const shareProfile = async () => {
    const shareUrl = new URL(window.location.href);
    shareUrl.hash = `profile=${encodeURIComponent(username.replace(/^@/, ''))}`;
    const shareData = { title: `پروفایل ${name} در تپش`, text: `پروفایل ${name} در تپش`, url: shareUrl.toString() };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(shareData.url);
        setShareStatus('پیوند پروفایل کپی شد');
        window.setTimeout(() => setShareStatus(''), 2500);
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
      setShareStatus('اشتراک‌گذاری در دسترس نیست');
      window.setTimeout(() => setShareStatus(''), 2500);
    }
  };

  return (
    <article className="user-profile-card" aria-label="پروفایل کاربر">
      <div className="user-profile-card__actions">
        <button type="button" className="user-profile-card__share" onClick={shareProfile} aria-label="اشتراک‌گذاری پروفایل">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"/></svg>
        </button>
        {shareStatus && <span className="user-profile-card__share-status" role="status">{shareStatus}</span>}
      </div>
      <div className="user-profile-card__avatar" aria-hidden="true">
        <div className="user-profile-card__avatar-figure">
          <div className="user-profile-card__avatar-circle">
            <div className="user-profile-card__avatar-inner">
              {avatarSrc(profile.avatar) ? (
                <img
                  className="user-profile-card__avatar-image"
                  src={avatarSrc(profile.avatar)}
                  alt="آواتار کاربر"
                />
              ) : (
                <>
                  <span className="user-profile-card__avatar-head" />
                  <span className="user-profile-card__avatar-body" />
                </>
              )}
            </div>
          </div>
          <span className="user-profile-card__level">سطح اول</span>
        </div>
      </div>

      <div className="user-profile-card__info">
        <p className="user-profile-card__greeting">{greeting}</p>
        <h1 className="user-profile-card__name">{name}</h1>
        <p className="user-profile-card__username" dir="ltr">@{username.replace(/^@/, '')}</p>
      </div>

      <div className="user-profile-card__stats">
        <button type="button" className="user-profile-card__stat" onClick={() => setListType('following')} aria-haspopup="dialog">
          <span className="user-profile-card__stat-value">{new Intl.NumberFormat('fa-IR').format(following.length)}</span>
          <span className="user-profile-card__stat-label">دنبال‌شونده</span>
        </button>
        <button type="button" className="user-profile-card__stat" onClick={() => setListType('followers')} aria-haspopup="dialog">
          <span className="user-profile-card__stat-value">{new Intl.NumberFormat('fa-IR').format(followers.length)}</span>
          <span className="user-profile-card__stat-label">دنبال‌کننده</span>
        </button>
      </div>

      {listType && <SocialProfileDialog
        type={listType}
        people={listType === 'followers' ? followers : following}
        person={activePerson}
        userData={userData}
        userId={userId}
        defaultFollowing={defaultFollowing}
        onClose={() => { setListType(null); setActivePerson(null); }}
        onOpenPerson={setActivePerson}
        onBack={() => setActivePerson(null)}
      />}

    </article>
  );
}
