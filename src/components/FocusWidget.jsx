import { useState, useEffect, useRef } from "react";
import WordGame from "../components/WordGame";
import TracingGame from "../components/TracingGame";
import { useLocation } from "react-router-dom"; // Add this import
import { auth } from "../firebase/config";
import { useTranslation } from "react-i18next";


export default function FocusWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameMode, setGameMode] = useState(null); // "words" | "drawing"
  const { t } = useTranslation();


  const FOCUS_TIME = 25 * 60;
  const BREAK_TIME = 5 * 60;
  const [seconds, setSeconds] = useState(FOCUS_TIME);

  const [showFinishedModal, setShowFinishedModal] = useState(false);
  const location = useLocation();

  // 音楽ステート: 0 = Off, 1 = 雨, 2 = Lo-fi
  const [musicMode, setMusicMode] = useState(0);

  const chimeRef = useRef(
    new Audio(
      "https://codeskulptor-demos.commondatastorage.googleapis.com/descent/gotitem.mp3",
    ),
  );
  //雨： https://pixabay.com/users/whitenoisesleepers-42647563/
  const rainRef = useRef(
    new Audio("/sounds/pink-noise-ocean-waves-on-grainy-sand-195103.mp3"),
  );

  //lo-fi： https://pixabay.com/users/soundoffreedom-50460407/
  const lofiRef = useRef(new Audio("/sounds/undeground-lo-fi-400909.mp3"));

  //アラートの音： https://pixabay.com/sound-effects/ding-126626/
  const overRef = useRef(new Audio("/sounds/ding-126626.mp3"));

  //ループ再生とゲーム再生のロジック
  useEffect(() => {
    //すべての音楽を停止するヘルパー
    const stopAll = () => {
      [rainRef, lofiRef].forEach((ref) => {
        ref.current.pause();
        ref.current.currentTime = 0;
      });
    };

    if (!isActive || musicMode === 0 || isBreak) {
      stopAll();
      return;
    }

    let activeAudio = musicMode === 1 ? rainRef.current : lofiRef.current;

    activeAudio.loop = true;
    activeAudio
      .play()
      .catch((e) => {if (import.meta.env.MODE === "development") {
          console.error(e);
        }});

    return () => stopAll(); //モード切り替え時のクリーンアップ処理
  }, [musicMode, isActive, isBreak]);

  useEffect(() => {
    if (!isActive) return;

    if (seconds === 0) {
      handlePhaseEnd();
      return;
    }
    let interval = null;
    if (isActive && seconds > 0) {
      interval = setInterval(() => setSeconds((s) => s - 1), 1000);
    } else if (seconds === 0 && isActive) {
      handlePhaseEnd();
    }
    return () => clearInterval(interval);
  }, [isActive, seconds]);
  useEffect(() => {
    if (rainRef.current) rainRef.current.volume = 0.3;
    if (lofiRef.current) lofiRef.current.volume = 0.3;
    if (overRef.current) overRef.current.volume = 0.3;
  }, []);
  const handlePhaseEnd = () => {
    setIsActive(false);
    setGameStarted(false);

    if (!isBreak) {
      //作業終了 → 休憩開始
      chimeRef.current.play().catch(() => {});
      setShowFinishedModal(true);
      setIsBreak(true);
    } else {
      //休憩終了 → 作業開始
      overRef.current.play().catch(() => {});
      setIsBreak(false);
      setSeconds(FOCUS_TIME);
    }
  };
  const toggleMusic = () => setMusicMode((prev) => (prev + 1) % 3);
  const handleCloseAll = () => {
    setGameStarted(false);
    setGameMode(null);
    setIsOpen(false);
  };

  const formatTime = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const isHome = location.pathname === "/";
  const user = auth.currentUser;
  if (!isHome || !user) {
    return null;
  }

  return (
    <>
      {/* 1. 完了モーダル */}
      {showFinishedModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl text-center animate-in zoom-in duration-300 max-w-xs border border-slate-200 dark:border-slate-800">
            <span className="text-6xl">✨</span>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white mt-4">
              {t("focus.well_done")}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm font-bold">
              {t("focus.well_done_msg")}
            </p>
            <button
              onClick={() => {
                setShowFinishedModal(false);
                setSeconds(BREAK_TIME);
                setMusicMode(0);
                setIsActive(true);
              }}
              className="mt-6 w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-violet-200 dark:shadow-none active:scale-95"
            >
              {t("focus.start_break")}
            </button>
          </div>
        </div>
      )}

      {/* 2. メインパネル */}
      {isOpen && (
        <div
          className={`
     bg-white dark:bg-slate-900 border-4 border-red-500 shadow-2xl transition-all duration-500 ease-in-out
        ${
          gameStarted
            ? "fixed inset-0 w-screen h-[100dvh] rounded-none z-[9998]"
            : "fixed bottom-24 right-6 w-72 h-80 rounded-[40px] z-[50]"
        }
        ${
          !isOpen
            ? " bg-white dark:bg-slate-900 opacity-0 pointer-events-none"
            : " bg-white dark:bg-slate-900 opacity-100 pointer-events-auto"
        }
  `}
        >
          <button
            onClick={handleCloseAll}
            className="absolute -top-3 -left-3 w-8 h-8 bg-red-600 text-white rounded-full border-2 border-white font-bold flex items-center justify-center shadow-lg hover:bg-red-700 active:scale-90 z-[1100]"
          >
            ✕
          </button>
          {isBreak ? (
            <div className="flex flex-col h-full w-full overflow-hidden">
              {/* タイマーヘッダー（常に表示・ゲーム中は小さく表示） */}
              <div
                className={`flex justify-center items-center p-4 ${gameStarted ? "bg-slate-100 dark:bg-slate-800" : ""}`}
              >
                <div className="text-xl font-black text-violet-500 dark:text-violet-400">
                  {t("focus.break_remaining")}： {formatTime(seconds)}
                </div>
              </div>

              {!gameStarted ? (
                // ゲーム選択
                <div className="flex flex-col items-center justify-center flex-grow space-y-4">
                  <span className="text-5xl">🏖️</span>

                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => {
                        setGameMode("words");
                        setGameStarted(true);
                      }}
                      className="bg-purple-500 text-white px-8 py-4 rounded-2xl font-black text-lg hover:bg-purple-700 shadow-xl"
                    >
                      {t("word_game.typing_game")}
                    </button>

                    <button
                      onClick={() => {
                        setGameMode("drawing");
                        setGameStarted(true);
                      }}
                      className="bg-indigo-600 text-white mb-8 px-8 py-4 rounded-2xl font-black text-lg hover:bg-indigo-700 shadow-xl"
                    >
                      {t("tracing_game.title")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-grow dark:bg-slate-900">
                  {gameMode === "words" && (
                    <WordGame
                      onFinish={() => {
                        setGameStarted(false);
                        setGameMode(null);
                      }}
                    />
                  )}

                  {gameMode === "drawing" && (
                    <TracingGame
                      onFinish={() => {
                        setGameStarted(false);
                        setGameMode(null);
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          ) : (
            /* 通常の集中セッション内容 */
            <>
              <div className="flex flex-col items-center justify-around h-full py-4 px-2">
                <button
                  onClick={toggleMusic}
                  className="absolute top-6 right-6 text-2xl bg-transparent border-none transition-transform hover:scale-125 active:scale-95 cursor-pointer"
                >
                  {musicMode === 0 ? "🔇" : musicMode === 1 ? "🌧️" : "📻"}
                </button>
                <div className="flex flex-col items-center justify-between">
                  <span className="text-5xl mb-2">🍅</span>
                  <h3 className="font-black uppercase tracking-widest text-xs text-red-500 dark:text-red-400 text-center">
                    {t("focus.title")}
                  </h3>
                  {musicMode > 0 && (
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-2 animate-pulse">
                      {musicMode === 1
                        ? t("focus.playing_rain")
                        : t("focus.playing_lofi")}
                    </span>
                  )}
                </div>
                <div className="text-5xl font-black text-slate-800 dark:text-white my-4 text-center tabular-nums">
                  {formatTime(seconds)}
                </div>

                <div className="w-full flex justify-center px-4">
                  <button
                    onClick={() => setIsActive(!isActive)}
                    className={`
                w-[85%] py-3 rounded-2xl font-black text-base transition-all active:scale-95 mb-4
                ${
                  isActive
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-2 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                    : "bg-red-500 text-white border-red-700 shadow-lg shadow-red-200 dark:shadow-none hover:bg-red-600"
                }
              `}
                  >
                    {isActive ? t("focus.pause") : t("focus.start")}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 3. ラッパー要素 */}
      <div className="fixed bottom-10 right-10 z-[9999] group">
        {/* 4. ツールチップ */}
        <div
          className={`
  absolute bottom-full right-0 mb-4 w-48 md:w-56 pointer-events-none
  ${isBreak || isActive ? "hidden" : "hidden group-hover:block"} 
`}
        >
          <div className="bg-slate-900 dark:bg-slate-800 text-white p-4 rounded-2xl shadow-2xl border border-white/10">
            <p className="font-black text-red-400 text-[10px] md:text-xs uppercase tracking-tighter mb-1">
              🍅 {t("focus.pomodoro_tech")}
            </p>
            <p className="text-[11px] md:text-[13px] leading-relaxed text-gray-300">
              {t("focus.pomodoro_desc")}
            </p>

            {/* Tooltip Arrow (Moved to the right to stay over the button) */}
            <div className="absolute top-full right-6 border-8 border-transparent border-t-slate-900 dark:border-t-slate-800"></div>
          </div>
        </div>

        {/* 5. 🍅ボタン */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`
        w-20 h-20 rounded-full flex items-center justify-center text-4xl
        transition-all duration-300 transform 
        group-hover:scale-110 group-hover:-translate-y-1 active:scale-95 
        bg-white dark:bg-slate-900 shadow-xl
        ${isActive || isBreak ? "animate-pulse" : ""}
        ${isBreak ? "border-4 border-violet-500" : "border-4 border-red-500"}
        ${gameStarted ? "opacity-0 pointer-events-none translate-y-20" : "opacity-100"}
      `}
        >
          <span className="select-none">{isBreak ? "🏖️" : "🍅"}</span>
        </button>
      </div>
    </>
  );
}
