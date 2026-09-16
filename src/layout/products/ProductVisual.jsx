import CoordinatedExamPreview from './visuals/CoordinatedExamPreview';
import ExamBuilderPreview from './visuals/ExamBuilderPreview';
import FlashcardPreview from './visuals/FlashcardPreview';
import KnowledgeGraphPreview from './visuals/KnowledgeGraphPreview';
import LeaguePreview from './visuals/LeaguePreview';
import QuestionBankPreview from './visuals/QuestionBankPreview';
import ReaderPreview from './visuals/ReaderPreview';
import WikiPreview from './visuals/WikiPreview';

/*
 * ── نگاشتِ `visualType` به پیش‌نمایش ──
 *
 * محصولِ تازه = یک کلید تازه در این نگاشت؛ اگر پیش‌نمایشی نداشته باشد، بخش
 * بدون هیچ خطایی فقط متنِ محصول را نشان می‌دهد (return null).
 */

const VISUALS = {
  reader: ReaderPreview,
  questionBank: QuestionBankPreview,
  flashcard: FlashcardPreview,
  knowledgeGraph: KnowledgeGraphPreview,
  wiki: WikiPreview,
  examBuilder: ExamBuilderPreview,
  coordinatedExam: CoordinatedExamPreview,
  league: LeaguePreview,
};

export default function ProductVisual({ product, stage = 'question' }) {
  const Component = VISUALS[product.visualType];

  if (!Component) return null;

  /* فقط پیش‌نمایش بانک تست مرحله می‌گیرد (نمای چسبان آن را جابه‌جا می‌کند) */
  if (product.visualType === 'questionBank') return <Component stage={stage} />;

  return <Component />;
}
