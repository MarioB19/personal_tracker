"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth, useUid } from "@/lib/hooks/useAuth";
import { getAll } from "@/lib/repositories/firestore";
import { generateAlerts, Alert } from "@/lib/services/tracking.service";
import { Goal, Mission } from "@/lib/types";
import {
  Target,
  Trophy,
  ListChecks,
  Swords,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  ArrowRight,
  Plus,
  Sparkles,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { formatPercent, getStatusColor, cn } from "@/lib/utils";

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: string;
  accentColor?: string;
}

function StatCard({ icon: Icon, label, value, subtitle, trend, accentColor = "amber" }: StatCardProps) {
  const colorMap: Record<string, { bg: string; text: string; glow: string }> = {
    amber: { bg: "from-amber-500/12 to-amber-600/5", text: "text-amber-400", glow: "shadow-amber-500/5" },
    emerald: { bg: "from-emerald-500/12 to-emerald-600/5", text: "text-emerald-400", glow: "shadow-emerald-500/5" },
    blue: { bg: "from-blue-500/12 to-blue-600/5", text: "text-blue-400", glow: "shadow-blue-500/5" },
    purple: { bg: "from-purple-500/12 to-purple-600/5", text: "text-purple-400", glow: "shadow-purple-500/5" },
  };
  const colors = colorMap[accentColor] || colorMap.amber;

  return (
    <div className="glass-card p-5 group relative overflow-hidden">
      {/* Subtle glow */}
      <div className={`absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-br ${colors.bg} rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
      
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors.bg} border border-white/[0.04] flex items-center justify-center ${colors.text}`}>
            <Icon className="w-[18px] h-[18px]" />
          </div>
          {trend && (
            <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              {trend}
            </span>
          )}
        </div>
        <p className="text-2xl font-bold stat-number tracking-tight">{value}</p>
        <p className="text-xs text-zinc-500 mt-1 font-medium">{label}</p>
        {subtitle && (
          <p className="text-[10px] text-zinc-600 mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function AlertCard({ alert }: { alert: Alert }) {
  const styles = {
    danger: { border: "border-red-500/15", bg: "bg-red-500/[0.03]", dot: "bg-red-400", icon: <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> },
    warning: { border: "border-amber-500/15", bg: "bg-amber-500/[0.03]", dot: "bg-amber-400", icon: <Clock className="w-3.5 h-3.5 text-amber-400" /> },
    info: { border: "border-blue-500/15", bg: "bg-blue-500/[0.03]", dot: "bg-blue-400", icon: <TrendingUp className="w-3.5 h-3.5 text-blue-400" /> },
  };
  const s = styles[alert.type];

  return (
    <div className={`flex items-center gap-3 px-3.5 py-3 rounded-lg border ${s.border} ${s.bg} transition-all hover:scale-[1.01]`}>
      <div className="pulse-dot shrink-0">{s.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-zinc-300">{alert.title}</p>
        <p className="text-[11px] text-zinc-500 truncate mt-0.5">{alert.description}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const uid = useUid();

  const [goals, setGoals] = useState<Goal[]>([]);

  const [missions, setMissions] = useState<Mission[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!uid) return;
    try {
      const [g, m] = await Promise.all([
        getAll<Goal>(uid, "goals"),
        getAll<Mission>(uid, "missions"),
      ]);
      setGoals(g);
      setMissions(m);
      setAlerts(generateAlerts(g, m));
    } catch (err) {
      console.error("Error loading data:", err);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeGoals = goals.filter((g) => g.status !== "COMPLETED" && g.status !== "CANCELLED");
  const completedGoals = goals.filter((g) => g.status === "COMPLETED");

  const activeMissions = missions.filter((m) => m.status !== "COMPLETED" && m.status !== "FAILED");

  const avgGoalProgress = activeGoals.length > 0
    ? Math.round(activeGoals.reduce((sum, g) => sum + g.progress, 0) / activeGoals.length)
    : 0;

  const hasData = goals.length > 0;

  if (loading) {
    return (
      <div className="page-enter space-y-6">
        <div className="h-10 w-64 skeleton" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 skeleton" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-64 skeleton" />
          <div className="h-64 skeleton" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter space-y-8 pb-10">
      {/* Background glow removed from here, moved to global layout */}

      {/* Hero Header */}
      <div className="flex flex-col items-center text-center lg:flex-row lg:items-center lg:text-left lg:justify-between mb-8 mt-4 gap-4">
        <div className="flex flex-col items-center lg:flex-row lg:items-center gap-4">
          <div className="hero-icon-box lg:mb-0" style={{ animation: "float 6s ease-in-out infinite" }}>
            <Sparkles className="w-10 h-10" />
          </div>
          <div>
            <h1 className="hero-title lg:text-3xl lg:mb-1">
              Hola, <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Brandon</span>
            </h1>
            <p className="hero-subtitle lg:text-left lg:mx-0">
              {new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-2 text-xs text-zinc-600 bg-white/[0.03] border border-white/[0.05] rounded-full px-4 py-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-400/50" />
          <span>Sistema activo</span>
        </div>
      </div>

      {/* Stats - Bento Grid Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-2 gap-4 lg:gap-6">
        <StatCard
          icon={Trophy}
          label="Metas activas"
          value={activeGoals.length}
          subtitle={completedGoals.length > 0 ? `${completedGoals.length} completadas` : undefined}
          accentColor="emerald"
        />

        <StatCard
          icon={Swords}
          label="Misiones activas"
          value={activeMissions.length}
          accentColor="purple"
        />
      </div>

      {/* Progress overview - Full Width Bento */}
      {activeGoals.length > 0 && (
        <div className="glass-card p-6 border-amber-500/20 shadow-[0_0_50px_rgba(245,158,11,0.05)]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                 <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <h2 className="text-lg font-bold">Resumen Estratégico</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                {formatPercent(avgGoalProgress)}
              </span>
            </div>
          </div>
          <div className="progress-bar-lg h-3">
            <div className="progress-bar-fill" style={{ width: `${avgGoalProgress}%` }} />
          </div>
          <p className="text-xs text-zinc-500 mt-4 font-medium uppercase tracking-wider">
            Promedio de {activeGoals.length} metas activas
          </p>
        </div>
      )}

      {/* Secondary Bento Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Alerts */}
        <div className="glass-card-static flex flex-col h-[400px]">
          <div className="p-5 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <h2 className="text-[13px] font-semibold">Alertas</h2>
                </div>
                {alerts.length > 0 && (
                  <span className="text-[10px] font-bold bg-zinc-800 text-zinc-300 px-2.5 py-0.5 rounded-full border border-white/5">
                    {alerts.length} totales
                  </span>
                )}
              </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar px-5 pb-5 space-y-4">
              {alerts.length > 0 ? (
                  <>
                      {alerts.filter(a => a.type === "danger").length > 0 && (
                          <div className="space-y-2">
                              <h3 className="text-[10px] uppercase font-bold text-red-500 tracking-wider">Prioridad Alta</h3>
                              {alerts.filter(a => a.type === "danger").map((alert) => (
                                  <AlertCard key={alert.id} alert={alert} />
                              ))}
                          </div>
                      )}
                      
                      {alerts.filter(a => a.type === "warning").length > 0 && (
                          <div className="space-y-2">
                              <h3 className="text-[10px] uppercase font-bold text-amber-500 tracking-wider mt-2">Atención</h3>
                              {alerts.filter(a => a.type === "warning").map((alert) => (
                                  <AlertCard key={alert.id} alert={alert} />
                              ))}
                          </div>
                      )}

                      {alerts.filter(a => a.type === "info").length > 0 && (
                          <div className="space-y-2">
                              <h3 className="text-[10px] uppercase font-bold text-blue-500 tracking-wider mt-2">Información</h3>
                              {alerts.filter(a => a.type === "info").map((alert) => (
                                  <AlertCard key={alert.id} alert={alert} />
                              ))}
                          </div>
                      )}
                  </>
              ) : (
                <div className="text-center py-10 h-full flex flex-col items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500/20 mb-3" />
                  <p className="text-[12px] font-medium text-zinc-300">Todo en orden</p>
                  <p className="text-[10px] text-zinc-600 mt-1">No hay alertas activas que requieran tu atención.</p>
                </div>
              )}
          </div>
        </div>

        {/* Recent goals */}
        <div className="glass-card-static flex flex-col h-[400px]">
          <div className="p-5 pb-4 border-b border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <h2 className="text-[13px] font-semibold">Metas recientes</h2>
                </div>
                <Link
                  href="/estrategia/metas"
                  className="text-[10px] text-zinc-500 hover:text-amber-400 transition-colors flex items-center gap-1 font-medium bg-white/5 px-2 py-1 rounded hover:bg-white/10"
                >
                  Ver todas <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 pt-4">
              {activeGoals.length > 0 ? (
                <div className="space-y-4">
                  {activeGoals.slice(0, 6).map((goal) => (
                    <div key={goal.id} className="group hover:bg-white/[0.02] p-2 -mx-2 rounded-lg transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[12px] font-bold text-zinc-200 truncate pr-3 group-hover:text-amber-400 transition-colors">
                          {goal.name}
                        </p>
                        <span className={`badge shrink-0 ${getStatusColor(goal.status)}`}>
                          {goal.status.replace("_", " ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 progress-bar h-1.5">
                          <div
                            className="progress-bar-fill"
                            style={{ width: `${goal.progress}%`, ...(goal.progress === 100 ? { background: '#10b981' } : {}) }}
                          />
                        </div>
                        <span className={cn("text-[10px] font-mono font-bold min-w-[32px] text-right", goal.progress === 100 ? "text-emerald-400" : "text-zinc-400")}>
                          {formatPercent(goal.progress)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state h-full flex flex-col items-center justify-center">
                  <div className="empty-state-icon">
                    <Plus className="w-5 h-5 text-zinc-600" />
                  </div>
                  <p className="text-[12px] font-medium text-zinc-300 mb-1">Aún no tienes metas</p>
                  <p className="text-[10px] text-zinc-500 mb-4 text-center max-w-[200px]">Define tus prioridades y empieza a trackear tu progreso.</p>
                  <Link href="/estrategia/metas" className="btn-primary flex items-center gap-1.5">
                    Crear meta <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
          </div>
        </div>
      </div>

      {/* Quick actions - Bento Grid Row 3 */}
      {hasData ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mt-8">
          {[
            { label: "Planificador", href: "/planificador", icon: Target, color: "from-amber-500 to-orange-500", glow: "shadow-amber-500/20" },
            { label: "Nueva meta", href: "/estrategia/metas", icon: Trophy, color: "from-emerald-400 to-emerald-600", glow: "shadow-emerald-500/20" },

            { label: "Nueva misión", href: "/misiones", icon: Swords, color: "from-purple-400 to-purple-600", glow: "shadow-purple-500/20" },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="glass-card p-5 lg:p-6 flex flex-col items-center justify-center gap-4 group text-center"
            >
              <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${action.color} border border-white/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-[0_5px_15px_rgba(0,0,0,0.3)] group-hover:${action.glow} group-hover:shadow-[0_10px_25px]`}>
                <action.icon className="w-6 h-6 text-black" />
              </div>
              <span className="text-sm font-bold text-white tracking-wide">
                {action.label}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        /* Onboarding for new users - Giant Card */
        <div className="glass-card p-10 lg:p-16 text-center border-amber-500/30 w-full mt-10 shadow-[0_0_100px_rgba(245,158,11,0.1)]">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 border-4 border-black flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-amber-500/40" style={{ animation: "float 6s ease-in-out infinite" }}>
            <Sparkles className="w-10 h-10 text-black" />
          </div>
          <h3 className="text-3xl font-black text-white mb-4">Bienvenido a LifeTracker</h3>
          <p className="text-zinc-400 mb-10 max-w-lg mx-auto text-lg">
            Revoluciona tu manera de operar. Empieza definiendo tus prioridades de vida.
          </p>
          <Link
            href="/estrategia/metas"
            className="btn-primary inline-flex items-center gap-3 text-lg px-8 py-5 shadow-2xl"
          >
            <Target className="w-6 h-6" />
            Configurar Metas
          </Link>
        </div>
      )}
    </div>
  );
}
