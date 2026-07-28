import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIL303m — Luyện nhanh 50 câu",
  description:
    "Website luyện 50 câu AIL303m mỗi lượt, chấm điểm và giải thích đáp án ngay.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
