import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Leaf } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: searchSchema,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"signin" | "forgot" | "signup">("signin");

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    navigate({ to: (redirect as any) || "/farms" });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created — signing you in...");
    await supabase.auth.signInWithPassword({ email, password });
    navigate({ to: "/farms" });
  }


  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Reset link sent — check your inbox");
    setMode("signin");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6"
         style={{ backgroundImage: "radial-gradient(circle at 20% 10%, oklch(0.94 0.04 130 / 0.5), transparent 40%), radial-gradient(circle at 80% 90%, oklch(0.85 0.08 60 / 0.3), transparent 50%)" }}>
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="size-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Leaf className="size-5" />
          </div>
          <div className="font-serif text-2xl font-semibold">Farmbook</div>
        </div>
        <Card className="p-8">
          <h1 className="font-serif text-2xl mb-1">
            {mode === "signin" ? "Sign in" : "Reset your password"}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "signin"
              ? "Internal tool — use the credentials your admin gave you."
              : "We'll email you a link to set a new password."}
          </p>
          <form onSubmit={mode === "signin" ? signIn : sendReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" required
                     value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {mode === "signin" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button type="button" onClick={() => setMode("forgot")}
                          className="text-xs text-muted-foreground hover:text-foreground">
                    Forgot?
                  </button>
                </div>
                <Input id="password" type="password" autoComplete="current-password" required
                       value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Please wait..." : mode === "signin" ? "Sign in" : "Send reset link"}
            </Button>
            {mode === "forgot" && (
              <button type="button" onClick={() => setMode("signin")}
                      className="text-xs text-muted-foreground hover:text-foreground w-full text-center">
                Back to sign in
              </button>
            )}
          </form>
        </Card>
      </div>
    </div>
  );
}
