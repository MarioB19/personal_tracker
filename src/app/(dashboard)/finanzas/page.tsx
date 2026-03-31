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
  DebtStatus,
  MilestoneStatus,
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
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
type TabType = "resumen" | "ingresos" | "gastos" | "deudas" | "ahorros";

// ─────────────────────────────────────────
// Modal wrapper
// ─────────────────────────────────────────
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#0e0e0e] border border-white/[0.08] rounded-2xl shadow-2xl fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Stat card
// ─────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  color: "emerald" | "red" | "amber" | "orange" | "blue";
}) {
  const palette = {
    emerald: {
      icon: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      value: "text-emerald-400",
      trend: "text-emerald-400",
    },
    red: {
      icon: "bg-red-500/10 text-red-400 border-red-500/20",
      value: "text-red-400",
      trend: "text-red-400",
    },
    amber: {
      icon: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      value: "text-amber-400",
      trend: "text-amber-400",
    },
    orange: {
      icon: "bg-orange-500/10 text-orange-400 border-orange-500/20",
      value: "text-orange-400",
      trend: "text-orange-400",
    },
    blue: {
      icon: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      value: "text-blue-400",
      trend: "text-blue-400",
    },
  };
  const p = palette[color];

  return (
    <div className="bg-[#0e0e0e] border border-white/[0.06] rounded-2xl p-5 flex flex-col gap-3">
      <div className={cn("w-9 h-9 rounded-xl border flex items-center justify-center", p.icon)}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className={cn("text-2xl font-bold tracking-tight", p.value)}>{value}</p>
        <p className="text-[13px] text-zinc-500 mt-0.5">{label}</p>
        {sub && <p className="text-[11px] text-zinc-600 mt-0.5">{sub}</p>}
      </div>
      {trend && (
        <div className={cn("flex items-center gap-1 text-[11px] font-medium", p.trend)}>
          {trend === "up" ? (
            <ArrowUpRight className="w-3.5 h-3.5" />
          ) : trend === "down" ? (
            <ArrowDownRight className="w-3.5 h-3.5" />
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// Row item for lists
// ─────────────────────────────────────────
function ListRow({
  title,
  subtitle,
  right,
  onEdit,
  onDelete,
}: {
  title: string;
  subtitle: string;
  right: React.ReactNode;
  onEdit?: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-4 px-5 group border-b border-white/[0.04] last:border-0 relative overflow-hidden">
      <div className="min-w-0 flex-1 pr-4">
        <p className="text-sm font-medium text-zinc-100 truncate">{title}</p>
        <p className="text-[12px] text-zinc-500 mt-0.5">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {right}
        {onEdit && (
            <button
              onClick={onEdit}
              className="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10"
            >
              <Pencil className="w-4 h-4" />
            </button>
        )}
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Section card wrapper
// ─────────────────────────────────────────
function Section({
  title,
  action,
  children,
  empty,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  empty?: React.ReactNode;
}) {
  return (
    <div className="bg-[#0e0e0e] border border-white/[0.06] rounded-2xl overflow-hidden">
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          {title && <h3 className="text-sm font-semibold text-white">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// ─────────────────────────────────────────
// Main page
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
        acc += plannedAmount; // Increment accumulation with planned (to show projection)

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
    loadData();
  }, [loadData]);

  // ── Computed ──
  const totalIncome = incomes.reduce((s, i) => s + i.netIncome, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalDebt = debts
    .filter((d) => d.status === "ACTIVE")
    .reduce((s, d) => s + d.currentBalance, 0);
  const netBalance = totalIncome - totalExpenses;
  const totalSaved = initialSavings + savings.reduce((s, sv) => s + sv.actualAmount, 0);
  const avgCostPerHour =
    incomes.length > 0
      ? incomes.reduce((s, i) => s + i.costPerHour, 0) / incomes.length
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
    setISource(""); setIType("SALARIO"); setIBase(""); setIBenefits(""); setIFreq("MENSUAL"); setIHours("160");
    closeModal();
    loadData();
  };

  const saveExpense = async () => {
    if (!uid || !eName.trim()) return;
    const payload = {
      name: eName,
      category: eCat,
      amount: Number(eAmount) || 0,
      type: eType,
      frequency: "MENSUAL" as Frequency,
      chargeDay: eType === "SUSCRIPCION" && eChargeDay ? Number(eChargeDay) : undefined,
      month: currentMonth,
      isNecessity: true,
      notes: "",
    };
    if (editingId) await updateFinance(uid, "expenses", editingId, payload);
    else await createFinance(uid, "expenses", payload);
    setEName(""); setECat("COMIDA"); setEAmount(""); setEType("VARIABLE"); setEChargeDay("");
    closeModal();
    loadData();
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
    setDEntity(""); setDBalance(""); setDMinPay(""); setDCutoff("1"); setDDue("15"); setDRate(""); setDType("TARJETA");
    closeModal();
    closeModal();
    loadData();
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
    
    // We get the active plan to append/update
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
    if (sub === "savings_plans") return; // Cant delete a full year from here trivially
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

  // ── Loading ──
  if (loading) {
    return (
      <div className="space-y-6 page-enter">
        <div className="h-8 w-40 skeleton rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-32 skeleton rounded-2xl" />
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
    <div className="space-y-6 page-enter">

      {/* ── Page header ─────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-amber-400" />
          </div>
          Finanzas
        </h1>
        <p className="text-sm text-zinc-500 mt-1 ml-12">
          {new Date().toLocaleDateString("es-MX", { month: "long", year: "numeric" })}
        </p>
      </div>

      {/* ── Stats grid ──────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
        <StatCard
          icon={TrendingUp}
          label="Ingresos totales"
          value={formatCurrency(totalIncome)}
          sub={incomes.length > 0 ? `${incomes.length} fuente${incomes.length > 1 ? "s" : ""}` : undefined}
          color="emerald"
        />
        <StatCard
          icon={TrendingDown}
          label="Gastos totales"
          value={formatCurrency(totalExpenses)}
          sub={expenses.length > 0 ? `${expenses.length} concepto${expenses.length > 1 ? "s" : ""}` : undefined}
          color="red"
        />
        <StatCard
          icon={Wallet}
          label="Balance neto"
          value={formatCurrency(netBalance)}
          sub={`Tasa de ahorro: ${savingsRate}%`}
          color={netBalance >= 0 ? "amber" : "red"}
        />
        <StatCard
          icon={CreditCard}
          label="Deuda activa"
          value={formatCurrency(totalDebt)}
          sub={debts.filter((d) => d.status === "ACTIVE").length > 0
            ? `${debts.filter((d) => d.status === "ACTIVE").length} deuda${debts.filter((d) => d.status === "ACTIVE").length > 1 ? "s" : ""}`
            : "Sin deudas"}
          color="orange"
        />
        <StatCard
          icon={PiggyBank}
          label="Total ahorrado"
          value={formatCurrency(totalSaved)}
          sub={avgCostPerHour > 0 ? `${formatCurrency(avgCostPerHour)}/hr` : undefined}
          color="blue"
        />
      </div>

      {/* ── Tabs ────────────────────────────── */}
      <div className="flex gap-1 bg-[#0e0e0e] border border-white/[0.06] rounded-xl p-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
              activeTab === tab.key
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]"
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Métricas clave */}
          <Section title="Métricas clave">
            <div className="divide-y divide-white/[0.04]">
              {[
                { label: "Tasa de ahorro", value: `${savingsRate}%`, highlight: savingsRate >= 20 },
                { label: "Costo por hora", value: `${formatCurrency(avgCostPerHour)}/hr`, highlight: false },
                {
                  label: "Gastos fijos",
                  value: formatCurrency(
                    expenses.filter((e) => e.type === "FIJO").reduce((s, e) => s + e.amount, 0)
                  ),
                  highlight: false,
                },
                {
                  label: "Suscripciones",
                  value: formatCurrency(
                    expenses.filter((e) => e.type === "SUSCRIPCION").reduce((s, e) => s + e.amount, 0)
                  ),
                  highlight: false,
                },
                {
                  label: "Gastos variables",
                  value: formatCurrency(
                    expenses.filter((e) => e.type === "VARIABLE").reduce((s, e) => s + e.amount, 0)
                  ),
                  highlight: false,
                },
                {
                  label: "Pagos mínimos deuda",
                  value: formatCurrency(
                    debts.filter((d) => d.status === "ACTIVE").reduce((s, d) => s + d.minimumPayment, 0)
                  ),
                  highlight: false,
                },
              ].map((row, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-sm text-zinc-400">{row.label}</span>
                  <span className={cn("text-sm font-semibold", row.highlight ? "text-emerald-400" : "text-zinc-200")}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </Section>

          {/* Milestones */}
          <Section title="Milestones financieros">
            {milestones.length > 0 ? (
              <div className="divide-y divide-white/[0.04]">
                {milestones.map((m) => (
                  <div key={m.id} className="px-5 py-4 group">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-zinc-200">{m.name}</p>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-xs font-semibold px-2 py-0.5 rounded-full border",
                          m.status === "REACHED"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        )}>
                          {m.status === "REACHED" ? "Alcanzado" : `${m.progress}%`}
                        </span>
                        <button
                          onClick={() => openEditMilestone(m)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteItem("milestones", m.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all"
                          style={{ width: `${Math.min(m.progress, 100)}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-zinc-500 shrink-0">
                        {formatCurrency(m.currentAmount)} / {formatCurrency(m.targetAmount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Target className="w-8 h-8 text-zinc-700 mb-3" />
                <p className="text-sm text-zinc-500">Sin milestones</p>
                <p className="text-xs text-zinc-600 mt-1">Créalos en la pestaña Ahorros</p>
              </div>
            )}
          </Section>
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB: INGRESOS
      ══════════════════════════════════════ */}
      {activeTab === "ingresos" && (
        <Section
          title="Fuentes de ingreso"
          action={
            <div className="flex items-center gap-3">
              <button
                onClick={() => setModal("income")}
                className="flex items-center gap-1.5 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
              >
                <Plus className="w-4 h-4" /> Agregar
              </button>
            </div>
          }
        >
          {incomes.length > 0 ? (
            <div>
              {incomes.map((i) => (
                <ListRow
                  key={i.id}
                  title={i.source}
                  subtitle={`${i.type} · ${i.frequency} · ${formatCurrency(i.costPerHour)}/hr`}
                  right={
                    <span className="text-sm font-bold text-emerald-400">
                      {formatCurrency(i.netIncome)}
                    </span>
                  }
                  onEdit={() => openEditIncome(i)}
                  onDelete={() => deleteItem("income", i.id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <TrendingUp className="w-8 h-8 text-zinc-700 mb-3" />
              <p className="text-sm text-zinc-500">Sin ingresos registrados</p>
              <button
                onClick={() => setModal("income")}
                className="mt-4 text-sm font-medium text-amber-400 hover:text-amber-300"
              >
                + Agregar ingreso
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
          title="Gastos"
          action={
            <div className="flex items-center gap-3">
              <button
                onClick={() => setModal("expense")}
                className="flex items-center gap-1.5 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
              >
                <Plus className="w-4 h-4" /> Agregar
              </button>
            </div>
          }
        >
          {expenses.length > 0 ? (
            <div>
              {expenses.map((e) => (
                <ListRow
                  key={e.id}
                  title={e.name}
                  subtitle={`${e.category} · ${e.type}${e.type === "FIJO" && e.chargeDay ? ` · Día ${e.chargeDay}` : ""}`}
                  right={
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[11px] font-medium px-2 py-0.5 rounded-full border",
                        e.type === "FIJO"
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                      )}>
                        {e.type}
                      </span>
                      <span className="text-sm font-bold text-red-400">
                        -{formatCurrency(e.amount)}
                      </span>
                    </div>
                  }
                  onEdit={() => openEditExpense(e)}
                  onDelete={() => deleteItem("expenses", e.id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <TrendingDown className="w-8 h-8 text-zinc-700 mb-3" />
              <p className="text-sm text-zinc-500">Sin gastos registrados</p>
              <button
                onClick={() => setModal("expense")}
                className="mt-4 text-sm font-medium text-amber-400 hover:text-amber-300"
              >
                + Agregar gasto
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
          title="Deudas activas"
          action={
            <div className="flex items-center gap-3">
              <button
                onClick={() => setModal("debt")}
                className="flex items-center gap-1.5 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
              >
                <Plus className="w-4 h-4" /> Agregar
              </button>
            </div>
          }
        >
          {debts.length > 0 ? (
            <div>
              {debts.map((d) => (
                <ListRow
                  key={d.id}
                  title={d.entity}
                  subtitle={`${d.type === "TARJETA" ? "Tarjeta de crédito" : "Deuda externa"} · Corte día ${d.cutoffDate} · Límite día ${d.dueDate}${d.interestRate ? ` · ${d.interestRate}% anual` : ""}`}
                  right={
                    <div className="text-right">
                      <p className="text-sm font-bold text-orange-400">
                        {formatCurrency(d.currentBalance)}
                      </p>
                      <p className="text-[11px] text-zinc-600">
                        mín. {formatCurrency(d.minimumPayment)}
                      </p>
                    </div>
                  }
                  onEdit={() => openEditDebt(d)}
                  onDelete={() => deleteItem("debts", d.id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <CreditCard className="w-8 h-8 text-zinc-700 mb-3" />
              <p className="text-sm text-zinc-500">Sin deudas registradas</p>
              <button
                onClick={() => setModal("debt")}
                className="mt-4 text-sm font-medium text-amber-400 hover:text-amber-300"
              >
                + Agregar deuda
              </button>
            </div>
          )}
        </Section>
      )}

      {/* ══════════════════════════════════════
          TAB: AHORROS
      ══════════════════════════════════════ */}
      {activeTab === "ahorros" && (
        <div className="space-y-4">
          {/* Ahorro mensual */}
          <Section
            title="Ahorro del ciclo"
            action={
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 shadow-[0_0_10px_rgba(52,211,153,0.1)]">
                  Total Gral: {formatCurrency(totalSaved)}
                </span>
                <span className="text-xs font-medium text-zinc-500 flex items-center gap-1">
                   Sincronizado con Planificador {new Date().getFullYear()}
                </span>
              </div>
            }
          >
            {savings.length > 0 ? (
              <div className="divide-y divide-white/[0.04]">
                {initialSavings > 0 && (
                  <div className="flex items-center justify-between py-4 px-5 group">
                    <div className="min-w-0 flex-1 pr-4">
                      <p className="text-sm font-bold text-amber-400 truncate flex items-center gap-2"><PiggyBank className="w-4 h-4" /> Ahorro Base Inicial</p>
                      <p className="text-[12px] text-zinc-500 mt-0.5">Saldo inicial al comenzar el planificador</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold text-amber-400">{formatCurrency(initialSavings)}</span>
                    </div>
                  </div>
                )}
                {savings.map((s) => (
                  <ListRow
                    key={s.id}
                    title={`${s.month}${s.financialGoal ? ` — ${s.financialGoal}` : ""}`}
                    subtitle={`Proyectado neto: ${formatCurrency(s.plannedAmount)} · Acumulado: ${formatCurrency(s.accumulatedAmount)}`}
                    right={
                      <div className="flex items-center gap-2">
                        {s.actualAmount >= s.plannedAmount ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <span className="text-sm font-bold text-amber-400">
                            {formatCurrency(s.actualAmount)}
                          </span>
                        )}
                      </div>
                    }
                    onEdit={() => openEditSaving(s)}
                    onDelete={() => deleteItem("savings", s.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <PiggyBank className="w-8 h-8 text-zinc-700 mb-3" />
                <p className="text-sm text-zinc-500">Sin registros de ahorro</p>
              </div>
            )}
          </Section>

          {/* Milestones */}
          <Section
            title="Milestones financieros"
            action={
              <button
                onClick={() => setModal("milestone")}
                className="flex items-center gap-1.5 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
              >
                <Plus className="w-4 h-4" /> Nuevo
              </button>
            }
          >
            {milestones.length > 0 ? (
              <div className="divide-y divide-white/[0.04]">
                {milestones.map((m) => (
                  <div key={m.id} className="px-5 py-4 group">
                    <div className="flex items-center justify-between mb-2.5">
                      <p className="text-sm font-medium text-zinc-200">{m.name}</p>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-xs font-semibold px-2.5 py-0.5 rounded-full border",
                          m.status === "REACHED"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        )}>
                          {m.status === "REACHED" ? "✓ Alcanzado" : `${m.progress}%`}
                        </span>
                        <button
                          onClick={() => openEditMilestone(m)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteItem("milestones", m.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all"
                          style={{ width: `${Math.min(m.progress, 100)}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-zinc-500 shrink-0">
                        {formatCurrency(m.currentAmount)} / {formatCurrency(m.targetAmount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Target className="w-8 h-8 text-zinc-700 mb-3" />
                <p className="text-sm text-zinc-500">Sin milestones</p>
              </div>
            )}
          </Section>
        </div>
      )}

      {/* ══════════════════════════════════════
          MODALS
      ══════════════════════════════════════ */}

      {/* Add Income */}
      {modal === "income" && (
        <Modal title="Nuevo ingreso" onClose={closeModal}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Fuente / empresa</label>
              <input value={iSource} onChange={(e) => setISource(e.target.value)} placeholder="Ej: Salario Astra" className="input" />
            </div>
            <div>
              <label className="label">Tipo</label>
              <select value={iType} onChange={(e) => setIType(e.target.value as IncomeType)} className="input">
                {(["SALARIO", "FREELANCE", "NEGOCIO", "INVERSION", "OTRO"] as IncomeType[]).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Frecuencia</label>
              <select value={iFreq} onChange={(e) => setIFreq(e.target.value as Frequency)} className="input">
                {(["MENSUAL", "QUINCENAL", "SEMANAL", "ANUAL"] as Frequency[]).map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Sueldo base</label>
              <input type="number" value={iBase} onChange={(e) => setIBase(e.target.value)} placeholder="0" className="input" />
            </div>
            <div>
              <label className="label">Prestaciones / bonos</label>
              <input type="number" value={iBenefits} onChange={(e) => setIBenefits(e.target.value)} placeholder="0" className="input" />
            </div>
            <div className="col-span-2">
              <label className="label">Horas trabajadas / mes</label>
              <input type="number" value={iHours} onChange={(e) => setIHours(e.target.value)} placeholder="160" className="input" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={closeModal} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={saveIncome} disabled={!iSource.trim()} className="btn-primary text-sm disabled:opacity-40 flex items-center gap-1.5">
              <Save className="w-3.5 h-3.5" /> Guardar
            </button>
          </div>
        </Modal>
      )}

      {/* Add Expense */}
      {modal === "expense" && (
        <Modal title="Nuevo gasto" onClose={closeModal}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Nombre del gasto</label>
              <input value={eName} onChange={(e) => setEName(e.target.value)} placeholder="Ej: Renta, Netflix..." className="input" />
            </div>
            <div>
              <label className="label">Categoría</label>
              <select value={eCat} onChange={(e) => setECat(e.target.value as ExpenseCategory)} className="input">
                {(["VIVIENDA","TRANSPORTE","COMIDA","ENTRETENIMIENTO","SALUD","EDUCACION","SERVICIOS","SUSCRIPCIONES","OTRO"] as ExpenseCategory[]).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Monto</label>
              <input type="number" value={eAmount} onChange={(e) => setEAmount(e.target.value)} placeholder="0" className="input" />
            </div>
            <div className="col-span-2">
              <label className="label">Tipo de gasto</label>
              <div className="grid grid-cols-3 gap-2">
                {(["FIJO", "VARIABLE", "SUSCRIPCION"] as ExpenseType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setEType(t)}
                    className={cn(
                      "py-2.5 rounded-xl text-xs font-semibold border transition-all truncate",
                      eType === t
                        ? "bg-amber-500/10 border-amber-500/25 text-amber-400"
                        : "bg-transparent border-white/[0.08] text-zinc-500 hover:border-white/[0.15]"
                    )}
                  >
                    {t === "FIJO" ? "Fijo" : t === "VARIABLE" ? "Variable" : "Suscripción"}
                  </button>
                ))}
              </div>
            </div>
            
            {eType === "SUSCRIPCION" && (
              <div className="col-span-2">
                <label className="label">Día de cargo en el mes</label>
                <input type="number" min={1} max={31} value={eChargeDay} onChange={(e) => setEChargeDay(e.target.value)} placeholder="Ej. 19" className="input" />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={closeModal} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={saveExpense} disabled={!eName.trim()} className="btn-primary text-sm disabled:opacity-40 flex items-center gap-1.5">
              <Save className="w-3.5 h-3.5" /> Guardar
            </button>
          </div>
        </Modal>
      )}

      {/* Add Debt */}
      {modal === "debt" && (
        <Modal title="Nueva deuda" onClose={closeModal}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Entidad / nombre</label>
              <input value={dEntity} onChange={(e) => setDEntity(e.target.value)} placeholder="Ej: Tarjeta BBVA" className="input" />
            </div>
            <div>
              <label className="label">Tipo</label>
              <select value={dType} onChange={(e) => setDType(e.target.value as DebtType)} className="input">
                {(["TARJETA", "EXTERNA"] as DebtType[]).map((t) => (
                  <option key={t} value={t}>{t === "TARJETA" ? "Tarjeta de crédito" : "Deuda externa"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Tasa de interés (%)</label>
              <input type="number" step="0.1" value={dRate} onChange={(e) => setDRate(e.target.value)} placeholder="0.0" className="input" />
            </div>
            <div>
              <label className="label">Saldo actual</label>
              <input type="number" value={dBalance} onChange={(e) => setDBalance(e.target.value)} placeholder="0" className="input" />
            </div>
            <div>
              <label className="label">Pago mínimo</label>
              <input type="number" value={dMinPay} onChange={(e) => setDMinPay(e.target.value)} placeholder="0" className="input" />
            </div>
            <div>
              <label className="label">Día de corte</label>
              <input type="number" min={1} max={31} value={dCutoff} onChange={(e) => setDCutoff(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Día límite de pago</label>
              <input type="number" min={1} max={31} value={dDue} onChange={(e) => setDDue(e.target.value)} className="input" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={closeModal} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={saveDebt} disabled={!dEntity.trim()} className="btn-primary text-sm disabled:opacity-40 flex items-center gap-1.5">
              <Save className="w-3.5 h-3.5" /> Guardar
            </button>
          </div>
        </Modal>
      )}

      {/* Add Saving */}
      {modal === "saving" && (
        <Modal title="Actualizar ahorro del mes" onClose={closeModal}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Real ahorrado de tus ingresos</label>
              <input type="number" value={sActual} onChange={(e) => setSActual(e.target.value)} placeholder="0" className="input text-emerald-400 font-bold" />
              <p className="text-[11px] text-zinc-500 mt-2">Esta cifra es independiente de tu proyección, es el ahorro *real* que aseguraste este mes. La meta proyectada era: {formatCurrency(Number(sPlanned))}.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button onClick={closeModal} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={saveSaving} className="btn-primary text-sm flex items-center gap-1.5 bg-emerald-500 text-black hover:bg-emerald-400">
              <Save className="w-3.5 h-3.5" /> Confirmar
            </button>
          </div>
        </Modal>
      )}

      {/* Add Milestone */}
      {modal === "milestone" && (
        <Modal title="Nuevo milestone" onClose={closeModal}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Nombre del milestone</label>
              <input value={mName} onChange={(e) => setMName(e.target.value)} placeholder="Ej: Fondo de emergencia 3 meses" className="input" />
            </div>
            <div>
              <label className="label">Monto objetivo</label>
              <input type="number" value={mTarget} onChange={(e) => setMTarget(e.target.value)} placeholder="0" className="input" />
            </div>
            <div>
              <label className="label">Monto actual</label>
              <input type="number" value={mCurrent} onChange={(e) => setMCurrent(e.target.value)} placeholder="0" className="input" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={closeModal} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={saveMilestone} disabled={!mName.trim()} className="btn-primary text-sm disabled:opacity-40 flex items-center gap-1.5">
              <Save className="w-3.5 h-3.5" /> Guardar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
