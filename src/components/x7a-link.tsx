// ── wave-x7a ── Text Reader, Art Studio and Book Studio are plain HTML pages in public/ (like Dopps Class),
// not Next routes, so links to them must be ordinary <a> tags (a Next <Link> would try to prefetch a route that isn't there).
import Link from "next/link";
import type { ComponentProps } from "react";

export const x7aStaticPages = ["/textreader/", "/art-studio/", "/book-studio/"];
export const isX7aStatic = (href: string) => x7aStaticPages.some((p) => href.startsWith(p));

/** <Link> for Next routes, <a> for the static tool pages. */
export function SiteLink({ href, ...rest }: ComponentProps<"a"> & { href: string }) {
  return isX7aStatic(href) ? <a href={href} {...rest} /> : <Link href={href} {...rest} />;
}

/** The four wave-x7a tools, for the nav, footer and home page. */
export const x7aLinks = [
  { label: "Listen", href: "/listen/", desc: "Every chapter, read aloud" },
  { label: "Text Reader", href: "/textreader/", desc: "Paste text, a file or a link; hear it" },
  { label: "Art Studio", href: "/art-studio/", desc: "Strata, crystals, contour-line art" },
  { label: "Book Studio", href: "/book-studio/", desc: "Write and revise your own book" },
];
// ── end wave-x7a ──
