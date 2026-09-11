import React, { useState } from "react";
import { ServerError } from "@/components/auth/ServerError";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AgentReport } from "@/types";

interface AdminReportsProps {
  reports: AgentReport[];
}

interface ApiErrorBody {
  code: string;
  message: string;
}

function readError(body: unknown): ApiErrorBody {
  if (typeof body !== "object" || body === null || !("error" in body)) {
    return { code: "UNKNOWN", message: "Request failed" };
  }
  const error = body.error;
  if (typeof error !== "object" || error === null) {
    return { code: "UNKNOWN", message: "Request failed" };
  }
  const code = "code" in error && typeof error.code === "string" ? error.code : "UNKNOWN";
  const message = "message" in error && typeof error.message === "string" ? error.message : "Request failed";
  return { code, message };
}

const FLAG_TECHNICAL_MARKER = "<!--hf-technical-payload-->";

function splitReportBody(body: string): { prose: string; technical: string | null } {
  const markerIndex = body.indexOf(FLAG_TECHNICAL_MARKER);
  if (markerIndex === -1) {
    return { prose: body, technical: null };
  }
  const suffix = body.slice(markerIndex + FLAG_TECHNICAL_MARKER.length).trim();
  try {
    JSON.parse(suffix);
    return { prose: body.slice(0, markerIndex).trimEnd(), technical: suffix };
  } catch {
    return { prose: body, technical: null };
  }
}

async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

const ghostBtnClass = "rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/20";

export default function AdminReports({ reports: initialReports }: AdminReportsProps) {
  const [reports, setReports] = useState(initialReports);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();

  async function markReviewed(id: string) {
    if (busyId !== null) {
      return;
    }
    setBusyId(id);
    setError(undefined);
    try {
      const response = await fetch(`/api/admin/reports/${id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "reviewed" }),
      });
      const body = await readBody(response);
      if (!response.ok) {
        const apiError = readError(body);
        setError(`${apiError.code}: ${apiError.message}`);
        return;
      }
      setReports((current) =>
        current.map((report) =>
          report.id === id ? { ...report, status: "reviewed", reviewedAt: new Date().toISOString() } : report,
        ),
      );
    } catch {
      setError("UNKNOWN: Request failed");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteReport(id: string) {
    if (busyId !== null) {
      return;
    }
    setBusyId(id);
    setError(undefined);
    try {
      const response = await fetch(`/api/admin/reports/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const body = await readBody(response);
      if (!response.ok) {
        const apiError = readError(body);
        setError(`${apiError.code}: ${apiError.message}`);
        return;
      }
      setReports((current) => current.filter((report) => report.id !== id));
    } catch {
      setError("UNKNOWN: Request failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-4 text-left">
      <ServerError message={error} />
      {reports.length === 0 ? (
        <p className="text-sm text-blue-100/70">No admin reports yet.</p>
      ) : (
        <ul className="space-y-3">
          {reports.map((report) => {
            const { prose, technical } = splitReportBody(report.body);
            return (
              <li
                key={report.id}
                className={cn("rounded-lg border border-white/15 bg-white/5 p-4", "text-sm text-blue-100/80")}
              >
                <div className="flex items-start gap-3">
                  <details className="min-w-0 flex-1">
                    <summary className="cursor-pointer select-none">
                      <time dateTime={report.createdAt} className="text-xs text-blue-100/50">
                        {report.createdAt.slice(0, 10)}
                      </time>
                      <span className="ml-3 text-base font-medium text-white">{report.title}</span>
                    </summary>
                    <div className="mt-3 space-y-2">
                      <p className="text-xs tracking-wide text-blue-100/60 uppercase">
                        {report.kind} · {report.status}
                      </p>
                      <p>
                        Week {report.weekStart}
                        {report.boundCodes.length > 0 ? ` · ${report.boundCodes.join(", ")}` : ""}
                      </p>
                      <p className="whitespace-pre-wrap text-blue-50">{prose}</p>
                      {technical !== null ? (
                        <div className="space-y-1">
                          <p className="text-xs tracking-wide text-blue-100/60 uppercase">Technical payload</p>
                          <pre className={cn("overflow-x-auto text-xs whitespace-pre-wrap text-blue-50")}>
                            {technical}
                          </pre>
                        </div>
                      ) : null}
                      {report.status === "open" ? (
                        <Button
                          type="button"
                          disabled={busyId !== null}
                          className="rounded-lg bg-purple-600 text-white hover:bg-purple-500"
                          onClick={() => {
                            void markReviewed(report.id);
                          }}
                        >
                          Reviewed
                        </Button>
                      ) : null}
                    </div>
                  </details>
                  <Button
                    type="button"
                    disabled={busyId !== null}
                    className={ghostBtnClass}
                    onClick={() => {
                      void deleteReport(report.id);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
