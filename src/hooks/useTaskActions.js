import { doc, serverTimestamp, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";
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
                completedAt: !currentDoneStatus ? serverTimestamp() : null
            });

        } catch (e) {
            if (import.meta.env.MODE === "development") {
          console.error(e);
        }
        }
    };

    // ---- 2. 削除処理 ----
    const performDelete = async (modalState) => {
        const id = modalState.target;
        const task = tasks.find((t) => t.id === id);

        if (!task) {
            setDeleteModal({ open: false, target: null, deleteAll: false, isRepeating: false });
            return;
        }

        try {
            // 繰り返しタスク全体（親タスク）を削除する場合
            if (modalState.deleteAll && task.isRepeating && !task.parentId) {
                const batch = writeBatch(db);
                
                // すべての子タスク（将来分）を検索して削除
                const children = tasks.filter((t) => t.parentId === id);
                children.forEach((c) => {
                    batch.delete(doc(db, "tasks", c.id));
                });
                
                // バッチ削除をコミット
                await batch.commit();
                
                // 最後に親タスク自体を削除
                await deleteDoc(doc(db, "tasks", id));
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
            setDeleteModal({ open: false, target: null, deleteAll: false, isRepeating: false });
        }
    };
 // ---- 3. 編集タスクの保存 ----
    const saveTaskEdit = async (id, title, description, dueDate) => {
        try {
            const ref = doc(db, "tasks", id);
            await updateDoc(ref, {
                title: title,
                description: description,
                dueDate: dueDate || null,
            });
            return true; 
        } catch (error) {
            if (import.meta.env.MODE === "development") {
          console.error(error);
        }
           throw error; 
        }
    };
    return { toggleDone, performDelete, saveTaskEdit };
}