import { create } from "zustand";
import client, { errorMessage } from "./client";
import type { Schemas } from "./types";

type JobView = Schemas["JobView"];
export type JobStatus = JobView["status"];

interface ActiveJobs {
  jobs: Record<string, JobStatus>;
  set: (id: string, status: JobStatus | null) => void;
}

/** Jobs the browser is waiting for, shown by the top-bar indicator. */
export const useActiveJobs = create<ActiveJobs>((set) => ({
  jobs: {},
  set: (id, status) =>
    set(({ jobs }) => {
      const next = { ...jobs };
      if (status) next[id] = status;
      else delete next[id];
      return { jobs: next };
    }),
}));

function follow<T>(id: string): Promise<T> {
  const { set } = useActiveJobs.getState();
  return new Promise<T>((resolve, reject) => {
    const events = new EventSource(`/api/jobs/${id}/events`);
    const finish = (settle: () => void) => {
      events.close();
      set(id, null);
      settle();
    };
    events.addEventListener("status", (event) => {
      const job = JSON.parse((event as MessageEvent<string>).data) as JobView;
      set(id, job.status);
      if (job.status === "done") finish(() => resolve(job.result as T));
      if (job.status === "failed")
        finish(() => reject(new Error(errorMessage(job.error?.code))));
    });
    events.onerror = () =>
      finish(() => reject(new Error(errorMessage(undefined))));
  });
}

/**
 * POST a slow AI request as a background job and wait for its result.
 * The server answers 202 with a job; a server without jobs answers directly.
 */
export async function postJob<T>(url: string, body: unknown): Promise<T> {
  const response = await client.post<T | JobView>(url, body, {
    headers: { Prefer: "respond-async" },
  });
  if (response.status !== 202) return response.data as T;
  const job = response.data as JobView;
  useActiveJobs.getState().set(job.id, job.status);
  return follow<T>(job.id);
}
