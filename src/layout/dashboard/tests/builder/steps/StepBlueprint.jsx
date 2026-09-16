/*
 * Step 4 — «انتخاب سؤال‌ها»: موتور انتخاب اینجا واقعاً اجرا می‌شود و Blueprint
 * (تفکیک + هشدارها) نمایش داده می‌شود. دکمهٔ «ترکیب دیگر» با seed تازه دوباره
 * می‌چیند — تولید تکرارپذیر (seed-based) برای آینده از همین مسیر می‌گذرد.
 */
import { Skeleton } from '../../bank/bankShared';
import BlueprintCard from '../BlueprintCard';
import { Icon, SectionCard, faNum } from '../builderShared';

export default function StepBlueprint({ plan, planBusy, planError, onReroll, draft, catalog, subjects }) {
  return (
    <div className="ex-enter space-y-4">
      {planBusy && (
        <div className="space-y-3" aria-hidden="true">
          <Skeleton className="h-14 rounded-[1.5rem]" />
          <Skeleton className="h-56 rounded-[2rem]" />
        </div>
      )}

      {!planBusy && planError && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#e26d6d]/30 bg-[#e26d6d]/[0.07] px-4 py-3.5 text-sm leading-6 text-[var(--red-ink)]" role="alert">
          <Icon name="alert" className="h-4.5 w-4.5 shrink-0" />
          {planError}
          <button
            type="button"
            onClick={onReroll}
            className="cursor-pointer rounded-xl bg-white/8 px-4 py-2 text-xs transition-colors hover:bg-white/14"
          >
            تلاش دوباره
          </button>
        </div>
      )}

      {!planBusy && !planError && plan && (
        <BlueprintCard plan={plan} subjects={subjects} config={draft} />
      )}

      {!planBusy && plan && (
        <SectionCard
          icon="shuffle"
          accent="#5b8cc7"
          title="از این ترکیب راضی هستی؟"
          hint="هر بار «ترکیب دیگر»، انتخاب تازه‌ای بدون تکرار از همان مخزن می‌چیند."
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onReroll}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-white/6 px-4 py-2.5 text-sm text-[var(--muted)] transition-colors hover:bg-white/12 hover:text-white"
            >
              <Icon name="dice" className="h-4 w-4 text-[var(--blue-ink)]" />
              ترکیب دیگر
            </button>
            <p className="text-[11px] leading-5 text-[var(--faint)]">
              {faQuestionsNote(plan)}
            </p>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function faQuestionsNote(plan) {
  const count = plan?.questionIds?.length ?? 0;
  if (!count) return 'هنوز سوئی انتخاب نشده است.';
  return `${faNum(count)} سؤال واقعی از بانک برایت چیده شد؛ ترتیبشان در اجرا تصادفی می‌شود.`;
}
