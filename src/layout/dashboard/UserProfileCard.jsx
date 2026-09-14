import { useCallback, useEffect, useRef, useState } from 'react';
import bubbleChatIcon from '../../../images/icons/bubble-chat.png';
import { trackEvent } from '../../services/league/leagueService';
import { toFa } from './league/leagueShared';
import { fetchFriendsLeagueNotifications } from '../../services/league/leagueService';
import AvatarSvg from './setting/avatar/AvatarSvg';
import FriendsLeagueNotifications from './FriendsLeagueNotifications';

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
 * شمارندهٔ اعلان‌های نخواندهٔ «لیگ همخوان‌ها» — همان سرویسی که پنل آیکون چت تغذیه می‌کند.
 * فقط تعداد نخوانده‌ها لازم است؛ پنل خودش دادهٔ کامل را جداگانه می‌گیرد.
 */
function useFriendsLeagueUnreadCount(isPanelOpen) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let alive = true;
    let timerId;

    const poll = () => {
      fetchFriendsLeagueNotifications()
        .then((data) => {
          if (alive) setUnreadCount(data.unreadCount);
        })
        .catch(() => {
          /* در حالت آفلاین آخرین تعداد حفظ می‌شود */
        });

      timerId = window.setTimeout(poll, 90 * 1000);
    };

    poll();

    return () => {
      alive = false;
      window.clearTimeout(timerId);
    };
  }, []);

  /* وقتی پنل باز و خوانده شد، بج روی آیکون صفر می‌شود */
  useEffect(() => {
    if (isPanelOpen) setUnreadCount(0);
  }, [isPanelOpen]);

  return unreadCount;
}

export default function UserProfileCard({ userData, onOpenLeague }) {
  const profile = userData?.profile || {};
  const name = getProfileName(userData);
  const username = profile.username || userData?.phone || 'tapesh-user';
  const greeting = useTimeGreeting();

  const [isLeaguePanelOpen, setIsLeaguePanelOpen] = useState(false);
  const chatWrapRef = useRef(null);
  const unreadCount = useFriendsLeagueUnreadCount(isLeaguePanelOpen);

  const closeLeaguePanel = useCallback(() => setIsLeaguePanelOpen(false), []);

  /* بستن پنل با کلیک بیرون — هم‌رفتار با پنل اعلان‌های لیگ */
  useEffect(() => {
    if (!isLeaguePanelOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!chatWrapRef.current?.contains(event.target)) closeLeaguePanel();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isLeaguePanelOpen, closeLeaguePanel]);

  return (
    <article className="user-profile-card" aria-label="پروفایل کاربر">
      <div className="user-profile-card__header">
        <div className="user-profile-card__chat-wrap" ref={chatWrapRef}>
          <button
            className="user-profile-card__chat-btn"
            type="button"
            aria-label="اعلان‌های لیگ همخوان‌ها"
            aria-haspopup="dialog"
            aria-expanded={isLeaguePanelOpen}
            onClick={() =>
              setIsLeaguePanelOpen((prev) => {
                if (!prev) trackEvent('friends_league_panel_open');
                return !prev;
              })
            }
          >
            <img src={bubbleChatIcon} alt="" />
            {unreadCount > 0 && (
              <span className="user-profile-card__chat-badge" aria-hidden="true">
                {toFa(unreadCount)}
              </span>
            )}
          </button>

          {isLeaguePanelOpen && (
            <FriendsLeagueNotifications
              onOpenLeague={{
                close: closeLeaguePanel,
                go: () => {
                  closeLeaguePanel();
                  onOpenLeague?.();
                },
              }}
            />
          )}
        </div>
      </div>

      <div className="user-profile-card__avatar" aria-hidden="true">
        <div className="user-profile-card__avatar-figure">
          <div className="user-profile-card__avatar-circle">
            <div className="user-profile-card__avatar-inner">
              {profile.avatarConfig ? (
                <div className="user-profile-card__avatar-custom">
                  <AvatarSvg config={profile.avatarConfig} title="آواتار کاربر" />
                </div>
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
        <div className="user-profile-card__stat">
          <span className="user-profile-card__stat-value">۳۳</span>
          <span className="user-profile-card__stat-label">دنبال‌شونده</span>
        </div>
        <div className="user-profile-card__stat">
          <span className="user-profile-card__stat-value">۱۲۳</span>
          <span className="user-profile-card__stat-label">دنبال‌کننده</span>
        </div>
      </div>

      <div className="user-profile-card__progress">
        <div className="user-profile-card__progress-item">
          <span className="user-profile-card__progress-icon user-profile-card__progress-icon--tests">✓</span>
          <span> ۱۲۳ تست زده شده</span>
        </div>
        <div className="user-profile-card__progress-item">
          <span className="user-profile-card__progress-icon user-profile-card__progress-icon--courses">−</span>
          <span> ۱۲۳ دوره تکمیل شده</span>
        </div>
      </div>
    </article>
  );
}
