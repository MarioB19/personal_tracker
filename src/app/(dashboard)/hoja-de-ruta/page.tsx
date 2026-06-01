"use client";

import { useEffect, useState, useCallback } from "react";
import { useUid } from "@/lib/hooks/useAuth";
import { getAll, create, update, remove } from "@/lib/repositories/firestore";
import { RoadmapRow, RoadmapStatus, RoadmapQuarterKey, Goal, GoalPeriod } from "@/lib/types";
import { GoalSlideOver } from "@/components/shared/GoalSlideOver";
import { Timestamp } from "firebase/firestore";
import {
  Compass,
  Plus,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  X,
  Check,
  Clock,
  Circle,
  Minus,
  Target,
  CalendarDays,
  Sparkles,
  Map,
  Trash,
  Move,
  ArrowRightLeft
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────
const QUARTERS: RoadmapQuarterKey[] = ["Q1", "Q2", "Q3", "Q4"];

const QUARTER_MONTHS: Record<
  RoadmapQuarterKey,
  { name: string; num: number }[]
> = {
  Q1: [
    { name: "Enero", num: 1 },
    { name: "Febrero", num: 2 },
    { name: "Marzo", num: 3 },
  ],
  Q2: [
    { name: "Abril", num: 4 },
    { name: "Mayo", num: 5 },
    { name: "Junio", num: 6 },
  ],
  Q3: [
    { name: "Julio", num: 7 },
    { name: "Agosto", num: 8 },
    { name: "Septiembre", num: 9 },
  ],
  Q4: [
    { name: "Octubre", num: 10 },
    { name: "Noviembre", num: 11 },
    { name: "Diciembre", num: 12 },
  ],
};

const STATUS_CONFIG: Record<
  RoadmapStatus,
  { label: string; bgClass: string; textClass: string; icon: React.ElementType }
> = {
  COMPLETADO: {
    label: "Completado",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/40",
    textClass: "text-emerald-700 dark:text-emerald-400",
    icon: Check,
  },
  EN_PROGRESO: {
    label: "En progreso",
    bgClass: "bg-sky-50 dark:bg-sky-950/40",
    textClass: "text-sky-700 dark:text-sky-400",
    icon: Clock,
  },
  PENDIENTE: {
    label: "Pendiente",
    bgClass: "bg-amber-50 dark:bg-amber-950/40",
    textClass: "text-amber-700 dark:text-amber-400",
    icon: Circle,
  },
  VACÍO: {
    label: "Vacío",
    bgClass: "bg-muted",
    textClass: "text-muted-foreground",
    icon: Minus,
  },
};

const QUARTER_COLORS: Record<RoadmapQuarterKey, string> = {
  Q1: "from-rose-500/10 to-orange-500/10",
  Q2: "from-emerald-500/10 to-teal-500/10",
  Q3: "from-sky-500/10 to-indigo-500/10",
  Q4: "from-violet-500/10 to-purple-500/10",
};

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
function buildDefaultRows(year: number, age: number) {
  const rows: Omit<RoadmapRow, "id" | "userId" | "createdAt" | "updatedAt">[] =
    [];

  for (const q of QUARTERS) {
    for (const m of QUARTER_MONTHS[q]) {
      rows.push({
        year,
        age,
        annualGoals: "",
        quarter: q,
        quarterlyGoals: "",
        month: m.name,
        monthNumber: m.num,
        monthlyGoal: "",
        activities: "",
        status: "VACÍO",
        comments: "",
      });
    }
  }

  return rows;
}

function getQuarterProgress(rows: RoadmapRow[]) {
  if (!rows.length) return 0;
  const completed = rows.filter((r) => r.status === "COMPLETADO").length;
  return Math.round((completed / rows.length) * 100);
}

function getYearProgress(rows: RoadmapRow[]) {
  if (!rows.length) return 0;
  const completed = rows.filter((r) => r.status === "COMPLETADO").length;
  return Math.round((completed / rows.length) * 100);
}

// ─────────────────────────────────────────
// UI Components
// ─────────────────────────────────────────
function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0e] shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/5 px-6 py-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
            {subtitle && (
              <p className="mt-1 text-[10px] uppercase font-bold tracking-wider text-zinc-500">{subtitle}</p>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-5 p-6">{children}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: RoadmapStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;

  const animationClasses: Record<RoadmapStatus, { badge: string; icon: string }> = {
    COMPLETADO: {
      badge: "border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)] hover:shadow-[0_0_15px_rgba(16,185,129,0.25)] hover:border-emerald-500/40 transition-all duration-300",
      icon: "scale-110 text-emerald-400 group-hover:scale-125 transition-transform duration-300"
    },
    EN_PROGRESO: {
      badge: "border border-sky-500/20 shadow-[0_0_10px_rgba(14,165,233,0.1)] hover:shadow-[0_0_15px_rgba(14,165,233,0.25)] hover:border-sky-500/40 transition-all duration-300",
      icon: "animate-[spin_8s_linear_infinite] text-sky-400"
    },
    PENDIENTE: {
      badge: "border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)] hover:shadow-[0_0_15px_rgba(245,158,11,0.25)] hover:border-amber-500/40 transition-all duration-300",
      icon: "animate-pulse text-amber-400"
    },
    VACÍO: {
      badge: "border border-white/5",
      icon: "text-zinc-500"
    }
  };

  const anim = animationClasses[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all duration-300 select-none",
        cfg.bgClass,
        cfg.textClass,
        anim.badge
      )}
    >
      <Icon className={cn("size-3 shrink-0", anim.icon)} />
      <span>{cfg.label}</span>
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3",
        accent
          ? "border-primary/20 bg-primary/5"
          : "border-border bg-card"
      )}
    >
      <div
        className={cn(
          "flex size-9 items-center justify-center rounded-lg",
          accent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-sm font-semibold", accent ? "text-primary" : "text-foreground")}>
          {value}
        </p>
      </div>
    </div>
  );
}

function ProgressRing({ value, size = 48 }: { value: number; size?: number }) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="rotate-[-90deg]" width={size} height={size}>
        <circle
          className="text-zinc-800"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className="text-amber-500 transition-all duration-500"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-black text-white">{value}%</span>
      </div>
    </div>
  );
}

function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
      <div
        className={cn("h-full rounded-full bg-amber-500 transition-all duration-500", className)}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

function IconButton({
  onClick,
  icon: Icon,
  label,
  variant = "default",
}: {
  onClick: () => void;
  icon: React.ElementType;
  label?: string;
  variant?: "default" | "danger" | "primary";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        variant === "danger" &&
          "text-destructive hover:bg-destructive/10",
        variant === "primary" &&
          "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "default" &&
          "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="size-4" />
      {label && <span>{label}</span>}
    </button>
  );
}

function MonthCard({
  row,
  monthGoals,
  onEdit,
  onAddGoal,
  onEditGoal,
}: {
  row: RoadmapRow;
  monthGoals: Goal[];
  onEdit: (row: RoadmapRow) => void;
  onAddGoal: () => void;
  onEditGoal: (g: Goal) => void;
}) {
  const hasContent = row.monthlyGoal || row.activities || monthGoals.length > 0;

  // Calculate monthly average progress
  const averageProgress = monthGoals.length > 0
    ? Math.round(monthGoals.reduce((sum, g) => sum + (g.progress || 0), 0) / monthGoals.length)
    : 0;

  const glowClasses: Record<RoadmapQuarterKey, string> = {
    Q1: "hover:shadow-[0_0_30px_rgba(244,63,94,0.12)] hover:border-rose-500/30",
    Q2: "hover:shadow-[0_0_30px_rgba(16,185,129,0.12)] hover:border-emerald-500/30",
    Q3: "hover:shadow-[0_0_30px_rgba(14,165,233,0.12)] hover:border-sky-500/30",
    Q4: "hover:shadow-[0_0_30px_rgba(139,92,246,0.12)] hover:border-violet-500/30",
  };

  const quarterAccentText: Record<RoadmapQuarterKey, string> = {
    Q1: "text-rose-400",
    Q2: "text-emerald-400",
    Q3: "text-sky-400",
    Q4: "text-violet-400",
  };

  const quarterAccentBar: Record<RoadmapQuarterKey, string> = {
    Q1: "bg-gradient-to-r from-rose-500 to-orange-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]",
    Q2: "bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]",
    Q3: "bg-gradient-to-r from-sky-500 to-indigo-500 shadow-[0_0_8px_rgba(14,165,233,0.4)]",
    Q4: "bg-gradient-to-r from-violet-500 to-purple-500 shadow-[0_0_8px_rgba(139,92,246,0.4)]",
  };

  return (
    <div
      className={cn(
        "group relative rounded-2xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
        hasContent 
          ? "border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04]" 
          : "border-dashed border-white/10 bg-transparent hover:bg-white/[0.01]",
        glowClasses[row.quarter]
      )}
    >
      <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <h4 className="font-bold text-white text-base leading-none">{row.month}</h4>
            <StatusBadge status={row.status} />
          </div>

          {row.monthlyGoal && (
            <div className="mt-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Enfoque principal</p>
              <p className="text-sm leading-relaxed text-zinc-200 line-clamp-3">
                {row.monthlyGoal}
              </p>
            </div>
          )}

          {row.activities && (
            <div className="mt-2.5 bg-white/[0.01] border border-white/5 rounded-xl px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Proyectos / Rutinas</p>
              <p className="mt-0.5 text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                {row.activities}
              </p>
            </div>
          )}

          {/* Month progress based on goals */}
          {monthGoals.length > 0 && (
            <div className="mt-3.5 bg-black/20 border border-white/[0.03] rounded-xl p-2.5 shadow-inner">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Progreso del mes</span>
                <span className={cn("text-[10px] font-black font-mono", quarterAccentText[row.quarter])}>
                  {averageProgress}%
                </span>
              </div>
              <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                <div 
                  className={cn("h-full rounded-full transition-all duration-500", quarterAccentBar[row.quarter])}
                  style={{ width: `${averageProgress}%` }}
                />
              </div>
            </div>
          )}

          {monthGoals.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Metas ({monthGoals.length})</p>
              <div className="space-y-1.5">
                {monthGoals.map(g => (
                  <div 
                    key={g.id} 
                    className="flex items-center gap-2.5 text-xs bg-black/40 hover:bg-black/80 px-2.5 py-2 rounded-xl border border-white/5 hover:border-white/10 group/goal cursor-pointer transition-all duration-200" 
                    onClick={(e) => { e.stopPropagation(); onEditGoal(g); }}
                  >
                    <div className="size-1.5 rounded-full bg-gradient-to-tr from-primary to-orange-500 shrink-0" />
                    <span className="flex-1 truncate text-zinc-300 font-medium group-hover/goal:text-white transition-colors">{g.name}</span>
                    <span className="text-[10px] font-extrabold text-zinc-500 group-hover/goal:text-primary transition-colors">{g.progress}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <button 
              onClick={(e) => { e.stopPropagation(); onAddGoal(); }} 
              className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-zinc-500 hover:text-white transition-all bg-white/[0.02] border border-white/5 hover:border-white/20 px-2.5 py-1.5 rounded-lg shrink-0 group-hover:scale-105 active:scale-95 duration-200"
            >
              <Plus className="size-3 text-amber-400 group-hover:rotate-90 transition-transform duration-300" />
              <span>Añadir Meta</span>
            </button>
          </div>

          {!hasContent && (
            <p className="mt-3.5 text-xs text-zinc-600 italic">
              Sin metas o enfoques planificados
            </p>
          )}
        </div>

        <button
          onClick={() => onEdit(row)}
          className="flex size-8 items-center justify-center rounded-xl bg-white/5 text-zinc-400 border border-white/5 opacity-0 transition-all hover:bg-white/10 hover:text-white group-hover:opacity-100 shrink-0 hover:scale-105 active:scale-95"
          title="Editar mes"
        >
          <Pencil className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Main page
// ─────────────────────────────────────────
export default function HojaDeRutaPage() {
  const uid = useUid();

  const [rows, setRows] = useState<RoadmapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRow, setEditingRow] = useState<RoadmapRow | null>(null);
  const [showAddYear, setShowAddYear] = useState(false);
  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(new Set());
  const [hasInitializedCollapse, setHasInitializedCollapse] = useState(false);
  const [collapsedQuarters, setCollapsedQuarters] = useState<Set<string>>(
    new Set()
  );
  const [deletingYear, setDeletingYear] = useState<number | null>(null);

  const [fMonthlyGoal, setFMonthlyGoal] = useState("");
  const [fActivities, setFActivities] = useState("");
  const [fStatus, setFStatus] = useState<RoadmapStatus>("VACÍO");
  const [fComments, setFComments] = useState("");
  const [fYear, setFYear] = useState(new Date().getFullYear() + 1);
  const [fAge, setFAge] = useState(20);

  const [goals, setGoals] = useState<Goal[]>([]);

  // Drag and Drop / Interactive Move States
  const [draggedGoalId, setDraggedGoalId] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<string | null>(null); // format: `${year}-${q}`
  const [activeMoveGoalId, setActiveMoveGoalId] = useState<string | null>(null);

  
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [goalFormContext, setGoalFormContext] = useState<{
    year?: number;
    quarter?: 1|2|3|4;
    month?: number;
    period?: GoalPeriod;
  }>({});

  const loadData = useCallback(async () => {
    if (!uid) return;
    const [rData, gData] = await Promise.all([
      getAll<RoadmapRow>(uid, "roadmap"),
      getAll<Goal>(uid, "goals"),
    ]);
    setRows(rData);
    setGoals(gData);
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (rows.length > 0 && !hasInitializedCollapse) {
      const uniqueYears = Array.from(new Set(rows.map((r) => r.year)));
      const initialCollapsed = new Set<number>();
      uniqueYears.forEach((y) => {
        if (y !== 2026) {
          initialCollapsed.add(y);
        }
      });
      setCollapsedYears(initialCollapsed);
      setHasInitializedCollapse(true);
    }
  }, [rows, hasInitializedCollapse]);

  const grouped = rows.reduce(
    (acc, row) => {
      if (!acc[row.year])
        acc[row.year] = {} as Record<RoadmapQuarterKey, RoadmapRow[]>;
      if (!acc[row.year][row.quarter]) acc[row.year][row.quarter] = [];
      acc[row.year][row.quarter].push(row);
      return acc;
    },
    {} as Record<number, Record<RoadmapQuarterKey, RoadmapRow[]>>
  );

  const sortedYears = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b);

  const openEditRow = (row: RoadmapRow) => {
    setFMonthlyGoal(row.monthlyGoal);
    setFActivities(row.activities);
    setFStatus(row.status);
    setFComments(row.comments);
    setEditingRow(row);
  };

  const handleSaveRow = async () => {
    if (!uid || !editingRow) return;

    await update(uid, "roadmap", editingRow.id, {
      monthlyGoal: fMonthlyGoal,
      activities: fActivities,
      status: fStatus,
      comments: fComments,
    });

    setEditingRow(null);
    loadData();
  };

  const handleSaveGoal = async (data: Partial<Goal>) => {
    if (!uid) return;
    if (editingGoal) {
      await update(uid, "goals", editingGoal.id, data);
    } else {
      await create(uid, "goals", data as Omit<Goal, "id" | "userId" | "createdAt" | "updatedAt">);
    }
    setShowGoalForm(false);
    setEditingGoal(null);
    loadData();
  };

  const openNewGoal = (year: number, period: GoalPeriod, quarter?: 1|2|3|4, month?: number) => {
    setGoalFormContext({ year, period, quarter, month });
    setEditingGoal(null);
    setShowGoalForm(true);
  };

  const handleDragStart = (e: React.DragEvent, goalId: string) => {
    e.dataTransfer.setData("text/plain", goalId);
    e.dataTransfer.effectAllowed = "move";
    setDraggedGoalId(goalId);
  };

  const handleDragEnd = () => {
    setDraggedGoalId(null);
    setDragOverZone(null);
  };

  const handleDragOver = (e: React.DragEvent, zoneKey: string) => {
    e.preventDefault();
    setDragOverZone(zoneKey);
  };

  const handleDragLeave = () => {
    setDragOverZone(null);
  };

  const handleMoveGoal = async (goalId: string, newYear: number, newQuarter: number) => {
    if (!uid) return;

    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;
    if (goal.year === newYear && goal.quarter === newQuarter) return;

    // Snappy optimistic UI update
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goalId ? { ...g, year: newYear, quarter: newQuarter as 1 | 2 | 3 | 4 } : g
      )
    );

    try {
      await update(uid, "goals", goalId, {
        year: newYear,
        quarter: newQuarter,
      });
    } catch (error) {
      console.error("Error moving goal:", error);
      loadData(); // Revert to database state if failed
    }
  };

  const handleDrop = async (e: React.DragEvent, targetYear: number, targetQuarter: number) => {
    e.preventDefault();
    const goalId = e.dataTransfer.getData("text/plain") || draggedGoalId;
    if (!goalId) return;

    await handleMoveGoal(goalId, targetYear, targetQuarter);
    setDraggedGoalId(null);
    setDragOverZone(null);
  };

  const handleAddYear = async () => {
    if (!uid || sortedYears.includes(fYear)) return;

    const defaultRows = buildDefaultRows(fYear, fAge);

    await Promise.all(
      defaultRows.map((row) =>
        create(
          uid,
          "roadmap",
          row as Omit<RoadmapRow, "id" | "userId" | "createdAt" | "updatedAt">
        )
      )
    );

    setShowAddYear(false);
    loadData();
  };

  const handleDeleteYear = async (year: number) => {
    if (!uid) return;

    await Promise.all(
      rows
        .filter((r) => r.year === year)
        .map((r) => remove(uid, "roadmap", r.id))
    );

    setDeletingYear(null);
    loadData();
  };

  const handleDeleteGoal = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!uid) return;
    if (!window.confirm("¿Seguro que deseas eliminar esta meta?")) return;
    await remove(uid, "goals", id);
    loadData();
  };

  const toggleYear = (year: number) => {
    setCollapsedYears((prev) => {
      const next = new Set(prev);
      next.has(year) ? next.delete(year) : next.add(year);
      return next;
    });
  };

  const toggleQuarter = (key: string) => {
    setCollapsedQuarters((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 lg:p-10">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="h-32 animate-pulse rounded-2xl bg-muted" />
          <div className="h-64 animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter space-y-8 pb-10">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <Compass className="w-5 h-5 text-black" />
            </div>
            Hoja de Ruta
          </h1>
          <p className="text-xs text-zinc-500 mt-1">Organiza tus metas por año, trimestre y mes. Visualiza tu progreso y mantén el enfoque en lo que importa.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Calendar Stats Badge */}
          <div className="flex items-center gap-2 bg-zinc-950/40 px-3.5 h-10 rounded-xl border border-white/5" title="Años planeados">
            <CalendarDays className="size-4 text-amber-400" />
            <span className="text-xs font-black text-zinc-300 font-mono">{sortedYears.length} {sortedYears.length === 1 ? "AÑO" : "AÑOS"}</span>
          </div>

          <button 
            onClick={() => {
              setFYear(new Date().getFullYear() + 1);
              setFAge(20);
              setShowAddYear(true);
            }} 
            className="btn-primary pl-4 pr-5 h-10 flex items-center gap-1.5 rounded-xl text-xs font-black"
          >
            <Plus className="w-4 h-4" /> Agregar año
          </button>
        </div>
      </div>

      {/* Empty state */}
      {sortedYears.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#0c0c0e]/40 px-6 py-20 text-center">
          <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.05)]">
            <Sparkles className="size-8 text-amber-400" />
          </div>

          <h2 className="text-lg font-bold text-white tracking-tight">
            Comienza tu planificación
          </h2>

          <p className="mx-auto mt-2 max-w-xs text-xs text-zinc-500 leading-relaxed">
            Crea tu primer año para estructurar tus metas trimestrales y mensuales de forma clara y organizada.
          </p>

          <button
            onClick={() => {
              setFYear(new Date().getFullYear());
              setFAge(20);
              setShowAddYear(true);
            }}
            className="mt-6 btn-primary pl-4 pr-5 h-10 flex items-center gap-1.5 rounded-xl text-xs font-black"
          >
            <Plus className="size-4" />
            Crear primer año
          </button>
        </div>
      )}

        {/* Years */}
        <div className="space-y-6">
          {sortedYears.map((year) => {
            const yearData = grouped[year];
            const isCollapsed = collapsedYears.has(year);
            const allYearRows = Object.values(yearData).flat();
            const firstRow = allYearRows[0];
            const age = firstRow?.age ?? 0;
            const completedCount = allYearRows.filter(
              (r) => r.status === "COMPLETADO"
            ).length;
            const yearProgress = getYearProgress(allYearRows);

            const qProgressList = QUARTERS.map(q => {
              const qRows = yearData[q] || [];
              const progress = getQuarterProgress(qRows);
              return { q, progress };
            });

            return (
              <section
                key={year}
                className="overflow-hidden rounded-2xl border border-white/5 bg-[#0c0c0e]/60 backdrop-blur-xl shadow-lg transition-all duration-300 hover:border-white/10"
              >
                {/* Year header */}
                <div
                  className={cn(
                    "flex items-center justify-between w-full rounded-t-2xl px-5 py-4 border border-x-0 border-t-0",
                    !isCollapsed 
                      ? "bg-zinc-900/80 backdrop-blur border-white/10 text-white shadow-[0_4px_12px_rgba(0,0,0,0.2)]" 
                      : "bg-zinc-950/20 border-white/5 hover:bg-zinc-900/30 text-zinc-300"
                  )}
                >
                  <button
                    onClick={() => toggleYear(year)}
                    className="flex items-center gap-4 text-left group/btn flex-1 min-w-0"
                  >
                    <div className="flex size-10 items-center justify-center rounded-xl bg-background/60 border border-white/5 text-zinc-400 group-hover/btn:bg-background group-hover/btn:text-white transition-all shrink-0">
                      {isCollapsed ? (
                        <ChevronRight className="size-4.5 transition-transform duration-300 group-hover/btn:translate-x-0.5" />
                      ) : (
                        <ChevronDown className="size-4.5 transition-transform duration-300 group-hover/btn:translate-y-0.5" />
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 min-w-0 flex-1">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <h2 className="text-xl font-black text-white tracking-tight leading-none truncate">
                            Plan {year}
                          </h2>
                          <span className="rounded-lg bg-white/5 border border-white/5 px-2 py-0.5 text-[10px] font-bold text-zinc-400 shrink-0">
                            {age} años
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-left">
                          {completedCount} de {allYearRows.length} meses completados
                        </p>
                      </div>

                      {/* Segmented Quarter progress timeline */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {qProgressList.map(({ q, progress }) => {
                          const colors: Record<RoadmapQuarterKey, { text: string; bg: string; fill: string }> = {
                            Q1: { text: "text-rose-400", bg: "bg-rose-500/10", fill: "bg-gradient-to-r from-rose-500 to-orange-500" },
                            Q2: { text: "text-emerald-400", bg: "bg-emerald-500/10", fill: "bg-gradient-to-r from-emerald-500 to-teal-500" },
                            Q3: { text: "text-sky-400", bg: "bg-sky-500/10", fill: "bg-gradient-to-r from-sky-500 to-indigo-500" },
                            Q4: { text: "text-violet-400", bg: "bg-violet-500/10", fill: "bg-gradient-to-r from-violet-500 to-purple-500" },
                          };
                          return (
                            <div key={q} className="flex items-center gap-1.5 bg-black/40 border border-white/5 rounded-lg px-2 py-1 text-[9px] font-bold">
                              <span className={cn("font-black tracking-tight", colors[q].text)}>{q}</span>
                              <div className="w-10 h-1 bg-white/[0.04] rounded-full overflow-hidden shrink-0">
                                <div className={cn("h-full rounded-full transition-all duration-500", colors[q].fill)} style={{ width: `${progress}%` }} />
                              </div>
                              <span className="text-zinc-500 font-mono">{progress}%</span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="relative group-hover/btn:scale-105 transition-transform duration-300 shrink-0 sm:ml-auto">
                        <ProgressRing value={yearProgress} size={50} />
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 shrink-0 ml-4" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setDeletingYear(year)}
                      className="flex size-9 items-center justify-center rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:text-red-300 hover:scale-105 active:scale-95 transition-all shadow-[0_0_15px_rgba(239,68,68,0.1)]"
                      title="Eliminar año"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                {/* Quarters */}
                {!isCollapsed && (
                  <div className="divide-y divide-border/40">
                    {QUARTERS.map((q) => {
                      const qRows = (yearData[q] || []).sort(
                        (a, b) => a.monthNumber - b.monthNumber
                      );
                      if (qRows.length === 0) return null;

                      const qKey = `${year}-${q}`;
                      const isQCollapsed = collapsedQuarters.has(qKey);
                      const quarterProgress = getQuarterProgress(qRows);
                      const quarterCompleted = qRows.filter(
                        (r) => r.status === "COMPLETADO"
                      ).length;

                      const isCurrentOver = dragOverZone === qKey;

                      // Highlight active drag-over zone
                      const dragOverClasses = isCurrentOver
                        ? {
                            Q1: "bg-rose-500/5 ring-2 ring-rose-500/30",
                            Q2: "bg-emerald-500/5 ring-2 ring-emerald-500/30",
                            Q3: "bg-sky-500/5 ring-2 ring-sky-500/30",
                            Q4: "bg-violet-500/5 ring-2 ring-violet-500/30",
                          }[q]
                        : "";

                      return (
                        <div
                          key={q}
                          onDragOver={(e) => handleDragOver(e, qKey)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, year, parseInt(q.replace('Q', '')) as 1|2|3|4)}
                          className={cn(
                            "transition-all duration-300 relative",
                            dragOverClasses
                          )}
                        >
                          {/* Drop Indicator overlay */}
                          {isCurrentOver && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[2px] z-30 pointer-events-none transition-all duration-300 border-2 border-dashed border-primary/30 m-1 rounded-2xl">
                              <div className="flex items-center gap-2 rounded-xl bg-card border border-border/80 px-4 py-2.5 shadow-lg animate-bounce">
                                <Sparkles className="size-4 text-primary animate-pulse" />
                                <span className="text-xs font-bold text-foreground">Soltar para mover a {q}</span>
                              </div>
                            </div>
                          )}

                          {/* Quarter header */}
                          <div
                            className={cn(
                              "px-5 py-4 sm:px-8 border-l-[6px] transition-all bg-[#0a0a0c]/40 border-b border-white/[0.02]",
                              {
                                Q1: "border-rose-500/80 bg-rose-500/[0.01] hover:bg-rose-500/[0.03]",
                                Q2: "border-emerald-500/80 bg-emerald-500/[0.01] hover:bg-emerald-500/[0.03]",
                                Q3: "border-sky-500/80 bg-sky-500/[0.01] hover:bg-sky-500/[0.03]",
                                Q4: "border-violet-500/80 bg-violet-500/[0.01] hover:bg-violet-500/[0.03]",
                              }[q]
                            )}
                          >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                              <button
                                onClick={() => toggleQuarter(qKey)}
                                className="flex items-center gap-4 text-left group/qbtn"
                              >
                                <div className="flex size-9 items-center justify-center rounded-xl bg-background/60 border border-white/5 text-zinc-400 group-hover/qbtn:bg-background group-hover/qbtn:text-white transition-all">
                                  {isQCollapsed ? (
                                    <ChevronRight className="size-4" />
                                  ) : (
                                    <ChevronDown className="size-4" />
                                  )}
                                </div>

                                <div>
                                  <div className="flex items-center gap-3">
                                    <h3 className="text-sm font-black text-white tracking-tight uppercase">
                                      {q}
                                    </h3>
                                    <span className="text-[10px] text-zinc-400 bg-white/5 border border-white/5 rounded-lg px-2 py-0.5 font-bold uppercase tracking-wider">
                                      {QUARTER_MONTHS[q]
                                        .map((m) => m.name)
                                        .join(" · ")}
                                    </span>
                                  </div>
                                  <div className="mt-2 flex items-center gap-3">
                                    <div className="w-24">
                                      <ProgressBar 
                                        value={quarterProgress} 
                                        className={cn(
                                          {
                                            Q1: "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]",
                                            Q2: "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]",
                                            Q3: "bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.3)]",
                                            Q4: "bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.3)]",
                                          }[q]
                                        )} 
                                      />
                                    </div>
                                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                      {quarterCompleted}/{qRows.length} Completado · {quarterProgress}%
                                    </span>
                                  </div>
                                </div>
                              </button>
                            </div>

                            {!isQCollapsed && (
                              <div className="mt-4 rounded-2xl border border-white/5 bg-[#0c0c0e]/80 p-4 backdrop-blur-md group/q">
                                <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                                    <Target className="size-3.5 text-amber-500" />
                                    Metas del trimestre
                                  </p>
                                  <button
                                    onClick={() => openNewGoal(year, "QUARTERLY", parseInt(q.replace('Q', '')) as 1|2|3|4)}
                                    className={cn(
                                      "text-[10px] uppercase font-black text-amber-500 transition-all hover:text-amber-400 flex items-center gap-1",
                                      goals.filter(g => g.period === "QUARTERLY" && g.year === year && g.quarter === parseInt(q.replace('Q', ''))).length === 0
                                        ? "opacity-100"
                                        : "opacity-60 group-hover/q:opacity-100"
                                    )}
                                  >
                                     <Plus className="size-3" /> Añadir Meta
                                  </button>
                                </div>
                                {goals.filter(g => g.period === "QUARTERLY" && g.year === year && g.quarter === parseInt(q.replace('Q', ''))).length > 0 ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mt-2">
                                    {goals.filter(g => g.period === "QUARTERLY" && g.year === year && g.quarter === parseInt(q.replace('Q', ''))).map(g => (
                                       <div 
                                         key={g.id} 
                                         draggable={activeMoveGoalId !== g.id}
                                         onDragStart={(e) => handleDragStart(e, g.id)}
                                         onDragEnd={handleDragEnd}
                                         className={cn(
                                           "group/item relative flex flex-col items-stretch justify-center bg-[#0c0c0e]/80 hover:bg-[#121215] p-3.5 rounded-2xl border border-white/[0.04] hover:border-white/10 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 select-none",
                                           activeMoveGoalId !== g.id && "cursor-grab active:cursor-grabbing",
                                           draggedGoalId === g.id && "opacity-45 scale-95 border-dashed border-primary"
                                         )} 
                                         onClick={() => { 
                                           if (activeMoveGoalId !== g.id) {
                                             setEditingGoal(g); 
                                             setShowGoalForm(true); 
                                           }
                                         }}
                                       >
                                          {activeMoveGoalId === g.id ? (
                                            <div className="flex-1 flex flex-col gap-2 min-w-0" onClick={(e) => e.stopPropagation()}>
                                              <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Mover meta a:</span>
                                                <button 
                                                  onClick={() => setActiveMoveGoalId(null)}
                                                  className="text-zinc-500 hover:text-white text-[9px] font-black flex items-center gap-0.5"
                                                >
                                                  <X className="size-3" /> Cancelar
                                                </button>
                                              </div>
                                              <div className="grid grid-cols-4 gap-1.5">
                                                {QUARTERS.map((quarterKey) => {
                                                  const qNum = parseInt(quarterKey.replace('Q', ''));
                                                  const isCurrent = g.quarter === qNum;
                                                  return (
                                                    <button
                                                      key={quarterKey}
                                                      disabled={isCurrent}
                                                      onClick={async () => {
                                                        await handleMoveGoal(g.id, year, qNum);
                                                        setActiveMoveGoalId(null);
                                                      }}
                                                      className={cn(
                                                        "px-1.5 py-1 rounded-lg text-center text-xs font-black transition-all cursor-pointer",
                                                        isCurrent 
                                                          ? "bg-white/5 text-zinc-600 border border-white/5 cursor-not-allowed"
                                                          : {
                                                              Q1: "hover:bg-rose-500/20 hover:text-rose-300 text-rose-400 bg-rose-500/10 border border-rose-500/10",
                                                              Q2: "hover:bg-emerald-500/20 hover:text-emerald-300 text-emerald-400 bg-emerald-500/10 border border-emerald-500/10",
                                                              Q3: "hover:bg-sky-500/20 hover:text-sky-300 text-sky-400 bg-sky-500/10 border border-sky-500/10",
                                                              Q4: "hover:bg-violet-500/20 hover:text-violet-300 text-violet-400 bg-violet-500/10 border border-violet-500/10",
                                                            }[quarterKey]
                                                      )}
                                                    >
                                                      {quarterKey}
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="flex items-center gap-3 w-full">
                                              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.05)]">
                                                <Target className="size-4 text-amber-400" />
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <p className="font-bold text-zinc-100 group-hover/item:text-white truncate leading-snug tracking-tight text-sm">{g.name}</p>
                                                <p className="text-[10px] font-extrabold text-amber-500 mt-1 font-mono tracking-wider">{g.progress}%</p>
                                              </div>
                                              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                                {/* Quick Move Button */}
                                                <button
                                                  onClick={() => setActiveMoveGoalId(g.id)}
                                                  className="p-1.5 rounded-lg text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                                                  title="Mover de trimestre"
                                                >
                                                  <ArrowRightLeft className="size-3.5" />
                                                </button>

                                                {/* Drag Handle (Desktop only) */}
                                                <div className="p-1.5 rounded-lg text-zinc-600 group-hover/item:text-zinc-400 transition-all cursor-grab hidden sm:block" title="Arrastra para mover a otro trimestre">
                                                  <Move className="size-3.5" />
                                                </div>

                                                {/* Delete button */}
                                                <button 
                                                   onClick={(e) => handleDeleteGoal(g.id, e)} 
                                                   className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                                   title="Eliminar meta"
                                                >
                                                   <Trash className="size-3.5" />
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-zinc-500 italic mt-1 pl-1">
                                    Sin metas trimestrales definidas.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                           {/* Months grid */}
                          {!isQCollapsed && (
                            <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-6 bg-[#0a0a0c]/20 backdrop-blur-[1px]">
                              {qRows.map((row) => (
                                <MonthCard
                                  key={row.id}
                                  row={row}
                                  monthGoals={goals.filter(g => g.period === "MONTHLY" && g.year === year && g.month === row.monthNumber)}
                                  onEdit={openEditRow}
                                  onAddGoal={() => openNewGoal(year, "MONTHLY", undefined, row.monthNumber)}
                                  onEditGoal={(g) => { setEditingGoal(g); setShowGoalForm(true); }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* Edit month row */}
        {editingRow && (
          <ModalShell
            title={`${editingRow.month} ${editingRow.year}`}
            subtitle={`${editingRow.quarter} · Ajusta meta y estado`}
            onClose={() => setEditingRow(null)}
          >
            <div>
              <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">
                Meta mensual (Enfoque principal)
              </label>
              <textarea
                value={fMonthlyGoal}
                onChange={(e) => setFMonthlyGoal(e.target.value)}
                rows={3}
                placeholder="¿Cuál es tu enfoque este mes?"
                className="w-full px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors resize-none"
              />
            </div>

            <div>
              <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">
                Proyectos adicionales
              </label>
              <input
                value={fActivities}
                onChange={(e) => setFActivities(e.target.value)}
                placeholder="Ej: Proyecto X, Curso Y, Gym"
                className="w-full px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">
                  Estado
                </label>
                <select
                  value={fStatus}
                  onChange={(e) => setFStatus(e.target.value as RoadmapStatus)}
                  className="w-full px-3 py-3 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50 appearance-none font-medium"
                >
                  {(Object.keys(STATUS_CONFIG) as RoadmapStatus[]).map((s) => (
                    <option key={s} value={s} className="bg-zinc-900">
                      {STATUS_CONFIG[s].label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">
                  Notas
                </label>
                <input
                  value={fComments}
                  onChange={(e) => setFComments(e.target.value)}
                  placeholder="Notas breves"
                  className="w-full px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
              <button
                onClick={() => setEditingRow(null)}
                className="btn-secondary h-10 px-4 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveRow}
                className="btn-primary pl-4 pr-5 h-10 flex items-center gap-1.5 rounded-xl text-xs font-black shadow-[0_0_20px_rgba(245,158,11,0.15)]"
              >
                <Check className="size-4" />
                Guardar
              </button>
            </div>
          </ModalShell>
        )}



        {/* Add year */}
        {showAddYear && (
          <ModalShell
            title="Agregar año"
            subtitle="Se generarán automáticamente los 12 meses del plan"
            onClose={() => setShowAddYear(false)}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">
                  Año
                </label>
                <input
                  type="number"
                  value={fYear}
                  onChange={(e) => setFYear(Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">
                  Edad
                </label>
                <input
                  type="number"
                  value={fAge}
                  onChange={(e) => setFAge(Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
            </div>

            {sortedYears.includes(fYear) && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-xs text-red-400 font-bold">
                Ya existe un plan para {fYear}.
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
              <button
                onClick={() => setShowAddYear(false)}
                className="btn-secondary h-10 px-4 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>

              <button
                onClick={handleAddYear}
                disabled={sortedYears.includes(fYear)}
                className="btn-primary pl-4 pr-5 h-10 flex items-center gap-1.5 rounded-xl text-xs font-black shadow-[0_0_20px_rgba(245,158,11,0.15)] disabled:opacity-50 disabled:grayscale"
              >
                Crear año completo
              </button>
            </div>
          </ModalShell>
        )}

        {/* Confirm delete year */}
        {deletingYear !== null && (
          <ModalShell
            title={`¿Eliminar ${deletingYear}?`}
            subtitle="Esta acción no se puede deshacer"
            onClose={() => setDeletingYear(null)}
          >
            <p className="text-xs text-zinc-400 leading-relaxed">
              Se eliminarán los 12 meses del plan junto con todas las metas y notas asociadas.
            </p>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
              <button
                onClick={() => setDeletingYear(null)}
                className="btn-secondary h-10 px-4 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteYear(deletingYear)}
                className="h-10 px-5 rounded-xl text-xs font-black bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors shadow-[0_0_20px_rgba(239,68,68,0.15)]"
              >
                Eliminar año
              </button>
            </div>
          </ModalShell>
        )}

        <GoalSlideOver
          isOpen={showGoalForm || !!editingGoal}
          onClose={() => { setShowGoalForm(false); setEditingGoal(null); }}
          initial={editingGoal || goalFormContext}

          goals={goals}
          onSave={handleSaveGoal}
        />
    </div>
  );
}
