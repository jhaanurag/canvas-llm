"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AuthMode = "sign-in" | "create-account";

type AuthDialogProps = {
  mode: AuthMode;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onModeChange: (mode: AuthMode) => void;
  onSubmit: (payload: { mode: AuthMode; username: string; email: string; identifier: string; password: string }) => Promise<void>;
};

export function AuthDialog({
  mode,
  busy,
  error,
  onClose,
  onModeChange,
  onSubmit,
}: AuthDialogProps) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit({ mode, username, email, identifier, password });
  };

  return (
    <div className="fixed inset-0 z-[2400] flex items-center justify-center bg-[#1b2b33]/28 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-[24px] border border-[#1b2b33]/15 bg-[#fffaf1] p-5 text-[#1b2b33] shadow-[0_24px_80px_rgba(27,43,51,0.22)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0f766e]">
              Save Your Canvas
            </div>
            <h2 className="mt-2 text-xl font-semibold">
              {mode === "sign-in" ? "Sign in to keep your canvas synced" : "Create an account to save your canvas"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#35515b]">
              Your canvas can still run locally, but signing in saves it to your account in Convex.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#1b2b33]/15 text-lg text-[#35515b] transition hover:border-[#0f766e]/40 hover:text-[#0f766e]"
            aria-label="Close sign in dialog"
          >
            ×
          </button>
        </div>

        <div className="mt-4 inline-flex rounded-full border border-[#1b2b33]/10 bg-[#f3e8d2] p-1">
          <button
            type="button"
            onClick={() => {
              setPassword("");
              onModeChange("sign-in");
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${mode === "sign-in" ? "bg-[#0f766e] text-[#f8fff8]" : "text-[#35515b]"}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setPassword("");
              onModeChange("create-account");
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${mode === "create-account" ? "bg-[#0f766e] text-[#f8fff8]" : "text-[#35515b]"}`}
          >
            Create account
          </button>
        </div>

        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
          {mode === "create-account" && (
            <>
              <label className="block text-sm font-medium text-[#1b2b33]">
                Username
                <Input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="canvasbuilder"
                  autoComplete="username"
                  className="mt-1 border-[#1b2b33]/15 bg-white"
                  required
                />
              </label>
              <label className="block text-sm font-medium text-[#1b2b33]">
                Email
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="mt-1 border-[#1b2b33]/15 bg-white"
                  required
                />
              </label>
            </>
          )}

          {mode === "sign-in" && (
            <label className="block text-sm font-medium text-[#1b2b33]">
              Email or username
              <Input
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="you@example.com"
                autoComplete="username"
                className="mt-1 border-[#1b2b33]/15 bg-white"
                required
              />
            </label>
          )}

          <label className="block text-sm font-medium text-[#1b2b33]">
            Password
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              className="mt-1 border-[#1b2b33]/15 bg-white"
              required
            />
          </label>

          {error && (
            <div className="rounded-2xl border border-[#b45309]/18 bg-[#fff3d8] px-3 py-2 text-sm text-[#8a4b00]">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="text-xs leading-5 text-[#5a7079]">
              {mode === "create-account" ? "A username helps you sign back in quickly." : "Use the email or username you signed up with."}
            </div>
            <Button
              type="submit"
              disabled={busy}
              className="rounded-full bg-[#0f766e] px-5 text-white hover:bg-[#0c665f]"
            >
              {busy ? "Working..." : mode === "sign-in" ? "Sign in" : "Create account"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
