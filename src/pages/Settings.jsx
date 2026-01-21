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
} from "firebase/firestore";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase/config";
import Spinner from "../components/Spinner";
import toast from "react-hot-toast";
import AvatarGenerator from "../components/AvatarGenerator";

export default function Settings({ user }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [msg, setMsg] = useState("");

  const defaultAvatar = "/pictures/default.png";
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [quote, setQuote] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(""); 
  const [draftAvatarUrl, setDraftAvatarUrl] = useState(""); 
  const [showNewAvatar, setShowNewAvatar] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      if (!user) return;
      try {
        const refDoc = doc(db, "users", user.uid);
        const snap = await getDoc(refDoc);
        if (snap.exists()) {
          const data = snap.data();
          const saved = data.avatar || "";
          setDisplayName(data.displayName || "");
          setQuote(data.favoriteQuote || "");
          setAvatarUrl(saved);
          setDraftAvatarUrl(saved);
        }
      } catch (err) {
        console.error("データ取得エラー:", err);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [user]);

  const hasChanged =
    displayName !== (user.displayName || "") ||
    quote !== (user.favoriteQuote || "") ||
    showNewAvatar === true;

  if (!user && loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="text-blue-600 dark:text-blue-400">
          {" "}
          <Spinner size={10} />
          <p className="text-slate-500 dark:text-slate-400 animate-pulse font-bold">
            読み込み中...
          </p>
        </div>
      </div>
    );
  }

  const handleSave = async (e) => {
    e.preventDefault();
    if (!hasChanged || saving) return;

    setSaving(true);
    try {
      // 保存するアバターURLを決定（新しいもの or 既存のもの）
      const finalAvatar = showNewAvatar ? draftAvatarUrl : avatarUrl;

      const userRef = doc(db, "users", user.uid);

      await updateDoc(userRef, {
        displayName: displayName || "",
        favoriteQuote: quote || "",
        avatar: finalAvatar || "",
      });

      setAvatarUrl(finalAvatar);
      setShowNewAvatar(false);
      setIsEditing(false);
      toast.success("プロフィールを更新しました！🎉");
    } catch (err) {
      alert("Firebase Error: " + err.message);
      toast.error("保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDisplayName(user.displayName || "");
    setQuote(user.favoriteQuote || "");
    setDraftAvatarUrl("");
    setShowNewAvatar(false);
    setIsEditing(false);
  };

  const handlePasswordChange = async (e) => {
    if (e) e.preventDefault();

    if (!currentPassword || !newPassword)
      return toast.error("パスワードを入力してください");

    setSaving(true); // 二重送信防止
    setMsg(""); // 以前のエラーメッセージをクリア

    try {
      const cred = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPassword);

      toast.success("パスワードを更新しました");
      setNewPassword("");
      setCurrentPassword("");
    } catch (err) {
      if (
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        setMsg("現在のパスワードが正しくありません。");
      } else if (err.code === "auth/weak-password") {
        setMsg("新しいパスワードが短すぎます(6文字以上必要です)。");
      } else {
        setMsg("更新に失敗しました。もう一度お試しください。");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
   setSaving(true); 
  setDeleteError("");
    try {
      const currentUser = auth.currentUser;
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        deletePassword,
      );
      await reauthenticateWithCredential(currentUser, credential);
      const batch = writeBatch(db);
      const tasksQuery = query(
        collection(db, "tasks"),
        where("userId", "==", currentUser.uid),
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      tasksSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      // 先に Firestore 上のユーザーデータを削除
      batch.delete(doc(db, "users", currentUser.uid));

      // Firestore の削除処理をまとめて確定
      await batch.commit();

      // Firebase Authentication 上のユーザーを削除
      await deleteUser(currentUser);

      toast.success("アカウントを削除しました。");
      navigate("/auth");
    } catch (err) {
      console.error(err);
      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/wrong-password"
      ) {
        setDeleteError("パスワードが正しくありません。");
      } else {
        setDeleteError("エラーが発生しました。もう一度お試しください。");
      }
    } finally {
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
            🪪 プロフィール設定
          </h1>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 左カラム */}
          <div className="order-2 md:order-1 md:col-span-1 space-y-16">
            <div className={sectionClass}>
              <label className={labelClass}>セキュリティ</label>
              <div className="space-y-4">
                <input
                  type="password"
                  placeholder="現在のパスワード"
                  className={inputClass}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <input
                  type="password"
                  placeholder="新しいパスワード"
                  className={inputClass}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  onClick={handlePasswordChange}
                  className="w-full py-2 text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl hover:bg-slate-200"
                >
                  更新
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
              <label className={labelClass}>プロフィール情報</label>
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
                      お名前
                    </span>
                    {isEditing ? (
                      <input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className={inputClass}
                      />
                    ) : (
                      <p className="text-lg font-bold dark:text-white p-2">
                        {displayName || "未設定"}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400 font-bold uppercase mb-1">
                      メール
                    </span>
                    <p className="text-slate-400 p-2 text-sm">{user.email}</p>
                  </div>
                </div>

                <div className="flex flex-col">
                  <span className="text-xs text-slate-400 font-bold uppercase mb-1">
                    お気に入りの名言
                  </span>
                  {isEditing ? (
                    <textarea
                      value={quote}
                      onChange={(e) => setQuote(e.target.value)}
                      rows="3"
                      className={inputClass}
                    />
                  ) : (
                    <p className="text-slate-600 dark:text-slate-400 italic p-2">
                      {quote || "名言が登録されていません。"}
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
                      キャンセル
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
                      {saving ? "保存中..." : "保存する"}
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
                危険ゾーン
              </label>
              <p className="text-xs text-red-600/70 dark:text-red-400/70">
                アカウントを削除するとデータは戻りません。
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700"
            >
              削除する
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
                  本当に削除しますか？
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2">
                  この操作は取り消せません。継続するにはパスワードを入力してください。
                </p>
              </div>
              <input
                type="password"
                className={`${inputClass} mt-6 ${deleteError ? "border-red-500" : ""}`}
                placeholder="現在のパスワードを入力"
                value={deletePassword}
                onChange={(e) => {
                  setDeletePassword(e.target.value);
                  if (deleteError) setDeleteError(""); // 入力開始時にエラーメッセージをクリア
                }}
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
                      : "bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-200"
                  }`}
                >
                  {saving ? "削除中..." : "アカウントを完全に削除"}
                </button>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setDeletePassword("");
                    setDeleteError("");
                  }}
                  className="w-full py-4 text-slate-100 dark:text-slate-400 rounded-xl font-bold hover:text-slate-200 dark:hover:text-white transition-colors"
                >
                  キャンセル
                </button>
              </div>
              {msg && (
                <p className="mt-4 text-red-500 text-center font-bold text-sm">
                  {msg}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
