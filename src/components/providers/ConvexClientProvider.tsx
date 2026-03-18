"use client";

import { type ReactNode, useMemo } from "react";
import { ConvexProvider } from "convex/react";
import { ConvexReactClient } from "convex/react";

let globalClient: ConvexReactClient | null = null;

function getConvexClient(): ConvexReactClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  if (!globalClient) {
    globalClient = new ConvexReactClient(url);
  }
  return globalClient;
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const convex = useMemo(() => getConvexClient(), []);

  // During build / when NEXT_PUBLIC_CONVEX_URL is not set, render children
  // without the Convex provider. The canvas will fall back to localStorage.
  if (!convex) {
    return <>{children}</>;
  }

  return (
    <ConvexProvider client={convex}>
      {children}
    </ConvexProvider>
  );
}
