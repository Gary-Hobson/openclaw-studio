import { fetchJson } from "@/lib/http";
import type { CronJobsResult } from "./types";

export const fetchCronJobs = async (): Promise<CronJobsResult> => {
  return fetchJson<CronJobsResult>("/api/cron", { cache: "no-store" });
};
