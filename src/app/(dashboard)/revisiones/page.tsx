"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth, useUid } from "@/lib/hooks/useAuth";
import { getAll, create, remove, update } from "@/lib/repositories/firestore";
import { Review, ReviewType, SelfEvaluations, SelfEvaluationDetail } from "@/lib/types";
import {
  ClipboardCheck,
  Plus,
  X,
  Save,
  Trash2,
  ChevronDown,
  Star,
  Trophy,
  Brain,
  ShieldAlert,
  Wrench,
  Target,
  Dumbbell,
  Briefcase,
  Rocket,
  Users,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  Calendar,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

// Options for WEEKLY, MONTHLY, and ANNUAL reviews
const REVIEW_TYPES: { key: ReviewType; label: string }[] = [
  { key: "WEEKLY", label: "Semanal" },
  { key: "MONTHLY", label: "Mensual" },
  { key: "ANNUAL", label: "Anual" },
];

const TYPE_LABELS: Record<ReviewType, string> = {
  WEEKLY: "Semanal",
  MONTHLY: "Mensual",
  ANNUAL: "Anual",
  BIWEEKLY: "Quincenal",
  QUARTERLY: "Trimestral",
};

function getReviewTypeBadgeClass(type: ReviewType) {
  switch (type) {
    case "WEEKLY":
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "MONTHLY":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "ANNUAL":
      return "bg-violet-500/10 text-violet-400 border-violet-500/20";
    default:
      return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  }
}

const DIMENSIONS_CONFIG = [
  {
    key: "yoFisico" as const,
    label: "Mi Yo Físico",
    description: "Salud, alimentación, ejercicio y energía vital.",
    icon: Dumbbell,
    color: "emerald",
    placeholder: "¿Cómo cuidaste tu cuerpo, alimentación y entrenamiento en este ciclo?..."
  },
  {
    key: "yoProfesional" as const,
    label: "Mi Yo Profesional",
    description: "Carrera, desarrollo laboral y nuevas habilidades.",
    icon: Briefcase,
    color: "sky",
    placeholder: "¿Qué avances tuviste en tu trabajo o aprendizaje profesional?..."
  },
  {
    key: "yoEmprendedor" as const,
    label: "Mi Yo Emprendedor",
    description: "Proyectos propios, negocios y finanzas personales.",
    icon: Rocket,
    color: "violet",
    placeholder: "¿Cómo progresaron tus proyectos, ideas de negocio y finanzas?..."
  },
  {
    key: "yoMental" as const,
    label: "Mi Yo Mental/Intelectual",
    description: "Enfoque, paz mental, lecturas y desarrollo intelectual.",
    icon: Brain,
    color: "pink",
    placeholder: "¿Cómo nutriste tu mente, tus lecturas y cuidaste tu paz mental?..."
  },
  {
    key: "yoRelacional" as const,
    label: "Mi Yo Relacional",
    description: "Conexiones con familia, pareja, amigos y entorno.",
    icon: Users,
    color: "indigo",
    placeholder: "¿Cómo cultivaste tus relaciones personales y afectivas?..."
  },
  {
    key: "yoEspiritual" as const,
    label: "Mi Yo Espiritual",
    description: "Conexión interior, meditación, gratitud y presencia.",
    icon: Sparkles,
    color: "teal",
    placeholder: "¿Cómo nutriste tu espíritu, momentos de silencio o gratitud?..."
  },
  {
    key: "yoProposito" as const,
    label: "Mi Yo Propósito",
    description: "Dirección de vida, alineación de valores y legado.",
    icon: Target,
    color: "amber",
    placeholder: "¿Qué tan alineado estuviste con tu propósito y metas de vida?..."
  }
];

const COLOR_MAPS: Record<string, {
  text: string;
  bg: string;
  border: string;
  ring: string;
  starActive: string;
  bgHover: string;
  glow: string;
}> = {
  emerald: {
    text: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    ring: "focus-within:border-emerald-500/40",
    starActive: "text-emerald-400 fill-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]",
    bgHover: "hover:bg-emerald-500/5",
    glow: "shadow-[0_0_15px_rgba(52,211,153,0.03)]"
  },
  sky: {
    text: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/20",
    ring: "focus-within:border-sky-500/40",
    starActive: "text-sky-400 fill-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.4)]",
    bgHover: "hover:bg-sky-500/5",
    glow: "shadow-[0_0_15px_rgba(56,189,248,0.03)]"
  },
  violet: {
    text: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    ring: "focus-within:border-violet-500/40",
    starActive: "text-violet-400 fill-violet-400 drop-shadow-[0_0_8px_rgba(139,92,246,0.4)]",
    bgHover: "hover:bg-violet-500/5",
    glow: "shadow-[0_0_15px_rgba(139,92,246,0.03)]"
  },
  pink: {
    text: "text-pink-400",
    bg: "bg-pink-500/10",
    border: "border-pink-500/20",
    ring: "focus-within:border-pink-500/40",
    starActive: "text-pink-400 fill-pink-400 drop-shadow-[0_0_8px_rgba(236,72,153,0.4)]",
    bgHover: "hover:bg-pink-500/5",
    glow: "shadow-[0_0_15px_rgba(236,72,153,0.03)]"
  },
  indigo: {
    text: "text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
    ring: "focus-within:border-indigo-500/40",
    starActive: "text-indigo-400 fill-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.4)]",
    bgHover: "hover:bg-indigo-500/5",
    glow: "shadow-[0_0_15px_rgba(99,102,241,0.03)]"
  },
  teal: {
    text: "text-teal-400",
    bg: "bg-teal-500/10",
    border: "border-teal-500/20",
    ring: "focus-within:border-teal-500/40",
    starActive: "text-teal-400 fill-teal-400 drop-shadow-[0_0_8px_rgba(20,184,166,0.4)]",
    bgHover: "hover:bg-teal-500/5",
    glow: "shadow-[0_0_15px_rgba(20,184,166,0.03)]"
  },
  amber: {
    text: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    ring: "focus-within:border-amber-500/40",
    starActive: "text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]",
    bgHover: "hover:bg-amber-500/5",
    glow: "shadow-[0_0_15px_rgba(245,158,11,0.03)]"
  }
};

function generatePeriod(type: ReviewType): string {
  const now = new Date();
  const year = now.getFullYear();
  const monthFull = now.toLocaleString("es-ES", { month: "long" });

  if (type === "WEEKLY") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return `Semana ${weekNum} - ${year}`;
  } else if (type === "MONTHLY") {
    return `${monthFull.charAt(0).toUpperCase() + monthFull.slice(1)} ${year}`;
  } else if (type === "ANNUAL") {
    return `${year}`;
  }
  return "";
}

function calculateReviewRating(generalRating: number, selfEvs?: SelfEvaluations): number {
  if (!selfEvs) return generalRating;
  const keys: (keyof SelfEvaluations)[] = [
    "yoFisico",
    "yoProfesional",
    "yoEmprendedor",
    "yoMental",
    "yoRelacional",
    "yoEspiritual",
    "yoProposito"
  ];
  let sum = 0;
  let count = 0;
  keys.forEach((key) => {
    const detail = selfEvs[key];
    if (detail && typeof detail.rating === "number") {
      sum += detail.rating;
      count++;
    }
  });
  const avgDimensions = count > 0 ? sum / count : generalRating;
  const val = (generalRating / 2) + (avgDimensions / 2);
  return Math.round(val * 100) / 100;
}

export default function RevisionesPage() {
  const { user } = useAuth();
  const uid = useUid();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"history" | "dashboard">("history");

  // Form State
  const [formTab, setFormTab] = useState<"retro" | "dimensions">("retro");
  const [type, setType] = useState<ReviewType>("WEEKLY");
  const [period, setPeriod] = useState("");
  const [achievements, setAchievements] = useState("");
  const [pendingItems, setPendingItems] = useState("");
  const [blockers, setBlockers] = useState("");
  const [learnings, setLearnings] = useState("");
  const [adjustments, setAdjustments] = useState("");
  const [nextFocus, setNextFocus] = useState("");
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(3);

  // Self evaluations initial state (7 selves)
  const [selfEvaluations, setSelfEvaluations] = useState<Record<string, SelfEvaluationDetail>>({
    yoFisico: { rating: 3, comment: "" },
    yoProfesional: { rating: 3, comment: "" },
    yoEmprendedor: { rating: 3, comment: "" },
    yoMental: { rating: 3, comment: "" },
    yoRelacional: { rating: 3, comment: "" },
    yoEspiritual: { rating: 3, comment: "" },
    yoProposito: { rating: 3, comment: "" },
  });

  const calculatedLiveRating = useMemo(() => {
    return calculateReviewRating(rating, selfEvaluations as SelfEvaluations);
  }, [rating, selfEvaluations]);

  const monthlyMetrics = useMemo(() => {
    const monthlyDataMap: Record<string, {
      monthKey: string;
      monthLabel: string;
      reviewsCount: number;
      overallSum: number;
      dimensionsSums: Record<string, number>;
      dimensionsCounts: Record<string, number>;
    }> = {};

    reviews.forEach((r) => {
      if (!r.createdAt) return;
      let date: Date;
      try {
        date = r.createdAt.toDate();
      } catch {
        return;
      }
      const year = date.getFullYear();
      const month = date.getMonth();
      const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
      
      const monthNamesShort = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      const monthLabel = `${monthNamesShort[month]} ${year}`;

      if (!monthlyDataMap[monthKey]) {
        monthlyDataMap[monthKey] = {
          monthKey,
          monthLabel,
          reviewsCount: 0,
          overallSum: 0,
          dimensionsSums: {
            yoFisico: 0,
            yoProfesional: 0,
            yoEmprendedor: 0,
            yoMental: 0,
            yoRelacional: 0,
            yoEspiritual: 0,
            yoProposito: 0,
          },
          dimensionsCounts: {
            yoFisico: 0,
            yoProfesional: 0,
            yoEmprendedor: 0,
            yoMental: 0,
            yoRelacional: 0,
            yoEspiritual: 0,
            yoProposito: 0,
          },
        };
      }

      const data = monthlyDataMap[monthKey];
      data.reviewsCount++;
      data.overallSum += r.overallRating || 0;

      const keys = ["yoFisico", "yoProfesional", "yoEmprendedor", "yoMental", "yoRelacional", "yoEspiritual", "yoProposito"];
      keys.forEach((key) => {
        const detail = r.selfEvaluations?.[key as keyof SelfEvaluations];
        if (detail && typeof detail.rating === "number") {
          data.dimensionsSums[key] += detail.rating;
          data.dimensionsCounts[key]++;
        }
      });
    });

    const sorted = Object.values(monthlyDataMap).sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    return sorted.map((m) => {
      const keys = ["yoFisico", "yoProfesional", "yoEmprendedor", "yoMental", "yoRelacional", "yoEspiritual", "yoProposito"];
      const avgDimensions: Record<string, number> = {};
      keys.forEach((key) => {
        const count = m.dimensionsCounts[key];
        avgDimensions[key] = count > 0 ? Math.round((m.dimensionsSums[key] / count) * 100) / 100 : 3;
      });

      return {
        monthKey: m.monthKey,
        name: m.monthLabel,
        overallRating: m.reviewsCount > 0 ? Math.round((m.overallSum / m.reviewsCount) * 100) / 100 : 0,
        ...avgDimensions,
      };
    });
  }, [reviews]);

  const dimensionComparison = useMemo(() => {
    if (monthlyMetrics.length === 0) return null;
    
    const latest = monthlyMetrics[monthlyMetrics.length - 1];
    const previous = monthlyMetrics.length > 1 ? monthlyMetrics[monthlyMetrics.length - 2] : null;

    const keys = [
      { key: "yoFisico", label: "Yo Físico", color: "emerald", icon: Dumbbell },
      { key: "yoProfesional", label: "Yo Profesional", color: "sky", icon: Briefcase },
      { key: "yoEmprendedor", label: "Yo Emprendedor", color: "violet", icon: Rocket },
      { key: "yoMental", label: "Yo Mental", color: "pink", icon: Brain },
      { key: "yoRelacional", label: "Yo Relacional", color: "indigo", icon: Users },
      { key: "yoEspiritual", label: "Yo Espiritual", color: "teal", icon: Sparkles },
      { key: "yoProposito", label: "Yo Propósito", color: "amber", icon: Target },
    ];

    return keys.map((dim) => {
      const currentVal = (latest as any)[dim.key] ?? 3;
      const prevVal = previous ? ((previous as any)[dim.key] ?? 3) : null;
      const diff = prevVal !== null ? Math.round((currentVal - prevVal) * 100) / 100 : 0;
      
      return {
        ...dim,
        currentVal,
        prevVal,
        diff,
      };
    });
  }, [monthlyMetrics]);

  const loadData = useCallback(async () => {
    if (!uid) return;
    try {
      const r = await getAll<Review>(uid, "reviews");
      const unmigrated = r.filter((rev) => rev.generalRating === undefined);
      
      if (unmigrated.length > 0) {
        console.log(`Migrating ${unmigrated.length} reviews...`);
        await Promise.all(
          unmigrated.map(async (rev) => {
            const generalRating = typeof rev.overallRating === "number" ? rev.overallRating : 3;
            const newOverallRating = calculateReviewRating(generalRating, rev.selfEvaluations);
            await update(uid, "reviews", rev.id, {
              generalRating,
              overallRating: newOverallRating,
            });
          })
        );
        const refreshed = await getAll<Review>(uid, "reviews");
        setReviews(refreshed);
      } else {
        setReviews(r);
      }
    } catch (err) {
      console.error("Error loading or migrating reviews:", err);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (showForm) {
      setPeriod(generatePeriod(type));
    }
  }, [type, showForm]);

  const handleSave = async () => {
    if (!user || !period.trim()) return;
    const splitLines = (text: string) => text.split("\n").filter((l) => l.trim());
    if (!uid) return;

    await create(uid, "reviews", {
      type,
      period,
      achievements: splitLines(achievements),
      pendingItems: splitLines(pendingItems),
      blockers: splitLines(blockers),
      learnings: splitLines(learnings),
      keyMetrics: [],
      adjustments: splitLines(adjustments),
      nextFocus,
      generalRating: rating,
      overallRating: calculatedLiveRating,
      selfEvaluations: selfEvaluations as SelfEvaluations,
    });

    setShowForm(false);
    setFormTab("retro");
    setType("WEEKLY");
    setPeriod("");
    setAchievements("");
    setPendingItems("");
    setBlockers("");
    setLearnings("");
    setAdjustments("");
    setNextFocus("");
    setRating(3);
    setSelfEvaluations({
      yoFisico: { rating: 3, comment: "" },
      yoProfesional: { rating: 3, comment: "" },
      yoEmprendedor: { rating: 3, comment: "" },
      yoMental: { rating: 3, comment: "" },
      yoRelacional: { rating: 3, comment: "" },
      yoEspiritual: { rating: 3, comment: "" },
      yoProposito: { rating: 3, comment: "" },
    });
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!uid) return;
    await remove(uid, "reviews", id);
    loadData();
  };

  const updateDimensionRating = (key: string, val: number) => {
    setSelfEvaluations((prev) => ({
      ...prev,
      [key]: { ...prev[key], rating: val },
    }));
  };

  const updateDimensionComment = (key: string, val: string) => {
    setSelfEvaluations((prev) => ({
      ...prev,
      [key]: { ...prev[key], comment: val },
    }));
  };

  const filtered = reviews.filter((r) => filterType === "ALL" || r.type === filterType);

  if (loading) {
    return (
      <div className="page-enter space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-40 bg-zinc-900 rounded animate-pulse" />
            <div className="h-4 w-28 bg-zinc-900/50 rounded animate-pulse" />
          </div>
          <div className="h-10 w-36 bg-zinc-900 rounded animate-pulse" />
        </div>
        <div className="h-12 w-64 bg-zinc-900/55 rounded-lg animate-pulse" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass-card-static p-6 h-28 animate-pulse border-zinc-900/60" />
        ))}
      </div>
    );
  }

  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-400">
              <ClipboardCheck className="w-5.5 h-5.5" />
            </div>
            Revisiones
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Mide tu progreso, ajusta tu rumbo y evalúa tus múltiples dimensiones.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={cn(
            "btn-primary flex items-center justify-center gap-2 px-5 py-2.5 font-semibold text-sm transition-all",
            showForm && "bg-zinc-800 border-zinc-700/60 text-zinc-300 shadow-none hover:shadow-none brightness-90"
          )}
        >
          {showForm ? (
            <>
              <X className="w-4 h-4" /> Cerrar formulario
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" /> Nueva revisión
            </>
          )}
        </button>
      </div>

      {/* View Mode Toggle: Historial vs Métricas */}
      {!showForm && (
        <div className="flex bg-[#0d0d0d] p-1 rounded-xl border border-zinc-800/80 w-fit gap-1 shadow-inner">
          <button
            onClick={() => setViewMode("history")}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all uppercase cursor-pointer flex items-center gap-1.5",
              viewMode === "history"
                ? "bg-zinc-900 text-amber-400 shadow-sm border border-zinc-800/50"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            Historial
          </button>
          <button
            onClick={() => setViewMode("dashboard")}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all uppercase cursor-pointer flex items-center gap-1.5",
              viewMode === "dashboard"
                ? "bg-zinc-900 text-amber-400 shadow-sm border border-zinc-800/50"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Métricas de Crecimiento
          </button>
        </div>
      )}

      {/* Filter / Apple style segmented control */}
      {!showForm && viewMode === "history" && (
        <div className="flex bg-[#0d0d0d] p-1 rounded-xl border border-zinc-800/80 w-fit gap-1 shadow-inner">
          <button
            onClick={() => setFilterType("ALL")}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all uppercase cursor-pointer",
              filterType === "ALL"
                ? "bg-zinc-900 text-amber-400 shadow-sm border border-zinc-800/50"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            Todas
          </button>
          {REVIEW_TYPES.map((rt) => (
            <button
              key={rt.key}
              onClick={() => setFilterType(rt.key)}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all uppercase cursor-pointer",
                filterType === rt.key
                  ? "bg-zinc-900 text-amber-400 shadow-sm border border-zinc-800/50"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {rt.label}
            </button>
          ))}
        </div>
      )}

      {/* Form Card */}
      {showForm && (
        <div className="glass-card border-zinc-800/80 overflow-hidden shadow-2xl relative">
          {/* Form Header Context */}
          <div className="bg-[#0b0b0b] p-6 border-b border-zinc-800/60 flex flex-col lg:flex-row gap-6 justify-between lg:items-center">
            <div className="space-y-3">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
                Creando Registro
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ReviewType)}
                  className="px-3.5 py-2 bg-[#121212] border border-zinc-800 rounded-xl text-sm text-amber-400 font-semibold outline-none focus:border-amber-500/50 transition-colors"
                >
                  {REVIEW_TYPES.map((rt) => (
                    <option key={rt.key} value={rt.key}>
                      {rt.label}
                    </option>
                  ))}
                </select>
                <input
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  placeholder="Ej: Semana 23 - 2026"
                  className="w-64 px-3.5 py-2 bg-[#121212] border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
            </div>

            <div className="bg-[#121212] p-4 rounded-2xl border border-zinc-800/60 flex flex-col justify-center min-w-[200px]">
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-2 text-center lg:text-left">
                Evaluación General del Ciclo
              </p>
              <div className="flex gap-2 justify-center lg:justify-start">
                {([1, 2, 3, 4, 5] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setRating(s)}
                    className="transition-all hover:scale-115 active:scale-95 cursor-pointer"
                  >
                    <Star
                      className={cn(
                        "w-7 h-7 transition-all duration-300",
                        s <= rating
                          ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]"
                          : "text-zinc-800"
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#121212] p-4 rounded-2xl border border-zinc-800/60 flex flex-col justify-center min-w-[200px] items-center lg:items-start">
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-2 text-center lg:text-left">
                Rating Final Proyectado
              </p>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-amber-400 font-mono bg-amber-500/5 px-3 py-1 border border-amber-500/10 rounded-xl">
                  {calculatedLiveRating.toFixed(1)} ⭐
                </span>
                <span className="text-[9px] text-zinc-500 leading-snug max-w-[125px]">
                  (50% Retro General + 50% Promedio Dimensiones)
                </span>
              </div>
            </div>
          </div>

          {/* Form Tabs Nav */}
          <div className="flex border-b border-zinc-800/40 bg-[#070707] px-4 py-2">
            <button
              onClick={() => setFormTab("retro")}
              className={cn(
                "flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-transparent cursor-pointer",
                formTab === "retro"
                  ? "bg-zinc-900/80 text-white border-zinc-800/60 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <ClipboardCheck className="w-4 h-4 text-zinc-400" />
              1. Retrospectiva General
            </button>
            <button
              onClick={() => setFormTab("dimensions")}
              className={cn(
                "flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-transparent cursor-pointer",
                formTab === "dimensions"
                  ? "bg-zinc-900/80 text-white border-zinc-800/60 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Sparkles className="w-4 h-4 text-zinc-400" />
              2. Mis 7 Dimensiones (Yo)
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6 bg-[#050505]/45">
            {formTab === "retro" ? (
              /* TAB 1: Retrospective Forms */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Column 1: Retrospectiva */}
                <div className="space-y-6">
                  <h4 className="text-xs uppercase font-bold tracking-wider text-zinc-400 flex items-center gap-2 border-b border-zinc-800/50 pb-2.5">
                    Logros & Aprendizajes
                  </h4>

                  <div className="group block">
                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2">
                      <Trophy className="w-4 h-4" /> Logros del ciclo
                    </label>
                    <textarea
                      value={achievements}
                      onChange={(e) => setAchievements(e.target.value)}
                      rows={5}
                      placeholder="¿Qué salió bien? Un logro importante por línea..."
                      className="w-full px-4 py-3 bg-[#0d0d0d] border border-zinc-800/80 rounded-xl text-sm text-zinc-200 placeholder:text-zinc-700 resize-none outline-none focus:bg-zinc-900/40 focus:border-emerald-500/45 transition-all focus:shadow-[0_0_15px_rgba(52,211,153,0.03)]"
                    />
                  </div>

                  <div className="group block">
                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-400 mb-2">
                      <Brain className="w-4 h-4" /> Aprendizajes clave
                    </label>
                    <textarea
                      value={learnings}
                      onChange={(e) => setLearnings(e.target.value)}
                      rows={5}
                      placeholder="¿Qué aprendiste en este ciclo de tus errores o éxitos?..."
                      className="w-full px-4 py-3 bg-[#0d0d0d] border border-zinc-800/80 rounded-xl text-sm text-zinc-200 placeholder:text-zinc-700 resize-none outline-none focus:bg-zinc-900/40 focus:border-sky-500/45 transition-all focus:shadow-[0_0_15px_rgba(56,189,248,0.03)]"
                    />
                  </div>
                </div>

                {/* Column 2: Oportunidades y Enfoque */}
                <div className="space-y-6">
                  <h4 className="text-xs uppercase font-bold tracking-wider text-zinc-400 flex items-center gap-2 border-b border-zinc-800/50 pb-2.5">
                    Obstáculos & Futuro
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="group block">
                      <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-400 mb-2">
                        <ShieldAlert className="w-4 h-4" /> Bloqueadores
                      </label>
                      <textarea
                        value={blockers}
                        onChange={(e) => setBlockers(e.target.value)}
                        rows={4}
                        placeholder="¿Qué frenó tu progreso?..."
                        className="w-full px-4 py-3 bg-[#0d0d0d] border border-zinc-800/80 rounded-xl text-sm text-zinc-200 placeholder:text-zinc-700 resize-none outline-none focus:bg-zinc-900/40 focus:border-orange-500/45 transition-all focus:shadow-[0_0_15px_rgba(249,115,22,0.03)]"
                      />
                    </div>
                    <div className="group block">
                      <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-400 mb-2">
                        <Wrench className="w-4 h-4" /> Ajustes necesarios
                      </label>
                      <textarea
                        value={adjustments}
                        onChange={(e) => setAdjustments(e.target.value)}
                        rows={4}
                        placeholder="¿Qué cambios harás en el siguiente ciclo?..."
                        className="w-full px-4 py-3 bg-[#0d0d0d] border border-zinc-800/80 rounded-xl text-sm text-zinc-200 placeholder:text-zinc-700 resize-none outline-none focus:bg-zinc-900/40 focus:border-purple-500/45 transition-all focus:shadow-[0_0_15px_rgba(168,85,247,0.03)]"
                      />
                    </div>
                  </div>

                  <div className="group block">
                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                      ⏳ Pendientes de arrastre
                    </label>
                    <textarea
                      value={pendingItems}
                      onChange={(e) => setPendingItems(e.target.value)}
                      rows={3}
                      placeholder="Tareas que quedaron inconclusas y se trasladan..."
                      className="w-full px-4 py-3 bg-[#0d0d0d] border border-zinc-800/80 rounded-xl text-sm text-zinc-200 placeholder:text-zinc-700 resize-none outline-none focus:bg-zinc-900/40 focus:border-zinc-700 transition-all"
                    />
                  </div>

                  <div className="group block">
                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
                      <Target className="w-4 h-4" /> Enfoque principal del próximo ciclo
                    </label>
                    <input
                      value={nextFocus}
                      onChange={(e) => setNextFocus(e.target.value)}
                      placeholder="El objetivo crucial a lograr en la siguiente semana/mes..."
                      className="w-full px-4 py-3 bg-amber-500/[0.03] border border-amber-500/25 rounded-xl text-sm text-amber-100 placeholder:text-amber-500/30 outline-none focus:bg-amber-500/[0.06] focus:border-amber-500/50 transition-all focus:shadow-[0_0_15px_rgba(251,191,36,0.08)]"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* TAB 2: 7 Selves Grid */
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-zinc-800/45 pb-3.5">
                  <div>
                    <h4 className="text-xs uppercase font-bold tracking-wider text-zinc-400">
                      Evaluación por Dimensión Personal
                    </h4>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Asigna un puntaje y escribe una breve reflexión de tu desempeño en cada uno de tus 7 "Yo".
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-amber-400/80 px-2 py-0.5 bg-amber-500/5 rounded-md border border-amber-500/10">
                    7 Dimensiones
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {DIMENSIONS_CONFIG.map((dim) => {
                    const cfg = COLOR_MAPS[dim.color];
                    const state = selfEvaluations[dim.key] || { rating: 3, comment: "" };
                    const IconComp = dim.icon;

                    return (
                      <div
                        key={dim.key}
                        className={cn(
                          "bg-[#090909]/60 border border-zinc-800/80 rounded-2xl p-5 transition-all duration-300",
                          "focus-within:border-zinc-700/60 focus-within:bg-[#0b0b0b]",
                          cfg.glow
                        )}
                      >
                        {/* Dim header */}
                        <div className="flex items-start gap-3.5 mb-4">
                          <div className={cn("p-2.5 rounded-xl", cfg.bg, cfg.text)}>
                            <IconComp className="w-5 h-5" />
                          </div>
                          <div>
                            <h5 className="text-sm font-bold text-zinc-100 tracking-wide">
                              {dim.label}
                            </h5>
                            <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
                              {dim.description}
                            </p>
                          </div>
                        </div>

                        {/* Stars selector with custom coloring */}
                        <div className="mb-4">
                          <p className="text-[9px] uppercase font-bold tracking-wider text-zinc-500 mb-1.5">
                            Tu puntuación
                          </p>
                          <div className="flex gap-1.5">
                            {[1, 2, 3, 4, 5].map((val) => (
                              <button
                                key={val}
                                onClick={() => updateDimensionRating(dim.key, val)}
                                className="transition-all hover:scale-120 active:scale-90 cursor-pointer"
                              >
                                <Star
                                  className={cn(
                                    "w-5 h-5 transition-all duration-300",
                                    val <= state.rating ? cfg.starActive : "text-zinc-800"
                                  )}
                                />
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Comment text box */}
                        <div className="group block">
                          <p className="text-[9px] uppercase font-bold tracking-wider text-zinc-500 mb-1.5">
                            Reflexión / Notas
                          </p>
                          <textarea
                            value={state.comment}
                            onChange={(e) => updateDimensionComment(dim.key, e.target.value)}
                            rows={3}
                            placeholder={dim.placeholder}
                            className="w-full px-3 py-2 bg-[#0c0c0c] border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-700 resize-none outline-none focus:bg-zinc-900/30 focus:border-zinc-700 transition-all"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Form Footer */}
          <div className="bg-[#0b0b0b] p-5 border-t border-zinc-800/60 flex justify-end gap-3.5">
            <button
              onClick={() => {
                setShowForm(false);
                setFormTab("retro");
              }}
              className="btn-secondary px-5 py-2 text-sm font-semibold rounded-xl"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!period.trim()}
              className="btn-primary px-6 py-2.5 text-sm font-bold rounded-xl flex items-center gap-2 disabled:opacity-40"
            >
              <Save className="w-4 h-4" /> Guardar revisión
            </button>
          </div>
        </div>
      )}

      {/* Progress Dashboard */}
      {!showForm && viewMode === "dashboard" && (
        <div className="space-y-6 animate-in fade-in slide-in duration-300">
          {monthlyMetrics.length === 0 ? (
            <div className="text-center py-20 bg-[#080808]/40 border border-zinc-800/60 rounded-2xl shadow-sm max-w-xl mx-auto mt-6">
              <Activity className="w-14 h-14 text-zinc-700 mx-auto mb-4 animate-pulse" />
              <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-2">
                Sin datos suficientes
              </h3>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto mb-5 leading-relaxed">
                Registra al menos una revisión con autoevaluaciones completas para comenzar a graficar tu crecimiento.
              </p>
            </div>
          ) : (
            <>
              {/* HUD / KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* KPI 1: Total Reviews */}
                <div className="glass-card p-5 relative overflow-hidden group hover:border-zinc-700/60 transition-all duration-300">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl" />
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                      <Calendar className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-white font-mono tracking-tight">{reviews.length}</p>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Revisiones Totales</p>
                </div>

                {/* KPI 2: Historic Average */}
                <div className="glass-card p-5 relative overflow-hidden group hover:border-zinc-700/60 transition-all duration-300">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl" />
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                      <Star className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-white font-mono tracking-tight">
                    {(reviews.reduce((sum, r) => sum + (r.overallRating || 0), 0) / (reviews.length || 1)).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Promedio Histórico</p>
                </div>

                {/* KPI 3: Last Month Evaluated */}
                <div className="glass-card p-5 relative overflow-hidden group hover:border-zinc-700/60 transition-all duration-300">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full blur-xl" />
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center">
                      <ClipboardCheck className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-white font-mono tracking-tight">
                    {monthlyMetrics[monthlyMetrics.length - 1]?.name || "N/A"}
                  </p>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Último Mes</p>
                </div>

                {/* KPI 4: Delta change */}
                <div className="glass-card p-5 relative overflow-hidden group hover:border-zinc-700/60 transition-all duration-300">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl" />
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
                      <Activity className="w-5 h-5" />
                    </div>
                  </div>
                  {monthlyMetrics.length > 1 ? (
                    (() => {
                      const current = monthlyMetrics[monthlyMetrics.length - 1].overallRating;
                      const prev = monthlyMetrics[monthlyMetrics.length - 2].overallRating;
                      const diff = Math.round((current - prev) * 100) / 100;
                      return (
                        <>
                          <p className={cn(
                            "text-2xl font-black font-mono tracking-tight flex items-center gap-1.5",
                            diff > 0 ? "text-emerald-400" : diff < 0 ? "text-rose-400" : "text-zinc-400"
                          )}>
                            {diff > 0 ? "+" : ""}{diff.toFixed(2)}
                            {diff > 0 ? (
                              <TrendingUp className="w-5 h-5 text-emerald-400" />
                            ) : diff < 0 ? (
                              <TrendingDown className="w-5 h-5 text-rose-400" />
                            ) : (
                              <Minus className="w-5 h-5 text-zinc-400" />
                            )}
                          </p>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Tendencia MoM</p>
                        </>
                      );
                    })()
                  ) : (
                    <>
                      <p className="text-2xl font-black text-zinc-500 font-mono tracking-tight">—</p>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Tendencia MoM</p>
                    </>
                  )}
                </div>
              </div>

              {/* Chart */}
              <div className="glass-card p-6 border-zinc-800/80">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-xs uppercase font-extrabold tracking-widest text-zinc-400 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-amber-500" /> Evolución Mensual del Desempeño
                    </h2>
                    <p className="text-[10px] text-zinc-500 mt-1">Histórico de tus valoraciones generales agrupado por mes.</p>
                  </div>
                </div>
                <div className="h-[280px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyMetrics} margin={{ top: 10, right: 5, left: -25, bottom: 5 }}>
                      <defs>
                        <linearGradient id="colorOverall" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                      <XAxis dataKey="name" stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis 
                        stroke="rgba(255,255,255,0.2)" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false} 
                        domain={[1, 5]}
                        tickCount={5}
                      />
                      <RechartsTooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload || !payload.length) return null;
                          return (
                            <div className="bg-zinc-950/95 border border-zinc-800/80 rounded-2xl px-4 py-3 shadow-2xl backdrop-blur-md text-xs">
                              <p className="text-zinc-500 font-bold uppercase tracking-wider mb-2 text-[9px]">{label}</p>
                              <div className="flex items-center gap-4 justify-between">
                                <span className="text-zinc-400 font-medium flex items-center gap-1.5">
                                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> Promedio General:
                                </span>
                                <span className="text-zinc-100 font-black font-mono">
                                  {Number(payload[0].value).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="overallRating"
                        name="Promedio General"
                        stroke="#fbbf24"
                        fillOpacity={1}
                        fill="url(#colorOverall)"
                        strokeWidth={2.5}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 7 Dimensions Growth Grid */}
              <div className="space-y-4">
                <div className="border-b border-zinc-800/60 pb-2">
                  <h3 className="text-xs uppercase font-extrabold tracking-widest text-zinc-400 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" /> Progreso en las 7 Dimensiones Personales
                  </h3>
                  <p className="text-[10px] text-zinc-500 mt-1">Comparativa de desempeño y deltas de crecimiento MoM.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {dimensionComparison?.map((dim) => {
                    const cfg = COLOR_MAPS[dim.color];
                    const IconComp = dim.icon;
                    const pct = (dim.currentVal / 5) * 100;
                    
                    return (
                      <div 
                        key={dim.key}
                        className={cn(
                          "bg-[#090909]/45 border border-zinc-800/80 rounded-2xl p-5 transition-all duration-300 flex flex-col justify-between",
                          cfg.glow
                        )}
                      >
                        <div>
                          {/* Dim header */}
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className={cn("p-2.5 rounded-xl", cfg.bg, cfg.text)}>
                                <IconComp className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-zinc-100 tracking-wide">
                                  {dim.label}
                                </h4>
                                <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-semibold">
                                  Este mes: <strong className="text-zinc-300 font-extrabold">{dim.currentVal.toFixed(1)}</strong>
                                </span>
                              </div>
                            </div>

                            {/* Badge Delta */}
                            {dim.prevVal !== null ? (
                              <div className={cn(
                                "flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border",
                                dim.diff > 0 
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                  : dim.diff < 0 
                                    ? "bg-rose-500/10 text-rose-400 border-rose-500/20" 
                                    : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                              )}>
                                {dim.diff > 0 ? (
                                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                                ) : dim.diff < 0 ? (
                                  <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                                ) : (
                                  <Minus className="w-3 h-3 text-zinc-400" />
                                )}
                                <span>{dim.diff > 0 ? "+" : ""}{dim.diff.toFixed(1)}</span>
                              </div>
                            ) : (
                              <span className="text-[9px] font-bold text-zinc-600 bg-zinc-950 px-2 py-0.5 border border-zinc-900 rounded">
                                MoM: —
                              </span>
                            )}
                          </div>

                          {/* Progress Bar */}
                          <div className="progress-bar bg-zinc-950 mt-1 relative overflow-hidden">
                            <div 
                              className={cn(
                                "progress-bar-fill bg-gradient-to-r",
                                dim.color === "emerald" && "from-emerald-600 to-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]",
                                dim.color === "sky" && "from-sky-600 to-sky-400 shadow-[0_0_8px_rgba(14,165,233,0.2)]",
                                dim.color === "violet" && "from-violet-600 to-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.2)]",
                                dim.color === "pink" && "from-pink-600 to-pink-400 shadow-[0_0_8px_rgba(236,72,153,0.2)]",
                                dim.color === "indigo" && "from-indigo-600 to-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.2)]",
                                dim.color === "teal" && "from-teal-600 to-teal-400 shadow-[0_0_8px_rgba(20,184,166,0.2)]",
                                dim.color === "amber" && "from-amber-600 to-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.2)]"
                              )} 
                              style={{ width: `${pct}%` }} 
                            />
                          </div>
                        </div>

                        {/* Prev vs Current footer values */}
                        {dim.prevVal !== null && (
                          <div className="flex items-center justify-between text-[9px] text-zinc-500 font-mono mt-3.5 border-t border-white/[0.02] pt-2">
                            <span>MES ANTERIOR: <strong className="text-zinc-400 font-extrabold">{dim.prevVal.toFixed(1)}</strong></span>
                            <span className="flex items-center gap-1">
                              {dim.prevVal.toFixed(1)} <ArrowRight className="w-2.5 h-2.5" /> {dim.currentVal.toFixed(1)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Review List */}
      {!showForm && viewMode === "history" && (
        filtered.length > 0 ? (
          <div className="space-y-4">
          {filtered.map((r) => {
            const isExpanded = expandedId === r.id;
            return (
              <div
                key={r.id}
                className={cn(
                  "glass-card p-5 border-zinc-800/80 transition-all duration-300",
                  isExpanded && "shadow-2xl border-zinc-700/40 bg-[#090909]/40"
                )}
              >
                {/* Collapsed Header Bar */}
                <div
                  className="flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                >
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={cn(
                          "text-[9px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded border",
                          getReviewTypeBadgeClass(r.type)
                        )}
                      >
                        {TYPE_LABELS[r.type] || r.type}
                      </span>
                      <h3 className="text-sm font-bold text-zinc-100 tracking-wide">{r.period}</h3>
                      <div className="flex items-center gap-2">
                        <div className="flex bg-[#0f0f0f] border border-zinc-800/60 p-1.5 rounded-lg gap-0.5 shadow-inner">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={cn(
                                "w-3.5 h-3.5",
                                s <= Math.round(r.overallRating || 0)
                                  ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.4)]"
                                  : "text-zinc-800"
                              )}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] font-black text-amber-400 font-mono bg-amber-500/5 px-2 py-0.5 border border-amber-500/10 rounded-md">
                          {(r.overallRating || 0).toFixed(1)}
                        </span>
                      </div>
                    </div>

                    {/* Compact preview of the 7 Dimension evaluations (Only if present in data) */}
                    {r.selfEvaluations && (
                      <div className="flex flex-wrap gap-2.5 pt-1">
                        {DIMENSIONS_CONFIG.map((dim) => {
                          const detail = r.selfEvaluations?.[dim.key];
                          if (!detail || !detail.rating) return null;
                          const cfg = COLOR_MAPS[dim.color];
                          const IconComp = dim.icon;

                          return (
                            <div
                              key={dim.key}
                              className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border",
                                cfg.bg,
                                cfg.text,
                                cfg.border
                              )}
                              title={`${dim.label}: ${detail.rating}⭐`}
                            >
                              <IconComp className="w-3 h-3" />
                              <span>{detail.rating}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 border-zinc-900 pt-3 md:pt-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(r.id);
                      }}
                      className="p-2 text-zinc-700 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
                      title="Eliminar revisión"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      <span>Ver detalles</span>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 text-zinc-500 transition-transform duration-300",
                          isExpanded && "rotate-180 text-amber-400"
                        )}
                      />
                    </div>
                  </div>
                </div>

                {/* Expanded Detailed Panel */}
                {isExpanded && (
                  <div className="mt-6 pt-6 border-t border-zinc-800/60 space-y-8 animate-in fade-in slide-in duration-300">
                    {/* Retrospective section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left Column: Positive things */}
                      <div className="space-y-4">
                        {r.achievements?.length > 0 && (
                          <div className="bg-emerald-950/[0.06] border border-emerald-950/20 rounded-xl p-4.5">
                            <h4 className="text-xs uppercase font-bold tracking-wider text-emerald-400 flex items-center gap-2 mb-2.5">
                              <Trophy className="w-4 h-4" /> ✅ Logros del ciclo
                            </h4>
                            <ul className="space-y-2 text-xs text-zinc-300">
                              {r.achievements.map((a, i) => (
                                <li key={i} className="flex items-start gap-2 leading-relaxed">
                                  <span className="text-emerald-500/80 font-bold">•</span>
                                  <span>{a}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {r.learnings?.length > 0 && (
                          <div className="bg-sky-950/[0.06] border border-sky-950/20 rounded-xl p-4.5">
                            <h4 className="text-xs uppercase font-bold tracking-wider text-sky-400 flex items-center gap-2 mb-2.5">
                              <Brain className="w-4 h-4" /> 💡 Aprendizajes
                            </h4>
                            <ul className="space-y-2 text-xs text-zinc-300">
                              {r.learnings.map((l, i) => (
                                <li key={i} className="flex items-start gap-2 leading-relaxed">
                                  <span className="text-sky-500/80 font-bold">•</span>
                                  <span>{l}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Right Column: Areas for improvement */}
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {r.blockers?.length > 0 && (
                            <div className="bg-orange-950/[0.06] border border-orange-950/20 rounded-xl p-4.5">
                              <h4 className="text-xs uppercase font-bold tracking-wider text-orange-400 flex items-center gap-2 mb-2">
                                <ShieldAlert className="w-3.5 h-3.5" /> 🚧 Bloqueadores
                              </h4>
                              <ul className="space-y-1.5 text-xs text-zinc-300">
                                {r.blockers.map((b, i) => (
                                  <li key={i} className="flex items-start gap-1.5 leading-relaxed">
                                    <span className="text-orange-500/80">•</span>
                                    <span>{b}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {r.adjustments?.length > 0 && (
                            <div className="bg-purple-950/[0.06] border border-purple-950/20 rounded-xl p-4.5">
                              <h4 className="text-xs uppercase font-bold tracking-wider text-purple-400 flex items-center gap-2 mb-2">
                                <Wrench className="w-3.5 h-3.5" /> 🔧 Ajustes
                              </h4>
                              <ul className="space-y-1.5 text-xs text-zinc-300">
                                {r.adjustments.map((a, i) => (
                                  <li key={i} className="flex items-start gap-1.5 leading-relaxed">
                                    <span className="text-purple-500/80">•</span>
                                    <span>{a}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {r.pendingItems?.length > 0 && (
                          <div className="bg-zinc-950/[0.2] border border-zinc-800/80 rounded-xl p-4.5">
                            <h4 className="text-xs uppercase font-bold tracking-wider text-zinc-400 mb-2">
                              ⏳ Pendientes del ciclo
                            </h4>
                            <ul className="space-y-1.5 text-xs text-zinc-300">
                              {r.pendingItems.map((p, i) => (
                                <li key={i} className="flex items-start gap-2 leading-relaxed">
                                  <span className="text-zinc-600 font-bold">•</span>
                                  <span>{p}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {r.nextFocus && (
                          <div className="bg-amber-500/[0.02] border border-amber-500/15 rounded-xl p-4.5">
                            <h4 className="text-xs uppercase font-bold tracking-wider text-amber-400 flex items-center gap-2 mb-1.5">
                              <Target className="w-4 h-4" /> Objetivo de Enfoque Próximo
                            </h4>
                            <p className="text-xs font-semibold text-amber-100/90 pl-6 leading-relaxed">
                              {r.nextFocus}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Detailed Dimensions self evaluations */}
                    {r.selfEvaluations && (
                      <div className="space-y-4 pt-2">
                        <div className="border-b border-zinc-800/60 pb-2">
                          <h4 className="text-xs uppercase font-bold tracking-wider text-zinc-400 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-400" />
                            Reflexión Detallada de las 7 Dimensiones
                          </h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                          {DIMENSIONS_CONFIG.map((dim) => {
                            const detail = r.selfEvaluations?.[dim.key];
                            if (!detail) return null;
                            const cfg = COLOR_MAPS[dim.color];
                            const IconComp = dim.icon;

                            return (
                              <div
                                key={dim.key}
                                className={cn(
                                  "bg-[#090909]/45 border border-zinc-800/60 rounded-xl p-4 space-y-3"
                                )}
                              >
                                <div className="flex items-center justify-between border-b border-zinc-800/40 pb-2">
                                  <div className="flex items-center gap-2.5">
                                    <div className={cn("p-1.5 rounded-lg", cfg.bg, cfg.text)}>
                                      <IconComp className="w-4 h-4" />
                                    </div>
                                    <span className="text-xs font-bold text-zinc-200">
                                      {dim.label}
                                    </span>
                                  </div>
                                  <div className="flex gap-0.5">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <Star
                                        key={star}
                                        className={cn(
                                          "w-3 h-3",
                                          star <= detail.rating ? cfg.starActive : "text-zinc-800"
                                        )}
                                      />
                                    ))}
                                  </div>
                                </div>

                                <p className="text-xs text-zinc-300 leading-relaxed italic bg-black/10 p-2.5 rounded-lg border border-zinc-900 min-h-[50px]">
                                  {detail.comment.trim() ? (
                                    `"${detail.comment}"`
                                  ) : (
                                    <span className="text-zinc-600 font-medium not-italic">
                                      Sin reflexión registrada en este ciclo.
                                    </span>
                                  )}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
          <div className="text-center py-20 bg-[#080808]/40 border border-zinc-800/60 rounded-2xl shadow-sm max-w-xl mx-auto mt-6">
            <ClipboardCheck className="w-14 h-14 text-zinc-700 mx-auto mb-4" />
            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-2">
              Sin revisiones
            </h3>
            <p className="text-xs text-zinc-500 max-w-xs mx-auto mb-5 leading-relaxed">
              Comienza registrando tu primera evaluación de la semana o el mes para dar seguimiento a tu crecimiento.
            </p>
            <button onClick={() => setShowForm(true)} className="btn-primary px-5 py-2.5 rounded-xl font-semibold">
              Crear tu primera revisión
            </button>
          </div>
        ))
      }
    </div>
  );
}
