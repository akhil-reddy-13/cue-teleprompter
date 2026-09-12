import type { Metadata, Viewport } from "next";
import "./globals.css";

const description =
  "A free teleprompter and video recorder that runs entirely in your browser. Paste a script, pick your aspect ratio, hit record. No watermark, no trial, no upload.";

export const metadata: Metadata = {
  title: "Cue — free teleprompter video recorder",
  description,
  applicationName: "Cue",
  openGraph: {
    title: "Cue — free teleprompter video recorder",
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
