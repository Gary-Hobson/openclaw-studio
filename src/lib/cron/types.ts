export type CronSchedule =
  | { kind: "at"; atMs: number }
  | { kind: "every"; everyMs: number; anchorMs?: number }
  | { kind: "cron"; expr: string; tz?: string };

export type CronPayload =
  | { kind: "systemEvent"; text: string }
  | { kind: "agentTurn"; message: string };

export type CronJobSummary = {
  id: string;
  name: string;
  agentId?: string;
  enabled: boolean;
  updatedAtMs: number;
  schedule: CronSchedule;
  payload: CronPayload;
  sessionTarget?: string;
};

export type CronJobsResult = {
  jobs: CronJobSummary[];
};
