import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kokoroe",
  description: "A manga-inspired chat scene portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
