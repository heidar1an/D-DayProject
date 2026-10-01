import { useCallback, useEffect, useRef, useState } from 'react';

/*
 * شمارندهٔ کلیکِ ایستر اگ روی نشانِ تپش.
 *
 * قواعد:
 * • ۵ کلیکِ پشت‌سرهم ⇒ فعال‌سازی.
 * • اگر فاصلهٔ دو کلیک از `timeout` بیشتر شود، شمارنده صفر می‌شود؛ پس
 *   «پشت‌سرهم» واقعاً معنا دارد ولی آن‌قدر تنگ نیست که اذیت کند.
 * • بعد از فعال‌سازی، شمارنده بی‌درنگ صفر می‌شود.
 * • هیچ eventListener سراسری اضافه نمی‌کند و هیچ رویدادی را
 *   `preventDefault` نمی‌کند؛ پس ناوبریِ عادیِ لوگو دست‌نخورده می‌ماند.
 *
 * شمارش در `ref` نگه داشته می‌شود تا کلیک‌های سریع (که React هنوز
 * state را به‌روز نکرده) اشتباه شمرده نشوند.
 */
export function useEasterEggClick({
  requiredClicks = 5,
  timeout = 1500,
  enabled = true,
  onTrigger,
} = {}) {
  const [clickCount, setClickCount] = useState(0);
  const countRef = useRef(0);
  const timerRef = useRef(0);
  const triggerRef = useRef(onTrigger);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    triggerRef.current = onTrigger;
  }, [onTrigger]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = 0;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    countRef.current = 0;
    setClickCount(0);
  }, [clearTimer]);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) reset();
  }, [enabled, reset]);

  /* پاک‌سازی در unmount — هیچ تایمری جا نمی‌ماند */
  useEffect(() => clearTimer, [clearTimer]);

  const handleClick = useCallback(() => {
    if (!enabledRef.current) return;

    countRef.current += 1;
    const count = countRef.current;
    setClickCount(count);
    clearTimer();

    if (count >= requiredClicks) {
      reset();
      triggerRef.current?.();
      return;
    }

    timerRef.current = window.setTimeout(() => {
      timerRef.current = 0;
      countRef.current = 0;
      setClickCount(0);
    }, timeout);
  }, [requiredClicks, timeout, clearTimer, reset]);

  return { clickCount, handleClick, reset };
}

export default useEasterEggClick;
