import Image from "next/image";
import { BRAND_ASSETS } from "./assets";

/** Fondo fijo de la app: render 3D ambiental, resplandores y grano. Decorativo. */
export function AppBackdrop() {
  const ambient = BRAND_ASSETS.ambient;
  return (
    <div className="app-backdrop" aria-hidden="true">
      {ambient ? (
        <Image
          className="app-backdrop__art"
          src={ambient.src}
          width={ambient.width}
          height={ambient.height}
          alt=""
          loading="eager"
          sizes="100vw"
        />
      ) : null}
    </div>
  );
}
