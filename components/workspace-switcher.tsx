"use client";

import { ChevronsUpDown } from "lucide-react";
import { setActiveTeam } from "@/app/actions";
import type { TeamOption } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface WorkspaceSwitcherProps {
  activeTeamId?: string;
  onSelectionChange?: () => void;
  teams: TeamOption[];
  variant?: "header" | "menu";
}

export function WorkspaceSwitcher({
  activeTeamId,
  onSelectionChange,
  teams,
  variant = "header"
}: WorkspaceSwitcherProps) {
  if (teams.length === 0) {
    return null;
  }

  const selectId = variant === "menu" ? "mobile_team_id" : "team_id";

  return (
    <form
      action={setActiveTeam}
      className={cn("relative", variant === "menu" && "w-full")}
      onSubmit={() => onSelectionChange?.()}
    >
      <label className="sr-only" htmlFor={selectId}>
        Workspace
      </label>
      <div
        className={cn(
          "relative inline-flex items-center",
          variant === "menu" && "w-full"
        )}
      >
        <select
          aria-label="Workspace wählen"
          className={cn(
            "cursor-pointer appearance-none border border-white/10 bg-white/8 font-medium tracking-tight text-white shadow-soft outline-none backdrop-blur transition hover:bg-white/12 focus-visible:ring-2 focus-visible:ring-emerald-300/70",
            variant === "menu"
              ? "h-11 w-full min-w-0 rounded-xl pl-3.5 pr-10 text-base"
              : "h-11 w-[180px] max-w-full rounded-full pl-4 pr-9 text-base lg:h-9 lg:text-[13px]"
          )}
          defaultValue={activeTeamId}
          id={selectId}
          name="team_id"
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
        >
          {teams.map(({ team }) => (
            <option className="text-slate-950" key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
        <ChevronsUpDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-slate-300"
        />
      </div>
    </form>
  );
}
