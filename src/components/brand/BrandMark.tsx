import Image from "next/image";
import { Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { BRAND_ASSETS } from "./assets";

/** Emblema 3D de LifeTracker; si no hay render, usa el ícono en gradiente. */
export function BrandMark({
  size = 40,
  className,
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  const emblem = BRAND_ASSETS.emblem;

  if (!emblem) {
    return (
      <span
        aria-hidden="true"
        style={{ width: size, height: size }}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_0_24px_rgba(245,158,11,0.22)]",
          className,
        )}
      >
        <Target className="h-[45%] w-[45%] text-black" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.34) }}
      className={cn("brand-mark", className)}
    >
      <Image
        src={emblem.src}
        width={emblem.width}
        height={emblem.height}
        alt=""
        unoptimized
        loading={priority ? "eager" : undefined}
      />
    </span>
  );
}
