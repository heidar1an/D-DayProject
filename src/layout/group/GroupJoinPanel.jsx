import { AlertIcon, DisplayNameField, KeyIcon, LinkIcon } from './groupShared';

/*
 * ── فرمِ پیوستن («دریافت کد اشتراک») ──
 *
 * همان ورودی، دو راه رسیدن کد: تایپ دستی یا لینک دعوتی که کد را در query
 * آورده (`#group?join=CODE`). هر دو یک مسیر را طی می‌کنند — سرویس خودش کد را
 * نرمال می‌کند (حرف بزرگ، بدون فاصله، با پیشوند TP-).
 */
export default function GroupJoinPanel({
  code,
  onCodeChange,
  prefilled,
  displayName,
  onDisplayNameChange,
  onSubmit,
  error,
}) {
  return (
    <div className="grp-panel" id="grp-panel-join" role="tabpanel" aria-labelledby="grp-tab-join">
      <div className="grp-panel__grid">
        <div className="grp-panel__form">
          <h3 className="grp-panel__title">کد اشتراک را وارد کن</h3>
          <p className="grp-panel__lead">
            کدی که میزبان برایت فرستاده را اینجا بگذار و همان لحظه عضو گروه شو.
            ظرفیت گروه یکی‌یکی پر می‌شود و مبلغ نهایی روی نفرات واقعی حساب می‌شود.
          </p>

          <div className="grp-field">
            <label className="grp-field__label" htmlFor="grp-join-code">
              کد اشتراک گروهی
            </label>
            {/* کد لاتین است: جهت ثابت + بدون اصلاح خودکار تا وارونه نشود */}
            <input
              className="grp-field__input grp-field__input--code"
              id="grp-join-code"
              name="code"
              type="text"
              dir="ltr"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={12}
              placeholder="TP-XXXXXX"
              value={code}
              onChange={(event) => onCodeChange(event.target.value)}
            />
            <span className="grp-field__hint">
              {prefilled ? (
                <>
                  <LinkIcon className="grp-icon" />
                  کد از لینک دعوت پر شده است؛ فقط تأییدش کن.
                </>
              ) : (
                <>
                  <KeyIcon className="grp-icon" />
                  کد با TP- شروع می‌شود و ۶ نویسه دارد.
                </>
              )}
            </span>
          </div>

          <DisplayNameField
            id="grp-join-name"
            value={displayName}
            onChange={onDisplayNameChange}
            hint="با همین نام در فهرست اعضای گروه دیده می‌شوی."
          />

          <button className="grp-submit" type="button" onClick={onSubmit}>
            <span className="grp-submit__label">پیوستن به گروه</span>
          </button>

          {error && (
            <p className="grp-alert" role="alert">
              <AlertIcon className="grp-alert__icon" />
              {error.message}
            </p>
          )}
        </div>

        <aside className="grp-summary grp-summary--quiet" aria-label="پس از پیوستن">
          <span className="grp-summary__kicker">پس از پیوستن چه می‌شود؟</span>

          <ul className="grp-summary__list">
            <li>همان پوشش کامل اشتراک پرو برای هر نفر فعال می‌شود.</li>
            <li>مبلغ گروه با تخفیف همان تعداد نفر نهایی می‌شود.</li>
            <li>پرداخت گروهی یک‌جا و توسط میزبان انجام می‌شود.</li>
            <li>هر وقت خواستی می‌توانی از گروه خارج شوی.</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
