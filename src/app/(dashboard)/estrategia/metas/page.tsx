"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth, useUid } from "@/lib/hooks/useAuth";
import { getAll, create, update, remove } from "@/lib/repositories/firestore";
import {
  Goal,
  GoalType,
  GoalHorizon,
  GoalPeriod,
  GoalStatus,
  LifeArea,
  RoadmapRow,
} from "@/lib/types";
import {
  Trophy,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  MoreVertical,
  ChevronDown,
  Filter,
  ListChecks,
  CheckCircle2,
  Circle,
  Play,
  Check,
  ChevronRight,
  Square,
  Calendar,
  Heart,
  DollarSign,
  Briefcase,
  Users,
  BookOpen,
  Sparkles,
  Gamepad2,
  AlertTriangle,
  Search,
  RotateCcw
} from "lucide-react";
import { cn, formatPercent, getStatusColor } from "@/lib/utils";
import { Timestamp } from "firebase/firestore";
import { GoalSlideOver } from "@/components/shared/GoalSlideOver";

const GOAL_TYPES: GoalType[] = ["RESULTADO", "PROCESO", "HABITO", "PROYECTO", "MANTENIMIENTO"];
const HORIZONS: GoalHorizon[] = ["VIDA", "LARGO_PLAZO", "MEDIANO_PLAZO", "CORTO_PLAZO"];
const PERIODS: GoalPeriod[] = ["ANNUAL", "QUARTERLY", "MONTHLY", "WEEKLY"];
const STATUSES: GoalStatus[] = ["DRAFT", "ACTIVE", "IN_PROGRESS", "AT_RISK", "COMPLETED", "CANCELLED"];
const LIFE_AREAS: LifeArea[] = ["SALUD", "DINERO", "CARRERA", "FAMILIA", "RELACIONES", "APRENDIZAJE", "PROPOSITO", "DIVERSION"];

const LIFE_AREA_CONFIG: Record<
  LifeArea,
  { bg: string; border: string; text: string; label: string; icon: React.ElementType }
> = {
  SALUD: {
    bg: "bg-emerald-500/10 hover:bg-emerald-500/20",
    border: "border-emerald-500/20 border-l-emerald-500",
    text: "text-emerald-400",
    label: "Salud",
    icon: Heart,
  },
  DINERO: {
    bg: "bg-amber-500/10 hover:bg-amber-500/20",
    border: "border-amber-500/20 border-l-amber-500",
    text: "text-amber-400",
    label: "Dinero",
    icon: DollarSign,
  },
  CARRERA: {
    bg: "bg-blue-500/10 hover:bg-blue-500/20",
    border: "border-blue-500/20 border-l-blue-500",
    text: "text-blue-400",
    label: "Carrera",
    icon: Briefcase,
  },
  FAMILIA: {
    bg: "bg-pink-500/10 hover:bg-pink-500/20",
    border: "border-pink-500/20 border-l-pink-500",
    text: "text-pink-400",
    label: "Familia",
    icon: Users,
  },
  RELACIONES: {
    bg: "bg-rose-500/10 hover:bg-rose-500/20",
    border: "border-rose-500/20 border-l-rose-500",
    text: "text-rose-400",
    label: "Relaciones",
    icon: Heart,
  },
  APRENDIZAJE: {
    bg: "bg-purple-500/10 hover:bg-purple-500/20",
    border: "border-purple-500/20 border-l-purple-500",
    text: "text-purple-400",
    label: "Aprendizaje",
    icon: BookOpen,
  },
  PROPOSITO: {
    bg: "bg-indigo-500/10 hover:bg-indigo-500/20",
    border: "border-indigo-500/20 border-l-indigo-500",
    text: "text-indigo-400",
    label: "Propósito",
    icon: Sparkles,
  },
  DIVERSION: {
    bg: "bg-orange-500/10 hover:bg-orange-500/20",
    border: "border-orange-500/20 border-l-orange-500",
    text: "text-orange-400",
    label: "Diversión",
    icon: Gamepad2,
  },
};

const STATUS_CONFIG: Record<
  GoalStatus,
  { label: string; text: string; bg: string; border: string; icon: React.ElementType }
> = {
  DRAFT: { label: "Borrador", text: "text-zinc-400", bg: "bg-zinc-950/40", border: "border-zinc-800", icon: Square },
  ACTIVE: { label: "Activa", text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", icon: Circle },
  IN_PROGRESS: { label: "En Curso", text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: Play },
  AT_RISK: { label: "En Riesgo", text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", icon: AlertTriangle },
  COMPLETED: { label: "Completada", text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: CheckCircle2 },
  CANCELLED: { label: "Cancelada", text: "text-zinc-500", bg: "bg-zinc-900/40", border: "border-white/5", icon: X },
};

function GoalCard({
  goal,
  uid,
  menuOpen,
  setMenuOpen,
  onEdit,
  handleDelete,
  quickUpdateStatus,
  loadData,
}: {
  goal: Goal;
  uid: string;
  menuOpen: string | null;
  setMenuOpen: (id: string | null) => void;
  onEdit: (goal: Goal) => void;
  handleDelete: (id: string) => void;
  quickUpdateStatus: (id: string, s: GoalStatus) => void;
  loadData: () => void;
}) {
  const area = LIFE_AREA_CONFIG[goal.lifeArea] || {
    bg: "bg-zinc-900/60",
    border: "border-zinc-800 border-l-zinc-600",
    text: "text-zinc-400",
    label: goal.lifeArea,
    icon: Trophy,
  };
  const AreaIcon = area.icon;

  const statusCfg = STATUS_CONFIG[goal.status] || {
    label: goal.status,
    text: "text-zinc-400",
    bg: "bg-zinc-950/40",
    border: "border-zinc-800",
    icon: Circle,
  };
  const StatusIcon = statusCfg.icon;

  const isOverdue =
    goal.targetDate &&
    goal.targetDate.toDate() < new Date() &&
    goal.status !== "COMPLETED";

  return (
    <div
      className={cn(
        "relative rounded-2xl border-l-4 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.3)] bg-[#0c0c0e]/60 backdrop-blur-xl border border-white/[0.03] group",
        area.border
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Life Area & Horizon Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-2 select-none">
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                area.bg,
                area.text,
                "border-white/5"
              )}
            >
              <AreaIcon className="w-2.5 h-2.5" />
              {area.label}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold text-zinc-500 bg-white/5 border border-white/[0.03] uppercase tracking-wider">
              {goal.horizon.replace("_", " ")}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-sm font-bold text-zinc-100 tracking-tight leading-normal group-hover:text-white transition-colors break-words">
            {goal.name}
          </h3>

          {/* Target Date & Details */}
          <div className="flex items-center gap-3.5 mt-2.5 text-[10px] text-zinc-500 font-medium select-none">
            <span className="flex items-center gap-1 font-semibold uppercase tracking-wider">
              <Trophy className="w-3.5 h-3.5 text-zinc-600 animate-pulse" /> {goal.type.toLowerCase()}
            </span>
            {goal.targetDate && (
              <span
                className={cn(
                  "flex items-center gap-1 font-semibold uppercase tracking-wider font-mono",
                  isOverdue ? "text-red-400 font-black" : "text-zinc-500"
                )}
              >
                <Calendar className="w-3.5 h-3.5" />
                {goal.targetDate
                  .toDate()
                  .toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
            )}
          </div>
        </div>

        {/* Action Panel */}
        <div className="flex items-center gap-1 shrink-0 relative">
          {(goal.status === "ACTIVE" || goal.status === "DRAFT") && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                quickUpdateStatus(goal.id, "IN_PROGRESS");
              }}
              className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/10 transition-colors active:scale-90 border border-transparent hover:border-blue-500/10"
              title="Iniciar Meta"
            >
              <Play className="w-4 h-4" />
            </button>
          )}
          {goal.status === "IN_PROGRESS" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                quickUpdateStatus(goal.id, "COMPLETED");
              }}
              className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors active:scale-90 border border-transparent hover:border-emerald-500/10"
              title="Marcar como Completada"
            >
              <Check className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(menuOpen === goal.id ? null : goal.id);
            }}
            className="text-zinc-600 hover:text-zinc-400 transition-colors opacity-0 group-hover:opacity-100 p-1.5 rounded-lg active:scale-90"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen === goal.id && (
            <div className="absolute right-0 top-8 bg-zinc-950 border border-white/10 rounded-xl shadow-2xl z-20 py-1.5 min-w-[130px] animate-in fade-in duration-200">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(goal);
                  setMenuOpen(null);
                }}
                className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/5 w-full hover:text-white transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5 text-amber-500" /> Editar Meta
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(goal.id);
                }}
                className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/5 w-full hover:text-red-300 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" /> Eliminar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Progress Bar */}
      <div className="mt-4 pt-3.5 border-t border-white/[0.02]">
        <div className="flex items-center gap-3">
          <div
            className="flex-1 progress-bar cursor-pointer group/progress relative overflow-hidden h-2.5 rounded-full bg-zinc-950 border border-white/5"
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              let p = Math.round(((e.clientX - rect.left) / rect.width) * 100);
              if (p < 0) p = 0;
              if (p > 100) p = 100;
              let st = goal.status;
              if (p === 100) st = "COMPLETED";
              else if (p > 0 && st === "ACTIVE") st = "IN_PROGRESS";
              update(uid, "goals", goal.id, { progress: p, status: st }).then(loadData);
            }}
          >
            <div
              className="progress-bar-fill shadow-[0_0_10px_rgba(255,255,255,0.15)] group-hover/progress:brightness-125 transition-all bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full"
              style={{ width: `${goal.progress}%` }}
            />
          </div>
          <span className="text-[11px] text-zinc-400 min-w-[35px] text-right font-mono font-black select-none">
            {goal.progress}%
          </span>
        </div>
      </div>

      {/* Status Badge in footer */}
      <div className="flex items-center justify-between mt-3 select-none">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
            statusCfg.text,
            statusCfg.bg,
            statusCfg.border
          )}
        >
          <StatusIcon className="w-3 h-3 shrink-0" />
          {statusCfg.label}
        </span>
      </div>
    </div>
  );
}

export default function MetasPage() {
  const { user } = useAuth();
  const uid = useUid();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [filterHorizon, setFilterHorizon] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterArea, setFilterArea] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"anuales" | "trimestrales">("anuales");
  
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    ACTIVE: true,
    IN_PROGRESS: true,
    DRAFT: false,
    AT_RISK: true,
    COMPLETED: false,
    CANCELLED: false,
  });

  const toggleGroup = (status: string) => {
    setOpenGroups(prev => ({ ...prev, [status]: !prev[status] }));
  };

  const getHorizonCount = (h: string) => {
    return goals.filter((g) => {
      if (g.period === "QUARTERLY") return false;
      if (h !== "ALL" && g.horizon !== h) return false;
      if (filterStatus !== "ALL" && g.status !== filterStatus) return false;
      if (filterArea !== "ALL" && g.lifeArea !== filterArea) return false;
      if (searchTerm.trim() !== "") {
        const term = searchTerm.toLowerCase();
        return g.name.toLowerCase().includes(term) || (g.description?.toLowerCase().includes(term) || false);
      }
      return true;
    }).length;
  };

  const getStatusCount = (s: string) => {
    return goals.filter((g) => {
      if (activeTab === "anuales" && g.period === "QUARTERLY") return false;
      if (activeTab === "trimestrales" && g.period !== "QUARTERLY") return false;
      if (activeTab === "anuales" && filterHorizon !== "ALL" && g.horizon !== filterHorizon) return false;
      if (s !== "ALL" && g.status !== s) return false;
      if (filterArea !== "ALL" && g.lifeArea !== filterArea) return false;
      if (searchTerm.trim() !== "") {
        const term = searchTerm.toLowerCase();
        return g.name.toLowerCase().includes(term) || (g.description?.toLowerCase().includes(term) || false);
      }
      return true;
    }).length;
  };

  const getAreaCount = (a: string) => {
    return goals.filter((g) => {
      if (activeTab === "anuales" && g.period === "QUARTERLY") return false;
      if (activeTab === "trimestrales" && g.period !== "QUARTERLY") return false;
      if (activeTab === "anuales" && filterHorizon !== "ALL" && g.horizon !== filterHorizon) return false;
      if (filterStatus !== "ALL" && g.status !== filterStatus) return false;
      if (a !== "ALL" && g.lifeArea !== a) return false;
      if (searchTerm.trim() !== "") {
        const term = searchTerm.toLowerCase();
        return g.name.toLowerCase().includes(term) || (g.description?.toLowerCase().includes(term) || false);
      }
      return true;
    }).length;
  };

  const loadData = useCallback(async () => {
    if (!uid) return;
    const g = await getAll<Goal>(uid, "goals");
    setGoals(g);
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async (data: Partial<Goal>) => {
    if (!uid) return;
    if (editing) {
      await update(uid, "goals", editing.id, data);
    } else {
      await create(uid, "goals", data as Omit<Goal, "id" | "userId" | "createdAt" | "updatedAt">);
    }
    setShowForm(false);
    setEditing(null);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!uid) return;
    await remove(uid, "goals", id);
    setMenuOpen(null);
    loadData();
  };

  const quickUpdateStatus = async (id: string, newStatus: GoalStatus) => {
    if (!uid) return;
    const upd: any = { status: newStatus };
    if (newStatus === "COMPLETED") upd.progress = 100;
    await update(uid, "goals", id, upd);
    loadData();
  };

  const filteredAnnuals = goals.filter((g) => {
    if (g.period === "QUARTERLY") return false;
    if (filterHorizon !== "ALL" && g.horizon !== filterHorizon) return false;
    if (filterStatus !== "ALL" && g.status !== filterStatus) return false;
    if (filterArea !== "ALL" && g.lifeArea !== filterArea) return false;
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      return g.name.toLowerCase().includes(term) || (g.description?.toLowerCase().includes(term) || false);
    }
    return true;
  });

  const quarterlies = goals.filter((g) => {
    if (g.period !== "QUARTERLY") return false;
    if (filterStatus !== "ALL" && g.status !== filterStatus) return false;
    if (filterArea !== "ALL" && g.lifeArea !== filterArea) return false;
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      return g.name.toLowerCase().includes(term) || (g.description?.toLowerCase().includes(term) || false);
    }
    return true;
  });

  const groupedQuarterlies = quarterlies.reduce((acc, goal) => {
      const y = goal.year || new Date().getFullYear();
      const q = goal.quarter || 1;
      if (!acc[y]) acc[y] = {};
      if (!acc[y][q]) acc[y][q] = [];
      acc[y][q].push(goal);
      return acc;
  }, {} as Record<number, Record<number, Goal[]>>);

  const sortedYears = Object.keys(groupedQuarterlies).map(Number).sort((a,b) => a - b);


  if (loading) {
    return (
      <div className="page-enter space-y-4">
        <div className="h-8 w-48 bg-zinc-900 rounded animate-pulse" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card p-5 h-24 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter space-y-6">
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2.5 tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 border border-emerald-500/15 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-emerald-400" />
            </div>
            Metas
          </h1>
          <p className="text-[12px] text-zinc-500 mt-1 ml-[42px]">
            {goals.length} metas registradas
          </p>
        </div>
        <div className="flex items-center gap-2">
            <button
            onClick={() => { setShowForm(true); setEditing(null); }}
            className="btn-primary flex items-center gap-1.5"
            >
            <Plus className="w-4 h-4" />
            Nueva meta
            </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-black/40 p-1 rounded-xl w-fit border border-white/5 mx-auto mb-6">
        <button
          onClick={() => setActiveTab("anuales")}
          className={cn("px-6 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2", activeTab === "anuales" ? "bg-white/10 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5")}
        >
          <Trophy className="w-4 h-4" /> Anuales / Vida
        </button>
        <button
           onClick={() => setActiveTab("trimestrales")}
          className={cn("px-6 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2", activeTab === "trimestrales" ? "bg-white/10 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5")}
        >
          <ListChecks className="w-4 h-4" /> Trimestrales
        </button>
      </div>

      {/* Panel de Filtros Avanzado Glassmórfico */}
      <div className="bg-[#0c0c0e]/50 backdrop-blur-xl border border-white/[0.05] rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] space-y-5 transition-all duration-300 hover:border-white/[0.08] mb-6">
        
        {/* Buscador y Estado General */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 group">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-amber-500 transition-colors">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Buscar meta por nombre o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black/40 border border-white/5 rounded-xl pl-10 pr-9 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all font-semibold"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300 active:scale-90 transition-transform"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filtros Activos Indicator */}
          {(filterHorizon !== "ALL" || filterStatus !== "ALL" || filterArea !== "ALL" || searchTerm !== "") && (
            <button
              onClick={() => {
                setFilterHorizon("ALL");
                setFilterStatus("ALL");
                setFilterArea("ALL");
                setSearchTerm("");
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 bg-red-500/5 border border-red-500/10 hover:border-red-500/20 active:scale-95 transition-all self-end md:self-auto shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Fila 2: Horizonte (Solo anuales) */}
        {activeTab === "anuales" && (
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-zinc-500 tracking-wider flex items-center gap-1.5 uppercase select-none">
              <Filter className="w-3 h-3 text-zinc-500" /> Horizonte
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {['ALL', ...HORIZONS].map(h => {
                const isActive = filterHorizon === h;
                const count = getHorizonCount(h);
                return (
                  <button
                    key={h}
                    onClick={() => setFilterHorizon(h)}
                    className={cn(
                      "px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-wide transition-all border whitespace-nowrap flex items-center gap-1.5",
                      isActive
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.05)]"
                        : "bg-transparent border-white/5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                    )}
                  >
                    {h === 'ALL' ? "TODOS" : h.replace("_", " ")}
                    <span className={cn(
                      "text-[9px] px-1.5 py-0.2 rounded-full font-extrabold select-none",
                      isActive ? "bg-amber-500/20 text-amber-300" : "bg-white/5 text-zinc-600"
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Fila 3: Estado */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-zinc-500 tracking-wider flex items-center gap-1.5 uppercase select-none">
            <Filter className="w-3 h-3 text-zinc-500" /> Estado
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {['ALL', ...STATUSES].map(s => {
              const isActive = filterStatus === s;
              const count = getStatusCount(s);
              
              // Get style configuration
              let activeStyles = "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
              let countStyles = "bg-emerald-500/20 text-emerald-300";
              let StatusIcon: any = Circle;

              if (s !== 'ALL') {
                const config = STATUS_CONFIG[s as GoalStatus];
                if (config) {
                  StatusIcon = config.icon;
                  activeStyles = `${config.bg} ${config.border} ${config.text} shadow-[0_0_15px_rgba(255,255,255,0.02)]`;
                  countStyles = `bg-white/10 ${config.text}`;
                }
              }

              return (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-wide transition-all border whitespace-nowrap flex items-center gap-1.5",
                    isActive
                      ? activeStyles
                      : "bg-transparent border-white/5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                  )}
                >
                  {s !== 'ALL' && <StatusIcon className="w-3.5 h-3.5 shrink-0" />}
                  {s === 'ALL' ? "TODOS" : (STATUS_CONFIG[s as GoalStatus]?.label || s)}
                  <span className={cn(
                    "text-[9px] px-1.5 py-0.2 rounded-full font-extrabold select-none",
                    isActive ? countStyles : "bg-white/5 text-zinc-600"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Fila 4: Área de Vida */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-zinc-500 tracking-wider flex items-center gap-1.5 uppercase select-none">
            <Filter className="w-3 h-3 text-zinc-500" /> Área de Vida
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {['ALL', ...LIFE_AREAS].map(a => {
              const isActive = filterArea === a;
              const count = getAreaCount(a);
              
              // Get style configuration
              let activeStyles = "bg-indigo-500/10 border-indigo-500/30 text-indigo-400";
              let countStyles = "bg-indigo-500/20 text-indigo-300";
              let AreaIcon: any = Trophy;

              if (a !== 'ALL') {
                const config = LIFE_AREA_CONFIG[a as LifeArea];
                if (config) {
                  AreaIcon = config.icon;
                  activeStyles = `${config.bg} ${config.border} ${config.text} shadow-[0_0_15px_rgba(255,255,255,0.02)]`;
                  countStyles = `bg-white/10 ${config.text}`;
                }
              }

              return (
                <button
                  key={a}
                  onClick={() => setFilterArea(a)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-wide transition-all border whitespace-nowrap flex items-center gap-1.5",
                    isActive
                      ? activeStyles
                      : "bg-transparent border-white/5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                  )}
                >
                  {a !== 'ALL' && <AreaIcon className="w-3.5 h-3.5 shrink-0" />}
                  {a === 'ALL' ? "TODAS" : (LIFE_AREA_CONFIG[a as LifeArea]?.label || a)}
                  <span className={cn(
                    "text-[9px] px-1.5 py-0.2 rounded-full font-extrabold select-none",
                    isActive ? countStyles : "bg-white/5 text-zinc-600"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Form Overlay */}
      <GoalSlideOver
        isOpen={showForm || !!editing}
        initial={editing || undefined}
        goals={goals}
        onSave={handleSave}
        onClose={() => { setShowForm(false); setEditing(null); }}
      />

      {activeTab === "anuales" && (
          filteredAnnuals.length > 0 ? (
            <div className="space-y-6">
              {STATUSES.map(catStatus => {
                const catGoals = filteredAnnuals.filter(g => g.status === catStatus);
                if (catGoals.length === 0) return null;
                const isOpen = openGroups[catStatus];

                return (
                  <div key={catStatus} className={cn("transition-all duration-300", isOpen ? "space-y-3" : "mb-3")}>
                    <button 
                      onClick={() => toggleGroup(catStatus)}
                      className={cn(
                          "flex items-center justify-between w-full text-left transition-colors rounded-xl px-4 py-3 bg-zinc-900/40 border border-white/5 hover:bg-zinc-800/50"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                          {isOpen ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
                          <h2 className={cn("text-sm font-bold flex items-center gap-2 text-zinc-200")}>
                            {catStatus === "DRAFT" ? "Borradores" :
                             catStatus === "ACTIVE" ? "Activas" :
                             catStatus === "IN_PROGRESS" ? "En Curso" :
                             catStatus === "AT_RISK" ? "En Riesgo" :
                             catStatus === "COMPLETED" ? "Completadas" : "Canceladas"}
                            <span className="bg-white/10 px-2 py-0.5 rounded-full text-[10px] text-zinc-400 font-medium">
                              {catGoals.length} {catGoals.length === 1 ? "meta" : "metas"}
                            </span>
                          </h2>
                      </div>
                      {!isOpen && (
                        <div className="flex items-center gap-2">
                            {catStatus === "COMPLETED" && <CheckCircle2 className="w-4 h-4 text-emerald-500/50" />}
                            {catStatus === "IN_PROGRESS" && <Play className="w-4 h-4 text-amber-500/50" />}
                            {catStatus === "ACTIVE" && <Circle className="w-4 h-4 text-blue-500/50" />}
                            {catStatus === "DRAFT" && <Square className="w-4 h-4 text-zinc-600" />}
                        </div>
                      )}
                    </button>

                    {isOpen && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
                        {catGoals.map((goal) => (
                          <GoalCard
                            key={goal.id}
                            goal={goal}
                            uid={uid || ""}
                            menuOpen={menuOpen}
                            setMenuOpen={setMenuOpen}
                            onEdit={setEditing}
                            handleDelete={handleDelete}
                            quickUpdateStatus={quickUpdateStatus}
                            loadData={loadData}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            !showForm && !editing && (
              goals.filter(g => g.period !== "QUARTERLY").length > 0 ? (
                <div className="text-center py-16 bg-[#0c0c0e]/30 border border-white/[0.03] rounded-2xl p-8 max-w-md mx-auto">
                  <div className="w-16 h-16 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-center mx-auto mb-4">
                    <Search className="w-7 h-7 text-zinc-600" />
                  </div>
                  <h3 className="text-sm font-medium text-zinc-300 mb-1">Sin coincidencias</h3>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto mb-6">
                    No encontramos metas que coincidan con los filtros seleccionados. Intenta restablecer los filtros.
                  </p>
                  <button
                    onClick={() => {
                      setFilterHorizon("ALL");
                      setFilterStatus("ALL");
                      setFilterArea("ALL");
                      setSearchTerm("");
                    }}
                    className="btn-primary flex items-center gap-1.5 mx-auto"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Restablecer filtros
                  </button>
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4">
                    <Trophy className="w-7 h-7 text-zinc-600" />
                  </div>
                  <h3 className="text-sm font-medium text-zinc-300 mb-1">Sin metas</h3>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto mb-6">
                    Registra tus grandes metas y empieza a trabajar sobre ellas.
                  </p>
                  <button onClick={() => setShowForm(true)} className="btn-primary mx-auto">
                    Crear primera meta
                  </button>
                </div>
              )
            )
          )
      )}

      {activeTab === "trimestrales" && (
         quarterlies.length === 0 ? (
           goals.filter(g => g.period === "QUARTERLY").length > 0 ? (
            <div className="text-center py-16 bg-[#0c0c0e]/30 border border-white/[0.03] rounded-2xl p-8 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-center mx-auto mb-4">
                <Search className="w-7 h-7 text-zinc-600" />
              </div>
              <h3 className="text-sm font-medium text-zinc-300 mb-1">Sin coincidencias</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto mb-6">
                No encontramos metas trimestrales que coincidan con los filtros seleccionados.
              </p>
              <button
                onClick={() => {
                  setFilterStatus("ALL");
                  setFilterArea("ALL");
                  setSearchTerm("");
                }}
                className="btn-primary flex items-center gap-1.5 mx-auto"
              >
                <RotateCcw className="w-4 h-4" />
                Restablecer filtros
              </button>
            </div>
          ) : (
            <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4">
                <ListChecks className="w-7 h-7 text-zinc-600" />
                </div>
                <h3 className="text-sm font-medium text-zinc-300 mb-1">Sin metas trimestrales</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto mb-6">
                Extrae las metas fácilmente desde tu Hoja de Ruta o crea una nueva meta manualmente.
                </p>
            </div>
          )
         ) : (
             <div className="space-y-8">
                {sortedYears.map(year => (
                    <div key={year} className="space-y-4">
                        <h2 className="text-lg font-black text-white/90 border-b border-white/10 pb-2">{year}</h2>
                        {[1,2,3,4].map(qNum => {
                            const qGoals = groupedQuarterlies[year]?.[qNum];
                            if (!qGoals || qGoals.length === 0) return null;
                            return (
                                <div key={qNum} className="pl-4 border-l-2 border-white/5 space-y-3">
                                    <h3 className="text-sm font-bold text-fuchsia-400">Q{qNum}</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {qGoals.map((goal) => (
                                          <GoalCard
                                            key={goal.id}
                                            goal={goal}
                                            uid={uid || ""}
                                            menuOpen={menuOpen}
                                            setMenuOpen={setMenuOpen}
                                            onEdit={setEditing}
                                            handleDelete={handleDelete}
                                            quickUpdateStatus={quickUpdateStatus}
                                            loadData={loadData}
                                          />
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ))}
             </div>
         )
      )}
    </div>
  );
}
