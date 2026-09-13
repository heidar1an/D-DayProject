import { useEffect, useMemo, useRef, useState } from 'react';
import AIPopup from './AIPopup';
import { useAIConversation } from './aiStore';
import { SparkIcon, SendIcon } from './aiShared';
import { getContextSuggestions, subscribeAIContext } from '../../../services/ai/aiContext';
import './ai.css';

/*
 * AI Card تپش — همیشه در داشبورد، هرگز مزاحم.
 *
 * کارت در حالت عادی یک کادر مینیمال است (تیتر + چند پیشنهاد + کادر «پرسیدن»).
 * با کلیک روی کادر یا هر پیشنهاد، گفت‌وگو به‌صورت پاپ‌آپ شناور روی همین صفحه باز می‌شود
 * و کاربر به صفحهٔ دیگری برده نمی‌شود.
 *
 * اگر گفت‌وگویی در جریان باشد (استور مشترک aiStore)، کارت نوار «ادامهٔ گفت‌وگو» نشان می‌دهد.
 */
export default function AICard() {
  const ai = useAIConversation();
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const composerBtnRef = useRef(null);

  /* پیشنهادها از Context می‌آیند تا بخش‌های دیگر داشبورد بتوانند مال خودشان را تزریق کنند */
  const [suggestions, setSuggestions] = useState(() => getContextSuggestions());
  useEffect(() => subscribeAIContext(() => setSuggestions(getContextSuggestions())), []);

  const hasConversation = ai.messages.length > 0;
  const lastMessage = ai.messages[ai.messages.length - 1];

  /* بستن پاپ‌آپ فوکوس را به کارت برمی‌گرداند */
  const closePopup = () => {
    setIsPopupOpen(false);
    composerBtnRef.current?.focus();
  };

  const openWith = (prefill) => {
    if (prefill !== undefined) setDraft(prefill);
    setIsPopupOpen(true);
  };

  const resumeSnippet = useMemo(() => {
    if (!lastMessage) return '';
    return `${lastMessage.role === 'user' ? 'تو: ' : ''}${lastMessage.text.slice(0, 70)}`;
  }, [lastMessage]);

  return (
    <>
      <section className="ai-card ai-card--idle" aria-label="تپش هوشمند">
        <header className="ai-card__head">
          <span className="ai-card__badge" aria-hidden="true">
            <SparkIcon width={16} height={16} />
          </span>
          <div className="ai-card__titles">
            <h2 className="ai-card__title">با تپش هوشمندت صحبت کن</h2>
            <p className="ai-card__subtitle">
              سؤال بپرس، مفاهیم پزشکی را بهتر بفهم و برای مطالعه کمک بگیر.
            </p>
          </div>
        </header>

        {hasConversation ? (
          <button type="button" className="ai-card__resume" onClick={() => openWith()}>
            <span className="ai-card__resume-label">گفت‌وگوی در جریان</span>
            <span className="ai-card__resume-snippet">{resumeSnippet}…</span>
            <span className="ai-card__resume-cta">ادامه بده</span>
          </button>
        ) : (
          <div className="ai-card__suggestions" aria-label="پیشنهاد شروع">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.label}
                type="button"
                className="ai-chip"
                onClick={() => openWith(suggestion.prompt)}
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          className="ai-card__composer-btn"
          ref={composerBtnRef}
          onClick={() => openWith()}
          aria-label="شروع گفت‌وگو با تپش هوشمند"
        >
          <span className="ai-card__composer-placeholder">
            {hasConversation ? 'ادامهٔ گفت‌وگو...' : 'هر چیزی می‌خواهی بپرس...'}
          </span>
          <span className="ai-card__composer-send" aria-hidden="true">
            <SendIcon width={15} height={15} />
          </span>
        </button>
      </section>

      {isPopupOpen ? (
        <AIPopup draft={draft} onDraftChange={setDraft} onClose={closePopup} />
      ) : null}
    </>
  );
}
