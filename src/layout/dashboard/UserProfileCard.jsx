import { useEffect, useState } from 'react';
import { avatarSrc } from './setting/avatar/avatarOptions';

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

  return (
    <article className="user-profile-card" aria-label="پروفایل کاربر">
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
        <div className="user-profile-card__stat">
          <span className="user-profile-card__stat-value">۳۳</span>
          <span className="user-profile-card__stat-label">دنبال‌شونده</span>
        </div>
        <div className="user-profile-card__stat">
          <span className="user-profile-card__stat-value">۱۲۳</span>
          <span className="user-profile-card__stat-label">دنبال‌کننده</span>
        </div>
      </div>

    </article>
  );
}
