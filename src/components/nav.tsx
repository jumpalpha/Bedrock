"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoginChip } from "@/components/login";

export const navLinks = [
  { label: "World Map", href: "/" },
  { label: "Chapters", href: "/chapters/" },
  { label: "My Quest", href: "/quest/" },
  { label: "Unit Tests", href: "/tests/" },
  { label: "Pick a Side", href: "/pick-a-side/" },
  { label: "Survey", href: "/survey/" },
  { label: "Side Quests", href: "/side-quests/" },
  { label: "Glossary", href: "/glossary/" },
];

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-50 border-b-[3px] border-black bg-[var(--bg-2)]/95 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="tex tex-grass-side size-9 border-[3px] border-black transition-transform group-hover:-rotate-6" style={{ backgroundSize: "30px 30px" }} />
          <span className="pixel-title text-2xl leading-none">Bedrock</span>
        </Link>
        <div className="hidden items-center gap-0.5 xl:flex">
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href}
              className={`px-2.5 py-2 text-sm font-extrabold transition-colors ${isActive(l.href) ? "text-fg underline decoration-grass decoration-[3px] underline-offset-[6px]" : "text-muted hover:text-fg"}`}>
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <LoginChip />
          <ThemeToggle />
          <button onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}
            className="grid size-10 place-items-center border-[3px] border-black bg-[var(--panel)] xl:hidden">
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>
      {open && (
        <div className="border-t-[3px] border-black bg-[var(--bg-2)] p-2 xl:hidden">
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} className={`block px-4 py-3 font-extrabold ${isActive(l.href) ? "text-fg" : "text-muted"}`}>{l.label}</Link>
          ))}
        </div>
      )}
    </header>
  );
}
