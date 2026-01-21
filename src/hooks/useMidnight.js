import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";

export function useMidnight() {
  const getLocalDate = () => format(new Date(), "yyyy-MM-dd");
  const [todayISO, setTodayISO] = useState(getLocalDate());

  const timerRef = useRef(null);
  const stateRef = useRef(todayISO); // state の「ミラー」を保持

  // state が変わるたびにミラーを更新
  useEffect(() => {
    stateRef.current = todayISO;
  }, [todayISO]);

  useEffect(() => {
    const scheduleNextUpdate = () => {
      const now = new Date();
      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        0,
      );
      const msUntilMidnight = nextMidnight - now;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const nextDate = getLocalDate();
        setTodayISO(nextDate);
        scheduleNextUpdate();
      }, msUntilMidnight);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const freshDate = getLocalDate();
        // 常に最新の ref と日付を比較
        if (freshDate !== stateRef.current) {
          setTodayISO(freshDate);
          scheduleNextUpdate();
        }
      }
    };

    scheduleNextUpdate();
    window.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []); // 依存配列なし＝最小限で効率的

  return todayISO;
}
