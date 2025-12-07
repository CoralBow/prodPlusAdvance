import "./App.css";
import { useState, useEffect, useRef } from "react";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Todo from "./pages/Todo";
import Calendar from "./pages/Calendar";
import Weather from "./pages/Weather";
import cities from "./data/cities";
import mapWeatherCode from "./data/weather";

function App() {
  const [tasks, setTasks] = useState([]);
  const hasMounted = useRef(false);
  const [selectedCity, setSelectedCity] = useState(() => {
    return localStorage.getItem("selectedCity") || cities[0].name; // デフォルト地域（東京都）
  });

  // 変更がある場合に新地域保存
  useEffect(() => {
    localStorage.setItem("selectedCity", selectedCity);
  }, [selectedCity]);
  const [weatherData, setWeatherData] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [errorWeather, setErrorWeather] = useState(null);
  const [umbrellaAlertActive, setUmbrellaAlertActive] = useState(false);
  const [umbrellaDismissed, setUmbrellaDismissed] = useState(false);

  const cityObj = cities.find((c) => c.name === selectedCity) || cities[0];

  useEffect(() => {
    const stored = localStorage.getItem("tasks");
    if (stored) setTasks(JSON.parse(stored));
  }, []);

  useEffect(() => {
    if (hasMounted.current) {
      localStorage.setItem("tasks", JSON.stringify(tasks));
    } else {
      hasMounted.current = true;
    }
  }, [tasks]);
  useEffect(() => {
    if (!cityObj) return;
    const controller = new AbortController();

    const fetchWeather = async () => {
      setLoadingWeather(true);
      setErrorWeather(null);
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${cityObj.lat}&longitude=${cityObj.lon}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=Asia%2FTokyo&forecast_days=14`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error("天気情報の取得に失敗しました");
        const data = await res.json();
        const d = data.daily;
        const normalized = d.time.map((dateStr, i) => ({
          date: dateStr,
          max: d.temperature_2m_max[i],
          min: d.temperature_2m_min[i],
          code: d.weathercode[i],
        }));
        setWeatherData(normalized);
      } catch (err) {
        if (err.name !== "AbortError") setErrorWeather(err.message);
      } finally {
        setLoadingWeather(false);
      }
    };

    fetchWeather();
    return () => controller.abort();
  }, [cityObj]);

  return (
    <div className="flex flex-col min-h-screen bg-white text-black">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route
            path="/"
            element={
              <Home
                mapWeatherCode={mapWeatherCode}
                weatherData={weatherData}
                loadingWeather={loadingWeather}
                tasks={tasks}
                cities={cities}
                selectedCity={selectedCity}
                umbrellaAlertActive={umbrellaAlertActive}
                setUmbrellaAlertActive={setUmbrellaAlertActive}
                umbrellaDismissed={umbrellaDismissed}
                setUmbrellaDismissed={setUmbrellaDismissed}
              />
            }
          />
          <Route
            path="/todo"
            element={<Todo tasks={tasks} setTasks={setTasks} />}
          />
          <Route
            path="/calendar"
            element={
              <Calendar
                tasks={tasks}
                setTasks={setTasks}
                weatherData={weatherData || []}
                mapWeatherCode={mapWeatherCode}
              />
            }
          />
          <Route
            path="/weather"
            element={
              <Weather
                mapWeatherCode={mapWeatherCode}
                weatherData={weatherData}
                loadingWeather={loadingWeather}
                cities={cities}
                selectedCity={selectedCity}
                setSelectedCity={setSelectedCity}
                errorWeather={errorWeather}
              />
            }
          />
        </Routes>
        <Footer />
      </main>
    </div>
  );
}

export default App;
