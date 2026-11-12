"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { BRAND_ASSETS, sectionForPath } from "./assets";

/** Objeto 3D de la sección actual, o `null` si no hay render para ella. */
export function SectionArt() {
  const pathname = usePathname();
  const key = sectionForPath(pathname);
  const art = key ? BRAND_ASSETS.sections[key] : undefined;
  if (!art) return null;

  return (
    <span className="section-art" aria-hidden="true">
      <Image
        src={art.src}
        width={art.width}
        height={art.height}
        alt=""
        unoptimized
        loading="eager"
      />
    </span>
  );
}

export function hasSectionArt(pathname: string | null): boolean {
  const key = sectionForPath(pathname);
  return Boolean(key && BRAND_ASSETS.sections[key]);
}
