import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Work",
  description: "Проекты запуска, бэклог развития и сроки.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
