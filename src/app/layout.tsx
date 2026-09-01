import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/hooks/useAuth";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ),
  title: "LifeTracker · Personal OS",
  description:
    "Plataforma personal para tracking de vida, finanzas, tiempo y objetivos.",
  openGraph: {
    title: "LifeTracker · Personal OS",
    description: "Finanzas, objetivos, agenda y operación de negocio en un solo lugar.",
    images: [{ url: "/og.png", width: 1672, height: 941 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LifeTracker · Personal OS",
    description: "Finanzas, objetivos, agenda y operación de negocio en un solo lugar.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className="font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
