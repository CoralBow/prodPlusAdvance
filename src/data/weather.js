/* Open-Meteo の天気コードを絵文字とラベルに対応させる（シンプル版、拡張可能） */
function mapWeatherCode(code) {
  // Open-Meteo / WMOコード
  const map = {
    0: { icon: "☀️", label: "快晴" },
    1: { icon: "🌤️", label: "晴れ（薄い雲）" },
    2: { icon: "⛅", label: "晴れ時々曇り" },
    3: { icon: "☁️", label: "曇り" },
    45: { icon: "🌫️", label: "霧" },
    48: { icon: "🌫️❄️", label: "霧氷" },
    51: { icon: "🌧️", label: "小雨（弱い霧雨）" },
    53: { icon: "🌧️", label: "小雨（中程度の霧雨）" },
    55: { icon: "🌧️", label: "小雨（強い霧雨）" },
    56: { icon: "🌧️❄️", label: "凍結霧雨（弱い）" },
    57: { icon: "🌧️❄️", label: "凍結霧雨（強い）" },
    61: { icon: "🌦️", label: "雨（弱い）" },
    63: { icon: "🌧️", label: "雨（中程度）" },
    65: { icon: "🌧️🌧️", label: "雨（強い）" },
    66: { icon: "🌧️❄️", label: "凍結雨（弱い）" },
    67: { icon: "🌧️❄️", label: "凍結雨（強い）" },
    71: { icon: "🌨️", label: "雪（弱い）" },
    73: { icon: "🌨️", label: "雪（中程度）" },
    75: { icon: "❄️❄️", label: "雪（強い）" },
    77: { icon: "❄️", label: "雪の粒" },
    80: { icon: "🌦️", label: "にわか雨（弱い）" },
    81: { icon: "🌧️", label: "にわか雨（中程度）" },
    82: { icon: "🌧️🌧️", label: "にわか雨（激しい）" },
    85: { icon: "🌨️", label: "にわか雪（弱い）" },
    86: { icon: "🌨️🌨️", label: "にわか雪（強い）" },
    95: { icon: "⛈️", label: "雷雨" },
    96: { icon: "⛈️❄️", label: "雷雨（弱いひょう）" },
    99: { icon: "⛈️❄️❄️", label: "雷雨（強いひょう）" },
  };

  return map[code] ?? { icon: "❓", label: "不明" };
}
export default mapWeatherCode;
