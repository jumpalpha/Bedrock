"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ClipboardList, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoginChip } from "@/components/login";
import { ArtIcon } from "@/components/art-icon";

export const navLinks = [
  { label: "Chapters", href: "/chapters/" },
  { label: "Arcade", href: "/arcade/" },
  { label: "Unit Tests", href: "/tests/" },
  { label: "Pick a Side", href: "/pick-a-side/" },
  { label: "Survey", href: "/survey/" },
  { label: "Side Quests", href: "/side-quests/" },
  { label: "Glossary", href: "/glossary/" },
];

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => setOpen(false), [pathname]);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5">
      <nav className={`mx-auto flex max-w-7xl items-center justify-between gap-3 rounded-2xl px-3 py-2.5 transition-all duration-300 sm:px-4 ${
        scrolled || open ? "border border-line bg-ink/80 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.6)] backdrop-blur-xl" : "border border-transparent"}`}>
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-emerald via-gold to-amber shadow-[0_0_24px_-4px_rgba(246,196,83,0.7)] transition-transform group-hover:rotate-[-8deg]">
            <ArtIcon slug="realm-1" fallback="🧭" size={30} />
          </span>
          <span className="font-display text-[19px] font-extrabold leading-none tracking-tight">Bedrock</span>
        </Link>
        <div className="hidden items-center gap-0.5 xl:flex">
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} className={`relative rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${isActive(l.href) ? "text-fg" : "text-muted hover:text-fg"}`}>
              {l.label}
              {isActive(l.href) && <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-gold to-amber" />}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <LoginChip />
          <Link href="/quest/" className="hidden items-center gap-1.5 rounded-xl bg-gold px-3.5 py-2 text-sm font-bold text-[#10140e] shadow-[0_6px_24px_-8px_rgba(246,196,83,0.9)] transition hover:brightness-110 sm:flex">
            <ClipboardList className="size-4" /> My Quest
          </Link>
          <button onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open} className="grid size-9 place-items-center rounded-xl text-fg transition hover:bg-white/5 xl:hidden">
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>
      {open && (
        <div className="glass mx-auto mt-2 max-w-7xl animate-rise rounded-2xl bg-ink/90 p-2 xl:hidden">
          {[{ label: "World Map", href: "/" }, ...navLinks, { label: "My Quest", href: "/quest/" }].map((l) => (
            <Link key={l.href} href={l.href} className={`block rounded-xl px-4 py-3 font-semibold hover:bg-white/5 ${isActive(l.href) ? "text-fg" : "text-muted"}`}>{l.label}</Link>
          ))}
        </div>
      )}
    </header>
  );
}
