import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

import { addDays } from "date-fns";

function Todo({ tasks, setTasks }) {
  const location = useLocation();

  function openChildren(parentId) {
    setTasks((prev) =>
      prev.map((t) => (t.id === parentId ? { ...t, showChild: true } : t))
    );
  }

  function expandParents(taskId) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !task.parentId) return;

    openChildren(task.parentId); // 親タスクから子リストを開く
    expandParents(task.parentId);
  }

  const taskRefs = useRef({});
  // === 編集IDが渡されてきたら自動的に編集モードへ ===
  const hasHandledJump = useRef(false);

  useEffect(() => {
    const editId = location.state?.editId;
    if (!editId) return;

    // オートスクロール２回目を止める
    if (hasHandledJump.current) return;
    hasHandledJump.current = true;

    const task = tasks.find((t) => t.id === editId);
    if (!task) return;

    // 編集モードONにする
    setEditingIndex(editId);
    setEditTitle(task.title);
    setEditDescription(task.description || "");
    setEditDueDate(task.dueDate || "");

    // 親タスクを開く
    expandParents(editId);

    // オートスクロール実施
    setTimeout(() => {
      const el = taskRefs.current[editId];
      if (el) {
        el.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, 80);

    // ２回目の動作を止めるためにeditIdをブラウザ上の履歴から取り消す
    window.history.replaceState({}, "");
  }, [location.state, tasks.length]);

  const [title, setTitle] = useState("");
  // コンポーネントのマウント時または日付パラメータ変更時にページ上部へスクロール
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.search]);

  const [description, setDescription] = useState("");
  // 「?date=YYYY-MM-DD」が存在する場合は抽出
  const params = new URLSearchParams(location.search);
  const presetDate = params.get("date");
  const [dueDate, setDueDate] = useState(presetDate || "");
  useEffect(() => {
    if (presetDate) setDueDate(presetDate);
  }, [presetDate]);

  const [repeat, setRepeat] = useState(false);

  const [editingIndex, setEditingIndex] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");

  const today = new Date();
  const [showRepeating, setShowRepeating] = useState(false);
  const [showNoDate, setShowNoDate] = useState(false);
  const [hideDone, setHideDone] = useState(false);
  const [sort, setSort] = useState("date"); // 日付順 | タスク名順
  const [error, setError] = useState("");
  const [deleteModal, setDeleteModal] = useState({
    open: false,
    target: null, // タスクid
    deleteAll: false, // チェックボックスにチェック有無
  });

  // フィルター機能
  let displayedTasks = tasks.filter((t) => {
    if (hideDone && t.done) return false;

    const activeFilters = [];
    if (showRepeating) activeFilters.push((x) => x.isRepeating);
    if (showNoDate) activeFilters.push((x) => !x.dueDate);

    if (activeFilters.length === 0) return true;

    // インターセクション（すべてのフィルターはマッチしなければならない）
    return activeFilters.every((fn) => fn(t));
  });
  // 親タスクが外れた場合子を見せる
  const parentVisibility = new Map();
  tasks.forEach((t) => {
    if (!t.parentId) {
      parentVisibility.set(t.id, t.showChild);
    }
  });

  // 子タスクフィルタリング
  displayedTasks = displayedTasks.filter((t) => {
    if (!t.parentId) return true;
    return parentVisibility.get(t.parentId);
  });

  // ソート機能
  if (sort === "date") {
    displayedTasks = [...displayedTasks].sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
  } else if (sort === "title") {
    // 日本語化
    displayedTasks = [...displayedTasks].sort((a, b) =>
      a.title.localeCompare(b.title, "ja")
    );
  }

  // ---- タスク追加 ----
  const handleAddTask = () => {
    setError(""); // clear previous errors

    if (!title.trim()) return;
    if (repeat && !dueDate) {
      setError("繰り返しタスクには開始日が必要です。");
      return;
    }

    const baseTask = {
      id: Date.now(),
      title,
      description,
      dueDate,
      done: false,
      showDesc: false,
      isRepeating: repeat,
      parentId: null,
    };

    // 繰り返しタスクの場合
    if (repeat) {
      const baseDate = new Date(dueDate);
      const repeated = Array.from({ length: 29 }, (_, i) => ({
        id: crypto.randomUUID(),
        title,
        description,
        dueDate: addDays(baseDate, i + 1)
          .toISOString()
          .split("T")[0],
        done: false,
        showDesc: false,
        parentId: baseTask.id,
        showChild: false,
      }));

      setTasks([...tasks, baseTask, ...repeated]);
    } else {
      setTasks([...tasks, baseTask]);
    }

    setTitle("");
    setDescription("");
    setDueDate("");
    setRepeat(false);
  };

  // ---- タスク編集 ----
  function startEditTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    setEditingIndex(id);
    setEditTitle(task.title);
    setEditDescription(task.description || "");
    setEditDueDate(task.dueDate || "");
  }

  function saveEditTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const isParent = task.isRepeating && !task.parentId;

    if (isParent) {
      const applyToAll = confirm(
        "この変更を全ての繰り返しタスクに適用しますか？"
      );

      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === id || (applyToAll && t.parentId === task.id)) {
            return {
              ...t,
              title: editTitle,
              description: editDescription,
              dueDate: editDueDate,
            };
          }
          return t;
        })
      );
    } else {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                title: editTitle,
                description: editDescription,
                dueDate: editDueDate,
              }
            : t
        )
      );
    }

    setEditingIndex(null);
  }

  // ---- タスク削除① ----
  function deleteTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    setDeleteModal({
      open: true,
      target: id,
      deleteAll: false,
      isRepeating: task.isRepeating,
    });
  }
  function performDelete() {
    const id = deleteModal.target;
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    // 繰り返しタスクのすべてを削除する
    if (deleteModal.deleteAll && task.isRepeating && !task.parentId) {
      setTasks(tasks.filter((t) => t.parentId !== id && t.id !== id));
    } else {
      // 本タスクのみ削除
      setTasks(
        tasks
          .filter((t) => t.id !== id)
          .map(
            (t) =>
              t.parentId === id
                ? { ...t, parentId: null, isRepeating: false }
                : t //親のみ削除された場合子タスクを普通のタスクへ変換
          )
      );
    }

    setDeleteModal({ open: false, target: null, deleteAll: false });
  }

  // ---- タスク完了・未完了 ----
  const toggleDone = (id) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  // ---- 詳細欄表示・非表示 ----
  const toggleDescription = (id) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, showDesc: !t.showDesc } : t))
    );
  };
  // ---- 繰り返しタスクの表示・非表示 ----
  const toggleChildren = (parentId) => {
    setTasks(
      tasks.map((t) =>
        t.id === parentId ? { ...t, showChild: !t.showChild } : t
      )
    );
  };

  // ---- 日付のフォーマット ----
  const formatDateJP = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  };

  return (
    <div className="flex flex-col min-h-screen overflow-x-hidden">
      <header className="p-4 text-center text-black-700 font-bold text-3xl">
        📋 To-Doリスト
      </header>
      <main className="flex-1 flex justify-center items-start">
        <div className="max-w-2xl w-full mx-auto mt-6 p-4">
          <h4 className="text-2xl font-bold mb-4 text-blue-600">タスク作成</h4>

          {/* 入力フォーム */}
          <div className="space-y-3 mb-6 flex flex-col items-start">
            <input
              type="text"
              placeholder="タスクを入力してください"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 border rounded bg-white text-black"
            />
            <textarea
              placeholder="説明 (オプション)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2 border rounded bg-white text-black"
            />
            <div className="w-full relative">
              <span
                className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 cursor-pointer"
                onClick={() =>
                  document.getElementById("dueDateInput-create")?.showPicker?.()
                }
              >
                📅
              </span>

              <input
                id="dueDateInput-create"
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  if (e.target.value) setError("");
                }}
                className={`pl-8 p-2 border rounded bg-white text-black w-full
      [&::-webkit-calendar-picker-indicator]:pointer-events-none
      [&::-webkit-calendar-picker-indicator]:opacity-0
    ${repeat && !dueDate ? "border-red-500 bg-red-50" : ""}`}
                onClick={(e) => e.target.showPicker?.()}
              />

              {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
            </div>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                className="checkbox-blue"
                checked={repeat}
                onChange={(e) => {
                  setRepeat(e.target.checked);
                  if (!e.target.checked) setError(""); // チェック外されたらエラーをクリア
                }}
              />
              <span>1か月間毎日繰り返す</span>
            </label>

            <button
              onClick={handleAddTask}
              disabled={repeat && !dueDate}
              className={`px-4 py-2 rounded text-white ${
                repeat && !dueDate
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-500 hover:bg-blue-600"
              }`}
            >
              追加
            </button>
          </div>
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  className="checkbox-blue"
                  checked={showRepeating}
                  onChange={(e) => setShowRepeating(e.target.checked)}
                />
                <span>繰り返し</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  className="checkbox-blue"
                  checked={showNoDate}
                  onChange={(e) => setShowNoDate(e.target.checked)}
                />
                <span>期限なし</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  className="checkbox-blue"
                  checked={hideDone}
                  onChange={(e) => setHideDone(e.target.checked)}
                />
                <span>完了タスクを隠す</span>
              </label>
            </div>
            <div>
              <label className="mr-2">並び順:</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="border rounded px-2 py-1 bg-white"
              >
                <option value="date">日付順</option>
                <option value="title">名前順</option>
              </select>
            </div>
          </div>

          {/* タスクリスト */}
          <ul className="space-y-3">
            {displayedTasks.length === 0 ? (
              <li className="text-gray-400 text-center">
                タスクがありません 🎉
              </li>
            ) : (
              displayedTasks.map((task) => {
                const isOverdue =
                  task.dueDate && new Date(task.dueDate) < today && !task.done;
                const isChild = !!task.parentId;
                const isEditing = editingIndex === task.id;
                const hasChildren = tasks.some((t) => t.parentId === task.id);

                return (
                  <li
                    key={task.id}
                    ref={(el) => (taskRefs.current[task.id] = el)}
                    className={`p-3 border rounded bg-gray-50 flex flex-col items-start ${
                      isChild ? "ml-4 border-l-4 border-blue-300" : ""
                    }`}
                  >
                    {isEditing ? (
                      <>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full p-1 border rounded bg-white"
                        />
                        <textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full p-1 border rounded bg-white"
                        />
                        <div className="w-full relative">
                          <span
                            className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 cursor-pointer"
                            onClick={() =>
                              document
                                .getElementById(`dueDateInput-edit-${task.id}`)
                                ?.showPicker?.()
                            }
                          >
                            📅
                          </span>

                          <input
                            id={`dueDateInput-edit-${task.id}`}
                            type="date"
                            value={editDueDate}
                            onChange={(e) => setEditDueDate(e.target.value)}
                            className="pl-8 p-2 border rounded bg-white text-black w-full  
                             [&::-webkit-calendar-picker-indicator]:pointer-events-none
                             [&::-webkit-calendar-picker-indicator]:opacity-0"
                          />
                        </div>

                        <div className="flex space-x-2 mt-2">
                          <button
                            onClick={() => saveEditTask(task.id)}
                            className="bg-green-500 text-white px-3 py-1 rounded"
                          >
                            💾 保存
                          </button>
                          <button
                            onClick={() => setEditingIndex(null)}
                            className="bg-gray-300 px-3 py-1 rounded"
                          >
                            ❌ キャンセル
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* ---タスクビュー --- */}
                        <div className="flex items-center space-x-2 w-full justify-between">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              className="checkbox-blue"
                              checked={task.done}
                              onChange={() => toggleDone(task.id)}
                            />
                            <span
                              className={`${
                                task.done ? "line-through text-gray-400" : ""
                              } ${isOverdue ? "text-red-600 font-bold" : ""}`}
                            >
                              {task.title}
                            </span>
                          </div>
                          <div className="flex space-x-1">
                            <button
                              onClick={() => startEditTask(task.id)}
                              className="px-2 rounded bg-white"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => deleteTask(task.id)}
                              className="px-2 rounded bg-white"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                        {deleteModal.open && (
                          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                            <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
                              <h2 className="text-lg font-bold mb-4">
                                削除しますか？
                              </h2>

                              {deleteModal.isRepeating && (
                                <label className="flex items-center space-x-2 mb-4">
                                  <input
                                    type="checkbox"
                                    className="checkbox-blue"
                                    checked={deleteModal.deleteAll}
                                    onChange={(e) =>
                                      setDeleteModal((prev) => ({
                                        ...prev,
                                        deleteAll: e.target.checked,
                                      }))
                                    }
                                  />
                                  <span>全ての繰り返しタスクも削除する</span>
                                </label>
                              )}

                              <div className="flex justify-end space-x-3">
                                <button
                                  className="px-4 py-2 bg-gray-300 rounded"
                                  onClick={() =>
                                    setDeleteModal({
                                      open: false,
                                      target: null,
                                      deleteAll: false,
                                    })
                                  }
                                >
                                  キャンセル
                                </button>

                                <button
                                  className="px-4 py-2 bg-red-500 text-white rounded"
                                  onClick={performDelete}
                                >
                                  削除
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {task.description && (
                          <button
                            onClick={() => toggleDescription(task.id)}
                            className="text-blue-700 hover:underline text-sm mt-1 bg-white"
                          >
                            {task.showDesc ? "－ 隠す" : "＋ 詳細"}
                          </button>
                        )}
                        {task.showDesc && (
                          <p className="mt-1 ml-6 text-gray-700">
                            {task.description}
                          </p>
                        )}
                        {task.dueDate && (
                          <p
                            className={`text-sm ${
                              task.done ? "line-through text-gray-400" : ""
                            } ${isOverdue ? "text-red-600 font-bold" : ""}`}
                          >
                            期限: {formatDateJP(task.dueDate)}
                          </p>
                        )}

                        {hasChildren && (
                          <button
                            onClick={() => toggleChildren(task.id)}
                            className="text-green-500 hover:underline text-sm mt-1 bg-white"
                          >
                            {task.showChild ? "－ 隠す" : "＋ 繰り返しタスク"}
                          </button>
                        )}
                      </>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </main>
    </div>
  );
}

export default Todo;
