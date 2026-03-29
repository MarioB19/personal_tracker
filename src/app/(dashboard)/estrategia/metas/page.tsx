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
  Circle
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

  const filteredAnnuals = goals.filter((g) => {
    if (g.period === "QUARTERLY") return false;
    if (filterHorizon !== "ALL" && g.horizon !== filterHorizon) return false;
    if (filterStatus !== "ALL" && g.status !== filterStatus) return false;
    return true;
  });

  const quarterlies = goals.filter((g) => g.period === "QUARTERLY");

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

      <div className="flex bg-black/40 p-1 rounded-xl w-fit border border-white/5">
        <button
          onClick={() => setActiveTab("anuales")}
          className={cn("px-5 py-2 rounded-lg text-[13px] font-semibold transition-colors flex items-center gap-2", activeTab === "anuales" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300")}
        >
          <Trophy className="w-4 h-4" /> Anuales / Vida
        </button>
        <button
           onClick={() => setActiveTab("trimestrales")}
          className={cn("px-5 py-2 rounded-lg text-[13px] font-semibold transition-colors flex items-center gap-2", activeTab === "trimestrales" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300")}
        >
          <ListChecks className="w-4 h-4" /> Trimestrales
        </button>
      </div>

      {/* Filters (Only for Anuales) */}
      {activeTab === "anuales" && (
        <div className="flex gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Filter className="w-3.5 h-3.5" />
            Filtros:
            </div>
            <select
            value={filterHorizon}
            onChange={(e) => setFilterHorizon(e.target.value)}
            className="px-3 py-1.5 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-300"
            >
            <option value="ALL">Todos los horizontes</option>
            {HORIZONS.map((h) => (
                <option key={h} value={h}>{h.replace("_", " ")}</option>
            ))}
            </select>
            <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-300"
            >
            <option value="ALL">Todos los estados</option>
            {STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
            </select>
        </div>
      )}

      {/* Form Overlay */}
      <GoalSlideOver
        isOpen={showForm || !!editing}
        initial={editing || undefined}
        goals={goals}
        onSave={handleSave}
        onClose={() => { setShowForm(false); setEditing(null); }}
      />

      {/* Content */}
      {activeTab === "anuales" && (
          filteredAnnuals.length > 0 ? (
            <div className="space-y-3">
              {filteredAnnuals.map((goal) => (
                <div key={goal.id} className="glass-card p-4 group">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-medium text-zinc-100 truncate">
                          {goal.name}
                        </h3>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full border shrink-0 ${getStatusColor(goal.status)}`}>
                          {goal.status.replace("_", " ")}
                        </span>
                      </div>

                      {goal.description && (
                        <p className="text-xs text-zinc-500 mb-2 line-clamp-1">
                          {goal.description}
                        </p>
                      )}

                      <div className="flex items-center gap-3 flex-wrap text-[10px] text-zinc-500">
                        <span className="bg-zinc-800/50 px-2 py-0.5 rounded">{goal.horizon.replace("_", " ")}</span>
                        <span className="bg-zinc-800/50 px-2 py-0.5 rounded">{goal.type}</span>
                        <span className="bg-zinc-800/50 px-2 py-0.5 rounded">{goal.period}</span>
                        <span className="bg-zinc-800/50 px-2 py-0.5 rounded">{goal.lifeArea}</span>
                      </div>

                      <div className="flex items-center gap-2 mt-3">
                        <div className="flex-1 progress-bar">
                          <div
                            className="progress-bar-fill"
                            style={{ width: `${goal.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-zinc-400 min-w-[40px] text-right font-medium">
                          {formatPercent(goal.progress)}
                        </span>
                      </div>
                    </div>

                    {/* Context menu */}
                    <div className="relative shrink-0">
                      <button
                        onClick={() => setMenuOpen(menuOpen === goal.id ? null : goal.id)}
                        className="text-zinc-600 hover:text-zinc-400 transition-colors opacity-0 group-hover:opacity-100 p-1"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {menuOpen === goal.id && (
                        <div className="absolute right-0 top-8 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-10 py-1 min-w-[140px]">
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
                </div>
              ))}
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
                                                    
                                                    {/* Context menu */}
                                                    <div className="relative shrink-0 ml-2">
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
                                                    <div className="flex-1 progress-bar">
                                                        <div
                                                            className="progress-bar-fill"
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
