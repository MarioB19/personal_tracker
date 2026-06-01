"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth, useUid } from "@/lib/hooks/useAuth";
import { getAll, create, remove } from "@/lib/repositories/firestore";
import { TimeBlock, DayOfWeek, BlockCategory, BlockStatus } from "@/lib/types";
import { db } from "@/lib/firebase/config";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { 
  Calendar, 
  Plus, 
  X, 
  Save, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  LayoutTemplate, 
  CalendarDays,
  Sparkles,
  Flame,
  Award,
  Clock,
  Heart,
  Briefcase,
  Zap,
  Bookmark,
  Activity,
  Smile,
  Copy,
  CalendarCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS: { key: DayOfWeek; label: string; short: string }[] = [
  { key: "MON", label: "Lunes", short: "Lun" },
  { key: "TUE", label: "Martes", short: "Mar" },
  { key: "WED", label: "Miércoles", short: "Mié" },
  { key: "THU", label: "Jueves", short: "Jue" },
  { key: "FRI", label: "Viernes", short: "Vie" },
  { key: "SAT", label: "Sábado", short: "Sáb" },
  { key: "SUN", label: "Domingo", short: "Dom" },
];

const CATEGORIES: BlockCategory[] = ["TRABAJO", "APRENDIZAJE", "SALUD", "PERSONAL", "OCIO"];

const CATEGORY_CONFIG: Record<
  BlockCategory,
  { border: string; bg: string; text: string; label: string; icon: React.ElementType }
> = {
  TRABAJO: {
    border: "border-l-blue-500 hover:border-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20",
    text: "text-blue-400",
    label: "Trabajo",
    icon: Briefcase,
  },
  APRENDIZAJE: {
    border: "border-l-purple-500 hover:border-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20",
    text: "text-purple-400",
    label: "Aprendizaje",
    icon: Zap,
  },
  SALUD: {
    border: "border-l-emerald-500 hover:border-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20",
    text: "text-emerald-400",
    label: "Salud",
    icon: Heart,
  },
  PERSONAL: {
    border: "border-l-amber-500 hover:border-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20",
    text: "text-amber-400",
    label: "Personal",
    icon: Activity,
  },
  OCIO: {
    border: "border-l-pink-500 hover:border-pink-400",
    bg: "bg-pink-500/10 border-pink-500/20 hover:bg-pink-500/20",
    text: "text-pink-400",
    label: "Ocio",
    icon: Smile,
  },
};

const DAY_VALUES: Record<DayOfWeek, number> = { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6, SUN: 7 };

function getISOWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${weekNum.toString().padStart(2, "0")}`;
}

export default function AgendaPage() {
  const { user } = useAuth();
  const uid = useUid();
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [template, setTemplate] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>("MON");

  // Form states
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [category, setCategory] = useState<BlockCategory>("TRABAJO");

  // SlideOver custom transition states
  const [isRendered, setIsRendered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const [view, setView] = useState<"week" | "month" | "template">("week");
  const [currentMonthOffset, setCurrentMonthOffset] = useState(0);
  const [now, setNow] = useState(new Date());

  const [showTemplateMenu, setShowTemplateMenu] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Sync Form Slide-over transitions
  useEffect(() => {
    if (showForm) {
      setIsRendered(true);
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setIsRendered(false), 300);
      return () => clearTimeout(timer);
    }
  }, [showForm]);

  const isBlockCompleted = useCallback((block: TimeBlock) => {
      const currentWeekId = getISOWeek(now);
      if (block.weekId < currentWeekId) return true;
      if (block.weekId > currentWeekId) return false;
      
      const currentDayNum = now.getDay() === 0 ? 7 : now.getDay();
      const blockDayNum = DAY_VALUES[block.day];
      
      if (blockDayNum < currentDayNum) return true;
      if (blockDayNum > currentDayNum) return false;
      
      const currentHourStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      return block.endTime <= currentHourStr;
  }, [now]);

  const currentDate = new Date();
  currentDate.setDate(currentDate.getDate() + currentWeekOffset * 7);
  const weekId = getISOWeek(currentDate);

  const loadData = useCallback(async () => {
    if (!uid) return;
    const b = await getAll<TimeBlock>(uid, "timeBlocks");
    setBlocks(b);
    setLoading(false);
  }, [uid]);

  const loadTemplate = useCallback(async () => {
    if (!uid) return;
    try {
      const docRef = doc(db, "weekly_templates", uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setTemplate(snap.data().slots || []);
      } else {
        setTemplate([]);
      }
    } catch (err) {
      console.error("Error loading weekly template:", err);
    }
  }, [uid]);

  useEffect(() => { 
    if (uid) {
      loadData(); 
      loadTemplate();
    }
  }, [uid, loadData, loadTemplate]);

  const weekBlocks = blocks.filter(b => b.weekId === weekId);

  const handleSave = async () => {
    if (!uid || !title.trim()) return;

    if (view === "template") {
      const newSlot = {
        day: selectedDay,
        startTime,
        endTime,
        title,
        category,
      };
      setTemplate(prev => [...prev, newSlot].sort((a, b) => a.startTime.localeCompare(b.startTime)));
      setShowForm(false);
      setTitle("");
      setStartTime("09:00");
      setEndTime("10:00");
      setCategory("TRABAJO");
      return;
    }

    await create(uid, "timeBlocks", {
      weekId, 
      day: selectedDay, 
      startTime, 
      endTime, 
      title,
      activityId: undefined, 
      projectTag: undefined,
      category, 
      plannedStatus: "PLANNED" as BlockStatus, 
      executedStatus: "PLANNED" as BlockStatus,
      complianceRate: 0, 
      notes: "",
    });
    setShowForm(false);
    setTitle(""); 
    setStartTime("09:00"); 
    setEndTime("10:00"); 
    setCategory("TRABAJO");
    loadData();
  };

  // Guardar semana actual como Plantilla Maestra
  const handleSaveAsTemplate = async () => {
    if (!uid) return;
    if (weekBlocks.length === 0) {
      alert("No hay bloques de tiempo en esta semana para guardar como tu plantilla.");
      return;
    }

    const confirmSave = window.confirm(
      `¿Deseas guardar los ${weekBlocks.length} bloques horarias de la semana activa actual como tu plantilla de rutina semanal maestra?`
    );
    if (!confirmSave) return;

    setLoading(true);
    const slots = weekBlocks.map(b => ({
      day: b.day,
      startTime: b.startTime,
      endTime: b.endTime,
      title: b.title,
      category: b.category,
    }));

    await setDoc(doc(db, "weekly_templates", uid), { slots });
    setTemplate(slots);
    setLoading(false);
    setShowTemplateMenu(false);
    alert("¡Tu rutina semanal ideal ha sido guardada con éxito como plantilla maestra!");
  };

  // Replicar/Aplicar la Plantilla Maestra a la semana actual
  const handleApplyTemplate = async () => {
    if (!uid || template.length === 0) return;

    if (weekBlocks.length > 0) {
      const confirmOverwrite = window.confirm(
        "Ya existen bloques horarias programadas en esta semana. ¿Deseas aplicar la plantilla maestra? (Esto duplicará e insertará los bloques rutina)."
      );
      if (!confirmOverwrite) return;
    }

    setLoading(true);
    await Promise.all(
      template.map(b => create(uid, "timeBlocks", {
        weekId,
        day: b.day as DayOfWeek,
        startTime: b.startTime,
        endTime: b.endTime,
        title: b.title,
        category: b.category as BlockCategory,
        plannedStatus: "PLANNED",
        executedStatus: "PLANNED",
        complianceRate: 0,
        notes: "",
      }))
    );

    await loadData();
    setLoading(false);
    setShowTemplateMenu(false);
    alert("¡Plantilla maestra cargada exitosamente en la semana actual!");
  };

  // Auto-generación en Lote para semanas futuras
  const handleBatchGenerate = async (numWeeks: number) => {
    if (!uid || template.length === 0) return;

    const confirmGen = window.confirm(
      `¿Estás seguro de que deseas auto-generar la rutina maestra de tu plantilla para las siguientes ${numWeeks} semanas en tu agenda?`
    );
    if (!confirmGen) return;

    setLoading(true);
    const baseDate = new Date(currentDate);

    for (let w = 1; w <= numWeeks; w++) {
      const targetDate = new Date(baseDate);
      targetDate.setDate(targetDate.getDate() + w * 7);
      const targetWeekId = getISOWeek(targetDate);

      // Creamos todos los bloques para las semanas subsiguientes
      await Promise.all(
        template.map(b => create(uid, "timeBlocks", {
          weekId: targetWeekId,
          day: b.day as DayOfWeek,
          startTime: b.startTime,
          endTime: b.endTime,
          title: b.title,
          category: b.category as BlockCategory,
          plannedStatus: "PLANNED",
          executedStatus: "PLANNED",
          complianceRate: 0,
          notes: "",
        }))
      );
    }

    await loadData();
    setLoading(false);
    setShowTemplateMenu(false);
    alert(`¡Slots auto-generados exitosamente para las siguientes ${numWeeks} semanas en el calendario!`);
  };

  const handleLoadRoutine = async () => {
    if (!uid) return;
    setLoading(true);
    const baseBlocks: { day: string; startTime: string; endTime: string; title: string; category: string }[] = [];

    // Lunes a Jueves
    ["MON", "TUE", "WED", "THU"].forEach(day => {
      baseBlocks.push({ day, startTime: "05:45", endTime: "08:00", title: day === "WED" ? "Daskalos" : "Gym", category: day === "WED" ? "TRABAJO" : "SALUD" });
      baseBlocks.push({ day, startTime: "08:00", endTime: "17:00", title: "Astra", category: "TRABAJO" });
      baseBlocks.push({ day, startTime: "18:00", endTime: "20:00", title: day === "WED" ? "Red/Daskalos" : "Red", category: "TRABAJO" });
      baseBlocks.push({ day, startTime: "20:00", endTime: "22:00", title: day === "WED" ? "Libre" : "Daskalos", category: day === "WED" ? "OCIO" : "TRABAJO" });
      baseBlocks.push({ day, startTime: "22:00", endTime: "22:15", title: "Leer", category: "APRENDIZAJE" });
      baseBlocks.push({ day, startTime: "22:15", endTime: "22:30", title: "Acomodar", category: "PERSONAL" });
    });

    // Viernes
    baseBlocks.push(
      { day: "FRI", startTime: "06:00", endTime: "07:00", title: "Daskalos", category: "TRABAJO" },
      { day: "FRI", startTime: "07:00", endTime: "09:00", title: "Gym", category: "SALUD" },
      { day: "FRI", startTime: "09:00", endTime: "17:00", title: "Astra", category: "TRABAJO" },
      { day: "FRI", startTime: "18:00", endTime: "19:00", title: "Red", category: "TRABAJO" },
      { day: "FRI", startTime: "19:00", endTime: "22:00", title: "Libre", category: "OCIO" },
      { day: "FRI", startTime: "22:00", endTime: "22:15", title: "Leer", category: "APRENDIZAJE" },
      { day: "FRI", startTime: "22:15", endTime: "22:30", title: "Acomodar", category: "PERSONAL" }
    );

    // Sábado
    baseBlocks.push(
      { day: "SAT", startTime: "07:00", endTime: "09:00", title: "Daskalos", category: "TRABAJO" },
      { day: "SAT", startTime: "09:00", endTime: "11:00", title: "Ingles", category: "APRENDIZAJE" },
      { day: "SAT", startTime: "11:00", endTime: "13:00", title: "Gym", category: "SALUD" },
      { day: "SAT", startTime: "13:00", endTime: "16:00", title: "Tarea", category: "APRENDIZAJE" },
      { day: "SAT", startTime: "16:00", endTime: "18:00", title: "Red", category: "TRABAJO" },
      { day: "SAT", startTime: "18:00", endTime: "22:00", title: "Libre", category: "OCIO" },
      { day: "SAT", startTime: "22:15", endTime: "22:30", title: "Acomodar", category: "PERSONAL" }
    );

    // Domingo
    baseBlocks.push(
      { day: "SUN", startTime: "09:00", endTime: "13:00", title: "Daskalos/Red", category: "TRABAJO" },
      { day: "SUN", startTime: "13:00", endTime: "14:00", title: "Ingles", category: "APRENDIZAJE" },
      { day: "SUN", startTime: "16:00", endTime: "22:00", title: "Libre", category: "OCIO" },
      { day: "SUN", startTime: "22:00", endTime: "22:15", title: "Leer", category: "APRENDIZAJE" },
      { day: "SUN", startTime: "22:15", endTime: "22:30", title: "Acomodar", category: "PERSONAL" }
    );

    for (const b of baseBlocks) {
      await create(uid, "timeBlocks", {
        weekId,
        day: b.day as DayOfWeek,
        startTime: b.startTime,
        endTime: b.endTime,
        title: b.title,
        category: b.category as BlockCategory,
        plannedStatus: "PLANNED",
        executedStatus: "PLANNED",
        complianceRate: 0,
        notes: "",
      });
    }
    loadData();
    alert("¡Rutina base cargada para la semana " + weekId + "!");
  };

  const deleteBlock = async (id: string, index?: number) => {
    if (!uid) return;

    if (view === "template" && typeof index === "number") {
      setTemplate(prev => prev.filter((_, idx) => idx !== index));
      return;
    }

    await remove(uid, "timeBlocks", id);
    loadData();
  };

  const handleImportFromActiveWeek = () => {
    if (weekBlocks.length === 0) {
      alert("No hay bloques en la semana activa para importar.");
      return;
    }
    const confirmImport = window.confirm(
      "¿Deseas importar los bloques de la semana activa a tu rutina ideal en edición? (Esto reemplazará la plantilla en curso actual)"
    );
    if (!confirmImport) return;

    const slots = weekBlocks.map(b => ({
      day: b.day,
      startTime: b.startTime,
      endTime: b.endTime,
      title: b.title,
      category: b.category,
    }));
    setTemplate(slots.sort((a, b) => a.startTime.localeCompare(b.startTime)));
  };

  const handleClearTemplateLocal = () => {
    const confirmClear = window.confirm("¿Estás seguro de que deseas limpiar todo el diseño actual de tu rutina ideal?");
    if (confirmClear) {
      setTemplate([]);
    }
  };

  const handlePersistTemplate = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      await setDoc(doc(db, "weekly_templates", uid), { slots: template });
      alert("¡Rutina Maestra guardada con éxito en Firestore!");
    } catch (error) {
      console.error("Error saving master template:", error);
      alert("Hubo un error al guardar tu rutina maestra.");
    } finally {
      setLoading(false);
    }
  };

  // Month View Logic
  const monthDate = new Date();
  monthDate.setMonth(monthDate.getMonth() + currentMonthOffset);
  monthDate.setDate(1);

  const startDayOfWeek = (monthDate.getDay() + 6) % 7;
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();

  const gridDays: Date[] = [];
  // Pad previous month
  for(let i = 0; i < startDayOfWeek; i++) {
     const d = new Date(monthDate);
     d.setDate(d.getDate() - (startDayOfWeek - i));
     gridDays.push(d);
  }
  // Current month
  for(let i = 1; i <= daysInMonth; i++) {
     const d = new Date(monthDate);
     d.setDate(i);
     gridDays.push(d);
  }
  // Pad next month
  while(gridDays.length % 7 !== 0) {
     const d = new Date(gridDays[gridDays.length - 1]);
     d.setDate(d.getDate() + 1);
     gridDays.push(d);
  }

  const isToday = (d: Date) => {
      const today = new Date();
      return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  }

  const getDayKey = (d: Date): DayOfWeek => {
      const g = d.getDay();
      if(g===1) return "MON";
      if(g===2) return "TUE";
      if(g===3) return "WED";
      if(g===4) return "THU";
      if(g===5) return "FRI";
      if(g===6) return "SAT";
      return "SUN";
  }

  // Compliance rate for the week
  const totalBlocks = weekBlocks.length;
  const completedBlocks = weekBlocks.filter(isBlockCompleted).length;
  const complianceRate = totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0;

  if (loading) return (
    <div className="page-enter space-y-4">
      <div className="h-8 w-48 bg-zinc-900 rounded animate-pulse" />
      <div className="grid grid-cols-7 gap-2">{[...Array(7)].map((_, i) => <div key={i} className="glass-card h-64 animate-pulse" />)}</div>
    </div>
  );

  return (
    <div className="page-enter space-y-6 pb-10">
      
      {/* ── Page Header ─────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <Calendar className="w-5 h-5 text-black" />
            </div>
            Agenda y Horarios
          </h1>
          <p className="text-xs text-zinc-500 mt-1 uppercase tracking-wider font-semibold">
              {view === "week" ? `Ciclo Semanal ${weekId} · Eficiencia: ${complianceRate}%` : view === "month" ? `${monthDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}` : "Sandbox de Rutina Ideal"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Week/Month/Template views controller */}
          <div className="flex bg-zinc-950/40 p-1 rounded-xl border border-white/5 select-none">
             <button 
                  onClick={() => setView("week")}
                  className={cn("px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all duration-200", view === "week" ? "bg-white/10 text-white shadow-[0_0_10px_rgba(255,255,255,0.02)]" : "text-zinc-500 hover:text-zinc-300")}
             >
                  <LayoutTemplate className="w-3.5 h-3.5"/> Semanal
             </button>
             <button 
                  onClick={() => setView("month")}
                  className={cn("px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all duration-200", view === "month" ? "bg-white/10 text-white shadow-[0_0_10px_rgba(255,255,255,0.02)]" : "text-zinc-500 hover:text-zinc-300")}
             >
                  <CalendarDays className="w-3.5 h-3.5"/> Mensual
             </button>
             <button 
                  onClick={() => setView("template")}
                  className={cn("px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all duration-200", view === "template" ? "bg-white/10 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.02)]" : "text-zinc-500 hover:text-zinc-300")}
             >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500"/> Rutina Maestra
             </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Master Template Manager Menu Dropdown */}
            {view === "week" && (
              <div className="relative">
                <button
                  onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                  className="flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 hover:text-amber-300 px-3.5 h-10 rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.05)]"
                >
                  <LayoutTemplate className="w-4 h-4" /> Plantilla Rutina
                </button>
                {showTemplateMenu && (
                  <div className="absolute right-0 mt-2 bg-zinc-950 border border-white/5 rounded-2xl shadow-2xl z-25 py-2 min-w-[220px] animate-in fade-in duration-200">
                    <p className="px-3.5 py-1 text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Gestión de Rutina</p>
                    <button 
                      onClick={handleSaveAsTemplate} 
                      className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-zinc-300 hover:bg-white/5 w-full text-left font-semibold hover:text-white transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5 text-amber-400" /> Guardar como Plantilla
                    </button>
                    {template.length > 0 && (
                      <>
                        <button 
                          onClick={handleApplyTemplate} 
                          className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-zinc-300 hover:bg-white/5 w-full text-left font-semibold hover:text-white transition-colors border-t border-white/[0.03]"
                        >
                          <CalendarCheck className="w-3.5 h-3.5 text-emerald-400" /> Aplicar a esta Semana
                        </button>
                        <div className="border-t border-white/[0.03] my-1" />
                        <p className="px-3.5 py-1 text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Generación en Lote (Futura)</p>
                        {[2, 4, 8, 12].map(num => (
                          <button
                            key={num}
                            onClick={() => handleBatchGenerate(num)}
                            className="flex items-center justify-between px-4 py-2 text-xs text-zinc-400 hover:bg-white/5 w-full hover:text-white transition-colors font-medium"
                          >
                            <span>Generar +{num} Semanas</span>
                            <span className="text-[9px] text-zinc-600 font-mono font-bold font-mono">slots</span>
                          </button>
                        ))}
                      </>
                    )}
                    {template.length === 0 && (
                      <div className="px-3.5 py-2 text-[10px] text-zinc-500 italic border-t border-white/[0.03] leading-relaxed">
                        No has guardado una rutina. Configura tus bloques de esta semana y haz clic en "Guardar como Plantilla".
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {view === "week" && weekBlocks.length === 0 && template.length === 0 && (
              <button
                onClick={handleLoadRoutine}
                className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 border border-white/5 px-3.5 h-10 rounded-xl"
              >
                Cargar Demo
              </button>
            )}
            
            <button onClick={() => view === "week" ? setCurrentWeekOffset(o => o - 1) : setCurrentMonthOffset(o => o - 1)} className="btn-secondary h-10 p-2.5 rounded-xl"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => view === "week" ? setCurrentWeekOffset(0) : setCurrentMonthOffset(0)} className="btn-secondary h-10 px-4 rounded-xl text-xs font-bold">Hoy</button>
            <button onClick={() => view === "week" ? setCurrentWeekOffset(o => o + 1) : setCurrentMonthOffset(o => o + 1)} className="btn-secondary h-10 p-2.5 rounded-xl"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {view === "week" && (
        <>
          {/* Week compliance bar */}
          {totalBlocks > 0 && (
            <div className="glass-card p-5 border border-white/[0.04] bg-[#0c0c0e]/80 shadow-[var(--shadow-md)]">
              <div className="flex items-center justify-between mb-2 select-none">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Eficiencia y Cumplimiento Semanal</span>
                <span className="text-xs text-amber-400 font-black font-mono">{complianceRate}%</span>
              </div>
              <div className="progress-bar-lg bg-zinc-950 border border-white/5">
                <div 
                  className="progress-bar-fill shadow-[0_0_8px_rgba(245,158,11,0.25)] bg-gradient-to-r from-amber-600 via-amber-500 to-orange-400" 
                  style={{ width: `${complianceRate}%` }} 
                />
              </div>
            </div>
          )}

          {/* Weekly grid — scrollable horizontally on small screens */}
          <div className="overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 mt-4 select-none">
            <div className="grid grid-cols-7 gap-3.5 min-w-[950px]">
            {DAYS.map(day => {
              const dayBlocks = weekBlocks.filter(b => b.day === day.key).sort((a, b) => a.startTime.localeCompare(b.startTime));
              const isCurrentDay = currentWeekOffset === 0 && ((new Date()).getDay()===0?"SUN":getDayKey(new Date())) === day.key;
              
              return (
                <div 
                  key={day.key} 
                  className={cn(
                    "glass-card p-3.5 min-h-[420px] flex flex-col border bg-[#0c0c0e]/50 backdrop-blur-xl", 
                    isCurrentDay 
                      ? "border-amber-500/20 bg-amber-500/[0.015] shadow-[0_4px_20px_rgba(245,158,11,0.02)]" 
                      : "border-white/[0.03]"
                  )}
                >
                  <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2.5">
                    <h3 className={cn("text-[10px] font-black uppercase tracking-widest leading-none", isCurrentDay ? "text-amber-400" : "text-zinc-500")}>
                      {day.label}
                    </h3>
                    <button 
                      onClick={() => { setSelectedDay(day.key); setShowForm(true); }} 
                      className="text-zinc-500 hover:text-amber-400 transition-colors p-1 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 active:scale-90"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-2 flex-1 overflow-y-auto pr-0.5 max-h-[500px] scrollbar-thin">
                    {dayBlocks.map(block => {
                      const cfg = CATEGORY_CONFIG[block.category];
                      const CategoryIcon = cfg.icon;
                      return (
                        <div
                          key={block.id}
                          className={cn(
                            "rounded-xl px-3 py-2.5 border-l-2 text-[10px] group relative hover:translate-x-0.5 transition-transform border border-white/[0.03]",
                            cfg.border,
                            cfg.bg,
                            isBlockCompleted(block) && "opacity-40 grayscale"
                          )}
                        >
                          <div className="flex items-center justify-between mb-1 select-none">
                            <span className="text-zinc-500 font-bold tracking-wide font-mono">{block.startTime} - {block.endTime}</span>
                            <button 
                              onClick={() => deleteBlock(block.id)} 
                              className="md:opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 p-0.5 rounded transition-all active:scale-90 border border-transparent hover:border-red-500/20"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <CategoryIcon className={cn("w-3 h-3 shrink-0", cfg.text)} />
                            <p className={cn("font-bold text-zinc-200 text-xs truncate leading-none", isBlockCompleted(block) && "line-through text-zinc-500")}>{block.title}</p>
                          </div>
                        </div>
                      );
                    })}
                    {dayBlocks.length === 0 && (
                        <div className="text-center py-10 border border-dashed border-white/5 rounded-2xl bg-white/[0.01]">
                            <span className="text-[10px] font-semibold text-zinc-600 block">Sin eventos</span>
                        </div>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </>
      )}

      {view === "month" && (
          <div className="glass-card mt-4 overflow-hidden border border-white/[0.04] bg-[#0c0c0e]/80 shadow-[var(--shadow-md)]">
             {/* Monthly Header */}
             <div className="grid grid-cols-7 border-b border-white/10 bg-black/40">
                 {DAYS.map(d => (
                     <div key={d.key} className="py-3 text-center text-[10px] font-black text-zinc-500 uppercase tracking-widest">{d.short}</div>
                 ))}
             </div>
             {/* Monthly Grid */}
             <div className="grid grid-cols-7 auto-rows-[120px] divide-x divide-y divide-white/5 border-l border-t border-white/5">
                 {gridDays.map((d) => {
                      const dateId = d.toISOString().split("T")[0];
                      const isCurrMonth = d.getMonth() === monthDate.getMonth();
                      const dayW = getISOWeek(d);
                      const dayK = getDayKey(d);
                      const blocksForDay = blocks.filter(b => b.weekId === dayW && b.day === dayK).sort((a,b) => a.startTime.localeCompare(b.startTime));
                      
                      return (
                          <div key={dateId} className={cn("p-2 flex flex-col gap-1 overflow-hidden group hover:bg-white/[0.015] transition-colors relative", !isCurrMonth && "opacity-30 bg-black/20", isToday(d) && "bg-amber-500/[0.02]")}>
                              <div className="flex items-center justify-between mb-1.5">
                                  <span className={cn("text-xs font-black font-mono", isToday(d) ? "text-amber-400" : "text-zinc-500")}>{d.getDate()}</span>
                              </div>
                              
                              <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-0.5">
                                  {blocksForDay.map(b => {
                                      const cfg = CATEGORY_CONFIG[b.category];
                                      return (
                                          <div key={b.id} className={cn("text-[9px] px-1.5 py-0.5 rounded truncate border-l border-white/10 font-medium", cfg.bg)}>
                                              <span className="font-bold text-white/95 mr-1 font-mono">{b.startTime}</span>
                                              <span className="text-zinc-200 font-bold">{b.title}</span>
                                          </div>
                                      );
                                  })}
                              </div>
                          </div>
                      );
                  })}
             </div>
          </div>
      )}

      {view === "template" && (
          <div className="space-y-6">
            {/* Sandbox Template HUD actions */}
            <div className="glass-card p-5 border border-white/[0.04] bg-[#0c0c0e]/80 shadow-[var(--shadow-md)] flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.05)]">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white leading-none">Diseño de Rutina Semanal Ideal</h4>
                  <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider font-semibold">
                    Tus cambios se guardarán localmente en el sandbox hasta que guardes de forma definitiva.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleImportFromActiveWeek}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 border border-white/5 px-3 py-2 rounded-xl"
                >
                  <Copy className="w-3.5 h-3.5 text-amber-400" /> Importar Semana Activa
                </button>
                <button
                  onClick={handleClearTemplateLocal}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-red-400/85 hover:text-red-400 transition-colors bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 px-3 py-2 rounded-xl"
                >
                  <X className="w-3.5 h-3.5 text-red-500" /> Limpiar Todo
                </button>
                <button
                  onClick={handlePersistTemplate}
                  className="flex items-center gap-1.5 text-[10px] font-black text-white bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-orange-500 shadow-[0_0_15px_rgba(245,158,11,0.15)] px-4 py-2 rounded-xl transition-all"
                >
                  <Save className="w-3.5 h-3.5" /> Guardar Plantilla
                </button>
              </div>
            </div>

            {/* Sandbox Ideal Week Grid */}
            <div className="overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 select-none">
              <div className="grid grid-cols-7 gap-3.5 min-w-[950px]">
                {DAYS.map(day => {
                  const daySlots = template
                    .filter(b => b.day === day.key)
                    .sort((a, b) => a.startTime.localeCompare(b.startTime));

                  return (
                    <div 
                      key={day.key} 
                      className="glass-card p-3.5 min-h-[420px] flex flex-col border border-white/[0.03] bg-[#0c0c0e]/50 backdrop-blur-xl"
                    >
                      <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2.5">
                        <h3 className="text-[10px] font-black uppercase tracking-widest leading-none text-zinc-500">
                          {day.label}
                        </h3>
                        <button 
                          onClick={() => { setSelectedDay(day.key); setShowForm(true); }} 
                          className="text-zinc-500 hover:text-amber-400 transition-colors p-1 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 active:scale-90"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      
                      <div className="space-y-2 flex-1 overflow-y-auto pr-0.5 max-h-[500px] scrollbar-thin">
                        {daySlots.map((slot, index) => {
                          const cfg = CATEGORY_CONFIG[slot.category as BlockCategory];
                          const CategoryIcon = cfg.icon;
                          const globalIndex = template.findIndex(
                            t => t.day === slot.day && 
                                 t.startTime === slot.startTime && 
                                 t.endTime === slot.endTime && 
                                 t.title === slot.title
                          );

                          return (
                            <div
                              key={index}
                              className={cn(
                                "rounded-xl px-3 py-2.5 border-l-2 text-[10px] group relative hover:translate-x-0.5 transition-transform border border-white/[0.03]",
                                cfg.border,
                                cfg.bg
                              )}
                            >
                              <div className="flex items-center justify-between mb-1 select-none">
                                <span className="text-zinc-500 font-bold tracking-wide font-mono">{slot.startTime} - {slot.endTime}</span>
                                <button 
                                  onClick={() => deleteBlock("", globalIndex)} 
                                  className="md:opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 p-0.5 rounded transition-all active:scale-90 border border-transparent hover:border-red-500/20"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <CategoryIcon className={cn("w-3 h-3 shrink-0", cfg.text)} />
                                <p className="font-bold text-zinc-200 text-xs truncate leading-none">{slot.title}</p>
                              </div>
                            </div>
                          );
                        })}
                        {daySlots.length === 0 && (
                          <div className="text-center py-10 border border-dashed border-white/5 rounded-2xl bg-white/[0.01]">
                            <span className="text-[10px] font-semibold text-zinc-600 block">Sin eventos</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
      )}

      {/* Slide-over panel (Unificados consistentemente con Misiones / Finanzas) */}
      {isRendered && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Overlay Backdrop */}
          <div 
            className={cn(
              "absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300",
              isVisible ? "opacity-100" : "opacity-0"
            )} 
            onClick={() => setShowForm(false)}
          />
          
          {/* Panel Flotante Slide-Over */}
          <div 
            className={cn(
              "relative w-full max-w-md h-full bg-[#0c0c0e] border-l border-white/10 shadow-2xl transition-transform duration-300 ease-out flex flex-col z-10",
              isVisible ? "translate-x-0" : "translate-x-full"
            )}
          >
            {/* Slide-Over Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#0c0c0e]/80 backdrop-blur-xl shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/10 flex items-center justify-center text-amber-400">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight leading-none">Nuevo Bloque Horario</h3>
                  <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider font-semibold">
                    Día: {DAYS.find(d => d.key === selectedDay)?.label}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowForm(false)} 
                className="w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Actividad / Bloque de Rutina</label>
                <input 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder="Ej: Gym, Reunion Astra, Leer"
                  className="w-full px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Hora Inicio</label>
                  <input 
                    type="time" 
                    value={startTime} 
                    onChange={(e) => setStartTime(e.target.value)} 
                    className="w-full px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50 block font-mono" 
                    style={{ colorScheme: "dark" }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Hora Término</label>
                  <input 
                    type="time" 
                    value={endTime} 
                    onChange={(e) => setEndTime(e.target.value)} 
                    className="w-full px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50 block font-mono" 
                    style={{ colorScheme: "dark" }}
                  />
                </div>
              </div>

              {/* Styled category picker buttons consistent with Finanzas */}
              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Categoría del Bloque</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CATEGORIES.map(c => {
                    const cfg = CATEGORY_CONFIG[c];
                    const isSelected = category === c;
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCategory(c)}
                        className={cn(
                          "flex flex-col items-center justify-center py-2.5 rounded-xl border text-[9px] font-black transition-all transform active:scale-95",
                          isSelected
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.1)]"
                            : "bg-black/30 border-white/[0.04] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
                        )}
                      >
                        <Icon className="w-4 h-4 mb-1" />
                        <span className="capitalize">{c.toLowerCase()}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Slide-Over Actions footer */}
            <div className="p-6 border-t border-white/5 bg-[#0c0c0e] flex justify-end gap-3 shrink-0">
              <button 
                onClick={() => setShowForm(false)} 
                className="btn-secondary h-11 px-5 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave} 
                disabled={!title.trim()} 
                className="btn-primary pl-4 pr-5 h-11 disabled:opacity-50 disabled:grayscale transition-all duration-300 flex items-center justify-center gap-1.5 rounded-xl text-xs font-black shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:shadow-[0_0_30px_rgba(245,158,11,0.25)]"
              >
                <Save className="w-4 h-4" />
                Guardar Bloque
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
