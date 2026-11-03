import Navigation from "@/components/shared/Navigation";
import { requireWebSession } from "@/server/auth/web-session";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireWebSession("/dashboard");

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-amber-500/[0.04] rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-orange-600/[0.03] rounded-full blur-[140px]" />
      </div>

      <div className="relative z-10 lg:grid lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-2 lg:p-4">
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
          <div className="mx-auto w-full max-w-[1360px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
