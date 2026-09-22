import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const description =
  "A free teleprompter and video recorder that runs entirely in your browser. Paste a script, pick your aspect ratio, hit record. No watermark, no trial, no upload.";

export const metadata: Metadata = {
  title: "Pace — free teleprompter video recorder",
  description,
  applicationName: "Pace",
  openGraph: {
    title: "Pace — free teleprompter video recorder",
    description,
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#08090c",
  width: "device-width",
  initialScale: 1,
  // The stage is a fixed-height app shell; zooming would only break the layout.
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {children}
        {/* Anonymous page-level counts only: no cookies, no identifiers, and
            nothing about the script or the recording. The video itself still
            never leaves the browser. */}
        <Analytics />
      </body>
    </html>
  );
}
