import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Dev Office Command Center",
  description: "Центр управления AI Dev Office",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body className="min-h-svh bg-background antialiased">{children}</body>
    </html>
  );
}
