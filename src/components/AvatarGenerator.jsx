import { useTranslation } from "react-i18next";

export default function AvatarGenerator({ onSelect }) {
   const { t } = useTranslation();
  function newSeed() {
    return Math.random().toString(36).slice(2, 10);
  }

  function handleClick() {
    const seed = newSeed();
    const url = `https://api.dicebear.com/9.x/thumbs/svg?seed=${seed}`;
    onSelect(url);
  }

  return (
    <button
      type="button"
      className="bg-green-600 text-white px-3 py-2 rounded"
      onClick={handleClick}
    >
      {t("settings.generate")}
    </button>
  );
}
