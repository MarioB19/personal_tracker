import { getAll, getAllFinance } from "@/lib/repositories/firestore";
import type {
  Debt,
  Expense,
  Goal,
  Income,
  Mission,
  TimeBlock,
} from "@/lib/types";

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate();
  }
  return null;
}

function getISOWeek(date: Date) {
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  target.setUTCDate(target.getUTCDate() + 3 - ((target.getUTCDay() + 6) % 7));
  const weekOne = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const weekNumber =
    1 +
    Math.round(
      ((target.getTime() - weekOne.getTime()) / 86_400_000 -
        3 +
        ((weekOne.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${target.getUTCFullYear()}-W${weekNumber.toString().padStart(2, "0")}`;
}

function getDayKey(date: Date) {
  return (["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const)[
    date.getUTCDay()
  ];
}

function todayInMexicoCity() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return new Date(Date.UTC(read("year"), read("month") - 1, read("day")));
}

export function currentMonthInMexicoCity() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

export async function getDashboardSummary(userId: string, month: string) {
  const [goals, missions, timeBlocks, incomes, expenses, debts] =
    await Promise.all([
      getAll<Goal>(userId, "goals"),
      getAll<Mission>(userId, "missions"),
      getAll<TimeBlock>(userId, "timeBlocks"),
      getAllFinance<Income>(userId, "income"),
      getAllFinance<Expense>(userId, "expenses"),
      getAllFinance<Debt>(userId, "debts"),
    ]);

  const now = new Date();
  const localToday = todayInMexicoCity();
  const activeGoals = goals.filter(
    (goal) => goal.status !== "COMPLETED" && goal.status !== "CANCELLED",
  );
  const atRiskGoals = activeGoals.filter((goal) => {
    const targetDate = toDate(goal.targetDate);
    if (!targetDate) return false;
    const daysLeft = Math.ceil(
      (targetDate.getTime() - now.getTime()) / 86_400_000,
    );
    return goal.progress < 30 && daysLeft < 30;
  });

  const monthlyIncome = incomes.filter(
    (income) => income.month === month || income.date?.startsWith(month),
  );
  const monthlyExpenses = expenses.filter(
    (expense) => expense.month === month || expense.date?.startsWith(month),
  );
  const incomeTotal = monthlyIncome.reduce(
    (sum, income) => sum + income.netIncome,
    0,
  );
  const expenseTotal = monthlyExpenses.reduce(
    (sum, expense) => sum + expense.amount,
    0,
  );
  const minimumDebtPayments = debts
    .filter((debt) => debt.status === "ACTIVE")
    .reduce((sum, debt) => sum + debt.minimumPayment, 0);

  const todayBlocks = timeBlocks.filter(
    (block) =>
      block.weekId === getISOWeek(localToday) &&
      block.day === getDayKey(localToday),
  );

  return {
    generatedAt: now.toISOString(),
    month,
    goals: {
      total: goals.length,
      active: activeGoals.length,
      completed: goals.filter((goal) => goal.status === "COMPLETED").length,
      atRisk: atRiskGoals.length,
      averageProgress: average(activeGoals.map((goal) => goal.progress)),
    },
    missions: {
      total: missions.length,
      pending: missions.filter((mission) => mission.status === "PENDING").length,
      inProgress: missions.filter((mission) => mission.status === "IN_PROGRESS")
        .length,
      completed: missions.filter((mission) => mission.status === "COMPLETED")
        .length,
      failed: missions.filter((mission) => mission.status === "FAILED").length,
      averageProgress: average(missions.map((mission) => mission.progress)),
    },
    agenda: {
      today: todayBlocks.length,
      completed: todayBlocks.filter(
        (block) => block.executedStatus === "COMPLETED",
      ).length,
    },
    finance: {
      income: incomeTotal,
      expenses: expenseTotal,
      minimumDebtPayments,
      net: incomeTotal - expenseTotal - minimumDebtPayments,
      activeDebt: debts
        .filter((debt) => debt.status === "ACTIVE")
        .reduce((sum, debt) => sum + debt.currentBalance, 0),
      records: {
        income: monthlyIncome.length,
        expenses: monthlyExpenses.length,
      },
    },
  };
}
