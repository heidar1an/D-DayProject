import { useMemo, useRef, useState } from 'react';

import {
  buildInviteLink,
  clampSeats,
  createGroup,
  defaultDisplayName,
  getAmountsMeta,
  getCapacityRange,
  getCycle,
  getCycles,
  getFaq,
  getGroupPlan,
  getIntro,
  getMyGroup,
  getPaymentStatus,
  getSeatTiers,
  getSteps,
  getTier,
  getViewerId,
  joinGroup,
  leaveGroup,
  normalizeCode,
  readInviteCode,
  removeMember,
  rotateCode,
  summarizeGroup,
  toFa,
} from '../../services/group/groupService';
import GroupCard from './GroupCard';
import GroupCreatePanel from './GroupCreatePanel';
import GroupJoinPanel from './GroupJoinPanel';
import GroupTiers from './GroupTiers';
import { AlertIcon, ArrowIcon, CheckIcon, CopyButton, KeyIcon, UsersIcon } from './groupShared';
import './group.css';

/*
 * ── لایهٔ اشتراک گروهی (صفحهٔ مستقل، مسیر `#group`) ──
 *
 * چرا صفحهٔ جدا و نه یک بخش در صفحهٔ اصلی: اشتراک گروهی یک «تصمیم» است، نه یک
 * بلوک تبلیغاتی. کارت «با رفقا درس بخون» در صفحهٔ اصلی فقط همین‌جا را باز
 * می‌کند. لینک‌پذیری مستقل هم لازم بود: لینک دعوت (`#group?join=CODE`) باید کد
 * را با خودش بیاورد و فرمِ پیوستن را پُر کند.
 *
 * ترتیب لایه‌ها:
 *   ۱. سرآغاز (تیتر + سه واقعیتِ برگرفته از خودِ داده)
 *   ۲. پله‌های تخفیف (ظرفیت + دوره — انتخاب همان‌جا انجام می‌شود)
 *   ۳. دو کنش: ساخت گروه (گرفتن کد) / پیوستن با کد (دریافت کد)
 *   ۴. مراحل کار
 *   ۵. پرسش‌های پرتکرار
 *   ۶. فراخوان پایانی + وضعیت پرداخت
 * اگر کاربر از قبل عضو گروهی باشد، جای «دو کنش»، کارت گروه نشان داده می‌شود.
 *
 * قاعدهٔ پروژه رعایت شده است: هیچ متن، عدد یا درصدی در این فایل نیست (همه از
 * `groupService`)، هیچ رنگ ثابتی در کد نیست (فقط توکن‌های `styles.css`)، هیچ
 * وابستگی تازه‌ای اضافه نشده و همهٔ حرکت‌ها گارد `prefers-reduced-motion` دارند.
 *
 * ⚠️ تبِ فعال در آدرس نمی‌نشیند (مثل انتخاب پلن در تعرفه‌ها): فقط *ورود با لینک
 * دعوت* تب را تعیین می‌کند. پس مقدار اولیه از query می‌آید، نه از state.
 *
 * ⚠️ حالت «در حال ارسال» این‌جا نیست چون سرویس فعلاً همگام است (localStorage).
 * وقتی بدنهٔ توابع به `fetch` تبدیل شد (قرارداد REST در سربرگ سرویس)، همین‌جا
 * یک state لودینگ اضافه می‌شود و به دکمه‌ها `disabled` می‌دهد.
 */

export default function GroupPage({ userData = null, onStart }) {
  const plan = getGroupPlan();
  const intro = getIntro();
  const cycles = getCycles();
  const capacity = getCapacityRange();
  const payment = getPaymentStatus();
  const amounts = getAmountsMeta();
  const steps = getSteps();
  const faq = getFaq();

  /* هویت محلی: یک‌بار در mount خوانده می‌شود، نه در هر رندر */
  const [viewerId] = useState(() => getViewerId());
  const [inviteCode] = useState(() => normalizeCode(readInviteCode()));
  const [cycleId, setCycleId] = useState('monthly');
  const [seats, setSeats] = useState(() => clampSeats(plan?.seats?.defaultSeats));
  const [displayName, setDisplayName] = useState(() => defaultDisplayName(userData));
  const [group, setGroup] = useState(() => getMyGroup(viewerId));
  const [tab, setTab] = useState(() => (inviteCode ? 'join' : 'create'));
  const [joinCode, setJoinCode] = useState(() => inviteCode);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const actionsRef = useRef(null);

  const tiers = useMemo(() => getSeatTiers(cycleId), [cycleId]);
  const tier = useMemo(() => getTier(cycleId, seats) ?? tiers[0], [cycleId, seats, tiers]);
  const cycle = getCycle(cycleId);
  const summary = useMemo(() => summarizeGroup(group, viewerId), [group, viewerId]);
  const bestTier = tiers.find((item) => item.isBest) ?? tiers[tiers.length - 1];
  /* «از لینک دعوت آمده» تا وقتی کاربر خودش دست به کد نزده باشد، معتبر است */
  const isPrefilled = Boolean(inviteCode) && joinCode === inviteCode;

  const applyResult = (result, successNotice) => {
    if (!result?.ok) {
      setError(result?.error ?? null);
      setNotice(null);
      return false;
    }

    setGroup(result.group ?? null);
    setError(null);
    setNotice(successNotice ?? null);
    return true;
  };

  const handleCreate = () => {
    applyResult(
      createGroup({ viewerId, displayName, cycleId, seats }),
      'گروه ساخته شد و کد اشتراک آماده است — کد را برای رفقا بفرست.',
    );
  };

  const handleJoin = () => {
    const result = joinGroup({ viewerId, displayName, code: joinCode });

    if (!result.ok) {
      applyResult(result);
      return;
    }

    setJoinCode('');
    applyResult(
      result,
      result.already ? 'از قبل عضو همین گروه بودی.' : 'به گروه پیوستی — یک جای گروه پر شد.',
    );
  };

  const handleRotate = () => {
    if (!group) return;
    applyResult(rotateCode({ viewerId, groupId: group.id }), 'کد تازه ساخته شد؛ کد قبلی از کار افتاد.');
  };

  const handleRemoveMember = (memberId) => {
    if (!group) return;
    applyResult(removeMember({ viewerId, groupId: group.id, memberId }), 'عضو از گروه حذف شد.');
  };

  const handleLeave = () => {
    if (!group) return;

    const result = leaveGroup({ viewerId, groupId: group.id });

    if (!result.ok) {
      setError(result.error);
      setNotice(null);
      return;
    }

    setGroup(null);
    setError(null);
    setNotice(result.disbanded ? 'گروه منحل شد.' : 'از گروه خارج شدی.');
  };

  /* بدون hash، پس نیازی به ثبت لنگر در App.jsx نیست (تلهٔ لنگرهای لایهٔ تعرفه) */
  const goToActions = (nextTab) => {
    setTab(nextTab);
    actionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const tabs = [
    { id: 'create', label: 'ساخت گروه و گرفتن کد', icon: <UsersIcon className="grp-icon" /> },
    { id: 'join', label: 'پیوستن با کد اشتراک', icon: <KeyIcon className="grp-icon" /> },
  ];

  return (
    <main className="grp-page" id="group-page">
      {/* ── لایهٔ اول: سرآغاز ── */}
      <section className="grp-hero section-shell" data-reveal="hero" aria-labelledby="grp-title">
        <span className="grp-hero__grid" aria-hidden="true" />
        <span className="grp-hero__glow" aria-hidden="true" />

        <div className="grp-hero__copy">
          <span className="grp-eyebrow">{intro.eyebrow}</span>
          <h1 className="grp-title" id="grp-title">
            {intro.title}
          </h1>
          <p className="grp-lead">{intro.lead}</p>

          <dl className="grp-hero__facts">
            <div className="grp-fact">
              <dt>ظرفیت گروه</dt>
              <dd>
                {toFa(capacity.min)} تا {toFa(capacity.max)} نفر
              </dd>
            </div>
            <div className="grp-fact">
              <dt>بیشترین تخفیف</dt>
              <dd>{bestTier?.label}</dd>
            </div>
            <div className="grp-fact">
              <dt>وضعیت پرداخت</dt>
              <dd>{payment.label}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ── لایهٔ دوم: پله‌های تخفیف ── */}
      <GroupTiers
        cycles={cycles}
        cycleId={cycleId}
        onCycleChange={setCycleId}
        tiers={tiers}
        seats={seats}
        onSelectSeats={setSeats}
      />

      {/* ── لایهٔ سوم: دو کنش (ساخت / پیوستن) یا کارت گروه ── */}
      <section
        className="grp-actions section-shell"
        id="grp-actions"
        ref={actionsRef}
        data-reveal
        aria-labelledby="grp-actions-title"
      >
        <header className="grp-section-head">
          <span className="grp-eyebrow">کد اشتراک گروهی</span>
          <h2 className="grp-section-title" id="grp-actions-title">
            کد را بگیر، یا با کد وارد شو
          </h2>
          <p className="grp-section-lead">
            میزبان کد را می‌سازد و برای بقیه می‌فرستد؛ بقیه فقط همان کد را وارد
            می‌کنند. هر دو مسیر به یک گروه می‌رسند.
          </p>
        </header>

        {summary ? (
          <>
            {notice && (
              <p className="grp-notice" role="status">
                <CheckIcon className="grp-notice__icon" />
                {notice}
              </p>
            )}

            <GroupCard
              group={summary}
              onRotate={handleRotate}
              onRemoveMember={handleRemoveMember}
              onLeave={handleLeave}
            />
          </>
        ) : (
          <div className="grp-tabs">
            <div className="grp-tablist" role="tablist" aria-label="مسیر اشتراک گروهی">
              {tabs.map((item) => (
                <button
                  className={`grp-tab ${tab === item.id ? 'is-active' : ''}`}
                  type="button"
                  role="tab"
                  id={`grp-tab-${item.id}`}
                  aria-selected={tab === item.id}
                  aria-controls={`grp-panel-${item.id}`}
                  tabIndex={tab === item.id ? 0 : -1}
                  key={item.id}
                  onClick={() => setTab(item.id)}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>

            <div className="grp-panels">
              <div hidden={tab !== 'create'}>
                <GroupCreatePanel
                  tier={tier}
                  cycle={cycle}
                  seats={seats}
                  displayName={displayName}
                  onDisplayNameChange={setDisplayName}
                  onSubmit={handleCreate}
                  error={tab === 'create' ? error : null}
                />
              </div>

              <div hidden={tab !== 'join'}>
                <GroupJoinPanel
                  code={joinCode}
                  onCodeChange={setJoinCode}
                  prefilled={isPrefilled}
                  displayName={displayName}
                  onDisplayNameChange={setDisplayName}
                  onSubmit={handleJoin}
                  error={tab === 'join' ? error : null}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── لایهٔ چهارم: مراحل کار ── */}
      <section className="grp-steps section-shell" data-reveal aria-labelledby="grp-steps-title">
        <header className="grp-section-head">
          <span className="grp-eyebrow">از ساخت تا فعال‌سازی</span>
          <h2 className="grp-section-title" id="grp-steps-title">
            چهار قدم تا اشتراک گروهی
          </h2>
        </header>

        <ol className="grp-steps__list">
          {steps.map((step) => (
            <li className="grp-step" key={step.id}>
              <span className="grp-step__index" aria-hidden="true">
                {step.index}
              </span>
              <h3 className="grp-step__title">{step.title}</h3>
              <p className="grp-step__text">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── لایهٔ پنجم: پرسش‌های پرتکرار ── */}
      <section className="grp-faq section-shell" data-reveal aria-labelledby="grp-faq-title">
        <header className="grp-section-head">
          <span className="grp-eyebrow">پرسش‌های پرتکرار</span>
          <h2 className="grp-section-title" id="grp-faq-title">
            چیزهایی که قبل از ساخت گروه می‌پرسی
          </h2>
        </header>

        <div className="grp-faq__list">
          {faq.map((item) => (
            <details className="grp-faq__item" key={item.id}>
              <summary className="grp-faq__question">{item.question}</summary>
              <p className="grp-faq__answer">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── لایهٔ ششم: فراخوان پایانی ── */}
      <section className="grp-final section-shell" data-reveal aria-labelledby="grp-final-title">
        <div className="grp-final__panel">
          <div className="grp-final__copy">
            <h2 className="grp-final__title" id="grp-final-title">
              {summary ? (summary.isFull ? 'گروهت کامل شد' : 'منتظر رفقا بمان') : 'هنوز گروهی نساختی؟'}
            </h2>
            <p className="grp-final__lead">
              {summary
                ? summary.isFull
                  ? `کد اشتراک ${summary.code} ظرفیت ${toFa(summary.capacity)} نفره را پر کرده است؛ مرحلهٔ بعد پرداخت گروهی است.`
                  : `${
                      summary.openSeats === 1 ? 'یک جای دیگر' : `${toFa(summary.openSeats)} جای دیگر`
                    } در گروه خالی است. کد اشتراک را برای رفقا بفرست تا ظرفیت کامل شود.`
                : 'ظرفیت را انتخاب کن، کد اشتراک بگیر و لینک دعوت را بفرست؛ بقیهٔ کار را گروه انجام می‌دهد.'}
            </p>
          </div>

          <div className="grp-final__actions">
            {summary ? (
              <CopyButton
                text={buildInviteLink(summary.code)}
                label="کپی لینک دعوت گروه"
                className="grp-cta grp-cta--solid"
              />
            ) : (
              <button className="grp-cta grp-cta--solid" type="button" onClick={() => goToActions('create')}>
                <span className="grp-cta__label">ساخت گروه و گرفتن کد</span>
                <ArrowIcon className="grp-cta__icon" />
              </button>
            )}

            <a className="grp-final__secondary" href="#pricing">
              دیدن تعرفه‌ها
            </a>

            {!userData && (
              <a className="grp-final__secondary" href="#auth" onClick={onStart}>
                ورود / ثبت‌نام برای فعال‌سازی
              </a>
            )}
          </div>
        </div>

        <div className="grp-final__status">
          <span className="grp-final__status-chip">{payment.label}</span>
          <p>{payment.note}</p>
        </div>

        <p className="grp-footnote">
          <AlertIcon className="grp-icon" />
          {intro.footnote}
        </p>

        {!amounts.amountsConfirmed && <p className="grp-footnote grp-footnote--quiet">{amounts.note}</p>}
      </section>
    </main>
  );
}
