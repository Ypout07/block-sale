import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BlockSale",
  description: "Fair ticketing on XRPL. No scalping, no secondary markets.",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
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
