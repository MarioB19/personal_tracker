"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth, useUid } from "@/lib/hooks/useAuth";
import { getAll, create, remove } from "@/lib/repositories/firestore";
import { Review, ReviewType, ReviewMetric } from "@/lib/types";
import { ClipboardCheck, Plus, X, Save, Trash2, ChevronDown, Star, Trophy, Brain, ShieldAlert, Wrench, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { Timestamp } from "firebase/firestore";

const REVIEW_TYPES: { key: ReviewType; label: string }[] = [
  { key: "WEEKLY", label: "Semanal" },
  { key: "BIWEEKLY", label: "Quincenal" },
  { key: "MONTHLY", label: "Mensual" },
  { key: "QUARTERLY", label: "Trimestral" },
  { key: "ANNUAL", label: "Anual" },
];

function generatePeriod(type: ReviewType): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.toLocaleString("es-ES", { month: "short" });
  const monthFull = now.toLocaleString("es-ES", { month: "long" });
  
  if (type === "WEEKLY") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return `Semana ${weekNum} - ${year}`;
  } else if (type === "BIWEEKLY") {
    const isFirstHalf = now.getDate() <= 15;
    return `${isFirstHalf ? "1ra" : "2da"} Quincena - ${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`;
  } else if (type === "MONTHLY") {
    return `${monthFull.charAt(0).toUpperCase() + monthFull.slice(1)} ${year}`;
  } else if (type === "QUARTERLY") {
    const quarter = Math.floor(now.getMonth() / 3) + 1;
    return `Q${quarter} - ${year}`;
  } else if (type === "ANNUAL") {
    return `${year}`;
  }
  return "";
}

export default function RevisionesPage() {
  const { user } = useAuth();
  const uid = useUid();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("ALL");

  // Form
  const [type, setType] = useState<ReviewType>("MONTHLY");
  const [period, setPeriod] = useState("");
  const [achievements, setAchievements] = useState("");
  const [pendingItems, setPendingItems] = useState("");
  const [blockers, setBlockers] = useState("");
  const [learnings, setLearnings] = useState("");
  const [adjustments, setAdjustments] = useState("");
  const [nextFocus, setNextFocus] = useState("");
  const [rating, setRating] = useState<1|2|3|4|5>(3);

  const loadData = useCallback(async () => {
    if (!uid) return;
    const r = await getAll<Review>(uid, "reviews");
    setReviews(r); setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (showForm) {
      setPeriod(generatePeriod(type));
    }
  }, [type, showForm]);

  const handleSave = async () => {
    if (!user || !period.trim()) return;
    const splitLines = (text: string) => text.split("\n").filter(l => l.trim());
    if (!uid) return;
    await create(uid, "reviews", {
      type, period,
      achievements: splitLines(achievements),
      pendingItems: splitLines(pendingItems),
      blockers: splitLines(blockers),
      learnings: splitLines(learnings),
      keyMetrics: [],
      adjustments: splitLines(adjustments),
      nextFocus,
      overallRating: rating,
    });
    setShowForm(false);
    setType("MONTHLY"); setPeriod(""); setAchievements(""); setPendingItems("");
    setBlockers(""); setLearnings(""); setAdjustments(""); setNextFocus(""); setRating(3);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!uid) return;
    await remove(uid, "reviews", id);
    loadData();
  };

  const filtered = reviews.filter(r => filterType === "ALL" || r.type === filterType);

  if (loading) return (
    <div className="page-enter space-y-4">
      <div className="h-8 w-48 bg-zinc-900 rounded animate-pulse" />
      {[...Array(3)].map((_, i) => <div key={i} className="glass-card p-5 h-20 animate-pulse" />)}
    </div>
  );

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-amber-400" /> Revisiones
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">{reviews.length} revisiones registradas</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Nueva revisión
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800 w-fit">
        <button onClick={() => setFilterType("ALL")} className={cn("px-3.5 py-2 rounded-md text-sm transition-all", filterType === "ALL" ? "bg-amber-500/15 text-amber-400" : "text-zinc-500 hover:text-zinc-300")}>Todas</button>
        {REVIEW_TYPES.map(rt => (
          <button key={rt.key} onClick={() => setFilterType(rt.key)} className={cn("px-3.5 py-2 rounded-md text-sm transition-all", filterType === rt.key ? "bg-amber-500/15 text-amber-400" : "text-zinc-500 hover:text-zinc-300")}>{rt.label}</button>
        ))}
      </div>

      {showForm && (
        <div className="glass-card overflow-hidden">
          {/* Header / Context */}
          <div className="bg-zinc-900/50 p-6 border-b border-zinc-800/50 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div>
              <h3 className="text-base font-semibold text-white mb-2">Nueva revisión</h3>
              <div className="flex items-center gap-3">
                <select value={type} onChange={(e) => setType(e.target.value as ReviewType)} className="px-3 py-1.5 bg-black/40 border border-zinc-800 rounded-lg text-sm text-amber-400 font-medium outline-none focus:border-amber-500/50">
                  {REVIEW_TYPES.map(rt => <option key={rt.key} value={rt.key}>{rt.label}</option>)}
                </select>
                <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Ej: Marzo 2026" className="w-60 px-3 py-1.5 bg-black/40 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-amber-500/50" />
              </div>
            </div>
            <div>
              <p className="text-xs text-zinc-400 mb-1.5 text-left sm:text-right">Calificación general</p>
              <div className="flex gap-1.5 bg-black/20 p-2 rounded-xl border border-zinc-800/50 w-fit">
                {([1,2,3,4,5] as const).map(s => (
                  <button key={s} onClick={() => setRating(s)} className="transition-all hover:scale-110 active:scale-95">
                    <Star className={cn("w-6 h-6", s <= rating ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" : "text-zinc-700")} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Body / Textareas */}
          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Col 1: Retrospectiva (Positive/Neutral) */}
            <div className="space-y-6">
              <h4 className="text-sm font-medium text-zinc-100 flex items-center gap-2 border-b border-zinc-800/50 pb-2">
                 Retrospectiva
              </h4>
              
              <div className="group block">
                <label className="flex items-center gap-2 text-xs text-emerald-400 mb-1.5 font-medium"><Trophy className="w-3.5 h-3.5" /> Logros</label>
                <textarea value={achievements} onChange={(e) => setAchievements(e.target.value)} rows={4} placeholder="¿Qué salió bien? Un logro por línea..." className="w-full px-3 py-2 bg-zinc-900/30 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 resize-none outline-none focus:bg-zinc-900/80 focus:border-emerald-500/40 transition-all group-focus-within:shadow-[0_0_15px_rgba(52,211,153,0.05)]" />
              </div>
              
              <div className="group block">
                <label className="flex items-center gap-2 text-xs text-blue-400 mb-1.5 font-medium"><Brain className="w-3.5 h-3.5" /> Aprendizajes</label>
                <textarea value={learnings} onChange={(e) => setLearnings(e.target.value)} rows={4} placeholder="¿Qué aprendiste en este ciclo?..." className="w-full px-3 py-2 bg-zinc-900/30 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 resize-none outline-none focus:bg-zinc-900/80 focus:border-blue-500/40 transition-all group-focus-within:shadow-[0_0_15px_rgba(96,165,250,0.05)]" />
              </div>
            </div>

            {/* Col 2: Áreas de Oportunidad y Futuro */}
            <div className="space-y-6">
              <h4 className="text-sm font-medium text-zinc-100 flex items-center gap-2 border-b border-zinc-800/50 pb-2">
                 Áreas de Oportunidad & Futuro
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="group block">
                  <label className="flex items-center gap-2 text-xs text-orange-400 mb-1.5 font-medium"><ShieldAlert className="w-3.5 h-3.5" /> Bloqueadores</label>
                  <textarea value={blockers} onChange={(e) => setBlockers(e.target.value)} rows={3} placeholder="¿Qué te detuvo?..." className="w-full px-3 py-2 bg-zinc-900/30 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 resize-none outline-none focus:bg-zinc-900/80 focus:border-orange-500/40 transition-all group-focus-within:shadow-[0_0_15px_rgba(249,115,22,0.05)]" />
                </div>
                <div className="group block">
                  <label className="flex items-center gap-2 text-xs text-purple-400 mb-1.5 font-medium"><Wrench className="w-3.5 h-3.5" /> Ajustes</label>
                  <textarea value={adjustments} onChange={(e) => setAdjustments(e.target.value)} rows={3} placeholder="¿Qué vas a cambiar?..." className="w-full px-3 py-2 bg-zinc-900/30 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 resize-none outline-none focus:bg-zinc-900/80 focus:border-purple-500/40 transition-all group-focus-within:shadow-[0_0_15px_rgba(168,85,247,0.05)]" />
                </div>
              </div>
              
              <div className="group block">
                <label className="flex items-center gap-2 text-xs text-zinc-400 mb-1.5 font-medium">⏳ Pendientes</label>
                <textarea value={pendingItems} onChange={(e) => setPendingItems(e.target.value)} rows={2} placeholder="Tareas que se pasaron al siguiente ciclo..." className="w-full px-3 py-2 bg-zinc-900/30 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 resize-none outline-none focus:bg-zinc-900/80 focus:border-zinc-500/40 transition-all" />
              </div>

              <div className="group block">
                <label className="flex items-center gap-2 text-xs text-amber-400 mb-1.5 font-medium"><Target className="w-3.5 h-3.5" /> Siguiente Enfoque</label>
                <input value={nextFocus} onChange={(e) => setNextFocus(e.target.value)} placeholder="El objetivo principal del próximo ciclo..." className="w-full px-3 py-2.5 bg-amber-500/5 border border-amber-500/20 rounded-lg text-sm text-amber-100 placeholder:text-amber-500/40 outline-none focus:bg-amber-500/10 focus:border-amber-500/50 transition-all focus:shadow-[0_0_15px_rgba(251,191,36,0.1)]" />
              </div>
            </div>
            
          </div>

          {/* Footer */}
          <div className="bg-zinc-900/50 p-4 border-t border-zinc-800/50 flex justify-end gap-3">
            <button onClick={() => setShowForm(false)} className="btn-secondary px-5">Cancelar</button>
            <button onClick={handleSave} disabled={!period.trim()} className="btn-primary px-6 disabled:opacity-50 font-medium">
              <Save className="w-4 h-4 inline mr-1.5" /> Guardar
            </button>
          </div>
        </div>
      )}

      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map(r => {
            const isExpanded = expandedId === r.id;
            return (
              <div key={r.id} className="glass-card p-4">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : r.id)}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs bg-amber-500/15 text-amber-400 px-2.5 py-1 rounded">{r.type}</span>
                    <h3 className="text-sm font-medium text-zinc-100">{r.period}</h3>
                    <div className="flex">{[1,2,3,4,5].map(s => <Star key={s} className={cn("w-3 h-3", s <= r.overallRating ? "text-amber-400 fill-amber-400" : "text-zinc-800")} />)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }} className="text-zinc-700 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    <ChevronDown className={cn("w-4 h-4 text-zinc-500 transition-transform", isExpanded && "rotate-180")} />
                  </div>
                </div>
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-zinc-800/50 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    {r.achievements?.length > 0 && <div><h4 className="text-zinc-400 font-medium mb-1">✅ Logros</h4><ul className="space-y-0.5 text-zinc-300">{r.achievements.map((a, i) => <li key={i}>• {a}</li>)}</ul></div>}
                    {r.pendingItems?.length > 0 && <div><h4 className="text-zinc-400 font-medium mb-1">⏳ Pendientes</h4><ul className="space-y-0.5 text-zinc-300">{r.pendingItems.map((p, i) => <li key={i}>• {p}</li>)}</ul></div>}
                    {r.blockers?.length > 0 && <div><h4 className="text-zinc-400 font-medium mb-1">🚧 Bloqueadores</h4><ul className="space-y-0.5 text-zinc-300">{r.blockers.map((b, i) => <li key={i}>• {b}</li>)}</ul></div>}
                    {r.learnings?.length > 0 && <div><h4 className="text-zinc-400 font-medium mb-1">💡 Aprendizajes</h4><ul className="space-y-0.5 text-zinc-300">{r.learnings.map((l, i) => <li key={i}>• {l}</li>)}</ul></div>}
                    {r.adjustments?.length > 0 && <div><h4 className="text-zinc-400 font-medium mb-1">🔧 Ajustes</h4><ul className="space-y-0.5 text-zinc-300">{r.adjustments.map((a, i) => <li key={i}>• {a}</li>)}</ul></div>}
                    {r.nextFocus && <div><h4 className="text-zinc-400 font-medium mb-1">🎯 Siguiente enfoque</h4><p className="text-zinc-300">{r.nextFocus}</p></div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : !showForm && (
        <div className="text-center py-16">
          <ClipboardCheck className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-zinc-300 mb-1">Sin revisiones</h3>
          <button onClick={() => setShowForm(true)} className="btn-primary mt-3">Crear primera revisión</button>
        </div>
      )}
    </div>
  );
}
