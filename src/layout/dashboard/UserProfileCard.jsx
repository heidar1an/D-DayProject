import bubbleChatIcon from '../../../images/icons/bubble-chat.png';
export default function UserProfileCard({ userData, totalTests = ۰, completedCourses = ۰ }) {
  const profile = userData?.profile || {};
  const name = getProfileName(userData);
  const username = profile.username || userData?.phone || 'tapesh-user';

function getProfileName(userData) {
  const profile = userData?.profile || {};
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();

  return name || profile.username || 'کاربر تپش';
}

export default function UserProfileCard({ userData }) {
  const profile = userData?.profile || {};
  const name = getProfileName(userData);
  const username = profile.username || userData?.phone || 'tapesh-user';

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
          <span>{totalTests} تست زده شده</span>
        </div>
        <div className="user-profile-card__progress-item">
          <span className="user-profile-card__progress-icon user-profile-card__progress-icon--courses">−</span>
          <span>{completedCourses} دوره تکمیل شده</span>
        </div>
      </div>
    </article>
  );
}
