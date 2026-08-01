import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import "./ssg105.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const socialImage = `${protocol}://${host}/og.png`;
  const title = "SSG105 Practice Lab";
  const description =
    "130 câu SSG105 từ Google Slides, chia thành ba lượt 50 câu có đáp án, lời giải và thống kê trọng tâm.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: socialImage, width: 1712, height: 907, alt: "SSG105 Practice Lab" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage],
    },
  };
}

export default function Ssg105Layout({ children }: { children: ReactNode }) {
  return children;
}
