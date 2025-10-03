import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ABM ROI Calculator",
  description:
    "Quantify planning-stage ROI, payback, and incremental value for your ABM programmes.",
  icons: {
    icon: [
      {
        rel: "icon",
        url: "/img/favicon-32x32.webp",
        type: "image/webp",
        sizes: "32x32",
      },
    ],
  },
  openGraph: {
    title: "ABM ROI Calculator",
    description:
      "Model baseline vs ABM scenarios and export client-ready economics in minutes.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
