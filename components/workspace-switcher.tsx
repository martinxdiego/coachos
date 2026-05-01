"use client";

import { ChevronsUpDown } from "lucide-react";
import { setActiveTeam } from "@/app/actions";
import type { TeamOption } from "@/lib/auth";

interface WorkspaceSwitcherProps {
  activeTeamId?: string;
  teams: TeamOption[];
}

export function WorkspaceSwitcher({
  activeTeamId,
  teams
}: WorkspaceSwitcherProps) {
  if (teams.length === 0) {
    return null;
  }

  return (
    <form action={setActiveTeam} className="relative">
      <label className="sr-only" htmlFor="team_id">
        Workspace
      </label>
      <div className="relative inline-flex items-center">
        <select
          aria-label="Workspace wählen"
          className="h-9 min-w-[180px] cursor-pointer appearance-none rounded-full border border-white/10 bg-white/8 pl-4 pr-9 text-[13px] font-medium tracking-tight text-white shadow-soft outline-none backdrop-blur transition hover:bg-white/12 focus-visible:ring-2 focus-visible:ring-emerald-300/70"
          defaultValue={activeTeamId}
          id="team_id"
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
