import { formatPercentFa, formatToman, toFa } from '../../services/group/groupService';
import { AlertIcon, CheckIcon, DisplayNameField, UsersIcon } from './groupShared';

/*
 * ── فرمِ ساخت گروه («گرفتن کد اشتراک») ──
 *
 * خلاصهٔ انتخاب (ظرفیت و دوره) همان چیزی است که در پله‌های تخفیف انتخاب شده؛
 * این‌جا فقط یک‌بار جمع‌بندی می‌شود تا کاربر بداند با چه مبلغی کد می‌سازد.
 * هیچ محاسبه‌ای در این فایل نیست.
 */
export default function GroupCreatePanel({
  tier,
  cycle,
  seats,
  displayName,
  onDisplayNameChange,
  onSubmit,
  error,
}) {
  return (
    <div className="grp-panel" id="grp-panel-create" role="tabpanel" aria-labelledby="grp-tab-create">
      <div className="grp-panel__grid">
        <div className="grp-panel__form">
          <h3 className="grp-panel__title">گروه را بساز و کد بگیر</h3>
          <p className="grp-panel__lead">
            با یک کلیک، کد یکتای گروه ساخته می‌شود. تا وقتی کسی با آن کد وارد نشده،
            هیچ هزینه‌ای ثبت نمی‌شود و می‌توانی ظرفیت یا دوره را عوض کنی.
          </p>

          <DisplayNameField
            id="grp-create-name"
            value={displayName}
            onChange={onDisplayNameChange}
            hint="همین نام در فهرست اعضای گروه دیده می‌شود."
          />

          <button className="grp-submit" type="button" onClick={onSubmit}>
            <span className="grp-submit__label">ساخت گروه و گرفتن کد</span>
          </button>

          {error && (
            <p className="grp-alert" role="alert">
              <AlertIcon className="grp-alert__icon" />
              {error.message}
            </p>
          )}
        </div>

        <aside className="grp-summary" aria-label="خلاصهٔ گروه">
          <span className="grp-summary__kicker">گروهی که ساخته می‌شود</span>

          <dl className="grp-summary__rows">
            <div className="grp-summary__row">
              <dt>ظرفیت</dt>
              <dd>
                <UsersIcon className="grp-icon" />
                {toFa(seats)} نفر
              </dd>
            </div>
            <div className="grp-summary__row">
              <dt>دورهٔ پرداخت</dt>
              <dd>{cycle.label}</dd>
            </div>
            <div className="grp-summary__row">
              <dt>هزینهٔ هر نفر، ماهانه</dt>
              <dd>{formatToman(tier.perMonth)}</dd>
            </div>
            <div className="grp-summary__row">
              <dt>تخفیف گروهی</dt>
              <dd>{formatPercentFa(tier.discountPercent)}</dd>
            </div>
            <div className="grp-summary__row grp-summary__row--total">
              <dt>مجموع {toFa(seats)} نفر برای {toFa(tier.months)} ماه</dt>
              <dd>{formatToman(tier.total)}</dd>
            </div>
          </dl>

          <p className="grp-summary__note">
            <CheckIcon className="grp-icon" />
            بعد از ساخت گروه، {toFa(tier.openSeats)} جای دیگر برای رفقا خالی می‌ماند و
            پر شدنش با کد اشتراک انجام می‌شود.
          </p>
        </aside>
      </div>
    </div>
  );
}
