import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { addDays } from "date-fns";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useTaskActions } from "../hooks/useTaskActions";
import TaskItem from "../components/TaskItem";

function Todo({ tasks, user }) {
  const location = useLocation();
  const { t, i18n } = useTranslation("common");
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
  const [highlightTaskId, setHighlightTaskId] = useState(null);
  const [localDoneState, setLocalDoneState] = useState({});
  const [deleteModal, setDeleteModal] = useState({
    open: false,
    target: null,
    deleteAll: false,
  });

  const { toggleDone, performDelete, saveTaskEdit } = useTaskActions(
    tasks,
    setDeleteModal,
  );
  const [isFormOpen, setIsFormOpen] = useState(false);
  const navigate = useNavigate();

  // --- URLパラメータによる日付プリセット処理 ---
  const params = new URLSearchParams(location.search);
  const presetDate = params.get("date");
  useEffect(() => {
    if (presetDate) {
      setDueDate(presetDate);
      setIsFormOpen(true);

      const newParams = new URLSearchParams(location.search);
      newParams.delete("date");
      const newSearch = newParams.toString();
      navigate({ search: newSearch ? `?${newSearch}` : "" }, { replace: true });
    }
  }, [presetDate, navigate, location.search]);

  // --- ヘルパー ---
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const isTitleValid = title.trim().length > 0;

  const formatDate = useCallback(
    (dateStr) => {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat(i18n.language, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(d);
    },
    [i18n.language],
  );

  // --- 1. 自動スクロール（編集対象へジャンプ ---
  useEffect(() => {
    const editId = location.state?.editId;
    if (!editId || hasHandledJump.current || tasks.length === 0) return;

    const task = tasks.find((task) => task.id === editId);
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

  useEffect(() => {
    if (!highlightTaskId) return;

    // タスク完了の時一瞬止めてから並び替えする
    const timer = setTimeout(() => {
      const el = taskRefs.current[highlightTaskId];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add(
          "ring-4",
          "ring-blue-500",
          "ring-offset-4",
          "ring-offset-white",
          "dark:ring-offset-slate-950",
          "transition-all",
          "duration-500",
        );

        setTimeout(() => {
          el.classList.remove(
            "ring-4",
            "ring-blue-500",
            "ring-offset-4",
            "ring-offset-white",
            "dark:ring-offset-slate-950",
            "transition-all",
            "duration-500",
          );
          setHighlightTaskId(null);
        }, 2500);
      }
    }, 100); // DOMが反応するために短い遅延

    return () => clearTimeout(timer);
  }, [tasks, highlightTaskId]);

  // --- 2. UI状態の整理（不要データのクリーンアップ） ---
  useEffect(() => {
    setUiState((prev) => {
      const validIds = new Set();

      // 一般タスクidsをキープ
      tasks.forEach((t) => validIds.add(t.id));

      // 繰り返しタスクの際parentIdsをキープ
      tasks.forEach((t) => {
        if (t.parentId) validIds.add(t.parentId);
      });

      const cleanState = {};
      Object.keys(prev).forEach((key) => {
        if (validIds.has(key)) cleanState[key] = prev[key];
      });

      return cleanState;
    });
  }, [tasks]);

  // --- 3. データ加工処理 ---

  const { mainTasks, childrenMap } = useMemo(() => {
    const children = {};
    const main = [];

    const parentIds = new Set(
      tasks.filter((task) => !task.parentId).map((task) => task.id),
    );

    // parentIdの後ろに子タスクをグルーピングする
    tasks.forEach((task) => {
      if (task.parentId) {
        if (!children[task.parentId]) children[task.parentId] = [];
        children[task.parentId].push(task);
      }
    });

    // タスクリスト作成
    tasks.forEach((task) => {
      const isOrphan = task.parentId && !parentIds.has(task.parentId);
      const subTasks = children[task.id] || [];

      const isParent = !!children[task.id];
      const isChild = !!task.parentId;
      const isPartOfSeries = task.isRepeating || isParent || isChild || task.isGhost;

      // フィルター
      if (hideDone) {
    const allItemsDone = [task, ...subTasks].every((t) => t.done);
    if ((isParent || task.isGhost) && allItemsDone) return;
    if (!isParent && !isChild && task.done) return;
  }
      if (hideRepeating && isPartOfSeries) return;
  if (showRepeating && !isPartOfSeries) return;
        if (showNoDate && task.dueDate) return;

      if (!task.parentId) {

        main.push(task);
      } else if (isOrphan) {
        //親が削除された子タスクの処理
        const alreadyAdded = main.find(
          (m) => m.id === task.parentId && m.isGhost,
        );

        if (!alreadyAdded) {
          main.push({
            id: task.parentId,
            title: t("todo.orphaned_series"),
            isRepeating: true,
            isGhost: true,
            dueDate: task.dueDate,
            done: false, 
          });
        }
      }
    });

    // 親タスクの並び替え
    main.sort((a, b) => {
      const isUnitDone = (t) => {
        const subs = children[t.id] || [];
        const combined = t.isGhost ? subs : [t, ...subs];
        return combined.every((item) => item.done);
      };
      const aDone = isUnitDone(a);
      const bDone = isUnitDone(b);
      if (aDone !== bDone) return aDone ? 1 : -1;

      const dateA = a.dueDate || "9999-12-31";
      const dateB = b.dueDate || "9999-12-31";
      return sort === "date"
        ? dateA.localeCompare(dateB)
        : a.title.localeCompare(b.title, i18n.language);
    });

    const sortedChildrenMap = {};
    main.forEach((parent) => {
      const subs = children[parent.id] || [];
      const combined = parent.isGhost ? [...subs] : [parent, ...subs];

      combined.sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1; // Done sinks to bottom
        return (a.dueDate || "").localeCompare(b.dueDate || "");
      });
      sortedChildrenMap[parent.id] = combined;
    });

    return { mainTasks: main, childrenMap: sortedChildrenMap };
  }, [
    tasks,
    hideDone,
    hideRepeating,
    showRepeating,
    showNoDate,
    sort,
    i18n.language,
    t,
  ]);

  const handleDelayedToggle = useCallback(
    (id, currentDoneStatus) => {
      const newStatus = !currentDoneStatus;
      setLocalDoneState((prev) => ({
        ...prev,
        [id]: newStatus,
      }));
      setTimeout(async () => {
        await toggleDone(id, currentDoneStatus);
        setLocalDoneState((prev) => {
          const newState = { ...prev };
          delete newState[id];
          return newState;
        });
      }, 600);
    },
    [toggleDone],
  );

  const handleAddTask = async () => {
    if (!title.trim()) return;
    if (repeat && !dueDate) return setError(t("todo.error_repeating_date"));

    try {
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
      setIsFormOpen(false);
      setHighlightTaskId(baseRef.id);
    } catch (err) {
      setError(err.message);
    }
  };

  const startEdit = (task) => {
    setEditingTask(task.id);
    setEditState({
      title: task.title,
      description: task.description || "",
      dueDate: task.dueDate || "",
    });
  };

  const handleSaveEdit = async (id, state, mode = "single") => {
    try {
      await saveTaskEdit(
        id,
        state.title,
        state.description,
        state.dueDate,
        mode,
      );
      setEditingTask(null);
    } catch (e) {
      if (import.meta.env.MODE === "development") {
        console.error(e);
      }
    }
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
          📋 {t("todo.title")}
        </h1>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto p-4 space-y-8">
        {/* タスク作成セクション */}
        {!isFormOpen ? (
          <div className="flex justify-center">
            <button
              onClick={() => setIsFormOpen(true)}
              className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black shadow-lg hover:bg-blue-700 transition-all active:scale-95"
            >
              + {t("todo.add_button")}
            </button>
          </div>
        ) : (
          <section className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              {/*バランスのために空のdivを追加*/}
              <div className="w-6" aria-hidden="true" />{" "}
              <h4 className="text-m font-black uppercase text-blue-600 text-center">
                {t("todo.create_section")}
              </h4>
              <button
                className="w-6 text-xl font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-transparent transition-colors"
                onClick={() => setIsFormOpen(false)}
              >
                ✖
              </button>
            </div>
            <div className="space-y-4">
              <input
                type="text"
                placeholder={t("todo.placeholder_title")}
                value={title}
                maxLength={200}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (error) setError("");
                }}
                className={`w-full p-3 rounded-2xl font-bold dark:text-white
    bg-slate-50 dark:bg-slate-800
    ${
      !isTitleValid
        ? "ring-2 ring-red-500 bg-red-50 dark:bg-red-900/20"
        : "focus:ring-2 focus:ring-blue-500"
    }
  `}
              />
              <textarea
                placeholder={t("todo.placeholder_desc")}
                value={description}
                maxLength={1000}
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
                    {t("todo.repeat_label")}
                  </span>
                </label>
              </div>
              {error && (
                <p className="text-red-500 text-xs font-bold">{error}</p>
              )}
              <button
                onClick={handleAddTask}
                disabled={!isTitleValid}
                className={`w-full py-3 rounded-2xl font-black shadow-lg transition-all
    ${
      isTitleValid
        ? "bg-blue-600 text-white active:scale-95"
        : "bg-slate-300 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
    }
  `}
              >
                {t("todo.add_button")}
              </button>
            </div>
          </section>
        )}

        {/* フィルターセクション */}
        <section className="flex flex-wrap items-center justify-between gap-4 px-2">
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-1 text-[12px] font-black text-slate-500">
              <input
                type="checkbox"
                checked={showRepeating}
                className="w-4 h-4"
                onChange={(e) => {
                  setShowRepeating(e.target.checked);
                  if (e.target.checked) setHideRepeating(false);
                }}
              />{" "}
              {t("todo.filter_only_repeating")}
            </label>
            <label className="flex items-center gap-1 text-[12px] font-black text-slate-500">
              <input
                type="checkbox"
                checked={hideRepeating}
                className="w-4 h-4"
                onChange={(e) => {
                  setHideRepeating(e.target.checked);
                  if (e.target.checked) setShowRepeating(false);
                }}
              />{" "}
              {t("todo.filter_hide_repeating")}
            </label>
            <label className="flex items-center gap-1 text-[12px] font-black text-slate-500">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={showNoDate}
                onChange={(e) => setShowNoDate(e.target.checked)}
              />{" "}
              {t("todo.filter_no_date")}
            </label>
            <label className="flex items-center gap-1 text-[12px] font-black text-slate-500">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={hideDone}
                onChange={(e) => setHideDone(e.target.checked)}
              />{" "}
              {t("todo.filter_hide_done")}
            </label>
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="text-xs font-black text-blue-600 bg-transparent outline-none"
          >
            <option value="date">{t("todo.sort_date")}</option>
            <option value="title">{t("todo.sort_name")}</option>
          </select>
        </section>

        {/* タスクリスト */}
        <div className="space-y-4">
          {mainTasks.map((task) => {
            const isSeries =
              (task.isRepeating || task.isGhost) && !task.parentId;
            const isExpanded = uiState[task.id]?.showChild;
            const combinedList = childrenMap[task.id] || [task];

            // 達成バー
            const totalCount = combinedList.length;
            const completedCount = combinedList.filter((t) => t.done).length;
            const progressPercent =
              totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

            // 親無しの子タスクのタイトル表示
            const displayTitle = task.isGhost
              ? combinedList[0]?.title || t("todo.orphaned_series")
              : task.title;
            const lastTask = [...combinedList]
              .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))
              .pop();
            const dateRangeDisplay =
              isSeries && lastTask
                ? `${formatDate(combinedList[0].dueDate)} - ${formatDate(lastTask.dueDate)}`
                : formatDate(task.dueDate);

            return (
              <div
                ref={(el) => (taskRefs.current[task.id] = el)}
                key={task.id}
                className={`overflow-hidden rounded-[32px] transition-all duration-300 ${isSeries ? "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm mb-6" : "bg-transparent mb-2"}`}
              >
                {isSeries && (
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🔄</span>
                        <div className="text-left">
                          <h3 className="font-black text-slate-800 dark:text-white leading-tight py-3">
                            {displayTitle}
                          </h3>
                          <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 block">
                            {dateRangeDisplay}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleChildren(task.id)}
                        className="px-4 py-2 text-[11px] font-black text-blue-600 bg-blue-100 dark:bg-blue-400/10 rounded-2xl hover:scale-105 transition-transform"
                      >
                        {isExpanded
                          ? t("todo.repeating_hide")
                          : t("todo.repeating_show", { count: totalCount })}
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-600 h-full transition-all duration-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-black text-slate-400 tabular-nums">
                        {completedCount} / {totalCount}
                      </span>
                    </div>
                  </div>
                )}

                <div className={isSeries && !isExpanded ? "hidden" : "block"}>
                  {combinedList.map((item) => {

                    const isLocallyOverridden = Object.hasOwn(
                      localDoneState,
                      item.id,
                    );

                    const effectiveDone = isLocallyOverridden
                      ? localDoneState[item.id]
                      : item.done;

                    const displayItem = { ...item, done: effectiveDone };
                    return (
                      <TaskItem
                        key={item.id}
                        item={displayItem}
                        isChild={isSeries}
                        isEditing={editingTask === item.id}
                        editState={editState}
                        setEditState={setEditState}
                        uiState={uiState[item.id]}
                        today={today}
                        onToggleDone={handleDelayedToggle}
                        onStartEdit={startEdit}
                        onSaveEdit={handleSaveEdit}
                        onCancelEdit={() => setEditingTask(null)}
                        onDelete={(id) =>
                          setDeleteModal({
                            open: true,
                            target: id,
                            deleteAll: false,
                            isRepeating: true,
                            taskId: id,
                            parentId: item.parentId,
                          })
                        }
                        onToggleDesc={toggleDescription}
                        formatDate={formatDate}
                        taskRef={(el) => (taskRefs.current[item.id] = el)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/*  削除確認モーダル */}
      {deleteModal.open && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[9998] p-4">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] max-w-sm w-full text-center">
            <h2 className="text-xl font-black mb-2 dark:text-white">
              {t("todo.delete_modal_title")}
            </h2>
            {deleteModal.isRepeating && (
              <div className="flex flex-col gap-2 mb-6 text-left bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={
                      !deleteModal.deleteMode ||
                      deleteModal.deleteMode === "single"
                    }
                    onChange={() =>
                      setDeleteModal((p) => ({
                        ...p,
                        deleteMode: "single",
                        deleteAll: false,
                      }))
                    }
                  />
                  <span className="text-xs font-bold dark:text-slate-300">
                    {t("todo.apply_single")}
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={deleteModal.deleteMode === "all"}
                    onChange={() =>
                      setDeleteModal((p) => ({
                        ...p,
                        deleteMode: "all",
                        deleteAll: true,
                      }))
                    }
                  />
                  <span className="text-xs font-bold dark:text-slate-300">
                    {t("todo.apply_all")}
                  </span>
                </label>
              </div>
            )}
            <div className="flex gap-3">
              <button
                className="flex-1 py-3 bg-slate-100 rounded-2xl font-black"
                onClick={() =>
                  setDeleteModal((p) => ({
                    ...p,
                    open: false,
                  }))
                }
              >
                {t("todo.cancel")}
              </button>
              <button
                className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-black"
                onClick={() => performDelete(deleteModal)}
              >
                {t("todo.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Todo;
