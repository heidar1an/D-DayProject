import { getLeaguePreview } from '../../../services/products/productsService';
import { HeartGlyph, toFa } from '../productsShared';

/*
 * ── پیش‌نمایش لیگ تپش ──
 *
 * واحدِ امتیاز همان Heart است (تپش). تابلو کوتاه نگه داشته شده — هدف نشان‌دادن
 * «جایگاه» است، نه یک جدولِ کاملِ رقابت.
 */

export default function LeaguePreview() {
  const data = getLeaguePreview();

  return (
    <div className="ps-league">
      <div className="ps-league__me">
        <span className="ps-league__me-label">جایگاه شما</span>
        <span className="ps-league__me-rank">{toFa(data.position)}</span>
        <span className="ps-league__me-uni">{data.university}</span>
        <span className="ps-league__me-hearts">
          <HeartGlyph />
          {toFa(data.hearts)}
        </span>
      </div>

      <ol className="ps-league__board">
        {data.rows.map((row) => (
          <li className={`ps-league__row ${row.isYou ? 'is-you' : ''}`} key={row.rank}>
            <span className="ps-league__rank">{toFa(row.rank)}</span>
            <span className="ps-league__name">{row.name}</span>
            <span className="ps-league__uni">{row.university}</span>
            <span className="ps-league__hearts">
              <HeartGlyph />
              {toFa(row.hearts)}
            </span>
          </li>
        ))}
      </ol>

      <div className="ps-league__foot">
        <p className="ps-league__challenge">
          چالش هفته: <b>{data.challenge}</b>
        </p>
        <ul className="ps-league__achievements">
          {data.achievements.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
