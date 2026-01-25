import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  format,
  isToday,
  parseISO,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSunday,
  isSaturday,
  isSameMonth,
} from "date-fns";
import { ja, ru, enUS } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { useTaskActions } from "../hooks/useTaskActions";
import Spinner from "../components/Spinner";

// カスタムフック（祝日取得用）
function useHolidays() {
  const [holidays, setHolidays] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchHolidays = async () => {
      try {
        const res = await fetch(
          "https://holidays-jp.github.io/api/v1/date.json",
          { signal: controller.signal },
        );
        const data = await res.json();
        setHolidays(data);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError("fetch_holidays_failed"); 
        }
      }
    };

    fetchHolidays();

    return () => {
      controller.abort();
    };
  }, []);

  return { holidays, error };
}

function Calendar({ tasks, weatherData, mapWeatherCode }) {
  const { t, i18n } = useTranslation();
  
  // date-fns locale mapping
  const dateFnsLocale = useMemo(() => {
    switch (i18n.language) {
      case "ja":
        return ja;
      case "ru":
        return ru;
      default:
        return enUS;
    }
  }, [i18n.language]);

  const [selectedDay, setSelectedDay] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const monthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
  const monthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);
  const [editingTask, setEditingTask] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const navigate = useNavigate();

  const startDate = useMemo(
    () => startOfWeek(monthStart, { weekStartsOn: 0 }),
    [monthStart],
  );

  const endDate = useMemo(
    () => endOfWeek(monthEnd, { weekStartsOn: 0 }),
    [monthEnd],
  );

  const [deleteModal, setDeleteModal] = useState({
    open: false,
    target: null,
    deleteAll: false,
    isRepeating: false,
  });

  const { toggleDone, performDelete, saveTaskEdit } = useTaskActions(
    tasks,
    setDeleteModal,
  );
  const dateInputRef = useRef(null);
  function deleteTask(id) {
    const task = tasks.find((task) => task.id === id);
    if (!task) return;

    setDeleteModal({
      open: true,
      target: id,
      deleteAll: false,
      isRepeating: task.isRepeating && !task.parentId,
    });
  }

  const handlePerformDelete = () => {
    performDelete(deleteModal);
  };

  const startEdit = (task) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || "");
    setEditDueDate(task.dueDate || "");
  };

  const handleSaveEdit = async () => {
    if (!editingTask) return;
    if (!editTitle.trim()) {
      toast.error(t("calendar.task_title_required"));
      return;
    }

    try {
      await saveTaskEdit(
        editingTask.id,
        editTitle,
        editDescription,
        editDueDate,
      );
      setEditingTask(null);
    } catch (error) {
      toast.error(t("calendar.task_update_failed") + error);
    }
  };

  const handleCancelEdit = () => {
    setEditingTask(null);
  };

  const monthDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });
  const tasksByDay = useMemo(() => {
    const map = {};
    for (const task of tasks) {
      if (!task.dueDate) continue;
      if (!map[task.dueDate]) map[task.dueDate] = [];
      map[task.dueDate].push(task);
    }
    return map;
  }, [tasks]);

  const weekdays = t("calendar.weekdays", { returnObjects: true });
  const weatherDataByDate = useMemo(() => {
    const map = {};
    for (const w of weatherData) {
      map[w.date] = w;
    }
    return map;
  }, [weatherData]);

  const { holidays, error } = useHolidays();

  const detailRefs = useRef({});
  useEffect(() => {
    //  月が切り替わるたびに ref をクリアしてメモリ肥大化を防ぐ
    detailRefs.current = {};
  }, [currentMonth]);

  useEffect(() => {
    if (!selectedDay) return;
    const timer = setTimeout(() => {
      const el = detailRefs.current[selectedDay];
      if (el) {
        el.scrollIntoView({
          behavior: "smooth",
          block: "nearest", 
        });
      }
    }, 100); 

    return () => clearTimeout(timer);
  }, [selectedDay]);

  const handleDayClick = (dayStr) => setSelectedDay(dayStr);

  if (!Array.isArray(weatherData) || weatherData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20">
        <Spinner />
        <p className="mt-4 text-slate-500">{t("calendar.loading")}</p>
      </div>
    );
  }

  const inputClass =
    "w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all";
  const checkboxClass =
    "w-5 h-5 rounded-md border-2 border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 bg-white dark:bg-slate-800 transition-all cursor-pointer";
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300 pb-20">
      <div className="max-w-4xl mx-auto p-4 space-y-6 pt-8">
        {/* Header */}
        <header className="text-center py-4">
          <h1 className="text-3xl font-black text-slate-800 dark:text-white">
            {t("calendar.title")}
          </h1>
        </header>

        {/* Month Navigation Card */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex justify-between items-center transition-all">
          <button
            className="p-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-blue-600 transition-colors"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            ◀
          </button>
          <h4 className="text-xl font-black text-slate-800 dark:text-white">
            {format(currentMonth, t("calendar.format_month"), { locale: dateFnsLocale })}
          </h4>
          <button
            className="p-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-blue-600 transition-colors"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            ▶
          </button>
        </div>

        {error && <p className="text-red-600 text-center font-bold">{t(`calendar.${error}`, { defaultValue: error })}</p>}

        {/* メインカレンダー表示 */}
        <div className="p-2 sm:p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          {/* 曜日ヘッダー */}
          <div className="grid grid-cols-7 mb-2">
            {weekdays.map((d, i) => (
              <div
                key={d}
                className={`text-center text-[11px] font-black uppercase tracking-wider ${
                  i === 0
                    ? "text-red-500"
                    : i === 6
                      ? "text-blue-500"
                      : "text-slate-400"
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* 日付グリッド */}
          <div className="grid grid-cols-7 gap-0 sm:gap-2 border-t border-l border-slate-100 dark:border-slate-800 sm:border-none">
            {monthDays.map((day) => {
              const dayStr = format(day, "yyyy-MM-dd");
              const dayTasks = tasksByDay[dayStr] || [];
              const isHoliday = holidays[dayStr] !== undefined;
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isTodayDay = isToday(day);
              const isSelected = selectedDay === dayStr;

              // 色分けロジック
              let textColor = "text-slate-700 dark:text-slate-200";
              if (!isCurrentMonth)
                textColor = "text-slate-300 dark:text-slate-700";
              else if (isSunday(day) || isHoliday) textColor = "text-red-500";
              else if (isSaturday(day)) textColor = "text-blue-500";

              return (
                <div
                  key={dayStr}
                  onClick={() => handleDayClick(dayStr)}
                  className={`
                  relative flex flex-col items-start p-1 sm:p-2 h-24 sm:h-28 rounded-xl border transition-all cursor-pointer overflow-hidden
                  ${
                    isSelected
                      ? "ring-2 ring-blue-500 border-transparent z-10"
                      : "border-slate-100 dark:border-slate-800"
                  }
                  ${
                    isTodayDay
                      ? "bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }
                `}
                >
                  {/* ＜大きい画面＞日付＋天気（1列表示）*/}
                  <div className="flex justify-between w-full items-start">
                    <span
                      className={`text-xs sm:text-sm font-black ${textColor}`}
                    >
                      {format(day, "d")}
                    </span>

                    {(() => {
                      const weather = weatherDataByDate[dayStr];
                      if (!weather) return null;

                      const w = mapWeatherCode(weather.code);

                      return (
                        <div
                          className="flex flex-row items-center gap-[2px] text-[10px] 
                      leading-none max-sm:flex-col max-sm:items-end max-sm:gap-[0px] 
                      max-sm:text-[9px] text-slate-700 dark:text-slate-200"
                        >
                          <span className="leading-none">{w.icon}</span>

                          <span className="leading-none hidden sm:inline">
                            {Math.round(weather.max)}°/{Math.round(weather.min)}
                            °
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* 祝日名 */}
                  {isHoliday && isCurrentMonth && (
                    <div className="text-[8px] sm:text-[10px] text-red-500 font-bold leading-none mb-1 truncate w-full">
                      {holidays[dayStr]}
                    </div>
                  )}

                  {/* タスク表示（最大3件） */}
                  <div className="w-full mt-1 space-y-0.5 px-0">
                    {dayTasks.slice(0, 3).map((task) => {
                      const isOverdue =
                        task.dueDate < format(new Date(), "yyyy-MM-dd") && !task.done;

                      return (
                        <div
                          key={task.id}
                          className={`
                w-full truncate px-0.5 py-0
                text-[7px] sm:text-[9px] 
                h-3 sm:h-4 leading-[12px] sm:leading-[16px] text-left
                ${
                  task.done
                    ? "bg-slate-100/50 dark:bg-slate-800 text-slate-400 line-through"
                    : isOverdue
                      ? "bg-red-500  dark:bg-red-800/70 text-white font-bold"
                      : "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200"
                }
                sm:rounded-md
              `}
                        >
                          {task.title}
                        </div>
                      );
                    })}
                    {dayTasks.length > 3 && (
                      <div className="text-[7px] text-slate-400 font-bold pl-1">
                        + {dayTasks.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 選択中の日付の詳細表示（下部セクション）*/}
        {selectedDay && (
          <div
            id={`detail-${selectedDay}`}
            ref={(el) => (detailRefs.current[selectedDay] = el)}
            className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-300"
          >
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white">
                  {format(parseISO(selectedDay), t("calendar.format_day"), { locale: dateFnsLocale })}
                </h3>
                {holidays[selectedDay] && (
                  <span className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
                    {holidays[selectedDay]}
                  </span>
                )}
              </div>
              <button
                onClick={() => navigate(`/todo?date=${selectedDay}`)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-md hover:bg-blue-700 active:scale-95 transition-all"
              >
                <span className="text-lg">＋</span>{" "}
                <span className="hidden sm:inline">{t("calendar.add_task")}</span>
              </button>
            </div>

            <div className="space-y-3">
              {(() => {
                const dayTasks = tasksByDay[selectedDay] || [];

                if (dayTasks.length === 0) {
                  return (
                    <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/20 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                      <p className="text-4xl mb-2">🎉</p>
                      <p className="text-slate-500 dark:text-slate-400 font-bold">
                        {t("calendar.no_tasks")}
                      </p>
                    </div>
                  );
                }

                return dayTasks.map((task) => {
                  const isEditing = editingTask?.id === task.id;
                  return (
                    <div
                      key={task.id}
                      className={`group p-4 rounded-2xl border transition-all ${
                        task.done
                          ? "bg-slate-50/50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800"
                          : "bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm hover:border-blue-300 dark:hover:border-blue-800"
                      }`}
                    >
                      {isEditing ? (
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className={inputClass}
                            placeholder={t("calendar.placeholder_title")}
                          />
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className={inputClass}
                            placeholder={t("calendar.placeholder_description")}
                          />
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
                              value={editDueDate}
                              onChange={(e) => setEditDueDate(e.target.value)}
                              className={`w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-blue-500 text-sm font-bold text-slate-800 dark:text-white appearance-none }`}
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={handleSaveEdit}
                              className="flex-1 py-2 bg-green-600 text-white rounded-lg font-bold"
                            >
                              {t("calendar.save")}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="flex-1 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-bold"
                            >
                              {t("calendar.cancel")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4">
                          <input
                            type="checkbox"
                            checked={task.done}
                            onChange={() => toggleDone(task.id, task.done)}
                            className={checkboxClass}
                          />

                          <div className="text-left min-w-0">
                            <p
                              className={`font-bold truncate ${task.done ? "text-slate-400 line-through" : "text-slate-800 dark:text-slate-100"}`}
                            >
                              {task.title}
                            </p>
                            {task.description && (
                              <p
                                className={`text-xs truncate ${task.done ? "text-slate-300" : "text-slate-500 dark:text-slate-400"}`}
                              >
                                {task.description}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => startEdit(task)}
                              className="p-2 bg-white dark:bg-slate-900 text-slate-400 hover:text-blue-500 transition-colors"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => deleteTask(task.id)}
                              className="p-2 bg-white dark:bg-slate-900 text-slate-400 hover:text-red-500 transition-colors"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
        {deleteModal.open && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
              <h2 className="text-xl font-black mb-2 text-slate-800 dark:text-white">
                {t("calendar.delete_confirm_title")}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                {t("calendar.delete_confirm_desc")}
              </p>

              {deleteModal.isRepeating && (
                <label className="flex items-center gap-3 mb-6 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    className={checkboxClass}
                    checked={deleteModal.deleteAll}
                    onChange={(e) =>
                      setDeleteModal((prev) => ({
                        ...prev,
                        deleteAll: e.target.checked,
                      }))
                    }
                  />
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {t("calendar.delete_repeat_tasks")}
                  </span>
                </label>
              )}

              <div className="flex gap-3">
                <button
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 transition-all"
                  onClick={() =>
                    setDeleteModal({
                      open: false,
                      target: null,
                      deleteAll: false,
                    })
                  }
                >
                  {t("calendar.cancel")}
                </button>
                <button
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-200 dark:shadow-none transition-all"
                  onClick={handlePerformDelete}
                >
                  {t("calendar.delete")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Calendar;
