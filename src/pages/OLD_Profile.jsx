import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../firebase/config";
//import { db, storage } from "../firebase/config"; >>> ストレージについては Blaze プランを利用していませんので、学習のために参考
//import { ref, uploadBytes, getDownloadURL } from "firebase/storage"; >>> ストレージについては Blaze プランを利用していませんので、学習のために参考
import { doc, getDoc, updateDoc } from "firebase/firestore";
import Spinner from "../components/Spinner";
import toast from "react-hot-toast";
import AvatarGenerator from "../components/AvatarGenerator";

export default function Profile() {
  const { user } = useAuth();

  const defaultAvatar = "/pictures/default.png";
  const [displayName, setName] = useState("");
  const [quote, setQuote] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(""); // saved one
  const [draftAvatarUrl, setDraftAvatarUrl] = useState(""); // new unsaved
  const [showNewAvatar, setShowNewAvatar] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  //const [file, setFile] = useState(null);  >>> ストレージについては Blaze プランを利用していませんので、学習のために参考

  // Firestoreからユーザーのデータ取得
  useEffect(() => {
    const loadUser = async () => {
      if (!user) return;
      const refDoc = doc(db, "users", user.uid);
      const snap = await getDoc(refDoc);
      if (snap.exists()) {
        const data = snap.data();
        const saved = data.avatar || "";
        setName(data.displayName || "");
        setQuote(data.favoriteQuote || "");
        setAvatarUrl(saved);
        setDraftAvatarUrl(saved);
      }

      setLoading(false);
    };
    loadUser();
  }, [user]);

  /*  >>> ストレージについては Blaze プランを利用していませんので、学習のために参考
 const handleUpload = async () => {
    if (!file) return null;

    const storageRef = ref(storage, `avatars/${user.uid}.jpg`);
    await uploadBytes(storageRef, file);

    const url = await getDownloadURL(storageRef);
    return url;
  };
    const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      let finalAvatarUrl = avatarUrl;

      // if a new file is selected → upload and get URL
      if (file) {
        finalAvatarUrl = await handleUpload();
      }

      await updateDoc(doc(db, "users", user.uid), {
        displayName,
        favoriteQuote: quote,
        avatar: finalAvatarUrl,
      });

      setAvatarUrl(finalAvatarUrl);
      toast.success("プロフィールを更新しました。");
    } catch (err) {
      console.log(err);
      toast.error("プロフィールの保存中にエラーが発生しました。");
    } finally {
      setSaving(false);
    }
  };
  */

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await updateDoc(doc(db, "users", user.uid), {
        displayName,
        favoriteQuote: quote,
        avatar: draftAvatarUrl,
      });

      setAvatarUrl(draftAvatarUrl); //成功後、現在のアバターを更新
      setShowNewAvatar(false);

      toast.success("プロフィールを更新しました！🎉");
    } catch (err) {
      console.log("エラー発生： " + err);
      toast.error("プロフィールの保存中にエラーが発生しました。");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
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

  return (
    <div className="flex flex-col min-h-screen overflow-x-hidden">
      <header className="p-4 text-center text-black-700 font-bold text-3xl">
        🪪 プロフィール設定
      </header>
      <main className="flex-1 flex justify-center items-start">
        <div className="max-w-2xl w-full mx-auto mt-6 p-4">
          <form className="flex flex-col gap-5" onSubmit={handleSave}>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold text-gray-500">
                メールアドレス（変更不可）
              </label>
              <input
                value={user.email}
                readOnly
                className="border rounded-lg p-3 bg-gray-100 dark:bg-gray-900 text-gray-400 cursor-not-allowed text-sm"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold text-gray-700">お名前</label>
              <input
                value={displayName}
                placeholder="名前を入力してください"
                className="border rounded-lg p-3 bg-white focus:ring-2 focus:ring-blue-400 outline-none transition-all"
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold text-gray-700">
                お気に入りの名言
              </label>
              <textarea
                value={quote}
                rows="3"
                placeholder="心に残っている言葉はありますか？"
                className="border rounded-lg p-3 bg-white focus:ring-2 focus:ring-blue-400 outline-none transition-all"
                onChange={(e) => setQuote(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-3 py-2">
              <label className="text-sm font-bold text-gray-700">
                現在のアバター
              </label>
              <div className="flex items-center gap-4">
                <img
                  src={avatarUrl || defaultAvatar}
                  alt="現在のアバター"
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border shadow-sm object-cover"
                />
                <div className="flex-grow">
                  <AvatarGenerator
                    onSelect={(url) => {
                      setDraftAvatarUrl(url);
                      setShowNewAvatar(true);
                    }}
                  />
                  <p className="text-[10px] text-gray-400 mt-2">
                    ※ 新しいアイコンを生成するにはボタンを押してください
                  </p>
                </div>
              </div>
            </div>

            {showNewAvatar && (
              <div className="flex flex-col gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100 animate-in fade-in zoom-in duration-300">
                <label className="text-sm font-bold text-blue-600">
                  新しいアバター（未保存）
                </label>
                <img
                  src={draftAvatarUrl || defaultAvatar}
                  alt="新しいアバター（下書き）"
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white shadow-md object-cover"
                />
              </div>
            )}

            <button
              disabled={saving}
              className={`mt-4 py-3 rounded-xl font-bold text-white transition-all shadow-md active:scale-95 ${
                saving
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 shadow-blue-100"
              }`}
            >
              {saving ? "保存中..." : "保存する"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

/* >>>ストレージについては Blaze プランを利用していませんので、学習のために参考

  <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files[0])}
        />
  */

/* old avatar mechanics
  <div className="flex flex-col items-center gap-4 border-2 border-dashed border-gray-200 p-4 rounded-lg">
          <label className="text-sm text-gray-600 font-bold">
          アバターのプレビュー
        </label>
<img
            src={avatarUrl || defaultAvatar}
            alt="avatar"
            className="w-24 h-24 rounded-full border-4 border-blue-100 object-cover shadow-md"
            onError={(e) => {
              e.target.src = defaultAvatar;
            }} 
          />
         <div className="w-full">
            <label className="text-xs text-gray-500">
              Paste an Image URL (from Unsplash, etc.)
            </label>
            <input
              type="text"
              placeholder="https://images.unsplash.com/photo-..."
              value={avatarUrl}
              className="border rounded p-2 bg-white w-full mt-1 text-sm"
              onChange={(e) => setAvatarUrl(e.target.value)}
            /> 
          </div>
          </div> */
