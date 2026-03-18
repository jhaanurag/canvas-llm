import type { Metadata } from "next";
import {
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
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
        <ClerkProvider>
          <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-end p-4">
            <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3 py-2 shadow-lg shadow-black/5 backdrop-blur-md">
              <Show when="signed-out">
                <SignInButton>
                  <button className="rounded-full border border-black/10 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-black/20 hover:bg-black/5">
                    Sign in
                  </button>
                </SignInButton>
                <SignUpButton>
                  <button className="rounded-full bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700">
                    Sign up
                  </button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <UserButton />
              </Show>
            </div>
          </header>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
