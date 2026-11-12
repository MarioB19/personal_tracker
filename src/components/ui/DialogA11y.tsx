"use client";

import { useLayoutEffect, useRef } from "react";
import { useModalA11y } from "@/lib/hooks/useModalA11y";

/**
 * Marcador accesible para modales y paneles existentes. Se coloca como primer
 * hijo del panel (no del fondo oscuro) mientras el modal está montado:
 *
 *   <div className="relative ... panel">
 *     <DialogA11y label="Nueva misión" onClose={() => setShowForm(false)} />
 *     ...
 *
 * Da al panel `role="dialog"` y `aria-modal`, mueve el foco adentro, lo
 * atrapa con Tab, cierra con Escape y devuelve el foco al cerrar. No cambia
 * el estado ni la lógica del modal.
 */
export function DialogA11y({
  onClose,
  label,
}: {
  onClose: () => void;
  label?: string;
}) {
  const markerRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const panel = markerRef.current?.parentElement ?? null;
    containerRef.current = panel;
    if (!panel) return;

    const added: string[] = [];
    const set = (name: string, value: string) => {
      if (!panel.hasAttribute(name)) {
        panel.setAttribute(name, value);
        added.push(name);
      }
    };
    set("role", "dialog");
    set("aria-modal", "true");
    if (label && !panel.hasAttribute("aria-labelledby")) set("aria-label", label);

    return () => {
      for (const name of added) panel.removeAttribute(name);
    };
  }, [label]);

  useModalA11y({ open: true, onClose, containerRef });

  return <span ref={markerRef} hidden />;
}
