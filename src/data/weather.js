/* Open-Meteo の天気コードを絵文字とラベルに対応させる（シンプル版、拡張可能） */
function mapWeatherCode(code) {
  // Open-Meteo / WMOコード
  const map = {
    0: { icon: "☀️", label: "weather.clear" },
    1: { icon: "🌤️", label: "weather.clear_thin" },
    2: { icon: "⛅", label: "weather.partly_cloudy" },
    3: { icon: "☁️", label: "weather.cloudy" },
    45: { icon: "🌫️", label: "weather.fog" },
    48: { icon: "🌫️❄️", label: "weather.rime_fog" },
    51: { icon: "🌧️", label: "weather.drizzle_light" },
    53: { icon: "🌧️", label: "weather.drizzle_moderate" },
    55: { icon: "🌧️", label: "weather.drizzle_heavy" },
    56: { icon: "🌧️❄️", label: "weather.freezing_drizzle_light" },
    57: { icon: "🌧️❄️", label: "weather.freezing_drizzle_heavy" },
    61: { icon: "🌦️", label: "weather.rain_light" },
    63: { icon: "🌧️", label: "weather.rain_moderate" },
    65: { icon: "🌧️🌧️", label: "weather.rain_heavy" },
    66: { icon: "🌧️❄️", label: "weather.freezing_rain_light" },
    67: { icon: "🌧️❄️", label: "weather.freezing_rain_heavy" },
    71: { icon: "🌨️", label: "weather.snow_light" },
    73: { icon: "🌨️", label: "weather.snow_moderate" },
    75: { icon: "❄️❄️", label: "weather.snow_heavy" },
    77: { icon: "❄️", label: "weather.snow_grains" },
    80: { icon: "🌦️", label: "weather.showers_light" },
    81: { icon: "🌧️", label: "weather.showers_moderate" },
    82: { icon: "🌧️🌧️", label: "weather.showers_violent" },
    85: { icon: "🌨️", label: "weather.snow_showers_light" },
    86: { icon: "🌨️🌨️", label: "weather.snow_showers_heavy" },
    95: { icon: "⛈️", label: "weather.thunderstorm" },
    96: { icon: "⛈️❄️", label: "weather.thunderstorm_hail_light" },
    99: { icon: "⛈️❄️❄️", label: "weather.thunderstorm_hail_heavy" },
  };

  return map[code] ?? { icon: "❓", label: "weather.unknown" };
}
export default mapWeatherCode;
