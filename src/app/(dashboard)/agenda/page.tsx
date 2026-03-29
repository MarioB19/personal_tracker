"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth, useUid } from "@/lib/hooks/useAuth";
import { getAll, create, update, remove, getFiltered } from "@/lib/repositories/firestore";
import { TimeBlock, DayOfWeek, BlockCategory, BlockStatus } from "@/lib/types";
import { Calendar, Plus, X, Save, Check, ChevronLeft, ChevronRight } from "lucide-react";
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
          <p className="text-sm text-zinc-500 mt-0.5">{weekId} · Cumplimiento: {complianceRate}%</p>
        </div>
        <div className="flex items-center gap-2">
          {weekBlocks.length === 0 && (
            <button
              onClick={handleLoadRoutine}
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg mr-2"
            >
              Cargar Rutina
            </button>
          )}
          <button onClick={() => setCurrentWeekOffset(o => o - 1)} className="btn-secondary p-2"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => setCurrentWeekOffset(0)} className="btn-secondary px-4 py-2">Hoy</button>
          <button onClick={() => setCurrentWeekOffset(o => o + 1)} className="btn-secondary p-2"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

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
      <div className="overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        <div className="grid grid-cols-7 gap-2 min-w-[700px]">
        {DAYS.map(day => {
          const dayBlocks = weekBlocks.filter(b => b.day === day.key).sort((a, b) => a.startTime.localeCompare(b.startTime));
          return (
            <div key={day.key} className="glass-card p-3 min-h-[200px]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-zinc-300">{day.short}</h3>
                <button onClick={() => { setSelectedDay(day.key); setShowForm(true); }} className="text-zinc-600 hover:text-amber-400 transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-1.5">
                {dayBlocks.map(block => (
                  <div
                    key={block.id}
                    className={cn(
                      "rounded-md px-2 py-1.5 border-l-2 text-[10px] group relative",
                      CATEGORY_COLORS[block.category],
                      isBlockCompleted(block) && "opacity-60"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">{block.startTime}-{block.endTime}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => deleteBlock(block.id)} className="text-zinc-600 hover:text-red-400"><X className="w-3 h-3" /></button>
                      </div>
                    </div>
                    <p className={cn("font-medium text-zinc-200 mt-0.5", isBlockCompleted(block) && "line-through")}>{block.title}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        </div>
      </div>

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
