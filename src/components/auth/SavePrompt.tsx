"use client";

import { Button } from "@/components/ui/button";

type SavePromptProps = {
  onDismiss: () => void;
  onOpenAuth: () => void;
};

export function SavePrompt({ onDismiss, onOpenAuth }: SavePromptProps) {
  return (
    <div className="fixed bottom-6 left-1/2 z-[2300] w-[min(92vw,540px)] -translate-x-1/2 rounded-[28px] border border-[#1b2b33]/12 bg-[#fffaf1] p-4 text-[#1b2b33] shadow-[0_22px_70px_rgba(27,43,51,0.2)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0f766e]">
            Save Reminder
          </div>
          <div className="mt-2 text-base font-semibold">
            You’ve been building for a bit. Sign in to save this canvas to your account.
          </div>
          <div className="mt-1 text-sm leading-6 text-[#48606a]">
            Local changes stay on this device for now. Signing in turns on cloud save in Convex.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="rounded-full px-4 text-[#48606a] hover:bg-[#f1e5cf]"
            onClick={onDismiss}
          >
            Later
          </Button>
          <Button
            type="button"
            className="rounded-full bg-[#0f766e] px-4 text-white hover:bg-[#0c665f]"
            onClick={onOpenAuth}
          >
            Sign in to save
          </Button>
        </div>
      </div>
    </div>
  );
}
