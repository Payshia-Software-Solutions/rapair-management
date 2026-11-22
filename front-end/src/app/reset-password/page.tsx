"use client"

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const MIN_LENGTH = 8;

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
      const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status !== 'success') {
        throw new Error(data?.message || 'Could not reset the password. Try again.');
      }
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const missingToken = !token;

  return (
    <AuthShell
      title={done ? 'Password updated' : 'Set a new password'}
      subtitle={
        done
          ? 'You can now sign in with your new password.'
          : `Choose a password with at least ${MIN_LENGTH} characters.`
      }
      footer={
        <p className="text-center text-sm">
          <Link href="/login" className="font-semibold text-primary hover:underline">Back to sign in</Link>
        </p>
      }
    >
      {done ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border bg-muted/30 p-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <Button className="h-12 w-full rounded-xl font-semibold" onClick={() => router.replace('/login')}>
            Go to sign in
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      ) : missingToken ? (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            This link is missing its token. Open the link from your email, or{' '}
            <Link href="/forgot-password" className="font-semibold underline">request a new one</Link>.
          </span>
        </div>
      ) : (
        <>
          {error && (
            <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {error}{' '}
                {error.includes('invalid or has expired') && (
                  <Link href="/forgot-password" className="font-semibold underline">Request a new link</Link>
                )}
              </span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  autoFocus
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
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirm"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="h-12 pl-10 rounded-xl"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={submitting} className="h-12 w-full rounded-xl text-base font-semibold shadow-md shadow-primary/20">
              {submitting ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin" />Saving...</>) : 'Update password'}
            </Button>
          </form>
        </>
      )}
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
