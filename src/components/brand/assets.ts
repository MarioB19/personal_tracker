/**
 * Arte 3D de la marca (renders generados con Higgsfield y optimizados a webp).
 * Cada componente usa su asset solo si está declarado aquí; si falta, vuelve
 * al ícono/gradiente anterior, así que borrar un archivo nunca rompe la UI.
 */
export type SectionKey =
  | "dashboard"
  | "agenda"
  | "misiones"
  | "finanzas"
  | "planificador"
  | "metas"
  | "hoja-de-ruta"
  | "revisiones"
  | "analitica";

type Asset = { src: string; width: number; height: number };

export const BRAND_ASSETS: {
  emblem: Asset | null;
  ambient: Asset | null;
  loginHero: Asset | null;
  sections: Partial<Record<SectionKey, Asset>>;
} = {
  emblem: { src: "/brand/emblem.webp", width: 512, height: 512 },
  ambient: { src: "/brand/ambient.webp", width: 1920, height: 1085 },
  loginHero: { src: "/brand/login-hero.webp", width: 960, height: 960 },
  sections: {
    dashboard: { src: "/brand/sections/dashboard.webp", width: 256, height: 256 },
    agenda: { src: "/brand/sections/agenda.webp", width: 256, height: 256 },
    misiones: { src: "/brand/sections/misiones.webp", width: 256, height: 256 },
    finanzas: { src: "/brand/sections/finanzas.webp", width: 256, height: 256 },
    planificador: { src: "/brand/sections/planificador.webp", width: 256, height: 256 },
    metas: { src: "/brand/sections/metas.webp", width: 256, height: 256 },
    "hoja-de-ruta": { src: "/brand/sections/hoja-de-ruta.webp", width: 256, height: 256 },
    revisiones: { src: "/brand/sections/revisiones.webp", width: 256, height: 256 },
    analitica: { src: "/brand/sections/analitica.webp", width: 256, height: 256 },
  },
};

const SECTION_ROUTES: [prefix: string, key: SectionKey][] = [
  ["/dashboard", "dashboard"],
  ["/agenda", "agenda"],
  ["/misiones", "misiones"],
  ["/finanzas", "finanzas"],
  ["/planificador", "planificador"],
  ["/estrategia/metas", "metas"],
  ["/hoja-de-ruta", "hoja-de-ruta"],
  ["/revisiones", "revisiones"],
  ["/analitica", "analitica"],
];

export function sectionForPath(pathname: string | null): SectionKey | null {
  if (!pathname) return null;
  const match = SECTION_ROUTES.find(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return match ? match[1] : null;
}
