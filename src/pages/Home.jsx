import { useEffect, useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { ja } from "date-fns/locale";

import { shouldShowUmbrellaAlert } from "../utils/shouldShowUmbrellaAlert";
import Spinner from "../components/Spinner";
import { useTaskActions } from "../hooks/useTaskActions";
import { useDailyQuote } from "../hooks/useDailyQuote";
import { useMidnight } from "../hooks/useMidnight";

const sectionClass =
  "p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-all";

export default function Home({
  tasks,
  selectedCity,
  mapWeatherCode,
  weatherData,
  loadingWeather,
}) {
  const todayISO = useMidnight();
  const { quote, loadingQuote } = useDailyQuote(todayISO);

  const { toggleDone } = useTaskActions(tasks);
  const navigate = useNavigate();

  const todaysTasks = useMemo(() => {
    const filtered = tasks.filter((t) => {
      // 期限が設定されているタスクの場合
      if (t.dueDate) {
        // 今日が期限、または期限切れかつ未完了のタスクを表示
        const isPastOrToday = t.dueDate <= todayISO;

        if (isPastOrToday) {
          if (!t.done) return true; // 期限切れ・本日分の未完了タスクはすべて表示

          // 完了済みの場合は「今日完了したもの」のみ表示
          if (t.completedAt) {
            const doneDate = t.completedAt.toDate
              ? t.completedAt.toDate()
              : new Date(t.completedAt);

            return format(doneDate, "yyyy-MM-dd") === todayISO;
          }
        }
        return false;
      }

      // 期限が設定されていないタスクの場合
      if (!t.dueDate) {
        if (!t.done) return true; // 未完了のタスクは常に表示

        // 完了済みの場合は今日完了したもののみ表示
        if (t.completedAt) {
          const doneDate = t.completedAt.toDate
            ? t.completedAt.toDate()
            : new Date(t.completedAt);

          return format(doneDate, "yyyy-MM-dd") === todayISO;
        }
      }

      return false;
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
      return a.title.localeCompare(b.title, "ja");
    });
  }, [tasks, todayISO]);

  // -------------------------
  // 天気予報データ
  // -------------------------
  const todayWeather = weatherData?.[0];
  const tomorrowWeather = weatherData?.[1];

  // -------------------------
  // 傘アラートを非表示にした履歴マップ
  // 例：{ "2025-11-16": { "taskId1": true, "taskId2": true } }
  // -------------------------
  const [dismissedMap, setDismissedMap] = useState({});

  useEffect(() => {
    const raw = localStorage.getItem("umbrellaDismissedMap");
    if (raw) setDismissedMap(JSON.parse(raw));
  }, []);

  const dismissTaskAlert = (taskId) => {
    const updated = {
      ...dismissedMap,
      [todayISO]: {
        ...(dismissedMap[todayISO] || {}),
        [taskId]: true,
      },
    };
    setDismissedMap(updated);
    localStorage.setItem("umbrellaDismissedMap", JSON.stringify(updated));
  };
  const umbrellaTasks = tasks.filter((t) => t.dueDate === todayISO);
  const tasksNeedingUmbrella =
    todayWeather && tasks.length
      ? umbrellaTasks.filter((t) => {
          const dismissedForToday = dismissedMap[todayISO] || {};
          const dismissed = dismissedForToday[t.id];

          return !dismissed && shouldShowUmbrellaAlert([t], todayWeather);
        })
      : [];

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
        audio.play().catch((e) => console.log("Audio blocked: " + e));
        localStorage.setItem(soundKey, "true");
      }
    }
  }, [activeTask?.id, todayISO]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300 pb-20">
      <div className="max-w-4xl mx-auto p-4 space-y-8 pt-12">
        {/* ヘッダー */}
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-black text-slate-800 dark:text-white tracking-tight">
            🏠 Welcome Home
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {format(new Date(), "yyyy年 M月 d日 (E)", { locale: ja })}
          </p>
        </header>

        {/* T上部エリア：名言・天気 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 名言表示セクション */}
          <div
            className={`${sectionClass} flex flex-col justify-center relative overflow-hidden group`}
          >
            <div className="absolute -top-4 -left-2 text-8xl text-slate-100 dark:text-slate-800 font-serif opacity-50">
              “
            </div>
            <h4 className="text-m font-black uppercase tracking-widest text-blue-600 mb-4 relative z-10">
              今日の名言
            </h4>

            {loadingQuote ? (
              <div className="h-32 w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center space-y-2 transition-all">
                <div className="text-blue-600 dark:text-blue-400">
                  {" "}
                  <Spinner size={10} />
                  <p className="text-slate-500 dark:text-slate-400 animate-pulse font-bold">
                    読み込み中...
                  </p>
                </div>
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
                Quote unreachable 🙏
              </p>
            )}
          </div>

          {/* 天気情報セクション */}
          <div className={sectionClass}>
            <h4 className="text-m font-black uppercase tracking-widest text-blue-600 mb-4">
              天気 @ {selectedCity}
            </h4>

            {loadingWeather ? (
              <div className="bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center space-y-4">
                <div className="text-blue-600 dark:text-blue-400">
                  {" "}
                  <Spinner size={10} />
                  <p className="text-slate-500 dark:text-slate-400 animate-pulse font-bold">
                    読み込み中...
                  </p>
                </div>
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
                        <p className="text-[12px] font-black text-slate-400 uppercase">
                          {i === 0 ? "今日" : "明日"}・
                          {format(parseISO(d.date), "M/d (E)", {
                            locale: ja,
                          })}
                        </p>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
                          {w.label}
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
              今日のご予定{" "}
              <span className="text-sm font-medium text-slate-400">
                ({todaysTasks.length})
              </span>
            </h4>
            <button
              onClick={() => navigate("/todo")}
              className=" bg-white dark:bg-slate-900 text-xs font-bold text-blue-600 hover:underline"
            >
              全て見る →
            </button>
          </div>

          {todaysTasks.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
              <p className="text-slate-400 font-bold">
                今日はタスクがありません 🎉
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {todaysTasks.map((t) => {
                // 期限切れかつ未完了かどうかの判定
                const isOverdue = t.dueDate && t.dueDate < todayISO && !t.done;

                return (
                  <div
                    key={t.id}
                    className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                      t.done
                        ? "bg-slate-50/50 dark:bg-slate-800/20 border-slate-100 dark:border-slate-800 opacity-60"
                        : isOverdue
                          ? "bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-900/50 shadow-sm" // Red tint for the whole card
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={t.done || false}
                      onChange={() => toggleDone(t.id, t.done)}
                      className="w-5 h-5 rounded-lg border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer transition-all"
                    />

                    <span
                      className={`text-left text-sm font-bold truncate flex-1 cursor-default ${
                        t.done
                          ? "line-through text-slate-400"
                          : isOverdue
                            ? "text-red-600 dark:text-red-400"
                            : "text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {t.title}
                    </span>

                    {t.dueDate && (
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg shrink-0 transition-colors ${
                          isOverdue
                            ? "bg-red-600 text-white"
                            : "text-slate-400 bg-slate-100 dark:bg-slate-800"
                        }`}
                      >
                        {t.dueDate.split("-").slice(1).join("/")}
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
                  今日は「
                  <span className="text-blue-600 dark:text-blue-400">
                    {activeTask.title}
                  </span>
                  」のご予定がありますが、雨の予報です。傘を忘れずに！
                </p>

                <div className="mt-4 flex items-center justify-between gap-4">
                  <label className="flex items-center text-xs font-black text-slate-500 dark:text-slate-400 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={umbrellaChecked}
                      onChange={(e) => setUmbrellaChecked(e.target.checked)}
                      className="mr-2 w-5 h-5 rounded-lg border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                    />
                    わかりました
                  </label>

                  <button
                    onClick={() => {
                      if (umbrellaChecked) {
                        // このタスクの傘アラートを今日以降表示しないように記録
                        dismissTaskAlert(activeTask.id);
                        // 次回表示用にローカルチェック状態をリセット
                        setUmbrellaChecked(false);
                      } else {
                        alert(
                          "内容を確認し、「わかりました」にチェックを入れてください ✅",
                        );
                      }
                    }}
                    className={`px-5 py-2 text-xs font-black rounded-xl transition-all ${
                      umbrellaChecked
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none hover:bg-blue-700 active:scale-95"
                        : "bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800"
                    }`}
                  >
                    閉じる
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
