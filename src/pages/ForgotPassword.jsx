import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase/config";
import Spinner from "../components/Spinner";

export default function ForgotPassword() {
  const navigate = useNavigate();

  const timerRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) navigate("/");
    });
    return () => unsub();
  }, [navigate]);

  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const validEmail = email.match(/^\S+@\S+\.\S+$/);

  const [canSubmit, setCanSubmit] = useState(false);

  useEffect(() => {
    setCanSubmit(validEmail && !loading && cooldown === 0);
  }, [validEmail, loading, cooldown]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleReset = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setMessage("");
    setError("");
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("パスワードリセットメールを送信しました。");
      setCooldown(30);

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
    } catch (err) {
      setError("リクエストが多すぎます。しばらくしてからお試しください。");
      console.log("エラー発生：" + err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center h-[calc(100vh-72px)] bg-slate-50 dark:bg-slate-950 p-5 transition-colors overflow-hidden">
      <div className="bg-white dark:bg-slate-900 shadow-xl rounded-2xl p-8 max-w-md w-full text-center border border-transparent dark:border-slate-800 scale-95 sm:scale-100">
        <h1 className="text-2xl font-black mb-6 text-slate-800 dark:text-white">
          パスワードリセット
        </h1>
        <form onSubmit={handleReset} className="flex flex-col gap-4">
          <input
            type="email"
            required
            value={email}
            placeholder="メールアドレス"
            className="border dark:border-slate-700 p-3 rounded-xl focus:ring focus:ring-blue-300 outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
            onChange={(e) => setEmail(e.target.value)}
          />

          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full py-4 rounded-xl font-black transition-all ${
              canSubmit
                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-lg active:scale-95 cursor-pointer"
                : "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed shadow-none"
            }`}
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <span>送信中…</span>
                <Spinner />
              </div>
            ) : cooldown > 0 ? (
              `${cooldown}秒お待ちください`
            ) : message ? (
              "パスワードリセットURLを再送信"
            ) : (
              "パスワードリセットURLを送信"
            )}
          </button>
          {!validEmail && email.length > 0 && (
            <p className="text-red-500 text-sm font-bold">
              メールアドレスの形式が正しくありません。
            </p>
          )}

          {message && (
            <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              {message}
            </p>
          )}
          {error && <p className="text-red-500 text-sm font-bold">{error}</p>}
        </form>
      </div>
    </div>
  );
}
