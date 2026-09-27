/*
 * درسنامه جامع — لایهٔ داخل پنل، به همان قاعدهٔ لایهٔ مراجع.
 *
 * از کارت «درسنامه جامع» در بخش «صفحات» باز می‌شود (`navigate('comprehensive-library')`)
 * و `onBack` به همان بخش برمی‌گرداند. در سایدبار آیتم جداگانه‌ای ندارد.
 *
 * چیدمان، آینهٔ «مراجع تپش» است (الگوی پروژه برای لایه‌ای که کارش ادیت و کنترلِ
 * کل محتواست):
 *   نوار بالا  → انتخاب درس + جست‌وجو/وضعیت + شمارنده‌ها + ذخیره + انتشار
 *   دو ستون    → درخت درس/مبحث/واحد (`ad-ref__tree`) | ویرایشگر گرهٔ انتخابی
 *                (`ad-ref__editor`)
 *
 * سه سطحِ مدیریت همان خواستهٔ اصلی است — درس به درس، مبحث به مبحث، واحد به واحد:
 *   ۱) مشخصات درس (عنوان، زیرعنوان، توضیح)
 *   ۲) افزودن/حذف و جابه‌جاییِ مبحث (درخت، با فلش‌های بالا/پایین)
 *   ۳) افزودن/حذف و جابه‌جاییِ واحد داخل هر مبحث، و ویرایش همهٔ متن‌ها و تست‌های
 *      آن واحد: فعال‌سازی (تست‌های گرم‌کردن)، متن‌های میکرودرس، تصویرسازی
 *      (ساختارها و لایه‌ها)، تمرین و تست نقشه.
 *
 * ذخیره‌سازی یک رکورد کامل است (درس + مبحث‌ها + واحدها + learning هر واحد)، پس
 * ویرایش یک `PUT` کامل می‌فرستد و انتشار اتمیک می‌ماند — همان قرارداد مراجع و
 * میکرو. درس‌ها ثابت‌اند (ساخت/حذف ندارد)؛ کنترل یعنی ویرایش محتوا و انتشار.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { comprehensive as comprehensiveApi } from '../../../services/admin/adminService';
import {
  Badge, Button, EmptyState, ErrorState, Field, IconButton, Input, LoadingBlock,
  SearchInput, Select, StatusBadge, Textarea, faDateTime, faNumber, useAsync, useToast,
} from '../adminShared';
import {
  IconBookOpen, IconChevron, IconEdit, IconPlus, IconRefresh, IconSend, IconTrash,
} from '../adminIcons';

const STATUS_OPTIONS = [
  { value: 'all', label: 'همهٔ وضعیت‌ها' },
  { value: 'published', label: 'منتشرشده' },
  { value: 'draft', label: 'پیش‌نویس' },
  { value: 'archived', label: 'بایگانی' },
];

/* وضعیت انتشار در ویرایشگر — دکمهٔ نوار بالا همان را اتمیک انجام می‌دهد */
const PUBLISH_OPTIONS = [
  { value: 'published', label: 'منتشرشده (برای کاربران)' },
  { value: 'draft', label: 'پیش‌نویس' },
  { value: 'archived', label: 'بایگانی' },
];

const STEP_LABELS = {
  activate: 'فعال‌سازی',
  learn: 'یادگیری',
  visualize: 'تصویرسازی',
  practice: 'تمرین',
  test: 'تست',
};

/* ── ابزارهای خالص (برای سنجشِ بدون مرورگر هم قابل استفاده‌اند) ── */

/*
 * شناسهٔ موقت سمت کلاینت — سرور شناسهٔ داده‌شده را نگه می‌دارد، پس دو مبحث/واحد
 * تازه در یک نشست هرگز روی کلید `unitsByModule` یکسان نمی‌افتند.
 */
const tempId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function newComprehensiveModule(index) {
  return {
    id: tempId('cmod'),
    order: index + 1,
    title: '',
    description: '',
    unitCount: 0,
    tests: 0,
    progress: 0,
    status: 'fresh',
    lastActivity: 'هنوز شروع نشده',
  };
}

export function newComprehensiveUnit(moduleId, index) {
  return {
    id: tempId('cunit'),
    moduleId,
    order: index + 1,
    title: '',
    description: '',
    estimatedTime: 30,
    sectionCount: 6,
    tests: 0,
    objectives: [],
    prerequisites: [],
    status: 'fresh',
    progress: 0,
    mastery: 0,
    lastActivity: 'هنوز شروع نشده',
    steps: ['activate', 'learn', 'visualize', 'practice', 'test'],
    learning: {
      activate: { tests: [] },
      microLessons: [],
      visualize: { title: '', instruction: '', structures: [], layers: [] },
      practice: [],
      labelQuiz: null,
    },
  };
}

/* تعداد تست‌های یک واحد — فعال‌سازی + تمرین + تست نقشه */
export function unitTestCount(unit) {
  const learning = unit?.learning ?? {};
  return (learning.activate?.tests?.length ?? 0)
    + (learning.practice?.length ?? 0)
    + (learning.labelQuiz ? 1 : 0);
}

/* خطوط یک textarea چندخطی → آرایهٔ تمیز */
function linesOf(value) {
  return String(value ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
}

/* ── اجزای کوچک ── */

/* ردیف بالا/پایین/حذف برای هر گرهٔ درخت */
function NodeActions({ onMove, onRemove, canMoveUp = true, canMoveDown = true, label }) {
  return (
    <span className="ad-ref__nodeactions">
      {onMove ? (
        <>
          <IconButton label={`انتقال ${label} به بالا`} disabled={!canMoveUp} onClick={() => onMove(-1)}>
            <IconChevron width={14} height={14} style={{ transform: 'rotate(-90deg)' }} />
          </IconButton>
          <IconButton label={`انتقال ${label} به پایین`} disabled={!canMoveDown} onClick={() => onMove(1)}>
            <IconChevron width={14} height={14} style={{ transform: 'rotate(90deg)' }} />
          </IconButton>
        </>
      ) : null}
      {onRemove ? (
        <IconButton label={`حذف ${label}`} tone="danger" onClick={onRemove}><IconTrash width={14} height={14} /></IconButton>
      ) : null}
    </span>
  );
}

/* ── ویرایشگرهای گره‌ها ── */

/* گرهٔ «مشخصات درس»
   (export شده تا بشود بدون مرورگر هم رندر و سنجید، مثل `ReferenceEditor`) */
export function CourseEditor({ course, onChange }) {
  const set = (changes) => onChange({ ...course, ...changes });

  return (
    <div className="ad-stack">
      <div className="ad-ref__group">
        <div className="ad-ref__grouphead">
          <h4>شناسهٔ درس</h4>
          {course.origin === 'tapesh' ? <Badge tone="neutral">تپش</Badge> : null}
        </div>
        <div className="ad-grid2">
          <Field label="عنوان درس" required hint="روی کارت «درسنامه جامع» و سرصفحهٔ لایه می‌آید.">
            <Input value={course.title ?? ''} onChange={(event) => set({ title: event.target.value })} />
          </Field>
          <Field label="زیرعنوان">
            <Input value={course.subtitle ?? ''} onChange={(event) => set({ subtitle: event.target.value })} />
          </Field>
        </div>
        <Field label="توضیح درس" hint="متن معرفی کوتاه درس.">
          <Textarea rows={3} value={course.description ?? ''} onChange={(event) => set({ description: event.target.value })} />
        </Field>
        <Field label="وضعیت انتشار" hint="دکمهٔ نوار بالا هم همین را اتمیک ذخیره می‌کند.">
          <Select options={PUBLISH_OPTIONS} value={course.status ?? 'draft'} onChange={(event) => set({ status: event.target.value })} aria-label="وضعیت انتشار" />
        </Field>
      </div>
    </div>
  );
}

/* گرهٔ هر مبحث — عنوان و توضیح مبحث (واحدهایش گره‌های زیرین‌اند) */
export function ModuleEditor({ module_, index, total, onChange }) {
  const set = (changes) => onChange({ ...module_, ...changes });

  return (
    <div className="ad-stack">
      <div className="ad-ref__group">
        <div className="ad-ref__grouphead">
          <h4>عنوان مبحث</h4>
          <span className="ad-sub">مبحث {faNumber(index + 1)} از {faNumber(total)}</span>
        </div>
        <Field label="عنوان مبحث" hint="در فهرست مباحث درس و در درخت سمت راست دیده می‌شود.">
          <Input
            value={module_.title ?? ''}
            onChange={(event) => set({ title: event.target.value })}
            placeholder="مثال: اندام فوقانی"
          />
        </Field>
        <Field label="توضیح مبحث">
          <Textarea rows={2} value={module_.description ?? ''} onChange={(event) => set({ description: event.target.value })} />
        </Field>
      </div>

      <div className="ad-ref__group">
        <div className="ad-ref__grouphead">
          <h4>واحدهای این مبحث</h4>
          <span className="ad-sub">{faNumber(module_.unitCount ?? 0)} واحد</span>
        </div>
        <p className="ad-ref__hint">
          متن و تست هر واحد روی گره‌های زیرین این مبحث نشسته است. از درخت سمت راست
          واحد تازه اضافه کنید یا یکی را انتخاب کنید تا محتوایش را ویرایش کنید.
        </p>
      </div>
    </div>
  );
}

/* ویرایشگر یک تست چهارگزینه‌ای — هم برای فعال‌سازی، هم برای تمرین */
function QuestionEditor({ question, index, withMisconception = false, onChange, onRemove }) {
  const set = (changes) => onChange({ ...question, ...changes });
  const options = question.options ?? [];
  const optionLabels = ['۱', '۲', '۳', '۴', '۵', '۶'];

  return (
    <div className="ad-ref__group">
      <div className="ad-ref__grouphead">
        <h4>تست {faNumber(index + 1)}</h4>
        <IconButton label="حذف تست" tone="danger" onClick={onRemove}><IconTrash width={14} height={14} /></IconButton>
      </div>

      <Field label="صورت سؤال">
        <Textarea rows={2} value={question.question ?? ''} onChange={(event) => set({ question: event.target.value })} />
      </Field>

      <div className="ad-grid2">
        {options.map((option, optionIndex) => (
          <Field key={option.id ?? optionIndex} label={`گزینهٔ ${optionLabels[optionIndex] ?? optionIndex + 1}`}>
            <Input
              value={option.label ?? ''}
              onChange={(event) => set({
                options: options.map((item, i) => (i === optionIndex ? { ...item, label: event.target.value } : item)),
              })}
            />
          </Field>
        ))}
      </div>

      <div className="ad-grid2">
        <Field label="گزینهٔ درست">
          <Select
            options={options.map((option, optionIndex) => ({ value: option.id, label: `گزینهٔ ${optionLabels[optionIndex] ?? optionIndex + 1}` }))}
            value={question.answer ?? ''}
            onChange={(event) => set({ answer: event.target.value })}
            aria-label="گزینهٔ درست"
          />
        </Field>
        <Field label="توضیح پاسخ">
          <Input value={question.explanation ?? ''} onChange={(event) => set({ explanation: event.target.value })} />
        </Field>
      </div>

      {withMisconception ? (
        <Field label="اشتباه رایج" hint="پیامی که هنگام پاسخ اشتباه نشان داده می‌شود.">
          <Input value={question.misconception ?? ''} onChange={(event) => set({ misconception: event.target.value })} />
        </Field>
      ) : null}
    </div>
  );
}

/* ویرایشگر یک میکرودرس — متن‌های یادگیری واحد */
function MicroLessonEditor({ lesson, index, onChange, onRemove }) {
  const set = (changes) => onChange({ ...lesson, ...changes });

  return (
    <div className="ad-ref__group">
      <div className="ad-ref__grouphead">
        <h4>میکرودرس {faNumber(index + 1)}</h4>
        <IconButton label="حذف میکرودرس" tone="danger" onClick={onRemove}><IconTrash width={14} height={14} /></IconButton>
      </div>

      <div className="ad-grid2">
        <Field label="عنوان میکرودرس">
          <Input value={lesson.title ?? ''} onChange={(event) => set({ title: event.target.value })} />
        </Field>
        <Field label="هدف">
          <Input value={lesson.objective ?? ''} onChange={(event) => set({ objective: event.target.value })} />
        </Field>
      </div>
      <Field label="توضیح ساده">
        <Textarea rows={2} value={lesson.simple ?? ''} onChange={(event) => set({ simple: event.target.value })} />
      </Field>
      <Field label="توضیح علمی">
        <Textarea rows={3} value={lesson.scientific ?? ''} onChange={(event) => set({ scientific: event.target.value })} />
      </Field>
      <div className="ad-grid2">
        <Field label="نکتهٔ برجسته"><Input value={lesson.highlight ?? ''} onChange={(event) => set({ highlight: event.target.value })} /></Field>
        <Field label="مثال"><Input value={lesson.example ?? ''} onChange={(event) => set({ example: event.target.value })} /></Field>
      </div>
      <Field label="اتصال به درس‌های دیگر">
        <Input value={lesson.connection ?? ''} onChange={(event) => set({ connection: event.target.value })} />
      </Field>
    </div>
  );
}

/* ویرایشگر واحد — همهٔ متن‌ها و تست‌های یک واحد، گروه‌بندی‌شده بر اساس مرحله */
export function UnitEditor({ unit, onChange }) {
  const learning = unit.learning ?? {};
  const set = (changes) => onChange({ ...unit, ...changes });
  const setLearning = (changes) => onChange({ ...unit, learning: { ...learning, ...changes } });

  const activateTests = learning.activate?.tests ?? [];
  const microLessons = learning.microLessons ?? [];
  const structures = learning.visualize?.structures ?? [];
  const layers = learning.visualize?.layers ?? [];
  const practice = learning.practice ?? [];
  const labelQuiz = learning.labelQuiz ?? null;

  const mapActivate = (mapper) => setLearning({
    activate: { ...(learning.activate ?? {}), tests: mapper(activateTests) },
  });
  const mapVisualize = (mapper) => setLearning({
    visualize: { ...(learning.visualize ?? {}), ...mapper },
  });
  const mapPractice = (mapper) => setLearning({ practice: mapper(practice) });
  const mapLessons = (mapper) => setLearning({ microLessons: mapper(microLessons) });

  return (
    <div className="ad-stack">
      <div className="ad-ref__group">
        <div className="ad-ref__grouphead">
          <h4>شناسنامهٔ واحد</h4>
          <span className="ad-sub">{faNumber(unitTestCount(unit))} تست</span>
        </div>
        <Field label="عنوان واحد" hint="روی کارت واحد در لایهٔ درس و در درخت سمت راست می‌آید.">
          <Input value={unit.title ?? ''} onChange={(event) => set({ title: event.target.value })} />
        </Field>
        <Field label="توضیح واحد">
          <Textarea rows={2} value={unit.description ?? ''} onChange={(event) => set({ description: event.target.value })} />
        </Field>
        <div className="ad-grid2">
          <Field label="زمان تقریبی (دقیقه)">
            <Input type="number" min="0" value={unit.estimatedTime ?? 0} onChange={(event) => set({ estimatedTime: Number(event.target.value) || 0 })} />
          </Field>
          <Field label="تعداد کادرهای سرتیتر">
            <Input type="number" min="0" value={unit.sectionCount ?? 0} onChange={(event) => set({ sectionCount: Number(event.target.value) || 0 })} />
          </Field>
        </div>
        <Field label="هدف‌های یادگیری" hint="هر خط یک هدف.">
          <Textarea rows={3} value={(unit.objectives ?? []).join('\n')} onChange={(event) => set({ objectives: linesOf(event.target.value) })} />
        </Field>
        <Field label="پیش‌نیازها" hint="هر خط یک پیش‌نیاز.">
          <Textarea rows={2} value={(unit.prerequisites ?? []).join('\n')} onChange={(event) => set({ prerequisites: linesOf(event.target.value) })} />
        </Field>
      </div>

      <div className="ad-ref__group">
        <div className="ad-ref__grouphead">
          <h4>فعال‌سازی — تست‌های گرم‌کردن</h4>
          <Button variant="ghost" size="sm" onClick={() => mapActivate((tests) => [...tests, {
            id: '', question: '', options: [
              { id: '', label: '' }, { id: '', label: '' }, { id: '', label: '' }, { id: '', label: '' },
            ], answer: '', explanation: '',
          }])}>
            <IconPlus width={13} height={13} /> تست تازه
          </Button>
        </div>
        {activateTests.length ? activateTests.map((question, index) => (
          <QuestionEditor
            key={question.id ?? index}
            question={question}
            index={index}
            onChange={(next) => mapActivate((tests) => tests.map((item, i) => (i === index ? next : item)))}
            onRemove={() => mapActivate((tests) => tests.filter((_, i) => i !== index))}
          />
        )) : (
          <p className="ad-ref__hint">این واحد تست فعال‌سازی ندارد.</p>
        )}
      </div>

      <div className="ad-ref__group">
        <div className="ad-ref__grouphead">
          <h4>یادگیری — متن میکرودرس‌ها</h4>
          <Button variant="ghost" size="sm" onClick={() => mapLessons((lessons) => [...lessons, {
            id: '', title: '', objective: '', simple: '', scientific: '', highlight: '', example: '', connection: '', concepts: [],
          }])}>
            <IconPlus width={13} height={13} /> میکرودرس تازه
          </Button>
        </div>
        {microLessons.length ? microLessons.map((lesson, index) => (
          <MicroLessonEditor
            key={lesson.id ?? index}
            lesson={lesson}
            index={index}
            onChange={(next) => mapLessons((lessons) => lessons.map((item, i) => (i === index ? next : item)))}
            onRemove={() => mapLessons((lessons) => lessons.filter((_, i) => i !== index))}
          />
        )) : (
          <p className="ad-ref__hint">این واحد میکرودرس ندارد؛ مرحلهٔ یادگیری خالی می‌ماند.</p>
        )}
      </div>

      <div className="ad-ref__group">
        <div className="ad-ref__grouphead">
          <h4>تصویرسازی — نقشهٔ فضایی</h4>
          <Button variant="ghost" size="sm" onClick={() => mapVisualize({
            structures: [...structures, { id: '', label: '', x: 50, y: 50, detail: '' }],
          })}>
            <IconPlus width={13} height={13} /> ساختار تازه
          </Button>
        </div>
        <div className="ad-grid2">
          <Field label="عنوان نقشه"><Input value={learning.visualize?.title ?? ''} onChange={(event) => mapVisualize({ title: event.target.value })} /></Field>
          <Field label="راهنمای نقشه"><Input value={learning.visualize?.instruction ?? ''} onChange={(event) => mapVisualize({ instruction: event.target.value })} /></Field>
        </div>

        {structures.length ? (
          <div className="ad-stack">
            {structures.map((structure, index) => (
              <div key={structure.id ?? index} className="ad-ref__group">
                <div className="ad-ref__grouphead">
                  <h4>ساختار {faNumber(index + 1)}</h4>
                  <IconButton
                    label="حذف ساختار"
                    tone="danger"
                    onClick={() => mapVisualize({ structures: structures.filter((_, i) => i !== index) })}
                  >
                    <IconTrash width={14} height={14} />
                  </IconButton>
                </div>
                <div className="ad-grid2">
                  <Field label="برچسب">
                    <Input
                      value={structure.label ?? ''}
                      onChange={(event) => mapVisualize({
                        structures: structures.map((item, i) => (i === index ? { ...item, label: event.target.value } : item)),
                      })}
                    />
                  </Field>
                  <Field label="توضیح">
                    <Input
                      value={structure.detail ?? ''}
                      onChange={(event) => mapVisualize({
                        structures: structures.map((item, i) => (i === index ? { ...item, detail: event.target.value } : item)),
                      })}
                    />
                  </Field>
                </div>
                <div className="ad-grid2">
                  <Field label="مختصات افقی (٪)">
                    <Input
                      type="number" min="0" max="100" dir="ltr"
                      value={structure.x ?? 50}
                      onChange={(event) => mapVisualize({
                        structures: structures.map((item, i) => (i === index ? { ...item, x: Math.min(100, Math.max(0, Number(event.target.value) || 0)) } : item)),
                      })}
                    />
                  </Field>
                  <Field label="مختصات عمودی (٪)">
                    <Input
                      type="number" min="0" max="100" dir="ltr"
                      value={structure.y ?? 50}
                      onChange={(event) => mapVisualize({
                        structures: structures.map((item, i) => (i === index ? { ...item, y: Math.min(100, Math.max(0, Number(event.target.value) || 0)) } : item)),
                      })}
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="ad-ref__hint">این واحد ساختار تصویری ندارد.</p>
        )}

        {layers.length ? (
          <div className="ad-grid2">
            {layers.map((layer, index) => (
              <Field key={layer.id ?? index} label={`لایهٔ ${faNumber(index + 1)}`}>
                <Input
                  value={layer.label ?? ''}
                  onChange={(event) => mapVisualize({
                    layers: layers.map((item, i) => (i === index ? { ...item, label: event.target.value } : item)),
                  })}
                />
              </Field>
            ))}
          </div>
        ) : null}
      </div>

      <div className="ad-ref__group">
        <div className="ad-ref__grouphead">
          <h4>تمرین — سؤالات مرحلهٔ تمرین</h4>
          <Button variant="ghost" size="sm" onClick={() => mapPractice((questions) => [...questions, {
            id: '', type: 'mcq', question: '', options: [
              { id: '', label: '' }, { id: '', label: '' }, { id: '', label: '' }, { id: '', label: '' },
            ], answer: '', explanation: '', misconception: '',
          }])}>
            <IconPlus width={13} height={13} /> سؤال تازه
          </Button>
        </div>
        {practice.length ? practice.map((question, index) => (
          <QuestionEditor
            key={question.id ?? index}
            question={question}
            index={index}
            withMisconception
            onChange={(next) => mapPractice((questions) => questions.map((item, i) => (i === index ? next : item)))}
            onRemove={() => mapPractice((questions) => questions.filter((_, i) => i !== index))}
          />
        )) : (
          <p className="ad-ref__hint">این واحد سؤال تمرین ندارد.</p>
        )}
      </div>

      <div className="ad-ref__group">
        <div className="ad-ref__grouphead">
          <h4>تست نقشه (انتخاب نقطه)</h4>
          {labelQuiz ? (
            <IconButton label="حذف تست نقشه" tone="danger" onClick={() => setLearning({ labelQuiz: null })}>
              <IconTrash width={14} height={14} />
            </IconButton>
          ) : (
            <Button
              variant="ghost" size="sm"
              disabled={!structures.length}
              onClick={() => setLearning({ labelQuiz: { id: '', prompt: '', answer: structures[0]?.id ?? '', explanation: '' } })}
            >
              <IconPlus width={13} height={13} /> افزودن تست نقشه
            </Button>
          )}
        </div>
        {labelQuiz ? (
          labelQuiz.answer && !structures.some((structure) => structure.id === labelQuiz.answer) ? (
            <p className="ad-ref__hint">پاسخ ثبت‌شدهٔ این تست در ساختارهای فعلی نیست؛ پس از انتخاب پاسخ تازه درست می‌شود.</p>
          ) : null
        ) : (
          <p className="ad-ref__hint">
            {structures.length
              ? 'این واحد تست نقشه ندارد؛ کاربر باید محل یک ساختار را روی نقشه پیدا کند.'
              : 'برای تست نقشه دست‌کم یک ساختار به نقشه اضافه کنید.'}
          </p>
        )}
        {labelQuiz ? (
          <>
            <Field label="صورت سؤال">
              <Textarea rows={2} value={labelQuiz.prompt ?? ''} onChange={(event) => setLearning({ labelQuiz: { ...labelQuiz, prompt: event.target.value } })} />
            </Field>
            <Field label="پاسخ درست (ساختار روی نقشه)">
              <Select
                options={structures.map((structure) => ({ value: structure.id, label: structure.label }))}
                value={structures.some((structure) => structure.id === labelQuiz.answer) ? labelQuiz.answer : ''}
                onChange={(event) => setLearning({ labelQuiz: { ...labelQuiz, answer: event.target.value } })}
                aria-label="پاسخ درست"
              />
            </Field>
            <Field label="توضیح پاسخ">
              <Input value={labelQuiz.explanation ?? ''} onChange={(event) => setLearning({ labelQuiz: { ...labelQuiz, explanation: event.target.value } })} />
            </Field>
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ────────────────────────── ویوی اصلی ────────────────────────── */

export default function AdminComprehensive({ admin, onBack }) {
  const notify = useToast();
  const [filters, setFilters] = useState({ search: '', status: 'all' });
  const [courseId, setCourseId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [node, setNode] = useState({ kind: 'course' });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  /* گره‌های بستهٔ درخت — کلید مبحث `m:<index>`؛ پیش‌فرض «همه باز» مثل مراجع */
  const [collapsed, setCollapsed] = useState(() => new Set());

  const toggleBranch = (key) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  const can = (permission) => admin?.permissions?.includes(permission);

  const listLoad = useCallback(
    () => comprehensiveApi.list({ search: filters.search, status: filters.status, perPage: 100 }),
    [filters.search, filters.status],
  );
  const { data: listData, error: listError, reload: reloadList } = useAsync(listLoad, [filters.search, filters.status]);

  /* اولین درس خودکار انتخاب می‌شود تا ورود به لایه خالی نباشد */
  useEffect(() => {
    if (courseId || !listData) return;
    setCourseId(listData.items?.[0]?.id ?? null);
  }, [listData, courseId]);

  const courseLoad = useCallback(
    () => (courseId ? comprehensiveApi.get(courseId) : Promise.resolve(null)),
    [courseId],
  );
  const { data: courseData, loading, error, reload } = useAsync(courseLoad, [courseId]);

  useEffect(() => {
    setDraft(courseData?.course ?? null);
    setDirty(false);
    setNode({ kind: 'course' });
  }, [courseData]);

  const mutate = useCallback((mutator) => {
    setDraft((current) => (current ? mutator(current) : current));
    setDirty(true);
  }, []);

  const save = useCallback(async ({ silent = false } = {}) => {
    if (!draft) return null;
    setBusy(true);
    try {
      const data = await comprehensiveApi.update(draft.id, draft);
      setDraft(data.course);
      setDirty(false);
      if (!silent) notify('تغییرات درسنامه ذخیره شد');
      reloadList();
      return data.course;
    } catch (actionError) {
      notify(actionError.message, 'error');
      return null;
    } finally {
      setBusy(false);
    }
  }, [draft, notify, reloadList]);

  /* انتشار = ذخیره (اگر لازم باشد) + تغییر وضعیت. از لحظهٔ انتشار، درسنامه از
     `/api/public/comprehensive/library` در دسترس لایهٔ یادگیری کاربران می‌گذارد. */
  const setPublished = useCallback(async (status) => {
    const current = dirty ? await save({ silent: true }) : draft;
    if (!current) return;
    setBusy(true);
    try {
      const data = await comprehensiveApi.update(current.id, { ...current, status });
      setDraft(data.course);
      setDirty(false);
      notify(status === 'published'
        ? 'درسنامه برای کاربران تپش منتشر شد'
        : 'انتشار برداشته شد — محتوا دست‌نخورده ماند');
      reloadList();
    } catch (actionError) {
      notify(actionError.message, 'error');
    } finally {
      setBusy(false);
    }
  }, [dirty, draft, save, notify, reloadList]);

  /* ── عملیات ساختار ── */

  const actions = useMemo(() => {
    const mapModules = (course, moduleIndex, mapper) => ({
      ...course,
      modules: course.modules.map((module_, i) => (i === moduleIndex ? mapper(module_) : module_)),
    });
    const mapUnits = (course, moduleIndex, mapper) => mapModules(course, moduleIndex, (module_) => ({
      ...module_,
      unitCount: mapper(course.unitsByModule?.[module_.id] ?? []).length,
    }));
    const setUnits = (course, moduleIndex, units) => ({
      ...mapUnits(course, moduleIndex, () => units),
      unitsByModule: { ...course.unitsByModule, [course.modules[moduleIndex].id]: units },
    });
    const move = (list, index, direction) => {
      const target = index + direction;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    };
    const renumber = (list) => list.map((item, index) => ({ ...item, order: index + 1 }));

    return {
      addModule: () => mutate((course) => ({
        ...course,
        modules: renumber([...course.modules, newComprehensiveModule(course.modules.length)]),
      })),
      removeModule: (moduleIndex) => mutate((course) => {
        const module_ = course.modules[moduleIndex];
        const unitsByModule = { ...course.unitsByModule };
        delete unitsByModule[module_.id];
        return {
          ...course,
          modules: renumber(course.modules.filter((_, i) => i !== moduleIndex)),
          unitsByModule,
        };
      }),
      moveModule: (moduleIndex, direction) => mutate((course) => ({
        ...course,
        modules: renumber(move(course.modules, moduleIndex, direction)),
      })),

      addUnit: (moduleIndex) => mutate((course) => {
        const module_ = course.modules[moduleIndex];
        const units = course.unitsByModule?.[module_.id] ?? [];
        return setUnits(course, moduleIndex, [...units, newComprehensiveUnit(module_.id, units.length)]);
      }),
      removeUnit: (moduleIndex, unitIndex) => mutate((course) => {
        const module_ = course.modules[moduleIndex];
        const units = course.unitsByModule?.[module_.id] ?? [];
        return setUnits(course, moduleIndex, renumber(units.filter((_, i) => i !== unitIndex)));
      }),
      moveUnit: (moduleIndex, unitIndex, direction) => mutate((course) => {
        const module_ = course.modules[moduleIndex];
        const units = course.unitsByModule?.[module_.id] ?? [];
        return setUnits(course, moduleIndex, renumber(move(units, unitIndex, direction)));
      }),
    };
  }, [mutate]);

  const changeModule = (moduleIndex, module_) => mutate((course) => ({
    ...course,
    modules: course.modules.map((item, i) => (i === moduleIndex ? module_ : item)),
  }));

  const changeUnit = (moduleIndex, unitIndex, unit) => mutate((course) => {
    const moduleId = course.modules[moduleIndex].id;
    return {
      ...course,
      unitsByModule: {
        ...course.unitsByModule,
        [moduleId]: (course.unitsByModule?.[moduleId] ?? []).map((item, i) => (i === unitIndex ? unit : item)),
      },
    };
  });

  /* ── گرهٔ انتخابی ── */

  const selected = useMemo(() => {
    if (!draft || !node || node.kind === 'course') return {};
    const module_ = draft.modules?.[node.moduleIndex];
    return {
      module: module_,
      unit: module_ ? draft.unitsByModule?.[module_.id]?.[node.unitIndex] : null,
    };
  }, [draft, node]);

  /* انتخاب واحد/مبحث، شاخهٔ والدش را باز می‌کند تا گرهٔ انتخاب‌شده پنهان نماند */
  useEffect(() => {
    if (node.kind === 'course') return;
    setCollapsed((current) => {
      const next = new Set(current);
      next.delete(`m:${node.moduleIndex}`);
      return next.size === current.size ? current : next;
    });
  }, [node]);

  const renderEditor = () => {
    if (!draft) return null;

    if (node.kind === 'module') {
      return selected.module
        ? (
          <ModuleEditor
            module_={selected.module}
            index={node.moduleIndex}
            total={draft.modules.length}
            onChange={(module_) => changeModule(node.moduleIndex, module_)}
          />
        )
        : <EmptyState title="این مبحث پیدا نشد" description="با تغییر ساختار، انتخاب قبلی معتبر نمانده است." />;
    }

    if (node.kind === 'unit') {
      return selected.unit
        ? <UnitEditor unit={selected.unit} onChange={(unit) => changeUnit(node.moduleIndex, node.unitIndex, unit)} />
        : <EmptyState title="این واحد پیدا نشد" description="با تغییر ساختار، انتخاب قبلی معتبر نمانده است." />;
    }

    return <CourseEditor course={draft} onChange={(course) => mutate(() => course)} />;
  };

  const counts = useMemo(() => {
    const modules = draft?.modules ?? [];
    const units = modules.flatMap((module_) => draft?.unitsByModule?.[module_.id] ?? []);
    return {
      modules: modules.length,
      units: units.length,
      lessons: units.reduce((total, unit) => total + (unit.learning?.microLessons?.length ?? 0), 0),
      tests: units.reduce((total, unit) => total + unitTestCount(unit), 0),
    };
  }, [draft]);

  const published = draft?.status === 'published';

  return (
    <div className="ad-stack">
      <div className="ad-toolbar">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <IconChevron width={15} height={15} style={{ transform: 'rotate(180deg)' }} />
          بازگشت به صفحات
        </Button>

        <Select
          options={(listData?.items ?? []).map((item) => ({
            value: item.id,
            label: `${item.title}${item.status === 'published' ? ' ✓' : ''}`,
          }))}
          value={courseId ?? ''}
          onChange={(event) => setCourseId(event.target.value)}
          aria-label="درس"
        />

        <SearchInput value={filters.search} onChange={(search) => setFilters((current) => ({ ...current, search }))} placeholder="جست‌وجوی درس…" />
        <Select options={STATUS_OPTIONS} value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} aria-label="وضعیت" />

        <div className="ad-toolbar__end">
          <Button variant="ghost" size="sm" onClick={() => { reloadList(); if (courseId) reload(); }}>
            <IconRefresh width={15} height={15} />تازه‌سازی
          </Button>
        </div>
      </div>

      {listError ? <ErrorState error={listError} onRetry={reloadList} /> : null}
      {error ? <ErrorState error={error} onRetry={reload} /> : null}
      {loading && !draft ? <LoadingBlock label="در حال خواندن درسنامه…" rows={5} /> : null}

      {!loading && !draft && !error ? (
        <EmptyState
          title="هنوز درسنامه‌ای ثبت نشده"
          description="درسنامهٔ جامعِ هر درس از محتوای همان درس ساخته می‌شود؛ وقتی محتوا آماده باشد اینجا رکوردش را می‌بینید."
        />
      ) : null}

      {draft ? (
        <>
          <div className="ad-ref__bar">
            <span className="ad-ref__bartitle">
              <IconBookOpen width={17} height={17} />
              <strong>{draft.title}</strong>
              <StatusBadge status={draft.status} />
              {dirty ? <Badge tone="neutral">ذخیره‌نشده</Badge> : null}
            </span>

            <span className="ad-ref__barmeta">
              <span className="ad-sub">{faNumber(counts.modules)} مبحث</span>
              <span className="ad-sub">{faNumber(counts.units)} واحد</span>
              <span className="ad-sub">{faNumber(counts.lessons)} میکرودرس</span>
              <span className="ad-sub">{faNumber(counts.tests)} تست</span>
              <span className="ad-sub">آخرین ویرایش {faDateTime(draft.updatedAt)}</span>
              {draft.publishedAt ? <span className="ad-sub">انتشار {faDateTime(draft.publishedAt)}</span> : null}
            </span>

            <span className="ad-ref__baractions">
              {can('comprehensive.update') ? (
                <Button size="sm" variant="ghost" loading={busy} disabled={!dirty} onClick={() => save()}>
                  ذخیره تغییرات
                </Button>
              ) : null}

              {can('comprehensive.publish') ? (
                published ? (
                  <Button size="sm" variant="ghost" loading={busy} onClick={() => setPublished('draft')}>
                    لغو انتشار
                  </Button>
                ) : (
                  <Button size="sm" loading={busy} onClick={() => setPublished('published')}>
                    <IconSend width={15} height={15} />
                    انتشار برای کاربران تپش
                  </Button>
                )
              ) : null}
            </span>
          </div>

          {published ? (
            <p className="ad-ref__hint">
              این درسنامه منتشر شده است و از مسیر <code className="ad-code" dir="ltr">/api/public/comprehensive/library</code> برای
              درسنامهٔ جامع کاربران تپش سرو می‌شود. هر تغییر بعدی با «ذخیره تغییرات» روی همان نسخهٔ منتشرشده می‌نشیند.
            </p>
          ) : null}

          <div className="ad-ref__layout">
            <nav className="ad-ref__tree" aria-label="ساختار درسنامه">
              <div className="ad-ref__treebar">
                <span className="ad-sub">{faNumber(counts.modules)} مبحث · {faNumber(counts.units)} واحد</span>
                {can('comprehensive.update') ? (
                  <Button variant="ghost" size="sm" onClick={actions.addModule}>
                    <IconPlus width={13} height={13} /> مبحث جدید
                  </Button>
                ) : null}
              </div>

              <div className={`ad-ref__node ${node.kind === 'course' ? 'is-active' : ''}`}>
                <button type="button" className="ad-ref__nodetoggle" onClick={() => setNode({ kind: 'course' })}>
                  <IconBookOpen width={15} height={15} />
                  <span className="ad-ref__nodelabel">مشخصات درس</span>
                </button>
              </div>

              {draft.modules.map((module_, moduleIndex) => {
                const branchKey = `m:${moduleIndex}`;
                const open = !collapsed.has(branchKey);
                const units = draft.unitsByModule?.[module_.id] ?? [];

                return (
                  <div key={module_.id ?? `module-${moduleIndex}`} className="ad-ref__branch">
                    <div className={`ad-ref__node ${node.kind === 'module' && node.moduleIndex === moduleIndex ? 'is-active' : ''}`}>
                      {can('comprehensive.update') ? (
                        <button
                          type="button"
                          className={`ad-ref__caret ${open ? 'is-open' : ''}`}
                          onClick={() => toggleBranch(branchKey)}
                          aria-expanded={open}
                          aria-label={`${open ? 'بستن' : 'باز کردن'} ${module_.title || 'مبحث'}`}
                          title={open ? 'بستن' : 'باز کردن'}
                        >
                          <IconChevron width={13} height={13} />
                        </button>
                      ) : <span className="ad-ref__caret" aria-hidden="true" />}

                      <button
                        type="button"
                        className="ad-ref__nodetoggle"
                        onClick={() => setNode({ kind: 'module', moduleIndex })}
                      >
                        <IconEdit width={15} height={15} />
                        <span className="ad-ref__nodelabel">{module_.title || 'مبحث بی‌نام'}</span>
                        <Badge tone="neutral">{faNumber(units.length)} واحد</Badge>
                      </button>

                      {can('comprehensive.update') ? (
                        <NodeActions
                          label="مبحث"
                          canMoveUp={moduleIndex > 0}
                          canMoveDown={moduleIndex < draft.modules.length - 1}
                          onMove={(direction) => actions.moveModule(moduleIndex, direction)}
                          onRemove={() => actions.removeModule(moduleIndex)}
                        />
                      ) : null}
                    </div>

                    {open ? (
                      <>
                        {units.map((unit, unitIndex) => (
                          <div
                            key={unit.id ?? `unit-${unitIndex}`}
                            className={`ad-ref__node ad-ref__node--leaf ${node.kind === 'unit' && node.moduleIndex === moduleIndex && node.unitIndex === unitIndex ? 'is-active' : ''}`}
                          >
                            <button
                              type="button"
                              className="ad-ref__nodetoggle"
                              onClick={() => setNode({ kind: 'unit', moduleIndex, unitIndex })}
                            >
                              <span className="ad-ref__nodedot" aria-hidden="true" />
                              <span className="ad-ref__nodelabel">{faNumber(unitIndex + 1)}. {unit.title || 'واحد بی‌نام'}</span>
                              <span className="ad-sub">{faNumber(unitTestCount(unit))} تست</span>
                            </button>
                            {can('comprehensive.update') ? (
                              <NodeActions
                                label="واحد"
                                canMoveUp={unitIndex > 0}
                                canMoveDown={unitIndex < units.length - 1}
                                onMove={(direction) => actions.moveUnit(moduleIndex, unitIndex, direction)}
                                onRemove={() => actions.removeUnit(moduleIndex, unitIndex)}
                              />
                            ) : null}
                          </div>
                        ))}

                        <div className="ad-ref__addrow">
                          {can('comprehensive.update') ? (
                            <Button variant="ghost" size="sm" onClick={() => { actions.addUnit(moduleIndex); setNode({ kind: 'unit', moduleIndex, unitIndex: units.length }); }}>
                              <IconPlus width={13} height={13} /> واحد جدید
                            </Button>
                          ) : (
                            <span className="ad-sub">
                              {units.length ? `${faNumber(units.length)} واحد` : 'این مبحث هنوز واحد ندارد'}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="ad-ref__addrow">
                        <span className="ad-sub">
                          {units.length
                            ? `${faNumber(units.length)} واحد · ${faNumber(units.reduce((total, unit) => total + unitTestCount(unit), 0))} تست`
                            : 'این مبحث هنوز واحد ندارد'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="ad-ref__addrow">
                {can('comprehensive.update') ? (
                  <Button variant="ghost" size="sm" onClick={actions.addModule}>
                    <IconPlus width={13} height={13} /> مبحث جدید
                  </Button>
                ) : (
                  <span className="ad-sub">برای افزودن مبحث دسترسی لازم است.</span>
                )}
              </div>
            </nav>

            <section className="ad-ref__editor" aria-label="ویرایشگر">
              {renderEditor()}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
