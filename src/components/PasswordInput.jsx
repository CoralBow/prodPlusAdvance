import { useState } from "react";
import { OpenEye, ClosedEye } from "./OpenEye";

export default function PasswordInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  disabled = false,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        maxLength={18}
        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        aria-label={visible ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {visible ? <OpenEye /> : <ClosedEye />}
      </button>
    </div>
  );
}
