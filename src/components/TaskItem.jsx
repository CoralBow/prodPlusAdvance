import React, { useState } from "react";
import { useTranslation } from "react-i18next";

// React.memo を使うことで、「タスク追加」入力中にリスト全体が再レンダリングされるのを防ぐ
const TaskItem = React.memo(
  ({
    item,
    isChild,
    isEditing,
    editState,
    setEditState,
    uiState,
    today,
    onToggleDone,
    onStartEdit,
    onSaveEdit,
    onCancelEdit,
    onDelete,
    onToggleDesc,
    onToggleChildren,
    childCount,
    formatDate,
    taskRef,
  }) => {
    const { t } = useTranslation("common");
    const [editMode, setEditMode] = useState("single");

    const isItemOverdue =
      item.dueDate &&
      new Date(item.dueDate + "T00:00:00") < today &&
      !item.done;
    const itemShowDesc = uiState?.showDesc;
    const itemShowChild = uiState?.showChild;
    const isDateDisabled = item.isRepeating || !!item.parentId;

    return (
      <div
        ref={taskRef}
        className={`group p-4 my-1 mr-2 rounded-xl border transition-all ${
          isChild
            ? "ml-8 bg-blue-50/30 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30"
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm"
        }`}
      >
        {isEditing ? (
          <div className="space-y-3">
            <input
              type="text"
              required
              maxLength={1000}
              value={editState.title}
              onChange={(e) =>
                setEditState({ ...editState, title: e.target.value })
              }
              className="w-full p-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold dark:text-slate-300"
            />
            <textarea
              value={editState.description}
              maxLength={1000}
              onChange={(e) =>
                setEditState({ ...editState, description: e.target.value })
              }
              className="w-full p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-l dark:text-slate-300"
              placeholder={t("todo.placeholder_desc")}
            />
            <input
              type="date"
              disabled={isDateDisabled}
              value={editState.dueDate}
              onClick={(e) => e.target.showPicker?.()}
              onChange={(e) =>
                setEditState({ ...editState, dueDate: e.target.value })
              }
              className={`w-full p-2 rounded-xl text-sm dark:text-slate-300 ${
                isDateDisabled
                  ? "bg-slate-200 dark:bg-slate-900 opacity-50 cursor-not-allowed"
                  : "bg-slate-100 dark:bg-slate-800"
              }`}
            />
            {isDateDisabled && (
              <span className="text-[10px] text-slate-400 mt-1 block px-1">
                {t("todo.date_lock_hint")} {/* "Series dates are managed automatically" */}
              </span>
            )}
            {/* 繰り返しタスク */}
            {item.isRepeating && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl space-y-2">
                <p className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 px-1">
                  {t("todo.edit_options")}
                </p>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`editMode-${item.id}`}
                      checked={editMode === "single"}
                      onChange={() => setEditMode("single")}
                      className="w-4 h-4"
                    />
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      {t("todo.apply_single")}
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`editMode-${item.id}`}
                      checked={editMode === "all"}
                      onChange={() => setEditMode("all")}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      {t("todo.apply_all")}
                    </span>
                  </label>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => onSaveEdit(item.id, editState, editMode)}
                className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-xs font-bold"
              >
                {t("todo.save")}
              </button>
              <button
                onClick={() => {
                  setEditMode("single");
                  onCancelEdit();
                }}
                className="flex-1 bg-slate-200 dark:bg-slate-700 py-2 rounded-xl text-xs font-bold dark:text-slate-300"
              >
                {t("todo.cancel")}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => onToggleDone(item.id, item.done)}
              className="task-checkbox"
            />
            <div className="flex-1 min-w-0 text-left">
              <div className="flex justify-between items-center">
                <h3
                  className={`font-bold truncate ${item.done ? "line-through text-slate-400" : "text-slate-800 dark:text-white"} ${isItemOverdue ? "text-red-600" : ""}`}
                >
                  {item.title} {item.isRepeating && !isChild && "🔄"}
                </h3>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onStartEdit(item)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg bg-gray-100 dark:bg-slate-800"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => onDelete(item.id)}
                    className="p-1 hover:bg-red-50 rounded-lg text-red-500 bg-gray-100 dark:bg-slate-800"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              {item.dueDate && (
                <p
                  className={`text-[12px] font-black mt-1 ${isItemOverdue ? "text-red-500" : "text-slate-400"}`}
                >
                  📅 {formatDate(item.dueDate)}
                </p>
              )}
              <div className="mt-2 flex gap-3">
                {item.description && (
                  <button
                    onClick={() => onToggleDesc(item.id)}
                    className="text-[12px] bg-gray-100 dark:bg-slate-800 font-black text-blue-500 rounded-full px-2 py-0.5"
                  >
                    {itemShowDesc
                      ? t("todo.details_hide")
                      : t("todo.details_show")}
                  </button>
                )}
                {!isChild && childCount > 0 && (
                  <button
                    onClick={() => onToggleChildren(item.id)}
                    className="text-[12px] font-black text-blue-500 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-full"
                  >
                    {itemShowChild
                      ? t("todo.repeating_hide")
                      : t("todo.repeating_show", { count: childCount })}
                  </button>
                )}
              </div>
              {itemShowDesc && (
                <p className="mt-3 text-[14px] text-left text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 whitespace-pre-wrap">
                  {item.description}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  },
);

export default TaskItem;
