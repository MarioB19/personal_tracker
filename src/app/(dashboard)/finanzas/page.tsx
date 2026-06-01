"use client";

import { useEffect, useState, useCallback } from "react";
import { useUid } from "@/lib/hooks/useAuth";
import {
  getAllFinance,
  createFinance,
  updateFinance,
  removeFinance,
} from "@/lib/repositories/firestore";
import { db } from "@/lib/firebase/config";
import { collection, query, where, getDocs, doc, setDoc, getDoc } from "firebase/firestore";
import {
  Income,
  Expense,
  Debt,
  Saving,
  Milestone,
  IncomeType,
  ExpenseCategory,
  ExpenseType,
  Frequency,
  DebtType,
} from "@/lib/types";
import {
  Wallet,
  Plus,
  X,
  Save,
  TrendingUp,
  TrendingDown,
  CreditCard,
  PiggyBank,
  Trash2,
  Pencil,
  Target,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Calendar,
  Zap,
  Home,
  Car,
  Utensils,
  Film,
  Heart,
  BookOpen,
  RefreshCw,
  HelpCircle,
  Briefcase,
  Laptop,
  Sparkles,
  Building,
  DollarSign
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";

type TabType = "resumen" | "ingresos" | "gastos" | "deudas" | "ahorros";

// Helper functions for RPG/Gaming financial aesthetics
const getIncomeIcon = (type: IncomeType) => {
  switch (type) {
    case "SALARIO": return Briefcase;
    case "FREELANCE": return Laptop;
    case "NEGOCIO": return Building;
    case "INVERSION": return ArrowUpRight;
    default: return Sparkles;
  }
};

const getExpenseCategoryIcon = (cat: ExpenseCategory) => {
  switch (cat) {
    case "VIVIENDA": return Home;
    case "TRANSPORTE": return Car;
    case "COMIDA": return Utensils;
    case "ENTRETENIMIENTO": return Film;
    case "SALUD": return Heart;
    case "EDUCACION": return BookOpen;
    case "SERVICIOS": return Zap;
    case "SUSCRIPCIONES": return RefreshCw;
    default: return HelpCircle;
  }
};

const isDebtDueSoon = (dueDateDay: number) => {
  const today = new Date();
  const currentDay = today.getDate();
  const diff = dueDateDay - currentDay;
  return diff >= 0 && diff <= 5;
};

// Premium Stat Card component
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color: "emerald" | "red" | "amber" | "orange" | "blue";
}) {
  const palette = {
    emerald: {
      card: "border-emerald-500/10 hover:border-emerald-500/20 shadow-[0_4px_20px_rgba(16,185,129,0.02)]",
      icon: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      value: "text-emerald-400",
    },
    red: {
      card: "border-red-500/10 hover:border-red-500/20 shadow-[0_4px_20px_rgba(239,68,68,0.02)]",
      icon: "bg-red-500/10 text-red-400 border-red-500/20",
      value: "text-red-400",
    },
    amber: {
      card: "border-amber-500/10 hover:border-amber-500/20 shadow-[0_4px_20px_rgba(245,158,11,0.02)]",
      icon: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      value: "text-amber-400",
    },
    orange: {
      card: "border-orange-500/10 hover:border-orange-500/20 shadow-[0_4px_20px_rgba(249,115,22,0.02)]",
      icon: "bg-orange-500/10 text-orange-400 border-orange-500/20",
      value: "text-orange-400",
    },
    blue: {
      card: "border-blue-500/10 hover:border-blue-500/20 shadow-[0_4px_20px_rgba(59,130,246,0.02)]",
      icon: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      value: "text-blue-400",
    },
  };
  const p = palette[color];

  return (
    <div className={cn("glass-card p-5 flex flex-col gap-3.5 border bg-[#0c0c0e]/80 transition-all duration-300", p.card)}>
      <div className={cn("w-9 h-9 rounded-xl border flex items-center justify-center shrink-0", p.icon)}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className={cn("text-xl lg:text-2xl font-black tracking-tight font-mono", p.value)}>{value}</p>
        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mt-1">{label}</p>
        {sub && <p className="text-[10px] text-zinc-600 mt-0.5 font-medium">{sub}</p>}
      </div>
    </div>
  );
}

// Premium List Row
function ListRow({
  icon: Icon,
  iconColor = "text-zinc-500 bg-white/[0.02] border-white/5",
  title,
  subtitle,
  right,
  onEdit,
  onDelete,
}: {
  icon?: React.ElementType;
  iconColor?: string;
  title: string;
  subtitle: string;
  right: React.ReactNode;
  onEdit?: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-3.5 px-5 group border-b border-white/[0.04] last:border-0 hover:bg-white/[0.01] transition-all relative overflow-hidden rounded-xl">
      <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-4">
        {Icon && (
          <div className={cn("w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-colors", iconColor)}>
            <Icon className="w-4 h-4" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-100 truncate">{title}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5 font-medium">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {right}
        <div className="flex items-center gap-1">
          {onEdit && (
            <button
              onClick={onEdit}
              className="md:opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 rounded-lg flex items-center justify-center border border-white/5 bg-white/5 text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/20 active:scale-95"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="md:opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 rounded-lg flex items-center justify-center border border-white/5 bg-white/5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Premium Section Wrapper
function Section({
  title,
  action,
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card bg-[#0c0c0e]/60 border border-white/[0.04] rounded-2xl overflow-hidden shadow-[var(--shadow-md)]">
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04] bg-[#0c0c0e]/30">
          {title && <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">{title}</h3>}
          {action}
        </div>
      )}
      <div className="divide-y divide-white/[0.04] p-1.5">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────
export default function FinanzasPage() {
  const uid = useUid();
  const [activeTab, setActiveTab] = useState<TabType>("resumen");
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [savings, setSavings] = useState<Saving[]>([]);
  const [initialSavings, setInitialSavings] = useState<number>(0);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modal, setModal] = useState<
    "income" | "expense" | "debt" | "saving" | "milestone" | null
  >(null);

  // Form slide-over visual transition states
  const [isRendered, setIsRendered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // ── Income form ──
  const [iSource, setISource] = useState("");
  const [iType, setIType] = useState<IncomeType>("SALARIO");
  const [iBase, setIBase] = useState("");
  const [iBenefits, setIBenefits] = useState("");
  const [iFreq, setIFreq] = useState<Frequency>("MENSUAL");
  const [iHours, setIHours] = useState("160");

  // ── Expense form ──
  const [eName, setEName] = useState("");
  const [eCat, setECat] = useState<ExpenseCategory>("COMIDA");
  const [eAmount, setEAmount] = useState("");
  const [eType, setEType] = useState<ExpenseType>("VARIABLE");
  const [eChargeDay, setEChargeDay] = useState("");

  // ── Debt form ──
  const [dEntity, setDEntity] = useState("");
  const [dBalance, setDBalance] = useState("");
  const [dMinPay, setDMinPay] = useState("");
  const [dCutoff, setDCutoff] = useState("1");
  const [dDue, setDDue] = useState("15");
  const [dRate, setDRate] = useState("");
  const [dType, setDType] = useState<DebtType>("TARJETA");

  // ── Saving form ──
  const [sPlanned, setSPlanned] = useState("");
  const [sActual, setSActual] = useState("");
  const [sGoal, setSGoal] = useState("");

  // ── Milestone form ──
  const [mName, setMName] = useState("");
  const [mTarget, setMTarget] = useState("");
  const [mCurrent, setMCurrent] = useState("");

  const currentMonth = new Date().toISOString().slice(0, 7);

  // Sincronizar transición lateral de SlideOver
  useEffect(() => {
    if (modal) {
      setIsRendered(true);
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setIsRendered(false), 300);
      return () => clearTimeout(timer);
    }
  }, [modal]);

  const loadData = useCallback(async () => {
    if (!uid) return;
    const q = query(collection(db, "savings_plans"), where("userId", "==", uid), where("year", "==", new Date().getFullYear()));
    const snap = await getDocs(q);

    let synSavings: Saving[] = [];
    let synMilestones: Milestone[] = [];

    if (!snap.empty) {
      const spDoc = snap.docs[0];
      const data = spDoc.data();
      const initial = data.initialSavings || 0;
      setInitialSavings(initial);
      const incs = data.incomeSources || [];
      const exps = data.expensesValues || [];
      const acts = data.actualSavingsValues || Array(12).fill(0);
      
      let acc = initial;
      synSavings = Array.from({ length: 12 }).map((_, i) => {
        const plannedIncome = incs.reduce((sum: number, source: any) => sum + (source.values[i] || 0), 0);
        const plannedAmount = plannedIncome - (exps[i] || 0);
        const actualAmount = acts[i] || 0;
        acc += plannedAmount;

        return {
          id: `${spDoc.id}_${i}`,
          userId: uid,
          month: new Date(new Date().getFullYear(), i, 1).toLocaleDateString("es-MX", { month: "long" }).toUpperCase(),
          plannedAmount,
          actualAmount,
          accumulatedAmount: acc,
          financialGoal: "",
          notes: "",
          createdAt: new Date() as any,
          updatedAt: new Date() as any,
        } as Saving;
      });

      synMilestones = (data.milestones || []).map((ms: any) => {
        const prog = ms.amount > 0 ? Math.round(((ms.currentAmount || 0) / ms.amount) * 100) : 0;
        return {
          id: ms.id,
          userId: uid,
          name: ms.name,
          targetAmount: ms.amount,
          currentAmount: ms.currentAmount || 0,
          progress: prog,
          status: ms.status || (prog >= 100 ? "REACHED" : "PENDING"),
          notes: JSON.stringify({ startMonth: ms.startMonth, endMonth: ms.endMonth }),
          targetDate: new Date() as any,
          createdAt: new Date() as any,
          updatedAt: new Date() as any,
        } as Milestone;
      });
    }

    const [i, e, d] = await Promise.all([
      getAllFinance<Income>(uid, "income"),
      getAllFinance<Expense>(uid, "expenses"),
      getAllFinance<Debt>(uid, "debts"),
    ]);
    setIncomes(i);
    setExpenses(e);
    setDebts(d);
    setSavings(synSavings);
    setMilestones(synMilestones);
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    if (uid) loadData();
  }, [uid, loadData]);

  // ── Computed ──
  const totalMinPayment = debts
    .filter((d) => d.status === "ACTIVE")
    .reduce((sum, d) => sum + d.minimumPayment, 0);

  const monthlyIncomesList = incomes.filter(inc => {
    if (currentMonth < "2026-03") return false;
    return true;
  });

  const monthlyExpensesList = expenses.filter(exp => {
    if (currentMonth < "2026-03") return false;
    return true;
  });

  const totalIncome = monthlyIncomesList.reduce((s, i) => s + i.netIncome, 0);
  const totalExpenses = monthlyExpensesList.reduce((s, e) => s + e.amount, 0) + totalMinPayment;
  const totalDebt = debts
    .filter((d) => d.status === "ACTIVE")
    .reduce((s, d) => s + d.currentBalance, 0);
  const netBalance = totalIncome - totalExpenses;
  const totalSaved = initialSavings + savings.reduce((s, sv) => s + sv.actualAmount, 0);
  const avgCostPerHour =
    monthlyIncomesList.length > 0
      ? monthlyIncomesList.reduce((s, i) => s + i.costPerHour, 0) / monthlyIncomesList.length
      : 0;
  const savingsRate =
    totalIncome > 0 ? Math.round((netBalance / totalIncome) * 100) : 0;

  // ── Saves ──
  const closeModal = () => {
    setModal(null);
    setEditingId(null);
  };

  const openEditIncome = (i: Income) => {
    setEditingId(i.id);
    setISource(i.source);
    setIType(i.type);
    setIBase(i.baseSalary.toString());
    setIBenefits(i.benefits.toString());
    setIFreq(i.frequency);
    setIHours(i.hoursPerMonth?.toString() || "160");
    setModal("income");
  };

  const openEditExpense = (e: Expense) => {
    setEditingId(e.id);
    setEName(e.name);
    setECat(e.category);
    setEAmount(e.amount.toString());
    setEType(e.type);
    setEChargeDay(e.chargeDay?.toString() || "");
    setModal("expense");
  };

  const openEditDebt = (d: Debt) => {
    setEditingId(d.id);
    setDEntity(d.entity);
    setDBalance(d.currentBalance.toString());
    setDMinPay(d.minimumPayment.toString());
    setDCutoff(d.cutoffDate.toString());
    setDDue(d.dueDate.toString());
    setDRate(d.interestRate?.toString() || "");
    setDType(d.type);
    setModal("debt");
  };

  const openEditSaving = (s: Saving) => {
    setEditingId(s.id);
    setSPlanned(s.plannedAmount.toString());
    setSActual(s.actualAmount.toString());
    setSGoal(s.financialGoal);
    setModal("saving");
  };

  const openEditMilestone = (m: Milestone) => {
    setEditingId(m.id);
    setMName(m.name);
    setMTarget(m.targetAmount.toString());
    setMCurrent(m.currentAmount.toString());
    setModal("milestone");
  };

  const saveIncome = async () => {
    if (!uid || !iSource.trim()) return;
    const base = Number(iBase) || 0;
    const benefits = Number(iBenefits) || 0;
    const net = base + benefits;
    const hours = Number(iHours) || 160;
    const payload = {
      source: iSource,
      type: iType,
      baseSalary: base,
      benefits,
      netIncome: net,
      frequency: iFreq,
      hoursPerMonth: hours,
      costPerHour: hours > 0 ? Math.round(net / hours) : 0,
      month: currentMonth,
      notes: "",
    };
    if (editingId) await updateFinance(uid, "income", editingId, payload);
    else await createFinance(uid, "income", payload);
    resetIncomeForm();
    closeModal();
    loadData();
  };

  const resetIncomeForm = () => {
    setISource(""); setIType("SALARIO"); setIBase(""); setIBenefits(""); setIFreq("MENSUAL"); setIHours("160");
  };

  const saveExpense = async () => {
    if (!uid || !eName.trim()) return;
    const payload = {
      name: eName,
      category: eCat,
      amount: Number(eAmount) || 0,
      type: eType,
      frequency: "MENSUAL" as Frequency,
      chargeDay: (eType === "SUSCRIPCION" || eType === "FIJO") && eChargeDay ? Number(eChargeDay) : undefined,
      month: currentMonth,
      isNecessity: true,
      notes: "",
    };
    if (editingId) await updateFinance(uid, "expenses", editingId, payload);
    else await createFinance(uid, "expenses", payload);
    resetExpenseForm();
    closeModal();
    loadData();
  };

  const resetExpenseForm = () => {
    setEName(""); setECat("COMIDA"); setEAmount(""); setEType("VARIABLE"); setEChargeDay("");
  };

  const saveDebt = async () => {
    if (!uid || !dEntity.trim()) return;
    const payload: Omit<Debt, "id" | "userId" | "createdAt" | "updatedAt"> = {
      entity: dEntity,
      currentBalance: Number(dBalance) || 0,
      minimumPayment: Number(dMinPay) || 0,
      cutoffDate: Number(dCutoff) || 1,
      dueDate: Number(dDue) || 15,
      type: dType,
      status: "ACTIVE",
      notes: "",
    };
    if (dRate) payload.interestRate = Number(dRate);
    if (editingId) await updateFinance(uid, "debts", editingId, payload);
    else await createFinance(uid, "debts", payload);
    resetDebtForm();
    closeModal();
    loadData();
  };

  const resetDebtForm = () => {
    setDEntity(""); setDBalance(""); setDMinPay(""); setDCutoff("1"); setDDue("15"); setDRate(""); setDType("TARJETA");
  };

  const saveSaving = async () => {
    if (!uid || !editingId) return;
    const parts = editingId.split("_");
    const mIdx = parseInt(parts.pop() || "0");
    const docId = parts.join("_");

    const ref = doc(db, "savings_plans", docId);
    const snap = await getDoc(ref);
    if(snap.exists()) {
        const data = snap.data();
        const acts = data.actualSavingsValues || Array(12).fill(0);
        acts[mIdx] = Number(sActual) || 0;
        await setDoc(ref, { actualSavingsValues: acts }, { merge: true });
    }
    setSActual(""); setSPlanned(""); setSGoal("");
    closeModal();
    loadData();
  };

  const saveMilestone = async () => {
    if (!uid || !mName.trim()) return;
    const target = Number(mTarget) || 0;
    const current = Number(mCurrent) || 0;
    const status = current >= target ? "REACHED" : "PENDING";
    
    const q = query(collection(db, "savings_plans"), where("userId", "==", uid), where("year", "==", new Date().getFullYear()));
    const snap = await getDocs(q);
    if (!snap.empty) {
       const spDoc = snap.docs[0];
       const data = spDoc.data();
       let mList = data.milestones || [];
       
       if (editingId) {
           mList = mList.map((m: any) => {
               if(m.id === editingId) {
                   return { ...m, name: mName, amount: target, currentAmount: current, status };
               }
               return m;
           });
       } else {
           mList.push({
               id: crypto.randomUUID(),
               name: mName,
               amount: target,
               currentAmount: current,
               status,
               startMonth: 0,
               endMonth: 11
           });
       }
       await setDoc(doc(db, "savings_plans", spDoc.id), { milestones: mList }, { merge: true });
     }
    setMName(""); setMTarget(""); setMCurrent("");
    closeModal();
    loadData();
  };

  const deleteItem = async (sub: string, id: string) => {
    if (!uid) return;
    if (sub === "savings_plans") return;
    if (sub === "milestones") {
        const q = query(collection(db, "savings_plans"), where("userId", "==", uid), where("year", "==", new Date().getFullYear()));
        const snap = await getDocs(q);
        if(!snap.empty) {
            const data = snap.docs[0].data();
            const nMiles = (data.milestones || []).filter((m:any) => m.id !== id);
            await setDoc(doc(db, "savings_plans", snap.docs[0].id), { milestones: nMiles }, { merge: true });
            loadData();
        }
        return;
    }
    await removeFinance(uid, sub, id);
    loadData();
  };

  if (loading) {
    return (
      <div className="space-y-6 page-enter pb-10">
        <div className="h-8 w-40 skeleton rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-32 skeleton rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const tabs: { key: TabType; label: string; icon: React.ElementType }[] = [
    { key: "resumen", label: "Resumen", icon: Wallet },
    { key: "ingresos", label: "Ingresos", icon: TrendingUp },
    { key: "gastos", label: "Gastos", icon: TrendingDown },
    { key: "deudas", label: "Deudas", icon: CreditCard },
    { key: "ahorros", label: "Ahorros", icon: PiggyBank },
  ];

  return (
    <div className="space-y-8 page-enter pb-10">
      
      {/* ── Page Header ─────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <Wallet className="w-5 h-5 text-black" />
            </div>
            Control Financiero
          </h1>
          <p className="text-xs text-zinc-500 mt-1 capitalize">
            {new Date().toLocaleDateString("es-MX", { month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* ── Stats Grid (Premium SaaS aesthetics) ────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <StatCard
          icon={TrendingUp}
          label="Ingresos Mensuales"
          value={formatCurrency(totalIncome)}
          sub={incomes.length > 0 ? `${incomes.length} fuente${incomes.length > 1 ? "s" : ""}` : "Sin ingresos"}
          color="emerald"
        />
        <StatCard
          icon={TrendingDown}
          label="Gastos Mensuales"
          value={formatCurrency(totalExpenses)}
          sub={expenses.length > 0 ? `${expenses.length} concepto${expenses.length > 1 ? "s" : ""}` : "Sin gastos"}
          color="red"
        />
        <StatCard
          icon={Wallet}
          label="Balance Neto"
          value={formatCurrency(netBalance)}
          sub={`Tasa de Ahorro: ${savingsRate}%`}
          color={netBalance >= 0 ? "amber" : "red"}
        />
        <StatCard
          icon={CreditCard}
          label="Deuda Activa"
          value={formatCurrency(totalDebt)}
          sub={debts.filter((d) => d.status === "ACTIVE").length > 0
            ? `${debts.filter((d) => d.status === "ACTIVE").length} deuda${debts.filter((d) => d.status === "ACTIVE").length > 1 ? "s" : ""}`
            : "Libre de deudas"}
          color="orange"
        />
        <StatCard
          icon={PiggyBank}
          label="Total Ahorrado"
          value={formatCurrency(totalSaved)}
          sub={avgCostPerHour > 0 ? `${formatCurrency(avgCostPerHour)}/hr` : "Sin salario base"}
          color="blue"
        />
      </div>

      {/* ── Tabs (Premium pill container) ──────────────────── */}
      <div className="flex gap-1.5 bg-zinc-950/40 p-1.5 border border-white/5 rounded-2xl overflow-x-auto select-none">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200",
              activeTab === tab.key
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.06)]"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]"
            )}
          >
            <tab.icon className="w-3.5 h-3.5 shrink-0" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════
          TAB: RESUMEN
      ══════════════════════════════════════ */}
      {activeTab === "resumen" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Métricas clave */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Savings Rate Interactive Gauges */}
              <div className="glass-card p-5 bg-[#0c0c0e]/80 border border-white/[0.04] rounded-2xl flex flex-col justify-between h-full relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <PiggyBank className="w-24 h-24 text-amber-400" />
                </div>
                <div>
                  <h4 className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1.5">Tasa de Ahorro Real</h4>
                  <p className="text-2xl font-black text-white font-mono">{savingsRate}%</p>
                  <p className="text-[11px] text-zinc-400 mt-2">
                    Tu tasa actual es del <span className={cn("font-bold", savingsRate >= 20 ? "text-emerald-400" : "text-amber-400")}>{savingsRate}%</span>. 
                    El recomendado de salud financiera es un mínimo del <span className="font-bold text-emerald-400 font-mono">20%</span>.
                  </p>
                </div>
                <div className="mt-5">
                  <div className="flex justify-between text-[9px] text-zinc-500 mb-1 font-mono uppercase tracking-wider font-bold">
                    <span>Progreso de Salud</span>
                    <span>{savingsRate}% / 20%</span>
                  </div>
                  <div className="w-full bg-zinc-950 rounded-full h-2 overflow-hidden border border-white/5">
                    <div 
                      className={cn("h-full rounded-full transition-all duration-700", 
                        savingsRate >= 20 
                          ? "bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]" 
                          : "bg-gradient-to-r from-amber-600 to-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.3)]"
                      )}
                      style={{ width: `${Math.min((savingsRate / 20) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Hour cost evaluation */}
              <div className="glass-card p-5 bg-[#0c0c0e]/80 border border-white/[0.04] rounded-2xl flex flex-col justify-between h-full relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <Zap className="w-24 h-24 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1.5">Valor Neto de Tu Hora</h4>
                  <p className="text-2xl font-black text-white font-mono">{formatCurrency(avgCostPerHour)}<span className="text-xs text-zinc-500 font-normal"> / hr</span></p>
                  <p className="text-[11px] text-zinc-400 mt-2">
                    Cada hora de tu vida laboral neta equivale a <span className="font-bold text-blue-400">{formatCurrency(avgCostPerHour)}</span>. 
                    ¡Úsalo de referencia para evaluar compras impulsivas!
                  </p>
                </div>
                <div className="mt-5 pt-3.5 border-t border-white/[0.03] flex items-center justify-between text-[10px] text-zinc-500">
                  <span>Sueldo Promedio Neto</span>
                  <span className="font-mono text-zinc-300 font-bold">{formatCurrency(totalIncome)}</span>
                </div>
              </div>
            </div>

            <Section title="Estructura de Gastos y Amortización">
              <div className="divide-y divide-white/[0.04]">
                {[
                  { label: "Gastos Fijos Planificados", value: formatCurrency(expenses.filter((e) => e.type === "FIJO").reduce((s, e) => s + e.amount, 0)), highlight: false, icon: Home },
                  { label: "Gastos Variables Estimados", value: formatCurrency(expenses.filter((e) => e.type === "VARIABLE").reduce((s, e) => s + e.amount, 0)), highlight: false, icon: Zap },
                  { label: "Suscripciones Recurrentes", value: formatCurrency(expenses.filter((e) => e.type === "SUSCRIPCION").reduce((s, e) => s + e.amount, 0)), highlight: false, icon: RefreshCw },
                  { label: "Pago Mínimo Comprometido (Deuda)", value: formatCurrency(debts.filter((d) => d.status === "ACTIVE").reduce((s, d) => s + d.minimumPayment, 0)), highlight: debts.filter((d) => d.status === "ACTIVE").length > 0, icon: CreditCard },
                ].map((row, i) => {
                  const RowIcon = row.icon;
                  return (
                    <div key={i} className="flex items-center justify-between px-5 py-4 hover:bg-white/[0.01] transition-colors rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-zinc-500 shrink-0">
                          <RowIcon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-semibold text-zinc-300">{row.label}</span>
                      </div>
                      <span className={cn("text-sm font-black font-mono", row.highlight ? "text-orange-400" : "text-zinc-100")}>
                        {row.value}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Section>
          </div>

          {/* Milestones Financieros */}
          <div>
            <Section 
              title="Milestones Financieros"
            >
              {milestones.length > 0 ? (
                <div className="divide-y divide-white/[0.04] p-1.5 space-y-2">
                  {milestones.map((m) => (
                    <div key={m.id} className="p-4 group glass-card bg-[#0c0c0e]/40 border-white/[0.02] rounded-xl relative overflow-hidden transition-all duration-300">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold text-zinc-200 tracking-tight">{m.name}</p>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border",
                            m.status === "REACHED"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          )}>
                            {m.status === "REACHED" ? "✓ Alcanzado" : `${m.progress}%`}
                          </span>
                          <button
                            onClick={() => openEditMilestone(m)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center rounded-lg border border-white/5 bg-white/5 text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/20 active:scale-95"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteItem("milestones", m.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center rounded-lg border border-white/5 bg-white/5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 active:scale-95"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="w-full bg-zinc-950 border border-white/5 h-2 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(245,158,11,0.2)]"
                            style={{ width: `${Math.min(m.progress, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono">
                          <span>{formatCurrency(m.currentAmount)}</span>
                          <span>Meta: {formatCurrency(m.targetAmount)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Target className="w-7 h-7 text-zinc-700 mb-3" />
                  <p className="text-xs font-semibold text-zinc-400">Sin hitos financieros activos</p>
                  <p className="text-[10px] text-zinc-500 mt-1">Créalos en la pestaña de Ahorros para ver tu progreso</p>
                </div>
              )}
            </Section>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB: INGRESOS
      ══════════════════════════════════════ */}
      {activeTab === "ingresos" && (
        <Section
          title="Fuentes de Ingresos Activas"
          action={
            <button
              onClick={() => setModal("income")}
              className="btn-primary pl-3 pr-4 h-9 rounded-xl text-xs flex items-center gap-1 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
            >
              <Plus className="w-4 h-4" /> Agregar Ingreso
            </button>
          }
        >
          {incomes.length > 0 ? (
            <div className="divide-y divide-white/[0.04]">
              {incomes.map((i) => {
                const Icon = getIncomeIcon(i.type);
                return (
                  <ListRow
                    key={i.id}
                    icon={Icon}
                    iconColor="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                    title={i.source}
                    subtitle={`${i.type} · Cobro ${i.frequency.toLowerCase()} · ${formatCurrency(i.costPerHour)} / hora`}
                    right={
                      <span className="text-sm font-black font-mono text-emerald-400 mr-2">
                        {formatCurrency(i.netIncome)}
                      </span>
                    }
                    onEdit={() => openEditIncome(i)}
                    onDelete={() => deleteItem("income", i.id)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-white/5 rounded-2xl bg-[#0c0c0e]/30">
              <TrendingUp className="w-8 h-8 text-zinc-600 mb-3" />
              <h3 className="text-xs font-bold text-zinc-300">Sin Ingresos Registrados</h3>
              <p className="text-[10px] text-zinc-500 max-w-xs mx-auto mt-1 mb-4">Registra tu sueldo, proyectos freelance o ganancias de negocio para modelar tu presupuesto.</p>
              <button
                onClick={() => setModal("income")}
                className="btn-primary pl-3 pr-4 h-9 rounded-xl text-xs"
              >
                + Registrar Primer Ingreso
              </button>
            </div>
          )}
        </Section>
      )}

      {/* ══════════════════════════════════════
          TAB: GASTOS
      ══════════════════════════════════════ */}
      {activeTab === "gastos" && (
        <Section
          title="Listado de Conceptos de Gastos"
          action={
            <button
              onClick={() => setModal("expense")}
              className="btn-primary pl-3 pr-4 h-9 rounded-xl text-xs flex items-center gap-1 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
            >
              <Plus className="w-4 h-4" /> Agregar Gasto
            </button>
          }
        >
          {expenses.length > 0 ? (
            <div className="divide-y divide-white/[0.04]">
              {expenses.map((e) => {
                const Icon = getExpenseCategoryIcon(e.category);
                return (
                  <ListRow
                    key={e.id}
                    icon={Icon}
                    iconColor={
                      e.type === "FIJO" ? "text-blue-400 bg-blue-500/10 border-blue-500/20" :
                      e.type === "SUSCRIPCION" ? "text-purple-400 bg-purple-500/10 border-purple-500/20" :
                      "text-zinc-400 bg-zinc-500/10 border-white/5"
                    }
                    title={e.name}
                    subtitle={`${e.category} · Gasto ${e.type.toLowerCase()}${(e.type === "FIJO" || e.type === "SUSCRIPCION") && e.chargeDay ? ` · Cargo día ${e.chargeDay}` : ""}`}
                    right={
                      <div className="flex items-center gap-3 mr-2 font-mono">
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0",
                          e.type === "FIJO" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                          e.type === "SUSCRIPCION" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                          "bg-zinc-800 text-zinc-400 border-white/5"
                        )}>
                          {e.type.toLowerCase()}
                        </span>
                        <span className="text-sm font-black text-red-400 shrink-0">
                          -{formatCurrency(e.amount)}
                        </span>
                      </div>
                    }
                    onEdit={() => openEditExpense(e)}
                    onDelete={() => deleteItem("expenses", e.id)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-white/5 rounded-2xl bg-[#0c0c0e]/30">
              <TrendingDown className="w-8 h-8 text-zinc-600 mb-3" />
              <h3 className="text-xs font-bold text-zinc-300">Sin Gastos Registrados</h3>
              <p className="text-[10px] text-zinc-500 max-w-xs mx-auto mt-1 mb-4">Controla tus gastos fijos y variables para calcular tu capacidad de ahorro real mensual.</p>
              <button
                onClick={() => setModal("expense")}
                className="btn-primary pl-3 pr-4 h-9 rounded-xl text-xs"
              >
                + Registrar Primer Gasto
              </button>
            </div>
          )}
        </Section>
      )}

      {/* ══════════════════════════════════════
          TAB: DEUDAS
      ══════════════════════════════════════ */}
      {activeTab === "deudas" && (
        <Section
          title="Deudas Activas y Amortizaciones"
          action={
            <button
              onClick={() => setModal("debt")}
              className="btn-primary pl-3 pr-4 h-9 rounded-xl text-xs flex items-center gap-1 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
            >
              <Plus className="w-4 h-4" /> Agregar Deuda
            </button>
          }
        >
          {debts.length > 0 ? (
            <div className="divide-y divide-white/[0.04]">
              {debts.map((d) => {
                const isDue = isDebtDueSoon(d.dueDate);
                return (
                  <ListRow
                    key={d.id}
                    icon={CreditCard}
                    iconColor={isDue ? "text-orange-400 bg-orange-500/10 border-orange-500/20" : "text-zinc-500 bg-white/[0.01] border-white/5"}
                    title={d.entity}
                    subtitle={`${d.type === "TARJETA" ? "Tarjeta de Crédito" : "Deuda Externa"} · Corte día ${d.cutoffDate} · Límite día ${d.dueDate}${d.interestRate ? ` · Tasa: ${d.interestRate}%` : ""}`}
                    right={
                      <div className="flex items-center gap-4 mr-2 font-mono">
                        {isDue && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-orange-500/10 border border-orange-500/20 text-orange-400 animate-pulse">
                            <AlertTriangle className="w-3 h-3" /> Pago Próximo
                          </span>
                        )}
                        <div className="text-right">
                          <p className="text-sm font-black text-orange-400">
                            {formatCurrency(d.currentBalance)}
                          </p>
                          <p className="text-[10px] text-zinc-500 font-bold mt-0.5">
                            mín: {formatCurrency(d.minimumPayment)}
                          </p>
                        </div>
                      </div>
                    }
                    onEdit={() => openEditDebt(d)}
                    onDelete={() => deleteItem("debts", d.id)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-white/5 rounded-2xl bg-[#0c0c0e]/30">
              <CreditCard className="w-8 h-8 text-zinc-600 mb-3" />
              <h3 className="text-xs font-bold text-zinc-300">Libre de Deudas Activas</h3>
              <p className="text-[10px] text-zinc-500 max-w-xs mx-auto mt-1 mb-4">No tienes deudas activas registradas. ¡Mantener un balance limpio es excelente!</p>
              <button
                onClick={() => setModal("debt")}
                className="btn-primary pl-3 pr-4 h-9 rounded-xl text-xs"
              >
                + Registrar Deuda
              </button>
            </div>
          )}
        </Section>
      )}

      {/* ══════════════════════════════════════
          TAB: AHORROS
      ══════════════════════════════════════ */}
      {activeTab === "ahorros" && (
        <div className="space-y-6">
          {/* Ahorro Mensual */}
          <Section
            title="Línea de Ahorro y Plan Anual"
            action={
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-xl shadow-[0_0_12px_rgba(16,185,129,0.1)]">
                  Fondo Acumulado: {formatCurrency(totalSaved)}
                </span>
              </div>
            }
          >
            {savings.length > 0 ? (
              <div className="divide-y divide-white/[0.04]">
                {initialSavings > 0 && (
                  <div className="flex items-center justify-between py-4 px-5 bg-amber-500/[0.01] border border-dashed border-amber-500/10 rounded-xl mb-1 p-4">
                    <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-4">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 text-amber-400">
                        <PiggyBank className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-amber-400 truncate">Ahorro Base Inicial</p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">Saldo base acumulado antes de iniciar el ciclo</p>
                      </div>
                    </div>
                    <span className="text-sm font-black font-mono text-amber-400 mr-2">{formatCurrency(initialSavings)}</span>
                  </div>
                )}
                {savings.map((s) => (
                  <ListRow
                    key={s.id}
                    icon={Calendar}
                    iconColor={s.actualAmount >= s.plannedAmount && s.plannedAmount > 0 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-zinc-500 bg-white/[0.01] border-white/5"}
                    title={`${s.month}${s.financialGoal ? ` — ${s.financialGoal}` : ""}`}
                    subtitle={`Planificado: ${formatCurrency(s.plannedAmount)} · Acumulado Proyectado: ${formatCurrency(s.accumulatedAmount)}`}
                    right={
                      <div className="flex items-center gap-4 mr-2 font-mono text-right">
                        <div>
                          <p className={cn("text-sm font-black", s.actualAmount >= s.plannedAmount && s.plannedAmount > 0 ? "text-emerald-400" : "text-amber-400")}>
                            {formatCurrency(s.actualAmount)}
                          </p>
                          <p className="text-[10px] text-zinc-500 mt-0.5 font-bold">
                            {s.actualAmount >= s.plannedAmount && s.plannedAmount > 0 ? "✓ Meta Lograda" : "Ejecución real"}
                          </p>
                        </div>
                      </div>
                    }
                    onEdit={() => openEditSaving(s)}
                    onDelete={() => deleteItem("savings", s.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <PiggyBank className="w-8 h-8 text-zinc-700 mb-3" />
                <p className="text-xs font-bold text-zinc-400">Sin plan de ahorro anual configurado</p>
              </div>
            )}
          </Section>

          {/* Milestones */}
          <Section
            title="Hitos de Ahorro Programados"
            action={
              <button
                onClick={() => setModal("milestone")}
                className="btn-primary pl-3 pr-4 h-9 rounded-xl text-xs flex items-center gap-1 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
              >
                <Plus className="w-4 h-4" /> Nuevo Milestone
              </button>
            }
          >
            {milestones.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-1.5">
                {milestones.map((m) => (
                  <div key={m.id} className="p-4 group glass-card bg-[#0c0c0e]/40 border-white/[0.02] rounded-xl relative overflow-hidden transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold text-zinc-200 tracking-tight">{m.name}</p>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border",
                          m.status === "REACHED"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        )}>
                          {m.status === "REACHED" ? "✓ Alcanzado" : `${m.progress}%`}
                        </span>
                        <button
                          onClick={() => openEditMilestone(m)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center rounded-lg border border-white/5 bg-white/5 text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/20 active:scale-95"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteItem("milestones", m.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center rounded-lg border border-white/5 bg-white/5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 active:scale-95"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="w-full bg-zinc-950 border border-white/5 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(245,158,11,0.2)]"
                          style={{ width: `${Math.min(m.progress, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono">
                        <span>{formatCurrency(m.currentAmount)}</span>
                        <span>Meta: {formatCurrency(m.targetAmount)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-white/5 rounded-2xl bg-[#0c0c0e]/30">
                <Target className="w-8 h-8 text-zinc-600 mb-3" />
                <h3 className="text-xs font-bold text-zinc-300">Sin Milestones de Ahorro</h3>
                <p className="text-[10px] text-zinc-500 max-w-xs mx-auto mt-1 mb-4">Crea objetivos clave (ej: Fondo de Emergencia, Enganche de Auto) para proyectar tu éxito financiero.</p>
                <button
                  onClick={() => setModal("milestone")}
                  className="btn-primary pl-3 pr-4 h-9 rounded-xl text-xs font-bold"
                >
                  + Trazar Milestone
                </button>
              </div>
            )}
          </Section>
        </div>
      )}

      {/* ══════════════════════════════════════
          SLIDE-OVER PANELS (Unified Layout)
      ══════════════════════════════════════ */}
      {isRendered && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Overlay Backdrop */}
          <div 
            className={cn(
              "absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300",
              isVisible ? "opacity-100" : "opacity-0"
            )} 
            onClick={closeModal}
          />
          
          {/* Panel Flotante Slide-Over */}
          <div 
            className={cn(
              "relative w-full max-w-lg h-full bg-[#0c0c0e] border-l border-white/10 shadow-2xl transition-transform duration-300 ease-out flex flex-col z-10",
              isVisible ? "translate-x-0" : "translate-x-full"
            )}
          >
            {/* Header consistent with Misiones / GoalSlideOver */}
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#0c0c0e]/80 backdrop-blur-xl shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/10 flex items-center justify-center text-amber-400">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight leading-none">
                    {editingId ? "Modificar" : "Nuevo"}{" "}
                    {modal === "income" ? "Ingreso" :
                     modal === "expense" ? "Gasto" :
                     modal === "debt" ? "Parámetro de Deuda" :
                     modal === "saving" ? "Ciclo de Ahorro" : "Milestone"}
                  </h3>
                  <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider font-semibold">Métricas y Parámetros</p>
                </div>
              </div>
              <button 
                onClick={closeModal} 
                className="w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              
              {/* ── Income Form ── */}
              {modal === "income" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Fuente / Empresa / Cliente</label>
                    <input 
                      value={iSource} 
                      onChange={(e) => setISource(e.target.value)} 
                      placeholder="Ej: Sueldo Astra, Proyecto UX" 
                      className="w-full px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Frecuencia de Cobro</label>
                      <select 
                        value={iFreq} 
                        onChange={(e) => setIFreq(e.target.value as Frequency)} 
                        className="w-full px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50 appearance-none font-medium"
                      >
                        {(["MENSUAL", "QUINCENAL", "SEMANAL", "ANUAL"] as Frequency[]).map((f) => (
                          <option key={f} value={f} className="bg-zinc-900">{f.toLowerCase()}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Horas Laborales / Mes</label>
                      <input 
                        type="number" 
                        value={iHours} 
                        onChange={(e) => setIHours(e.target.value)} 
                        placeholder="160" 
                        className="w-full px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Dynamic styled buttons for Income type */}
                  <div>
                    <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Tipo de Ingreso</label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {(["SALARIO", "FREELANCE", "NEGOCIO", "INVERSION", "OTRO"] as IncomeType[]).map((t) => {
                        const Icon = getIncomeIcon(t);
                        const isSelected = iType === t;
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setIType(t)}
                            className={cn(
                              "flex flex-col items-center justify-center py-2 rounded-lg border text-[9px] font-black transition-all transform active:scale-95",
                              isSelected 
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.1)]" 
                                : "bg-black/30 border-white/[0.04] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
                            )}
                          >
                            <Icon className="w-4 h-4 mb-1" />
                            <span className="capitalize">{t.toLowerCase()}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Sueldo / Pago Base</label>
                      <input 
                        type="number" 
                        value={iBase} 
                        onChange={(e) => setIBase(e.target.value)} 
                        placeholder="0" 
                        className="w-full px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Bonos / Prestaciones</label>
                      <input 
                        type="number" 
                        value={iBenefits} 
                        onChange={(e) => setIBenefits(e.target.value)} 
                        placeholder="0" 
                        className="w-full px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Expense Form ── */}
              {modal === "expense" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Nombre / Concepto del Gasto</label>
                    <input 
                      value={eName} 
                      onChange={(e) => setEName(e.target.value)} 
                      placeholder="Ej: Renta de departamento, Netflix..." 
                      className="w-full px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Monto de Gasto</label>
                      <input 
                        type="number" 
                        value={eAmount} 
                        onChange={(e) => setEAmount(e.target.value)} 
                        placeholder="0" 
                        className="w-full px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                      />
                    </div>

                    {(eType === "SUSCRIPCION" || eType === "FIJO") && (
                      <div>
                        <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Día de Cobro en el Mes</label>
                        <input 
                          type="number" 
                          min={1} 
                          max={31} 
                          value={eChargeDay} 
                          onChange={(e) => setEChargeDay(e.target.value)} 
                          placeholder="Ej. 19" 
                          className="w-full px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                        />
                      </div>
                    )}
                  </div>

                  {/* Styled buttons for Expense type */}
                  <div>
                    <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Tipo de Gasto</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["FIJO", "VARIABLE", "SUSCRIPCION"] as ExpenseType[]).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setEType(t)}
                          className={cn(
                            "py-2.5 rounded-xl text-xs font-semibold border transition-all truncate transform active:scale-95",
                            eType === t
                              ? "bg-amber-500/10 border-amber-500/25 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.1)]"
                              : "bg-black/30 border-white/[0.04] text-zinc-500 hover:border-white/[0.15] hover:text-zinc-300"
                          )}
                        >
                          {t === "FIJO" ? "Fijo" : t === "VARIABLE" ? "Variable" : "Suscripción"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Styled buttons grid for Expense Category */}
                  <div>
                    <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Categoría del Gasto</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["VIVIENDA","TRANSPORTE","COMIDA","ENTRETENIMIENTO","SALUD","EDUCACION","SERVICIOS","SUSCRIPCIONES","OTRO"] as ExpenseCategory[]).map((c) => {
                        const Icon = getExpenseCategoryIcon(c);
                        const isSelected = eCat === c;
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setECat(c)}
                            className={cn(
                              "flex flex-col items-center justify-center py-2.5 rounded-xl border text-[9px] font-black transition-all transform active:scale-95",
                              isSelected 
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.1)]" 
                                : "bg-black/30 border-white/[0.04] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
                            )}
                          >
                            <Icon className="w-4 h-4 mb-1" />
                            <span className="capitalize">{c.toLowerCase()}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Debt Form ── */}
              {modal === "debt" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Entidad / Nombre de la Deuda</label>
                    <input 
                      value={dEntity} 
                      onChange={(e) => setDEntity(e.target.value)} 
                      placeholder="Ej: Tarjeta Santander, Crédito Bancario" 
                      className="w-full px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Tasa de Interés Anual (%)</label>
                      <input 
                        type="number" 
                        step="0.1" 
                        value={dRate} 
                        onChange={(e) => setDRate(e.target.value)} 
                        placeholder="Ej. 11.5" 
                        className="w-full px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Tipo de Deuda</label>
                      <select 
                        value={dType} 
                        onChange={(e) => setDType(e.target.value as DebtType)} 
                        className="w-full px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50 appearance-none font-medium"
                      >
                        {(["TARJETA", "EXTERNA"] as DebtType[]).map((t) => (
                          <option key={t} value={t} className="bg-zinc-900">{t === "TARJETA" ? "Tarjeta de crédito" : "Deuda externa"}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Saldo Actual Comprometido</label>
                      <input 
                        type="number" 
                        value={dBalance} 
                        onChange={(e) => setDBalance(e.target.value)} 
                        placeholder="0" 
                        className="w-full px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Monto de Pago Mínimo</label>
                      <input 
                        type="number" 
                        value={dMinPay} 
                        onChange={(e) => setDMinPay(e.target.value)} 
                        placeholder="0" 
                        className="w-full px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Día de Corte Mensual</label>
                      <input 
                        type="number" 
                        min={1} 
                        max={31} 
                        value={dCutoff} 
                        onChange={(e) => setDCutoff(e.target.value)} 
                        className="w-full px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-amber-500/50 transition-colors"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Día Límite de Pago</label>
                      <input 
                        type="number" 
                        min={1} 
                        max={31} 
                        value={dDue} 
                        onChange={(e) => setDDue(e.target.value)} 
                        className="w-full px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-amber-500/50 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Saving Form ── */}
              {modal === "saving" && (
                <div className="space-y-4">
                  <div className="bg-black/30 p-4 rounded-xl border border-white/5">
                    <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-3">Monto Real Ahorrado de Ingresos</label>
                    <input 
                      type="number" 
                      value={sActual} 
                      onChange={(e) => setSActual(e.target.value)} 
                      placeholder="0" 
                      className="w-full px-4 py-3 bg-white/[0.01] border border-white/5 rounded-xl text-lg font-bold text-emerald-400 focus:outline-none focus:border-emerald-500/50" 
                    />
                    <p className="text-[11px] text-zinc-500 mt-3 leading-relaxed">
                      Esta cifra es independiente de tu proyección, es el ahorro <span className="font-bold">real</span> que aseguraste en este ciclo mensual. 
                      La meta proyectada para este mes era: <span className="font-bold font-mono text-zinc-300">{formatCurrency(Number(sPlanned))}</span>.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Milestone Form ── */}
              {modal === "milestone" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Nombre del Milestone</label>
                    <input 
                      value={mName} 
                      onChange={(e) => setMName(e.target.value)} 
                      placeholder="Ej: Fondo de Emergencia de 3 Meses" 
                      className="w-full px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Monto Objetivo Final</label>
                      <input 
                        type="number" 
                        value={mTarget} 
                        onChange={(e) => setMTarget(e.target.value)} 
                        placeholder="0" 
                        className="w-full px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Monto Asegurado Actual</label>
                      <input 
                        type="number" 
                        value={mCurrent} 
                        onChange={(e) => setMCurrent(e.target.value)} 
                        placeholder="0" 
                        className="w-full px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/5 bg-[#0c0c0e] flex justify-end gap-3 shrink-0">
              <button 
                onClick={closeModal} 
                className="btn-secondary h-11 px-5 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
              <button 
                onClick={
                  modal === "income" ? saveIncome :
                  modal === "expense" ? saveExpense :
                  modal === "debt" ? saveDebt :
                  modal === "saving" ? saveSaving : saveMilestone
                } 
                disabled={
                  modal === "income" ? !iSource.trim() :
                  modal === "expense" ? !eName.trim() :
                  modal === "debt" ? !dEntity.trim() :
                  modal === "saving" ? false : !mName.trim()
                } 
                className="btn-primary pl-4 pr-5 h-11 disabled:opacity-50 disabled:grayscale transition-all duration-300 flex items-center justify-center gap-1.5 rounded-xl text-xs font-black shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:shadow-[0_0_30px_rgba(245,158,11,0.25)]"
              >
                <Save className="w-4 h-4" />
                {editingId ? "Guardar Cambios" : "Agregar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
