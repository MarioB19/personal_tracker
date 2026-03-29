import { Goal, Mission } from "@/lib/types";

export function detectAtRisk(goal: Goal): boolean {
  const now = new Date();
  const targetDate = goal.targetDate.toDate();
  const daysLeft = Math.ceil(
    (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  return goal.progress < 30 && daysLeft < 30;
}

export function getAtRiskGoals(goals: Goal[]): Goal[] {
  return goals.filter(
    (g) => g.status !== "COMPLETED" && g.status !== "CANCELLED" && detectAtRisk(g)
  );
}

export function getMissionProgress(mission: Mission): number {
  if (mission.checklist.length === 0) return mission.progress;
  const completed = mission.checklist.filter((item) => item.completed).length;
  return Math.round((completed / mission.checklist.length) * 100);
}

export interface Alert {
  id: string;
  type: "danger" | "warning" | "info";
  title: string;
  description: string;
  entityType: string;
  entityId: string;
}

export function generateAlerts(
  goals: Goal[],
  missions: Mission[]
): Alert[] {
  const alerts: Alert[] = [];

  // At-risk goals
  getAtRiskGoals(goals).forEach((g) => {
    alerts.push({
      id: `atrisk-${g.id}`,
      type: "warning",
      title: "Meta en riesgo",
      description: g.name,
      entityType: "goal",
      entityId: g.id,
    });
  });

  // Failed missions
  missions
    .filter((m) => m.status === "FAILED")
    .forEach((m) => {
      alerts.push({
        id: `failed-${m.id}`,
        type: "danger",
        title: "Misión fallida",
        description: m.name,
        entityType: "mission",
        entityId: m.id,
      });
    });

  return alerts;
}
