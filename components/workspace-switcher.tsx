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
    <form action={setActiveTeam} className="flex items-center gap-2">
      <label className="sr-only" htmlFor="team_id">
        Workspace
      </label>
      <select
        className="h-10 min-w-[190px] rounded-lg border border-white/10 bg-white/10 px-3 text-sm font-medium text-white shadow-sm outline-none transition hover:bg-white/15 focus:ring-2 focus:ring-emerald-300/70"
        defaultValue={activeTeamId}
        id="team_id"
        name="team_id"
      >
        {teams.map(({ team }) => (
          <option className="text-slate-950" key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
      <button
        className="h-10 rounded-lg border border-white/10 px-3 text-sm font-medium text-white transition hover:bg-white/10"
        type="submit"
      >
        Switch
      </button>
    </form>
  );
}
