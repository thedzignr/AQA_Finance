import { useState, type FormEvent } from "react";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { Brand } from "@/components/shared/Brand";
import { IconWell } from "@/components/shared/IconWell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/data/auth";
import { COMPANY } from "@/lib/company";

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } =
      mode === "signin" ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    // On success the auth listener swaps to the app.
    if (error) setError(error);
  }

  return (
    <div className="flex min-h-dvh items-start justify-center bg-background p-4 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[env(safe-area-inset-bottom)] sm:items-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Brand />
          <p className="text-xs text-muted-foreground">{COMPANY.legalName}</p>
        </div>

        <Card className="shadow-neon">
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-3">
              <IconWell
                icon={mode === "signin" ? LogIn : UserPlus}
                variant="primary"
              />
              <div>
                <h2 className="text-base font-semibold">
                  {mode === "signin" ? "Sign in" : "Create your account"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {mode === "signin"
                    ? "Enter your email and password."
                    : "Set a password for your account."}
                </p>
              </div>
            </div>

            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  minLength={6}
                  required
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="h-11 w-full" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              {mode === "signin" ? "First time here?" : "Already have an account?"}{" "}
              <button
                type="button"
                className="font-medium text-accent hover:underline"
                onClick={() => {
                  setMode(mode === "signin" ? "signup" : "signin");
                  setError(null);
                }}
              >
                {mode === "signin" ? "Create account" : "Sign in"}
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
