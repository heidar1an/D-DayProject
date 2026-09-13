/*
 * پنل تحلیل سؤال — قلب فلسفهٔ تپش: نه فقط «پاسخ چیست»، بلکه «چرا».
 * ساختار ثابت: چرا درست؟ ← چرا بقیه غلط؟ ← نکات کلیدی ← نکتهٔ بالینی ← اشتباه رایج ← منبع.
 * همان پنل در محیط حل سؤال و صفحهٔ مرور نتیجه استفاده می‌شود.
 */
import { useState } from 'react';
import { requestTeachMe } from '../../../services/international/internationalService';
import {
  DifficultyBadge,
  Icon,
  SampleTag,
} from './intlShared';

/* بخش‌بند داخلی پنل تحلیل */
function ExplanationSection({ icon, title, accent, children }) {
  return (
    <section className="itl-ex-section">
      <h4 className="flex items-center gap-2 text-sm [font-family:'Doran',Tahoma,sans-serif]" style={{ color: accent }}>
        <Icon name={icon} className="h-4 w-4" />
        {title}
      </h4>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

/* مینی-درس «این سؤال را یادم بده» — الان از دادهٔ ساختاریافتهٔ سؤال، در آینده از AIExplanationRequest */
function TeachMeLesson({ lesson, onClose }) {
  const rows = [
    { icon: 'target', title: 'مفهوم اصلی', body: lesson.coreConcept },
    { icon: 'book', title: 'چه چیزی یاد بگیر', body: lesson.whatToLearn },
    { icon: 'alert', title: 'چه اشتباهی می‌کند آدم', body: lesson.commonMistake },
    { icon: 'spark', title: 'در آزمون چه انتظاری داشته باش', body: lesson.examRelevance },
  ];

  return (
    <div className="intl-reveal mt-3 rounded-2xl border border-[#937fcd]/35 bg-[#937fcd]/[0.07] p-4" role="region" aria-label="مینی درس این سؤال">
      <div className="flex items-center justify-between">
        <strong className="flex items-center gap-2 text-sm text-[#c9bdf0] [font-family:'Doran',Tahoma,sans-serif]">
          <Icon name="spark" className="h-4 w-4" />
          مینی‌درس این سؤال
        </strong>
        <button
          type="button"
          onClick={onClose}
          aria-label="بستن مینی درس"
          className="cursor-pointer rounded-lg p-1 text-[#8a8a8a] transition-colors hover:text-white"
        >
          <Icon name="x" className="h-4 w-4" />
        </button>
      </div>
      <ul className="mt-3 space-y-3">
        {rows.map((row) => (
          <li key={row.title} className="flex gap-3">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#937fcd]/15 text-[#c9bdf0]">
              <Icon name={row.icon} className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0">
              <strong className="block text-xs text-[#c9bdf0]">{row.title}</strong>
              <span className="mt-0.5 block text-[13px] leading-6 text-[#d9d9d9]">{row.body}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-white/8 pt-2.5 text-[11px] leading-5 text-[#777]">
        این درس از ساختار سؤال ساخته شده؛ بعداً به دستیار هوشمند تپش وصل می‌شود تا شخصی‌تر شود.
      </p>
    </div>
  );
}

export default function QuestionExplanation({
  question,
  exam,
  languageMode = 'fa',
  selectedAnswer = null,
  compact = false,
}) {
  const [teachMe, setTeachMe] = useState(null);
  const [teachLoading, setTeachLoading] = useState(false);

  const showEn = languageMode !== 'fa';
  const showFa = languageMode !== 'en';

  const requestLesson = async () => {
    if (teachLoading) return;
    setTeachLoading(true);
    const lesson = await requestTeachMe(question);
    setTeachMe(lesson);
    setTeachLoading(false);
  };

  return (
    <div className="itl-ex-panel intl-reveal rounded-[1.75rem] border border-white/8 bg-[#232323] p-5 md:p-6" dir="rtl">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base [font-family:'Doran',Tahoma,sans-serif]">
          <Icon name="book" className="h-4.5 w-4.5 text-[#937fcd]" />
          تحلیل سؤال
        </h3>
        <div className="flex flex-wrap items-center gap-1.5">
          <SampleTag />
          <DifficultyBadge difficulty={question.difficulty} />
        </div>
      </header>

      {/* چرا پاسخ صحیح صحیح است؟ */}
      <ExplanationSection icon="check" title="چرا این گزینه؟" accent="#77b787">
        {showFa && <p className="text-[13.5px] leading-7 text-[#e6e6e6]">{question.explanation.fa}</p>}
        {showEn && (
          <p className={`text-[13px] leading-6 text-[#a8a8a8] ${showFa ? 'mt-2' : ''}`} dir="ltr">
            {question.explanation.en}
          </p>
        )}
      </ExplanationSection>

      {/* چرا بقیه غلط‌اند؟ */}
      <ExplanationSection icon="x" title="چرا بقیه گزینه‌ها نه؟" accent="#ef9196">
        <ul className="space-y-2">
          {question.options.map((option) => {
            const isCorrect = option.key === question.correctAnswer;
            const isSelectedWrong = option.key === selectedAnswer && !isCorrect;
            return (
              <li
                key={option.key}
                className={`rounded-xl border px-3.5 py-2.5 ${
                  isCorrect
                    ? 'border-[#77b787]/30 bg-[#77b787]/[0.06]'
                    : isSelectedWrong
                      ? 'border-[#e26d6d]/30 bg-[#e26d6d]/[0.06]'
                      : 'border-white/6 bg-white/[0.02]'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-xs font-bold [font-family:'Doran',Tahoma,sans-serif] ${
                      isCorrect ? 'bg-[#77b787]/20 text-[#9ed3ab]' : isSelectedWrong ? 'bg-[#e26d6d]/20 text-[#ef9196]' : 'bg-white/6 text-[#8a8a8a]'
                    }`}
                  >
                    {option.key}
                  </span>
                  <span className="min-w-0">
                    {showFa && <span className="block text-[13px] leading-6 text-[#d9d9d9]">{question.optionExplanations[option.key]?.fa}</span>}
                    {showEn && (
                      <span className={`block text-[12px] leading-5 text-[#9a9a9a] ${showFa ? 'mt-1' : ''}`} dir="ltr">
                        {question.optionExplanations[option.key]?.en}
                      </span>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </ExplanationSection>

      {/* نکات کلیدی (High Yield) */}
      {question.keyLearningPoints?.length > 0 && (
        <ExplanationSection icon="target" title="نکات کلیدی برای آزمون" accent="#e0b45c">
          <ul className="space-y-2">
            {question.keyLearningPoints.map((point, index) => (
              <li key={index} className="flex gap-2.5 text-[13px] leading-6 text-[#d9d9d9]">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#e0b45c]" aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>
        </ExplanationSection>
      )}

      {/* نکتهٔ بالینی (Clinical Pearl) */}
      {question.clinicalPearl && (
        <ExplanationSection icon="flame" title="نکتهٔ بالینی" accent="#ef9196">
          <p className="rounded-xl border border-[#e26d6d]/20 bg-[#e26d6d]/[0.05] px-3.5 py-3 text-[13px] leading-7 text-[#e6e6e6]">
            {question.clinicalPearl}
          </p>
        </ExplanationSection>
      )}

      {/* اشتباه رایج */}
      {question.commonMistake && !compact && (
        <ExplanationSection icon="alert" title="اشتباه رایج" accent="#ef9196">
          <p className="text-[13px] leading-7 text-[#c9c9c9]">{question.commonMistake}</p>
        </ExplanationSection>
      )}

      {/* این سؤال را یادم بده */}
      <button
        type="button"
        onClick={requestLesson}
        className="mt-1 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#937fcd]/15 px-4 py-2.5 text-sm text-[#c9bdf0] transition-transform hover:-translate-y-0.5 [font-family:'Doran',Tahoma,sans-serif]"
      >
        <Icon name="spark" className="h-4 w-4" />
        {teachLoading ? 'در حال آماده‌سازی...' : 'این سؤال را یادم بده'}
      </button>
      {teachMe && <TeachMeLesson lesson={teachMe} onClose={() => setTeachMe(null)} />}

      {/* متادیتا: ثانویه و کم‌رنگ — هرگز بر متن سؤال غلبه نکند */}
      <footer className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-white/6 pt-3 text-[11px] text-[#777]">
        {exam && <span>آزمون: {exam.shortName}</span>}
        <span>موضوع: {question.topic.fa}</span>
        {question.reference && (
          <span dir="auto" className="inline-flex items-center gap-1">
            <Icon name="book" className="h-3 w-3" />
            {question.reference.title}
          </span>
        )}
        <span className="ms-auto opacity-60">شناسه: {question.id}</span>
      </footer>
    </div>
  );
}
