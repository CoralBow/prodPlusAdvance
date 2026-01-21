import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  addDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { format } from "date-fns";
import { useEffect, useState } from "react";

export function useDailyQuote(todayISO) {
  const [quote, setQuote] = useState(() => {
    const localToday = format(new Date(), "yyyy-MM-dd"); // 初回チェック用にローカル日付を生成
    const cached = localStorage.getItem(`quote_${localToday}`);
    return cached ? JSON.parse(cached) : null;
  });

  const [loadingQuote, setLoadingQuote] = useState(!quote);

  async function tryZenQuotes() {
    try {
      const res = await fetch(
        "https://corsproxy.io/?url=" +
          encodeURIComponent("https://zenquotes.io/api/quotes/"),
      );
      const data = await res.json();
      if (!Array.isArray(data)) return null;

      const pick = data[Math.floor(Math.random() * data.length)];
      const en = pick.q;
      const author = pick.a || "不明";
      const jp = await translate(en);

      const ref = await addDoc(collection(db, "quotes"), {
        en,
        jp,
        author,
        source: "zenquotes",
        createdAt: Timestamp.now(),
      });

      return { id: ref.id, en, jp, author };
    } catch {
      return null;
    }
  }

  async function pickRandomQuote(excludeId) {
    const snap = await getDocs(collection(db, "quotes"));
    if (snap.empty) return null;

    const list = snap.docs
      .filter((d) => d.id !== excludeId)
      .map((d) => ({ id: d.id, ...d.data() }));

    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }

  async function translate(en) {
    const cache = JSON.parse(
      localStorage.getItem("translationCacheAll") || "{}",
    );
    if (cache[en]) return cache[en];

    try {
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
          en,
        )}&langpair=en|ja`,
      );
      const jp = (await res.json())?.responseData?.translatedText;
      if (jp) {
        cache[en] = jp;
        localStorage.setItem("translationCacheAll", JSON.stringify(cache));
      }
      return jp || "";
    } catch {
      return "";
    }
  }

  const cleanOldCache = () => {
    const prefix = "quote_";
    const currentKey = `${prefix}${todayISO}`;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      // quote_ が本日分でない場合は削除
      if (key.startsWith(prefix) && key !== currentKey) {
        localStorage.removeItem(key);
      }
    }

    // 翻訳キャッシュが存在し、サイズが大きすぎる場合も削除
    const transCache = localStorage.getItem("translationCacheAll");
    if (transCache && transCache.length > 1000000) {
      // 1MBを超えた場合
      localStorage.removeItem("translationCacheAll");
    }
  };

  useEffect(() => {
    let alive = true;
    if (!todayISO) return;
    async function loadQuote() {
      // 1日1回（または初回ロード時）クリーンアップを実行
      cleanOldCache();
      try {
        setLoadingQuote(true);

        const dailyRef = doc(db, "meta", "daily");
        const dailySnap = await getDoc(dailyRef);

        if (dailySnap.exists() && dailySnap.data().date === todayISO) {
          const qSnap = await getDoc(
            doc(db, "quotes", dailySnap.data().quoteId),
          );
          if (qSnap.exists() && alive) {
            const data = { id: qSnap.id, ...qSnap.data() };
            setQuote(data);
            localStorage.setItem(`quote_${todayISO}`, JSON.stringify(data));
            return;
          }
        }

        let chosen = null;

        const shouldTryApi =
          !dailySnap.exists() || dailySnap.data().date !== todayISO;

        if (shouldTryApi) {
          chosen = await tryZenQuotes();
        }

        if (!chosen) {
          chosen = await pickRandomQuote(
            dailySnap.exists() ? dailySnap.data().quoteId : null,
          );
        }

        if (chosen) {
          await setDoc(doc(db, "meta", "daily"), {
            date: todayISO,
            quoteId: chosen.id,
            author: chosen.author,
          });

          if (alive) {
            setQuote(chosen);
            localStorage.setItem(`quote_${todayISO}`, JSON.stringify(chosen));
          }
        }
      } catch (e) {
        console.error("エラー発生：", e);

        const lastResort = localStorage.getItem(`quote_${todayISO}`);
        if (lastResort) setQuote(JSON.parse(lastResort));
      } finally {
        if (alive) setLoadingQuote(false);
      }
    }

    loadQuote();
    return () => {
      alive = false;
    };
  }, [todayISO]);
  return { quote, loadingQuote };
}
