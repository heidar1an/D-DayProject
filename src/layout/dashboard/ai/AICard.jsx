import { useAIConversation } from './aiStore';
import { SparkIcon, SendIcon as ArrowIcon } from './aiShared';
import './ai.css';

/*
 * کارت ورودی «تپش هوشمند» در بخش «سایر بخش‌ها».
 * کارت یک سطح تمیز و هم‌زبان با بقیهٔ کارت‌های این بخش است: نشان + عنوان + یک خط توضیح.
 * کل کارت نقطهٔ ورود به لایهٔ گفت‌وگو است؛ هیچ کنترل تو در تویی داخلش نیست.
 */
export default function AICard({ onOpen }) {
  const ai = useAIConversation();
  const hasConversation = ai.messages.length > 0;

  return (
    <button
      type="button"
      className="ai-card ai-card--layer-entry"
      onClick={() => onOpen?.()}
      aria-label="ورود به تپش هوشمند"
    >
      <span className="ai-card__badge" aria-hidden="true">
        <SparkIcon width={22} height={22} />
      </span>

      <strong className="ai-card__entry-title">تپش هوشمند</strong>

      <span className="ai-card__entry-sub">
        {hasConversation
          ? 'گفت‌وگوی قبلی‌ات آمادهٔ ادامه است'
          : 'سؤال بپرس، مفهوم بگیر، تست بساز — همراه مطالعه‌ات'}
      </span>

      <span className="ai-card__entry-arrow" aria-hidden="true">
        <ArrowIcon width={16} height={16} />
      </span>
    </button>
  );
}
