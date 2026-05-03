"use client"

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export default function Home() {
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    router.replace('/dashboard/overall');
  }, [router]);

  return null;
}