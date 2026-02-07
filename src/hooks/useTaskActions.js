import {
  doc,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/config";

/**
 * タスク関連の Firestore 操作をまとめたカスタムフック
 * @param {Array<Object>} tasks - 現在のタスク配列（読み取り専用）
 * @param {Function} setTasks -タスク state 用 setter（楽観的更新時のみ使用。ここでは Firestore リスナーに任せる）
 * @returns {Object} 完了切替・削除・編集用の関数群
 */
export function useTaskActions(tasks, setDeleteModal) {
  // ---- 1. タスク完了状態の切り替え ----
  const toggleDone = async (id, currentDoneStatus) => {
    try {
      await updateDoc(doc(db, "tasks", id), {
        done: !currentDoneStatus,
        completedAt: !currentDoneStatus ? serverTimestamp() : null,
      });
    } catch (e) {
      if (import.meta.env.MODE === "development") {
        console.error(e);
      }
    }
  };

  // ---- 2. 削除処理 ----
  const performDelete = async (modalState) => {
    const { target: id, deleteMode } = modalState; // モードの種類: "single", "future", "all"
    const task = tasks.find((t) => t.id === id);

    if (!task) {
      setDeleteModal({
        open: false,
        target: null,
        deleteAll: false,
        isRepeating: false,
      });
      return;
    }

    try {
      const batch = writeBatch(db);
      const seriesId = task.parentId || task.id;

      if (
        modalState.deleteAll ||
        deleteMode === "future" ||
        deleteMode === "all"
      ) {
        const targetDate = task.dueDate || "";

        const tasksToDelete = tasks.filter((t) => {
          const isSameSeries = t.parentId === seriesId || t.id === seriesId;
          if (modalState.deleteAll || deleteMode === "all") return isSameSeries;
          // "future"の場合それ以降のもののみ対象
          return isSameSeries && (t.dueDate || "") >= targetDate;
        });

        tasksToDelete.forEach((t) => batch.delete(doc(db, "tasks", t.id)));
        await batch.commit();

      } else {
        // 単一タスクの削除

        // ケース1：繰り返しタスクの子を削除:
        // 特別な処理は不要。ドキュメントを削除するだけ

        // ケース2：繰り返しでないタスクを削除:
        await deleteDoc(doc(db, "tasks", id));
      }

      // ※ tasks の state 更新は Firestore リスナー側で処理される
    } catch (e) {
      if (import.meta.env.MODE === "development") {
        console.error(e);
      }
    } finally {
      // 成否に関わらずモーダルを閉じる
      setDeleteModal({
        open: false,
        target: null,
        deleteAll: false,
        isRepeating: false,
      });
    }
  };
  // ---- 3. 編集タスクの保存 ----
  const saveTaskEdit = async (
    id,
    title,
    description,
    dueDate,
    mode = "single",
  ) => {
    try {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;

      const batch = writeBatch(db);
      const seriesId = task.parentId || task.id;

      if (mode === "all" || mode === "future") {
        const targetDate = task.dueDate || "";
        const relatedTasks = tasks.filter((t) => {
          const isSameSeries = t.parentId === seriesId || t.id === seriesId;
          return (
            isSameSeries && (mode === "all" || (t.dueDate || "") >= targetDate)
          );
        });

        relatedTasks.forEach((t) => {
          const tRef = doc(db, "tasks", t.id);
          batch.update(tRef, { title, description });
        });
        await batch.commit();
      } else {
        await updateDoc(doc(db, "tasks", id), {
          title,
          description,
          dueDate: dueDate || null,
        });
      }
    } catch (e) {
      if (import.meta.env.MODE === "development") {
        console.error(e);
      }
      throw e;
    }
  };
  return { toggleDone, performDelete, saveTaskEdit };
}
