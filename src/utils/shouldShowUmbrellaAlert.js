import mapWeatherCode from "../data/weather.js";

const outdoorKeywords = [
  "go",
  "ride",
  "visit",
  "travel",
  "walk",
  "hike",
  "walking",
  "hiking",
  "run",
  "jog",
  "jogging",
  "drive",
  "trip",
  "meet",
  "date",
  "пойти",
  "поехать",
  "посетить",
  "поездка",
  "поездку",
  "прогулка",
  "прогулку",
  "поход",
  "гулять",
  "погулять",
  "выйти",
  "сходить",
  "пробежка",
  "пробежку",
  "пробежать",
  "пробегать",
  "встретиться",
  "встреча",
  "встречу",
  "свидание",
  "会う",
  "訪ねる",
  "出かける",
  "お出かけ",
  "お出掛け",
  "行く",
  "歩く",
  "走る",
  "屋外",
  "ランニング",
  "旅行",
  "デート",
  "旅",
  "訪問",
  "遊び",
  "散歩",
  "お散歩",
  "登る",
  "外出",
  "メトロ",
  "バス",
  "地下鉄",
  "出社",
  "お参り",
];

export function shouldShowUmbrellaAlert(tasks, todayWeather) {
  if (!todayWeather || !Array.isArray(tasks)) return false;

  const rainyCodes = [
    48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85,
    86, 95, 96, 99,
  ];

  const hasOutdoorTask = tasks.some((t) =>
    outdoorKeywords.some(
      (kw) =>
        (t.title || "").toLowerCase().includes(kw) ||
        (t.description || "").toLowerCase().includes(kw)
    )
  );

  const isRainy = rainyCodes.includes(todayWeather.code);

  return hasOutdoorTask && isRainy;
}

export function getWeatherLabel(todayWeather) {
  if (!todayWeather) return "";

  return mapWeatherCode(todayWeather.code).label;
}
