import flashCardIcon from '../../../images/icons/flash-card.png';
import notebookIcon from '../../../images/icons/notebook.png';
import editIcon from '../../../images/icons/edit.png';

const actionCards = [
  {
    id: 'flashcards',
    title: 'فلش کارت',
    icon: flashCardIcon,
  },
  {
    id: 'notebook',
    title: 'دفترچه مرور',
    icon: notebookIcon,
  },
  {
    id: 'notes',
    title: 'یادداشت‌ها',
    icon: editIcon,
  },
];

export default function DashboardActionCards() {
  return (
    <div className="dashboard-action-cards">
      {actionCards.map((card) => (
        <button key={card.id} className="dashboard-action-card">
          <img src={card.icon} alt="" className="dashboard-action-card__icon" />
          <span className="dashboard-action-card__title">{card.title}</span>
        </button>
      ))}
    </div>
  );
}
