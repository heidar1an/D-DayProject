const peers = [
  { id: 'alireza', name: 'علیرضا' },
  { id: 'leila', name: 'لیلا' },
  { id: 'mohammad', name: 'محمد' },
];

export default function PeersSection() {
  return (
    <div className="peers-section">
      <h3 className="peers-section__title">همخوان‌ها</h3>
      
      <div className="peers-section__list">
        {peers.map((peer) => (
          <button key={peer.id} className="peers-section__peer">
            <div className="peers-section__avatar">
              <svg
                className="peers-section__person"
                width="40"
                height="40"
                viewBox="0 0 32 32"
                fill="currentColor"
              >
                <circle cx="16" cy="11" r="5"/>
                <path d="M16 18c-5 0-9 3-9 7h18c0-4-4-7-9-7z"/>
              </svg>
            </div>
            <span className="peers-section__name">{peer.name}</span>
          </button>
        ))}
        
        <button className="peers-section__peer peers-section__peer--add" aria-label="افزودن همخوان">
          <div className="peers-section__avatar peers-section__avatar--add">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </div>
        </button>
      </div>
    </div>
  );
}
