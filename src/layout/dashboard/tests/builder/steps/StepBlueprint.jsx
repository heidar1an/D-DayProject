/*
 * Step 4 — «انتخاب سؤال‌ها»: موتور انتخاب اینجا واقعاً اجرا می‌شود و Blueprint
 * (تفکیک + هشدارها) نمایش داده می‌شود.
 */
import { Skeleton } from '../../bank/bankShared';
import BlueprintCard from '../BlueprintCard';
import { Icon } from '../builderShared';

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
    </div>
  );
}
