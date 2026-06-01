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

export type Frequency = "MENSUAL" | "QUINCENAL" | "SEMANAL" | "ANUAL";

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
  chargeDay?: number; // Día del mes para gastos fijos
  month: string;
  isNecessity: boolean;
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

export interface IncomeSourcePlan {
  id: string;
  name: string;
  values: number[]; // 12 elements
}

export interface SavingsPlanYear {
  id: string;
  userId: string;
  year: number;
  initialSavings: number;
  incomeSources: IncomeSourcePlan[];
  expensesValues: number[]; // 12 elements
  actualSavingsValues?: number[]; // 12 elements (tracking of reality vs projection)
  milestones: PlanMilestone[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
  overallRating: 1 | 2 | 3 | 4 | 5;
  selfEvaluations?: SelfEvaluations;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
