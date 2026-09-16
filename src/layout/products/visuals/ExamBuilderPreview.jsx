import { useState } from 'react';

import { getExamBuilderPreview } from '../../../services/products/productsService';
import { toFa } from '../productsShared';

/*
 * ── پیش‌نمایش آزمون‌ساز شخصی ──
 *
 * دو حالت دارد: «تنظیمات» و «آزمون آماده». بین‌شان only یک پنل رندر می‌شود
 * (نه دو پنلِ روی هم)، چون پنلِ پنهان نباید دکمه‌های فوکوس‌پذیرِ نامرئی داشته
 * باشد. نرمیِ جابه‌جایی با انیمیشنِ ورودِ همان پنلِ تازه تأمین می‌شود.
 */

export default function ExamBuilderPreview() {
  const data = getExamBuilderPreview();
  const [picks, setPicks] = useState(() =>
    Object.fromEntries(data.groups.map((group) => [group.id, group.options[0]])),
  );
  const [built, setBuilt] = useState(false);
  const [answer, setAnswer] = useState(null);

  const choose = (groupId, option) =>
    setPicks((current) => ({ ...current, [groupId]: option }));

  const reset = () => {
    setBuilt(false);
    setAnswer(null);
  };

  if (!built) {
    return (
      <div className="ps-builder">
        <ul className="ps-builder__groups">
          {data.groups.map((group) => (
            <li className="ps-builder__group" key={group.id}>
              <span className="ps-builder__label">{group.label}</span>

              <div className="ps-builder__chips" role="group" aria-label={group.label}>
                {group.options.map((option) => (
                  <button
                    type="button"
                    className={`ps-builder__chip ${picks[group.id] === option ? 'is-on' : ''}`}
                    key={option}
                    aria-pressed={picks[group.id] === option}
                    onClick={() => choose(group.id, option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>

        <button type="button" className="ps-builder__build" onClick={() => setBuilt(true)}>
          {data.cta}
        </button>
      </div>
    );
  }

  const { running } = data;

  return (
    <div className="ps-builder ps-builder--running">
      <div className="ps-builder__run-head">
        <span className="ps-builder__run-label">{running.label}</span>
        <span className="ps-builder__run-timer">{running.timer}</span>
      </div>

      <p className="ps-builder__run-question">{running.question}</p>

      <div className="ps-builder__run-options" role="group" aria-label="گزینه‌ها">
        {running.options.map((option, index) => (
          <button
            type="button"
            className={`ps-builder__run-option ${answer === index ? 'is-on' : ''}`}
            key={option}
            aria-pressed={answer === index}
            onClick={() => setAnswer(index)}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="ps-builder__run-foot">
        <span className="ps-builder__run-progress">
          <span
            className="ps-builder__run-fill"
            style={{ width: `${(running.progress / running.total) * 100}%` }}
          />
        </span>
        <span className="ps-builder__run-count">
          {toFa(running.progress)} / {toFa(running.total)}
        </span>
        <button type="button" className="ps-builder__back" onClick={reset}>
          تغییر تنظیمات
        </button>
      </div>
    </div>
  );
}
