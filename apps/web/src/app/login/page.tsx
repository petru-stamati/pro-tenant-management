"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slash } from "@/components/ui/slash";

const ROLE_HOME: Record<string, string> = { ADMIN: "/pm", OWNER: "/owner", TENANT: "/tenant" };

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const user = await login(email, password);
      router.push(ROLE_HOME[user.role] ?? "/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <div className="relative hidden overflow-hidden bg-sidebar px-12 py-10 text-white md:flex md:w-[55%] md:flex-col md:justify-between">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-[-20px] top-[-60px] bg-primary opacity-90"
          style={{ width: 150, height: 340, transform: "skewX(-16deg)" }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-[110px] bottom-[-80px] bg-white opacity-[.06]"
          style={{ width: 150, height: 340, transform: "skewX(-16deg)" }}
        />

        <div className="relative flex items-center gap-2.5">
          <div className="relative h-[26px] w-[26px] shrink-0 overflow-hidden rounded-[7px] bg-primary">
            <Slash width={5} height={14} className="absolute left-[7px] top-[6px] bg-[#0a0d0b]" />
            <Slash width={5} height={14} className="absolute left-[14px] top-[6px] bg-white" />
          </div>
          <span className="font-heading text-[15px] font-bold">PRO Tenant Management</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="font-heading text-[52px] leading-[0.98] font-semibold tracking-[-1.6px] lg:text-[64px] lg:tracking-[-2px]">
            Every lease, invoice and repair. One place.
          </h1>
          <p className="mt-4 text-[16px] text-[#b5bab2]">
            Property managers, owners, and tenants — one login, everything in sync.
          </p>
        </div>

        <p className="relative font-mono text-[11px] text-[#7a8076]">© {new Date().getFullYear()} PRO Tenant Management</p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 flex items-center justify-center gap-2.5 md:hidden">
            <div className="relative h-6 w-6 overflow-hidden rounded-[6px] bg-primary">
              <Slash width={4} height={12} className="absolute left-[5px] top-[6px] bg-[#0a0d0b]" />
              <Slash width={4} height={12} className="absolute left-[11px] top-[6px] bg-white" />
            </div>
            <span className="font-heading text-sm font-semibold tracking-tight">
              PRO <span className="text-primary">TENANT</span>
            </span>
          </div>

          <h2 className="mb-1 font-heading text-[34px] font-semibold tracking-[-0.9px]">Sign in</h2>
          <p className="mb-6 text-[13.5px] text-muted-foreground">
            Property managers, owners, and tenants all sign in here.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-[11px] focus-visible:ring-primary/12 focus-visible:ring-4"
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={() => toast.info("Contact your property manager to reset your password.")}
                  className="text-[12px] font-medium text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-[11px] focus-visible:ring-primary/12 focus-visible:ring-4"
              />
            </div>
            {error && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={pending}
              className="mt-1 flex h-[50px] w-full items-center justify-center gap-2.5 rounded-[11px] bg-sidebar text-white hover:bg-sidebar/90"
            >
              <Slash height={16} />
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
