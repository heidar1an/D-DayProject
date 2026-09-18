import ExamBuilderPreview from './visuals/ExamBuilderPreview';
import FlashcardPreview from './visuals/FlashcardPreview';
import KnowledgeNetworkPreview from './visuals/KnowledgeNetworkPreview';
import LeaguePreview from './visuals/LeaguePreview';
import ArticlesPreview from './visuals/ArticlesPreview';
import ReviewNotebookPreview from './visuals/ReviewNotebookPreview';
import SheetStackPreview from './visuals/SheetStackPreview';
import WikiHeaderPreview from './visuals/WikiHeaderPreview';

/*
 * ── نگاشتِ `visualType` به پیش‌نمایش ──
 *
 * محصولِ تازه = یک کلید تازه در این نگاشت؛ اگر پیش‌نمایشی نداشته باشد، بخش
 * بدون هیچ خطایی فقط متنِ محصول را نشان می‌دهد (return null). پیش‌نمایش‌های
 * ورق‌خور و مقالات هم مثل بقیه از همین مسیر واحد مصرف می‌شوند.
 */

const VISUALS = {
  sheets: SheetStackPreview,
  wikiHeader: WikiHeaderPreview,
  articles: ArticlesPreview,
  reviewNotebook: ReviewNotebookPreview,
  flashcard: FlashcardPreview,
  knowledgeGraph: KnowledgeNetworkPreview,
  examBuilder: ExamBuilderPreview,
  league: LeaguePreview,
};

export default function ProductVisual({ product, stage = 0 }) {
  const Component = VISUALS[product.visualType];

  if (!Component) return null;

  if (product.visualType === 'sheets') return <Component sheets={product.sheets} stage={stage} />;

  return <Component product={product} />;
}
