"use client"

import React from 'react';
import Link from 'next/link';
import { Wrench, Mail, Lock, User, ShieldCheck, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

export default function RegisterPage() {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Logic will be added later
    window.location.href = '/dashboard';
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
            <CardTitle className="text-2xl">Create Workshop Account</CardTitle>
            <CardDescription>
              Join the professional network of repair centers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullname">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="fullname" 
                    placeholder="John Doe" 
                    className="pl-10"
                    required 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Work Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="name@workshop.com" 
                    className="pl-10"
                    required 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="••••••••"
                    className="pl-10"
                    required 
                  />
                </div>
              </div>
              
              <div className="flex items-start space-x-2 py-2">
                <Checkbox id="terms" required />
                <Label htmlFor="terms" className="text-xs text-muted-foreground leading-tight cursor-pointer">
                  I agree to the <Link href="#" className="text-primary hover:underline">Terms of Service</Link> and <Link href="#" className="text-primary hover:underline">Privacy Policy</Link>.
                </Label>
              </div>

              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 py-6 text-lg rounded-xl font-bold mt-2">
                Get Started
                <ShieldCheck className="w-5 h-5 ml-2" />
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 border-t bg-muted/30 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="text-primary hover:underline font-bold">
                Log in here
              </Link>
            </p>
          </CardFooter>
        </Card>
        
        <p className="text-center text-xs text-muted-foreground">
          Protected by workshop-grade security.
        </p>
      </div>
    </div>
  );
}
