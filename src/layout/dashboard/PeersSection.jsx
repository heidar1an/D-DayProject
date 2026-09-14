const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toFa = (value) => String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);

const peers = [
  { id: 'alireza', name: 'علیرضا', initial: 'ع', hearts: 184, tint: '#e26d6d' },
  { id: 'leila', name: 'لیلا', initial: 'ل', hearts: 142, tint: '#5b8cc7' },
  { id: 'mohammad', name: 'محمد', initial: 'م', hearts: 97, tint: '#937fcd' },
];

export default function PeersSection() {
  return (
    <div className="peers-section">
      <header className="peers-section__header">
        <h3 className="peers-section__title">همخوان‌ها</h3>
        <span className="peers-section__count">{toFa(peers.length)} همخوان فعال</span>
      </header>

      <ul className="peers-section__list">
        {peers.map((peer) => (
          <li key={peer.id}>
            <button
              type="button"
              className="peers-section__peer"
              style={{ '--peer-tint': peer.tint }}
              aria-label={`پروفایل ${peer.name}`}
            >
              <span className="peers-section__avatar" aria-hidden="true">{peer.initial}</span>
              <span className="peers-section__meta">
                <span className="peers-section__name">{peer.name}</span>
                <small className="peers-section__hearts">❤️ {toFa(peer.hearts)} قلب این هفته</small>
              </span>
              <svg
                className="peers-section__chevron"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                aria-hidden="true"
              >
                <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </li>
        ))}

        <li>
          <button type="button" className="peers-section__peer peers-section__peer--add" aria-label="افزودن همخوان">
            <span className="peers-section__avatar peers-section__avatar--add" aria-hidden="true">+</span>
            <span className="peers-section__meta">
              <span className="peers-section__name">افزودن همخوان تازه</span>
              <small className="peers-section__hearts">با شناسه تپش دوستانت را دعوت کن</small>
            </span>
          </button>
        </li>
      </ul>
    </div>
  );
}
