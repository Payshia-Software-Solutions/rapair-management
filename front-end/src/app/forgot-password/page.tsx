"use client"

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
      const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status !== 'success') {
        throw new Error(data?.message || 'Could not send the reset link. Try again.');
      }
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title={sent ? 'Check your email' : 'Forgot your password?'}
      subtitle={
        sent
          ? 'If an account exists for that address, a reset link is on its way.'
          : "Enter the email you use for BizzFlow and we'll send you a link to set a new password."
      }
      footer={
        <p className="text-center text-sm">
          <Link href="/login" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </p>
      }
    >
      {sent ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border bg-muted/30 p-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <p className="text-sm text-muted-foreground">
            The link expires in 60 minutes and works once. Check your spam folder if it doesn&apos;t arrive.
          </p>
          <Button variant="outline" className="rounded-xl" onClick={() => { setSent(false); setEmail(''); }}>
            Use a different email
          </Button>
        </div>
      ) : (
        <>
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
            <Button type="submit" disabled={submitting} className="h-12 w-full rounded-xl text-base font-semibold shadow-md shadow-primary/20">
              {submitting ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin" />Sending...</>) : 'Send reset link'}
            </Button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
