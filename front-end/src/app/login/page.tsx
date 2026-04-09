"use client"

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Wrench, Mail, Lock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('admin@local');
  const [password, setPassword] = useState('admin123');
  const [submitting, setSubmitting] = useState(false);

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
      window.localStorage.setItem('auth_token', data.data.token);

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
      router.replace('/dashboard');
    } catch (err) {
      toast({
        title: 'Login failed',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="p-3 bg-primary rounded-2xl shadow-lg shadow-primary/20">
            <Wrench className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">ServiceBay</h1>
          <p className="text-muted-foreground text-sm">Workshop Management Simplified</p>
        </div>

        <Card className="border-none shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="space-y-1 pb-6 text-center">
            <CardTitle className="text-2xl">Welcome back</CardTitle>
            <CardDescription>
              Enter your credentials to access your workshop
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="name@workshop.com" 
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="#" className="text-xs text-primary hover:underline font-medium">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="password" 
                    type="password" 
                    className="pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                  />
                </div>
              </div>
              <Button type="submit" disabled={submitting} className="w-full bg-primary hover:bg-primary/90 py-6 text-lg rounded-xl font-bold mt-2">
                Sign In
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 border-t bg-muted/30 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link href="/register" className="text-primary hover:underline font-bold">
                Create one now
              </Link>
            </p>
          </CardFooter>
        </Card>
        
        <p className="text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} ServiceBay Systems. All rights reserved.
        </p>
      </div>
    </div>
  );
}
