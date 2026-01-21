import React, { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { addDays } from "date-fns";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { useTaskActions } from "../hooks/useTaskActions";
import TaskItem from "../components/TaskItem";

function Todo({ tasks, user }) {
  const location = useLocation();
  const taskRefs = useRef({});
  const dateInputRef = useRef(null);
  const hasHandledJump = useRef(false);

  const [uiState, setUiState] = useState({});
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [repeat, setRepeat] = useState(false);
  const [error, setError] = useState("");
  const [editingTask, setEditingTask] = useState(null);
  const [editState, setEditState] = useState({
    title: "",
    description: "",
    dueDate: "",
  });
  const [sort, setSort] = useState("date");
  const [hideDone, setHideDone] = useState(false);
  const [showRepeating, setShowRepeating] = useState(false);
  const [hideRepeating, setHideRepeating] = useState(false);
  const [showNoDate, setShowNoDate] = useState(false);
  const [deleteModal, setDeleteModal] = useState({
    open: false,
    target: null,
    deleteAll: false,
  });

  const { toggleDone, performDelete, saveTaskEdit } = useTaskActions(
    tasks,
    setDeleteModal,
  );

  // --- URLパラメータによる日付プリセット処理 ---
  const params = new URLSearchParams(location.search);
  const presetDate = params.get("date");
  useEffect(() => {
    if (presetDate) setDueDate(presetDate);
  }, [presetDate]);

  // --- HELPERS ---
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const formatDateJP = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  };

  // --- 1. 自動スクロール（編集対象へジャンプ ---
  useEffect(() => {
    const editId = location.state?.editId;
    if (!editId || hasHandledJump.current || tasks.length === 0) return;

    const task = tasks.find((t) => t.id === editId);
    if (!task) return;

    // 子タスクの場合は、先に親タスクを展開する必要がある
    if (task.parentId) {
      setUiState((prev) => ({
        ...prev,
        [task.parentId]: { ...prev[task.parentId], showChild: true },
      }));
    }

    // DOM描画完了を待ってから該当タスクへスクロール
    setTimeout(() => {
      const el = taskRefs.current[editId];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        hasHandledJump.current = true;
        // リロード時に再ジャンプしないよう履歴をクリア
        window.history.replaceState({}, "");
      }
    }, 150);
  }, [location.state, tasks]);

  // --- 2. UI状態の整理（不要データのクリーンアップ） ---
  useEffect(() => {
    setUiState((prev) => {
      const currentIds = new Set(tasks.map((t) => t.id));
      const cleanState = {};
      Object.keys(prev).forEach((key) => {
        if (currentIds.has(key)) cleanState[key] = prev[key];
      });
      return cleanState;
    });
  }, [tasks.length]);

  // --- 3. データ加工処理 ---

  const { mainTasks, childrenMap } = useMemo(() => {
    const children = {};
    const main = [];
    const parentIds = new Set(
      tasks.filter((t) => !t.parentId).map((t) => t.id),
    );
    // 子タスクを親IDでグループ化し、複数filterを使わず1回で処理
    tasks.forEach((t) => {
      const isOrphan = t.parentId && !parentIds.has(t.parentId);
      if (!t.parentId || isOrphan) {
        if (hideDone && t.done) return;
        if (hideRepeating && (t.isRepeating || isOrphan)) return;
        if (showRepeating && !t.isRepeating && !isOrphan) return;
        if (showNoDate && t.dueDate) return;
        main.push(t);
      } else {
        if (!children[t.parentId]) children[t.parentId] = [];
        children[t.parentId].push(t);
      }
    });

    // 親タスクの並び替え
    main.sort((a, b) => {
      if (sort === "date") {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      return a.title.localeCompare(b.title, "ja");
    });

    // 子タスクの並び替え
    Object.keys(children).forEach((pid) => {
      children[pid].sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return (a.dueDate || "").localeCompare(b.dueDate || "");
      });
    });

    return { mainTasks: main, childrenMap: children };
  }, [tasks, hideDone, hideRepeating, showRepeating, showNoDate, sort]);

  const handleAddTask = async () => {
    if (!title.trim()) return;
    if (repeat && !dueDate)
      return setError("Repeating tasks require a start date.");

    const baseRef = await addDoc(collection(db, "tasks"), {
      userId: user.uid,
      title,
      description,
      dueDate: dueDate || null,
      done: false,
      isRepeating: repeat,
      parentId: null,
      createdAt: serverTimestamp(),
    });

    if (repeat) {
      const batch = writeBatch(db);
      const baseDate = new Date(dueDate);
      for (let i = 1; i <= 29; i++) {
        const childRef = doc(collection(db, "tasks"));
        batch.set(childRef, {
          userId: user.uid,
          title,
          description,
          dueDate: addDays(baseDate, i).toISOString().split("T")[0],
          done: false,
          isRepeating: false,
          parentId: baseRef.id,
          createdAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }
    setTitle("");
    setDescription("");
    setDueDate("");
    setRepeat(false);
  };

  const startEdit = (task) => {
    setEditingTask(task.id);
    setEditState({
      title: task.title,
      description: task.description || "",
      dueDate: task.dueDate || "",
    });
  };

  const handleSaveEdit = async () => {
    await saveTaskEdit(
      editingTask,
      editState.title,
      editState.description,
      editState.dueDate,
    );
    setEditingTask(null);
  };

  const toggleDescription = (id) => {
    setUiState((prev) => ({
      ...prev,
      [id]: { ...prev[id], showDesc: !prev[id]?.showDesc },
    }));
  };

  const toggleChildren = (id) => {
    setUiState((prev) => ({
      ...prev,
      [id]: { ...prev[id], showChild: !prev[id]?.showChild },
    }));
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      <header className="pt-12 pb-6 text-center">
        <h1 className="text-4xl font-black text-slate-800 dark:text-white">
          📋 To-Doリスト
        </h1>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto p-4 space-y-8">
        {/* タスク作成セクション */}
        <section className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h4 className="text-m font-black uppercase text-blue-600 mb-4">
            タスク作成
          </h4>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="タスク名"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 font-bold dark:text-white"
            />
            <textarea
              placeholder="内容詳細"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-sm min-h-[80px] dark:text-white"
            />
            <div className="flex gap-4 items-center">
              <div
                className="relative w-full sm:w-1/2 cursor-pointer"
                onClick={() => dateInputRef.current?.showPicker()}
              >
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg z-10 pointer-events-none">
                  {" "}
                  📅{" "}
                </span>
                <input
                  ref={dateInputRef}
                  id="dueDateInput-create"
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value);
                    if (e.target.value) setError("");
                  }}
                  className={`w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-blue-500 text-sm font-bold text-slate-800 dark:text-white appearance-none ${repeat && !dueDate ? "ring-2 ring-red-500 bg-red-50 dark:bg-red-900/20" : ""}`}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={repeat}
                  onChange={(e) => setRepeat(e.target.checked)}
                  className="w-5 h-5"
                />
                <span className="text-xs font-black dark:text-slate-400">
                  1か月間毎日繰り返す
                </span>
              </label>
            </div>
            {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
            <button
              onClick={handleAddTask}
              className="w-full py-3 rounded-2xl bg-blue-600 text-white font-black shadow-lg"
            >
              タスクを追加する
            </button>
          </div>
        </section>

        {/* フィルターセクション */}
        <section className="flex flex-wrap items-center justify-between gap-4 px-2">
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-1 text-[12px] font-black text-slate-500">
              <input
                type="checkbox"
                checked={showRepeating}
                onChange={(e) => {
                  setShowRepeating(e.target.checked);
                  if (e.target.checked) setHideRepeating(false);
                }}
              />{" "}
              繰り返しのみ
            </label>
            <label className="flex items-center gap-1 text-[12px] font-black text-slate-500">
              <input
                type="checkbox"
                checked={hideRepeating}
                onChange={(e) => {
                  setHideRepeating(e.target.checked);
                  if (e.target.checked) setShowRepeating(false);
                }}
              />{" "}
              繰り返しを隠す
            </label>
            <label className="flex items-center gap-1 text-[12px] font-black text-slate-500">
              <input
                type="checkbox"
                checked={showNoDate}
                onChange={(e) => setShowNoDate(e.target.checked)}
              />{" "}
              期限なし
            </label>
            <label className="flex items-center gap-1 text-[12px] font-black text-slate-500">
              <input
                type="checkbox"
                checked={hideDone}
                onChange={(e) => setHideDone(e.target.checked)}
              />{" "}
              完了を隠す
            </label>
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="text-xs font-black text-blue-600 bg-transparent outline-none"
          >
            <option value="date">日付順</option>
            <option value="title">名前順</option>
          </select>
        </section>

        {/* タスクリスト */}
        <ul className="space-y-4">
          {mainTasks.length === 0 ? (
            <div className="text-center py-20 text-slate-400 font-bold">
              タスクがありません 🎉
            </div>
          ) : (
            mainTasks.map((task) => (
              <React.Fragment key={task.id}>
                <TaskItem
                  item={task}
                  isEditing={editingTask === task.id}
                  editState={editState}
                  setEditState={setEditState}
                  uiState={uiState[task.id]}
                  today={today}
                  onToggleDone={toggleDone}
                  onStartEdit={startEdit}
                  onSaveEdit={handleSaveEdit}
                  onCancelEdit={() => setEditingTask(null)}
                  onDelete={(id) =>
                    setDeleteModal({
                      open: true,
                      target: id,
                      deleteAll: false,
                      isRepeating: task.isRepeating,
                    })
                  }
                  onToggleDesc={toggleDescription}
                  onToggleChildren={toggleChildren}
                  childCount={childrenMap[task.id]?.length || 0}
                  formatDateJP={formatDateJP}
                  taskRef={(el) => (taskRefs.current[task.id] = el)}
                />
                {uiState[task.id]?.showChild &&
                  childrenMap[task.id]?.map((child) => (
                    <TaskItem
                      key={child.id}
                      item={child}
                      isChild
                      isEditing={editingTask === child.id}
                      editState={editState}
                      setEditState={setEditState}
                      uiState={uiState[child.id]}
                      today={today}
                      onToggleDone={toggleDone}
                      onStartEdit={startEdit}
                      onSaveEdit={handleSaveEdit}
                      onCancelEdit={() => setEditingTask(null)}
                      onDelete={(id) =>
                        setDeleteModal({
                          open: true,
                          target: id,
                          deleteAll: false,
                        })
                      }
                      onToggleDesc={toggleDescription}
                      formatDateJP={formatDateJP}
                      taskRef={(el) => (taskRefs.current[child.id] = el)}
                    />
                  ))}
              </React.Fragment>
            ))
          )}
        </ul>
      </main>

      {/*  削除確認モーダル */}
      {deleteModal.open && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[10000] p-4">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] max-w-sm w-full text-center">
            <h2 className="text-xl font-black mb-2 dark:text-white">
              削除しますか？
            </h2>
            {deleteModal.isRepeating && (
              <label className="flex items-center justify-center gap-2 mb-6">
                <input
                  type="checkbox"
                  checked={deleteModal.deleteAll}
                  onChange={(e) =>
                    setDeleteModal((p) => ({
                      ...p,
                      deleteAll: e.target.checked,
                    }))
                  }
                />{" "}
                全繰り返しタスクも削除
              </label>
            )}
            <div className="flex gap-3">
              <button
                className="flex-1 py-3 bg-slate-100 rounded-2xl font-black"
                onClick={() => setDeleteModal({ open: false })}
              >
                キャンセル
              </button>
              <button
                className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-black"
                onClick={() => performDelete(deleteModal)}
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Todo;
