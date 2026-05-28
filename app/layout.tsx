import type { Metadata } from "next";
import {
  Dela_Gothic_One,
  Kalam,
  M_PLUS_Rounded_1c,
  Mochiy_Pop_One,
  Reggae_One,
  RocknRoll_One,
} from "next/font/google";
import "./globals.css";

const uiFont = M_PLUS_Rounded_1c({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800", "900"],
  variable: "--font-ui",
  preload: false,
});

const dialogueFont = Kalam({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  variable: "--font-dialogue",
});

const impactFont = Dela_Gothic_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-impact",
});

const actionFont = Reggae_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-action",
  preload: false,
});

const popFont = Mochiy_Pop_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-pop",
  preload: false,
});

const livelyFont = RocknRoll_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-lively",
  preload: false,
});

export const metadata: Metadata = {
  title: "Kokoroe",
  description: "A manga-inspired chat scene portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const fontClasses = [
    uiFont.variable,
    dialogueFont.variable,
    impactFont.variable,
    actionFont.variable,
    popFont.variable,
    livelyFont.variable,
  ].join(" ");

  return (
    <html className={fontClasses} lang="en">
      <body>{children}</body>
    </html>
  );
}
