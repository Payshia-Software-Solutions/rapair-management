"use client"

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { homeRouteForUser } from "@/lib/home-route";

// "/" opens the company's chosen home dashboard (see Company Profile → Home dashboard).
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    void homeRouteForUser().then((href) => router.replace(href));
  }, [router]);

  return null;
}
