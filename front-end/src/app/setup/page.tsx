"use client"

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  Circle, 
  AlertCircle, 
  Loader2, 
  Wrench, 
  Settings,
  Database,
  ArrowRight,
  RefreshCcw
} from "lucide-react";
import { checkTables, type SystemCheckItem } from '@/lib/api';

interface Step {
  name: string;
  status: 'pending' | 'success' | 'failed';
  message: string;
}

export default function SetupPage() {
  const [isInstalling, setIsInstalling] = useState(false);
  const [installStatus, setInstallStatus] = useState<'idle' | 'installing' | 'success' | 'error'>('idle');
  const [steps, setSteps] = useState<Step[]>([]);
  const [errorHeader, setErrorHeader] = useState("");
  const [checks, setChecks] = useState<SystemCheckItem[]>([]);
  const [isChecking, setIsChecking] = useState(true);
  const [checkMessage, setCheckMessage] = useState("");
  const router = useRouter();

  const API_URL = "http://localhost/rapair-management/server/install";

  const runChecks = async () => {
    setIsChecking(true);
    setCheckMessage("");

    try {
      const result = await checkTables();
      setChecks(result.checks || []);
      setCheckMessage(result.message || "");
    } catch (error) {
      setChecks([]);
      setCheckMessage((error as Error).message || "Unable to verify system checks.");
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    void runChecks();
  }, []);

  const startInstallation = async () => {
    setIsInstalling(true);
    setInstallStatus('installing');
    setSteps([]);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
      });
      const data = await response.json();

      if (data && data.status === 'success') {
        setSteps(data.steps || []);
        setInstallStatus('success');
        await runChecks();
      } else {
        setSteps(data?.steps || []);
        setInstallStatus('error');
        setErrorHeader(data?.message || "An unexpected error occurred during installation.");
        await runChecks();
      }
    } catch (error) {
      setInstallStatus('error');
      setErrorHeader("Could not connect to the backend server. Ensure XAMPP is running.");
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="max-w-xl w-full shadow-lg border-t-4 border-t-primary">
        <CardHeader className="text-center pb-2">
          <div className="w-16 h-16 bg-blue-50 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Settings className="w-8 h-8 animate-spin-slow" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">System Setup</CardTitle>
          <CardDescription className="text-base">
            Initialize your Repair Management Backend
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6 pt-4">
          {installStatus === 'idle' && (
            <div className="text-center space-y-4 py-4">
              <p className="text-muted-foreground">
                This process will automatically create the database, tables, and set up the initial configuration for your workshop management system.
              </p>
              <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 flex items-start gap-3 text-left">
                <Database className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-primary">Pre-installation Check</p>
                  <p className="text-slate-600">Ensure MySQL is running in your XAMPP Control Panel before proceeding.</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">System Availability Check</p>
                <p className="text-xs text-slate-500">Verify each required table before opening the dashboard.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={runChecks}
                disabled={isChecking}
              >
                {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                Verify Checks
              </Button>
            </div>

            {checkMessage && (
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {checkMessage}
              </div>
            )}

            <div className="space-y-2">
              {isChecking && checks.length === 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking database availability...
                </div>
              )}

              {!isChecking && checks.length === 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                  No check results available yet.
                </div>
              )}

              {checks.map((check) => (
                <div
                  key={check.name}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-3"
                >
                  <div className="flex items-start gap-3">
                    {check.available ? (
                      <CheckCircle2 className="mt-0.5 w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="mt-0.5 w-4 h-4 text-red-600" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-slate-900">{check.name}</p>
                      <p className="text-xs text-slate-500">{check.message}</p>
                    </div>
                  </div>
                  <Badge
                    variant={check.available ? "default" : "destructive"}
                    className={check.available ? "bg-green-600 hover:bg-green-600" : ""}
                  >
                    {check.available ? "Available" : "Missing"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {(installStatus === 'installing' || installStatus === 'success' || installStatus === 'error') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Installation Logs</h3>
                {installStatus === 'installing' && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
              </div>
              
              <div className="space-y-3">
                {steps.length === 0 && installStatus === 'installing' && (
                  <div className="flex items-center gap-3 p-3 rounded-md bg-slate-100 text-slate-500 animate-pulse">
                    <Circle className="w-5 h-5" />
                    <span className="text-sm">Initializing components...</span>
                  </div>
                )}
                
                {steps.map((step, index) => (
                  <div 
                    key={index} 
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                      step.status === 'success' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
                    }`}
                  >
                    {step.status === 'success' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className={`text-sm font-bold ${step.status === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                        {step.name}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">{step.message}</p>
                    </div>
                  </div>
                ))}
              </div>

              {installStatus === 'error' && (
                <div className="p-4 bg-destructive/10 text-destructive rounded-lg flex items-center gap-3">
                  <AlertCircle className="w-5 h-5" />
                  <p className="text-sm font-medium">{errorHeader}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-4 pt-2">
          {installStatus === 'idle' && (
            <Button 
              className="w-full h-12 text-lg font-bold gap-2 shadow-md shadow-primary/20" 
              onClick={startInstallation}
            >
              Start Installation
              <ArrowRight className="w-5 h-5" />
            </Button>
          )}

          {installStatus === 'success' && (
            <Button 
              className="w-full h-12 text-lg font-bold bg-green-600 hover:bg-green-700" 
              onClick={() => router.push('/dashboard')}
            >
              Go to Dashboard
            </Button>
          )}

          {installStatus === 'error' && (
            <Button variant="outline" className="w-full h-12" onClick={startInstallation}>
              Retry Installation
            </Button>
          )}
          
          <p className="text-[10px] text-center text-muted-foreground uppercase tracking-tighter">
            Repair Management System v1.0 • Built with Next.js & PHP MVC
          </p>
        </CardFooter>
      </Card>
      
      <style jsx global>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </div>
  );
}
