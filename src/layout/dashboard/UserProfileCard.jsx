import { useEffect, useState } from 'react';
import bubbleChatIcon from '../../../images/icons/bubble-chat.png';

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

export default function UserProfileCard({ userData }) {
  const profile = userData?.profile || {};
  const name = getProfileName(userData);
  const username = profile.username || userData?.phone || 'tapesh-user';
  const greeting = useTimeGreeting();

  return (
    <article className="user-profile-card" aria-label="پروفایل کاربر">
      <div className="user-profile-card__header">
        <button className="user-profile-card__chat-btn" type="button" aria-label="پیام‌ها">
          <img src={bubbleChatIcon} alt="" />
        </button>
      </div>

      <div className="user-profile-card__avatar" aria-hidden="true">
        <div className="user-profile-card__avatar-circle">
          <div className="user-profile-card__avatar-inner">
            <span className="user-profile-card__avatar-head" />
            <span className="user-profile-card__avatar-body" />
          </div>
        </div>
        <span className="user-profile-card__level">سطح اول</span>
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
