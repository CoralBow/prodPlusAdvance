import { useAuth } from "../contexts/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/config";
import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import { useTranslation } from "react-i18next";

function Header() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const { t, i18n } = useTranslation();

  const [langMenuOpen, setLangMenuOpen] = useState(false);

  const languages = [
    { code: "ja", label: "JP", flag: "🇯-🇵" },
    { code: "en", label: "EN", flag: "🇺-🇸" },
    { code: "ru", label: "RU", flag: "🇷-🇺" },
  ];
  const isRu = i18n.language?.startsWith("ru");

  useEffect(() => {
    setOpen(false);
  }, [user]);

  const linkStyle = ({ isActive }) =>
    `px-2 py-2 rounded-xl ${
      isRu ? "text-xs" : "text-sm"
    } font-bold uppercase transition-all duration-200 ${
      isActive
        ? "bg-blue-50 text-blue-600 dark:bg-blue-200/30 dark:text-blue-300"
        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
    }`;
  const mobileLinkStyle = ({ isActive }) =>
    `block w-full text-center uppercase py-4 rounded-xl font-black transition-all ${
      isActive
        ? "bg-blue-50 dark:bg-slate-800 text-blue-600"
        : "text-slate-600 dark:text-white"
    }`;

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("i18nextLng", lng);
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white dark:bg-slate-950 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <nav className="max-w-7xl mx-auto flex justify-between items-center px-4 py-3">
        {/* --- ヘッダー：ロゴ --- */}
        <div
          className="flex items-center justify-start"
          onClick={() => (user && user.emailVerified ? navigate(`/`) : "")}
        >
          <div className="flex-shrink-0 cursor-pointer hover:scale-105 transition-transform">
            <img
              src="/prodplus_logo_tr.png"
              alt="Logo"
              className="h-8 w-8 object-contain"
            />
          </div>
          <h1 className="text-xl font-black tracking-tighter text-slate-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            Productivity<span className="text-blue-600">++</span>
          </h1>
        </div>

        {/* PC版（横書き） */}
        <div className="hidden md:flex items-center gap-1">
          {user && user.emailVerified ? (
            <>
              <NavLink to="/" className={linkStyle}>
                {t("navigation.home")}
              </NavLink>
              <NavLink to="/todo" className={linkStyle}>
                {t("navigation.todo")}
              </NavLink>
              <NavLink to="/calendar" className={linkStyle}>
                {t("navigation.calendar")}
              </NavLink>
              <NavLink to="/weather" className={linkStyle}>
                {t("navigation.weather")}
              </NavLink>
              <NavLink to="/settings" className={linkStyle}>
                {t("navigation.settings")}
              </NavLink>

              <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 mx-2" />
              <button
                onClick={async (e) => {
                  e.preventDefault();
                  await signOut(auth);
                  navigate("/auth");
                }}
                className="ml-2 px-4 py-2 text-sm bg-white dark:bg-slate-900 font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors border border-slate-100 dark:border-slate-800"
              >
                {t("navigation.logout")}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              {/* Login Button Logic... Simplified for brevity if needed but keeping structure */}
              <NavLink to="/auth" className={linkStyle}>
                {t("navigation.login")}
              </NavLink>
            </div>
          )}

          {/* Custom Language Dropdown (PC) */}
          <div className="relative ml-2">
            <button
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
            >
              🌐{" "}
              {languages.find((l) => l.code === i18n.language)?.label || "JP"}
            </button>

            {langMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setLangMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        changeLanguage(lang.code);
                        setLangMenuOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors
                        ${i18n.language === lang.code ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}
                      `}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={toggle}
            className="ml-1 p-2 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
          >
            {theme === "dark" ? "🌙" : "☀️"}
          </button>
        </div>

        {/* モバイル版（縦書き） */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={toggle}
            className="p-2 text-xl bg-slate-100 dark:bg-slate-800 rounded-lg"
          >
            {theme === "dark" ? "🌙" : "☀️"}
          </button>
          <button
            className="text-2xl p-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg"
            onClick={() => setOpen(!open)}
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </nav>

      {/* モバイルメニュ */}
      {open && (
        <div className="absolute top-full left-0 w-full bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-4 space-y-4 shadow-2xl animate-in slide-in-from-top duration-200 z-[60] max-h-[90vh] overflow-y-auto">
          {user && user.emailVerified ? (
            <div className="space-y-2">
              <NavLink
                to="/"
                className={mobileLinkStyle}
                onClick={() => setOpen(false)}
              >
                {t("navigation.home")}
              </NavLink>
              <NavLink
                to="/todo"
                className={mobileLinkStyle}
                onClick={() => setOpen(false)}
              >
                {t("navigation.todo")}
              </NavLink>
              <NavLink
                to="/calendar"
                className={mobileLinkStyle}
                onClick={() => setOpen(false)}
              >
                {t("navigation.calendar")}
              </NavLink>
              <NavLink
                to="/weather"
                className={mobileLinkStyle}
                onClick={() => setOpen(false)}
              >
                {t("navigation.weather")}
              </NavLink>
              <NavLink
                to="/settings"
                className={mobileLinkStyle}
                onClick={() => setOpen(false)}
              >
                {t("navigation.settings")}
              </NavLink>
            </div>
          ) : (
            <NavLink
              to="/auth"
              className={mobileLinkStyle}
              onClick={() => setOpen(false)}
            >
              {t("navigation.login")}
            </NavLink>
          )}

          {/* Mobile Language Switcher (Inline Row) */}
          <div className="py-4 border-t border-b border-slate-100 dark:border-slate-800/50">
            <p className="text-xs font-black text-slate-400 text-center mb-3 uppercase tracking-widest">
              Language
            </p>
            <div className="flex justify-center gap-2">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code)}
                  className={`px-6 py-2 rounded-lg text-sm font-black transition-all
                     ${
                       i18n.language === lang.code
                         ? "bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none"
                         : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                     }
                   `}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {user && (
            <button
              onClick={async (e) => {
                e.preventDefault();
                setOpen(false);
                await signOut(auth);
                navigate("/auth");
              }}
              className="w-full text-center px-4 py-4 text-red-500 font-bold bg-slate-50 dark:bg-slate-900/50 rounded-xl"
            >
              {t("navigation.logout")}
            </button>
          )}
        </div>
      )}
    </header>
  );
}

export default Header;
