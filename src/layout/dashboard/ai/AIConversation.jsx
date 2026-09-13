import { useEffect, useRef } from 'react';
import AIMessage from './AIMessage';

/*
 * لیست پیام‌ها با اسکرول داخلی.
 * اسکرول خودکار فقط وقتی انجام می‌شود که کاربر نزدیک ته لیست باشد؛
 * اگر بالا رفته باشد تا متن قبلی را بخواند، جایش تکان نمی‌خورد.
 */
export default function AIConversation({ messages, onRegenerate, onFeedback, onToggleSaved, onFollowUp }) {
  const scrollRef = useRef(null);
  const stickToBottom = useRef(true);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const lastStatus = messages[messages.length - 1]?.status;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottom.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, lastStatus]);

  return (
    <div
      className="ai-conversation"
      ref={scrollRef}
      onScroll={handleScroll}
      role="log"
      aria-live="polite"
      aria-label="گفت‌وگو با تپش هوشمند"
    >
      {messages.map((message) => (
        <AIMessage
          key={message.id}
          message={message}
          onRegenerate={onRegenerate}
          onFeedback={onFeedback}
          onToggleSaved={onToggleSaved}
          onFollowUp={message.status === 'done' ? onFollowUp : null}
        />
      ))}
    </div>
  );
}
