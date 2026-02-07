import "./App.css";
import { useState, useEffect, useMemo } from "react";
import { Toaster } from "react-hot-toast";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Todo from "./pages/Todo";
import Calendar from "./pages/Calendar";
import Weather from "./pages/Weather";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import Settings from "./pages/Settings";
import ProtectedRoute from "./components/ProtectedRoute"; // 未ログイン専用ルート（ログイン済みはアクセス不可）
import PublicRoute from "./components/PublicRoute"; // 認証必須ルート（未ログイン時はリダイレクト）
import FocusWidget from "./components/FocusWidget";
import Header from "./components/Header";
import Footer from "./components/Footer";
import cities from "./data/cities";
import mapWeatherCode from "./data/weather";
import cleanupOldWeatherCache from "./utils/cleanupOldWeatherCache";
import { useAuth } from "./contexts/AuthContext";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase/config";
import { useTranslation } from "react-i18next";
import ScrollToTop from "./components/ScrollToTop";

function App() {
  const [tasks, setTasks] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "tasks"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "asc"),
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        showDesc: false,
        showChild: false,
      }));
      setTasks(data);
    });

    return unsub;
  }, [user]);

  const [selectedCity, setSelectedCity] = useState(() => {
    return localStorage.getItem("selectedCity") || cities[0].name;
  });
  const { t } = useTranslation();
  const [weatherData, setWeatherData] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [errorWeather, setErrorWeather] = useState(null);
  const [umbrellaAlertActive, setUmbrellaAlertActive] = useState(false);
  const [umbrellaDismissed, setUmbrellaDismissed] = useState(false);

  const cityObj = useMemo(() => {
    return cities.find((c) => c.name === selectedCity) || cities[0];
  }, [selectedCity]);

  // 変更がある場合に新地域保存
  useEffect(() => {
    localStorage.setItem("selectedCity", selectedCity);
  }, [selectedCity]);

  // 天気データのキャッシュ有効期限（3時間）
  const CACHE_EXPIRATION_MS = 3 * 60 * 60 * 1000;
  useEffect(() => {
    cleanupOldWeatherCache(CACHE_EXPIRATION_MS);
  }, []);

  useEffect(() => {
    if (!cityObj) return;
    const controller = new AbortController();
    const cacheKey = `weather_data_${cityObj.lat}_${cityObj.lon}`;

    // --- キャッシュ存在チェック ---
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      try {
        const data = JSON.parse(cachedData);

        if (Date.now() < data.timestamp + CACHE_EXPIRATION_MS) {
          setWeatherData(data.weather);
          setLoadingWeather(false);
          setErrorWeather(null);
          return; // キャッシュが有効期限内なら API 呼び出しをスキップ
        }
        // キャッシュ期限切れのため再取得
      } catch (e) {
        if (import.meta.env.MODE === "development") {
          if (import.meta.env.MODE === "development") {
            console.warn(e);
          }
        }
        // 壊れたキャッシュは無視して再取得
        localStorage.removeItem(cacheKey);
      }
    }
    // --- キャッシュ保存 ---

    const fetchWeather = async () => {
      setLoadingWeather(true);
      setErrorWeather(null);

      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${cityObj.lat}&longitude=${cityObj.lon}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=Asia%2FTokyo&forecast_days=14`;
        const res = await fetch(url, { signal: controller.signal });

        if (!res.ok) throw new Error(t("weather.no_data"));

        const data = await res.json();
        const d = data.daily;

        const normalized = d.time.map((dateStr, i) => ({
          date: dateStr,
          max: d.temperature_2m_max[i],
          min: d.temperature_2m_min[i],
          code: d.weathercode[i],
        }));

        const cacheValue = {
          timestamp: Date.now(),
          weather: normalized,
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheValue));

        setWeatherData(normalized);
      } catch (err) {
        if (err.name !== "AbortError") setErrorWeather(err.message);
      } finally {
        setLoadingWeather(false);
      }
    };

    fetchWeather();
    return () => controller.abort();
  }, [cityObj]); // コンポーネント破棄時に fetch を中断（メモリリーク防止）

  return (
    <div className="flex flex-col min-h-screen bg-white text-black">
      <Header
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      <main className="flex-1">
        <ScrollToTop />
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home
                  mapWeatherCode={mapWeatherCode}
                  weatherData={weatherData}
                  loadingWeather={loadingWeather}
                  tasks={tasks}
                  cities={cities}
                  selectedCity={selectedCity}
                  setSelectedCity={setSelectedCity}
                  umbrellaAlertActive={umbrellaAlertActive}
                  setUmbrellaAlertActive={setUmbrellaAlertActive}
                  umbrellaDismissed={umbrellaDismissed}
                  setUmbrellaDismissed={setUmbrellaDismissed}
                />
              </ProtectedRoute>
            }
          />

          <Route
            path="/auth"
            element={
              <PublicRoute>
                <Auth />
              </PublicRoute>
            }
          />

          <Route
            path="/forgot-password"
            element={
              <PublicRoute>
                <ForgotPassword />
              </PublicRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/todo"
            element={
              <ProtectedRoute>
                <Todo tasks={tasks} setTasks={setTasks} user={user} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/calendar"
            element={
              <ProtectedRoute>
                <Calendar
                  user={user}
                  tasks={tasks}
                  weatherData={weatherData || []} // weatherData が未取得の場合でも安全に描画できるよう空配列を渡す
                  mapWeatherCode={mapWeatherCode}
                />
              </ProtectedRoute>
            }
          />

          <Route
            path="/weather"
            element={
              <ProtectedRoute>
                <Weather
                  mapWeatherCode={mapWeatherCode}
                  weatherData={weatherData}
                  loadingWeather={loadingWeather}
                  cities={cities}
                  selectedCity={selectedCity}
                  setSelectedCity={setSelectedCity}
                  errorWeather={errorWeather}
                />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
      {user && user.emailVerified && (
        <>
          <Footer />
        </>
      )}
      <FocusWidget disabled={mobileMenuOpen} />
      <Toaster
        containerStyle={{
          zIndex: 10,
        }}
      />
    </div>
  );
}

export default App;
