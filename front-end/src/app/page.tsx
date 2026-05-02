"use client"

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { checkTables } from '@/lib/api';

export default function Home() {
  const router = useRouter();
  const { toast } = useToast();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const runCheck = async () => {
      try {
        const result = await checkTables();
        if (result.status === 'success') {
          toast({
            title: 'All checks completed',
            description: 'Database tables are ready. Redirecting to dashboard.',
          });
          router.replace('/dashboard/overall');
        } else {
          toast({
            title: 'Setup required',
            description: result.message || 'Missing tables detected.',
            variant: 'destructive',
          });
          router.replace('/setup');
        }
      } catch (e) {
        toast({
          title: 'Error',
          description: (e as Error).message,
          variant: 'destructive',
        });
        router.replace('/setup');
      } finally {
        setChecking(false);
      }
    };
    runCheck();
  }, []);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return null;
}