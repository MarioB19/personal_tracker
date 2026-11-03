import { Timestamp } from "firebase/firestore";

// ════════════════════════════════════════════════
// ENUMS
// ════════════════════════════════════════════════


export type GoalType =
  | "RESULTADO"
  | "PROCESO"
  | "HABITO"
  | "PROYECTO"
  | "MANTENIMIENTO";

export type GoalHorizon =
  | "VIDA"
  | "LARGO_PLAZO"
  | "MEDIANO_PLAZO"
  | "CORTO_PLAZO";

export type GoalPeriod = "ANNUAL" | "QUARTERLY" | "MONTHLY" | "WEEKLY";

export type GoalStatus =
  | "DRAFT"
  | "ACTIVE"
  | "IN_PROGRESS"
  | "AT_RISK"
  | "COMPLETED"
  | "CANCELLED";

export type MissionStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

export type ActivityStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "OVERDUE"
  | "CANCELLED";

export type IncomeType =
  | "SALARIO"
  | "FREELANCE"
  | "NEGOCIO"
  | "INVERSION"
  | "OTRO";

export type ExpenseCategory =
  | "VIVIENDA"
  | "TRANSPORTE"
  | "COMIDA"
  | "ENTRETENIMIENTO"
  | "SALUD"
  | "EDUCACION"
  | "SERVICIOS"
  | "SUSCRIPCIONES"
  | "OTRO";

export type ExpenseType = "FIJO" | "VARIABLE" | "SUSCRIPCION";

export type FinancialContext = "PERSONAL" | "BUSINESS";

export type Frequency = "MENSUAL" | "QUINCENAL" | "SEMANAL" | "ANUAL" | "UNICO";

export type DebtType =
  | "TARJETA"
  | "EXTERNA";

export type DebtStatus = "ACTIVE" | "PAID" | "IN_NEGOTIATION";

export type MilestoneStatus = "PENDING" | "IN_PROGRESS" | "REACHED";

export type DayOfWeek = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

export type BlockCategory =
  | "TRABAJO"
  | "APRENDIZAJE"
  | "SALUD"
  | "PERSONAL"
  | "OCIO";

export type BlockStatus = "PLANNED" | "COMPLETED" | "PARTIAL" | "SKIPPED" | "MOVED";

export type ReviewType = "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL";

export type RoadmapStatus = "PENDIENTE" | "EN_PROGRESO" | "COMPLETADO" | "VACÍO";
export type RoadmapQuarterKey = "Q1" | "Q2" | "Q3" | "Q4";

export type LifeArea =
  | "SALUD"
  | "DINERO"
  | "CARRERA"
  | "FAMILIA"
  | "RELACIONES"
  | "APRENDIZAJE"
  | "PROPOSITO"
  | "DIVERSION";

// ════════════════════════════════════════════════
// ENTITIES
// ════════════════════════════════════════════════


export interface Goal {
  id: string;
  userId: string;
  name: string;
  description: string;
  type: GoalType;
  horizon: GoalHorizon;
  period: GoalPeriod;
  year?: number;
  quarter?: 1 | 2 | 3 | 4;
  month?: number;
  parentGoalId?: string;
  lifeArea: LifeArea;
  successIndicator: string;
  targetDate: Timestamp;
  status: GoalStatus;
  progress: number;
  blockers: string[];
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Mission {
  id: string;
  userId: string;
  name: string;
  description: string;
  category: string;
  goalId?: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  targetDate: Timestamp;
  status: MissionStatus;
  progress: number;
  checklist: ChecklistItem[];
  evidence: string;
  storageRefs: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Activity {
  id: string;
  userId: string;
  name: string;
  description: string;
  period: string;
  targetDate: Timestamp;
  goalId?: string;
  missionId?: string;
  projectTag?: string;
  status: ActivityStatus;
  progress: number;
  isOverdue: boolean;
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Product {
  id: string;
  userId: string;
  name: string;
  description?: string;
  status?: "testing" | "active" | "archived";
  createdDate?: string; // YYYY-MM-DD
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface InfoproductOp {
  id: string;
  userId: string;
  month: string; // YYYY-MM (ej. "2026-08")
  productName: string;
  adSpend: number;
  revenue: number;
  salesCount?: number;
  source?: "MANUAL" | "VIBE";
  externalRef?: string;
  track?: "WHATSAPP" | "LANDING" | "UNCLASSIFIED";
  spendNet?: number;
  vatAmount?: number;
  conversations?: number;
  costPerConversation?: number | null;
  cpa?: number | null;
  roas?: number | null;
  sourceStatus?: "PROVISIONAL" | "FINAL";
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface InfoproductFixedExpense {
  id: string;
  userId: string;
  month: string; // Campo legado y mes de vigencia (YYYY-MM)
  effectiveFrom?: string; // La recurrencia mensual inicia en YYYY-MM
  seriesId?: string; // Une las versiones históricas del mismo gasto
  status?: "ACTIVE" | "CANCELLED";
  revision?: number;
  concept: string;
  amount: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Income {
  id: string;
  userId: string;
  source: string;
  type: IncomeType;
  baseSalary: number;
  benefits: number;
  netIncome: number;
  frequency: Frequency;
  hoursPerMonth: number;
  costPerHour: number;
  month: string;
  date?: string; // YYYY-MM-DD
  effectiveFrom?: string; // Vigencia mensual de una versión recurrente
  seriesId?: string; // Une versiones de la misma fuente mensual
  recurrenceStatus?: "ACTIVE" | "CANCELLED";
  revision?: number;
  financialContext?: FinancialContext;
  productId?: string;
  productName?: string;
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Expense {
  id: string;
  userId: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  type: ExpenseType;
  frequency: Frequency;
  effectiveFrom?: string; // Vigencia mensual de una versión recurrente
  seriesId?: string; // Une versiones del mismo gasto recurrente
  recurrenceStatus?: "ACTIVE" | "CANCELLED";
  revision?: number;
  chargeDay?: number; // Día del mes para gastos fijos
  month: string;
  date?: string; // YYYY-MM-DD
  isNecessity: boolean;
  financialContext?: FinancialContext;
  productId?: string;
  productName?: string;
  subscriptionStatus?: "active" | "cancelled";
  externalRef?: string;
  createdBy?: string;
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Debt {
  id: string;
  userId: string;
  entity: string;
  currentBalance: number;
  minimumPayment: number;
  cutoffDate: number;
  dueDate: number;
  interestRate?: number;
  type: DebtType;
  status: DebtStatus;
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PlanMilestone {
  id: string;
  name: string;
  amount: number;
  startMonth: number; // 0-11
  endMonth: number; // 0-11
  currentAmount?: number;
  status?: "PENDING" | "REACHED";
}

/** RECURRING: ingreso habitual · EXTRA: bono/aguinaldo · RECEIVABLE: cobro pendiente de un mes anterior. */
export type PlanIncomeKind = "RECURRING" | "EXTRA" | "RECEIVABLE";

export interface IncomeSourcePlan {
  id: string;
  name: string;
  values: number[]; // 12 elements
  context?: FinancialContext;
  kind?: PlanIncomeKind;
  notes?: string;
}

/** PERSONAL: gasto mensual personal · BUSINESS: operación del negocio · ONE_OFF: gasto puntual · DEBT: pago de deuda. */
export type PlanExpenseGroup = "PERSONAL" | "BUSINESS" | "ONE_OFF" | "DEBT";

export interface PlanExpenseLine {
  id: string;
  name: string;
  group: PlanExpenseGroup;
  context: FinancialContext;
  values: number[]; // 12 elements
  notes?: string;
}

/** Dinero que se aparta (fondo de ahorro): reduce el dinero libre, no el patrimonio. */
export interface PlanSavingsLine {
  id: string;
  name: string;
  values: number[]; // 12 elements
  notes?: string;
}

/** Saldo real declarado en un corte; la proyección parte de él desde `month`. */
export interface PlanAnchor {
  cutId: string;
  date: string; // YYYY-MM-DD
  month: number; // 0-11
  balance: number;
}

export interface SavingsPlanYear {
  id: string;
  userId: string;
  year: number;
  schemaVersion?: 2;
  revision?: number;
  initialSavings: number;
  incomeSources: IncomeSourcePlan[];
  expenseLines?: PlanExpenseLine[];
  savingsLines?: PlanSavingsLine[];
  anchor?: PlanAnchor | null;
  /** Total mensual derivado (gastos de todas las secciones); se conserva para lectores heredados. */
  expensesValues: number[]; // 12 elements
  actualSavingsValues?: number[]; // 12 elements (tracking of reality vs projection)
  milestones: PlanMilestone[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FinancialCutAccount {
  id: string;
  name: string;
  amount: number;
}

export type FinancialCutTerm =
  | { kind: "line"; year: number; lineId: string; months: number[]; sign?: 1 | -1 }
  | { kind: "accounts"; sign?: 1 | -1 }
  | { kind: "constant"; value: number; label: string; sign?: 1 | -1 };

export interface FinancialCutCheck {
  id: string;
  label: string;
  declared: number;
  terms: FinancialCutTerm[];
  /** WARNING para supuestos (p. ej. capacidad de pauta); MISMATCH para totales que deberían cuadrar. */
  severity?: "MISMATCH" | "WARNING";
  note?: string;
}

export interface FinancialCut {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  label: string;
  accounts: FinancialCutAccount[];
  checks: FinancialCutCheck[];
  notes: string[];
  revision?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}


export interface Saving {
  id: string;
  userId: string;
  month: string;
  plannedAmount: number;
  actualAmount: number;
  accumulatedAmount: number;
  financialGoal: string;
  milestoneId?: string;
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Milestone {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  progress: number;
  targetDate: Timestamp;
  goalId?: string;
  status: MilestoneStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TimeBlock {
  id: string;
  userId: string;
  weekId: string;
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  title: string;
  activityId?: string;
  projectTag?: string;
  category: BlockCategory;
  plannedStatus: BlockStatus;
  executedStatus: BlockStatus;
  complianceRate: number;
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ReviewMetric {
  name: string;
  planned: number;
  actual: number;
  unit: string;
}

export interface RoadmapRow {
  id: string;
  userId: string;
  year: number;
  age: number;
  annualGoals: string;
  quarter: RoadmapQuarterKey;
  quarterlyGoals: string;
  month: string;
  monthNumber: number;
  monthlyGoal: string;
  activities: string;
  status: RoadmapStatus;
  comments: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SelfEvaluationDetail {
  rating: number; // 1 a 5
  comment: string; // Nota reflexiva
}

export interface SelfEvaluations {
  yoFisico?: SelfEvaluationDetail;
  yoProfesional?: SelfEvaluationDetail;
  yoEmprendedor?: SelfEvaluationDetail;
  yoMental?: SelfEvaluationDetail;
  yoRelacional?: SelfEvaluationDetail;
  yoEspiritual?: SelfEvaluationDetail;
  yoProposito?: SelfEvaluationDetail;
}

export interface Review {
  id: string;
  userId: string;
  type: ReviewType;
  period: string;
  achievements: string[];
  pendingItems: string[];
  blockers: string[];
  learnings: string[];
  keyMetrics: ReviewMetric[];
  adjustments: string[];
  nextFocus: string;
  overallRating: number;
  generalRating?: number;
  selfEvaluations?: SelfEvaluations;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
