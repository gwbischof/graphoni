"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import { Github, Mail, Loader2 } from "lucide-react";
import { Starfield } from "@/components/starfield";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const isDev = process.env.NODE_ENV !== "production";

  async function handleGitHub() {
    setLoading("github");
    await signIn("github", { callbackUrl: "/" });
  }

  async function handleDevLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading("credentials");
    await signIn("credentials", { email: email.trim(), callbackUrl: "/" });
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden flex items-center justify-center">
      <Starfield />

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 28, stiffness: 200 }}
        className="glass-panel rounded-2xl p-8 w-full max-w-sm z-10 space-y-6"
      >
        <div className="text-center space-y-2">
          <h1 className="text-lg font-medium tracking-wide">Graphoni</h1>
          <p className="text-xs text-muted-foreground">
            Sign in to propose edits and moderate the graph.
          </p>
        </div>

        {/* GitHub OAuth */}
        <Button
          onClick={handleGitHub}
          disabled={!!loading}
          className="w-full h-10 gap-2 text-sm"
          variant="outline"
        >
          {loading === "github" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Github className="size-4" />
          )}
          Continue with GitHub
        </Button>

        {/* Dev credentials */}
        {isDev && (
          <>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Dev only
              </span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            <form onSubmit={handleDevLogin} className="space-y-3">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@graphoni.local"
                className="h-9 text-xs bg-white/[0.04] border-white/[0.06]"
              />
              <Button
                type="submit"
                disabled={!email.trim() || !!loading}
                className="w-full h-9 gap-2 text-xs"
                variant="outline"
              >
                {loading === "credentials" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Mail className="size-3.5" />
                )}
                Dev Sign In
              </Button>
            </form>
          </>
        )}

        <p className="text-[10px] text-center text-muted-foreground/60">
          Guests can browse the graph without signing in.
        </p>
      </motion.div>
    </div>
  );
}
