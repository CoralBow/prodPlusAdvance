import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

function Footer() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  if (!user) return null;

  const defaultAvatar = "/pictures/default.png";

  return (
    <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/80 py-6">
      <div className="max-w-screen-lg mx-auto px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => (user && user.emailVerified ? navigate(`/settings`) : "")}
          >
            <div className="relative">
              <img
                src={profile?.avatar || defaultAvatar}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-slate-100 dark:ring-slate-800"
                alt="avatar"
              />
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-slate-900 rounded-full"></div>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {t('footer.signed_in_as')}
              </p>
              <p className="text-sm font-black text-slate-800 dark:text-slate-200">
                {profile?.displayName || t('footer.member')}
              </p>
            </div>
          </div>

          <div className="text-sm text-slate-500 dark:text-slate-400 italic">
            {t('footer.awesome_day')} <span className="not-italic">🚀</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
export default Footer;
