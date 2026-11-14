import type { Metadata, Viewport } from "next";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Bedrock — Earth Science", template: "%s · Bedrock" },
  description: "Mr. Dopp's Earth science class as a blocky survival planet: 28 chapters, 9 realms, mining ranks from Dirt Digger to Diamond.",
  icons: { icon: "/tex/grass_side.svg" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#5fa83a" };

// Runs before paint so there is no flash: saved choice first, otherwise the device setting.
const themeBoot = `try{var t=localStorage.getItem('bedrock_theme');if(t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className="relative flex min-h-full flex-col overflow-x-hidden">
        <Nav />
        <main className="relative z-10 flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
