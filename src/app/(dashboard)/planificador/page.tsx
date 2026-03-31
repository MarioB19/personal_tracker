"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth, useUid } from "@/lib/hooks/useAuth";
import { PiggyBank, Plus, Save, Trash2, CalendarDays, TrendingUp, TrendingDown, GripHorizontal } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { SavingsPlanYear, IncomeSourcePlan, PlanMilestone } from "@/lib/types";
import { collection, query, where, getDocs, setDoc, doc, Timestamp, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const YEARS = [2026, 2027, 2028, 2029, 2030];

export default function PlanificadorPage() {
  const { user } = useAuth();
  const uid = useUid();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activeYear, setActiveYear] = useState<number>(2026);
  const [planId, setPlanId] = useState<string>("");
  
  // Data state
  const [initialSavings, setInitialSavings] = useState<number>(0);
  const [incomes, setIncomes] = useState<IncomeSourcePlan[]>([]);
  const [expenses, setExpenses] = useState<number[]>(Array(12).fill(0));
  const [actualSavings, setActualSavings] = useState<number[]>(Array(12).fill(0));
  const [milestones, setMilestones] = useState<PlanMilestone[]>([]);

  const loadPlan = useCallback(async (yearToLoad: number) => {
    if (!uid) return;
    setLoading(true);
    try {
      const q = query(collection(db, "savings_plans"), where("userId", "==", uid), where("year", "==", yearToLoad));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const data = docSnap.data() as SavingsPlanYear;
        setPlanId(docSnap.id);
        setInitialSavings(data.initialSavings || 0);
        setIncomes(data.incomeSources || []);
        
        // Handle migration if expenses is not 12 elements
        let exp = data.expensesValues || Array(12).fill(0);
        if (exp.length < 12) exp = [...exp, ...Array(12 - exp.length).fill(0)];
        setExpenses(exp);

        let act = data.actualSavingsValues || Array(12).fill(0);
        if (act.length < 12) act = [...act, ...Array(12 - act.length).fill(0)];
        setActualSavings(act);
        
        setMilestones(data.milestones || []);
      } else {
        // Init empty
        setPlanId("");
        setInitialSavings(0);
        setIncomes([
          { id: crypto.randomUUID(), name: "Ingreso base", values: Array(12).fill(0) }
        ]);
        setExpenses(Array(12).fill(0));
        setActualSavings(Array(12).fill(0));
        setMilestones([]);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    loadPlan(activeYear);
  }, [activeYear, loadPlan]);

  const handleSave = async () => {
    if (!uid) return;
    setSaving(true);
    try {
      const idToSave = planId || crypto.randomUUID();
      const basePayload: Omit<SavingsPlanYear, "id" | "createdAt" | "updatedAt"> = {
        userId: uid,
        year: activeYear,
        initialSavings,
        incomeSources: incomes,
        expensesValues: expenses,
        actualSavingsValues: actualSavings,
        milestones,
      };

      if (!planId) {
          // Create new document
          await setDoc(doc(db, "savings_plans", idToSave), {
              ...basePayload,
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now()
          });
          setPlanId(idToSave);
      } else {
          // Update existing
          await setDoc(doc(db, "savings_plans", idToSave), {
              ...basePayload,
              updatedAt: Timestamp.now()
          }, { merge: true });
      }
      

      
    } catch (e) {
      console.error(e);
      alert("Error al guardar");
    }
    setSaving(false);
  };



  // Calculations
  const calcTotalIncome = (monthIdx: number) => {
    return incomes.reduce((acc, inc) => acc + (inc.values[monthIdx] || 0), 0);
  };

  const calcNetSavingsMonth = (monthIdx: number) => {
    return calcTotalIncome(monthIdx) - (expenses[monthIdx] || 0);
  };

  const calcAccumulated = (monthIdx: number) => {
    let acc = initialSavings;
    for (let i = 0; i <= monthIdx; i++) {
        acc += calcNetSavingsMonth(i);
    }
    return acc;
  };

  const updateIncomeValue = (sourceId: string, monthIdx: number, val: string) => {
    const num = Number(val) || 0;
    setIncomes((prev) => 
      prev.map(i => {
        if (i.id === sourceId) {
          const newVals = [...i.values];
          newVals[monthIdx] = num;
          return { ...i, values: newVals };
        }
        return i;
      })
    );
  };

  const updateExpenseValue = (monthIdx: number, val: string) => {
    const num = Number(val) || 0;
    setExpenses(prev => {
      const newVals = [...prev];
      newVals[monthIdx] = num;
      return newVals;
    });
  };
  
  const addIncomeSource = () => {
    setIncomes([...incomes, { id: crypto.randomUUID(), name: "Nuevo ingreso", values: Array(12).fill(0) }]);
  };
  
  const removeIncomeSource = (id: string) => {
    setIncomes(incomes.filter(i => i.id !== id));
  };

  const addMilestone = () => {
    setMilestones([...milestones, { id: crypto.randomUUID(), name: "Nuevo hito", amount: 0, startMonth: 0, endMonth: 0 }]);
  };

  const updateMilestone = (id: string, updates: Partial<PlanMilestone>) => {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };
  const removeMilestone = (id: string) => {
    setMilestones(prev => prev.filter(m => m.id !== id));
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="page-enter space-y-8">
        <div className="h-8 w-48 bg-zinc-900 rounded animate-pulse" />
        <div className="h-96 bg-zinc-900 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="page-enter pb-32">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 mt-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                        <PiggyBank className="w-4 h-4 text-green-400" />
                    </div>
                    Planificador de Ahorro
                </h1>
                <p className="text-sm text-zinc-500 mt-1 ml-12">
                    Proyección de flujo de caja y mapa de hitos por año
                </p>
            </div>
            
            <div className="flex items-center gap-3">
                <div className="flex bg-[#0c0c0e] border border-white/10 rounded-xl p-1">
                    {YEARS.map(y => (
                        <button 
                            key={y}
                            onClick={() => setActiveYear(y)}
                            className={cn(
                                "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                                activeYear === y ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            {y}
                        </button>
                    ))}
                </div>
                

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-primary text-sm py-2 px-4 shadow-[0_0_20px_rgba(245,158,11,0.1)] hover:shadow-[0_0_30px_rgba(245,158,11,0.2)] disabled:opacity-50"
                >
                    {saving ? "Guardando..." : <><Save className="w-4 h-4 mr-2" /> Guardar Plan</>}
                </button>
            </div>
        </div>

        {/* Planner Header Info */}
        <div className="flex bg-black/40 border border-white/5 p-4 rounded-xl mb-6 items-center flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-zinc-500 block mb-1 uppercase tracking-wider font-semibold">Saldo Inicial (Base)</label>
                <div className="flex items-center gap-2">
                    <span className="text-amber-500 font-bold">$</span>
                    <input 
                        type="number"
                        value={initialSavings === 0 ? "" : initialSavings}
                        onChange={(e) => setInitialSavings(Number(e.target.value) || 0)}
                        className="bg-transparent text-lg text-amber-400 font-black outline-none w-32 border-b border-transparent focus:border-amber-500/50 transition-colors hide-arrows"
                        placeholder="0.00"
                    />
                </div>
            </div>
            
            <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-zinc-500 block mb-1 uppercase tracking-wider font-semibold">Total Proyectado Año</label>
                <div className="text-xl font-black text-emerald-400">
                    {formatCurrency(calcAccumulated(11))}
                </div>
            </div>

            <div className="flex items-center gap-2">
                <button onClick={addIncomeSource} className="btn-secondary flex items-center gap-2 py-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" /> Añadir Flujo de Ingreso
                </button>
            </div>
        </div>

        {/* Data Grid */}
        <div className="border border-white/5 bg-[#0a0a0c] rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead>
                        <tr className="bg-white/[0.02] border-b border-white/10 uppercase text-[10px] font-bold tracking-widest text-zinc-500">
                            <th className="p-4 sticky left-0 z-20 bg-[#0a0a0c] border-r border-white/5">Mes</th>
                            {incomes.map(inc => (
                                <th key={inc.id} className="p-4 border-r border-white/5 min-w-[150px] group relative">
                                    <div className="flex items-center justify-between gap-2">
                                        <input 
                                            value={inc.name} 
                                            onChange={(e) => {
                                                const n = e.target.value;
                                                setIncomes(incomes.map(i => i.id === inc.id ? { ...i, name: n } : i));
                                            }}
                                            className="bg-transparent outline-none text-emerald-400 font-bold placeholder:text-zinc-600 w-full"
                                            placeholder="Ingreso..."
                                        />
                                        <button onClick={() => removeIncomeSource(inc.id)} className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </th>
                            ))}
                            <th className="p-4 border-r border-white/5 min-w-[150px] text-red-400/80"><TrendingDown className="w-3.5 h-3.5 inline mr-1"/> Gastos Totales</th>
                            <th className="p-4 border-r border-white/5">Ahorro Neto</th>
                            <th className="p-4 text-amber-500/80">Acumulado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {MONTHS.map((m, idx) => {
                            const net = calcNetSavingsMonth(idx);
                            const acc = calcAccumulated(idx);
                            return (
                                <tr key={m} className="hover:bg-white/[0.01] transition-colors group">
                                    <td className="p-4 sticky left-0 z-20 bg-[#0a0a0c] group-hover:bg-[#0c0c0e] border-r border-white/5 font-bold text-zinc-300">
                                        {m} {activeYear}
                                    </td>
                                    
                                    {incomes.map(inc => (
                                        <td key={`${inc.id}-${m}`} className="p-0 border-r border-white/5">
                                            <input 
                                                type="number"
                                                value={inc.values[idx] === 0 ? "" : inc.values[idx]}
                                                onChange={(e) => updateIncomeValue(inc.id, idx, e.target.value)}
                                                className="w-full h-full min-h-[50px] bg-transparent outline-none px-4 text-emerald-300 hover:bg-white/5 focus:bg-white/10 rounded transition-colors hide-arrows"
                                                placeholder="-"
                                            />
                                        </td>
                                    ))}

                                    <td className="p-0 border-r border-white/5">
                                        <input 
                                            type="number"
                                            value={expenses[idx] === 0 ? "" : expenses[idx]}
                                            onChange={(e) => updateExpenseValue(idx, e.target.value)}
                                            className="w-full h-full min-h-[50px] bg-transparent outline-none px-4 text-red-300 hover:bg-white/5 focus:bg-white/10 rounded transition-colors hide-arrows"
                                            placeholder="-"
                                        />
                                    </td>
                                    
                                    <td className={cn("p-4 font-bold border-r border-white/5", net >= 0 ? "text-emerald-400" : "text-red-400")}>
                                        {net > 0 ? "+" : ""}{formatCurrency(net)}
                                    </td>
                                    
                                    <td className={cn("p-4 font-black bg-gradient-to-r from-transparent to-white/[0.01]", acc >= 0 ? "text-amber-400" : "text-red-400")}>
                                        {formatCurrency(acc)}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            
            {/* MILESTONES SECTION */}
            <div className="bg-black/40 pt-6 pb-8 border-t border-white/10">
                <div className="px-5 py-3 flex items-center justify-between mb-4">
                     <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-amber-500" /> Línea de Hitos (Milestones)
                     </h3>
                     <button onClick={addMilestone} className="btn-secondary text-xs py-1.5 px-3">
                        <Plus className="w-3.5 h-3.5 mr-1" /> Añadir Hito
                     </button>
                </div>
                
                <div className="space-y-3 px-4">
                    {milestones.length === 0 ? (
                        <p className="text-xs text-zinc-600 italic px-2">Sin hitos definidos para este año.</p>
                    ) : milestones.map((m) => {
                        const startCol = m.startMonth + 2;
                        const span = (m.endMonth >= m.startMonth ? m.endMonth - m.startMonth : 0) + 1;
                        const accAtEnd = calcAccumulated(m.endMonth);
                        const isFeasible = accAtEnd >= m.amount;

                        return (
                            <div key={m.id} className="grid grid-cols-[200px_repeat(12,1fr)] gap-0 w-full relative group items-center">
                                 {/* Sidebar controls for the milestone */}
                                 <div className="flex flex-col gap-1.5 pr-4 border-r border-white/5 py-2">
                                     <div className="flex items-center justify-between gap-1">
                                         <input 
                                             value={m.name} 
                                             onChange={(e) => updateMilestone(m.id, { name: e.target.value })}
                                             className="w-full bg-transparent outline-none text-zinc-300 font-bold text-sm"
                                             placeholder="Nombre..."
                                         />
                                         <button onClick={() => removeMilestone(m.id)} className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5"/></button>
                                     </div>
                                     <div className="flex items-center gap-1">
                                        <input 
                                            type="number"
                                            value={m.amount === 0 ? "" : m.amount}
                                            onChange={(e) => updateMilestone(m.id, { amount: Number(e.target.value) || 0 })}
                                            className="w-1/2 bg-white/5 rounded px-2 py-1 text-xs text-zinc-300 outline-none focus:bg-white/10 hide-arrows"
                                            placeholder="Costo"
                                        />
                                        <div className="flex items-center w-1/2 rounded bg-white/5 overflow-hidden">
                                            <select value={m.startMonth} onChange={(e) => updateMilestone(m.id, { startMonth: Number(e.target.value) })} className="w-1/2 bg-transparent text-[10px] text-zinc-400 p-1 outline-none appearance-none text-center border-r border-white/10">
                                                {MONTHS.map((mo, i) => <option key={mo+i} value={i} className="bg-zinc-900">{mo}</option>)}
                                            </select>
                                            <select value={m.endMonth} onChange={(e) => updateMilestone(m.id, { endMonth: Number(e.target.value) })} className="w-1/2 bg-transparent text-[10px] text-zinc-400 p-1 outline-none appearance-none text-center">
                                                {MONTHS.map((mo, i) => <option key={mo+i} value={i} className="bg-zinc-900">{mo}</option>)}
                                            </select>
                                        </div>
                                     </div>
                                 </div>

                                 {/* The visual block */}
                                 <div className="col-span-12 relative flex h-14 items-center">
                                     {/* Background guides */}
                                     <div className="grid grid-cols-12 w-full absolute inset-0 pointer-events-none">
                                        {MONTHS.map((_, i) => <div key={i} className={cn("border-l border-white/5", i===0 && "border-transparent")} />)}
                                     </div>
                                     
                                     <div 
                                        className={cn(
                                            "h-10 rounded-xl border flex flex-col justify-center px-4 relative overflow-hidden transition-all shadow-lg",
                                            isFeasible ? "bg-amber-500/10 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]" : "bg-red-500/10 border-red-500/30"
                                        )}
                                        style={{
                                             gridColumnStart: m.startMonth + 1,
                                             gridColumnEnd: `span ${span}`,
                                             display: "grid"
                                        }}
                                     >
                                        <div className="flex items-center justify-between z-10 w-full overflow-hidden">
                                            <span className={cn("font-bold text-xs truncate", isFeasible ? "text-amber-400" : "text-red-400")}>{m.name}</span>
                                            {!isFeasible && <span className="text-[9px] text-red-500 uppercase font-bold bg-red-500/10 px-1 rounded ml-2 shrink-0">INSOLVENTE</span>}
                                        </div>
                                     </div>
                                 </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>

    </div>
  );
}
