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
import PasswordInput from "../components/PasswordInput";
import { useTranslation } from "react-i18next";

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
  const { t, i18n } = useTranslation();

  const isEmailValid = useMemo(() => /^\S+@\S+\.\S+$/.test(email), [email]);
  const isPasswordValid = password.length >= 6;
  const canSubmit = isEmailValid && isPasswordValid && !loading;
  const pollCountRef = useRef(0);

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
    pollCountRef.current = 0;

    if (mode === "verify" && user && !user.emailVerified) {
      poller = setInterval(async () => {
        pollCountRef.current++;
        // 2.5分後にポーリングを停止（30回 × 5秒）
        if (pollCountRef.current > 30) {
          clearInterval(poller);
          return;
        }

        await user.reload().catch(() => {});
        // 再読み込み後の最新の認証状態を使用
        if (auth.currentUser?.emailVerified) {
          clearInterval(poller);
          navigate("/");
          toast.success(t("auth.toast_verify_checked"));
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
        return t("auth.error_invalid_credential");
      case "auth/invalid-email":
        return t("auth.error_invalid_email");
      case "auth/email-already-in-use":
        return t("auth.error_email_in_use");
      case "auth/too-many-requests":
        return t("auth.error_too_many");
      default:
        return t("auth.error_generic");
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
        auth.languageCode = i18n.language;
        await sendEmailVerification(res.user);
        setMode("verify");
        toast.success(t("auth.toast_verify_sent"));
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
      toast.success(t("auth.toast_verify_sent"));
    } catch (err) {
      if (err.code === "auth/too-many-requests") {
        setError(t("auth.error_too_many"));
        setCooldown(60); // Firebase側で制限された場合も強制クールダウン
      } else {
        setError(t("auth.resend_failed"));
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
        toast.success(t("auth.toast_verify_checked"));
      } else {
        toast.error(t("auth.toast_verify_pending"));
      }
    } catch (e) {
      toast.error(t("auth.toast_refresh_failed"));
      if (import.meta.env.MODE === "development") {
        console.error(e);
      }
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-5">
      <div className="bg-white dark:bg-slate-900 shadow-xl rounded-3xl p-8 max-w-md w-full border border-slate-200 dark:border-slate-800 transition-all min-h-[400px] flex flex-col justify-center">
        {/* グローバルローディング状態 */}
        {loading ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-10">
            <Spinner size={8} />
            <p className="text-slate-500 dark:text-slate-400 animate-pulse font-bold">
              {t("auth.loading")}
            </p>
          </div>
        ) : mode === "verify" ? (
          /* 認証確認画面 */
          <div className="text-center space-y-6 animate-in fade-in duration-500">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-3xl border border-blue-100 dark:border-blue-800">
              <h2 className="text-xl font-black mb-2 dark:text-white">
                {t("auth.verify_title")}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {user?.email}
              </p>
            </div>

            {/* 再送セクション */}
            <div className="min-h-[100px] flex flex-col items-center justify-center">
              {!showResend ? (
                <button
                  onClick={() => setShowResend(true)}
                  className="text-xs text-slate-400 bg-white dark:bg-slate-900 underline hover:text-slate-600 transition-colors"
                >
                  {t("auth.verify_resend_hint")}
                </button>
              ) : (
                <div className="w-full space-y-3">
                  {cooldown > 0 ? (
                    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 text-sm font-bold">
                      {t("auth.verify_cooldown")} {cooldown} {t("auth.sec")}
                    </div>
                  ) : (
                    <button
                      disabled={isResending}
                      onClick={handleResend}
                      className="w-full py-4 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 shadow-lg active:scale-95 transition-all disabled:opacity-50"
                    >
                      {isResending
                        ? t("auth.verify_resending")
                        : t("auth.verify_resend")}
                    </button>
                  )}
                  {sent && cooldown > 0 && (
                    <p className="text-green-600 dark:text-green-400 text-xs font-bold">
                      {t("auth.verify_resent")}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* フッター操作 */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-4">
              <button
                onClick={handleManualRefresh}
                className="text-xs text-blue-600 bg-white dark:bg-slate-900 font-bold hover:opacity-70"
              >
                {t("auth.verify_manual")}
              </button>
              <button
                onClick={() => auth.signOut()}
                className="text-xs text-slate-400 underline bg-white dark:bg-slate-900"
              >
                {t("auth.verify_other_account")}
              </button>
            </div>
          </div>
        ) : (
          /* ログイン／新規登録フォーム */
          <>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mb-8">
              <button
                onClick={() => {
                  setError("");
                  setMode("login");
                }}
                className={`flex-1 py-2 rounded-xl font-bold transition-all ${
                  mode === "login"
                    ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-500"
                    : "bg-slate-100 dark:bg-slate-900 text-slate-500"
                }`}
              >
                {t("auth.login")}
              </button>
              <button
                onClick={() => {
                  setError("");
                  setMode("register");
                }}
                className={`flex-1 py-2 rounded-xl font-bold transition-all ${
                  mode === "register"
                    ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-500"
                    : "bg-slate-100 dark:bg-slate-900 text-slate-500"
                }`}
              >
                {t("auth.register")}
              </button>
            </div>
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-4"
              noValidate
            >
              <input
                type="email"
                placeholder={t("auth.email")}
                className="p-3 rounded-xl border dark:border-slate-700 bg-transparent dark:text-white"
                onChange={(e) => setEmail(e.target.value)}
                value={email}
              />
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.password")}
                ariaLabel={t("auth.password")}
              />

              <div className="min-h-[20px] px-1">
                {!isEmailValid && email.length > 0 && (
                  <p className="text-red-500 text-[11px] font-bold">
                    {t("auth.email_invalid")}
                  </p>
                )}
                {password.length > 0 && password.length < 6 && (
                  <p className="text-red-500 text-[11px] font-bold">
                    {t("auth.password_invalid")}
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
                  ? t("auth.loading")
                  : mode === "login"
                    ? t("auth.login")
                    : t("auth.register")}
              </button>

              {mode === "login" && (
                <div className="mt-2 text-right">
                  <a
                    href="/forgot-password"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    {t("auth.forgot_password")}
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
