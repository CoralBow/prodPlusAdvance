import { useCallback } from "react";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import Spinner from "../components/Spinner";

export default function Weather({
  cities,
  selectedCity,
  setSelectedCity,
  mapWeatherCode,
  weatherData,
  loadingWeather,
  errorWeather,
}) {
  const handleCityChange = useCallback(
    (e) => setSelectedCity(e.target.value),
    [setSelectedCity],
  );

  if (errorWeather) {
    return (
      <div className="flex justify-center p-10">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl text-red-600 dark:text-red-400 text-center text-sm font-bold">
          ⚠️ 天気情報の取得に失敗しました: {errorWeather}
        </div>
      </div>
    );
  }

  if (loadingWeather) {
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

  if (!Array.isArray(weatherData) || weatherData.length === 0) {
    return (
      <p className="text-center p-20 dark:text-white">データがありません</p>
    );
  }

  const todayWeather = weatherData[0];
  const tomorrowWeather = weatherData[1];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300 pb-20">
      <div className="max-w-4xl mx-auto p-4 space-y-6 pt-8">
        {/* ヘッダー */}
        <header className="text-center py-4">
          <h1 className="text-3xl font-black text-slate-800 dark:text-white">
            🌞 天気予報
          </h1>
        </header>

        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <h4 className="text-xl font-bold text-blue-600 dark:text-blue-400">
              天気 ＠ {selectedCity}
            </h4>
            <select
              value={selectedCity}
              onChange={handleCityChange}
              className="w-full sm:w-auto p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer"
            >
              {cities.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* --- 今日＆明日カード --- */}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* filter(Boolean) は undefined / null / false などの不要な値を除外し、
          map や render 時の "undefined is not iterable / cannot read property" 系クラッシュを防ぐ */}
          {[todayWeather, tomorrowWeather].filter(Boolean).map((d, i) => {
            const w = mapWeatherCode(d.code);
            return (
              <div
                key={`${d.date}-${i}`}
                className="flex items-center p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm"
              >
                <div className="text-5xl mr-6 filter drop-shadow-sm">
                  {w.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {i === 0 ? "今日" : "明日"}・
                    {format(parseISO(d.date), "M月d日 (E)", {
                      locale: ja,
                    })}
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    {Math.round(d.max)}°{" "}
                    <span className="text-slate-300 dark:text-slate-600 text-xl">
                      /
                    </span>{" "}
                    {Math.round(d.min)}°
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 mt-1 font-medium">
                    {w.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* --- 二週間の天気予報カード --- */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-6">
            二週間の天気予報
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
            {weatherData.map((d) => {
              const w = mapWeatherCode(d.code);
              return (
                <div
                  key={`${d.date}-${d.code}`}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center transition-transform hover:scale-[1.02]"
                >
                  <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    {format(parseISO(d.date), "M/d (E)", { locale: ja })}
                  </div>
                  <div className="text-3xl my-2">{w.icon}</div>
                  <div className="text-sm font-black text-slate-900 dark:text-white">
                    {Math.round(d.max)}°
                    <span className="text-slate-400 font-normal">
                      /{Math.round(d.min)}°
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-500 mt-1 truncate px-1">
                    {w.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
