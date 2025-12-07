import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  format,
  isToday,
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
import { truncateByWidth } from "../utils/truncateByWidth.js";

// カスタムフック
function useHolidays() {
  const [holidays, setHolidays] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const res = await fetch(
          "https://holidays-jp.github.io/api/v1/date.json"
        );
        const data = await res.json();
        setHolidays(data);  // object内容: { "2025-01-01": "元日", ... }
      } catch (error) {
        if (error.name !== "AbortError") setError("祝日の取得に失敗しました");
      }
    };

    fetchHolidays();
  }, []);

  return { holidays, error };
}

function Calendar({ tasks, setTasks, weatherData, mapWeatherCode }) {
  const [selectedDay, setSelectedDay] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const monthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
  const monthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);

  const startDate = useMemo(
    () => startOfWeek(monthStart, { weekStartsOn: 0 }),
    [monthStart]
  );

  const endDate = useMemo(
    () => endOfWeek(monthEnd, { weekStartsOn: 0 }),
    [monthEnd]
  );
  const [deleteModal, setDeleteModal] = useState({
    open: false,
    target: null, // タスクid
    deleteAll: false, // チェックボックスにチェック有無
  });
  const navigate = useNavigate();

  const monthDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });
  const tasksByDay = useMemo(() => {
    const map = {};
    for (const t of tasks) {
      if (!map[t.dueDate]) map[t.dueDate] = [];
      map[t.dueDate].push(t);
    }
    return map;
  }, [tasks]);

  const weekdays = ["(日)", "(月)", "(火)", "(水)", "(木)", "(金)", "(土)"];
  const weatherDataByDate = useMemo(() => {
    const map = {};
    for (const w of weatherData) {
      map[w.date] = w;
    }
    return map;
  }, [weatherData]);

  const { holidays, error } = useHolidays();

  const handleComplete = (id) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

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

  const detailRefs = useRef({});
  const handleDayClick = (dayStr) => {
    setSelectedDay(dayStr);
    const el = detailRefs.current[dayStr];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  if (!weatherData || Object.keys(weatherData).length === 0) {
    return (
      <p className="text-center text-gray-500">⏳ カレンダーを読み込み中…</p>
    );
  }

  return (
    <div className="flex flex-col min-h-screen overflow-x-hidden">
      <div>
        <header className="p-4 text-center text-black-700 font-bold text-3xl">
          📅 カレンダー
        </header>
      </div>
      <br />
      <div className="flex justify-around items-center mb-4">
        <button
          className=" bg-white text-blue-600"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          ◀
        </button>
        <h4 className="text-2xl font-bold mb-4 text-blue-600">
          {format(currentMonth, "yyyy年MM月")}
        </h4>
        <button
          className=" bg-white text-blue-600"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          ▶
        </button>
      </div>
      {error && <p className="text-red-600">{error}</p>}
      <div className="px-5 grid grid-cols-7 gap-0 sm:gap-1  w-full max-w-[840px] mx-auto">
        {weekdays.map((d) => (
          <div key={d} className="text-center font-bold ">
            {d}
          </div>
        ))}
      </div>
      <div
        className="grid p-2 sm:p-5 grid-cols-7 gap-0 sm:gap-1  
      [grid-auto-rows:minmax(42px,auto)] sm:[grid-auto-rows:minmax(65px,auto)] 
      md:[grid-auto-rows:minmax(90px,auto)]"
      >
        {monthDays.map((day) => {
          const dayStr = format(day, "yyyy-MM-dd");
          const dayTasks = tasksByDay[dayStr] || [];

          const isHoliday = holidays[dayStr] !== undefined;
          const holidayLabel = holidays[dayStr]
            ? truncateByWidth(holidays[dayStr], "bold 10px sans-serif", 70)
            : null;

          // タスク数制限
          const limit = isHoliday ? 1 : 2;

          // タスクを分ける
          const notDone = dayTasks.filter((t) => !t.done);
          const done = dayTasks.filter((t) => t.done);

          // 見えるタスクを洗い出す
          let visibleTasks = notDone.slice(0, limit);

          if (visibleTasks.length < limit) {
            const remaining = limit - visibleTasks.length;
            visibleTasks = [...visibleTasks, ...done.slice(0, remaining)];
          }

          // タスク数多い時の…を出す
          const shouldShowEllipsis = dayTasks.length > visibleTasks.length;

          const isCurrentMonth = isSameMonth(day, currentMonth);
          const dayColor = isSunday(day)
            ? "text-red-500 text-s truncate"
            : isSaturday(day)
            ? "text-blue-500 text-s truncate"
            : isHoliday
            ? "text-red-500 text-s truncate"
            : " text-s truncate";
          return (
            <div
              key={dayStr}
              onClick={() => handleDayClick(dayStr)}
              className={`border rounded-sm p-2 cursor-pointer flex flex-col items-start 
    h-24 overflow-hidden transition
    ${isToday(day) ? "border-black" : "border-gray-300"}
    ${selectedDay === dayStr ? "border-blue-500 bg-blue-50" : ""}
    hover:bg-gray-100`}
            >
              {/* ＜大きい画面＞日付 + 天気 （１列） */}
              <div className="flex flex-col sm:flex-row justify-between w-full">
                {/* ＜小さい画面＞日付 */}
                <span
                  className={`font-bold ${dayColor} ${
                    !isCurrentMonth ? "text-gray-400" : ""
                  } text-[12px] sm:text-base`}
                >
                  {format(day, "d")}
                </span>

                {/* ＜小さい画面＞天気 */}
                {(() => {
                  const weather = weatherDataByDate[dayStr];
                  if (!weather) return null;

                  const w = mapWeatherCode(weather.code);

                  return (
                    <div
                      className="flex flex-row items-center gap-[2px] text-[10px] 
                      leading-none max-sm:flex-col max-sm:items-end max-sm:gap-[0px] 
                      max-sm:text-[9px]"
                    >
                      <span className="leading-none">{w.icon}</span>

                      <span className="leading-none">
                        {Math.round(weather.max)}°/{Math.round(weather.min)}°
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* 祝日名 */}
              {holidayLabel && (
                <p className="text-[9px] sm:text-[11px] font-bold text-red-500 text-left">
                  {holidayLabel}
                </p>
              )}

              {/* タスク */}
              <div className="mt-1 flex-1 overflow-hidden min-h-[14px] w-full text-left">
                {visibleTasks.map((t) => (
                  <p
                    key={t.id}
                    className={`text-[10px] sm:text-xs font-bold truncate line-clamp-1 
                      leading-tight ${
                        t.done ? "line-through text-gray-400" : ""
                      }`}
                    title={t.title}
                  >
                    <p
                      className="relative pl-3 before:absolute before:left-0 before:top-[6px] 
                    before:w-1 before:h-1 before:bg-gray-700 before:rounded-full ..."
                    >
                      {t.title}
                    </p>
                  </p>
                ))}

                {shouldShowEllipsis && (
                  <p className="text-[10px] sm:text-xs text-gray-400">…</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div>
        {selectedDay && (
          <div className="mt-4 p-4 border rounded">
            <h3 className="font-semibold">{selectedDay} の予定</h3>
            <button
              onClick={() => navigate(`/todo?date=${selectedDay}`)}
              className="text-blue-500 bg-white hover:text-blue-700 text-lg"
              title="この日にタスクを追加"
            >
              ➕
            </button>
            {holidays[selectedDay] && (
              <p className="text-red-500">祝日: {holidays[selectedDay]}</p>
            )}
            <ul className="space-y-1">
              {tasks.filter((t) => t.dueDate === selectedDay).length > 0 ? (
                tasks
                  .filter((t) => t.dueDate === selectedDay)
                  .map((t) => (
                    <li key={t.id} className="flex justify-between">
                      {" "}
                      <span>
                        <input
                          type="checkbox"
                          className="checkbox-blue"
                          checked={t.done}
                          onChange={() => handleComplete(t.id)}
                        />{" "}
                        <span
                          className={`list-decimal list-inside space-y-1 font-bold  ${
                            t.done ? "line-through text-gray-400" : ""
                          } `}
                        >
                          {t.title}{" "}
                          {t.description ? "(" + t.description + ")" : ""}
                        </span>
                      </span>
                      <div>
                        <button
                          onClick={() =>
                            navigate("/todo", { state: { editId: t.id } })
                          }
                          className="px-2 rounded bg-white"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => deleteTask(t.id)}
                          className="text-red-600 bg-white"
                        >
                          🗑️
                        </button>
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
                    </li>
                  ))
              ) : (
                <p>今日はタスクがありません 🎉</p>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default Calendar;
