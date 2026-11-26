"use client"

import { startUserSession } from "@/lib/session";
import { homeRouteForUser } from "@/lib/home-route";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, ArrowRight, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';

const REMEMBER_EMAIL_KEY = 'bf_remembered_email';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberEmail, setRememberEmail] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(REMEMBER_EMAIL_KEY);
      if (saved) {
        setEmail(saved);
        setRememberEmail(true);
      }
    } catch {}
  }, []);

  const decodeJwtPayload = (token: string): any | null => {
    try {
      const part = token.split('.')[1];
      return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'success' || !data.data?.token) {
        throw new Error(data?.message || 'Login failed');
      }

      try {
        if (rememberEmail) window.localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
        else window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
      } catch {}

      // Fresh session: drop the previous user's cached permissions/role/location first
      startUserSession(data.data.token);

      // Pick default location based on allowed locations.
      const payload = decodeJwtPayload(data.data.token);
      const allowed = Array.isArray(payload?.allowed_locations) ? payload.allowed_locations : [];
      const defaultId = payload?.location_id ? Number(payload.location_id) : 1;

      if (Array.isArray(allowed) && allowed.length > 1) {
        // Ask user to choose which location context to use now.
        window.localStorage.removeItem('location_id');
        window.localStorage.removeItem('location_name');
        toast({ title: 'Signed in', description: 'Choose your location to continue.' });
        router.replace('/select-location');
        return;
      }

      // Single location: set it immediately.
      if (Array.isArray(allowed) && allowed.length === 1 && allowed[0]?.id) {
        window.localStorage.setItem('location_id', String(allowed[0].id));
        if (allowed[0]?.name) window.localStorage.setItem('location_name', String(allowed[0].name));
      } else {
        window.localStorage.setItem('location_id', String(defaultId));
        const defaultName = payload?.location_name ? String(payload.location_name) : '';
        if (defaultName) window.localStorage.setItem('location_name', defaultName);
      }

      toast({ title: 'Signed in', description: 'Welcome back.' });
      // Stewards (POS without checkout) go straight to the POS
      router.replace(await homeRouteForUser());
    } catch (err) {
      setError((err as Error).message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in with your work email to access your workspace."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          New to BizzFlow?{' '}
          <Link href="/register" className="font-semibold text-primary hover:underline underline-offset-4">
            Create an account
          </Link>
        </p>
      }
    >
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200/80 bg-red-50/90 p-3.5 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Work email
          </Label>
          <div className="group relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@company.com"
              className="h-11 rounded-xl border-border/80 bg-background/70 pl-10 text-sm transition-all hover:border-primary/40 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-primary hover:underline underline-offset-4"
            >
              Forgot password?
            </Link>
          </div>
          <div className="group relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              className="h-11 rounded-xl border-border/80 bg-background/70 pl-10 pr-11 text-sm transition-all hover:border-primary/40 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <label
            htmlFor="remember-email"
            className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none hover:text-foreground"
          >
            <Checkbox
              id="remember-email"
              checked={rememberEmail}
              onCheckedChange={(checked) => setRememberEmail(Boolean(checked))}
              className="rounded-[4px]"
            />
            <span>Remember my email</span>
          </label>
        </div>

        <Button
          type="submit"
          disabled={submitting}
          className="group h-11 w-full rounded-xl bg-gradient-to-r from-primary to-indigo-500 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-70"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              Sign in to workspace
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
