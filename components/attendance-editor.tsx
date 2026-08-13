"use client";

import { useMemo, useState } from "react";
import { CheckCheck, Search } from "lucide-react";
import { saveAttendance } from "@/app/actions";
import { ToastForm } from "@/components/toast-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  attendanceStatusLabels,
  attendanceStatuses,
  isAttendedStatus
} from "@/lib/attendance";
import type { AttendanceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type AttendanceRecord = {
  player_id: string;
  status: AttendanceStatus;
  note: string | null;
  late_minutes: number | null;
  participation_percent: number | null;
};

type Player = {
  id: string;
  name: string;
  position: string | null;
};

type Draft = {
  status: AttendanceStatus;
  note: string;
  lateMinutes: string;
  participationPercent: string;
};

const statusClasses: Record<AttendanceStatus, string> = {
  present: "border-emerald-200 bg-emerald-50/70 text-emerald-950",
  late: "border-amber-200 bg-amber-50/70 text-amber-950",
  individual: "border-sky-200 bg-sky-50/70 text-sky-950",
  excused: "border-slate-200 bg-slate-50 text-slate-950",
  unexcused: "border-red-200 bg-red-50/70 text-red-950",
  injured: "border-orange-200 bg-orange-50/70 text-orange-950",
  sick: "border-violet-200 bg-violet-50/70 text-violet-950",
  vacation: "border-cyan-200 bg-cyan-50/70 text-cyan-950",
  not_selected: "border-zinc-200 bg-zinc-50 text-zinc-950",
  absent: "border-slate-200 bg-slate-50 text-slate-950"
};

function initialDraft(record: AttendanceRecord | undefined): Draft {
  const status = record?.status ?? "present";
  return {
    status,
    note: record?.note ?? "",
    lateMinutes:
      record?.late_minutes === null || record?.late_minutes === undefined
        ? ""
        : String(record.late_minutes),
    participationPercent: isAttendedStatus(status)
      ? String(record?.participation_percent ?? 100)
      : ""
  };
}

export function AttendanceEditor({
  attendance,
  players,
  trainingId
}: {
  attendance: AttendanceRecord[];
  players: Player[];
  trainingId: string;
}) {
  const recordsByPlayer = useMemo(
    () => new Map(attendance.map((record) => [record.player_id, record])),
    [attendance]
  );
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      players.map((player) => [
        player.id,
        initialDraft(recordsByPlayer.get(player.id))
      ])
    )
  );
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLocaleLowerCase("de-CH");
  const attendedCount = players.filter((player) =>
    isAttendedStatus(drafts[player.id]?.status)
  ).length;
  const exceptionCount = players.length - attendedCount;

  function updateDraft(playerId: string, patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [playerId]: {
        ...current[playerId],
        ...patch
      }
    }));
  }

  function setStatus(playerId: string, status: AttendanceStatus) {
    const current = drafts[playerId];
    updateDraft(playerId, {
      status,
      lateMinutes: status === "late" ? current.lateMinutes : "",
      participationPercent: isAttendedStatus(status)
        ? current.participationPercent || "100"
        : ""
    });
  }

  function markAllPresent() {
    setDrafts((current) =>
      Object.fromEntries(
        players.map((player) => [
          player.id,
          {
            ...current[player.id],
            status: "present",
            note: "",
            lateMinutes: "",
            participationPercent: "100"
          } satisfies Draft
        ])
      )
    );
  }

  return (
    <ToastForm
      action={saveAttendance}
      className="mt-4 space-y-4"
      successMessage="Anwesenheit gespeichert"
    >
      <input name="training_id" type="hidden" value={trainingId} />

      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/80 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="success">{attendedCount} dabei</Badge>
          <Badge variant={exceptionCount > 0 ? "secondary" : "outline"}>
            {exceptionCount} Ausnahmen
          </Badge>
        </div>
        <Button
          className="min-h-11 sm:min-h-9"
          onClick={markAllPresent}
          type="button"
          variant="outline"
        >
          <CheckCheck aria-hidden="true" className="h-4 w-4" />
          Alle anwesend
        </Button>
      </div>

      <label className="relative block">
        <Search
          aria-hidden="true"
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          className="h-11 pl-9"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Spieler suchen"
          type="search"
          value={query}
        />
      </label>

      <div className="grid gap-2 xl:grid-cols-2">
        {players.map((player) => {
          const draft = drafts[player.id];
          const isVisible =
            !normalizedQuery ||
            (player.name + " " + (player.position ?? ""))
              .toLocaleLowerCase("de-CH")
              .includes(normalizedQuery);
          const showInlineDetails = draft.status !== "present";

          return (
            <div
              className={cn(
                "rounded-xl border p-3 transition-colors",
                statusClasses[draft.status],
                !isVisible && "hidden"
              )}
              key={player.id}
            >
              <input name="player_id" type="hidden" value={player.id} />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{player.name}</p>
                  {player.position ? (
                    <p className="truncate text-xs opacity-65">
                      {player.position}
                    </p>
                  ) : null}
                </div>
                <select
                  aria-label={"Status für " + player.name}
                  className="h-11 w-full rounded-lg border border-current/15 bg-white px-3 text-sm font-medium text-foreground outline-none ring-offset-2 focus:ring-2 focus:ring-primary sm:w-48"
                  name={"attendance_status_" + player.id}
                  onChange={(event) =>
                    setStatus(player.id, event.target.value as AttendanceStatus)
                  }
                  value={draft.status}
                >
                  {attendanceStatuses.map((status) => (
                    <option key={status} value={status}>
                      {attendanceStatusLabels[status]}
                    </option>
                  ))}
                </select>
              </div>

              {showInlineDetails ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {draft.status === "late" ? (
                    <label className="space-y-1 text-xs font-medium">
                      Verspätung (Min.)
                      <Input
                        className="h-10 bg-white"
                        inputMode="numeric"
                        max={240}
                        min={0}
                        name={"attendance_late_minutes_" + player.id}
                        onChange={(event) =>
                          updateDraft(player.id, {
                            lateMinutes: event.target.value
                          })
                        }
                        placeholder="z. B. 10"
                        type="number"
                        value={draft.lateMinutes}
                      />
                    </label>
                  ) : null}
                  {isAttendedStatus(draft.status) ? (
                    <label className="space-y-1 text-xs font-medium">
                      Trainingsanteil (%)
                      <Input
                        className="h-10 bg-white"
                        inputMode="numeric"
                        max={100}
                        min={0}
                        name={"attendance_participation_" + player.id}
                        onChange={(event) =>
                          updateDraft(player.id, {
                            participationPercent: event.target.value
                          })
                        }
                        type="number"
                        value={draft.participationPercent}
                      />
                    </label>
                  ) : null}
                  <label
                    className={cn(
                      "space-y-1 text-xs font-medium",
                      draft.status === "late" && "sm:col-span-2"
                    )}
                  >
                    Bemerkung
                    <Input
                      className="h-10 bg-white"
                      maxLength={500}
                      name={"attendance_note_" + player.id}
                      onChange={(event) =>
                        updateDraft(player.id, { note: event.target.value })
                      }
                      placeholder="Optionaler Grund oder Hinweis"
                      value={draft.note}
                    />
                  </label>
                </div>
              ) : (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium opacity-70">
                    Trainingsanteil oder Notiz ergänzen
                  </summary>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="space-y-1 text-xs font-medium">
                      Trainingsanteil (%)
                      <Input
                        className="h-10 bg-white"
                        inputMode="numeric"
                        max={100}
                        min={0}
                        name={"attendance_participation_" + player.id}
                        onChange={(event) =>
                          updateDraft(player.id, {
                            participationPercent: event.target.value
                          })
                        }
                        type="number"
                        value={draft.participationPercent}
                      />
                    </label>
                    <label className="space-y-1 text-xs font-medium">
                      Bemerkung
                      <Input
                        className="h-10 bg-white"
                        maxLength={500}
                        name={"attendance_note_" + player.id}
                        onChange={(event) =>
                          updateDraft(player.id, { note: event.target.value })
                        }
                        placeholder="Optional"
                        value={draft.note}
                      />
                    </label>
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-16 z-10 rounded-xl border border-border/70 bg-background/95 p-2 shadow-lg backdrop-blur sm:bottom-3">
        <Button className="h-11 w-full" type="submit">
          Anwesenheit speichern
        </Button>
      </div>
    </ToastForm>
  );
}
