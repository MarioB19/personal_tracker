import Navigation from "@/components/shared/Navigation";
import { AppBackdrop } from "@/components/brand/AppBackdrop";
import { requireWebSession } from "@/server/auth/web-session";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireWebSession("/dashboard");

  return (
    <div className="min-h-screen text-white overflow-x-hidden">
      <a href="#contenido" className="skip-link sr-only-focusable">
        Saltar al contenido
      </a>

      <AppBackdrop />

      <div className="relative z-10 lg:grid lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-2 lg:p-4">
        {/* Navegación: barra lateral en escritorio, barra superior + cajón en móvil */}
        <Navigation />

        <main id="contenido" tabIndex={-1} className="min-w-0 pt-16 lg:pt-0">
          <div className="mx-auto w-full max-w-[1360px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
