/*
 * TopicTree — انتخاب درختی مبحث برای درس‌های انتخاب‌شده.
 * انتخاب سطح مبحث = پوشش همهٔ زیرمباحثش (semantics فیلتر بانک: تطبیق در هر سطح
 * topicPath). ابزار سراسری: Select All / Clear All / Invert Selection.
 */
import { useState } from 'react';
import { Icon, toFa } from './builderShared';

const toggleIn = (list, value) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

function BranchRow({ branch, topicPaths, onToggle }) {
  const [open, setOpen] = useState(true);
  const isSelfSelected = topicPaths.includes(branch.name);
  const selectedChildren = branch.children.filter((child) => topicPaths.includes(child.name)).length;
  const allChildrenSelected = branch.children.length > 0 && selectedChildren === branch.children.length;
  const isPartial = !isSelfSelected && selectedChildren > 0;

  return (
    <div className={`ex-tree__branch ${isPartial ? 'is-partial' : ''} ${isSelfSelected || allChildrenSelected ? 'is-full' : ''}`}>
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-label={open ? `بستن ${branch.name}` : `باز کردن ${branch.name}`}
          className="cursor-pointer rounded-lg p-1.5 text-[var(--faint)] transition-colors hover:bg-white/6 hover:text-white"
        >
          <Icon name="chevron" className={`h-3.5 w-3.5 transition-transform ${open ? '' : '-rotate-90'}`} />
        </button>
        <button type="button" className={`ex-check flex-1 !border-transparent !bg-transparent ${isSelfSelected ? '!text-[var(--green-soft-ink)]' : ''}`} aria-pressed={isSelfSelected} onClick={() => onToggle(branch.name)}>
          <span className="ex-check__box" aria-hidden="true">
            {isSelfSelected && <Icon name="check" className="h-3 w-3" strokeWidth={3} />}
          </span>
          <span className="text-[13px] font-bold [font-family:'Doran','Vazir',Tahoma,sans-serif]">{branch.name}</span>
          <span className="ex-check__count">{toFa(branch.count)} تست</span>
        </button>
      </div>

      {open && branch.children.length > 0 && (
        <div className="ex-tree__childgrid px-3 pb-3">
          {branch.children.map((child) => (
            <button
              key={child.name}
              type="button"
              className="ex-check"
              aria-pressed={topicPaths.includes(child.name)}
              onClick={() => onToggle(child.name)}
            >
              <span className="ex-check__box" aria-hidden="true">
                {topicPaths.includes(child.name) && <Icon name="check" className="h-3 w-3" strokeWidth={3} />}
              </span>
              <span className="min-w-0 truncate">{child.name}</span>
              <span className="ex-check__count">{toFa(child.count)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TopicTree({ topicTree, subjectIds, topicPaths, onChange }) {
  if (!subjectIds.length) {
    return (
      <p className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-xs leading-6 text-[var(--faint)]">
        اول حداقل یک درس انتخاب کن تا درخت مبحث‌هایش اینجا باز شود.
      </p>
    );
  }

  /* همهٔ گره‌های قابل انتخاب برای درس‌های فعلی */
  const visibleNodes = subjectIds.flatMap((subjectId) => {
    const branches = topicTree[subjectId] ?? [];
    return branches.flatMap((branch) => [branch.name, ...branch.children.map((child) => child.name)]);
  });
  const selectedVisible = visibleNodes.filter((name) => topicPaths.includes(name));

  const selectAll = () => onChange([...new Set([...topicPaths, ...visibleNodes])]);
  const clearAll = () => onChange(topicPaths.filter((name) => !visibleNodes.includes(name)));
  const invert = () => {
    const next = topicPaths.filter((name) => !visibleNodes.includes(name));
    visibleNodes.forEach((name) => {
      if (!topicPaths.includes(name)) next.push(name);
    });
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-[var(--faint)]">
          {selectedVisible.length
            ? `${toFa(selectedVisible.length)} گره انتخاب شده از ${toFa(visibleNodes.length)}`
            : 'مبحثی انتخاب نشده — کل درس‌های انتخابی در آزمون می‌آیند.'}
        </p>
        <div className="flex gap-1.5">
          {[
            { label: 'انتخاب همه', onClick: selectAll },
            { label: 'پاک کردن', onClick: clearAll },
            { label: 'برعکس', onClick: invert },
          ].map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className="cursor-pointer rounded-lg bg-white/6 px-3 py-1.5 text-[11px] text-[var(--muted)] transition-colors hover:bg-white/12 hover:text-white"
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ex-tree space-y-2.5">
        {subjectIds.map((subjectId) => {
          const branches = topicTree[subjectId] ?? [];
          if (!branches.length) return null;
          return (
            <div key={subjectId} className="space-y-2.5">
              {branches.map((branch) => (
                <BranchRow key={branch.name} branch={branch} topicPaths={topicPaths} onToggle={(name) => onChange(toggleIn(topicPaths, name))} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
