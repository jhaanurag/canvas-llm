"use client";

import dynamic from "next/dynamic";
import { CanvasLoadingSkeleton } from "@/components/CanvasLoadingSkeleton";

// Dynamically import the canvas to avoid SSR/prerendering issues with
// browser-only Convex and canvas state hooks.
const ClientCanvas = dynamic(
  () =>
    import("@/components/canvas/CanvasPage").then((mod) => mod.CanvasPage),
  {
    ssr: false,
    loading: () => <CanvasLoadingSkeleton />,
  }
);

export default function Home() {
  return (
    <main className="h-screen w-screen">
      <ClientCanvas />
    </main>
  );
}
