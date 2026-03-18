"use client";

import { Suspense } from "react";
import { InfiniteCanvas } from "./InfiniteCanvas";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CanvasLoadingSkeleton } from "@/components/CanvasLoadingSkeleton";

export function CanvasPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<CanvasLoadingSkeleton />}>
        <InfiniteCanvas />
      </Suspense>
    </ErrorBoundary>
  );
}
