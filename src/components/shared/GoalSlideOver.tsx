"use client";

import { useEffect, useState } from "react";
import {
  Goal,
  GoalType,
  GoalHorizon,
  GoalPeriod,
  GoalStatus,
  LifeArea,
} from "@/lib/types";
import { X, Save, Target, AlignLeft, CalendarDays, Trophy } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { cn } from "@/lib/utils";

const GOAL_TYPES: GoalType[] = ["RESULTADO", "PROCESO", "HABITO", "PROYECTO", "MANTENIMIENTO"];
const HORIZONS: GoalHorizon[] = ["VIDA", "LARGO_PLAZO", "MEDIANO_PLAZO", "CORTO_PLAZO"];
const PERIODS: GoalPeriod[] = ["ANNUAL", "QUARTERLY", "MONTHLY", "WEEKLY"];
const STATUSES: GoalStatus[] = ["DRAFT", "ACTIVE", "IN_PROGRESS", "AT_RISK", "COMPLETED", "CANCELLED"];
const LIFE_AREAS: LifeArea[] = ["SALUD", "DINERO", "CARRERA", "FAMILIA", "RELACIONES", "APRENDIZAJE", "PROPOSITO", "DIVERSION"];

interface GoalSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  initial?: Partial<Goal>;
  goals: Goal[]; // Para selección de meta padre
  onSave: (data: Partial<Goal>) => void;
}

export function GoalSlideOver({
  isOpen,
  onClose,
  initial,
  goals,
  onSave,
}: GoalSlideOverProps) {
  const [isRendered, setIsRendered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Campos del formulario
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<GoalType>("RESULTADO");
  const [horizon, setHorizon] = useState<GoalHorizon>("CORTO_PLAZO");
  const [period, setPeriod] = useState<GoalPeriod>("MONTHLY");
  const [parentGoalId, setParentGoalId] = useState("");
  const [lifeArea, setLifeArea] = useState<LifeArea>("CARRERA");
  const [successIndicator, setSuccessIndicator] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [status, setStatus] = useState<GoalStatus>("ACTIVE");
  const [progress, setProgress] = useState(0);
  const [notes, setNotes] = useState("");

  const [year, setYear] = useState<number | undefined>(undefined);
  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4 | undefined>(undefined);
  const [month, setMonth] = useState<number | undefined>(undefined);

  // Inicializar forma
  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setTimeout(() => setIsVisible(true), 10);
      
      setName(initial?.name || "");
      setDescription(initial?.description || "");
      setType(initial?.type || "RESULTADO");
      setHorizon(initial?.horizon || "CORTO_PLAZO");
      setPeriod(initial?.period || "MONTHLY");
      setParentGoalId(initial?.parentGoalId || "");
      setLifeArea(initial?.lifeArea || "CARRERA");
      setSuccessIndicator(initial?.successIndicator || "");
      setTargetDate(
        initial?.targetDate
          ? initial.targetDate.toDate().toISOString().split("T")[0]
          : ""
      );
      setStatus(initial?.status || "ACTIVE");
      setProgress(initial?.progress || 0);
      setNotes(initial?.notes || "");
      setYear(initial?.year);
      setQuarter(initial?.quarter);
      setMonth(initial?.month);
    } else {
      setIsVisible(false);
      setTimeout(() => setIsRendered(false), 300); // Wait for transition
    }
  }, [isOpen, initial]);

  if (!isRendered) return null;

  return (
    <>
      {/* Overlay Backdrop */}
      <div 
        className={cn(
          "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          isVisible ? "opacity-100" : "opacity-0"
        )} 
        onClick={onClose}
      />
      
      {/* Panel Flotante Slide-Over */}
      <div 
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#0c0c0e] border-l border-white/10 shadow-2xl transition-transform duration-300 ease-out flex flex-col",
          isVisible ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Cabecera de SlideOver */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-5 bg-[#0c0c0e]/80 backdrop-blur-xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/10 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight leading-none">
                {initial?.id ? "Editar Meta" : "Nueva Meta"}
              </h2>
              {year && (
                <p className="text-[11px] text-zinc-500 font-medium mt-1 uppercase tracking-wider">
                  Roadmap {year} 
                  {quarter ? ` · Q${quarter}` : ""} 
                  {month ? ` · Mes ${month}` : ""}
                </p>
              )}
            </div>
          </div>
          
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido desplazable */}
        <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide space-y-8">
          
          {/* Nombre y Descripción */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2 flex items-center gap-2">
                <Target className="w-3.5 h-3.5" /> Título de la meta
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="¿Qué te propones lograr?"
                className="w-full bg-transparent border-b border-white/10 text-xl font-bold py-2 text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                autoFocus
              />
            </div>
            
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-1.5 flex items-center gap-1.5">
                <AlignLeft className="w-3 h-3" /> Descripción
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Describe el propósito y detalles clave..."
                className="w-full bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3 text-sm text-zinc-300 placeholder:text-zinc-600 resize-none focus:outline-none focus:border-white/10 focus:bg-white/[0.04] transition-all"
              />
            </div>
          </div>

          <hr className="border-white/5" />

          {/* Configuración Estratégica */}
          <div className="space-y-4">
             <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4">Configuración Estratégica</h3>
             
             <div className="grid grid-cols-2 gap-3">
               <div>
                  <label className="text-[10px] font-semibold tracking-wider text-zinc-500 mb-1.5 block">NIVEL (HORIZONTE)</label>
                  <select
                    value={horizon}
                    onChange={(e) => setHorizon(e.target.value as GoalHorizon)}
                    className="w-full bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2.5 text-xs text-zinc-300 focus:outline-none focus:border-amber-500/50 appearance-none"
                  >
                    {HORIZONS.map((h) => (
                      <option key={h} value={h} className="bg-zinc-900">{h.replace("_", " ")}</option>
                    ))}
                  </select>
               </div>
               
               <div>
                  <label className="text-[10px] font-semibold tracking-wider text-zinc-500 mb-1.5 block">TIPO</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as GoalType)}
                    className="w-full bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2.5 text-xs text-zinc-300 focus:outline-none focus:border-amber-500/50 appearance-none"
                  >
                    {GOAL_TYPES.map((t) => (
                      <option key={t} value={t} className="bg-zinc-900">{t}</option>
                    ))}
                  </select>
               </div>
               
               <div>
                  <label className="text-[10px] font-semibold tracking-wider text-zinc-500 mb-1.5 block">TIEMPO (PERIODO)</label>
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value as GoalPeriod)}
                    className="w-full bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2.5 text-xs text-zinc-300 focus:outline-none focus:border-amber-500/50 appearance-none"
                  >
                    {PERIODS.map((p) => (
                      <option key={p} value={p} className="bg-zinc-900">{p}</option>
                    ))}
                  </select>
               </div>
               
               <div>
                  <label className="text-[10px] font-semibold tracking-wider text-zinc-500 mb-1.5 block">ÁREA DE VIDA</label>
                  <select
                    value={lifeArea}
                    onChange={(e) => setLifeArea(e.target.value as LifeArea)}
                    className="w-full bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2.5 text-xs text-zinc-300 focus:outline-none focus:border-amber-500/50 appearance-none"
                  >
                    {LIFE_AREAS.map((a) => (
                      <option key={a} value={a} className="bg-zinc-900">{a}</option>
                    ))}
                  </select>
               </div>
             </div>
          </div>
          
          <hr className="border-white/5" />

          {/* Relaciones */}
          <div className="space-y-4">
             <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4">Relaciones Estratégicas</h3>
             
             {goals.length > 0 && (
               <div>
                 <label className="text-[10px] font-semibold tracking-wider text-zinc-500 mb-1.5 block">META PADRE (SUB-META)</label>
                 <select
                   value={parentGoalId}
                   onChange={(e) => setParentGoalId(e.target.value)}
                   className="w-full bg-white/[0.02] border border-white/5 rounded-lg px-3 py-3 text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50 appearance-none"
                 >
                   <option value="" className="bg-zinc-900 text-zinc-500">No es sub-meta</option>
                   {goals.filter(g => g.id !== initial?.id).map((g) => (
                     <option key={g.id} value={g.id} className="bg-zinc-900 text-white">{g.name}</option>
                   ))}
                 </select>
               </div>
             )}
          </div>

          <hr className="border-white/5" />

          {/* Ejecución y Medición */}
          <div className="space-y-4">
             <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4 whitespace-nowrap">Ejecución y Medición</h3>
             
             <div>
               <label className="text-[10px] font-semibold tracking-wider text-zinc-500 mb-1.5 block">¿CÓMO MEDIRÁS EL ÉXITO?</label>
               <input
                 value={successIndicator}
                 onChange={(e) => setSuccessIndicator(e.target.value)}
                 placeholder="Ej. Ingresar $500 extras, Correr 10km"
                 className="w-full bg-white/[0.02] border border-white/5 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-white/10"
               />
             </div>
             
             <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1.5 flex-1">
                     <label className="text-[10px] font-semibold tracking-wider text-zinc-500 block flex items-center gap-1.5">
                       <CalendarDays className="w-3 h-3" /> FECHA OBJETIVO
                     </label>
                     <input
                       type="date"
                       value={targetDate}
                       onChange={(e) => setTargetDate(e.target.value)}
                       className="w-full bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50 block"
                       style={{ colorScheme: "dark" }}
                     />
                     <div className="flex gap-1.5 mt-1">
                        <button onClick={() => {
                            const d = new Date();
                            const qEndMonth = Math.floor(d.getMonth() / 3) * 3 + 2;
                            d.setMonth(qEndMonth + 1, 0);
                            setTargetDate(d.toISOString().split("T")[0]);
                        }} className="px-2 py-1 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded text-[9px] transition-colors border border-white/5">Fin Q actual</button>
                        <button onClick={() => {
                            const d = new Date();
                            d.setFullYear(d.getFullYear(), 11, 31);
                            setTargetDate(d.toISOString().split("T")[0]);
                        }} className="px-2 py-1 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded text-[9px] transition-colors border border-white/5">Fin Año</button>
                     </div>
                 </div>
               
               <div>
                 <label className="text-[10px] font-semibold tracking-wider text-zinc-500 mb-1.5 block">ESTADO</label>
                 <select
                   value={status}
                   onChange={(e) => {
                      const val = e.target.value as GoalStatus;
                      setStatus(val);
                      if (val === "COMPLETED") setProgress(100);
                   }}
                   className="w-full bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50 appearance-none font-medium"
                 >
                   {STATUSES.map((s) => (
                     <option key={s} value={s} className="bg-zinc-900">{s.replace("_", " ")}</option>
                   ))}
                 </select>
               </div>
             </div>

             {/* Progress slider */}
             <div className="bg-black/20 border border-white/5 rounded-xl p-4 mt-2 shadow-inner">
               <div className="flex justify-between items-center mb-3">
                 <label className="text-[10px] font-semibold tracking-wider text-zinc-400 block">PROGRESO ACTUAL</label>
                 <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">{progress}%</span>
               </div>
               <input
                 type="range"
                 min={0}
                 max={100}
                 value={progress}
                 onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setProgress(val);
                    if (val === 100) setStatus("COMPLETED");
                    else if (val > 0 && status === "ACTIVE") setStatus("IN_PROGRESS");
                 }}
                 className="w-full accent-amber-500 hover:accent-amber-400 ease-in-out transition-all"
               />
             </div>
             
             <div>
               <label className="text-[10px] font-semibold tracking-wider text-zinc-500 mb-1.5 block mt-4">NOTAS ADICIONALES</label>
               <textarea
                 value={notes}
                 onChange={(e) => setNotes(e.target.value)}
                 rows={3}
                 placeholder="..."
                 className="w-full bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3 text-sm text-zinc-300 placeholder:text-zinc-600 resize-none focus:outline-none focus:border-white/10"
               />
             </div>
          </div>
          
          {/* Espacio para que el boton fijo no tape */}
          <div className="h-20"></div>
        </div>

        {/* Botón Guardar - Fixed bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#0c0c0e] via-[#0c0c0e]/95 to-transparent z-20">
          <button
            onClick={() => {
              onSave({
                name, description, type, horizon, period,
                parentGoalId: parentGoalId || undefined,
                lifeArea, successIndicator,
                targetDate: targetDate ? Timestamp.fromDate(new Date(targetDate)) : Timestamp.now(),
                status, progress, notes, blockers: [],
                year, quarter, month // Save roadmap coordinates
              });
            }}
            disabled={!name.trim()}
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black text-base shadow-[0_0_40px_rgba(245,158,11,0.2)] hover:shadow-[0_0_60px_rgba(245,158,11,0.4)] disabled:opacity-50 disabled:grayscale transition-all duration-300 flex items-center justify-center gap-3 transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Save className="w-5 h-5" />
            {initial?.id ? "Guardar Cambios" : "Trazar Meta"}
          </button>
        </div>

      </div>
    </>
  );
}
