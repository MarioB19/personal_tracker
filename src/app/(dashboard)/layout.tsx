"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import Navigation from "@/components/shared/Navigation";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { authenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !authenticated) {
      router.replace("/login");
    }
  }, [authenticated, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (!authenticated) return null;

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-amber-500/[0.04] rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-orange-600/[0.03] rounded-full blur-[140px]" />
      </div>

      <div className="relative z-10 lg:grid lg:grid-cols-[296px_minmax(0,1fr)] lg:gap-4 lg:p-4">
        {/* Sidebar / nav */}
        <div className="hidden lg:block">
          <div className="sticky top-4">
            <Navigation />
          </div>
        </div>

        {/* Mobile nav */}
        <div className="lg:hidden">
          <Navigation />
        </div>

        {/* Main content */}
        <main className="min-w-0 pt-16 lg:pt-0">
          <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8 lg:px-10 lg:py-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}