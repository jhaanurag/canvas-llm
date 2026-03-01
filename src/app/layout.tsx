import type { Metadata } from "next";
import { JetBrains_Mono, Sora } from "next/font/google";
import "./globals.css";

const brandSans = Sora({
  variable: "--font-brand-sans",
  subsets: ["latin"],
});

const brandMono = JetBrains_Mono({
  variable: "--font-brand-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Canvas Atlas",
  description: "A visual workspace for branching AI thinking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${brandSans.variable} ${brandMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
