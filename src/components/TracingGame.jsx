import { useRef, useState, useEffect } from "react";
import opentype from "opentype.js";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";

export default function TracingGame({ onFinish }) {
  const [quote, setQuote] = useState(null);
  const [pathsReady, setPathsReady] = useState(false);
  const [maxScroll, setMaxScroll] = useState(0);
  const [viewIdx, setViewIdx] = useState(0);
  const [showFinishScreen, setShowFinishScreen] = useState(false);

  const particlesRef = useRef([]); // {x, y, opacity, size} を保持する
  const canvasRef = useRef(null);
  const allPathsRef = useRef([]);
  const activePointRef = useRef({ t: 0, segmentIdx: 0 });
  const userPathRef = useRef([]);
  const tracingRef = useRef(false);
  const rhythmRef = useRef(null);
  const scrollRef = useRef(0);
  const [isMobile] = useState(window.innerWidth < 768);
  // 2本指スクロール用に、最後のY座標を追跡する ref
  const lastTouchY = useRef(0);

  const DOT_SPEED = 0.0018;
  const charPositionsRef = useRef([]);

  useEffect(() => {
    async function fetchQuote() {
      try {
        const todayISO = new Date().toLocaleDateString("sv-SE");
        const dailySnap = await getDoc(doc(db, "meta", "daily"));
        if (dailySnap.exists() && dailySnap.data().date === todayISO) {
          const qSnap = await getDoc(
            doc(db, "quotes", dailySnap.data().quoteId),
          );
          if (qSnap.exists()) setQuote(qSnap.data());
        }
      } catch (e) {
        console.error(e);
      }
    }
    fetchQuote();
  }, []);

  useEffect(() => {
    return () => {
      // 外部から終了させた場合実行
      if (rhythmRef.current) {
        rhythmRef.current.pause();
        rhythmRef.current.currentTime = 0;
        rhythmRef.current = null;
      }

      userPathRef.current = [];
      particlesRef.current = [];
      scrollRef.current = 0;
      setViewIdx(0);
    };
  }, []);

  useEffect(() => {
    if (!quote?.jp) return;
    //ベル音： https://pixabay.com/sound-effects/chimes-and-water-451427/
    rhythmRef.current = new Audio("/sounds/chimes-and-water-451427.mp3");
    rhythmRef.current.volume = 0.1;
    rhythmRef.current.loop = true;

    opentype.load("/fonts/KanjiStrokeOrders.ttf", (err, font) => {
      if (err) return console.error("Font Error:", err);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();

      const generatedPaths = [];
      const tokens = quote.jp.split("");

      // --- PC版（横書き） ---
      if (!isMobile) {
        const fontSize = 150;
        const colWidth = fontSize * 1.5;
        const topPadding = 40;
        const sidePadding = 100;

        let curX = rect.width - sidePadding;
        let curY = topPadding;
        let charInCol = 0;

        tokens.forEach((char) => {
          const isSpace = char === " " || char === "\u3000";
          const isPunctuation = char === "、" || char === "。";

          if (isSpace || isPunctuation || charInCol >= 3) {
            curX -= colWidth;
            curY = topPadding;
            charInCol = 0;
            if (isSpace || isPunctuation) return;
          }

          const path = font.getPath(
            char,
            curX - fontSize / 2,
            curY + fontSize * 0.85,
            fontSize,
          );
          curY += fontSize + 10;
          charInCol++;

          pushPathCommands(path, generatedPaths);
        });

        const totalWidth = rect.width - curX + sidePadding;
        setMaxScroll(Math.max(0, totalWidth - rect.width));
      }

      // --- モバイル版（縦書き） ---
      else {
        const fontSize = 150;
        const topPadding = 60;
        let curX = rect.width / 2;
        let curY = topPadding;
        const charPositions = []; // 各漢字のY座標を保存するため

        tokens.forEach((char) => {
          const isSpace = char === " " || char === "\u3000";
          const isPunctuation = char === "、" || char === "。";

          if (isSpace || isPunctuation) {
            curY += 60;
            return;
          }

          // 保存：次の文字へ進む前にこのY座標を記録する
          charPositions.push(curY);

          const path = font.getPath(
            char,
            curX - fontSize / 2,
            curY + fontSize * 0.85,
            fontSize,
          );

          curY += fontSize + 10;
          pushPathCommands(path, generatedPaths);
        });

        // ボタン操作用に座標を保存
        charPositionsRef.current = charPositions;

        // スクロール上限を設定
        const extraPadding = rect.height * 0.8;
        setMaxScroll(Math.max(0, curY - rect.height * 0.25 + extraPadding));
      }

      allPathsRef.current = generatedPaths;
      setPathsReady(true);
    });
    return () => {
      if (rhythmRef.current) {
        rhythmRef.current.pause();
        rhythmRef.current.currentTime = 0; // Resets the track to the beginning
        rhythmRef.current = null; // Clears the reference
      }
    };
  }, [quote, isMobile]);

  // コードを整理するためのヘルパー
  const pushPathCommands = (path, generatedPaths) => {
    let currentSeg = [];
    path.commands.forEach((cmd) => {
      if (cmd.type === "M" && currentSeg.length > 0) {
        generatedPaths.push(createSegment(currentSeg));
        currentSeg = [];
      }
      if (cmd.x !== undefined) currentSeg.push({ x: cmd.x, y: cmd.y });
    });
    if (currentSeg.length > 0) generatedPaths.push(createSegment(currentSeg));
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function createSegment(pts) {
    let total = 0;
    const lens = [0];
    for (let i = 1; i < pts.length; i++) {
      total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      lens.push(total);
    }
    return { pts, lens, total };
  }

  const handleWheel = (e) => {
    scrollRef.current = Math.min(
      maxScroll,
      Math.max(0, scrollRef.current + e.deltaY),
    );
  };

  useEffect(() => {
    if (!pathsReady) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    let frameId;
    const render = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();

      // スクロール方向の分岐
      if (isMobile) {
        ctx.translate(0, -scrollRef.current); // 下方向へ移動
      } else {
        ctx.translate(scrollRef.current, 0); // 右方向へ移動
      }

      // 1. ガイド用ゴーストライン
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)"; // 不透明（固定）
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 0; // ぼやけ防止のため、ガイドのグローを無効化

      allPathsRef.current.forEach((seg) => {
        ctx.beginPath();
        seg.pts.forEach((p, i) =>
          i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
        );
        ctx.stroke();
      });

      ctx.shadowBlur = 0; // ユーザー描画前にパフォーマンス向上のためグローを無効化

      // 2. ユーザーの描画
      if (userPathRef.current.length > 1) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // グロー描画（外側のぼかし）
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#22d3ee";
        ctx.strokeStyle = "rgba(34, 211, 238, 0.3)";
        ctx.lineWidth = 10;
        ctx.beginPath();
        userPathRef.current.forEach((p, i) => {
          if (p.gap) {
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
          } else {
            i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
          }
        });
        ctx.stroke();

        // コア描画（内側の明るい線）
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#ffffff"; // 明るい白色のコア
        ctx.lineWidth = 3;
        ctx.beginPath();
        userPathRef.current.forEach((p, i) => {
          if (p.gap) {
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
          } else {
            i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
          }
        });
        ctx.stroke();
      }

      // 3. 瞑想用ドット
      if (allPathsRef.current.length > 0) {
        activePointRef.current.t = (activePointRef.current.t + DOT_SPEED) % 1;
        const seg = allPathsRef.current[activePointRef.current.segmentIdx];
        const target = activePointRef.current.t * seg.total;
        let i = 1;
        while (i < seg.lens.length && seg.lens[i] < target) i++;
        const p1 = seg.pts[i - 1],
          p2 = seg.pts[i];

        if (p1 && p2) {
          const ratio =
            (target - seg.lens[i - 1]) / (seg.lens[i] - seg.lens[i - 1] || 1);
          const dotX = p1.x + (p2.x - p1.x) * ratio;
          const dotY = p1.y + (p2.y - p1.y) * ratio;

          // --- A. スパークル生成 ---
          if (Math.random() > 0.3) {
            // パフォーマンスのため、時々のみ生成
            particlesRef.current.push({
              x: dotX,
              y: dotY,
              vx: (Math.random() - 0.5) * 1,
              vy: (Math.random() - 0.5) * 1,
              life: 1.0,
              size: Math.random() * 3 + 1,
            });
          }

          // --- B. スパークルの更新と描画 ---
          particlesRef.current.forEach((p) => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.02; // スパークルのフェード速度

            if (p.life > 0) {
              ctx.fillStyle = `rgba(255, 255, 255, ${p.life})`;
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
              ctx.fill();
            }
          });
          // 消えたスパークルを削除
          particlesRef.current = particlesRef.current.filter((p) => p.life > 0);

          // --- C. 発光する先端を描画 ---
          // 外側のグロー
          ctx.shadowBlur = 20;
          ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
          ctx.fillStyle = "rgba(34, 211, 238, 0.5)"; // シアン系の色味
          ctx.beginPath();
          ctx.arc(dotX, dotY, 10, 0, Math.PI * 2);
          ctx.fill();

          // 明るい白色の中心
          ctx.shadowBlur = 5;
          ctx.fillStyle = "white";
          ctx.beginPath();
          ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
      ctx.restore();
      frameId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(frameId);
  }, [pathsReady, maxScroll, isMobile]);

  const scrollToChar = (direction) => {
    const positions = charPositionsRef.current;
    if (!positions.length) return;

    let nextIdx = viewIdx;
    if (direction === "next")
      nextIdx = Math.min(positions.length - 1, viewIdx + 1);
    else nextIdx = Math.max(0, viewIdx - 1);

    setViewIdx(nextIdx);

    // ターゲットは、先ほど保存したY座標そのもの
    const targetY = positions[nextIdx];
    const rect = canvasRef.current.getBoundingClientRect();

    // 上から約20%の位置にセンタリング
    const safeTarget = Math.min(
      maxScroll,
      Math.max(0, targetY - rect.height * 0.2),
    );

    // 高速でシンプルなスクロール
    scrollRef.current = safeTarget;
  };

  const handleUndo = () => {
    const paths = userPathRef.current;
    if (paths.length === 0) return;

    // 最後の「gap: true」の位置を探す
    let lastGapIndex = -1;
    for (let i = paths.length - 1; i >= 0; i--) {
      if (paths[i].gap) {
        lastGapIndex = i;
        break;
      }
    }

    if (lastGapIndex !== -1) {
      // そのギャップ以降をすべて削除
      userPathRef.current = paths.slice(0, lastGapIndex);
    }
  };

  const handleExit = () => {
    if (rhythmRef.current) {
      rhythmRef.current.pause();
    }
    setShowFinishScreen(true);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0f172a] text-white overflow-hidden select-none">
      <div className="relative flex-grow md:pt-14 bg-black/10 overflow-hidden">
        <canvas
          ref={canvasRef}
          onWheel={handleWheel}
          onPointerDown={(e) => {
            const rect = canvasRef.current.getBoundingClientRect();
            // 1. スクロール処理（2本目の指）
            if (e.pointerType === "touch" && !e.isPrimary) {
              lastTouchY.current = e.clientY;
              tracingRef.current = false;
              return;
            }

            // 2. 座標計算
            // PCではX方向、モバイルではY方向にスクロール
            const x =
              e.clientX - rect.left + (!isMobile ? -scrollRef.current : 0);
            const y = e.clientY - rect.top + (isMobile ? scrollRef.current : 0);

            lastTouchY.current = e.clientY;

            // 3.ドットを瞬間移動させる
            let closest = activePointRef.current.segmentIdx;
            let minD = Infinity;
            allPathsRef.current.forEach((seg, idx) => {
              seg.pts.forEach((p) => {
                const d = Math.hypot(x - p.x, y - p.y);
                if (d < minD) {
                  minD = d;
                  closest = idx;
                }
              });
            });

            activePointRef.current.segmentIdx = closest;
            activePointRef.current.t = 0;
            tracingRef.current = true;

            userPathRef.current.push({ x, y, gap: true });
            rhythmRef.current?.play().catch(() => {});
          }}
          onPointerMove={(e) => {
            // 1. 補助スクロール（2本指）
            if (e.pointerType === "touch" && !e.isPrimary) {
              const deltaY = lastTouchY.current - e.clientY;
              scrollRef.current = Math.min(
                maxScroll,
                Math.max(0, scrollRef.current + deltaY),
              );
              lastTouchY.current = e.clientY;
              return;
            }

            if (!tracingRef.current) return;

            // 2. 描画処理（スクロール補正込み）
            const rect = canvasRef.current.getBoundingClientRect();
            const x =
              e.clientX - rect.left + (!isMobile ? -scrollRef.current : 0);
            const y = e.clientY - rect.top + (isMobile ? scrollRef.current : 0);

            userPathRef.current.push({ x, y });
          }}
          onPointerUp={() => (tracingRef.current = false)}
          className="w-full h-full touch-none cursor-crosshair"
        />

        {isMobile && (
          <div className="absolute bottom-40 left-6 flex flex-col items-center gap-4 z-[2000]">
            {/* 戻るボタン */}
            <button
              onClick={() => scrollToChar("prev")}
              disabled={viewIdx === 0}
              className={`w-12 h-12 rounded-full backdrop-blur-md flex items-center justify-center transition-all active:scale-90 border
        ${
          viewIdx === 0
            ? "bg-slate-900/20 border-white/5 text-white/5"
            : "bg-slate-800/80 border-white/20 text-cyan-400 shadow-xl"
        }`}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              >
                <path d="M18 15l-6-6-6 6" />
              </svg>
            </button>

            {/* 次へボタン */}
            <button
              onClick={() => scrollToChar("next")}
              disabled={viewIdx === allPathsRef.current.length - 1}
              className={`w-16 h-16 rounded-full backdrop-blur-xl flex items-center justify-center transition-all active:scale-90 border-2
        ${
          viewIdx === allPathsRef.current.length - 1
            ? "bg-slate-900/20 border-white/5 text-white/5"
            : "bg-cyan-500/30 border-cyan-400 text-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.3)]"
        }`}
            >
              <svg
                viewBox="0 0 24 24"
                width="32"
                height="32"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
              >
                <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
              </svg>
            </button>
          </div>
        )}

        {!isMobile && (
          <div className="absolute top-1 left-8 text-left pointer-events-none opacity-40">
            <p className="text-slate-300 italic text-[16px] max-w-md leading-relaxed">
              {quote?.en} ({quote?.author})
            </p>
          </div>
        )}

        {/* 中央の説明文（モバイルでは非表示）*/}
        {!isMobile && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none">
            <span className="text-[18px] uppercase text-white/50 font-bold">
              文字を描きながらリラックス
            </span>
          </div>
        )}

        {/* 右上ツールバー */}
        <div className="absolute top-2 right-4 md:right-8 flex items-center gap-6">
          {/* 元に戻すボタン */}
          <button
            onClick={handleUndo}
            title="ストロークを元に戻す"
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 hover:text-cyan-400 text-white/40 transition-all active:scale-90"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 7v6h6" />
              <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
            </svg>
          </button>

          {/* 全消去ボタン */}
          <button
            onClick={() => {
              userPathRef.current = [];
              setViewIdx(0);
              scrollRef.current = 0;
            }}
            className="text-[12px] md:text-[14px] uppercase tracking-widest bg-white/5 hover:bg-white/10 text-white/40 hover:text-red-400 transition-colors whitespace-nowrap"
          >
            全てリセット
          </button>
        </div>
        {/* 終了ボタン：誤タップ防止のため左下 */}
        {!isMobile ? (
          <button
            onClick={handleExit}
            className="absolute bottom-20 left-8 bg-white/5 hover:bg-white/10 px-6 py-2 rounded-full text-[10px] tracking-widest uppercase transition-all border border-white/5"
          >
            終了
          </button>
        ) : (
          ""
        )}
        {showFinishScreen && (
          <div className="absolute inset-0 z-[5000] flex items-center justify-center backdrop-blur-sm bg-black/40">
            <div
              className="
        bg-white dark:bg-slate-900
        border border-slate-200 dark:border-slate-700
        shadow-2xl rounded-3xl
        px-8 py-10 max-w-sm w-[90%]
        text-slate-900 dark:text-slate-100
        transition-all duration-300
      "
            >
              <div className="text-center space-y-6">
                <h1 className="text-2xl font-bold">よくできました 🌙</h1>

                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  今日もお疲れさまでした。
                  <br />
                  少しでも、心が落ち着く時間になっていたら嬉しいです。
                </p>

                <button
                  onClick={onFinish}
                  className="
            mt-4 px-6 py-2 rounded-full
            bg-cyan-500/20 text-cyan-600 dark:text-cyan-300
            hover:bg-cyan-500/30
            transition-all active:scale-95
          "
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
