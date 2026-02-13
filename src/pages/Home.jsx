import { useEffect, useState, useMemo, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { ja, ru, enUS } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { shouldShowUmbrellaAlert } from "../utils/shouldShowUmbrellaAlert";
import Spinner from "../components/Spinner";
import { useTaskActions } from "../hooks/useTaskActions";
import { useDailyQuote } from "../hooks/useDailyQuote";
import { useMidnight } from "../hooks/useMidnight";

const sectionClass =
  "p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-all";

export default function Home({
  cities,
  tasks,
  selectedCity,
  setSelectedCity,
  mapWeatherCode,
  weatherData,
  loadingWeather,
}) {
  const { t, i18n } = useTranslation();

  const dateLocale = useMemo(() => {
    if (i18n.language === "ja") return ja;
    if (i18n.language === "ru") return ru;
    return enUS;
  }, [i18n.language]);

  const todayISO = useMidnight();
  const { quote, loadingQuote } = useDailyQuote(todayISO);

  const { toggleDone } = useTaskActions(tasks);
  const navigate = useNavigate();

  const todaysTasks = useMemo(() => {
    const filtered = tasks.filter((task) => {
      let isCompletedToday = false;

      if (task.done) {
        if (task.completedAt) {
          try {
            const doneDate = task.completedAt.toDate
              ? task.completedAt.toDate()
              : new Date(task.completedAt);

            if (!isNaN(doneDate.getTime())) {
              isCompletedToday = format(doneDate, "yyyy-MM-dd") === todayISO;
            }
          } catch (e) {
            if (import.meta.env.MODE === "development") {
              console.error(e);
            }
          }
        } else {
          isCompletedToday = true;
        }
      }

      if (task.dueDate) {
        const isPastOrToday = task.dueDate <= todayISO;
        if (isPastOrToday) {
          if (!task.done) return true;
          if (isCompletedToday) return true;
        }
        return false;
      } else {
        if (!task.done) return true;
        return isCompletedToday;
      }
    });
    // 元の配列を破壊しないようにスプレッドでコピーしてからソート
    return [...filtered].sort((a, b) => {
      //  完了済みタスクを下に表示するための並び替え
      if (a.done !== b.done) return a.done ? 1 : -1;

      // 第1優先：期限日（早い順）
      if (a.dueDate && b.dueDate) {
        return a.dueDate.localeCompare(b.dueDate);
      }

      // 期限ありタスクを期限なしタスクより上に表示
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;

      // 第2優先：タイトル順（日本語対応）
      return a.title.localeCompare(b.title, i18n.language);
    });
  }, [i18n.language, tasks, todayISO]);

  // -------------------------
  // 天気予報データ
  // -------------------------
  const todayWeather = weatherData?.[0];
  const tomorrowWeather = weatherData?.[1];
  const handleCityChange = useCallback(
    (e) => setSelectedCity(e.target.value),
    [setSelectedCity],
  );

  // -------------------------
  // 傘アラートを非表示にした履歴マップ
  // 例：{ "2025-11-16": { "taskId1": true, "taskId2": true } }
  // -------------------------
  const [dismissedMap, setDismissedMap] = useState({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem("umbrellaDismissedMap");
      if (raw) setDismissedMap(JSON.parse(raw));
    } catch {
      setDismissedMap({});
    }
  }, []);

  const dismissTaskAlert = (taskId) => {
    setDismissedMap((prev) => {
      const updated = {
        ...prev,
        [todayISO]: {
          ...(prev[todayISO] || {}),
          [taskId]: true,
        },
      };

      localStorage.setItem("umbrellaDismissedMap", JSON.stringify(updated));

      return updated;
    });
  };

  const umbrellaTasks = useMemo(() => {
    return tasks.filter((task) => task.dueDate === todayISO);
  }, [tasks, todayISO]);

  const tasksNeedingUmbrella = useMemo(() => {
    if (!todayWeather) return [];

    const dismissedForToday = dismissedMap[todayISO] || {};

    return umbrellaTasks.filter(
      (task) =>
        !dismissedForToday[task.id] &&
        shouldShowUmbrellaAlert([task], todayWeather),
    );
  }, [umbrellaTasks, dismissedMap, todayISO, todayWeather]);

  const [umbrellaChecked, setUmbrellaChecked] = useState(false);

  const activeTask =
    tasksNeedingUmbrella.length > 0 ? tasksNeedingUmbrella[0] : null;

  // アラート音 https://pixabay.com/sound-effects/ding-126626/
  useEffect(() => {
    if (activeTask) {
      //  今日このタスクに対して既に音を鳴らしたかを確認
      const soundKey = `sound_${todayISO}_${activeTask.id}`;
      const alreadyPlayed = localStorage.getItem(soundKey);

      if (!alreadyPlayed) {
        const audio = new Audio("/sounds/ding-126626.mp3");
        audio.volume = 0.5;
        audio.play().catch((e) => {
          if (import.meta.env.MODE === "development") {
            console.error(e);
          }
        });
        localStorage.setItem(soundKey, "true");
      }
    }
  }, [activeTask, todayISO]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300 pb-20">
      <div className="max-w-4xl mx-auto p-4 space-y-8 pt-12">
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-black text-slate-800 dark:text-white tracking-tight">
            {t("home.welcome")}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {format(new Date(), t("date.long"), { locale: dateLocale })}
          </p>
        </header>

        {/* 上部エリア：名言・天気 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* 名言表示セクション */}
          <div
            className={`${sectionClass} flex flex-col justify-center relative overflow-hidden group  min-h-[320px] md:min-h-[284px]`}
          >
            <div className="absolute -top-4 -left-2 text-8xl text-slate-100 dark:text-slate-800 font-serif opacity-50">
              “
            </div>
            <h4 className="text-m font-black uppercase tracking-widest text-blue-600 mb-4 relative z-10">
              {t("home.daily_quote")}
            </h4>

            {loadingQuote ? (
              <div className="flex flex-col items-center justify-center">
                <Spinner />
                <p className="text-center text-slate-500 dark:text-slate-400 animate-pulse font-bold">
                  {t("home.loading")}
                </p>
              </div>
            ) : quote ? (
              <div className="relative z-10">
                <p className="text-lg font-bold text-slate-700 dark:text-slate-200 leading-relaxed mb-3">
                  {quote.en}
                </p>
                {quote.jp && (
                  <p className="text-left text-sm text-slate-500 dark:text-slate-400 mb-4 border-l-2 border-blue-500 pl-3">
                    {quote.jp}
                  </p>
                )}
                <p className="text-xs font-black text-slate-400">
                  — {quote.author}
                </p>
              </div>
            ) : (
              <p className="text-slate-400 italic text-sm">
                {t("home.quote_unreachable")}
              </p>
            )}
          </div>

          {/* 天気情報セクション */}
          <div
            className={`${sectionClass} flex flex-col justify-center relative overflow-hidden group  min-h-[320px] md:min-h-[284px]`}
          >
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-3">
              <h4 className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {t("weather.weather_short", {
                  city: t(`cities.${selectedCity}`),
                })}
              </h4>
              <select
                value={selectedCity}
                onChange={handleCityChange}
                className="appearance-none w-full sm:w-auto p-3 pr-10 border border-slate-200 rounded-xl dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none ring-0 focus:ring-0 transition-all cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22%2394a3b8%22%20viewBox%3D%220%200%2016%2016%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M8%201a.5.5%200%200%201%20.5.5v11.793l3.146-3.147a.5.5%200%200%201%20.708.708l-4%204a.5.5%200%200%201-.708%200l-4-4a.5.5%200%200%201%20.708-.708L7.5%2013.293V1.5A.5.5%200%200%201%208%201%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1rem_1rem] bg-[right_0.75rem_center] bg-no-repeat"
              >
                {cities.map((c) => (
                  <option key={c.name} value={c.name}>
                    {t(`cities.${c.name}`)}
                  </option>
                ))}
              </select>
            </div>

            {loadingWeather ? (
              <div className="flex flex-col items-center justify-center">
                <Spinner />
                <p className="text-center text-slate-500 dark:text-slate-400 animate-pulse font-bold">
                  {t("home.loading")}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {[todayWeather, tomorrowWeather].map((d, i) => {
                  if (!d) return null;
                  const w = mapWeatherCode(d.code);
                  return (
                    <div
                      key={d.date}
                      className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] md:text-[12px] font-black text-slate-400 uppercase">
                          {i === 0 ? t("weather.today") : t("weather.tomorrow_short")}
                          ・
                          {format(parseISO(d.date), t("date.short"), {
                            locale: dateLocale,
                          })}
                        </p>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
                          {t(w.label)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-slate-800 dark:text-white leading-none">
                          {Math.round(d.max)}°
                        </p>
                        <p className="text-xs font-bold text-slate-400">
                          {Math.round(d.min)}°
                        </p>
                      </div>
                      <div className="w-[64px] flex justify-center text-3xl shrink-0">
                        {w.icon}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 今日のタスクセクション */}
        <div className={sectionClass}>
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
              {t("home.todays_schedule")}{" "}
              <span className="text-sm font-medium text-slate-400">
                ({todaysTasks.length})
              </span>
            </h4>
            <button
              onClick={() => navigate("/todo")}
              className=" bg-white dark:bg-slate-900 text-xs font-bold text-blue-600 hover:underline"
            >
              {t("home.view_all")}
            </button>
          </div>

          {todaysTasks.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
              <p className="text-slate-400 font-bold">{t("home.no_tasks")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {todaysTasks.map((task) => {
                // 期限切れかつ未完了かどうかの判定
                const isOverdue =
                  task.dueDate && task.dueDate < todayISO && !task.done;

                return (
                  <div
                    key={task.id}
                    className={`flex items-center gap-3 p-4 rounded-2xl border transition-all duration-300 ${
                      task.done
                        ? "bg-slate-50/50 dark:bg-slate-800/20 border-slate-100 dark:border-slate-800 opacity-60"
                        : isOverdue
                          ? "bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-900/50 shadow-sm" // Red tint for the whole card
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={task.done || false}
                      onChange={() => toggleDone(task.id, task.done)}
                      className="w-5 h-5 rounded-lg border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer transition-all"
                    />

                    <span
                      className={`text-left text-sm font-bold truncate flex-1 cursor-default ${
                        task.done
                          ? "line-through text-slate-400"
                          : isOverdue
                            ? "text-red-600 dark:text-red-400"
                            : "text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {task.title}
                    </span>

                    {task.dueDate && (
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg shrink-0 transition-colors ${
                          isOverdue
                            ? "bg-red-600 text-white"
                            : "text-slate-400 bg-slate-100 dark:bg-slate-800"
                        }`}
                      >
                        {task.dueDate.split("-").slice(1).join("/")}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 画面上部中央：傘リマインド通知 */}
        {activeTask && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-white dark:bg-slate-900 border-2 border-blue-500 p-5 rounded-3xl shadow-2xl z-[9999] animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex gap-4 items-start">
              <div className="text-3xl animate-bounce">☔</div>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-800 dark:text-white leading-relaxed">
                  {t("home.umbrella_alert", { title: activeTask.title })}
                </p>

                <div className="mt-4 flex items-center justify-between gap-4">
                  <label className="flex items-center text-xs font-black text-slate-500 dark:text-slate-400 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={umbrellaChecked}
                      onChange={(e) => setUmbrellaChecked(e.target.checked)}
                      className="mr-2 w-5 h-5 rounded-lg border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                    />
                    {t("home.umbrella_confirm")}
                  </label>

                  <button
                    onClick={() => {
                      if (umbrellaChecked) {
                        // このタスクの傘アラートを今日以降表示しないように記録
                        dismissTaskAlert(activeTask.id);
                        // 次回表示用にローカルチェック状態をリセット
                        setUmbrellaChecked(false);
                      } else {
                        alert(t("home.umbrella_check_error"));
                      }
                    }}
                    className={`px-5 py-2 text-xs font-black rounded-xl transition-all ${
                      umbrellaChecked
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none hover:bg-blue-700 active:scale-95"
                        : "bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800"
                    }`}
                  >
                    {t("home.umbrella_close")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
