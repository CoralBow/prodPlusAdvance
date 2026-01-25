import {
  updatePassword,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import {
  doc,
  writeBatch,
  query,
  collection,
  where,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db, auth } from "../firebase/config";
import Spinner from "../components/Spinner";
import toast from "react-hot-toast";
import AvatarGenerator from "../components/AvatarGenerator";
import PasswordInput from "../components/PasswordInput";
import { clearUserLocalCache } from "../utils/clearUserLocalCache";

export default function Settings({ user }) {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");

  const defaultAvatar = "/pictures/default.png";
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [quote, setQuote] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [draftAvatarUrl, setDraftAvatarUrl] = useState("");
  const [showNewAvatar, setShowNewAvatar] = useState(false);
  const [originalProfile, setOriginalProfile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const navigate = useNavigate();
  const MAX_DISPLAY_NAME_LENGTH = 50;
  const MAX_QUOTE_LENGTH = 500;

  useEffect(() => {
    const loadUser = async () => {
      if (!user) return;
      try {
        const refDoc = doc(db, "users", user.uid);
        const snap = await getDoc(refDoc);
        if (snap.exists()) {
          const data = snap.data();
          const saved = data.avatar || "";
          setOriginalProfile({
            displayName: data.displayName || "",
            quote: data.favoriteQuote || "",
            avatar: saved,
          });

          setDisplayName(data.displayName || "");
          setQuote(data.favoriteQuote || "");
          setAvatarUrl(saved);
          setDraftAvatarUrl(saved);
        }
      } catch (e) {
        if (import.meta.env.MODE === "development") {
          console.error(e);
        }
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [user]);

  const hasChanged =
    !!originalProfile &&
    (displayName !== originalProfile.displayName ||
      quote !== originalProfile.quote ||
      showNewAvatar);

  if (!user || loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="text-blue-600 dark:text-blue-400">
          {" "}
          <Spinner size={8} />
          <p className="text-slate-500 dark:text-slate-400 animate-pulse font-bold">
            {t("settings.loading")}
          </p>
        </div>
      </div>
    );
  }

  const handleSave = async (e) => {
    e.preventDefault();
    if (!hasChanged || saving) return;
    if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
      return toast.error(t("settings.error_name_too_long"));
    }
    if (quote.length > MAX_QUOTE_LENGTH) {
      return toast.error(t("settings.error_quote_too_long"));
    }
    setSaving(true);
    try {
      // 保存するアバターURLを決定（新しいもの or 既存のもの）
      const finalAvatar = showNewAvatar ? draftAvatarUrl : avatarUrl;

      const userRef = doc(db, "users", user.uid);

      await updateDoc(userRef, {
        displayName: displayName,
        favoriteQuote: quote,
        avatar: finalAvatar,
      });

      setAvatarUrl(finalAvatar);
      // Fix: Update originalProfile after successful save so cancel works correctly
      setOriginalProfile({
        displayName: displayName,
        quote: quote,
        avatar: finalAvatar,
      });
      setShowNewAvatar(false);
      setIsEditing(false);
      toast.success(t("settings.success_updated"));
    } catch (err) {
      if (import.meta.env.MODE === "development") {
          console.error(err);
        }
      toast.error(t("settings.error_save"));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!originalProfile) return;

    setDisplayName(originalProfile.displayName);
    setQuote(originalProfile.quote);
    setDraftAvatarUrl(originalProfile.avatar);
    setShowNewAvatar(false);
    setIsEditing(false);
  };

  const handlePasswordChange = async (e) => {
    if (e) e.preventDefault();
    setPasswordMsg("");

    if (!currentPassword || !newPassword)
      return toast.error(t("settings.error_password_empty"));

    setSaving(true); // 二重送信防止
    setPasswordMsg(""); // 以前のエラーメッセージをクリア

    try {
      const currentUser = auth.currentUser;
      if (!currentUser.email)
        throw new Error(t("settings.error_update_failed"));
      const cred = EmailAuthProvider.credential(
        currentUser.email,
        currentPassword,
      );
      await reauthenticateWithCredential(currentUser, cred);
      await updatePassword(currentUser, newPassword);

      toast.success(t("settings.success_password_updated"));
      setNewPassword("");
      setCurrentPassword("");
    } catch (err) {
      if (
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        setPasswordMsg(t("settings.error_wrong_password"));
      } else if (err.code === "auth/weak-password") {
        setPasswordMsg(t("settings.error_weak_password"));
      } else {
        setPasswordMsg(t("settings.error_update_failed"));
      }
    } finally {
      setSaving(false);
    }
  };

  async function deleteUserTasksInBatches(userId) {
    const q = query(collection(db, "tasks"), where("userId", "==", userId));

    const snapshot = await getDocs(q);

    const docs = snapshot.docs;
    const BATCH_LIMIT = 500;

    for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      const chunk = docs.slice(i, i + BATCH_LIMIT);

      chunk.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });

      await batch.commit();
    }
  }

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    setSaving(true);
    setDeleteError("");
    let deleted = false;

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return toast.error(t("settings.session_expired"));
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        deletePassword,
      );
      await reauthenticateWithCredential(currentUser, credential);
      await deleteUserTasksInBatches(currentUser.uid);

      // FirebaseのDB上の記録を削除
      await deleteDoc(doc(db, "users", currentUser.uid));

      // Firebase Authentication 上のユーザーを削除
      await deleteUser(currentUser);

      deleted = true;

      toast.success(t("settings.success_deleted"));
      navigate("/auth");
    } catch (err) {
      if (import.meta.env.MODE === "development") {
          console.error(err);
        }
      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/wrong-password"
      ) {
        setDeleteError(t("settings.error_delete_wrong_password"));
      } else if (err.code === "auth/requires-recent-login") {
        setDeleteError(t("settings.reauth"));
      } else {
        setDeleteError(t("settings.error_delete_failed"));
      }
    } finally {
      if (deleted) {
        clearUserLocalCache();
        navigate("/auth", { replace: true });
      }
      setSaving(false);
    }
  };

  const sectionClass =
    "p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-all";
  const labelClass =
    "block text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2";
  const inputClass =
    "w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300 pb-20">
      <div className="max-w-4xl mx-auto p-4 space-y-6 pt-8">
        <header className="text-center py-4">
          <h1 className="text-3xl font-black text-slate-800 dark:text-white">
            🪪 {t("settings.title")}
          </h1>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 左カラム */}
          <div className="order-2 md:order-1 md:col-span-1 space-y-16">
            <div className={sectionClass}>
              <label className={labelClass}>{t("settings.security")}</label>
              <div className="space-y-4">
                <PasswordInput
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder={t("settings.current_password")}
                  ariaLabel={t("settings.current_password")}
                />

                <PasswordInput
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t("settings.new_password")}
                  ariaLabel={t("settings.new_password")}
                />

                <button
                  onClick={handlePasswordChange}
                  disabled={saving}
                  className="w-full py-2 text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl hover:bg-slate-200"
                >
                  {t("settings.update")}
                </button>
              </div>
            </div>{" "}
          </div>

          {/* 右カラム */}
          <div className="order-1 md:order-2 md:col-span-2">
            <form
              onSubmit={handleSave}
              className={`${sectionClass} h-full relative`}
            >
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="  absolute top-6 right-6 p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:scale-110 transition-transform"
                >
                  ✏️
                </button>
              )}
              <label className={labelClass}>{t("settings.profile_info")}</label>
              <div className="space-y-6">
                {/* アバター画像 */}
                <div className="flex flex-col sm:flex-row gap-6 items-center">
                  <img
                    src={
                      showNewAvatar
                        ? draftAvatarUrl
                        : avatarUrl || defaultAvatar
                    }
                    className="w-24 h-24 rounded-full border-4 border-white dark:border-slate-700 dark:bg-slate-700 shadow-md object-cover"
                    alt="Avatar"
                  />
                  {isEditing && (
                    <div className="flex-1 w-full animate-in fade-in zoom-in duration-300">
                      <AvatarGenerator
                        onSelect={(url) => {
                          setDraftAvatarUrl(url);
                          setShowNewAvatar(true);
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* プロフィール情報入力欄 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400 font-bold uppercase mb-1">
                      {t("settings.name")}
                    </span>
                    {isEditing ? (
                      <input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className={inputClass}
                        maxLength={50}
                      />
                    ) : (
                      <p className="text-lg font-bold dark:text-white p-2">
                        {displayName || t("settings.not_set")}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400 font-bold uppercase mb-1">
                      {t("settings.email")}
                    </span>
                    <p className="text-slate-400 p-2 text-sm">{user.email}</p>
                  </div>
                </div>

                <div className="flex flex-col">
                  <span className="text-xs text-slate-400 font-bold uppercase mb-1">
                    {t("settings.favorite_quote")}
                  </span>
                  {isEditing ? (
                    <textarea
                      value={quote}
                      onChange={(e) => setQuote(e.target.value)}
                      rows="3"
                      className={inputClass}
                      maxLength={500}
                    />
                  ) : (
                    <p className="text-slate-600 dark:text-slate-400 italic p-2">
                      {quote || t("settings.no_quote")}
                    </p>
                  )}
                </div>

                {/* 操作ボタン */}
                {isEditing && (
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 transition-colors text-center whitespace-nowrap min-w-0"
                    >
                      {t("settings.cancel")}
                    </button>
                    <button
                      type="submit"
                      onClick={handleSave}
                      disabled={saving || !hasChanged}
                      className={`flex-1 py-3 px-4 font-black rounded-xl transition-all ${
                        !hasChanged || saving
                          ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg"
                      }`}
                    >
                      {saving ? t("settings.saving") : t("settings.save")}
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* 危険ゾーン（画面下部・全幅）*/}
        <div
          className={`${sectionClass} border-red-100 dark:border-red-900/30 bg-red-50/30 dark:bg-red-900/10`}
        >
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <label className="text-red-500 font-bold uppercase text-sm">
                {t("settings.danger_zone")}
              </label>
              <p className="text-xs text-red-600/70 dark:text-red-400/70">
                {t("settings.delete_warning")}
              </p>
            </div>
            <button
              onClick={() => {
                setDeletePassword("");
                setDeleteError("");
                setIsModalOpen(true);
              }}
              className="px-6 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700"
            >
              {t("settings.delete")}
            </button>
          </div>
        </div>

        {/* --- アカウント削除確認モーダ --- */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <div className="relative bg-white dark:bg-slate-800 w-full max-w-md p-8 rounded-3xl shadow-2xl animate-in zoom-in duration-200">
              <div className="text-center">
                <span className="text-5xl">⚠️</span>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-4">
                  {t("settings.delete_confirmation")}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2 mb-6">
                  {t("settings.delete_input_desc")}
                </p>
              </div>
              <PasswordInput
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder={t("settings.current_password")}
                ariaLabel={t("settings.current_password")}
              />

              {deleteError && (
                <p className="mt-2 text-red-500 text-sm font-bold animate-pulse">
                  ⚠️ {deleteError}
                </p>
              )}
              <div className="mt-8 space-y-3">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deletePassword.length < 6 || loading}
                  className={`w-full py-4 rounded-xl font-black transition-all ${
                    deletePassword.length < 6 || loading
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-red-600 text-white hover:bg-red-700"
                  }`}
                >
                  {saving
                    ? t("settings.deleting")
                    : t("settings.delete_account")}
                </button>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setDeletePassword("");
                    setDeleteError("");
                  }}
                  className="w-full py-4 text-slate-100 dark:text-slate-400 rounded-xl font-bold hover:text-slate-200 dark:hover:text-white transition-colors"
                >
                  {t("settings.cancel")}
                </button>
              </div>
              {passwordMsg && (
                <p className="mt-4 text-red-500 text-center font-bold text-sm">
                  {passwordMsg}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
