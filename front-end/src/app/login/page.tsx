"use client"

import { startUserSession } from "@/lib/session";
import { homeRouteForUser } from "@/lib/home-route";
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, ArrowRight, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      subtitle="Sign in with your work email to continue."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          New here?{' '}
          <Link href="/register" className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </p>
      }
    >
          {error && (
            <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="name@workshop.com"
                  className="h-12 pl-10 rounded-xl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="h-12 pl-10 pr-11 rounded-xl"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="h-12 w-full rounded-xl text-base font-semibold shadow-md shadow-primary/20"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>

    </AuthShell>
  );
}
