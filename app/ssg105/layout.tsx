import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./ssg105.css";

export const metadata: Metadata = {
  title: "SSG105 Practice Lab · 483 câu",
  description:
    "Kho 483 câu SSG104/SSG105 từ Google Slides, chia thành 10 bộ 50 câu có OCR đáp án, lời giải và thống kê trọng tâm.",
  openGraph: {
    title: "SSG105 Practice Lab · 483 câu",
    description:
      "Kho 483 câu SSG104/SSG105 từ Google Slides, chia thành 10 bộ 50 câu có OCR đáp án, lời giải và thống kê trọng tâm.",
    type: "website",
    images: [{ url: "/og.png", width: 1712, height: 907, alt: "SSG105 Practice Lab" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SSG105 Practice Lab · 483 câu",
    description:
      "Kho 483 câu SSG104/SSG105 từ Google Slides, chia thành 10 bộ 50 câu có OCR đáp án, lời giải và thống kê trọng tâm.",
    images: ["/og.png"],
  },
};

export default function Ssg105Layout({ children }: { children: ReactNode }) {
  return children;
}
