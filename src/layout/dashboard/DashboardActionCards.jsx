import flashCardIcon from '../../../images/icons/flash-card.png';
import notebookIcon from '../../../images/icons/notebook.png';
import editIcon from '../../../images/icons/edit.png';

const actionCards = [
  {
    id: 'notes',
    title: 'یادداشت‌ها',
    icon: editIcon,
  },
  {
    id: 'notebook',
    title: 'دفترچه مرور',
    icon: notebookIcon,
  },
  {
    id: 'flashcards',
    title: 'فلش کارت',
    icon: flashCardIcon,
  },
];

export default function DashboardActionCards({ onOpenFlashcards, onOpenNotes, onOpenReviewNotebook }) {
  const handleClick = (cardId) => {
    if (cardId === 'flashcards') onOpenFlashcards?.();
    if (cardId === 'notes') onOpenNotes?.();
    if (cardId === 'notebook') onOpenReviewNotebook?.();
  };

  return (
    <>
      {actionCards.map((card) => {
        return (
          <button
            key={card.id}
            className="dashboard-action-card"
            onClick={() => handleClick(card.id)}
            aria-label={`بخش ${card.title}`}
          >
            <img src={card.icon} alt="" className="dashboard-action-card__icon" />
            <span className="dashboard-action-card__title">{card.title}</span>
          </button>
        );
      })}
    </>
  );
}
