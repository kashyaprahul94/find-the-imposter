import type { Metadata, Viewport } from "next";
import { Audiowide, Press_Start_2P, Rajdhani, VT323 } from "next/font/google";
import { DEFAULT_THEME, THEME_BOOT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-press-start",
  display: "swap",
});

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-vt323",
  display: "swap",
});

const audiowide = Audiowide({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-audiowide",
  display: "swap",
});

const rajdhani = Rajdhani({
  weight: ["500", "700"],
  subsets: ["latin"],
  variable: "--font-rajdhani",
  display: "swap",
});

export const metadata: Metadata = {
  title: "IMPOSTER",
  description: "One of you got a different word. Find them.",
};

export const viewport: Viewport = {
  // Matches the default theme's ground so the browser chrome doesn't clash.
  themeColor: "#150b2b",
  width: "device-width",
  initialScale: 1,
  // The reveal is a full-screen flash; zooming mid-round only gets in the way.
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme={DEFAULT_THEME}
      className={`${pressStart.variable} ${vt323.variable} ${audiowide.variable} ${rajdhani.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Sets the stored theme before first paint. Without it every load
            flashes the default theme first. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="crt min-h-dvh bg-void text-bone antialiased">{children}</body>
    </html>
  );
}
