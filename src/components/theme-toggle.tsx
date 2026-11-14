"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const flip = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("bedrock_theme", next ? "dark" : "light"); } catch {}
    setDark(next);
  };
  return (
    <button onClick={flip} aria-label={dark ? "Switch to day (light mode)" : "Switch to night (dark mode)"} title={dark ? "Day mode" : "Night mode"}
      className="grid size-10 place-items-center border-[3px] border-black bg-[var(--panel)] text-fg hover:brightness-110">
      {dark ? <Sun className="size-5 text-gold" /> : <Moon className="size-5" />}
    </button>
  );
}
