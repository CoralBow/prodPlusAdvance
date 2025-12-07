import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";

export default function Weather({
  cities,
  selectedCity,
  setSelectedCity,
  mapWeatherCode,
  weatherData,
  loading,
  error,
  loadingWeather,
  errorWeather,
}) {
  const handleCityChange = (e) => setSelectedCity(e.target.value);
  const todayWeather = weatherData?.[0];
  const tomorrowWeather = weatherData?.[1];
  if (loading) return <p>⏳ 天気予報を読み込み中…</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!weatherData) return null;

  return (
    <div className="flex flex-col min-h-screen overflow-x-hidden">
      <header className="p-4 text-center text-black-700 font-bold text-3xl">
        🌞 天気予報
      </header>
      <div className="flex items-center justify-center my-4"></div>
      <div className="bg-white p-4">
        <h4 className="text-2xl font-bold mb-4 text-blue-600">
          天気 ＠{" "}
          <select
            value={selectedCity}
            onChange={handleCityChange}
            className="border p-2 bg-white"
          >
            {cities.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </h4>
        {loadingWeather && <p>⏳ 天気予報を読み込み中...</p>}
        {!loadingWeather && todayWeather && (
          <div className="flex gap-6">
            {[todayWeather, tomorrowWeather].map((d, i) => {
              const w = mapWeatherCode(d.code);
              return (
                <div
                  key={d.date}
                  className="flex items-center bg-gray-50 rounded-lg p-3 w-1/2"
                >
                  <div className="text-4xl mr-4">{w.icon}</div>
                  <div>
                    <div className="text-sm text-gray-600">
                      {i === 0 ? "今日" : "明日"}・
                      {format(parseISO(d.date), "M月d日 (E)", { locale: ja })}
                    </div>
                    <div className="text-lg font-bold">
                      {Math.round(d.max)}° / {Math.round(d.min)}°
                    </div>
                    <div className="text-sm">{w.label}</div>
                  </div>
                </div>
              );
            })}
            {errorWeather && (
              <p className="text-red-600 text-center mt-4">
                ⚠️ 天気情報の取得に失敗しました: {errorWeather}
              </p>
            )}
          </div>
        )}
      </div>
      <div className="bg-white p-4">
        <h4 className="text-2xl font-bold mb-4 text-blue-600">
          二週間の天気予報
        </h4>
        <div className="grid grid-rows-2 grid-cols-7 gap-2">
          {weatherData.map((d) => {
            const w = mapWeatherCode(d.code);
            return (
              <div
                key={d.date}
                className="p-2 rounded bg-white text-center text-xs shadow-sm"
              >
                <div className="font-semibold">
                  {format(parseISO(d.date), "M/d (E)", { locale: ja })}
                </div>
                <div className="text-3xl mt-1">{w.icon}</div>
                <div className="mt-1">
                  <span className="font-medium">{Math.round(d.max)}°</span>
                  <span> / </span>
                  <span className="text-gray-500">{Math.round(d.min)}°</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">{w.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
