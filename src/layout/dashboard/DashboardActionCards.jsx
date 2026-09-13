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

export default function DashboardActionCards({ onOpenFlashcards, onOpenNotes }) {
  /* «دفترچه مرور» هنوز لایه ندارد؛ بقیهٔ کارت‌ها به بخش خودشان وصل‌اند */
  const handleClick = (cardId) => {
    if (cardId === 'flashcards') onOpenFlashcards?.();
    if (cardId === 'notes') onOpenNotes?.();
  };

  return (
    <>
      {actionCards.map((card) => {
        const isOpenable = card.id === 'flashcards' || card.id === 'notes';

        return (
          <button
            key={card.id}
            className="dashboard-action-card"
            onClick={isOpenable ? () => handleClick(card.id) : undefined}
            aria-label={isOpenable ? `بخش ${card.title}` : undefined}
          >
            <img src={card.icon} alt="" className="dashboard-action-card__icon" />
            <span className="dashboard-action-card__title">{card.title}</span>
          </button>
        );
      })}
    </>
  );
}
