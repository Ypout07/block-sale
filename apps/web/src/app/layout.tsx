import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "XRPL Ticketing Protocol",
  description: "Closed-loop ticketing on XRPL for group buys, claims, and returns."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
