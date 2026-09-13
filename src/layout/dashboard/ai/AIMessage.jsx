import { useEffect, useRef, useState } from 'react';
import {
  MarkdownLite,
  FOLLOW_UP_ACTIONS,
  CopyIcon,
  RefreshIcon,
  LikeIcon,
  DislikeIcon,
  ShareIcon,
  BookmarkIcon,
  SparkIcon,
  AttachIcon,
} from './aiShared';

/* نوار اکشن زیر پیام AI — کپی/تولید مجدد/بازخورد/اشتراک/ذخیره */
function AIMessageActions({ message, onRegenerate, onFeedback, onToggleSaved }) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
    } catch {
      /* کلیپ‌بورد در دسترس نیست؛ بی‌صدا رد می‌شویم */
    }
    setCopied(true);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1600);
  };

  const shareText = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'تپش هوشمند', text: message.text });
        return;
      } catch {
        return; /* کاربر اشتراک را لغو کرد */
      }
    }
    copyText();
  };

  return (
    <div className="ai-message__actions">
      <button type="button" className="ai-icon-btn" onClick={copyText} aria-label="کپی پاسخ">
        <CopyIcon width={15} height={15} />
        <span className="ai-icon-btn__hint" role="status">
          {copied ? 'کپی شد' : ''}
        </span>
      </button>
      <button
        type="button"
        className="ai-icon-btn"
        onClick={onRegenerate}
        aria-label="تولید دوبارهٔ پاسخ"
      >
        <RefreshIcon width={15} height={15} />
      </button>
      <button
        type="button"
        className={`ai-icon-btn ${message.feedback === 'like' ? 'ai-icon-btn--active' : ''}`}
        onClick={() => onFeedback(message.id, 'like')}
        aria-label="پاسخ خوب بود"
        aria-pressed={message.feedback === 'like'}
      >
        <LikeIcon width={15} height={15} />
      </button>
      <button
        type="button"
        className={`ai-icon-btn ${message.feedback === 'dislike' ? 'ai-icon-btn--active' : ''}`}
        onClick={() => onFeedback(message.id, 'dislike')}
        aria-label="پاسخ خوب نبود"
        aria-pressed={message.feedback === 'dislike'}
      >
        <DislikeIcon width={15} height={15} />
      </button>
      <button type="button" className="ai-icon-btn" onClick={shareText} aria-label="هم‌رسانی پاسخ">
        <ShareIcon width={15} height={15} />
      </button>
      <button
        type="button"
        className={`ai-icon-btn ${message.saved ? 'ai-icon-btn--active' : ''}`}
        onClick={() => onToggleSaved(message.id)}
        aria-label={message.saved ? 'حذف از ذخیره‌شده‌ها' : 'ذخیرهٔ پاسخ'}
        aria-pressed={message.saved}
      >
        <BookmarkIcon width={15} height={15} filled={message.saved} />
      </button>
    </div>
  );
}

/* پیام یک‌به‌یک: کاربر حبابی، AI متن باز برای خوانایی Markdown */
export default function AIMessage({ message, onRegenerate, onFeedback, onToggleSaved, onFollowUp }) {
  const isUser = message.role === 'user';
  const isError = message.status === 'error';
  const isStreaming = message.status === 'streaming' || message.status === 'thinking';

  if (isUser) {
    return (
      <article className="ai-message ai-message--user">
        {message.text}
        {message.attachments?.length ? (
          <span className="ai-message__attachments">
            {message.attachments.map((attachment) => (
              <span key={attachment.id} className="ai-chip ai-chip--static">
                <AttachIcon width={12} height={12} />
                {attachment.name}
              </span>
            ))}
          </span>
        ) : null}
      </article>
    );
  }

  return (
    <article className={`ai-message ai-message--ai ${isError ? 'ai-message--error' : ''}`}>
      <span className="ai-message__avatar" aria-hidden="true">
        <SparkIcon width={13} height={13} />
      </span>

      <div className="ai-message__body">
        {message.status === 'thinking' ? (
          <span className="ai-thinking" role="status" aria-label="در حال فکر کردن">
            <i />
            <i />
            <i />
          </span>
        ) : isError ? (
          <div className="ai-error">
            <p>مشکلی در دریافت پاسخ پیش آمد.</p>
            <button type="button" className="ai-error__retry" onClick={onRegenerate}>
              دوباره تلاش کن
            </button>
          </div>
        ) : (
          <>
            <MarkdownLite text={message.text} className={isStreaming ? 'ai-md--streaming' : ''} />
            {message.stopped ? <p className="ai-message__stopped">تولید پاسخ متوقف شد.</p> : null}

            {!isStreaming ? (
              <>
                <AIMessageActions
                  message={message}
                  onRegenerate={onRegenerate}
                  onFeedback={onFeedback}
                  onToggleSaved={onToggleSaved}
                />
                {onFollowUp ? (
                  <div className="ai-message__follow-ups">
                    {FOLLOW_UP_ACTIONS.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        className="ai-chip"
                        onClick={() => onFollowUp(action.prompt)}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}
