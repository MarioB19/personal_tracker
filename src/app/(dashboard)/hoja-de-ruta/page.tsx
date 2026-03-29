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
  Trash
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
      className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            {subtitle && (
              <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>

          <button
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 p-6">{children}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: RoadmapStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        cfg.bgClass,
        cfg.textClass
      )}
    >
      <Icon className="size-3" />
      {cfg.label}
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
          className="text-muted"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className="text-primary transition-all duration-500"
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
        <span className="text-xs font-bold text-foreground">{value}%</span>
      </div>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-all duration-500"
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

  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-card p-4 transition-all hover:shadow-md",
        hasContent ? "border-border" : "border-dashed border-border/60"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-foreground">{row.month}</h4>
            <StatusBadge status={row.status} />
          </div>

          {row.monthlyGoal && (
            <p className="mt-2 text-sm leading-relaxed text-foreground/80 line-clamp-2">
              {row.monthlyGoal}
            </p>
          )}

          {row.activities && (
            <p className="mt-1.5 text-xs text-muted-foreground line-clamp-1">
              {row.activities}
            </p>
          )}

          {monthGoals.length > 0 && (
            <div className="mt-3 space-y-2">
              {monthGoals.map(g => (
                <div key={g.id} className="flex items-center gap-2 text-sm bg-background/50 p-2 rounded-lg border border-border/50 group/goal cursor-pointer hover:bg-background transition-colors" onClick={(e) => { e.stopPropagation(); onEditGoal(g); }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="flex-1 truncate">{g.name}</span>
                  <span className="text-[10px] text-muted-foreground">{g.progress}%</span>
                </div>
              ))}
            </div>
          )}

          <button onClick={(e) => { e.stopPropagation(); onAddGoal(); }} className="mt-3 text-[10px] uppercase font-bold text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity hover:underline">
             + Añadir Meta
          </button>

          {!hasContent && (
            <p className="mt-2 text-sm text-muted-foreground/60">
              Sin metas definidas
            </p>
          )}
        </div>

        <button
          onClick={() => onEdit(row)}
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100 shrink-0"
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
  const [editingGoals, setEditingGoals] = useState<{
    type: "annual" | "quarterly";
    year: number;
    quarter?: RoadmapQuarterKey;
    currentValue: string;
  } | null>(null);
  const [showAddYear, setShowAddYear] = useState(false);
  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(new Set());
  const [collapsedQuarters, setCollapsedQuarters] = useState<Set<string>>(
    new Set()
  );
  const [deletingYear, setDeletingYear] = useState<number | null>(null);

  const [fMonthlyGoal, setFMonthlyGoal] = useState("");
  const [fActivities, setFActivities] = useState("");
  const [fStatus, setFStatus] = useState<RoadmapStatus>("VACÍO");
  const [fComments, setFComments] = useState("");
  const [fGoalsText, setFGoalsText] = useState("");
  const [fYear, setFYear] = useState(new Date().getFullYear() + 1);
  const [fAge, setFAge] = useState(20);

  const [goals, setGoals] = useState<Goal[]>([]);

  
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

  const openEditGoals = (
    type: "annual" | "quarterly",
    year: number,
    quarter?: RoadmapQuarterKey,
    val?: string
  ) => {
    setFGoalsText(val || "");
    setEditingGoals({
      type,
      year,
      quarter,
      currentValue: val || "",
    });
  };



  const handleSaveGoals = async () => {
    if (!uid || !editingGoals) return;

    const { type, year, quarter } = editingGoals;

    const toUpdate = rows.filter((r) => {
      if (r.year !== year) return false;
      if (type === "quarterly") return r.quarter === quarter;
      return true;
    });

    await Promise.all(
      toUpdate.map((r) =>
        update(uid, "roadmap", r.id, {
          [type === "annual" ? "annualGoals" : "quarterlyGoals"]: fGoalsText,
        })
      )
    );

    setEditingGoals(null);
    loadData();
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
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        {/* Header */}
        <header className="mb-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                <Compass className="size-3.5" />
                Planificación Personal
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Hoja de Ruta
              </h1>

              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                Organiza tus metas por año, trimestre y mes. Visualiza tu progreso y mantén el enfoque en lo que importa.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <StatCard
                icon={CalendarDays}
                label="Años planeados"
                value={sortedYears.length}
              />
              <button
                onClick={() => {
                  setFYear(new Date().getFullYear() + 1);
                  setFAge(20);
                  setShowAddYear(true);
                }}
                className="inline-flex h-[58px] items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md"
              >
                <Plus className="size-4" />
                Agregar año
              </button>
            </div>
          </div>
        </header>

        {/* Empty state */}
        {sortedYears.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card/50 px-6 py-20 text-center">
            <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-primary/10">
              <Sparkles className="size-10 text-primary" />
            </div>

            <h2 className="text-xl font-semibold text-foreground">
              Comienza tu planificación
            </h2>

            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Crea tu primer año para estructurar metas anuales, trimestrales y mensuales de forma clara y organizada.
            </p>

            <button
              onClick={() => {
                setFYear(new Date().getFullYear());
                setFAge(20);
                setShowAddYear(true);
              }}
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
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
            const annualGoals = firstRow?.annualGoals ?? "";
            const completedCount = allYearRows.filter(
              (r) => r.status === "COMPLETADO"
            ).length;
            const yearProgress = getYearProgress(allYearRows);

            return (
              <section
                key={year}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
              >
                {/* Year header */}
                <div className="border-b border-border bg-muted/30 px-5 py-4 sm:px-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <button
                      onClick={() => toggleYear(year)}
                      className="flex items-center gap-4 text-left"
                    >
                      <div className="flex size-10 items-center justify-center rounded-lg bg-background text-muted-foreground">
                        {isCollapsed ? (
                          <ChevronRight className="size-5" />
                        ) : (
                          <ChevronDown className="size-5" />
                        )}
                      </div>

                      <div className="flex items-center gap-4">
                        <div>
                          <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold text-foreground">
                              {year}
                            </h2>
                            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                              {age} años
                            </span>
                          </div>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {completedCount} de {allYearRows.length} meses completados
                          </p>
                        </div>

                        <ProgressRing value={yearProgress} size={52} />
                      </div>
                    </button>

                    <div className="flex items-center gap-1">
                      <IconButton
                        onClick={() =>
                          openEditGoals("annual", year, undefined, annualGoals)
                        }
                        icon={Target}
                        label="Metas"
                      />
                      <IconButton
                        onClick={() => setDeletingYear(year)}
                        icon={Trash2}
                        variant="danger"
                      />
                    </div>
                  </div>
                </div>

                {/* Annual goals */}
                {!isCollapsed && (annualGoals || goals.filter(g => g.period === "ANNUAL" && g.year === year).length > 0) && (
                  <div className="border-b border-border bg-primary/5 px-5 py-4 sm:px-6 relative group">
                    <div className="flex items-start gap-3">
                      <Target className="mt-0.5 size-4 text-primary" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                            Metas del año
                          </p>
                          <button onClick={() => openNewGoal(year, "ANNUAL")} className="text-[10px] uppercase font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity hover:underline">
                             + Añadir Meta
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {goals.filter(g => g.period === "ANNUAL" && g.year === year).map(g => (
                             <div key={g.id} className="flex items-center gap-2 text-sm bg-background/50 p-2.5 rounded-lg border border-primary/20 cursor-pointer hover:bg-background shadow-sm transition-all" onClick={() => { setEditingGoal(g); setShowGoalForm(true); }}>
                               <div className="flex size-6 items-center justify-center rounded bg-primary/10">
                                 <Target className="size-3.5 text-primary" />
                               </div>
                               <span className="flex-1 font-medium truncate">{g.name}</span>
                               <span className="text-xs font-semibold text-primary">{g.progress}%</span>
                               <button 
                                  onClick={(e) => handleDeleteGoal(g.id, e)} 
                                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
                               >
                                  <Trash className="size-3.5" />
                               </button>
                             </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Quarters */}
                {!isCollapsed && (
                  <div className="divide-y divide-border">
                    {QUARTERS.map((q) => {
                      const qRows = (yearData[q] || []).sort(
                        (a, b) => a.monthNumber - b.monthNumber
                      );
                      if (qRows.length === 0) return null;

                      const qKey = `${year}-${q}`;
                      const isQCollapsed = collapsedQuarters.has(qKey);
                      const qGoals = qRows[0]?.quarterlyGoals ?? "";
                      const quarterProgress = getQuarterProgress(qRows);
                      const quarterCompleted = qRows.filter(
                        (r) => r.status === "COMPLETADO"
                      ).length;

                      return (
                        <div key={q}>
                          {/* Quarter header */}
                          <div
                            className={cn(
                              "px-5 py-4 sm:px-6",
                              `bg-gradient-to-r ${QUARTER_COLORS[q]}`
                            )}
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <button
                                onClick={() => toggleQuarter(qKey)}
                                className="flex items-center gap-3 text-left"
                              >
                                <div className="flex size-8 items-center justify-center rounded-md bg-background/80 text-muted-foreground">
                                  {isQCollapsed ? (
                                    <ChevronRight className="size-4" />
                                  ) : (
                                    <ChevronDown className="size-4" />
                                  )}
                                </div>

                                <div>
                                  <div className="flex items-center gap-3">
                                    <h3 className="text-lg font-semibold text-foreground">
                                      {q}
                                    </h3>
                                    <span className="text-sm text-muted-foreground">
                                      {QUARTER_MONTHS[q]
                                        .map((m) => m.name)
                                        .join(" · ")}
                                    </span>
                                  </div>
                                  <div className="mt-1.5 flex items-center gap-3">
                                    <div className="w-24">
                                      <ProgressBar value={quarterProgress} />
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      {quarterCompleted}/{qRows.length} · {quarterProgress}%
                                    </span>
                                  </div>
                                </div>
                              </button>
                            </div>

                            {!isQCollapsed && (qGoals || goals.filter(g => g.period === "QUARTERLY" && g.year === year && g.quarter === parseInt(q.replace('Q', ''))).length > 0) && (
                              <div className="mt-3 rounded-lg bg-background/60 p-3 group/q">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs font-medium text-muted-foreground">
                                    Metas del trimestre
                                  </p>
                                  <button onClick={() => openNewGoal(year, "QUARTERLY", parseInt(q.replace('Q', '')) as 1|2|3|4)} className="text-[10px] uppercase font-bold text-primary opacity-0 group-hover/q:opacity-100 transition-opacity hover:underline">
                                     + Añadir Meta
                                  </button>
                                </div>
                                <div className="space-y-1.5 mt-2">
                                  {goals.filter(g => g.period === "QUARTERLY" && g.year === year && g.quarter === parseInt(q.replace('Q', ''))).map(g => (
                                     <div key={g.id} className="group/item flex items-center gap-2 text-sm bg-background p-2 rounded-md border border-border/50 cursor-pointer hover:border-border transition-colors" onClick={() => { setEditingGoal(g); setShowGoalForm(true); }}>
                                       <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                       <span className="flex-1 truncate">{g.name}</span>
                                       <span className="text-[10px] text-muted-foreground mr-1">{g.progress}%</span>
                                       <button 
                                          onClick={(e) => handleDeleteGoal(g.id, e)} 
                                          className="opacity-0 group-hover/item:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-all"
                                       >
                                          <Trash className="size-3" />
                                       </button>
                                     </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                           {/* Months grid */}
                          {!isQCollapsed && (
                            <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
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
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Meta mensual
              </label>
              <textarea
                value={fMonthlyGoal}
                onChange={(e) => setFMonthlyGoal(e.target.value)}
                rows={3}
                placeholder="¿Cuál es tu enfoque este mes?"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Proyectos adicionales
              </label>
              <input
                value={fActivities}
                onChange={(e) => setFActivities(e.target.value)}
                placeholder="Ej: Proyecto X, Curso Y, Gym"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Estado
                </label>
                <select
                  value={fStatus}
                  onChange={(e) => setFStatus(e.target.value as RoadmapStatus)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {(Object.keys(STATUS_CONFIG) as RoadmapStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_CONFIG[s].label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Notas
                </label>
                <input
                  value={fComments}
                  onChange={(e) => setFComments(e.target.value)}
                  placeholder="Notas breves"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingRow(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveRow}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Check className="size-4" />
                Guardar
              </button>
            </div>
          </ModalShell>
        )}

        {/* Edit goals */}
        {editingGoals && (
          <ModalShell
            title={
              editingGoals.type === "annual"
                ? `Metas Anuales ${editingGoals.year}`
                : `Metas ${editingGoals.quarter} · ${editingGoals.year}`
            }
            subtitle="Escribe una meta por línea para mantenerlo más claro"
            onClose={() => setEditingGoals(null)}
          >
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Metas
              </label>
              <textarea
                value={fGoalsText}
                onChange={(e) => setFGoalsText(e.target.value)}
                rows={8}
                placeholder={"1) Primera meta\n2) Segunda meta\n3) Tercera meta"}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditingGoals(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveGoals}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
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
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Año
                </label>
                <input
                  type="number"
                  value={fYear}
                  onChange={(e) => setFYear(Number(e.target.value))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Edad
                </label>
                <input
                  type="number"
                  value={fAge}
                  onChange={(e) => setFAge(Number(e.target.value))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            {sortedYears.includes(fYear) && (
              <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                Ya existe un plan para {fYear}.
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddYear(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Cancelar
              </button>

              <button
                onClick={handleAddYear}
                disabled={sortedYears.includes(fYear)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
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
            <p className="text-sm text-muted-foreground">
              Se eliminarán los 12 meses del plan junto con todas las metas y notas asociadas.
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeletingYear(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteYear(deletingYear)}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
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
    </div>
  );
}
