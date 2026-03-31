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
  Calendar
} from "lucide-react";
import { cn, formatPercent, getStatusColor } from "@/lib/utils";
import { Timestamp } from "firebase/firestore";
import { GoalSlideOver } from "@/components/shared/GoalSlideOver";

const GOAL_TYPES: GoalType[] = ["RESULTADO", "PROCESO", "HABITO", "PROYECTO", "MANTENIMIENTO"];
const HORIZONS: GoalHorizon[] = ["VIDA", "LARGO_PLAZO", "MEDIANO_PLAZO", "CORTO_PLAZO"];
const PERIODS: GoalPeriod[] = ["ANNUAL", "QUARTERLY", "MONTHLY", "WEEKLY"];
const STATUSES: GoalStatus[] = ["DRAFT", "ACTIVE", "IN_PROGRESS", "AT_RISK", "COMPLETED", "CANCELLED"];
const LIFE_AREAS: LifeArea[] = ["SALUD", "DINERO", "CARRERA", "FAMILIA", "RELACIONES", "APRENDIZAJE", "PROPOSITO", "DIVERSION"];



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
  const [activeTab, setActiveTab] = useState<"anuales" | "trimestrales">("anuales");
  
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    ACTIVE: false,
    IN_PROGRESS: false,
    DRAFT: false,
    AT_RISK: false,
    COMPLETED: false,
    CANCELLED: false,
  });

  const toggleGroup = (status: string) => {
    setOpenGroups(prev => ({ ...prev, [status]: !prev[status] }));
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
    return true;
  });

  const quarterlies = goals.filter((g) => g.period === "QUARTERLY" && (filterStatus === "ALL" || g.status === filterStatus));

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

      {/* Interactive Filters */}
      <div className="space-y-3 pb-2 border-b border-white/5 mb-6">
          {activeTab === "anuales" && (
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
              <span className="text-xs font-semibold text-zinc-500 tracking-wider flex items-center gap-1.5 shrink-0 uppercase min-w-[90px]">
                <Filter className="w-3 h-3" /> Horizonte:
              </span>
              <div className="flex items-center gap-2">
                {['ALL', ...HORIZONS].map(h => (
                   <button
                     key={h}
                     onClick={() => setFilterHorizon(h)}
                     className={cn(
                       "px-4 py-1.5 rounded-full text-[11px] font-bold tracking-wide transition-all border whitespace-nowrap",
                       filterHorizon === h
                         ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                         : "bg-transparent border-white/5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                     )}
                   >
                     {h === 'ALL' ? "TODOS" : h.replace("_", " ")}
                   </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 overflow-x-auto pb-4 scrollbar-none">
            <span className="text-xs font-semibold text-zinc-500 tracking-wider flex items-center gap-1.5 shrink-0 uppercase min-w-[90px]">
              <Filter className="w-3 h-3" /> Estado:
            </span>
            <div className="flex items-center gap-2">
              {['ALL', ...STATUSES].map(s => (
                 <button
                   key={s}
                   onClick={() => setFilterStatus(s)}
                   className={cn(
                     "px-4 py-1.5 rounded-full text-[11px] font-bold tracking-wide transition-all border whitespace-nowrap",
                     filterStatus === s
                       ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                       : "bg-transparent border-white/5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                   )}
                 >
                   {s === 'ALL' ? "TODOS" : s.replace("_", " ")}
                 </button>
              ))}
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
                          "flex items-center justify-between w-full text-left transition-colors rounded-xl",
                          isOpen 
                            ? "" 
                            : "bg-zinc-900/40 border border-white/5 px-4 py-3 hover:bg-zinc-800/50"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                          {isOpen ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
                          <h2 className={cn("text-sm font-bold flex items-center gap-2", isOpen ? "text-zinc-300" : "text-zinc-200")}>
                            {catStatus.replace("_", " ")}
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
                      <div className="space-y-3 pl-6 border-l border-white/5 ml-2 mt-2">
                        {catGoals.map((goal) => {
                          const isOverdue = goal.targetDate && goal.targetDate.toDate() < new Date() && goal.status !== "COMPLETED";
                          
                          return (
                          <div key={goal.id} className="glass-card p-4 group">
                            <div className="flex items-start gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-sm font-medium text-zinc-100 truncate">{goal.name}</h3>
                                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 shrink-0">
                                    <span className="flex items-center gap-1"><Trophy className="w-3 h-3"/> {goal.type}</span>
                                    {goal.targetDate && (
                                       <span className={cn("flex items-center gap-1", isOverdue && "text-red-400 font-bold")}>
                                         <Calendar className="w-3 h-3"/> {goal.targetDate.toDate().toLocaleDateString("es-MX", {day:"2-digit", month:"short"})}
                                       </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 mt-2">
                                  <div className="flex-1 progress-bar cursor-pointer group/progress relative overflow-hidden" onClick={(e) => {
                                        e.stopPropagation();
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        let p = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                                        if (p < 0) p = 0; if (p > 100) p = 100;
                                        let st = goal.status;
                                        if(p === 100) st = "COMPLETED";
                                        else if(p > 0 && st === "ACTIVE") st = "IN_PROGRESS";
                                        update(uid!, "goals", goal.id, { progress: p, status: st }).then(loadData);
                                    }}>
                                    <div
                                      className="progress-bar-fill shadow-[0_0_10px_rgba(255,255,255,0.2)] group-hover/progress:brightness-125 transition-all"
                                      style={{ width: `${goal.progress}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-zinc-400 min-w-[32px] text-right font-mono font-medium">
                                    {formatPercent(goal.progress)}
                                  </span>
                                </div>
                              </div>

                              {/* Acciones Rápidas */}
                              <div className="flex items-center gap-1 shrink-0 relative">
                                {(goal.status === "ACTIVE" || goal.status === "DRAFT") && (
                                  <button onClick={(e) => { e.stopPropagation(); quickUpdateStatus(goal.id, "IN_PROGRESS"); }} className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/10 transition-colors" title="Iniciar">
                                    <Play className="w-4 h-4" />
                                  </button>
                                )}
                                {goal.status === "IN_PROGRESS" && (
                                  <button onClick={(e) => { e.stopPropagation(); quickUpdateStatus(goal.id, "COMPLETED"); }} className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Completar">
                                    <Check className="w-4 h-4" />
                                  </button>
                                )}
                                
                                <button
                                  onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === goal.id ? null : goal.id); }}
                                  className="text-zinc-600 hover:text-zinc-400 transition-colors opacity-0 group-hover:opacity-100 p-1 ml-1"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                                {menuOpen === goal.id && (
                                  <div className="absolute right-0 top-8 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-10 py-1 min-w-[140px]">
                                    <button onClick={(e) => { e.stopPropagation(); setEditing(goal); setShowForm(false); setMenuOpen(null); }} className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 w-full">
                                      <Edit2 className="w-3.5 h-3.5" /> Editar
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(goal.id); }} className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-zinc-800 w-full">
                                      <Trash2 className="w-3 h-3" /> Eliminar
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            !showForm && !editing && (
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
      )}

      {activeTab === "trimestrales" && (
         quarterlies.length === 0 ? (
            <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4">
                <ListChecks className="w-7 h-7 text-zinc-600" />
                </div>
                <h3 className="text-sm font-medium text-zinc-300 mb-1">Sin metas trimestrales</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto mb-6">
                Extrae las metas fácilmente desde tu Hoja de Ruta o crea una nueva meta manualmente.
                </p>
            </div>
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
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {qGoals.map((goal) => (
                                          <div key={goal.id} className="glass-card p-4 group relative">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        {goal.progress >= 100 || goal.status === "COMPLETED" ? (
                                                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                                        ) : (
                                                            <Circle className="w-4 h-4 text-zinc-600 shrink-0" />
                                                        )}
                                                        <h4 className="text-sm font-medium text-zinc-100 line-clamp-2">{goal.name}</h4>
                                                    </div>
                                                    
                                                    {/* Context menu and Actions */}
                                                    <div className="flex items-center gap-1 shrink-0 relative ml-2">
                                                        {goal.status === "ACTIVE" && (
                                                            <button onClick={(e) => { e.stopPropagation(); quickUpdateStatus(goal.id, "IN_PROGRESS"); }} className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/10 transition-colors" title="Iniciar">
                                                              <Play className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                        {goal.status === "IN_PROGRESS" && (
                                                            <button onClick={(e) => { e.stopPropagation(); quickUpdateStatus(goal.id, "COMPLETED"); }} className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Completar">
                                                              <Check className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => setMenuOpen(menuOpen === goal.id ? null : goal.id)}
                                                            className="text-zinc-600 hover:text-zinc-400 transition-colors opacity-0 group-hover:opacity-100 p-1"
                                                        >
                                                            <MoreVertical className="w-4 h-4" />
                                                        </button>
                                                        {menuOpen === goal.id && (
                                                            <div className="absolute right-0 top-6 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-10 py-1 min-w-[140px] ">
                                                            <button
                                                                onClick={() => { setEditing(goal); setShowForm(false); setMenuOpen(null); }}
                                                                className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 w-full"
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5" /> Editar
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(goal.id)}
                                                                className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-zinc-800 w-full"
                                                            >
                                                                <Trash2 className="w-3 h-3" /> Eliminar
                                                            </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 mt-4">
                                                    <div className="flex-1 progress-bar cursor-pointer group/progress relative overflow-hidden" onClick={(e) => {
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            let p = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                                                            if (p < 0) p = 0; if (p > 100) p = 100;
                                                            let st = goal.status;
                                                            if(p === 100) st = "COMPLETED";
                                                            else if(p > 0 && st === "ACTIVE") st = "IN_PROGRESS";
                                                            update(uid!, "goals", goal.id, { progress: p, status: st }).then(loadData);
                                                        }}>
                                                        <div
                                                            className="progress-bar-fill shadow-[0_0_10px_rgba(255,255,255,0.2)] group-hover/progress:brightness-125 transition-all"
                                                            style={{ width: `${goal.progress}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] text-zinc-400 min-w-[30px] text-right font-medium">
                                                        {formatPercent(goal.progress)}
                                                    </span>
                                                </div>
                                                <div className="flex gap-2 mt-3 text-[10px]">
                                                    <span className={`px-2 py-0.5 rounded-full border ${getStatusColor(goal.status)}`}>
                                                        {goal.status}
                                                    </span>
                                                </div>
                                          </div>
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
