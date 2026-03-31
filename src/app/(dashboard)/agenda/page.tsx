"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth, useUid } from "@/lib/hooks/useAuth";
import { getAll, create, update, remove, getFiltered } from "@/lib/repositories/firestore";
import { TimeBlock, DayOfWeek, BlockCategory, BlockStatus } from "@/lib/types";
import { Calendar, Plus, X, Save, Check, ChevronLeft, ChevronRight, LayoutTemplate, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Timestamp } from "firebase/firestore";

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
const CATEGORY_COLORS: Record<BlockCategory, string> = {
  TRABAJO: "border-l-blue-500 bg-blue-500/5",
  APRENDIZAJE: "border-l-purple-500 bg-purple-500/5",
  SALUD: "border-l-emerald-500 bg-emerald-500/5",
  PERSONAL: "border-l-amber-500 bg-amber-500/5",
  OCIO: "border-l-pink-500 bg-pink-500/5",
};

const HOURS = Array.from({ length: 17 }, (_, i) => {
  const h = i + 6;
  return `${h.toString().padStart(2, "0")}:00`;
});

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

  const [loading, setLoading] = useState(true);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>("MON");

  // Form
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [category, setCategory] = useState<BlockCategory>("TRABAJO");

  const [view, setView] = useState<"week" | "month">("week");
  const [currentMonthOffset, setCurrentMonthOffset] = useState(0);

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000); // 1 minute
    return () => clearInterval(timer);
  }, []);

  const DAY_VALUES: Record<DayOfWeek, number> = { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6, SUN: 7 };

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
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const weekBlocks = blocks.filter(b => b.weekId === weekId);

  const handleSave = async () => {
    if (!uid || !title.trim()) return;
    await create(uid, "timeBlocks", {
      weekId, day: selectedDay, startTime, endTime, title,
      activityId: undefined, projectTag: undefined,
      category, plannedStatus: "PLANNED" as BlockStatus, executedStatus: "PLANNED" as BlockStatus,
      complianceRate: 0, notes: "",
    });
    setShowForm(false);
    setTitle(""); setStartTime("09:00"); setEndTime("10:00"); setCategory("TRABAJO");
    loadData();
  };



  const handleLoadRoutine = async () => {
    if (!uid) return;
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

  const deleteBlock = async (id: string) => {
    if (!uid) return;
    await remove(uid, "timeBlocks", id);
    loadData();
  };

  // Month View Logic
  const monthDate = new Date();
  monthDate.setMonth(monthDate.getMonth() + currentMonthOffset);
  monthDate.setDate(1);

  const startDayOfWeek = (monthDate.getDay() + 6) % 7; // Monday = 0
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
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-400" /> Agenda
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
              {view === "week" ? `${weekId} · Cumplimiento: ${complianceRate}%` : `${monthDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`}
          </p>
        </div>
        <div className="flex items-center gap-4">
          
          <div className="flex bg-[#0c0c0e] border border-white/10 rounded-xl p-1">
             <button 
                 onClick={() => setView("week")}
                 className={cn("px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all", view === "week" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300")}
             >
                 <LayoutTemplate className="w-3.5 h-3.5"/> Semanal
             </button>
             <button 
                 onClick={() => setView("month")}
                 className={cn("px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all", view === "month" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300")}
             >
                 <CalendarDays className="w-3.5 h-3.5"/> Mensual
             </button>
          </div>

          <div className="flex items-center gap-2">
            {view === "week" && weekBlocks.length === 0 && (
              <button
                onClick={handleLoadRoutine}
                className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg"
              >
                Cargar Rutina
              </button>
            )}
            <button onClick={() => view === "week" ? setCurrentWeekOffset(o => o - 1) : setCurrentMonthOffset(o => o - 1)} className="btn-secondary p-2"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => view === "week" ? setCurrentWeekOffset(0) : setCurrentMonthOffset(0)} className="btn-secondary px-4 py-2">Hoy</button>
            <button onClick={() => view === "week" ? setCurrentWeekOffset(o => o + 1) : setCurrentMonthOffset(o => o + 1)} className="btn-secondary p-2"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {view === "week" ? (
          <>
          {/* Week compliance bar */}
          {totalBlocks > 0 && (
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-400">Cumplimiento semanal</span>
                <span className="text-xs text-amber-400 font-bold">{complianceRate}%</span>
              </div>
              <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${complianceRate}%` }} /></div>
            </div>
          )}

          {/* Weekly grid — scrollable horizontally on small screens */}
          <div className="overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 mt-4">
            <div className="grid grid-cols-7 gap-3 min-w-[900px]">
            {DAYS.map(day => {
              const dayBlocks = weekBlocks.filter(b => b.day === day.key).sort((a, b) => a.startTime.localeCompare(b.startTime));
              const dKeyDate = new Date(); // To check if 'day' is today would require matching the current week id offset
              // For simplicity, we just mark the current visual day if it's the current week
              const isCurrentDay = currentWeekOffset === 0 && ((new Date()).getDay()===0?"SUN":getDayKey(new Date())) === day.key;
              
              return (
                <div key={day.key} className={cn("glass-card p-3 min-h-[300px]", isCurrentDay && "border-amber-500/30 bg-amber-500/[0.02]")}>
                  <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                    <h3 className={cn("text-xs font-black uppercase tracking-widest", isCurrentDay ? "text-amber-400" : "text-zinc-400")}>{day.label}</h3>
                    <button onClick={() => { setSelectedDay(day.key); setShowForm(true); }} className="text-zinc-500 hover:text-amber-400 transition-colors p-1 bg-white/5 rounded-md hover:bg-white/10">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {dayBlocks.map(block => (
                      <div
                        key={block.id}
                        className={cn(
                          "rounded-lg px-2.5 py-2 border-l-2 text-[10px] group relative hover:translate-x-0.5 transition-transform",
                          CATEGORY_COLORS[block.category],
                          isBlockCompleted(block) && "opacity-50 grayscale"
                        )}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-zinc-500 font-medium tracking-wide">{block.startTime}-{block.endTime}</span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => deleteBlock(block.id)} className="text-zinc-500 hover:text-red-400 bg-black/20 p-0.5 rounded"><X className="w-3 h-3" /></button>
                          </div>
                        </div>
                        <p className={cn("font-bold text-zinc-100 text-xs", isBlockCompleted(block) && "line-through text-zinc-400")}>{block.title}</p>
                      </div>
                    ))}
                    {dayBlocks.length === 0 && (
                        <div className="text-center py-4 border border-dashed border-white/5 rounded-xl">
                            <span className="text-[10px] text-zinc-600 block">Sin eventos</span>
                        </div>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
          </>
      ) : (
          <div className="glass-card mt-4 overflow-hidden">
             {/* Monthly Header */}
             <div className="grid grid-cols-7 border-b border-white/10 bg-black/40">
                 {DAYS.map(d => (
                     <div key={d.key} className="py-3 text-center text-xs font-bold text-zinc-500 uppercase tracking-widest">{d.short}</div>
                 ))}
             </div>
             {/* Monthly Grid */}
             <div className="grid grid-cols-7 auto-rows-[120px]">
                 {gridDays.map((d, i) => {
                     const dateId = d.toISOString().split("T")[0];
                     const isCurrMonth = d.getMonth() === monthDate.getMonth();
                     const dayW = getISOWeek(d);
                     const dayK = getDayKey(d);
                     const blocksForDay = blocks.filter(b => b.weekId === dayW && b.day === dayK).sort((a,b) => a.startTime.localeCompare(b.startTime));
                     
                     return (
                         <div key={dateId} className={cn("border-r border-b border-white/5 p-2 flex flex-col gap-1 overflow-hidden group hover:bg-white/[0.02] transition-colors", !isCurrMonth && "opacity-40 bg-black/20", isToday(d) && "bg-amber-500/5")}>
                             <div className="flex items-center justify-between mb-1">
                                 <span className={cn("text-xs font-black", isToday(d) ? "text-amber-400" : "text-zinc-500")}>{d.getDate()}</span>
                                 <button onClick={() => {
                                     // Quick add for this date. We'd ideally switch to week view, offset to that week, and set selectedDay.
                                     // But for simplicity, we simulate standard creation.
                                     setCategory("TRABAJO");
                                 }} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-white"><Plus className="w-3 h-3"/></button>
                             </div>
                             
                             <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                                 {blocksForDay.map(b => (
                                     <div key={b.id} className={cn("text-[9px] px-1.5 py-0.5 rounded truncate border-l border-white/10", CATEGORY_COLORS[b.category])}>
                                         <span className="font-semibold text-white/90 mr-1">{b.startTime}</span>
                                         <span className="text-white/70">{b.title}</span>
                                     </div>
                                 ))}
                             </div>
                         </div>
                     )
                 })}
             </div>
          </div>
      )}

      {/* Add block modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="glass-card p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Nuevo bloque — {DAYS.find(d => d.key === selectedDay)?.label}</h3>
              <button onClick={() => setShowForm(false)} className="text-zinc-500"><X className="w-4 h-4" /></button>
            </div>
            <div><label className="block text-xs text-zinc-400 mb-1">Actividad</label><input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-100" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs text-zinc-400 mb-1">Inicio</label><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-100" /></div>
              <div><label className="block text-xs text-zinc-400 mb-1">Fin</label><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-100" /></div>
            </div>
            <div><label className="block text-xs text-zinc-400 mb-1">Categoría</label>
              <div className="flex gap-1.5 flex-wrap">
                {CATEGORIES.map(c => (
                  <button key={c} onClick={() => setCategory(c)} className={cn("px-3 py-1.5 rounded-lg text-xs border transition-all", category === c ? "bg-amber-500/15 border-amber-500/30 text-amber-400" : "bg-zinc-900/50 border-zinc-800 text-zinc-500")}>{c}</button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={!title.trim()} className="btn-primary disabled:opacity-50"><Save className="w-3.5 h-3.5 inline mr-1" />Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
