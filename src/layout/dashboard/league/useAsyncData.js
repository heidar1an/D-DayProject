import { useCallback, useEffect, useState } from 'react';

/*
 * هوک بارگذاری داده از سرویس لیگ — لودینگ، خطا و تلاش مجدد را یک‌جا مدیریت می‌کند.
 * هیچ حالتی باعث Layout Shift نمی‌شود چون هر مصرف‌کننده اسکلت هم‌اندازه دارد.
 */
export function useAsyncData(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    loader()
      .then((data) => {
        if (alive) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (alive) setState({ data: null, loading: false, error });
      });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
