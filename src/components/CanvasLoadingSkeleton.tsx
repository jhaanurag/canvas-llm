"use client";

export function CanvasLoadingSkeleton() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#fff8ed]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0f766e] border-t-transparent" />
        <p className="text-sm font-medium text-[#486069]">
          Loading canvas...
        </p>
      </div>
    </div>
  );
}
