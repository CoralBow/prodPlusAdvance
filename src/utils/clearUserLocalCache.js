export function clearUserLocalCache() {
  const keysToClear = [
    "selectedCity",
    "umbrellaDismissedMap",
    "translationCacheAll",
  ];

  keysToClear.forEach((key) => localStorage.removeItem(key));

  // clear daily quotes
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith("quote_") || key.startsWith("sound_")) {
      localStorage.removeItem(key);
    }
  });
}
