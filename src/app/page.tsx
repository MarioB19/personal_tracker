"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { Loader2 } from "lucide-react";

export default function RootPage() {
  const { authenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (authenticated) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    }
  }, [authenticated, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
    </div>
  );
}
