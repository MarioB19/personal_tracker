"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth, useUid } from "@/lib/hooks/useAuth";
import { getAll, create, update, remove } from "@/lib/repositories/firestore";
import { Mission, Goal, MissionStatus, ChecklistItem } from "@/lib/types";
import { 
  Swords, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Save, 
  MoreVertical, 
  CheckSquare, 
  Square, 
  Activity, 
  Calendar, 
  Target as TargetIcon, 
  ListChecks, 
  CheckCircle2, 
  Play, 
  Check, 
  ChevronDown, 
  ChevronRight, 
  Filter,
  Shield,
  Trophy,
  Flame,
  Award
} from "lucide-react";
import { cn, formatPercent } from "@/lib/utils";
import { Timestamp } from "firebase/firestore";

const STATUSES: MissionStatus[] = ["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED"];
const DIFFICULTIES = [1, 2, 3, 4, 5] as const;

export default function MisionesPage() {
  const { user } = useAuth();
  const uid = useUid();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Mission | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterDiff, setFilterDiff] = useState<string>("ALL");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    PENDING: false,
    IN_PROGRESS: true, // Default open for active quests
    COMPLETED: false,
    FAILED: false,
  });

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [goalId, setGoalId] = useState("");
  const [difficulty, setDifficulty] = useState<1|2|3|4|5>(3);
  const [targetDate, setTargetDate] = useState("");
  const [status, setStatus] = useState<MissionStatus>("PENDING");
  const [evidence, setEvidence] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newCheckItem, setNewCheckItem] = useState("");

  // SlideOver custom transition states
  const [isRendered, setIsRendered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Inline checklists inputs per card
  const [inlineCheckItem, setInlineCheckItem] = useState<Record<string, string>>({});

  useEffect(() => {
    if (showForm || editing) {
      setIsRendered(true);
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setIsRendered(false), 300);
      return () => clearTimeout(timer);
    }
  }, [showForm, editing]);

  const loadData = useCallback(async () => {
    if (!uid) return;
    const [m, g] = await Promise.all([
      getAll<Mission>(uid, "missions"),
      getAll<Goal>(uid, "goals"),
    ]);
    setMissions(m); 
    setGoals(g); 
    setLoading(false);
  }, [uid]);

  useEffect(() => { 
    if (uid) loadData(); 
  }, [uid, loadData]);

  // RPG Calculations
  const completedMissions = missions.filter(m => m.status === "COMPLETED");
  const activeMissions = missions.filter(m => m.status === "IN_PROGRESS");
  
  // Calculate dynamic XP: each completed mission grants difficulty * 100 XP
  const totalXp = completedMissions.reduce((acc, m) => acc + (m.difficulty * 100), 0);
  // Leveling up: every 1000 XP increases the level by 1 (starts at Lvl 1)
  const currentLevel = Math.floor(totalXp / 1000) + 1;
  const xpForCurrentLevel = totalXp % 1000;
  const xpPercentage = (xpForCurrentLevel / 1000) * 100;

  const getRangoName = (lvl: number) => {
    if (lvl < 2) return "Novato";
    if (lvl < 4) return "Aventurero";
    if (lvl < 7) return "Guerrero Élite";
    if (lvl < 10) return "Paladín";
    return "Leyenda Inmortal";
  };

  const getDifficultyTier = (diff: number) => {
    switch (diff) {
      case 1: return { label: "Fácil", color: "text-slate-400 bg-slate-400/10 border-slate-500/20" };
      case 2: return { label: "Media", color: "text-blue-400 bg-blue-400/10 border-blue-500/20" };
      case 3: return { label: "Élite", color: "text-amber-400 bg-amber-400/10 border-amber-500/20" };
      case 4: return { label: "Heroica", color: "text-orange-400 bg-orange-400/10 border-orange-500/20" };
      case 5: return { label: "Legendaria", color: "text-red-400 bg-red-400/10 border-red-500/20" };
      default: return { label: "Regular", color: "text-zinc-400 bg-zinc-400/10 border-zinc-500/20" };
    }
  };

  const getStatusLabel = (s: MissionStatus) => {
    switch (s) {
      case "PENDING": return "Por Iniciar";
      case "IN_PROGRESS": return "Misiones Activas";
      case "COMPLETED": return "Misiones Resueltas";
      case "FAILED": return "Misiones Fallidas";
      default: return s;
    }
  };

  const getStatusTheme = (s: MissionStatus) => {
    switch (s) {
      case "COMPLETED":
        return {
          label: "Completada",
          color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
          glow: "shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:border-emerald-500/35",
          icon: CheckCircle2,
        };
      case "IN_PROGRESS":
        return {
          label: "En Curso",
          color: "text-amber-400 border-amber-500/20 bg-amber-500/5",
          glow: "shadow-[0_0_15px_rgba(245,158,11,0.1)] hover:border-amber-500/35 bg-gradient-to-br from-amber-500/[0.02] to-orange-500/[0.02]",
          icon: Play,
        };
      case "PENDING":
        return {
          label: "Pendiente",
          color: "text-blue-400 border-blue-500/10 bg-blue-500/[0.02]",
          glow: "shadow-[0_0_15px_rgba(59,130,246,0.02)] hover:border-blue-500/25",
          icon: Square,
        };
      case "FAILED":
      default:
        return {
          label: "Fallida",
          color: "text-red-400 border-red-500/20 bg-red-500/[0.02]",
          glow: "shadow-[0_0_15px_rgba(239,68,68,0.05)] hover:border-red-500/35",
          icon: X,
        };
    }
  };

  const resetForm = () => {
    setName(""); 
    setDescription(""); 
    setCategory(""); 
    setGoalId("");
    setDifficulty(3); 
    setTargetDate(""); 
    setStatus("PENDING"); 
    setEvidence(""); 
    setChecklist([]); 
    setNewCheckItem("");
  };

  const openEdit = (m: Mission) => {
    setEditing(m); 
    setShowForm(false);
    setName(m.name); 
    setDescription(m.description); 
    setCategory(m.category);
    setGoalId(m.goalId || ""); 
    setDifficulty(m.difficulty);
    setTargetDate(m.targetDate?.toDate().toISOString().split("T")[0] || "");
    setStatus(m.status); 
    setEvidence(m.evidence); 
    setChecklist(m.checklist || []); 
    setMenuOpen(null);
  };

  const addCheckItem = () => {
    if (!newCheckItem.trim()) return;
    setChecklist([...checklist, { id: Date.now().toString(), text: newCheckItem, completed: false }]);
    setNewCheckItem("");
  };

  const handleAddInlineCheckItem = async (missionId: string) => {
    const text = inlineCheckItem[missionId]?.trim();
    if (!text || !uid) return;
    const mission = missions.find(m => m.id === missionId);
    if (!mission) return;
    const updatedChecklist = [...(mission.checklist || []), { id: Date.now().toString(), text, completed: false }];
    const completedCount = updatedChecklist.filter(c => c.completed).length;
    const progress = updatedChecklist.length > 0 ? Math.round((completedCount / updatedChecklist.length) * 100) : 0;
    
    let newStatus = mission.status;
    if (progress < 100 && mission.status === "COMPLETED") {
      newStatus = "IN_PROGRESS";
    }

    await update(uid, "missions", missionId, { checklist: updatedChecklist, progress, status: newStatus });
    setInlineCheckItem(prev => ({ ...prev, [missionId]: "" }));
    loadData();
  };

  const toggleCheckItem = async (missionId: string, itemId: string) => {
    if (!uid) return;
    const mission = missions.find(m => m.id === missionId);
    if (!mission) return;
    const updated = (mission.checklist || []).map(c => c.id === itemId ? { ...c, completed: !c.completed } : c);
    const completedCount = updated.filter(c => c.completed).length;
    const progress = updated.length > 0 ? Math.round((completedCount / updated.length) * 100) : 0;
    
    const status = progress >= 100 ? "COMPLETED" : (mission.status === "PENDING" && progress > 0 ? "IN_PROGRESS" : mission.status);

    await update(uid, "missions", missionId, { checklist: updated, progress, status });
    loadData();
  };

  const deleteCheckItem = async (missionId: string, itemId: string) => {
    if (!uid) return;
    const mission = missions.find(m => m.id === missionId);
    if (!mission) return;
    const updated = (mission.checklist || []).filter(c => c.id !== itemId);
    const completedCount = updated.filter(c => c.completed).length;
    const progress = updated.length > 0 ? Math.round((completedCount / updated.length) * 100) : 0;
    
    const status = progress >= 100 && updated.length > 0 ? "COMPLETED" : mission.status;

    await update(uid, "missions", missionId, { checklist: updated, progress, status });
    loadData();
  };

  const quickUpdateStatus = async (id: string, s: MissionStatus) => {
    if (!uid) return;
    const upd: any = { status: s };
    if (s === "COMPLETED") upd.progress = 100;
    await update(uid, "missions", id, upd);
    loadData();
  };

  const toggleGroup = (status: string) => {
    setOpenGroups(prev => ({ ...prev, [status]: !prev[status] }));
  };

  const handleSave = async () => {
    if (!uid || !name.trim()) return;
    const completedCount = checklist.filter(c => c.completed).length;
    const progress = checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 0;
    const data = {
      name, 
      description, 
      category, 
      goalId: goalId || undefined,
      difficulty, 
      targetDate: targetDate ? Timestamp.fromDate(new Date(targetDate)) : Timestamp.now(),
      status, 
      progress, 
      checklist, 
      evidence, 
      storageRefs: [],
    };
    if (editing) await update(uid, "missions", editing.id, data);
    else await create(uid, "missions", data as Omit<Mission, "id" | "userId" | "createdAt" | "updatedAt">);
    setShowForm(false); 
    setEditing(null); 
    resetForm(); 
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!uid) return;
    await remove(uid, "missions", id); 
    setMenuOpen(null); 
    loadData();
  };

  if (loading) return (
    <div className="page-enter space-y-4">
      <div className="h-8 w-48 bg-zinc-900 rounded animate-pulse" />
      {[...Array(3)].map((_, i) => <div key={i} className="glass-card p-5 h-28 animate-pulse" />)}
    </div>
  );

  return (
    <div className="page-enter space-y-8 pb-10">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <Swords className="w-5 h-5 text-black" />
            </div>
            Tablero de Misiones
          </h1>
          <p className="text-xs text-zinc-500 mt-1">Conquista desafíos y acumula experiencia de vida</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Difficulty Filter */}
          <div className="flex items-center gap-1 bg-zinc-950/40 p-1 rounded-2xl border border-white/5">
            <button
              onClick={() => setFilterDiff("ALL")}
              className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold transition-all",
                filterDiff === "ALL" 
                  ? "bg-amber-500/10 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.06)] border border-amber-500/20"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
              title="Todas las dificultades"
            >
              <Filter className="w-3.5 h-3.5" />
            </button>
            {DIFFICULTIES.map(d => (
              <button
                key={d}
                onClick={() => setFilterDiff(String(d))}
                className={cn(
                  "w-8 h-8 rounded-xl flex flex-col items-center justify-center text-[10px] font-black transition-all",
                  filterDiff === String(d)
                    ? "bg-amber-500/10 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.06)] border border-amber-500/20"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
                title={`Dificultad ${d}`}
              >
                <span className="font-mono text-[9px]">D{d}</span>
              </button>
            ))}
          </div>

          <button 
            onClick={() => { setShowForm(true); setEditing(null); resetForm(); }} 
            className="btn-primary pl-4 pr-5 h-10 flex items-center gap-1.5 rounded-xl text-xs"
          >
            <Plus className="w-4 h-4" /> Nueva Misión
          </button>
        </div>
      </div>

      {/* RPG BAR / STATS OVERVIEW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* AVENTURERO CARD */}
        <div className="glass-card p-5 relative overflow-hidden border border-white/[0.04] bg-[#0c0c0e]/80 shadow-[var(--shadow-md)]">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Trophy className="w-24 h-24 text-amber-400" />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Award className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Aventurero</p>
              <h4 className="text-base font-black text-zinc-100">Brandon</h4>
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-black tracking-tight text-white">Nivel {currentLevel}</span>
            <span className="text-xs font-mono font-medium text-zinc-400">{getRangoName(currentLevel)}</span>
          </div>
          {/* Level Progress bar */}
          <div className="mt-2.5">
            <div className="flex justify-between text-[10px] text-zinc-500 mb-1 font-mono">
              <span>{xpForCurrentLevel} XP</span>
              <span>1000 XP</span>
            </div>
            <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                style={{ width: `${xpPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* COMPLETED QUESTS CARD */}
        <div className="glass-card p-5 relative overflow-hidden border border-white/[0.04] bg-[#0c0c0e]/80 shadow-[var(--shadow-md)]">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <CheckCircle2 className="w-24 h-24 text-emerald-400" />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Misiones Completadas</p>
              <h4 className="text-base font-black text-emerald-400">
                {Math.round((completedMissions.length / Math.max(missions.length, 1)) * 100)}% de Éxito
              </h4>
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-black tracking-tight text-white">
              {completedMissions.length} <span className="text-xs text-zinc-500 font-normal">completadas</span>
            </span>
            <span className="text-xs font-mono font-medium text-zinc-400">Total: {missions.length}</span>
          </div>
          {/* Completion Progress bar */}
          <div className="mt-2.5">
            <div className="flex justify-between text-[10px] text-zinc-500 mb-1 font-mono">
              <span>Éxito</span>
              <span>{completedMissions.length} de {missions.length}</span>
            </div>
            <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                style={{ width: `${missions.length > 0 ? (completedMissions.length / missions.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* ACTIVE CAMPAIGNS CARD */}
        <div className="glass-card p-5 relative overflow-hidden border border-white/[0.04] bg-[#0c0c0e]/80 shadow-[var(--shadow-md)]">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Flame className="w-24 h-24 text-orange-400" />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <Flame className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Campañas Activas</p>
              <h4 className="text-base font-black text-orange-400">Bajo Ejecución</h4>
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-black tracking-tight text-white">
              {activeMissions.length} <span className="text-xs text-zinc-500 font-normal">en curso</span>
            </span>
            <span className="text-xs font-mono font-medium text-zinc-400">
              {missions.filter(m => m.status === "PENDING").length} pendientes
            </span>
          </div>
          {/* Active Progress bar */}
          <div className="mt-2.5">
            <div className="flex justify-between text-[10px] text-zinc-500 mb-1 font-mono">
              <span>Progreso activo</span>
              <span>{activeMissions.length} activas</span>
            </div>
            <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-orange-500 to-amber-400 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(249,115,22,0.3)]"
                style={{ width: `${missions.length > 0 ? (activeMissions.length / missions.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Slide-over panel (Unified transition layout) */}
      {isRendered && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div 
            className={cn(
              "absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300",
              isVisible ? "opacity-100" : "opacity-0"
            )} 
            onClick={() => { setShowForm(false); setEditing(null); resetForm(); }}
          />
          <div className={cn(
            "relative w-full max-w-lg h-full bg-[#0c0c0e] border-l border-white/10 shadow-2xl transition-transform duration-300 ease-out flex flex-col z-10",
            isVisible ? "translate-x-0" : "translate-x-full"
          )}>
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#0c0c0e]/80 backdrop-blur-xl shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/10 flex items-center justify-center">
                  <Swords className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight leading-none">{editing ? "Modificar Misión" : "Nueva Misión"}</h3>
                  <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider font-semibold">Parámetros RPG de Reto</p>
                </div>
              </div>
              <button 
                onClick={() => { setShowForm(false); setEditing(null); resetForm(); }} 
                className="w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              {/* General details */}
              <div className="space-y-4">
                <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2 pb-1.5 border-b border-white/5">
                  <Activity className="w-3.5 h-3.5 text-amber-500/80" /> Detalles Generales
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Nombre de la misión</label>
                    <input 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      placeholder="Ej: Correr maratón, Estudiar Next.js"
                      className="w-full px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Categoría</label>
                    <input 
                      value={category} 
                      onChange={(e) => setCategory(e.target.value)} 
                      placeholder="Ej: Fitness, Finanzas, Estudio" 
                      className="w-full px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Descripción breve</label>
                  <textarea 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    rows={2} 
                    placeholder="Escribe detalles claves del desafío..."
                    className="w-full px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 resize-none focus:outline-none focus:border-amber-500/50 transition-colors" 
                  />
                </div>
              </div>

              {/* Strategy Alignment */}
              <div className="space-y-4">
                <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2 pb-1.5 border-b border-white/5">
                  <TargetIcon className="w-3.5 h-3.5 text-amber-500/80" /> Alineación Estratégica
                </h4>
                <div>
                  <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Meta Maestra Asociada</label>
                  <select 
                    value={goalId} 
                    onChange={(e) => setGoalId(e.target.value)} 
                    className="w-full px-3 py-3 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50 appearance-none font-medium"
                  >
                    <option value="" className="bg-zinc-900 text-zinc-500">Misión Independiente</option>
                    {goals.map(g => <option key={g.id} value={g.id} className="bg-zinc-900 text-white">{g.name}</option>)}
                  </select>
                </div>
              </div>

              {/* RPG Parameter values */}
              <div className="space-y-5">
                <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2 pb-1.5 border-b border-white/5">
                  <Calendar className="w-3.5 h-3.5 text-amber-500/80" /> Parámetros y Dificultad
                </h4>
                
                {/* Custom Status Picker */}
                <div>
                  <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Estado de la Misión</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {STATUSES.map(s => {
                      const theme = getStatusTheme(s);
                      const isSelected = status === s;
                      const Icon = theme.icon;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setStatus(s)}
                          className={cn(
                            "flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-bold transition-all duration-200",
                            isSelected
                              ? `${theme.color} ${theme.glow} border-current scale-[1.02]`
                              : "bg-black/30 border-white/[0.04] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
                          )}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span className="capitalize">{s.toLowerCase().replace("_", " ")}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Fecha límite de ejecución</label>
                    <input 
                      type="date" 
                      value={targetDate} 
                      onChange={(e) => setTargetDate(e.target.value)} 
                      className="w-full px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50 block" 
                      style={{ colorScheme: "dark" }}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Dificultad (RPG Rango)</label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {DIFFICULTIES.map(d => {
                        const isSelected = difficulty === d;
                        const tier = getDifficultyTier(d);
                        return (
                          <button 
                            key={d} 
                            type="button"
                            onClick={() => setDifficulty(d)} 
                            className={cn(
                              "flex flex-col items-center justify-center py-2 rounded-lg border text-[9px] font-black transition-all transform active:scale-95",
                              isSelected 
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.1)]" 
                                : "bg-black/30 border-white/[0.04] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
                            )}
                            title={tier.label}
                          >
                            <span className="font-mono text-xs">{d}</span>
                            <span className="text-[8px] uppercase tracking-tighter">{tier.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Checklist builder */}
              <div className="bg-black/30 p-4 rounded-xl border border-white/5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2 mb-3">
                  <ListChecks className="w-4 h-4 text-emerald-400" /> Checklist de Sub-tareas
                </h4>
                <div className="space-y-1.5 mb-4">
                  {checklist.map((item) => (
                    <div key={item.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-zinc-900/30 border border-zinc-800/40 hover:border-zinc-800/80 transition-colors">
                      <button 
                        type="button"
                        onClick={() => setChecklist(checklist.map(c => c.id === item.id ? { ...c, completed: !c.completed } : c))}
                      >
                        {item.completed ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4 text-zinc-600 hover:text-emerald-400/50 transition-colors" />}
                      </button>
                      <span className={cn("text-xs flex-1 text-zinc-300", item.completed && "line-through text-zinc-600")}>{item.text}</span>
                      <button 
                        type="button"
                        onClick={() => setChecklist(checklist.filter(c => c.id !== item.id))} 
                        className="text-zinc-600 hover:text-red-400 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {checklist.length === 0 && (
                    <p className="text-xs text-zinc-500 py-3 text-center border border-dashed border-white/5 rounded-lg bg-white/[0.01]">
                      Sin sub-tareas. Agrega pasos para medir tu progreso porcentual.
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <input 
                    value={newCheckItem} 
                    onChange={(e) => setNewCheckItem(e.target.value)} 
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCheckItem())}
                    placeholder="Agregar paso y presionar Enter..." 
                    className="flex-1 px-3 py-2 bg-white/[0.02] border border-white/5 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors" 
                  />
                  <button 
                    type="button"
                    onClick={addCheckItem} 
                    className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 px-3.5 rounded-lg transition-colors flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Footer actions - Styled consistent with GoalSlideOver */}
            <div className="p-6 border-t border-white/5 bg-[#0c0c0e] flex justify-end gap-3 shrink-0">
              <button 
                onClick={() => { setShowForm(false); setEditing(null); resetForm(); }} 
                className="btn-secondary h-11 px-5 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave} 
                disabled={!name.trim()} 
                className="btn-primary pl-4 pr-5 h-11 disabled:opacity-50 disabled:grayscale transition-all duration-300 flex items-center justify-center gap-1.5 rounded-xl text-xs font-black shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:shadow-[0_0_30px_rgba(245,158,11,0.25)]"
              >
                <Save className="w-4 h-4" />
                {editing ? "Guardar Cambios" : "Trazar Misión"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MISSIONS BOARD CONTENT */}
      {missions.length > 0 ? (
        <div className="space-y-6">
          {STATUSES.map(catStatus => {
            const catMissions = missions
              .filter(m => m.status === catStatus && (filterDiff === "ALL" || m.difficulty === Number(filterDiff)))
              .sort((a,b) => (a.targetDate?.toMillis() || 0) - (b.targetDate?.toMillis() || 0));
              
            if (catMissions.length === 0) return null;
            const isOpen = openGroups[catStatus];
            const theme = getStatusTheme(catStatus);
            const Icon = theme.icon;

            return (
              <div key={catStatus} className={cn("transition-all duration-300", isOpen ? "space-y-3" : "mb-3")}>
                {/* Accordion header button */}
                <button 
                  onClick={() => toggleGroup(catStatus)}
                  className={cn(
                      "flex items-center justify-between w-full text-left transition-all rounded-xl px-4 py-3.5 border",
                      isOpen 
                        ? "bg-zinc-900/80 backdrop-blur border-white/10 text-white shadow-[0_4px_12px_rgba(0,0,0,0.2)]" 
                        : "bg-zinc-950/20 border-white/5 hover:bg-zinc-900/30 text-zinc-300"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
                    <div className="flex items-center gap-2">
                      <div className={cn("flex h-6 w-6 items-center justify-center rounded-lg border", theme.color)}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <h2 className="text-xs font-black tracking-wider uppercase">
                        {getStatusLabel(catStatus)}
                      </h2>
                    </div>
                    <span className="bg-white/5 border border-white/5 px-2 py-0.5 rounded-full text-[9px] text-zinc-400 font-bold tracking-normal font-mono">
                      {catMissions.length}
                    </span>
                  </div>
                  {!isOpen && (
                    <span className="text-[10px] text-zinc-500 font-medium">Click para expandir</span>
                  )}
                </button>
                
                {/* Accordion cards container */}
                {isOpen && (
                  <div className="space-y-3 pl-3 md:pl-6 border-l border-white/5 ml-4 mt-2">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {catMissions.map(m => {
                        const isExpanded = expandedId === m.id;
                        const isOverdue = m.targetDate && m.targetDate.toDate() < new Date() && m.status !== "COMPLETED" && m.status !== "FAILED";
                        const associatedGoal = goals.find(g => g.id === m.goalId);
                        const tier = getDifficultyTier(m.difficulty);

                        return (
                          <div 
                            key={m.id} 
                            className={cn(
                              "glass-card p-5 group flex flex-col justify-between border transition-all duration-300",
                              isOverdue 
                                ? "border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.06)] hover:border-red-500/40" 
                                : isExpanded
                                  ? "border-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.02)]"
                                  : "border-white/[0.04]"
                            )}
                          >
                            <div>
                              {/* Card Header */}
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                    <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-white/5 border border-white/5 text-zinc-400">
                                      {m.category || "General"}
                                    </span>
                                    {isOverdue && (
                                      <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-red-500/10 border border-red-500/20 text-red-400 animate-pulse">
                                        Vencida
                                      </span>
                                    )}
                                  </div>
                                  <h3 
                                    onClick={() => setExpandedId(isExpanded ? null : m.id)}
                                    className="text-sm font-bold text-zinc-100 hover:text-amber-400 transition-colors cursor-pointer tracking-tight"
                                  >
                                    {m.name}
                                  </h3>
                                </div>

                                {/* RPG Difficulty swords indicator */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <div className="flex gap-0.5 text-amber-400/80" title={`Dificultad ${m.difficulty}: ${tier.label}`}>
                                    {Array.from({ length: m.difficulty }).map((_, i) => (
                                      <Swords key={i} className="w-3.5 h-3.5 drop-shadow-[0_0_4px_rgba(245,158,11,0.3)]" />
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Card Description */}
                              {m.description && (
                                <p className="text-xs text-zinc-400 mt-2 line-clamp-2 leading-relaxed">
                                  {m.description}
                                </p>
                              )}

                              {/* Strategy Alignment Badge */}
                              {associatedGoal && (
                                <div className="mt-3 flex">
                                  <span className="inline-flex items-center gap-1.5 text-[9px] text-zinc-400 bg-white/[0.01] border border-white/5 px-2 py-0.5 rounded-md font-semibold tracking-tight">
                                    <TargetIcon className="w-3 h-3 text-amber-500" />
                                    {associatedGoal.name}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Card Footer Progress & Actions */}
                            <div className="mt-5 pt-4 border-t border-white/[0.03]">
                              <div className="flex items-center justify-between gap-4">
                                {/* Interactive progress bar on card */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-center text-[10px] text-zinc-400 mb-1.5 font-medium">
                                    <span>Progreso</span>
                                    <span className="font-mono font-bold text-zinc-300">{m.progress}%</span>
                                  </div>
                                  <div 
                                    className="progress-bar-lg cursor-pointer group/progress relative overflow-hidden bg-zinc-950/80 border border-white/5" 
                                    title="Click para ajustar progreso"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      let p = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                                      if (p < 0) p = 0; if (p > 100) p = 100;
                                      let st = m.status;
                                      if(p === 100) st = "COMPLETED";
                                      else if(p > 0 && st === "PENDING") st = "IN_PROGRESS";
                                      update(uid!, "missions", m.id, { progress: p, status: st }).then(loadData);
                                    }}
                                  >
                                    <div 
                                      className={cn("h-full rounded-full transition-all duration-300 relative", 
                                        m.status === "COMPLETED" ? "bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]" :
                                        m.status === "IN_PROGRESS" ? "bg-gradient-to-r from-amber-600 to-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.3)]" :
                                        m.status === "FAILED" ? "bg-gradient-to-r from-red-600 to-red-400 shadow-[0_0_8px_rgba(239,68,68,0.3)]" : "bg-zinc-600"
                                      )} 
                                      style={{ width: `${m.progress}%` }} 
                                    />
                                  </div>
                                </div>

                                {/* Acciones Rápidas */}
                                <div className="flex items-center gap-1.5 shrink-0 relative pt-3.5">
                                  {m.targetDate && (
                                     <span className={cn(
                                       "flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold border shrink-0 transition-all font-mono",
                                       isOverdue 
                                         ? "bg-red-500/10 border-red-500/20 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.15)] animate-pulse" 
                                         : "bg-white/[0.01] border-white/5 text-zinc-500"
                                     )}>
                                       <Calendar className="w-3.5 h-3.5 shrink-0"/> 
                                       {m.targetDate.toDate().toLocaleDateString("es-MX", {day:"2-digit", month:"short"})}
                                     </span>
                                  )}

                                  {m.status === "PENDING" && (
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); quickUpdateStatus(m.id, "IN_PROGRESS"); }} 
                                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 hover:text-blue-300 hover:scale-105 active:scale-95 transition-all" 
                                      title="Iniciar misión"
                                    >
                                      <Play className="w-3.5 h-3.5 fill-current" />
                                    </button>
                                  )}
                                  {m.status === "IN_PROGRESS" && (
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); quickUpdateStatus(m.id, "COMPLETED"); }} 
                                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 hover:text-emerald-300 hover:scale-105 active:scale-95 transition-all" 
                                      title="Completar misión"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  
                                  <div className="relative">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === m.id ? null : m.id); }} 
                                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.02] border border-white/5 text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all"
                                    >
                                      <MoreVertical className="w-3.5 h-3.5" />
                                    </button>
                                    {menuOpen === m.id && (
                                      <div className="absolute right-0 bottom-10 bg-zinc-950 border border-white/5 rounded-xl shadow-2xl z-25 py-1 min-w-[120px] animate-in fade-in duration-200">
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); openEdit(m); }} 
                                          className="flex items-center gap-2 px-3.5 py-2 text-xs text-zinc-300 hover:bg-white/5 w-full hover:text-white transition-colors"
                                        >
                                          <Edit2 className="w-3 h-3 text-amber-400" /> Editar
                                        </button>
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }} 
                                          className="flex items-center gap-2 px-3.5 py-2 text-xs text-red-400 hover:bg-red-500/5 w-full transition-colors border-t border-white/[0.03]"
                                        >
                                          <Trash2 className="w-3 h-3" /> Eliminar
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Collapsible checklist section */}
                              <div className="mt-3">
                                <button 
                                  onClick={() => setExpandedId(isExpanded ? null : m.id)}
                                  className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1 font-semibold uppercase tracking-wider py-1.5"
                                >
                                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                  {m.checklist && m.checklist.length > 0 
                                    ? `Sub-tareas (${m.checklist.filter(c => c.completed).length}/${m.checklist.length})`
                                    : "Agregar Sub-tareas"
                                  }
                                </button>
                                
                                {isExpanded && (
                                  <div className="mt-3 pt-3 border-t border-white/[0.03] space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                    {m.checklist && m.checklist.map(item => (
                                      <div key={item.id} className="flex items-center justify-between group/item p-1 hover:bg-white/[0.01] rounded-lg transition-all">
                                        <button 
                                          onClick={() => toggleCheckItem(m.id, item.id)} 
                                          className="flex items-center gap-2.5 text-xs text-left"
                                        >
                                          {item.completed ? (
                                            <CheckSquare className="w-4 h-4 text-amber-400 shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.2)]" />
                                          ) : (
                                            <Square className="w-4 h-4 text-zinc-600 hover:text-amber-400/50 transition-colors shrink-0" />
                                          )}
                                          <span className={cn("text-zinc-300 transition-all", item.completed && "line-through text-zinc-600 font-normal")}>
                                            {item.text}
                                          </span>
                                        </button>
                                        <button 
                                          onClick={() => deleteCheckItem(m.id, item.id)}
                                          className="opacity-0 group-hover/item:opacity-100 text-zinc-600 hover:text-red-400 p-0.5 rounded transition-all"
                                          title="Eliminar paso"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ))}
                                    
                                    {/* Inline Add subtask to expanded card */}
                                    <div className="flex gap-2 mt-2 pt-2 border-t border-dashed border-white/5">
                                      <input 
                                        value={inlineCheckItem[m.id] || ""} 
                                        onChange={(e) => setInlineCheckItem({ ...inlineCheckItem, [m.id]: e.target.value })} 
                                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddInlineCheckItem(m.id))}
                                        placeholder="Nuevo paso..." 
                                        className="flex-1 bg-white/[0.01] border border-white/5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-amber-500/50 placeholder:text-zinc-700"
                                      />
                                      <button 
                                        onClick={() => handleAddInlineCheckItem(m.id)}
                                        className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg px-2.5 flex items-center justify-center transition-all duration-200"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : !showForm && !editing && (
        <div className="text-center py-20 border border-dashed border-white/5 rounded-3xl bg-[#0c0c0e]/30">
          <div className="w-16 h-16 rounded-2xl bg-zinc-950 border border-white/5 flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(245,158,11,0.05)]">
            <Swords className="w-7 h-7 text-zinc-600" />
          </div>
          <h3 className="text-sm font-bold text-zinc-300 mb-1">Sin Misiones</h3>
          <p className="text-xs text-zinc-500 max-w-xs mx-auto mb-4">No tienes misiones registradas. ¡Toma el control y crea tu primera misión especial!</p>
          <button onClick={() => setShowForm(true)} className="btn-primary pl-4 pr-5 h-10 rounded-xl text-xs">Crear Primera Misión</button>
        </div>
      )}
    </div>
  );
}
