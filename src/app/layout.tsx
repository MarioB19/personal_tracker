import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/lib/hooks/useAuth";

// Fuentes alojadas en el repo (OFL): no dependen de red al compilar.
const geist = localFont({
  src: "./fonts/Geist-Variable.woff2",
  variable: "--font-geist",
  weight: "100 900",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

const sora = localFont({
  src: "./fonts/Sora-Variable-latin.woff2",
  variable: "--font-sora",
  weight: "100 800",
  display: "swap",
});

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

export const viewport: Viewport = {
  themeColor: "#060609",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      data-scroll-behavior="smooth"
      className={`dark ${geist.variable} ${geistMono.variable} ${sora.variable}`}
    >
      <body className="font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
