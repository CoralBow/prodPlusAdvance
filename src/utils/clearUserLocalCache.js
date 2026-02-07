export function clearUserLocalCache() {
  const keysToClear = [
    "selectedCity",
    "umbrellaDismissedMap",
    "translationCacheAll",
  ];

  keysToClear.forEach((key) => localStorage.removeItem(key));

  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith("quote_") || key.startsWith("sound_")) {
      localStorage.removeItem(key);
    }
  });
}
