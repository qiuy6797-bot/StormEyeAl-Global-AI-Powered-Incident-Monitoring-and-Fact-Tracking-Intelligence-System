import type { Metadata } from "next";
import { APP_NAME } from "./lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "把全球 AI 事件变成可追踪、可核验、可行动的情报流。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
