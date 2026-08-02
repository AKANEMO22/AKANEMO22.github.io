import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://akanemo22.github.io"),
  title: "ADY Study Lab — Luyện 4 đề ADY201m",
  description:
    "Học và kiểm tra 4 đề ADY201m bằng 200 infographic, luồng suy luận, bản đồ đáp án, bản dịch tiếng Việt và ảnh đề gốc.",
  openGraph: {
    title: "ADY Study Lab — Luyện 4 đề ADY201m",
    description:
      "Học và kiểm tra 4 đề ADY201m bằng 200 infographic, luồng suy luận, bản đồ đáp án, bản dịch tiếng Việt và ảnh đề gốc.",
    type: "website",
    images: [{ url: "/og.png", width: 1712, height: 907, alt: "Study Lab" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ADY Study Lab — Luyện 4 đề ADY201m",
    description:
      "Học và kiểm tra 4 đề ADY201m bằng 200 infographic, luồng suy luận, bản đồ đáp án, bản dịch tiếng Việt và ảnh đề gốc.",
    images: ["/og.png"],
  },
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
