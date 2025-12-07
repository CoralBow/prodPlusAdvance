import { NavLink } from "react-router-dom";
import { useState } from "react";

function Header() {
  const [open, setOpen] = useState(false);

  const linkStyle = ({ isActive }) =>
    isActive
      ? "text-blue-600 font-semibold border-b-2 border-blue-600 pb-1"
      : "text-gray-700 hover:text-blue-500";

  return (
    <header className="bg-white shadow w-full">
      <nav className="flex justify-between items-center px-4 py-3">
        {/* ロゴ */}
        <h1 className="text-2xl font-bold text-blue-600 hover:text-emerald-300">
          Productivity+
        </h1>

        {/* 小さい画面のバーガーボタン */}
        <button
          className="md:hidden text-3xl bg-white"
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? "×" : "≡"}
        </button>

        {/* 大きい画面のメニュー */}
        <ul className="hidden md:flex space-x-6">
          <li>
            <NavLink to="/" className={linkStyle}>
              Home
            </NavLink>
          </li>
          <li>
            <NavLink to="/todo" className={linkStyle}>
              To-Do
            </NavLink>
          </li>
          <li>
            <NavLink to="/calendar" className={linkStyle}>
              Calendar
            </NavLink>
          </li>
          <li>
            <NavLink to="/weather" className={linkStyle}>
              Weather
            </NavLink>
          </li>
        </ul>
      </nav>

      {/* 小さい画面のドロップダウン */}
      {open && (
        <ul className="md:hidden flex flex-col space-y-2 px-4 pb-4">
          <li>
            <NavLink
              to="/"
              className={linkStyle}
              onClick={() => setOpen(false)}
            >
              Home
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/todo"
              className={linkStyle}
              onClick={() => setOpen(false)}
            >
              To-Do
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/calendar"
              className={linkStyle}
              onClick={() => setOpen(false)}
            >
              Calendar
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/weather"
              className={linkStyle}
              onClick={() => setOpen(false)}
            >
              Weather
            </NavLink>
          </li>
        </ul>
      )}
    </header>
  );
}

export default Header;
