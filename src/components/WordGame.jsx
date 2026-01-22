import { useState, useEffect, useRef } from "react";

const SOUNDS = {
  correct: "/sounds/correct-6033.mp3", //https://pixabay.com/sound-effects/correct-6033/
  error: "/sounds/error-04-199275.mp3", //https://pixabay.com/sound-effects/error-04-199275/
  victory: "/sounds/victory-chime-366449.mp3", //https://pixabay.com/sound-effects/victory-chime-366449/
  bgMusic: "/sounds/video-game-music-loop-27629.mp3", //https://pixabay.com/sound-effects/musical-video-game-music-loop-27629/
};

export default function WordGame({ onFinish }) {
  const [gameState, setGameState] = useState("input");
  const [keywords, setKeywords] = useState("");
  const [userInput, setUserInput] = useState("");
  const [fallingWords, setFallingWords] = useState([]);
  const [score, setScore] = useState(0);
  const [hasStartedFalling, setHasStartedFalling] = useState(false);
  const [combo, setCombo] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  const playerRef = useRef(null);
  const bgMusicRef = useRef(null);
  const gameAreaRef = useRef(null);
  const intervalRef = useRef(null);

  // デバイスの画面サイズを確認
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // オーディオ初期化
  useEffect(() => {
    playerRef.current = new Audio();
    bgMusicRef.current = new Audio(SOUNDS.bgMusic);
    bgMusicRef.current.loop = true;
    bgMusicRef.current.volume = 0.1;

    return () => {
      if (playerRef.current) playerRef.current.pause();
      if (bgMusicRef.current) bgMusicRef.current.pause();
    };
  }, []);

  // ゲーム状態に応じたBGM制御
  useEffect(() => {
    if (gameState === "playing") {
      bgMusicRef.current
        ?.play()
        .catch(() => console.log("音楽がブラウザ上にブロックされました"));
    } else if (gameState === "finished") {
      bgMusicRef.current?.pause();
      playSound("victory");
    }
  }, [gameState]);

  const playSound = (type) => {
    if (!playerRef.current) return;
    playerRef.current.src = SOUNDS[type];
    playerRef.current.volume = 0.2;
    playerRef.current.currentTime = 0;
    playerRef.current.play().catch(() => {});
  };

  const toHalfWidth = (str) => {
    return str
      .replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
      .replace(/\s/g, " ")
      .trim()
      .toLowerCase();
  };
  const handleStart = () => {
    const wordList = keywords.split(/[ ,、/・]+/).filter((w) => w.length > 0);
    if (wordList.length > 0) {
      startGame(wordList);
    }
  };

  const BLACKLIST = [
    "cocaine",
    "cocain",
    "drug",
    "weed",
    "nude",
    "sex",
    "kill",
    "death",
  ];

  const EMERGENCY_WORDS = [
    "FOCUS",
    "POWER",
    "ZEN",
    "GOAL",
    "MIND",
    "FLOW",
    "DASH",
    "SKILL",
    "TASK",
    "CHILL",
  ];

  const startGame = async (cleanKeywords) => {
    setGameState("loading");
    let allWords = [...cleanKeywords.map((k) => toHalfWidth(k))];

    try {
      const target = allWords[0] || "focus";
      const res = await fetch(
        `https://api.datamuse.com/words?ml=${target}&max=50`,
      );

      if (res.ok) {
        const data = await res.json();

        const related = data
          .filter((item) => {
            const word = item.word.toLowerCase();
            return (
              item.score > 2500 && // 1. MUST HAVE HIGH RELEVANCE
              word.length <= 8 && // 2. Length check
              word.length >= 3 &&
              //!word.includes(" ") && // 3. No phrases
              !BLACKLIST.includes(word) // 4. Safety blacklist
            );
          })
          .map((item) => item.word.toLowerCase());

        allWords = [...new Set([...allWords, ...related])];
      }
    } catch (err) {
      console.warn("APIエラー発生：", err);
    }

    if (allWords.length < 5) {
      allWords = [...new Set([...allWords, ...EMERGENCY_WORDS])];
    }

    // シャッフル
    const wordCount = isMobile ? 10 : 15;
    const finalPool = allWords
      .sort(() => Math.random() - 0.5)
      .slice(0, wordCount);

    const initialWords = finalPool.map((text, i) => ({
      text,
      id: Math.random(),
      x: Math.random() * 60 + 20, // 左右の端に寄りすぎないように調整
      y: isMobile ? -i * 180 - 100 : -i * 150 - 100,
      rotation: Math.random() * 360,
      rotSpeed: isMobile
        ? Math.random() * 1.0 - 0.5
        : Math.random() * 2.0 - 1.0,
      speed: isMobile ? Math.random() * 0.5 + 0.3 : Math.random() * 0.7 + 0.4,
    }));

    setFallingWords(initialWords);
    setHasStartedFalling(true);
    setGameState("playing");
  };

  // ゲームループ
  useEffect(() => {
    if (gameState !== "playing") {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setFallingWords((prev) => {
        if (!prev) return [];
        const floor = gameAreaRef.current?.clientHeight || 600;
        // デッドゾーン：モバイルではキーボードを考慮して早めに消去
        const deadZone = isMobile ? floor * 0.5 : floor - 100;
        const remaining = prev.filter((w) => w.y < deadZone);

        if (remaining.length < prev.length) setCombo(0);
        if (hasStartedFalling && remaining.length === 0)
          setGameState("finished");

        return remaining.map((w) => ({
          ...w,
          y: w.y + w.speed,
          rotation: w.rotation + (w.rotSpeed || 0),
        }));
      });
    }, 16);

    return () => clearInterval(intervalRef.current);
  }, [gameState, hasStartedFalling, isMobile]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      const cleanInput = toHalfWidth(userInput);
      const matchIdx = fallingWords.findIndex(
        (w) => toHalfWidth(w.text) === cleanInput,
      );

      if (matchIdx !== -1) {
        const newCombo = combo + 1;
        setCombo(newCombo);
        setScore((s) => s + (100 + newCombo * 50));
        setFallingWords((prev) => prev.filter((_, i) => i !== matchIdx));
        playSound("correct");
      } else {
        setCombo(0);
        playSound("error");
      }
      setUserInput("");
    }
  };

  return (
    <div
      className="fixed inset-0 h-[100dvh] w-screen bg-slate-950 overflow-hidden touch-none font-sans"
      ref={gameAreaRef}
    >
      {/* 1. 入力フェーズ */}
      {gameState === "input" && (
        <div className="flex flex-col items-center justify-center h-full space-y-8 px-6 text-center animate-in fade-in duration-700">
          <div className="space-y-2">
            <h2 className="text-white font-black text-2xl md:text-5xl tracking-tighter italic">
              ブレインブラスト
            </h2>
            <div className="h-1 w-24 bg-blue-500 mx-auto rounded-full"></div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/10 backdrop-blur-md max-w-sm">
            <p className="text-blue-400 font-bold mb-2 text-sm">【遊び方】</p>
            <p className="text-slate-300 text-xs leading-relaxed">
              英単語を3つ入力してください。AIが関連する単語を生成します。
              <br />
              <span className="text-orange-400 font-bold text-xs">
                ※システム上英語のみ入力可能です。
                <br />
                本機能は第三者提供の英語APIを使用しています。
                <br />
                APIの仕様により、意図しない関連語や不正確な結果が含まれる場合があります。
              </span>
            </p>
          </div>

          <input
            className="p-5 w-full max-w-xs rounded-2xl bg-slate-800 text-white border-2 border-slate-700 focus:border-blue-500 transition-all outline-none text-xl text-center shadow-2xl"
            placeholder="work, sun, music"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleStart()}
          />

          <button
            onClick={handleStart}
            className="group relative bg-blue-600 hover:bg-blue-500 text-white px-16 py-4 rounded-full font-black text-xl transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(37,99,235,0.4)]"
          >
            ゲーム開始
          </button>
        </div>
      )}

      {/* 2. ロード中 */}
      {gameState === "loading" && (
        <div className="flex flex-col items-center justify-center h-full text-white">
          <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
          <p className="mt-6 font-bold tracking-widest text-slate-400">
            単語を生成中...
          </p>
        </div>
      )}

      {/* 3. プレイ中 */}
      {gameState === "playing" && (
        <div className="flex flex-col h-full w-full bg-slate-950 text-white overflow-hidden">
          <div className="px-8 pt-12 pb-6 flex justify-between items-center bg-gradient-to-b from-slate-900 via-slate-900 to-transparent z-20">
            <div>
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-1">
                スコア
              </p>
              <p className="text-4xl font-black tabular-nums tracking-tighter">
                {score}
              </p>
            </div>
            {combo > 1 && (
              <div className="flex flex-col items-end">
                <span className="text-orange-500 text-3xl font-black italic animate-bounce">
                  {combo}
                </span>
                <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">
                  コンボ
                </span>
              </div>
            )}
          </div>

          {/* ゲームフィールド：モバイルでは上半分に制限 */}
          <div className="relative w-full overflow-hidden h-[40dvh] md:h-auto md:flex-grow">
            {fallingWords.map((word) => (
              <div
                key={word.id}
                className="absolute font-black text-2xl md:text-4xl select-none uppercase tracking-tighter drop-shadow-lg whitespace-nowrap transition-colors"
                style={{
                  left: `${word.x}%`,
                  top: `${word.y}px`,
                  transform: `translate(-50%, -50%) rotate(${word.rotation}deg)`,
                  color:
                    word.y >
                    (gameAreaRef.current?.clientHeight || 600) *
                      (isMobile ? 0.35 : 0.6)
                      ? "#ff4e4e"
                      : "white",
                }}
              >
                {word.text}
              </div>
            ))}
          </div>

          {/* 入力エリア：モバイルではキーボードの上に配置されるように */}
          <div className="w-full p-4 bg-slate-900 border-t border-white/10 md:bg-transparent md:border-t-0 md:pb-12">
            <div className="max-w-md mx-auto">
              <input
                autoFocus
                className="w-full p-4 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-center text-2xl border-4 border-blue-500 outline-none font-black uppercase shadow-2xl"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="TYPE!"
                autoComplete="off"
                style={{ fontSize: "16px" }} // モバイルのズーム防止
              />
              {isMobile && (
                <p className="text-[8px] text-center mt-2 text-slate-500 font-bold">
                  画面上の単語をタイプしてください
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. 終了 */}
      {gameState === "finished" && (
        <div className="flex flex-col items-center justify-center h-full text-white bg-blue-900/20 backdrop-blur-xl animate-in zoom-in duration-500">
          <div className="bg-slate-900 p-12 rounded-[3rem] border border-white/10 shadow-2xl text-center space-y-6">
            <h2 className="text-2xl font-bold text-blue-400">RESULT</h2>
            <p className="text-7xl font-black text-white tracking-tighter">
              {score}
            </p>
            <p className="text-slate-400 font-medium">
              スコア獲得！お疲れ様でした。
            </p>
            <button
              onClick={onFinish}
              className="w-full bg-white text-slate-950 py-5 rounded-2xl font-black text-xl hover:bg-blue-400 transition-colors"
            >
              休憩に戻る
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
