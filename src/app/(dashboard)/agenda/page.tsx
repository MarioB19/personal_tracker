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
  ChevronLeft, 
  ChevronRight, 
  LayoutTemplate, 
  CalendarDays,
  Sparkles,
  Heart,
  Briefcase,
  Zap,
  Activity,
  Smile,
  Copy,
  CalendarCheck,
  Search
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

function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function getDurationHours(start: string, end: string): number {
  const startMin = parseTimeToMinutes(start);
  let endMin = parseTimeToMinutes(end);
  if (end === "24:00") {
    endMin = 24 * 60;
  }
  return Math.max(0, (endMin - startMin) / 60);
}

function checkOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const sA = parseTimeToMinutes(startA);
  const eA = endA === "24:00" ? 24 * 60 : parseTimeToMinutes(endA);
  const sB = parseTimeToMinutes(startB);
  const eB = endB === "24:00" ? 24 * 60 : parseTimeToMinutes(endB);
  return sA < eB && eA > sB;
}

function getISOWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${weekNum.toString().padStart(2, "0")}`;
}

interface TemplateSlot {
  id?: string;
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  title: string;
  category: BlockCategory;
}

export default function AgendaPage() {
  useAuth();
  const uid = useUid();
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [template, setTemplate] = useState<TemplateSlot[]>([]);

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

  // Modal states for clicking blocks and viewing details
  const [selectedBlockForModal, setSelectedBlockForModal] = useState<TimeBlock | TemplateSlot | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Statistics Modal states
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [statsSearchQuery, setStatsSearchQuery] = useState("");

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

  // --- ANALYTICS AND REAL-TIME COMPUTATIONS ---
  const activeBlocks = view === "template" ? template : weekBlocks;

  const categoryHours: Record<BlockCategory, number> = {
    TRABAJO: 0,
    APRENDIZAJE: 0,
    SALUD: 0,
    PERSONAL: 0,
    OCIO: 0
  };

  const activityHoursMap: Record<string, number> = {};

  activeBlocks.forEach(b => {
    const hrs = getDurationHours(b.startTime, b.endTime);
    if (b.category && categoryHours[b.category as BlockCategory] !== undefined) {
      categoryHours[b.category as BlockCategory] += hrs;
    }
    const titleTrim = b.title ? b.title.trim() : "Sin título";
    activityHoursMap[titleTrim] = (activityHoursMap[titleTrim] || 0) + hrs;
  });

  const totalCalculatedHours = Object.values(categoryHours).reduce((sum, h) => sum + h, 0);

  const sortedActivities = Object.entries(activityHoursMap)
    .map(([title, hours]) => ({ title, hours }))
    .sort((a, b) => b.hours - a.hours);

  const getCurrentActivity = () => {
    const currentDayOfWeekNum = now.getDay();
    const dayKeys: DayOfWeek[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const currentDayKey = dayKeys[currentDayOfWeekNum];
    
    const currentHourStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const todayBlocks = activeBlocks.filter(b => b.day === currentDayKey);
    
    const currentBlock = todayBlocks.find(b => {
      const end = b.endTime === "24:00" ? "24:00" : b.endTime;
      return b.startTime <= currentHourStr && end > currentHourStr;
    });
    
    if (!currentBlock) return null;
    
    const startMin = parseTimeToMinutes(currentBlock.startTime);
    const endMin = currentBlock.endTime === "24:00" ? 24 * 60 : parseTimeToMinutes(currentBlock.endTime);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    
    const totalMin = endMin - startMin;
    const elapsedMin = nowMin - startMin;
    const progressPercent = totalMin > 0 ? Math.min(100, Math.max(0, (elapsedMin / totalMin) * 100)) : 0;
    
    const remainingMin = Math.max(0, endMin - nowMin);
    const remainingStr = remainingMin >= 60 
      ? `${Math.floor(remainingMin / 60)}h ${remainingMin % 60}m` 
      : `${remainingMin}m`;

    return {
      block: currentBlock,
      progress: progressPercent,
      remaining: remainingStr
    };
  };

  const currentInfo = getCurrentActivity();

  const handleSave = async () => {
    if (!uid || !title.trim()) return;

    // Overlap and double-booking validations
    const targetBlocks = view === "template" ? template : weekBlocks;
    const overlapping = targetBlocks.find(b => 
      b.day === selectedDay && 
      checkOverlap(startTime, endTime, b.startTime, b.endTime)
    );

    if (overlapping) {
      alert(`No se puede guardar: Este horario se traslapa con el bloque "${overlapping.title}" (${overlapping.startTime} - ${overlapping.endTime}). Por favor, ajusta tus horas de inicio o término.`);
      return;
    }

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
      const confirmClear = window.confirm(
        `Ya existen ${weekBlocks.length} bloques programados en esta semana. ¿Deseas BORRARLOS todos antes de aplicar tu plantilla de rutina maestra? (Recomendado para evitar duplicidades de horas).`
      );
      if (confirmClear) {
        setLoading(true);
        await Promise.all(weekBlocks.map(b => remove(uid, "timeBlocks", b.id)));
      } else {
        const proceed = window.confirm("¿Deseas aplicar la plantilla encima de los bloques actuales? (Esto podría duplicar tus horas).");
        if (!proceed) return;
      }
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

  const handleDeduplicateWeek = async () => {
    if (!uid) return;
    setLoading(true);
    
    // Find all blocks in the active week
    const weekBlocks = blocks.filter(b => b.weekId === weekId);
    
    // Group and identify duplicates
    const seen = new Set<string>();
    const toDelete: TimeBlock[] = [];
    
    weekBlocks.forEach(b => {
      const key = `${b.day}-${b.startTime}-${b.endTime}-${b.title}`;
      if (seen.has(key)) {
        toDelete.push(b);
      } else {
        seen.add(key);
      }
    });
    
    if (toDelete.length === 0) {
      setLoading(false);
      alert("No se encontraron bloques duplicados en la semana activa.");
      return;
    }
    
    const confirmDelete = window.confirm(
      `Se encontraron ${toDelete.length} bloques duplicados en esta semana. ¿Deseas eliminarlos todos para limpiar tu agenda?`
    );
    if (!confirmDelete) {
      setLoading(false);
      return;
    }
    
    await Promise.all(toDelete.map(b => remove(uid, "timeBlocks", b.id)));
    await loadData();
    setLoading(false);
    alert(`¡Se eliminaron con éxito ${toDelete.length} bloques duplicados!`);
  };

  const handleLoadRoutine = async () => {
    const baseBlocks: { day: DayOfWeek; startTime: string; endTime: string; title: string; category: BlockCategory }[] = [];

    // Lunes, Martes, Miércoles
    ["MON", "TUE", "WED"].forEach(day => {
      baseBlocks.push(
        { day: day as DayOfWeek, startTime: "00:00", endTime: "05:45", title: "Dormir", category: "SALUD" },
        { day: day as DayOfWeek, startTime: "05:45", endTime: "06:00", title: "Acomodar", category: "PERSONAL" },
        { day: day as DayOfWeek, startTime: "06:00", endTime: "07:00", title: "Red + Daskalos", category: "TRABAJO" },
        { day: day as DayOfWeek, startTime: "07:00", endTime: "08:00", title: "Running", category: "SALUD" },
        { day: day as DayOfWeek, startTime: "08:00", endTime: "17:00", title: "Astra", category: "TRABAJO" },
        { day: day as DayOfWeek, startTime: "17:00", endTime: "18:00", title: "Running", category: "SALUD" },
        { day: day as DayOfWeek, startTime: "18:00", endTime: "19:00", title: day === "MON" ? "Reunión Daskalos" : "Daskalos + Red", category: "TRABAJO" },
        { day: day as DayOfWeek, startTime: "19:00", endTime: "19:30", title: "Daskalos + Red", category: "TRABAJO" },
        { day: day as DayOfWeek, startTime: "19:30", endTime: "20:00", title: day === "MON" ? "Descanso" : "Descansar", category: "OCIO" },
        { day: day as DayOfWeek, startTime: "20:00", endTime: "22:00", title: "Deep Work (Emprender)", category: "TRABAJO" },
        { day: day as DayOfWeek, startTime: "22:00", endTime: "22:30", title: "Leer", category: "APRENDIZAJE" },
        { day: day as DayOfWeek, startTime: "22:30", endTime: "24:00", title: "Dormir", category: "SALUD" }
      );
    });

    // Jueves
    baseBlocks.push(
      { day: "THU", startTime: "00:00", endTime: "05:45", title: "Dormir", category: "SALUD" },
      { day: "THU", startTime: "05:45", endTime: "06:00", title: "Acomodar", category: "PERSONAL" },
      { day: "THU", startTime: "06:00", endTime: "08:00", title: "Gym", category: "SALUD" },
      { day: "THU", startTime: "08:00", endTime: "17:00", title: "Astra", category: "TRABAJO" },
      { day: "THU", startTime: "17:00", endTime: "18:00", title: "Descansar", category: "OCIO" },
      { day: "THU", startTime: "18:00", endTime: "19:00", title: "Daskalos + Red", category: "TRABAJO" },
      { day: "THU", startTime: "19:00", endTime: "19:30", title: "Daskalos + Red", category: "TRABAJO" },
      { day: "THU", startTime: "19:30", endTime: "20:00", title: "Descansar", category: "OCIO" },
      { day: "THU", startTime: "20:00", endTime: "22:00", title: "Deep Work (Emprender)", category: "TRABAJO" },
      { day: "THU", startTime: "22:00", endTime: "22:30", title: "Leer", category: "APRENDIZAJE" },
      { day: "THU", startTime: "22:30", endTime: "24:00", title: "Dormir", category: "SALUD" }
    );

    // Viernes
    baseBlocks.push(
      { day: "FRI", startTime: "00:00", endTime: "05:45", title: "Dormir", category: "SALUD" },
      { day: "FRI", startTime: "05:45", endTime: "06:00", title: "Acomodar", category: "PERSONAL" },
      { day: "FRI", startTime: "06:00", endTime: "08:00", title: "Gym", category: "SALUD" },
      { day: "FRI", startTime: "08:00", endTime: "17:00", title: "Astra", category: "TRABAJO" },
      { day: "FRI", startTime: "17:00", endTime: "18:00", title: "Descansar", category: "OCIO" },
      { day: "FRI", startTime: "18:00", endTime: "19:00", title: "Daskalos + Red", category: "TRABAJO" },
      { day: "FRI", startTime: "19:00", endTime: "20:00", title: "Running", category: "SALUD" },
      { day: "FRI", startTime: "20:00", endTime: "22:00", title: "Libre", category: "OCIO" },
      { day: "FRI", startTime: "22:00", endTime: "22:30", title: "Leer", category: "APRENDIZAJE" },
      { day: "FRI", startTime: "22:30", endTime: "24:00", title: "Dormir", category: "SALUD" }
    );

    // Sábado
    baseBlocks.push(
      { day: "SAT", startTime: "00:00", endTime: "07:00", title: "Dormir", category: "SALUD" },
      { day: "SAT", startTime: "07:00", endTime: "09:00", title: "Daskalos", category: "TRABAJO" },
      { day: "SAT", startTime: "09:00", endTime: "11:00", title: "Inglés", category: "APRENDIZAJE" },
      { day: "SAT", startTime: "11:00", endTime: "13:00", title: "Gym", category: "SALUD" },
      { day: "SAT", startTime: "13:00", endTime: "15:00", title: "Tarea + Red", category: "APRENDIZAJE" },
      { day: "SAT", startTime: "15:00", endTime: "16:00", title: "Red", category: "TRABAJO" },
      { day: "SAT", startTime: "16:00", endTime: "20:00", title: "Libre", category: "OCIO" },
      { day: "SAT", startTime: "20:00", endTime: "22:00", title: "Deep Work (Emprender)", category: "TRABAJO" },
      { day: "SAT", startTime: "22:00", endTime: "22:30", title: "Leer", category: "APRENDIZAJE" },
      { day: "SAT", startTime: "22:30", endTime: "24:00", title: "Dormir", category: "SALUD" }
    );

    // Domingo
    baseBlocks.push(
      { day: "SUN", startTime: "00:00", endTime: "07:00", title: "Dormir", category: "SALUD" },
      { day: "SUN", startTime: "07:00", endTime: "08:00", title: "Daskalos", category: "TRABAJO" },
      { day: "SUN", startTime: "08:00", endTime: "10:00", title: "Gym", category: "SALUD" },
      { day: "SUN", startTime: "10:00", endTime: "11:00", title: "Libre", category: "OCIO" },
      { day: "SUN", startTime: "11:00", endTime: "14:00", title: "Deep Work (Emprender)", category: "TRABAJO" },
      { day: "SUN", startTime: "14:00", endTime: "19:00", title: "Libre", category: "OCIO" },
      { day: "SUN", startTime: "19:00", endTime: "20:00", title: "Running", category: "SALUD" },
      { day: "SUN", startTime: "20:00", endTime: "20:30", title: "Descansar", category: "OCIO" },
      { day: "SUN", startTime: "20:30", endTime: "21:30", title: "Misa", category: "PERSONAL" },
      { day: "SUN", startTime: "21:30", endTime: "22:00", title: "Leer", category: "APRENDIZAJE" },
      { day: "SUN", startTime: "22:00", endTime: "24:00", title: "Dormir", category: "SALUD" }
    );

    if (view === "template") {
      const slots = baseBlocks.map(b => ({
        day: b.day,
        startTime: b.startTime,
        endTime: b.endTime,
        title: b.title,
        category: b.category,
      }));
      setTemplate(slots.sort((a, b) => a.startTime.localeCompare(b.startTime)));
      alert("¡Rutina Maestra cargada localmente en tu diseñador de plantilla ideal! Haz clic en 'Guardar Plantilla' para guardarla permanentemente.");
      return;
    }

    if (!uid) return;
    
    if (weekBlocks.length > 0) {
      const confirmClear = window.confirm(
        `Ya tienes ${weekBlocks.length} bloques programados en esta semana. ¿Deseas BORRARLOS todos antes de cargar tu Rutina Maestra para evitar duplicidades de horas?`
      );
      if (confirmClear) {
        setLoading(true);
        await Promise.all(weekBlocks.map(b => remove(uid, "timeBlocks", b.id)));
      } else {
        const proceed = window.confirm("¿Deseas proceder e insertar la rutina encima de los bloques actuales? (Esto podría duplicar tus horas)");
        if (!proceed) return;
      }
    }

    setLoading(true);
    await Promise.all(
      baseBlocks.map(b => create(uid, "timeBlocks", {
        weekId,
        day: b.day,
        startTime: b.startTime,
        endTime: b.endTime,
        title: b.title,
        category: b.category,
        plannedStatus: "PLANNED",
        executedStatus: "PLANNED",
        complianceRate: 0,
        notes: "",
      }))
    );
    await loadData();
    setLoading(false);
    alert(`¡Rutina Maestra cargada exitosamente para la semana ${weekId}!`);
  };

  const deleteBlock = async (id?: string, index?: number) => {
    if (!uid) return;

    if (view === "template" && typeof index === "number") {
      setTemplate(prev => prev.filter((_, idx) => idx !== index));
      return;
    }

    if (!id) return;
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
                    {weekBlocks.length > 0 && (
                      <button 
                        onClick={handleDeduplicateWeek} 
                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-red-400 hover:bg-white/5 w-full text-left font-semibold transition-colors border-t border-white/[0.03]"
                      >
                        <X className="w-3.5 h-3.5 text-red-500" /> Depurar Duplicados
                      </button>
                    )}
                    {template.length === 0 && (
                      <div className="px-3.5 py-2 text-[10px] text-zinc-500 italic border-t border-white/[0.03] leading-relaxed">
                        No has guardado una rutina. Configura tus bloques de esta semana y haz clic en &quot;Guardar como Plantilla&quot;.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {view === "week" && weekBlocks.length === 0 && (
              <button
                onClick={handleLoadRoutine}
                className="flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 px-3.5 h-10 rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.05)]"
              >
                <Sparkles className="w-3.5 h-3.5" /> Cargar Rutina Maestra
              </button>
            )}
            
            <button onClick={() => view === "week" ? setCurrentWeekOffset(o => o - 1) : setCurrentMonthOffset(o => o - 1)} className="btn-secondary h-10 p-2.5 rounded-xl"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => view === "week" ? setCurrentWeekOffset(0) : setCurrentMonthOffset(0)} className="btn-secondary h-10 px-4 rounded-xl text-xs font-bold">Hoy</button>
            <button onClick={() => view === "week" ? setCurrentWeekOffset(o => o + 1) : setCurrentMonthOffset(o => o + 1)} className="btn-secondary h-10 p-2.5 rounded-xl"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {view !== "month" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
          {/* Tarjeta 1: Actualmente estás haciendo */}
          <div className="glass-card p-5 border border-white/[0.04] bg-[#0c0c0e]/80 shadow-[var(--shadow-md)] flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute -right-16 -top-16 w-32 h-32 rounded-full bg-amber-500/10 blur-3xl group-hover:bg-amber-500/20 transition-all duration-500" />
            
            <div className="select-none mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Actualmente estás haciendo</span>
              <div className="h-[2px] w-8 bg-amber-500 mt-1.5 rounded-full" />
            </div>

            {currentInfo ? (() => {
              const cfg = CATEGORY_CONFIG[currentInfo.block.category as BlockCategory];
              const CategoryIcon = cfg.icon;
              return (
                <div className="space-y-4 my-1">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className={cn("px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border border-white/5", cfg.bg, cfg.text)}>
                        {cfg.label}
                      </div>
                      <span className="text-[10px] font-bold text-zinc-500 font-mono">
                        {currentInfo.block.startTime} - {currentInfo.block.endTime}
                      </span>
                    </div>
                    <h4 className="text-lg font-black text-white tracking-tight mt-1.5 flex items-center gap-2">
                      <CategoryIcon className={cn("w-5 h-5 shrink-0", cfg.text)} />
                      {currentInfo.block.title}
                    </h4>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-500">
                      <span>Progreso del bloque</span>
                      <span className="font-bold text-zinc-400 font-mono">{Math.round(currentInfo.progress)}%</span>
                    </div>
                    <div className="h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-white/5">
                      <div 
                        className={cn("h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(245,158,11,0.2)] bg-gradient-to-r", 
                          currentInfo.block.category === "TRABAJO" && "from-blue-600 to-blue-400",
                          currentInfo.block.category === "APRENDIZAJE" && "from-purple-600 to-purple-400",
                          currentInfo.block.category === "SALUD" && "from-emerald-600 to-emerald-400",
                          currentInfo.block.category === "PERSONAL" && "from-amber-600 to-amber-400",
                          currentInfo.block.category === "OCIO" && "from-pink-600 to-pink-400"
                        )} 
                        style={{ width: `${currentInfo.progress}%` }} 
                      />
                    </div>
                    <p className="text-[10px] text-zinc-400 font-medium">
                      Termina en <span className="font-bold text-white font-mono">{currentInfo.remaining}</span>
                    </p>
                  </div>
                </div>
              );
            })() : (
              <div className="py-4 flex flex-col items-center justify-center text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-500">
                  <Smile className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-300">Tiempo Libre / Descanso</p>
                  <p className="text-[10px] text-zinc-500 mt-1 max-w-[200px]">No tienes ninguna actividad programada en este momento. ¡Disfruta de tu espacio libre!</p>
                </div>
              </div>
            )}
          </div>

          {/* Tarjeta 2: Distribución por Categorías */}
          <div className="glass-card p-5 border border-white/[0.04] bg-[#0c0c0e]/80 shadow-[var(--shadow-md)] flex flex-col justify-between">
            <div className="select-none mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Distribución de Horas</span>
              <div className="h-[2px] w-8 bg-amber-500 mt-1.5 rounded-full" />
            </div>

            <div className="space-y-2.5 my-1">
              {CATEGORIES.map(cat => {
                const cfg = CATEGORY_CONFIG[cat];
                const hrs = categoryHours[cat] || 0;
                const pct = totalCalculatedHours > 0 ? (hrs / totalCalculatedHours) * 100 : 0;
                const Icon = cfg.icon;
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5 font-bold text-zinc-300">
                        <Icon className={cn("w-3.5 h-3.5", cfg.text)} />
                        <span>{cfg.label}</span>
                      </div>
                      <span className="font-mono text-zinc-400">
                        <span className="font-black text-zinc-200">{hrs.toFixed(1)}h</span> ({Math.round(pct)}%)
                      </span>
                    </div>
                    <div className="h-1 bg-zinc-950 rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full rounded-full", 
                          cat === "TRABAJO" && "bg-blue-500",
                          cat === "APRENDIZAJE" && "bg-purple-500",
                          cat === "SALUD" && "bg-emerald-500",
                          cat === "PERSONAL" && "bg-amber-500",
                          cat === "OCIO" && "bg-pink-500"
                        )} 
                        style={{ width: `${pct}%` }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="border-t border-white/5 pt-2.5 mt-2 flex justify-between items-center text-[10px] text-zinc-500 font-semibold select-none">
              <span>Horas programadas:</span>
              <span className="font-bold text-white font-mono">{totalCalculatedHours.toFixed(1)}h / 168.0h</span>
            </div>
          </div>

          {/* Tarjeta 3: Top Actividades */}
          <div className="glass-card p-5 border border-white/[0.04] bg-[#0c0c0e]/80 shadow-[var(--shadow-md)] flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <div className="select-none">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Top Actividades</span>
                <div className="h-[2px] w-8 bg-amber-500 mt-1.5 rounded-full" />
              </div>
              {sortedActivities.length > 0 && (
                <button
                  onClick={() => setIsStatsModalOpen(true)}
                  className="text-[9px] font-bold text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1 rounded-lg border border-amber-500/20 active:scale-95 transition-all shrink-0"
                >
                  Ver Todo
                </button>
              )}
            </div>

            <div className="flex-1 space-y-2 max-h-[175px] overflow-y-auto scrollbar-thin my-1 pr-1">
              {sortedActivities.slice(0, 5).map((act, index) => {
                const matchedBlock = activeBlocks.find(b => b.title?.trim() === act.title);
                const category = matchedBlock ? matchedBlock.category : "PERSONAL";
                const cfg = CATEGORY_CONFIG[category as BlockCategory] || CATEGORY_CONFIG.PERSONAL;
                const Icon = cfg.icon;

                return (
                  <div key={index} className="flex items-center justify-between p-2 rounded-xl bg-white/[0.015] border border-white/[0.02] hover:bg-white/[0.03] transition-colors duration-150">
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-[9px] font-bold font-mono text-zinc-600 bg-white/5 w-4 h-4 rounded-full flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <Icon className={cn("w-3 h-3 shrink-0", cfg.text)} />
                      <span className="text-[10px] font-bold text-zinc-300 truncate">{act.title}</span>
                    </div>
                    <div className="px-2.5 py-0.5 rounded-lg bg-zinc-950/60 border border-white/5 text-[9px] font-black text-zinc-400 font-mono shrink-0">
                      {act.hours.toFixed(1)}h
                    </div>
                  </div>
                );
              })}
              {sortedActivities.length === 0 && (
                <div className="py-10 text-center text-[10px] font-semibold text-zinc-600 italic">
                  Sin datos programados
                </div>
              )}
            </div>

            <div className="border-t border-white/5 pt-2.5 mt-2 flex justify-between items-center text-[10px] text-zinc-500 font-semibold select-none">
              <span>Total actividades únicas:</span>
              <span className="font-bold text-white font-mono">{sortedActivities.length}</span>
            </div>
          </div>
        </div>
      )}

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

          {/* Weekly grid — Google Calendar style hourly timeline grid */}
          <div className="overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 mt-4 select-none">
            <div className="min-w-[950px] bg-[#0c0c0e]/50 border border-white/[0.04] rounded-2xl overflow-hidden backdrop-blur-xl shadow-[var(--shadow-lg)]">
              {/* Header: Days labels */}
              <div className="grid grid-cols-[60px_1fr] border-b border-white/5 bg-black/40">
                <div className="border-r border-white/5" />
                <div className="grid grid-cols-7 divide-x divide-white/5">
                  {DAYS.map(day => {
                    const isCurrentDay = currentWeekOffset === 0 && ((new Date()).getDay()===0?"SUN":getDayKey(new Date())) === day.key;
                    return (
                      <div key={day.key} className="py-2 text-center flex flex-col items-center justify-center">
                        <span className={cn("text-[9px] font-black uppercase tracking-widest", isCurrentDay ? "text-amber-400" : "text-zinc-500")}>
                          {day.label}
                        </span>
                        <button 
                          onClick={() => { setSelectedDay(day.key); setShowForm(true); }}
                          className="mt-1 text-zinc-500 hover:text-amber-400 transition-colors p-0.5 hover:bg-white/5 rounded"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Body: Hours column + Days grid */}
              <div className="grid grid-cols-[60px_1fr] relative h-[864px]">
                {/* Background grid lines covering the entire width */}
                <div className="absolute left-[60px] right-0 top-0 bottom-0 pointer-events-none select-none">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div key={i} className="h-9 border-b border-white/[0.02]" />
                  ))}
                </div>

                {/* Left side: Hour labels */}
                <div className="border-r border-white/5 flex flex-col select-none bg-black/10">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div key={i} className="h-9 flex items-center justify-end pr-2.5 text-[8px] font-mono font-bold text-zinc-600 leading-none">
                      {i.toString().padStart(2, "0")}:00
                    </div>
                  ))}
                </div>

                {/* Right side: 7 Day Columns */}
                <div className="grid grid-cols-7 relative h-full divide-x divide-white/[0.04]">
                  {DAYS.map(day => {
                    const dayBlocks = activeBlocks.filter(b => b.day === day.key);
                    const isCurrentDay = currentWeekOffset === 0 && ((new Date()).getDay()===0?"SUN":getDayKey(new Date())) === day.key;
                    
                    return (
                      <div key={day.key} className={cn("relative h-full w-full", isCurrentDay && "bg-amber-500/[0.005]")}>
                        {dayBlocks.map((block, idx) => {
                          const cfg = CATEGORY_CONFIG[block.category as BlockCategory] || CATEGORY_CONFIG.PERSONAL;
                          const CategoryIcon = cfg.icon;
                          const isCompleted = isBlockCompleted(block);
                          
                          const startMin = parseTimeToMinutes(block.startTime);
                          const endMin = block.endTime === "24:00" ? 24 * 60 : parseTimeToMinutes(block.endTime);
                          const topPercent = (startMin / 1440) * 100;
                          const heightPercent = ((endMin - startMin) / 1440) * 100;

                          return (
                            <button
                              key={block.id || `${day.key}-${idx}`}
                              onClick={() => { setSelectedBlockForModal(block); setIsModalOpen(true); }}
                              style={{ 
                                top: `${topPercent}%`, 
                                height: `${heightPercent}%`,
                                left: "2px",
                                right: "2px"
                              }}
                              className={cn(
                                "absolute rounded-lg p-1.5 border-l-2 text-[9px] text-left group overflow-hidden border border-white/[0.02] flex flex-col justify-between hover:scale-[1.01] hover:z-10 transition-all shadow-[var(--shadow-sm)] active:scale-95",
                                cfg.border,
                                cfg.bg,
                                isCompleted && "opacity-45 grayscale"
                              )}
                            >
                              <div className="flex flex-col truncate w-full">
                                <span className="text-[7.5px] font-bold opacity-60 font-mono tracking-wide leading-none">{block.startTime}-{block.endTime}</span>
                                <span className={cn("font-black text-white text-[9.5px] leading-tight truncate mt-0.5", isCompleted && "line-through opacity-70")}>
                                  {block.title}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-1 mt-auto">
                                <CategoryIcon className={cn("w-2.5 h-2.5 shrink-0", cfg.text)} />
                                <span className="text-[7px] font-black uppercase tracking-wider opacity-60 truncate leading-none capitalize">
                                  {block.category.toLowerCase()}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
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
                  onClick={handleLoadRoutine}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 px-3 py-2 rounded-xl transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Cargar Rutina Maestra
                </button>
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

            {/* Sandbox Ideal Week Grid — Google Calendar style hourly timeline grid */}
            <div className="overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 mt-4 select-none">
              <div className="min-w-[950px] bg-[#0c0c0e]/50 border border-white/[0.04] rounded-2xl overflow-hidden backdrop-blur-xl shadow-[var(--shadow-lg)]">
                {/* Header: Days labels */}
                <div className="grid grid-cols-[60px_1fr] border-b border-white/5 bg-black/40">
                  <div className="border-r border-white/5" />
                  <div className="grid grid-cols-7 divide-x divide-white/5">
                    {DAYS.map(day => (
                      <div key={day.key} className="py-2 text-center flex flex-col items-center justify-center">
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                          {day.label}
                        </span>
                        <button 
                          onClick={() => { setSelectedDay(day.key); setShowForm(true); }}
                          className="mt-1 text-zinc-500 hover:text-amber-400 transition-colors p-0.5 hover:bg-white/5 rounded"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Body: Hours column + Days grid */}
                <div className="grid grid-cols-[60px_1fr] relative h-[864px]">
                  {/* Background grid lines */}
                  <div className="absolute left-[60px] right-0 top-0 bottom-0 pointer-events-none select-none">
                    {Array.from({ length: 24 }).map((_, i) => (
                      <div key={i} className="h-9 border-b border-white/[0.02]" />
                    ))}
                  </div>

                  {/* Hour labels */}
                  <div className="border-r border-white/5 flex flex-col select-none bg-black/10">
                    {Array.from({ length: 24 }).map((_, i) => (
                      <div key={i} className="h-9 flex items-center justify-end pr-2.5 text-[8px] font-mono font-bold text-zinc-600 leading-none">
                        {i.toString().padStart(2, "0")}:00
                      </div>
                    ))}
                  </div>

                  {/* Day Columns */}
                  <div className="grid grid-cols-7 relative h-full divide-x divide-white/[0.04]">
                    {DAYS.map(day => {
                      const daySlots = template.filter(b => b.day === day.key);
                      
                      return (
                        <div key={day.key} className="relative h-full w-full">
                          {daySlots.map((slot, idx) => {
                            const cfg = CATEGORY_CONFIG[slot.category as BlockCategory] || CATEGORY_CONFIG.PERSONAL;
                            const CategoryIcon = cfg.icon;
                            
                            const startMin = parseTimeToMinutes(slot.startTime);
                            const endMin = slot.endTime === "24:00" ? 24 * 60 : parseTimeToMinutes(slot.endTime);
                            const topPercent = (startMin / 1440) * 100;
                            const heightPercent = ((endMin - startMin) / 1440) * 100;

                            return (
                              <button
                                key={`${day.key}-${idx}`}
                                onClick={() => { setSelectedBlockForModal(slot); setIsModalOpen(true); }}
                                style={{ 
                                  top: `${topPercent}%`, 
                                  height: `${heightPercent}%`,
                                  left: "2px",
                                  right: "2px"
                                }}
                                className={cn(
                                  "absolute rounded-lg p-1.5 border-l-2 text-[9px] text-left group overflow-hidden border border-white/[0.02] flex flex-col justify-between hover:scale-[1.01] hover:z-10 transition-all shadow-[var(--shadow-sm)] active:scale-95",
                                  cfg.border,
                                  cfg.bg
                                )}
                              >
                                <div className="flex flex-col truncate w-full">
                                  <span className="text-[7.5px] font-bold opacity-60 font-mono tracking-wide leading-none">{slot.startTime}-{slot.endTime}</span>
                                  <span className="font-black text-white text-[9.5px] leading-tight truncate mt-0.5">
                                    {slot.title}
                                  </span>
                                </div>
                                
                                <div className="flex items-center gap-1 mt-auto">
                                  <CategoryIcon className={cn("w-2.5 h-2.5 shrink-0", cfg.text)} />
                                  <span className="text-[7px] font-black uppercase tracking-wider opacity-60 truncate leading-none capitalize">
                                    {slot.category.toLowerCase()}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
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

      {/* --- DETAILED BLOCK MODAL --- */}
      {isModalOpen && selectedBlockForModal && (() => {
        const block = selectedBlockForModal;
        const cfg = CATEGORY_CONFIG[block.category as BlockCategory] || CATEGORY_CONFIG.PERSONAL;
        const CategoryIcon = cfg.icon;
        
        const globalIndex = template.findIndex(
          t => t.day === block.day && 
               t.startTime === block.startTime && 
               t.endTime === block.endTime && 
               t.title === block.title
        );

        const duration = getDurationHours(block.startTime, block.endTime);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
              onClick={() => { setIsModalOpen(false); setSelectedBlockForModal(null); }}
            />
            
            <div className="relative w-full max-w-md bg-[#0c0c0e] border border-white/10 rounded-3xl p-6 shadow-2xl z-10 animate-in zoom-in-95 duration-200 flex flex-col space-y-5">
              
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className={cn("p-2 rounded-xl bg-white/5 border border-white/5", cfg.text)}>
                    <CategoryIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white leading-none truncate max-w-[220px]">
                      {block.title}
                    </h3>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1 tracking-wider">
                      Día: {DAYS.find(d => d.key === block.day)?.label}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => { setIsModalOpen(false); setSelectedBlockForModal(null); }}
                  className="w-7 h-7 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-white/[0.01] border border-white/[0.03] rounded-2xl">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Horario</span>
                    <span className="font-mono text-zinc-200 font-bold">{block.startTime} - {block.endTime}</span>
                  </div>
                  <div className="p-3 bg-white/[0.01] border border-white/[0.03] rounded-2xl">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Duración</span>
                    <span className="font-mono text-zinc-200 font-bold">{duration.toFixed(1)} horas</span>
                  </div>
                </div>

                <div className="p-3 bg-white/[0.01] border border-white/[0.03] rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Categoría</span>
                    <span className="font-black text-zinc-200">{cfg.label}</span>
                  </div>
                  <span className={cn("px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border border-white/5", cfg.bg, cfg.text)}>
                    {block.category}
                  </span>
                </div>

                {view !== "template" && (
                  <div className="p-3 bg-white/[0.01] border border-white/[0.03] rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Estado de cumplimiento</span>
                      <span className="font-bold text-zinc-300">
                        {isBlockCompleted(block as TimeBlock) ? "Completado (Histórico)" : "Pendiente / Activo"}
                      </span>
                    </div>
                    <span className={cn("px-2 py-0.5 rounded-lg text-[9px] font-black border uppercase", 
                      isBlockCompleted(block as TimeBlock) ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    )}>
                      {isBlockCompleted(block as TimeBlock) ? "Pasado" : "Activo"}
                    </span>
                  </div>
                )}
              </div>

              <div className="border-t border-white/5 pt-4 flex items-center justify-end gap-3 shrink-0">
                <button
                  onClick={async () => {
                    const idToDelete = block.id;
                    const indexToDelete = globalIndex;
                    
                    if (window.confirm("¿Estás seguro de que deseas eliminar este bloque de tiempo?")) {
                      await deleteBlock(idToDelete, indexToDelete);
                      setIsModalOpen(false);
                      setSelectedBlockForModal(null);
                    }
                  }}
                  className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 px-3 py-2 rounded-xl transition-all active:scale-95"
                >
                  <X className="w-3.5 h-3.5" /> Eliminar Bloque
                </button>
                <button 
                  onClick={() => { setIsModalOpen(false); setSelectedBlockForModal(null); }}
                  className="btn-secondary text-[10px] font-bold px-4 py-2 rounded-xl h-auto"
                >
                  Cerrar
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* --- DETAILED STATISTICS BREAKDOWN MODAL --- */}
      {isStatsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
            onClick={() => { setIsStatsModalOpen(false); setStatsSearchQuery(""); }}
          />
          
          {/* Modal Box */}
          <div className="relative w-full max-w-lg bg-[#0c0c0e] border border-white/10 rounded-3xl p-6 shadow-2xl z-10 animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] space-y-4">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4 shrink-0">
              <div>
                <h3 className="text-base font-black text-white leading-none">
                  Desglose Completo de Actividades
                </h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1.5 tracking-wider leading-none">
                  Tiempo total dedicado a cada bloque semanal
                </p>
              </div>
              <button 
                onClick={() => { setIsStatsModalOpen(false); setStatsSearchQuery(""); }}
                className="w-7 h-7 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Search bar */}
            <div className="relative shrink-0">
              <Search className="w-4 h-4 text-zinc-600 absolute left-3.5 top-3" />
              <input
                value={statsSearchQuery}
                onChange={(e) => setStatsSearchQuery(e.target.value)}
                placeholder="Buscar actividad... (ej: Daskalos, Red, Deep Work)"
                className="w-full pl-10 pr-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
              />
              {statsSearchQuery && (
                <button
                  onClick={() => setStatsSearchQuery("")}
                  className="absolute right-3.5 top-2.5 text-[10px] text-zinc-500 hover:text-white font-bold"
                >
                  Limpiar
                </button>
              )}
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1.5 custom-scrollbar min-h-[250px] scrollbar-thin">
              {(() => {
                const filteredStats = sortedActivities.filter(act => 
                  act.title.toLowerCase().includes(statsSearchQuery.toLowerCase())
                );

                if (filteredStats.length === 0) {
                  return (
                    <div className="py-12 text-center text-xs text-zinc-500 italic">
                      No se encontraron actividades coincidentes.
                    </div>
                  );
                }

                const maxHours = Math.max(...sortedActivities.map(a => a.hours), 1);

                return filteredStats.map((act, index) => {
                  const matchedBlock = activeBlocks.find(b => b.title?.trim() === act.title);
                  const category = matchedBlock ? matchedBlock.category : "PERSONAL";
                  const cfg = CATEGORY_CONFIG[category as BlockCategory] || CATEGORY_CONFIG.PERSONAL;
                  const Icon = cfg.icon;
                  const percentage = totalCalculatedHours > 0 ? (act.hours / totalCalculatedHours) * 100 : 0;
                  const relativeWidth = (act.hours / maxHours) * 100;

                  return (
                    <div key={index} className="p-3.5 rounded-2xl bg-white/[0.01] border border-white/[0.03] hover:bg-white/[0.02] transition-colors duration-150 flex flex-col space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-[9px] font-bold font-mono text-zinc-600 bg-white/5 w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <Icon className={cn("w-3.5 h-3.5 shrink-0", cfg.text)} />
                          <span className="text-xs font-bold text-zinc-200 truncate">{act.title}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn("px-2 py-0.5 rounded-lg text-[8px] font-black uppercase border border-white/5 leading-none", cfg.bg, cfg.text)}>
                            {category.toLowerCase()}
                          </span>
                          <div className="px-2.5 py-1 rounded-xl bg-zinc-950/80 border border-white/5 text-xs font-black text-white font-mono leading-none">
                            {act.hours.toFixed(1)}h
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="h-1.5 bg-zinc-950 rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full rounded-full transition-all duration-300", 
                              category === "TRABAJO" && "bg-blue-500",
                              category === "APRENDIZAJE" && "bg-purple-500",
                              category === "SALUD" && "bg-emerald-500",
                              category === "PERSONAL" && "bg-amber-500",
                              category === "OCIO" && "bg-pink-500"
                            )} 
                            style={{ width: `${relativeWidth}%` }} 
                          />
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-zinc-500 font-semibold select-none">
                          <span>Dedicación semanal</span>
                          <span className="font-bold text-zinc-400 font-mono">{percentage.toFixed(1)}% del tiempo programado</span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="border-t border-white/5 pt-4 flex items-center justify-between text-[10px] text-zinc-500 font-semibold select-none shrink-0">
              <span>Total bloques mostrados:</span>
              <span className="font-bold text-white font-mono">
                {sortedActivities.filter(act => act.title.toLowerCase().includes(statsSearchQuery.toLowerCase())).length} de {sortedActivities.length}
              </span>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
