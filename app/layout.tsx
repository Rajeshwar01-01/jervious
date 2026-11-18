import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jervious — your ideas, in motion",
  description: "A thoughtful little AI workspace powered by Claude.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

