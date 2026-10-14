import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Decision Replay｜投资决策复盘工作台",
  description: "还原当时的判断，留下下一次的进步。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
