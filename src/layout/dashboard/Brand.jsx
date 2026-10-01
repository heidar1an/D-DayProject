import { useEffect, useRef, useState } from 'react';
import heartbeatMark from '../../../images/pictures/600ppi/logo-mark.webp';
import { useEasterEggClick } from '../../hooks/useEasterEggClick';
import { triggerEasterEgg } from '../../components/easter-egg/egBus';

/*
 * نشانِ تپش در هدرِ داشبورد.
 * روی همین نشان شمارندهٔ ایستر اگ نشسته است: ۵ کلیکِ پشت‌سرهم بازی را باز
 * می‌کند. رفتارِ عادیِ لینک (`#top`) دست‌نخورده می‌ماند.
 */
export default function Brand({ interactive = true }) {
  const [burst, setBurst] = useState(false);
  const burstTimer = useRef(0);

  useEffect(
    () => () => {
      if (burstTimer.current) window.clearTimeout(burstTimer.current);
    },
    [],
  );

  const { clickCount, handleClick } = useEasterEggClick({
    enabled: interactive,
    onTrigger: () => {
      setBurst(true);
      if (burstTimer.current) window.clearTimeout(burstTimer.current);
      burstTimer.current = window.setTimeout(() => setBurst(false), 640);
      triggerEasterEgg();
    },
  });

  return (
    <a
      className={`brand ${clickCount >= 4 ? 'is-egg-charging' : ''} ${burst ? 'is-egg-burst' : ''}`}
      href="#top"
      aria-label="بازگشت به ابتدای صفحه"
      onClick={handleClick}
    >
      <span className="brand__mark">
        <img src={heartbeatMark} alt="" />
      </span>
      <span className="brand__word">تپش</span>
    </a>
  );
}
