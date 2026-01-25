export default function cleanupOldWeatherCache(expirationMs) {
  const now = Date.now();

  Object.keys(localStorage).forEach((key) => {
    if (!key.startsWith("weather_data_")) return;

    try {
      const value = JSON.parse(localStorage.getItem(key));
      if (!value?.timestamp || now > value.timestamp + expirationMs) {
        localStorage.removeItem(key);
      }
    } catch {
      localStorage.removeItem(key);
    }
  });
}
