import { useState, useRef, useEffect, useMemo } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase/config";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  onAuthStateChanged,
} from "firebase/auth";
import { useNavigate } from "react-router-dom";
import Spinner from "../components/Spinner";
import toast from "react-hot-toast";

export default function Auth() {
  // 'login' | 'register' | 'verify' （画面モード）
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [user, setUser] = useState(null);
  const [showResend, setShowResend] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const timerRef = useRef(null);
  const navigate = useNavigate();

  const isEmailValid = useMemo(() => /^\S+@\S+\.\S+$/.test(email), [email]);
  const isPasswordValid = password.length >= 6;
  const canSubmit = isEmailValid && isPasswordValid && !loading;

  // 1. 認証状態リスナー
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        setUser(null);
        setMode("login");
        return;
      }

      setUser(u);

      if (u.emailVerified) {
        navigate("/");
      } else {
        setMode("verify");
      }
    });
    return unsub;
  }, [navigate]);

  // 2. ポーリング：バックグラウンドで認証状態を確認
  useEffect(() => {
    let poller;
    let count = 0;

    if (mode === "verify" && user && !user.emailVerified) {
      poller = setInterval(async () => {
        count++;
        // 2.5分後にポーリングを停止（30回 × 5秒）
        if (count > 30) {
          clearInterval(poller);
          return;
        }

        await user.reload().catch(() => {});
        // 再読み込み後の最新の認証状態を使用
        if (auth.currentUser?.emailVerified) {
          clearInterval(poller);
          navigate("/");
          toast.success("認証が完了しました！");
        }
      }, 5000); 
    }

    return () => {
      if (poller) clearInterval(poller);
    };
  }, [mode, user, navigate]);

  // 3. UIリセット＆グローバルタイマーのクリーンアップ
  useEffect(() => {
    if (mode !== "verify") {
      setShowResend(false);
      setSent(false);
    }

    // 画面離脱時に再送クールダウンタイマーを解除
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [mode]);

  function mapFirebaseError(code) {
    switch (code) {
      case "auth/invalid-credential":
        return "メールアドレスまたはパスワードが正しくありません。";

      case "auth/invalid-email":
        return "メールアドレスの形式が正しくありません。";

      case "auth/email-already-in-use":
        return "このメールアドレスは既に使用されています。";

      case "auth/too-many-requests":
        return "回数が多すぎます。しばらく時間を置いてから再度お試しください。";

      default:
        console.error("未対応の Firebase エラーコード: ", code);
        return "エラーが発生しました。入力内容を確認してください。";
    }
  }
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
        // リダイレクト／認証チェックは useEffect 側で処理
      } else if (mode === "register") {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        // ユーザー用の初期 Firestore ドキュメントを作成
        await setDoc(doc(db, "users", res.user.uid), {
          uid: res.user.uid,
          email: email,
          displayName: email.split("@")[0], // メールアドレスから生成した初期表示名
          avatar: "",
          favoriteQuote: "",
          createdAt: serverTimestamp(),
        });
        auth.languageCode = "ja";
        await sendEmailVerification(res.user);
        setMode("verify");
        toast.success("認証メールを送信しました！");
      }
    } catch (err) {
      setError(mapFirebaseError(err.code));
    } finally {
      setLoading(false);
    }
  };
  const handleResend = async () => {
    //1.「ゲートキーパー」— 複数クリックやクールダウンの重複を防止
    if (!user || cooldown > 0 || isResending) return;

    setIsResending(true);
    setError("");

    try {
      await sendEmailVerification(auth.currentUser);
      setSent(true);
      setCooldown(60);

      //2. 処理を開始する
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setCooldown((sec) => {
          if (sec <= 1) {
            clearInterval(timerRef.current);
            timerRef.current = null;
            return 0;
          }
          return sec - 1;
        });
      }, 1000);
      toast.success("認証メールを再送しました。");
    } catch (err) {
      if (err.code === "auth/too-many-requests") {
        setError("送付回数制限を超えました。しばらくお待ちください。");
        setCooldown(60); // Firebase側で制限された場合も強制クールダウン
      } else {
        setError("メールの送信に失敗しました。");
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleManualRefresh = async () => {
    try {
      await auth.currentUser?.reload();
      if (auth.currentUser?.emailVerified) {
        navigate("/");
        toast.success("認証が確認されました！");
      } else {
        toast.error("まだ認証が完了していないようです。");
      }
    } catch (e) {
      toast.error("更新に失敗しました。");
      console.log("エラー発生：" + e);
    }
  };

  return (
    <div className="flex justify-center items-center h-[calc(100vh-72px)] bg-slate-50 dark:bg-slate-950 p-5 overflow-hidden">
      <div className="bg-white dark:bg-slate-900 shadow-xl rounded-3xl p-8 max-w-md w-full border border-slate-200 dark:border-slate-800 transition-all min-h-[400px] flex flex-col justify-center">
        
        {/* グローバルローディング状態 */}
        {loading ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-10">
            <Spinner size={10} />
            <p className="text-slate-500 dark:text-slate-400 animate-pulse font-bold">読み込み中...</p>
          </div>
        ) : mode === "verify" ? (
          /* 認証確認画面 */
          <div className="text-center space-y-6 animate-in fade-in duration-500">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-3xl border border-blue-100 dark:border-blue-800">
              <h2 className="text-xl font-black mb-2 dark:text-white">📧 メールをご確認ください</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">{user?.email}</p>
            </div>

            {/* 再送セクション */}
            <div className="min-h-[100px] flex flex-col items-center justify-center">
              {!showResend ? (
                <button
                  onClick={() => setShowResend(true)}
                  className="text-xs text-slate-400 underline hover:text-slate-600 transition-colors"
                >
                  メールが届かない場合はこちら
                </button>
              ) : (
                <div className="w-full space-y-3">
                  {cooldown > 0 ? (
                    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 text-sm font-bold">
                      再送まであと {cooldown} 秒
                    </div>
                  ) : (
                    <button
                      disabled={isResending}
                      onClick={handleResend}
                      className="w-full py-4 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 shadow-lg active:scale-95 transition-all disabled:opacity-50"
                    >
                      {isResending ? "送信中..." : "認証メールを再送する"}
                    </button>
                  )}
                  {sent && cooldown > 0 && (
                    <p className="text-green-600 dark:text-green-400 text-xs font-bold">✓ 再送しました</p>
                  )}
                </div>
              )}
            </div>

            {/* フッター操作 */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-4">
              <button onClick={handleManualRefresh} className="text-xs text-blue-600 font-bold hover:opacity-70">
                認証したのに進まない場合はここをクリック
              </button>
              <button onClick={() => auth.signOut()} className="text-xs text-slate-400 underline">
                別のアカウントでログイン
              </button>
            </div>
          </div>
        ) : (
          /* ログイン／新規登録フォーム */
          <>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mb-8">
              <button onClick={() => setMode("login")} className={`flex-1 py-2 rounded-xl bg-white dark:bg-slate-700  font-bold transition-all ${mode === "login" ? "shadow-sm text-blue-600 dark:text-blue-500" : "bg-slate-500/10 dark:bg-slate-900 text-slate-500"}`}>ログイン</button>
              <button onClick={() => setMode("register")} className={`flex-1 py-2 rounded-xl bg-white dark:bg-slate-700 font-bold transition-all ${mode === "register" ? "shadow-sm text-blue-600 dark:text-blue-500" : "bg-slate-500/10 dark:bg-slate-900 text-slate-500"}`}>新規登録</button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4"
            noValidate
          >
            <input
              type="email"
              placeholder="メールアドレス"
              className="p-3 rounded-xl border dark:border-slate-700 bg-transparent dark:text-white"
              onChange={(e) => setEmail(e.target.value)}
              value={email}
            />
            <input
              type="password"
              placeholder="パスワード"
              className="p-3 rounded-xl border dark:border-slate-700 bg-transparent dark:text-white"
              onChange={(e) => setPassword(e.target.value)}
              value={password}
            />

            <div className="min-h-[20px] px-1">
              {!isEmailValid && email.length > 0 && (
                <p className="text-red-500 text-[11px] font-bold">
                  ※有効なメールアドレスを入力してください
                </p>
              )}
              {password.length > 0 && password.length < 6 && (
                <p className="text-red-500 text-[11px] font-bold">
                  ※パスワードは6文字以上で入力してください
                </p>
              )}
              {error && (
                <p className="text-red-500 text-[11px] font-bold">{error}</p>
              )}
            </div>

            <button
              disabled={!canSubmit}
              className={`py-3 rounded-xl font-bold shadow-lg transition-all ${
                canSubmit
                  ? "bg-blue-600 text-white shadow-blue-500/30 active:scale-95 cursor-pointer"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 shadow-none cursor-not-allowed"
              }`}
            >
              {loading
                ? "処理中..."
                : mode === "login"
                  ? "ログイン"
                  : "登録する"}
            </button>

            {mode === "login" && (
              <div className="mt-2 text-right">
                <a
                  href="/forgot-password"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  パスワードをお忘れですか？
                </a>
              </div>
            )}
         </form>
          </>
        )}
      </div>
    </div>
  );
}