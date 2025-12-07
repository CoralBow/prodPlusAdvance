import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { useEffect, useState } from "react";
import {
  shouldShowUmbrellaAlert,
  getWeatherLabel,
} from "../utils/shouldShowUmbrellaAlert.js";

export default function Home({
  tasks,
  selectedCity,
  mapWeatherCode,
  weatherData,
  loadingWeather,
}) {
  const [quote, setQuote] = useState(null);
  const [jpQuote, setJpQuote] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const nowDate = new Date(now);
  const today = nowDate.toISOString().split("T")[0];
  const todayKey = nowDate.toDateString();

  const todaysTasks = tasks.filter((t) => !t.dueDate || t.dueDate === today);

  // -------------------------
  // アラート消しのマップ内容：
  // { "2025-11-16": {"taskId1": true, "taskId2": true} }
  // -------------------------
  const [dismissedMap, setDismissedMap] = useState({});

  useEffect(() => {
    const raw = localStorage.getItem("umbrellaDismissedMap");
    if (raw) setDismissedMap(JSON.parse(raw));
  }, []);

  const dismissTaskAlert = (taskId) => {
    const updated = {
      ...dismissedMap,
      [todayKey]: {
        ...(dismissedMap[todayKey] || {}),
        [taskId]: true,
      },
    };
    setDismissedMap(updated);
    localStorage.setItem("umbrellaDismissedMap", JSON.stringify(updated));
  };

  // -------------------------
  // 天気予報
  // -------------------------
  const todayWeather = weatherData?.[0];
  const tomorrowWeather = weatherData?.[1];

  // -------------------------
  // モチベーション引用取得
  // -------------------------
  useEffect(() => {
    const storedData = localStorage.getItem("zenQuotesCache");
    const storedTranslationData = localStorage.getItem("translationCache");
    const parsed = storedData ? JSON.parse(storedData) : null;
    const parsedTranslation = storedTranslationData
      ? JSON.parse(storedTranslationData)
      : null;

    const lastFetched = parsed?.fetchedDate;
    const lastFetchedTranslation = parsedTranslation?.fetchedDate;
    const todayDate = new Date().toDateString();

    const fallbackQuotes = [
      {
        q: "Do not be afraid of failure; be afraid of not trying.",
        a: "Unknown",
      },
      {
        q: "In the middle of difficulty lies opportunity.",
        a: "Albert Einstein",
      },
      {
        q: "The only way to do great work is to love what you do.",
        a: "Steve Jobs",
      },
      {
        q: "A journey of a thousand miles begins with a single step.",
        a: "Lao Tzu",
      },
      { q: "Happiness depends upon ourselves.", a: "Aristotle" },
    ];

    const selectDailyQuote = (quotes) => {
      const dayOfYear = Math.floor(
        (new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
      );
      return quotes[dayOfYear % quotes.length];
    };

    const translateToJapanese = async (text) => {
      // 翻訳が保存されている場合は、今日の翻訳を再利用
      if (parsedTranslation && lastFetchedTranslation === todayDate) {
        setJpQuote(parsedTranslation.text);
        return;
      }

      try {
        const res = await fetch(
          `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
            text
          )}&langpair=en|ja`
        );
        const data = await res.json();
        const jpText = data.responseData.translatedText;

        setJpQuote(jpText);

        // その日のキャッシュを使用する
        localStorage.setItem(
          "translationCache",
          JSON.stringify({ text: jpText, fetchedDate: todayDate })
        );
      } catch (e) {
        console.error("翻訳失敗:", e);
      }
    };

    const fetchZenQuotes = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7000); // 7 秒タイムアウト

        const res = await fetch(
          "https://api.allorigins.win/raw?url=https://zenquotes.io/api/quotes/",
          { signal: controller.signal }
        );

        clearTimeout(timeout);

        if (!res.ok) throw new Error(`ZenQuotes HTTP ${res.status}`);

        const data = await res.json();

        // ZenQuotesからたまにエラーかテキスト帰ってくる場合
        if (
          !Array.isArray(data) ||
          data.error ||
          data?.[0]?.q?.includes("Too many requests")
        ) {
          throw new Error("ZenQuotes rate-limited"); // フォールバックさせる
        }

        // 全リストをキャッシュする
        localStorage.setItem(
          "zenQuotesCache",
          JSON.stringify({ quotes: data, fetchedDate: todayDate })
        );

        const dailyQuote = selectDailyQuote(data);
        setQuote({ q: dailyQuote.q, a: dailyQuote.a });
        translateToJapanese(dailyQuote.q);
      } catch (err) {
        console.warn("ZenQuotes failed, using fallback:", err);

        // 今日のフォールバックがすでにキャッシュされている場合は、それを再利用
        const fallbackCache = localStorage.getItem("fallbackQuoteCache");
        if (fallbackCache) {
          const parsedFallback = JSON.parse(fallbackCache);
          if (parsedFallback.fetchedDate === todayDate) {
            setQuote(parsedFallback.quote);
            translateToJapanese(parsedFallback.quote.q);
            return;
          }
        }

        // 新しいフォールバック引用を選んでキャッシュ
        const random =
          fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];
        setQuote(random);
        translateToJapanese(random.q);
        localStorage.setItem(
          "fallbackQuoteCache",
          JSON.stringify({ quote: random, fetchedDate: todayDate })
        );
      }
    };

    // 利用可能な場合はキャッシュ済みデータを使用
    if (parsed && lastFetched === todayDate) {
      const dailyQuote = selectDailyQuote(parsed.quotes);
      setQuote({ q: dailyQuote.q, a: dailyQuote.a });
      translateToJapanese(dailyQuote.q);
    } else {
      fetchZenQuotes();
    }
  }, []);

  // -------------------------
  // アラート対象検討
  // -------------------------
  const umbrellaTasks = tasks.filter((t) => t.dueDate && t.dueDate === today);

  const tasksNeedingUmbrella =
    todayWeather && tasks.length
      ? umbrellaTasks.filter((t) => {
          const dismissedForToday = dismissedMap[todayKey] || {};
          const dismissed = dismissedForToday[t.id];

          return !dismissed && shouldShowUmbrellaAlert([t], todayWeather);
        })
      : [];

  const [umbrellaChecked, setUmbrellaChecked] = useState(false);

  const activeTask =
    tasksNeedingUmbrella.length > 0 ? tasksNeedingUmbrella[0] : null;

  // アラート音
  useEffect(() => {
    if (activeTask) {
      const audio = new Audio("/sounds/ding-126626.mp3");
      audio.volume = 0.5;
      audio.play().catch(() => {});
    }
  }, [activeTask]);

  return (
    <div className="flex flex-col min-h-screen overflow-x-hidden">
      {/* アラート */}
      {activeTask && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-blue-100 text-blue-800 p-4 rounded-xl shadow-lg z-50">
          ☔ 今日は「{activeTask.title}」のタスクがあるけど、
          {getWeatherLabel(todayWeather)}になりそうだから傘を忘れずにね。
          <div className="mt-3 flex items-center justify-between">
            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={umbrellaChecked}
                onChange={(e) => setUmbrellaChecked(e.target.checked)}
                className="mr-2"
              />
              わかりました
            </label>
            <button
              onClick={() => {
                if (umbrellaChecked) {
                  dismissTaskAlert(activeTask.id);
                  setUmbrellaChecked(false);
                } else {
                  alert("「わかりました」をチェックしてね ✅");
                }
              }}
              className="text-sm text-blue-600 underline ml-3 bg-white"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* ページの中身 */}
      <div className="space-y-4">
        <header className="p-4 text-center text-black-700 font-bold text-3xl">
          🏠 Welcome Home
        </header>
        <div className="grid gap-2">
          {/* モチベーション引用セクション */}
          <div className="bg-white p-4 rounded-xl shadow">
            <h4 className="text-2xl font-bold mb-4 text-blue-600">
              今日の名言 (Today’s Quote)
            </h4>
            {quote ? (
              <>
                <p className="italic text-gray-800 text-lg mb-2">“{quote.q}”</p>
                {jpQuote && <p className="text-gray-600 mb-1">💬 {jpQuote}</p>}
                <p className="text-sm text-gray-500">— {quote.a}</p>
              </>
            ) : (
              <p>読み込み中...</p>
            )}
          </div>

          {/* 天気予報 */}
          <div className="bg-white p-8 rounded-xl shadow">
            <h4 className="text-2xl font-bold mb-4 text-blue-600">
              天気 ＠ {selectedCity}
            </h4>
            {loadingWeather && <p>読み込み中...</p>}
            {!loadingWeather && todayWeather && (
              <div className="flex gap-8">
                {[todayWeather, tomorrowWeather].map((d, i) => {
                  const w = mapWeatherCode(d.code);
                  return (
                    <div
                      key={d.date}
                      className="flex items-center bg-gray-50 rounded-lg p-3 w-1/2"
                    >
                      <div className="text-xl mr-4">{w.icon}</div>
                      <div>
                        <div className="text-sm text-gray-600">
                          {i === 0 ? "今日" : "明日"}・
                          {format(parseISO(d.date), "M月d日 (E)", {
                            locale: ja,
                          })}
                        </div>
                        <div className="text-lg font-bold">
                          {Math.round(d.max)}° / {Math.round(d.min)}°
                        </div>
                        <div className="text-sm">{w.label}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 本日のタスク */}
        <div className="w-full">
          {todaysTasks.length === 0 ? (
            <h4 className="text-2xl font-bold mb-4 text-blue-600 text-center">
              今日はタスクがありません 🎉
            </h4>
          ) : (
            <>
              <div>
                {" "}
                <h4 className="text-2xl font-bold mb-4 text-blue-600 text-center">
                  今日のタスク：
                </h4>
              </div>
              <ol
                className=" 
                list-decimal list-outside 
                mx-auto text-left 
                bg-white p-4 ps-8 rounded"
                style={{ maxWidth: "400px" }}
              >
                {todaysTasks.map((t) => (
                  <li
                    key={t.id}
                    className={`font-bold ${
                      t.done ? "line-through text-gray-400" : ""
                    }`}
                  >
                    {t.title} (〆 {t.dueDate ? t.dueDate : "なし"})
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
