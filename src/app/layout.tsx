import type { Metadata, Viewport } from "next";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { PwaRegister } from "@/components/x7b/pwa"; // ── wave-x7b ──
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Bedrock — Earth Science", template: "%s · Bedrock" },
  description: "Mr. Dopp's Earth science class as a survival planet: 28 chapters, 9 realms, mining ranks from Dirt Digger to Diamond.",
  // ── wave-x7b ── installable app: manifest, app icons, iPhone home-screen settings
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/app/icon-32.png", sizes: "32x32", type: "image/png" }, { url: "/app/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/app/icon-180.png" },
  appleWebApp: { capable: true, title: "Bedrock", statusBarStyle: "black-translucent" },
  // ── end wave-x7b ──
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#090d0b" };

// Runs before paint so there's no flash. Dark by default, like doppsclass.com; light only if chosen.
const themeBoot = `try{if(localStorage.getItem('bedrock_theme')==='light')document.documentElement.classList.add('light')}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className="grain relative flex min-h-full flex-col overflow-x-hidden">
        <Aurora />
        <Nav />
        <main className="relative z-10 flex-1">{children}</main>
        <Footer />
        <PwaRegister />{/* ── wave-x7b ── */}
      </body>
    </html>
  );
}

function Aurora() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute -left-[20%] -top-[30%] h-[80vh] w-[70vw] animate-drift rounded-full bg-[radial-gradient(closest-side,var(--aurora-1),transparent)] blur-3xl" />
      <div className="absolute -right-[15%] top-[10%] h-[70vh] w-[60vw] animate-drift rounded-full bg-[radial-gradient(closest-side,var(--aurora-2),transparent)] blur-3xl [animation-delay:-8s]" />
      <div className="absolute bottom-[-30%] left-[20%] h-[70vh] w-[70vw] animate-drift rounded-full bg-[radial-gradient(closest-side,var(--aurora-3),transparent)] blur-3xl [animation-delay:-14s]" />
      <div className="absolute inset-0 bg-[linear-gradient(var(--grid)_1px,transparent_1px),linear-gradient(90deg,var(--grid)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
    </div>
  );
}
