/*
 * SubjectDrilldown — مسیر فرودown تحلیل: درس → مبحث → سؤال.
 * درس: فهرست مباحث با دقت/زمان/تسلط/روند.
 * مبحث: آمار تفصیلی + سؤال‌های آن مبحث.
 * سؤال: Question Analytics با خط زمانی تلاش‌ها (تثبیت مفهوم).
 */
import { useMemo } from 'react';
import {
  Card,
  EmptyState,
  Icon,
  BarRow,
  ColumnChart,
  RingScore,
  MasteryBadge,
  TrendArrow,
  DifficultyBadge,
  Modal,
  formatPercent,
  formatSeconds,
  formatFullDate,
  formatSigned,
  faNum,
  toFa,
  difficultyLabel,
  errorTypeLabel,
} from './analyticsShared';

/* ─────────────── نمای درس: مباحث ─────────────── */

export function SubjectView({ subjectData, topics, subjectId, onOpenTopic, onBack }) {
  const subject = subjectData?.subjects.find((item) => item.subjectId === subjectId);
  const subjectTopics = topics.filter((topic) => topic.subjectId === subjectId);

  if (!subject) {
    return <EmptyState icon="search" title="درس پیدا نشد" note="شاید در این بازه از این درس تستی زده نشده است." action={<BackButton onClick={onBack} />} />;
  }

  const sorted = [...subjectTopics].sort((a, b) => (a.accuracy ?? 100) - (b.accuracy ?? 100));

  return (
    <div className="space-y-5">
      <Card className="dashboard-layer-reveal" ariaLabel={`خلاصهٔ درس ${subject.name}`}>
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <RingScore score={subject.accuracy} size={96} accent={subject.accent} label="دقت" />
            <div>
              <h2 className="text-xl font-extrabold [font-family:'Doran','Vazir',Tahoma,sans-serif]" style={{ color: subject.accent }}>
                {subject.name}
              </h2>
              <p className="mt-1 text-[12.5px] text-[var(--faint)]">
                {faNum(subject.attemptCount)} تست از {faNum(subject.questionCount)} سؤال متفاوت · میانگین زمان {formatSeconds(subject.averageTime)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <MasteryBadge mastery={subject.mastery} />
                <TrendArrow direction={subject.trend.direction} delta={subject.trend.delta} />
              </div>
            </div>
          </div>
          <BackButton onClick={onBack} label="بازگشت به تحلیل" />
        </div>
      </Card>

      <Card title="مبحث‌های این درس — ضعیف‌ترین‌ها اول" icon="grid" hint="روی هر مبحث بزن تا سؤال‌هایش را ببینی" className="dashboard-layer-reveal">
        {sorted.length === 0 ? (
          <EmptyState icon="grid" title="در این بازه از این درس تستی زده نشده" />
        ) : (
          <div className="grid gap-3.5 md:grid-cols-2">
            {sorted.map((topic) => (
              <BarRow
                key={topic.key}
                label={topic.subtopic ? `${topic.topic} › ${topic.subtopic}` : topic.topic}
                value={topic.accuracy}
                accent={topic.accuracy >= 70 ? '#61D192' : topic.accuracy >= 55 ? '#e0b45c' : '#e26d6d'}
                onClick={() => onOpenTopic?.(topic)}
                subLabel={
                  <>
                    {faNum(topic.attemptCount)} تست · {formatSeconds(topic.averageTime)} · {faNum(topic.wrongCount)} غلط{topic.unansweredCount ? ` · ${faNum(topic.unansweredCount)} نزده` : ''}
                  </>
                }
              />
            ))}
          </div>
        )}
      </Card>

      <Card title="مقایسهٔ مبحث‌ها بر اساس تسلط" icon="target" className="dashboard-layer-reveal">
        <div className="overflow-x-auto">
          <table className="an-qtable min-w-[560px]">
            <thead>
              <tr>
                <th>مبحث</th>
                <th>دقت</th>
                <th>تست</th>
                <th>زمان</th>
                <th>روند</th>
                <th>تسلط</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((topic) => (
                <tr key={topic.key} tabIndex={0} onClick={() => onOpenTopic?.(topic)} onKeyDown={(event) => event.key === 'Enter' && onOpenTopic?.(topic)}>
                  <td data-label="مبحث">{topic.subtopic ? `${topic.topic} › ${topic.subtopic}` : topic.topic}</td>
                  <td data-label="دقت"><strong style={{ color: (topic.accuracy ?? 0) >= 70 ? '#61D192' : (topic.accuracy ?? 0) >= 55 ? '#e0b45c' : '#e26d6d' }}>{formatPercent(topic.accuracy)}</strong></td>
                  <td data-label="تست">{faNum(topic.attemptCount)}</td>
                  <td data-label="زمان">{formatSeconds(topic.averageTime)}</td>
                  <td data-label="روند"><TrendArrow direction={topic.trend.direction} delta={topic.trend.delta} /></td>
                  <td data-label="تسلط"><MasteryBadge mastery={topic.mastery} compact /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ─────────────── نمای مبحث ─────────────── */

export function TopicView({ topic, questions, onOpenQuestion, onBack, onStartPractice }) {
  const difficultyColumns = useMemo(() => {
    const buckets = { easy: { count: 0, correct: 0, answered: 0 }, medium: { count: 0, correct: 0, answered: 0 }, hard: { count: 0, correct: 0, answered: 0 }, very_hard: { count: 0, correct: 0, answered: 0 } };
    for (const question of questions) {
      for (const attempt of question.timeline) {
        const bucket = buckets[attempt.difficulty];
        if (!bucket) continue;
        bucket.count += 1;
        if (attempt.correct !== null && attempt.correct !== undefined) {
          bucket.answered += 1;
          if (attempt.correct) bucket.correct += 1;
        }
      }
    }
    return Object.entries(buckets)
      .filter(([, bucket]) => bucket.count > 0)
      .map(([difficulty, bucket]) => ({
        key: difficulty,
        label: difficultyLabel(difficulty),
        value: bucket.answered ? (bucket.correct / bucket.answered) * 100 : null,
        display: bucket.answered ? `${faNum(Math.round((bucket.correct / bucket.answered) * 100))}٪` : '—',
        accent: { easy: '#77b787', medium: '#e0b45c', hard: '#ef9196', very_hard: '#e26d6d' }[difficulty],
      }));
  }, [questions]);

  const uniqueQuestions = useMemo(() => [...new Map(questions.map((question) => [question.questionId, question])).values()], [questions]);

  return (
    <div className="space-y-5">
      <Card className="dashboard-layer-reveal" ariaLabel={`خلاصهٔ مبحث ${topic.key}`}>
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <RingScore score={topic.accuracy} size={96} accent={topic.accuracy >= 70 ? '#61D192' : topic.accuracy >= 55 ? '#e0b45c' : '#e26d6d'} label="دقت" />
            <div>
              <h2 className="text-lg font-extrabold [font-family:'Doran','Vazir',Tahoma,sans-serif]">{topic.subtopic ? `${topic.topic} › ${topic.subtopic}` : topic.topic}</h2>
              <p className="mt-1 text-[12.5px] text-[var(--faint)]">
                {faNum(topic.attemptCount)} تست · {faNum(topic.correctCount)} درست · {faNum(topic.wrongCount)} غلط{topic.unansweredCount ? ` · ${faNum(topic.unansweredCount)} نزده` : ''}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <MasteryBadge mastery={topic.mastery} />
                <TrendArrow direction={topic.trend.direction} delta={topic.trend.delta} />
              </div>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-2">
            {onStartPractice && (
              <button
                type="button"
                onClick={() => onStartPractice(topic)}
                className="cursor-pointer rounded-xl bg-[var(--green-vivid)] px-4 py-2 text-[12.5px] font-bold text-[#12271a] transition-colors hover:bg-[var(--green-bright)] focus-visible:outline-2 focus-visible:outline-white"
              >
                تمرین همین مبحث
              </button>
            )}
            <BackButton onClick={onBack} label="بازگشت به درس" />
          </div>
        </div>
      </Card>

      {difficultyColumns.length > 0 && (
        <Card title="دقت تو بر اساس سطح سختی در این مبحث" icon="chart" className="dashboard-layer-reveal">
          <ColumnChart columns={difficultyColumns} ariaLabel="نمودار دقت بر اساس سختی" />
        </Card>
      )}

      <Card title={`سؤال‌های حل‌شده (${faNum(uniqueQuestions.length)} سؤال)`} icon="card" hint="روی هر سؤال بزن تا تحلیل کاملش را ببینی" className="dashboard-layer-reveal">
        <div className="overflow-x-auto">
          <table className="an-qtable min-w-[640px]">
            <thead>
              <tr>
                <th>سؤال</th>
                <th>سختی</th>
                <th>تلاش</th>
                <th>دقت</th>
                <th>آخرین وضعیت</th>
                <th>وضعیت مفهوم</th>
              </tr>
            </thead>
            <tbody>
              {uniqueQuestions.map((question) => (
                <tr key={question.questionId} tabIndex={0} onClick={() => onOpenQuestion?.(question)} onKeyDown={(event) => event.key === 'Enter' && onOpenQuestion?.(question)}>
                  <td data-label="سؤال">
                    <span className="line-clamp-1 max-w-[340px]">{questionStemPreview(question)}</span>
                  </td>
                  <td data-label="سختی"><DifficultyBadge difficulty={question.difficulty} /></td>
                  <td data-label="تلاش">{faNum(question.attemptCount)} بار</td>
                  <td data-label="دقت"><strong style={{ color: (question.accuracy ?? 0) >= 70 ? '#61D192' : (question.accuracy ?? 0) >= 50 ? '#e0b45c' : '#e26d6d' }}>{formatPercent(question.accuracy)}</strong></td>
                  <td data-label="آخرین وضعیت">
                    <span className="an-status" style={{ background: question.lastCorrect ? 'rgba(97,209,146,0.13)' : 'rgba(226,109,109,0.12)', color: question.lastCorrect ? '#61D192' : '#e26d6d' }}>
                      {question.lastCorrect ? 'درست' : 'غلط'}
                    </span>
                  </td>
                  <td data-label="وضعیت مفهوم">
                    {question.consolidating ? (
                      <span className="an-status" style={{ background: 'rgba(97,209,146,0.13)', color: 'var(--green-ink)' }}>در حال تثبیت</span>
                    ) : question.lastCorrect ? (
                      <span className="text-[11px] text-[var(--faint)]">—</span>
                    ) : (
                      <span className="an-status" style={{ background: 'rgba(226,109,109,0.12)', color: 'var(--red-ink)' }}>نیازمند مرور</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* پیش‌نمایش صورت سؤال — stem در Attemptهای تغذیه‌شدهٔ سرویس هست */
const stemCache = new Map();
function questionStemPreview(question) {
  if (!stemCache.has(question.questionId)) {
    stemCache.set(question.questionId, question.timeline[0]?.stem ?? 'صورت سؤال در دسترس نیست');
  }
  return stemCache.get(question.questionId);
}

function BackButton({ onClick, label = 'بازگشت' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-[var(--surface-soft)] px-3.5 py-2.5 text-xs text-[var(--muted)] transition-colors hover:bg-[var(--surface-strong)] hover:text-white focus-visible:outline-2 focus-visible:outline-[var(--green-vivid)]"
    >
      <Icon name="back" className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

/* ─────────────── مودال تحلیل سؤال (Question Analytics) ─────────────── */

export function QuestionAnalyticsModal({ question, onClose }) {
  if (!question) return null;
  const attempts = question.timeline;
  const confidenceCells = attempts.filter((attempt) => attempt.confidence);

  return (
    <Modal open={Boolean(question)} onClose={onClose} title="تحلیل سؤال" width="min(44rem, 100%)">
      <div className="max-h-[70vh] overflow-y-auto">
        <h3 className="text-[14px] font-bold leading-7 [font-family:'Doran','Vazir',Tahoma,sans-serif]">{questionStemPreview(question)}</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <DifficultyBadge difficulty={question.difficulty} />
          <span className="an-status" style={{ background: 'rgb(var(--wash-rgb) / 0.05)', color: 'var(--muted)' }}>{question.subjectName}</span>
          <span className="an-status" style={{ background: 'rgb(var(--wash-rgb) / 0.05)', color: 'var(--muted)' }}>{question.topicPath.join(' › ')}</span>
          {question.timeline[0]?.year && <span className="an-status" style={{ background: 'rgb(var(--wash-rgb) / 0.05)', color: 'var(--muted)' }}>سال {toFa(question.timeline[0].year)}</span>}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'تلاش', value: `${faNum(question.attemptCount)} بار` },
            { label: 'دقت', value: formatPercent(question.accuracy) },
            { label: 'میانگین زمان', value: formatSeconds(question.averageTime) },
            { label: 'آخرین تلاش', value: formatFullDate(question.lastAttemptAt) },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl bg-white/[0.04] px-3 py-2 text-center">
              <span className="block text-[10.5px] text-[var(--faint)]">{stat.label}</span>
              <strong className="text-[13px]">{stat.value}</strong>
            </div>
          ))}
        </div>

        {/* خط زمانی تلاش‌ها */}
        <h4 className="mt-5 mb-2 text-[12.5px] font-bold">خط زمانی تلاش‌ها</h4>
        <div className="an-timeline" role="list" aria-label={`تاریخچهٔ ${faNum(attempts.length)} تلاش در این سؤال`}>
          {attempts.map((attempt, index) => (
            <div key={attempt.id} className="an-timeline__step" role="listitem">
              <div
                className="an-timeline__dot"
                title={`${formatFullDate(attempt.timestamp)} · ${attempt.correct ? 'درست' : attempt.correct === false ? 'غلط' : 'بی‌پاسخ'} · ${formatSeconds(attempt.timeSpent)}`}
                style={{
                  background: attempt.correct === null || attempt.correct === undefined ? 'rgb(var(--wash-rgb) / 0.05)' : attempt.correct ? 'rgba(97,209,146,0.15)' : 'rgba(226,109,109,0.15)',
                  borderColor: attempt.correct === null || attempt.correct === undefined ? '#6b6b6b' : attempt.correct ? '#61D192' : '#e26d6d',
                  color: attempt.correct === null || attempt.correct === undefined ? '#999' : attempt.correct ? '#61D192' : '#e26d6d',
                }}
              >
                {toFa(index + 1)}
              </div>
              {index < attempts.length - 1 && <span className="an-timeline__link" />}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--faint)]">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: 'var(--green-vivid)' }} />درست</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: 'var(--red)' }} />غلط</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: 'var(--light-fill)' }} />بی‌پاسخ</span>
        </div>
        {question.consolidating && (
          <p className="mt-3 rounded-xl bg-[#61D192]/[0.08] px-3.5 py-2.5 text-[12px] text-[var(--green-ink)]">
            این مفهوم در حال تثبیت است: آخرین تلاش‌ها درست بوده‌اند.
          </p>
        )}

        {/* جزئیات هر تلاش */}
        <h4 className="mt-5 mb-2 text-[12.5px] font-bold">جزئیات تلاش‌ها</h4>
        <div className="overflow-x-auto">
          <table className="an-qtable min-w-[480px]">
            <thead>
              <tr>
                <th>#</th>
                <th>وضعیت</th>
                <th>زمان</th>
                <th>اطمینان</th>
                <th>نوع خطا</th>
                <th>تاریخ</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((attempt, index) => (
                <tr key={attempt.id} style={{ cursor: 'default' }}>
                  <td data-label="#">{toFa(index + 1)}</td>
                  <td data-label="وضعیت">
                    <span className="an-status" style={{ background: attempt.correct ? 'rgba(97,209,146,0.13)' : attempt.correct === false ? 'rgba(226,109,109,0.12)' : 'rgb(var(--wash-rgb) / 0.05)', color: attempt.correct ? '#61D192' : attempt.correct === false ? '#e26d6d' : '#999' }}>
                      {attempt.correct ? 'درست' : attempt.correct === false ? 'غلط' : 'بی‌پاسخ'}
                    </span>
                  </td>
                  <td data-label="زمان">{formatSeconds(attempt.timeSpent)}</td>
                  <td data-label="اطمینان">{attempt.confidence ? { high: 'مطمئن', medium: 'نیمه‌مطمئن', low: 'نامطمئن' }[attempt.confidence] : '—'}</td>
                  <td data-label="نوع خطا">{!attempt.correct && attempt.correct !== null && attempt.correct !== undefined ? errorTypeLabel(attempt.errorType) : '—'}</td>
                  <td data-label="تاریخ">{formatFullDate(attempt.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {confidenceCells.length === 0 && (
          <p className="mt-3 text-[11px] text-[var(--faint)]">سؤال‌های آینده می‌توانند سطح اطمینانت را هم ثبت کنند تا تحلیل «دانستن» از «فکر کردن به دانستن» تفکیک شود.</p>
        )}
      </div>
    </Modal>
  );
}
