"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth, useUid } from "@/lib/hooks/useAuth";
import { getAll, create, update, remove } from "@/lib/repositories/firestore";
import { Mission, Goal, MissionStatus, ChecklistItem } from "@/lib/types";
import { Swords, Plus, Edit2, Trash2, X, Save, MoreVertical, CheckSquare, Square, Activity, Calendar, TargetIcon, ListChecks, CheckCircle2, Play, Check, ChevronDown, ChevronRight, Filter } from "lucide-react";
import { cn, formatPercent, getStatusColor } from "@/lib/utils";
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
    IN_PROGRESS: false,
    COMPLETED: false,
    FAILED: false,
  });

  // Form
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

  const loadData = useCallback(async () => {
    if (!uid) return;
    const [m, g] = await Promise.all([
      getAll<Mission>(uid, "missions"),
      getAll<Goal>(uid, "goals"),
    ]);
    setMissions(m); setGoals(g); setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const resetForm = () => {
    setName(""); setDescription(""); setCategory(""); setGoalId("");
    setDifficulty(3); setTargetDate(""); setStatus("PENDING"); setEvidence(""); setChecklist([]); setNewCheckItem("");
  };

  const openEdit = (m: Mission) => {
    setEditing(m); setShowForm(false);
    setName(m.name); setDescription(m.description); setCategory(m.category);
    setGoalId(m.goalId || ""); setDifficulty(m.difficulty);
    setTargetDate(m.targetDate?.toDate().toISOString().split("T")[0] || "");
    setStatus(m.status); setEvidence(m.evidence); setChecklist(m.checklist || []); setMenuOpen(null);
  };

  const addCheckItem = () => {
    if (!newCheckItem.trim()) return;
    setChecklist([...checklist, { id: Date.now().toString(), text: newCheckItem, completed: false }]);
    setNewCheckItem("");
  };

  const toggleCheckItem = async (missionId: string, itemId: string) => {
    if (!uid) return;
    const mission = missions.find(m => m.id === missionId);
    if (!mission) return;
    const updated = (mission.checklist || []).map(c => c.id === itemId ? { ...c, completed: !c.completed } : c);
    const completedCount = updated.filter(c => c.completed).length;
    const progress = updated.length > 0 ? Math.round((completedCount / updated.length) * 100) : 0;
    
    // Auto-complete status if 100%
    const status = progress >= 100 ? "COMPLETED" : (mission.status === "PENDING" && progress > 0 ? "IN_PROGRESS" : mission.status);

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
      name, description, category, goalId: goalId || undefined,
      difficulty, targetDate: targetDate ? Timestamp.fromDate(new Date(targetDate)) : Timestamp.now(),
      status, progress, checklist, evidence, storageRefs: [],
    };
    if (editing) await update(uid, "missions", editing.id, data);
    else await create(uid, "missions", data as Omit<Mission, "id" | "userId" | "createdAt" | "updatedAt">);
    setShowForm(false); setEditing(null); resetForm(); loadData();
  };

  const handleDelete = async (id: string) => {
    if (!uid) return;
    await remove(uid, "missions", id); setMenuOpen(null); loadData();
  };

  if (loading) return (
    <div className="page-enter space-y-4">
      <div className="h-8 w-48 bg-zinc-900 rounded animate-pulse" />
      {[...Array(3)].map((_, i) => <div key={i} className="glass-card p-5 h-28 animate-pulse" />)}
    </div>
  );

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Swords className="w-5 h-5 text-amber-400" /> Misiones
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">Retos y misiones especiales</p>
        </div>
        <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {['ALL', ...DIFFICULTIES].map(d => (
             <button
                key={d}
                onClick={() => setFilterDiff(d === 'ALL' ? 'ALL' : String(d))}
                className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all border",
                    filterDiff === (d === 'ALL' ? 'ALL' : String(d)) 
                       ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                       : "bg-transparent border-white/5 text-zinc-600 hover:bg-white/5 hover:text-zinc-300"
                )}
                title={d === 'ALL' ? "Todos los niveles" : `Dificultad ${d}`}
             >
                {d === 'ALL' ? <Filter className="w-3.5 h-3.5" /> : d}
             </button>
          ))}
        </div>
          <button onClick={() => { setShowForm(true); setEditing(null); resetForm(); }} className="btn-primary flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Nueva misión
          </button>
        </div>
      </div>

      {/* Slide-over panel */}
      {(showForm || editing) && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={() => { setShowForm(false); setEditing(null); resetForm(); }}
          />
          <div className="relative w-full max-w-lg h-full bg-[#0a0a0a] border-l border-white/[0.08] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex bg-[#0a0a0a] items-center justify-between p-5 border-b border-white/[0.08] shrink-0">
              <div>
                <h3 className="text-base font-semibold text-white">{editing ? "Editar misión" : "Nueva misión"}</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Parámetros de ejecución</p>
              </div>
              <button onClick={() => { setShowForm(false); setEditing(null); resetForm(); }} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-8 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              {/* General details */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2"><Activity className="w-3.5 h-3.5" /> Detalles generales</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Nombre de la misión</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-100 outline-none focus:border-amber-500/50" />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Categoría</label>
                    <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ej: Fitness, Finanzas..." className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-amber-500/50" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Descripción breve</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-100 resize-none outline-none focus:border-amber-500/50" />
                </div>
              </div>

              {/* Strategy */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2"><TargetIcon className="w-3.5 h-3.5" /> Alineación</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Meta maestra</label>
                    <select value={goalId} onChange={(e) => setGoalId(e.target.value)} className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-100 outline-none focus:border-amber-500/50">
                      <option value="">Independiente</option>
                      {goals.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>

                </div>
              </div>

              {/* Parameters */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> Parámetros</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Estado</label>
                    <div className="relative">
                      <select value={status} onChange={(e) => setStatus(e.target.value as MissionStatus)} className="w-full pl-8 pr-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-100 appearance-none outline-none focus:border-amber-500/50">
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <CheckCircle2 className={cn("w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2", 
                        status === "COMPLETED" ? "text-emerald-400" : 
                        status === "IN_PROGRESS" ? "text-amber-400" : 
                        status === "FAILED" ? "text-red-400" : "text-zinc-500"
                      )} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Fecha límite</label>
                    <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-100 outline-none focus:border-amber-500/50" />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Dificultad (1-5)</label>
                    <div className="flex gap-1">
                      {DIFFICULTIES.map(d => (
                        <button key={d} onClick={() => setDifficulty(d)} className={cn(
                          "flex-1 py-1.5 rounded-md text-xs font-medium border transition-all",
                          difficulty === d ? "bg-amber-500/15 border-amber-500/30 text-amber-400" : "bg-black/30 border-white/[0.04] text-zinc-500"
                        )}>{d}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Checklist */}
              <div className="bg-black/30 p-4 rounded-xl border border-white/[0.04]">
                <h4 className="text-sm font-medium text-zinc-200 flex items-center gap-2 mb-3"><ListChecks className="w-4 h-4 text-emerald-400" /> Checklist de la misión</h4>
                <div className="space-y-1.5 mb-3">
                  {checklist.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg bg-zinc-900/30 border border-zinc-800/50">
                      <button onClick={() => setChecklist(checklist.map(c => c.id === item.id ? { ...c, completed: !c.completed } : c))}>
                        {item.completed ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4 text-zinc-600 hover:text-emerald-400/50 transition-colors" />}
                      </button>
                      <span className={cn("text-sm flex-1", item.completed ? "line-through text-zinc-600" : "text-zinc-300")}>{item.text}</span>
                      <button onClick={() => setChecklist(checklist.filter(c => c.id !== item.id))} className="text-zinc-600 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  {checklist.length === 0 && (
                    <p className="text-xs text-zinc-500 py-2 text-center">Sin sub-tareas. Agrega una para medir el progreso.</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <input value={newCheckItem} onChange={(e) => setNewCheckItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCheckItem()}
                    placeholder="Agregar nuevo paso y presionar Enter..." className="flex-1 px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-emerald-500/50" />
                  <button onClick={addCheckItem} className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-3 rounded-lg transition-colors"><Plus className="w-4 h-4" /></button>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-white/[0.08] bg-[#0a0a0a] flex justify-end gap-3 shrink-0">
              <button onClick={() => { setShowForm(false); setEditing(null); resetForm(); }} className="btn-secondary px-6">Cancelar</button>
              <button onClick={handleSave} disabled={!name.trim()} className="btn-primary pl-4 pr-5 disabled:opacity-50">
                <Save className="w-4 h-4 mr-2" />
                {editing ? "Actualizar" : "Guardar Misión"}
              </button>
            </div>
          </div>
        </div>
      )}

      {missions.length > 0 ? (
        <div className="space-y-6">
          {STATUSES.map(catStatus => {
            const catMissions = missions
              .filter(m => m.status === catStatus && (filterDiff === "ALL" || m.difficulty === Number(filterDiff)))
              .sort((a,b) => (a.targetDate?.toMillis() || 0) - (b.targetDate?.toMillis() || 0));
              
            if (catMissions.length === 0) return null;
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
                          {catMissions.length} {catMissions.length === 1 ? "misión" : "misiones"}
                        </span>
                      </h2>
                  </div>
                  {!isOpen && (
                    <div className="flex items-center gap-2">
                        {catStatus === "COMPLETED" && <CheckCircle2 className="w-4 h-4 text-emerald-500/50" />}
                        {catStatus === "IN_PROGRESS" && <Play className="w-4 h-4 text-amber-500/50" />}
                        {catStatus === "PENDING" && <Square className="w-4 h-4 text-zinc-600" />}
                    </div>
                  )}
                </button>
                
                {isOpen && (
                  <div className="space-y-3 pl-6 border-l border-white/5 ml-2 mt-2">
                    {catMissions.map(m => {
                      const isExpanded = expandedId === m.id;
                      const isOverdue = m.targetDate && m.targetDate.toDate() < new Date() && m.status !== "COMPLETED";

                      return (
                        <div key={m.id} className="glass-card p-4 group">
                          <div className="flex items-start gap-4">
                            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : m.id)}>
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-sm font-medium text-zinc-100 truncate">{m.name}</h3>
                                <div className="flex items-center gap-2 text-[10px] text-zinc-500 shrink-0">
                                  <span className="flex items-center gap-1"><Swords className="w-3 h-3"/> D{m.difficulty}</span>
                                  {m.targetDate && (
                                     <span className={cn("flex items-center gap-1", isOverdue && "text-red-400 font-bold")}>
                                       <Calendar className="w-3 h-3"/> {m.targetDate.toDate().toLocaleDateString("es-MX", {day:"2-digit", month:"short"})}
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
                                      let st = m.status;
                                      if(p === 100) st = "COMPLETED";
                                      else if(p > 0 && st === "PENDING") st = "IN_PROGRESS";
                                      update(uid!, "missions", m.id, { progress: p, status: st }).then(loadData);
                                  }}>
                                  <div className="progress-bar-fill shadow-[0_0_10px_rgba(255,255,255,0.2)] group-hover/progress:brightness-125 transition-all" style={{ width: `${m.progress}%` }} />
                                </div>
                                <span className="text-[10px] text-zinc-400 min-w-[32px] text-right font-mono font-medium">{formatPercent(m.progress)}</span>
                              </div>
                            </div>

                            {/* Acciones Rápidas y Menú */}
                            <div className="flex items-center gap-1 shrink-0 relative">
                              {m.status === "PENDING" && (
                                <button onClick={(e) => { e.stopPropagation(); quickUpdateStatus(m.id, "IN_PROGRESS"); }} className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/10 transition-colors" title="Iniciar">
                                  <Play className="w-4 h-4" />
                                </button>
                              )}
                              {m.status === "IN_PROGRESS" && (
                                <button onClick={(e) => { e.stopPropagation(); quickUpdateStatus(m.id, "COMPLETED"); }} className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Completar">
                                  <Check className="w-4 h-4" />
                                </button>
                              )}
                              
                              <button onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === m.id ? null : m.id); }} className="text-zinc-600 hover:text-zinc-400 p-1">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              {menuOpen === m.id && (
                                <div className="absolute right-0 top-8 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-10 py-1 min-w-[120px]">
                                  <button onClick={(e) => { e.stopPropagation(); openEdit(m); }} className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 w-full"><Edit2 className="w-3.5 h-3.5" /> Editar</button>
                                  <button onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }} className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-zinc-800 w-full"><Trash2 className="w-3.5 h-3.5" /> Eliminar</button>
                                </div>
                              )}
                            </div>
                          </div>
                          {isExpanded && m.checklist && m.checklist.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-zinc-800/50 space-y-1.5">
                              {m.checklist.map(item => (
                                <button key={item.id} onClick={() => toggleCheckItem(m.id, item.id)} className="flex items-center gap-2 text-xs w-full text-left">
                                  {item.completed ? <CheckSquare className="w-3.5 h-3.5 text-amber-400 shrink-0" /> : <Square className="w-3.5 h-3.5 text-zinc-600 shrink-0" />}
                                  <span className={cn("text-zinc-300", item.completed && "line-through text-zinc-600")}>{item.text}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : !showForm && !editing && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4">
            <Swords className="w-7 h-7 text-zinc-600" />
          </div>
          <h3 className="text-sm font-medium text-zinc-300 mb-1">Sin misiones</h3>
          <button onClick={() => setShowForm(true)} className="btn-primary mt-3">Crear primera misión</button>
        </div>
      )}
    </div>
  );
}
