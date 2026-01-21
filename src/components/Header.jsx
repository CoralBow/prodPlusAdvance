import { useAuth } from "../contexts/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/config";
import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";

function Header() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  useEffect(() => {
    setOpen(false);
  }, [user]);

   const linkStyle = ({ isActive }) =>
    `px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
      isActive
        ? "bg-blue-50 text-blue-600 dark:bg-blue-200/30 dark:text-blue-300"
        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
    }`;
  const mobileLinkStyle = ({ isActive }) =>
    `block w-full text-center py-4 rounded-xl font-black transition-all ${
      isActive ? "bg-blue-50 dark:bg-slate-800 text-blue-600" : "text-slate-600 dark:text-white"
    }`;

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <nav className="max-w-7xl mx-auto flex justify-between items-center px-6 py-4">
        {/* --- ヘッダー：ロゴ --- */}
        <div
          className="flex items-center justify-start"
          onClick={() => (user && user.emailVerified ? navigate(`/`) : "")}
        >
          <div className="flex-shrink-0 cursor-pointer hover:scale-105 transition-transform">
            <img
              src="/prodplus_logo_tr.png"
              alt="Logo"
              className="h-10 w-10 object-contain"
            />
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            Productivity<span className="text-blue-600">++</span>
          </h1>
        </div>

        {/* PC版（横書き） */}
        <div className="hidden md:flex items-center gap-1">
          {user && user.emailVerified ? (
            <>
              <NavLink to="/" className={linkStyle}>
                ホーム
              </NavLink>
              <NavLink to="/todo" className={linkStyle}>
                To-Do
              </NavLink>
              <NavLink to="/calendar" className={linkStyle}>
                カレンダー
              </NavLink>
              <NavLink to="/weather" className={linkStyle}>
                天気
              </NavLink>
              <NavLink to="/settings" className={linkStyle}>
                設定
              </NavLink>

              <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 mx-2" />
              <button
                onClick={async (e) => {
                  e.preventDefault();
                  await signOut(auth);
                  navigate("/auth");
                }}
                className="ml-2 px-4 py-2 text-sm bg-white dark:bg-slate-900 font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
              >
                ログアウト
              </button>
              {!user && (
                <NavLink to="/auth" className={linkStyle}>
                  ログイン / 新規登録
                </NavLink>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                {!user && (
                  <NavLink to="/auth" className={linkStyle}>
                    ログイン / 新規登録
                  </NavLink>
                )}
                {user && !user.emailVerified && (
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      setOpen(false);
                      await signOut(auth);
                      navigate("/auth");
                    }}
                    className="text-sm text-red-500 px-4 bg-white dark:bg-slate-700/30"
                  >
                    ログアウト
                  </button>
                )}
              </div>
            </>
          )}{" "}
          <button
            onClick={toggle}
            className="p-2 bg-white dark:bg-slate-700/30 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
          >
            {theme === "dark" ? "🌙" : "☀️"}
          </button>
        </div>

        {/* モバイル版（縦書き）モバイルメニュ非表示状態 */}
        <div className="flex md:hidden items-center gap-3">
          <button
            onClick={toggle}
            className="p-2 text-xl bg-white dark:bg-slate-900 "
          >
            {theme === "dark" ? "🌙" : "☀️"}
          </button>
          <button
            className="text-2xl p-1 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700/30"
            onClick={() => setOpen(!open)}
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </nav>

      {/* モバイルメニュ */}
      {open && (
        <div className="absolute top-full left-0 w-full bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-4 space-y-2 shadow-2xl animate-in slide-in-from-top duration-200 z-[60]">
          {user && user.emailVerified ? (
            <>
              <NavLink
                to="/"
                className={mobileLinkStyle}
                onClick={() => setOpen(false)}
              >
                ホーム
              </NavLink>
              <NavLink
                to="/todo"
                className={mobileLinkStyle}
                onClick={() => setOpen(false)}
              >
                To-Do
              </NavLink>
              <NavLink
                to="/calendar"
                className={mobileLinkStyle}
                onClick={() => setOpen(false)}
              >
                カレンダー
              </NavLink>
              <NavLink
                to="/weather"
                className={mobileLinkStyle}
                onClick={() => setOpen(false)}
              >
                天気
              </NavLink>
              <NavLink
                to="/settings"
                className={mobileLinkStyle}
                onClick={() => setOpen(false)}
              >
                設定
              </NavLink>

              <button
                onClick={async (e) => {
                  e.preventDefault();
                  setOpen(false);
                  await signOut(auth);
                  navigate("/auth");
                }}
                className="w-full text-center px-4 py-3 text-red-500 font-bold bg-white dark:bg-slate-900/10"
              >
                ログアウト
              </button>
            </>
          ) : (
            <>
              {!user && (
                <NavLink
                  to="/auth"
                  className={mobileLinkStyle}
                  onClick={() => setOpen(false)}
                >
                  ログイン / 新規登録
                </NavLink>
              )}
              <div className="flex items-center gap-2 ">
                {user && !user.emailVerified && (
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      setOpen(false);
                      await signOut(auth);
                      navigate("/auth");
                    }}
                    className="text-sm text-red-500 px-4 bg-white dark:bg-slate-700/30"
                  >
                    ログアウト
                  </button>
                )}
              </div>
            </>
          )}{" "}
        </div>
      )}
    </header>
  );
}

export default Header;
