import { useState } from 'react';

import {
  buildInviteLink,
  formatJoinDate,
  formatPercentFa,
  formatToman,
  toFa,
} from '../../services/group/groupService';
import {
  CheckIcon,
  CopyButton,
  CrownIcon,
  ExitIcon,
  LinkIcon,
  RefreshIcon,
  UsersIcon,
} from './groupShared';

/*
 * ── کارت گروه (کد اشتراک + اعضا + مدیریت) ──
 *
 * یک تعریف، سه مصرف: بلافاصله بعد از ساخت گروه، بعد از پیوستن با کد، و در
 * بازگشت به صفحه وقتی کاربر از قبل عضو یک گروه است. چون هر سه یک چیز را نشان
 * می‌دهند، سه نسخهٔ جدا ساخته نشد.
 *
 * مدیریت (چرخش کد، حذف عضو، خروج/انحلال) فقط برای میزبان دیده می‌شود و سرویس
 * هم مستقلاً همان را بررسی می‌کند — UI تنها نگهبان نیست.
 */
export default function GroupCard({ group, onRotate, onRemoveMember, onLeave }) {
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [pendingMember, setPendingMember] = useState(null);
  const inviteLink = buildInviteLink(group.code);

  /* حذف عضو دومرحله‌ای است: یک بار «حذف»، بار دوم «مطمئنی؟» */
  const handleRemove = (memberId) => {
    if (pendingMember !== memberId) {
      setPendingMember(memberId);
      return;
    }

    setPendingMember(null);
    onRemoveMember(memberId);
  };

  return (
    <article className="grp-card" id="grp-my-group" aria-labelledby="grp-card-title">
      <span className="grp-card__glow" aria-hidden="true" />

      <header className="grp-card__head">
        <div>
          <span className="grp-card__kicker">
            {group.isOwner ? 'گروه تو — تو میزبان هستی' : 'گروه تو — عضو شده‌ای'}
          </span>
          <h3 className="grp-card__title" id="grp-card-title">
            {group.isOwner ? 'کد اشتراک را با رفقا به اشتراک بگذار' : 'عضویت تو ثبت شد'}
          </h3>
        </div>

        <span className={`grp-card__status ${group.isFull ? 'is-full' : ''}`}>{group.status.label}</span>
      </header>

      <div className="grp-card__code">
        <div className="grp-card__code-block">
          <span className="grp-card__code-label">کد اشتراک گروهی</span>
          {/* کد لاتین است؛ جهت ثابت تا در رابط راست‌به‌چپ وارونه دیده نشود */}
          <code className="grp-card__code-value" dir="ltr">
            {group.code}
          </code>
        </div>

        <div className="grp-card__code-actions">
          <CopyButton text={group.code} label="کپی کد" />
          <CopyButton
            text={inviteLink}
            label="کپی لینک دعوت"
            className="grp-copy grp-copy--ghost"
          />
        </div>

        <p className="grp-card__link" dir="ltr">
          <LinkIcon className="grp-card__link-icon" />
          {inviteLink}
        </p>
      </div>

      <div className="grp-card__seats">
        <div className="grp-card__seats-head">
          <span className="grp-card__seats-label">
            <UsersIcon className="grp-icon" />
            ظرفیت گروه
          </span>
          <span className="grp-card__seats-count">
            {toFa(group.filled)} از {toFa(group.capacity)} نفر
          </span>
        </div>

        <div className="grp-card__seats-bar" aria-hidden="true">
          <span
            className="grp-card__seats-fill"
            style={{ '--grp-fill': `${(group.filled / group.capacity) * 100}%` }}
          />
        </div>
      </div>

      <ul className="grp-card__members">
        {group.members.map((member) => (
          <li className="grp-member" key={member.id}>
            <span className="grp-member__avatar" aria-hidden="true">
              {member.name.trim().charAt(0)}
            </span>

            <span className="grp-member__body">
              <span className="grp-member__name">
                {member.name}
                {member.isViewer && <span className="grp-member__you">تو</span>}
              </span>
              <span className="grp-member__meta">عضو از {formatJoinDate(member.joinedAt)}</span>
            </span>

            {member.isOwner && (
              <span className="grp-member__role">
                <CrownIcon className="grp-member__role-icon" />
                میزبان
              </span>
            )}

            {group.isOwner && !member.isOwner && (
              <button
                className="grp-member__remove"
                type="button"
                onClick={() => handleRemove(member.id)}
                onBlur={() => setPendingMember(null)}
              >
                {pendingMember === member.id ? 'مطمئنی؟' : 'حذف'}
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="grp-card__summary">
        <div className="grp-card__summary-row">
          <span>دورهٔ پرداخت</span>
          <span>{group.cycleLabel}</span>
        </div>
        <div className="grp-card__summary-row">
          <span>هزینهٔ هر نفر، ماهانه</span>
          <span>{formatToman(group.perMonth)}</span>
        </div>
        <div className="grp-card__summary-row">
          <span>تخفیف گروهی</span>
          <span>
            {formatPercentFa(group.discountPercent)}
            {group.isFull && group.fullDiscountPercent > group.discountPercent
              ? ` — با ${toFa(group.capacity)} نفر ${formatPercentFa(group.fullDiscountPercent)} می‌شود`
              : ''}
          </span>
        </div>
        <div className="grp-card__summary-row grp-card__summary-row--total">
          <span>مبلغ گروه برای {toFa(group.billedSeats)} نفر</span>
          <span>{formatToman(group.total)}</span>
        </div>
        {group.isBelowMinimum && (
          <div className="grp-card__summary-row grp-card__summary-row--hint">
            <span>پلن گروهی حداقل ۲ نفره است</span>
            <span>تا آمدن نفر بعدی، مبلغ روی حداقل حساب می‌شود</span>
          </div>
        )}
        {!group.isFull && (
          <div className="grp-card__summary-row grp-card__summary-row--hint">
            <span>اگر ظرفیت پر شود</span>
            <span>{formatToman(group.fullTotal)}</span>
          </div>
        )}
      </div>

      <footer className="grp-card__foot">
        <div className="grp-card__manage">
          {group.isOwner && (
            <button className="grp-action" type="button" onClick={onRotate}>
              <RefreshIcon className="grp-icon" />
              ساخت کد تازه
            </button>
          )}

          {confirmingLeave ? (
            <span className="grp-confirm">
              <span className="grp-confirm__text">
                {group.isOwner ? 'گروه منحل شود؟' : 'از گروه خارج شوی؟'}
              </span>
              <button className="grp-action grp-action--danger" type="button" onClick={onLeave}>
                بله، {group.isOwner ? 'منحل کن' : 'خارج شو'}
              </button>
              <button
                className="grp-action grp-action--quiet"
                type="button"
                onClick={() => setConfirmingLeave(false)}
              >
                بمانم
              </button>
            </span>
          ) : (
            <button
              className="grp-action grp-action--quiet"
              type="button"
              onClick={() => setConfirmingLeave(true)}
            >
              <ExitIcon className="grp-icon" />
              {group.isOwner ? 'انحلال گروه' : 'خروج از گروه'}
            </button>
          )}
        </div>

        <p className="grp-card__note">
          <CheckIcon className="grp-icon" />
          کد روی همین دستگاه ساخته و ثبت شده است. هر کس آن را وارد کند، تا وقتی
          ظرفیت خالی است، عضو همین گروه می‌شود.
        </p>
      </footer>
    </article>
  );
}
