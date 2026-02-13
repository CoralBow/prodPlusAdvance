import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center min-h-[80vh] bg-white dark:bg-slate-950 p-5">
      <div className="bg-white dark:bg-slate-900 shadow-xl rounded-2xl p-8 max-w-md w-full text-center border border-slate-100 dark:border-slate-800 scale-95 sm:scale-100">
        <div className="text-6xl font-black text-blue-600 dark:text-blue-500 mb-4">
          404
        </div>

        <h1 className="text-2xl font-black mb-4 text-slate-800 dark:text-white">
          {t("not_found.title")}
        </h1>

        <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
          {t("not_found.description")}
        </p>

        <Link
          to="/"
          className="inline-block w-full py-4 bg-blue-600 text-white rounded-xl font-black transition-all hover:bg-blue-700 shadow-lg active:scale-95 text-center cursor-pointer"
        >
          {t("not_found.go_home")}
        </Link>
      </div>
    </div>
  );
}

export default NotFound;
