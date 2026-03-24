import type { Metadata } from "next";
import { Manrope, Noto_Sans_JP } from "next/font/google";
import "@/app/globals.css";
import { getCurrentThemePreference } from "@/lib/preferences/queries";

const uiFont = Manrope({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap"
});

const bodyFont = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  weight: ["400", "500", "600", "700"]
});

export const metadata: Metadata = {
  title: "Household Budget",
  description: "スマホ向けの個人用家計簿アプリ"
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeName = await getCurrentThemePreference();

  return (
    <html lang="ja">
      <body className={`${uiFont.variable} ${bodyFont.variable}`} data-theme={themeName}>
        {children}
      </body>
    </html>
  );
}
