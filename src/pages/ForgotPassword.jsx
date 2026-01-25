import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase/config";
import Spinner from "../components/Spinner";

import { useTranslation } from "react-i18next";

export default function ForgotPassword() {
  const { t } = useTranslation();
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
      setMessage(t("auth.email_sent_msg"));
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
      setError(t("auth.error_too_many"));
      if (import.meta.env.MODE === "development") {
          console.error(err);
        }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-5">
      <div className="bg-white dark:bg-slate-900 shadow-xl rounded-2xl p-8 max-w-md w-full text-center border border-transparent dark:border-slate-800 scale-95 sm:scale-100">
        <h1 className="text-2xl font-black mb-6 text-slate-800 dark:text-white">
          {t("auth.forgot_password_title")}
        </h1>
        <form onSubmit={handleReset} className="flex flex-col gap-4">
          <input
            type="email"
            required
            value={email}
            placeholder={t("auth.email")}
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
                <span>{t("auth.verify_resending")}</span>
                <Spinner />
              </div>
            ) : cooldown > 0 ? (
              t("auth.wait_seconds", { count: cooldown })
            ) : message ? (
              t("auth.resend_reset_link")
            ) : (
              t("auth.send_reset_link")
            )}
          </button>
          {!validEmail && email.length > 0 && (
            <p className="text-red-500 text-sm font-bold">
              {t("auth.error_invalid_email")}
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
