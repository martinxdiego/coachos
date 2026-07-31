import { Play, Sparkles } from "lucide-react";

const homePlayers = [
  [105, 120],
  [218, 66],
  [218, 174],
  [350, 120]
];
const opponents = [
  [300, 64],
  [300, 176],
  [455, 120]
];

export function LoginTacticalPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.045] shadow-[0_24px_80px_rgba(0,0,0,.28)] backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-white/[.07] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300">
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-[12px] font-semibold text-white">Spielzug-Vorschau</p>
            <p className="text-[10px] text-slate-400">Aufbau über den Halbraum</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-medium text-emerald-300">
          <Play aria-hidden="true" className="h-3 w-3 fill-current" />
          Live
        </span>
      </div>

      <div className="relative p-3">
        <svg
          aria-label="Animierte Vorschau eines taktischen Spielzugs"
          className="h-auto w-full overflow-visible rounded-xl"
          role="img"
          viewBox="0 0 560 240"
        >
          <defs>
            <linearGradient id="login-pitch" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#166534" />
              <stop offset="1" stopColor="#064e3b" />
            </linearGradient>
            <filter id="login-ball-shadow">
              <feDropShadow dx="0" dy="3" floodColor="#020617" floodOpacity=".45" stdDeviation="3" />
            </filter>
            <marker id="login-arrow" markerHeight="6" markerWidth="6" orient="auto" refX="5" refY="3">
              <path d="M0,0 L0,6 L6,3 z" fill="#67e8f9" />
            </marker>
          </defs>
          <rect fill="url(#login-pitch)" height="240" rx="18" width="560" />
          <g fill="none" opacity=".34" stroke="#d1fae5" strokeWidth="2">
            <rect height="216" rx="12" width="536" x="12" y="12" />
            <line x1="280" x2="280" y1="12" y2="228" />
            <circle cx="280" cy="120" r="38" />
            <rect height="116" width="72" x="12" y="62" />
            <rect height="116" width="72" x="476" y="62" />
          </g>

          <path
            className="login-tactic-route"
            d="M112 120 C172 116 174 72 218 66 S302 94 350 120 S426 126 478 120"
            fill="none"
            stroke="#a7f3d0"
            strokeDasharray="9 9"
            strokeLinecap="round"
            strokeWidth="4"
          />
          <path
            className="login-tactic-run"
            d="M218 174 C272 158 310 138 350 120"
            fill="none"
            markerEnd="url(#login-arrow)"
            stroke="#67e8f9"
            strokeLinecap="round"
            strokeWidth="3"
          />

          {homePlayers.map(([x, y], index) => (
            <g className="login-tactic-player" key={`home-${x}-${y}`} style={{ animationDelay: `${index * 180}ms` }}>
              <circle cx={x} cy={y} fill="#10b981" r="15" stroke="#ecfdf5" strokeWidth="3" />
              <text fill="white" fontSize="10" fontWeight="700" textAnchor="middle" x={x} y={y + 4}>
                {index + 4}
              </text>
            </g>
          ))}
          {opponents.map(([x, y], index) => (
            <g key={`away-${x}-${y}`} opacity=".92">
              <circle cx={x} cy={y} fill="#334155" r="14" stroke="#cbd5e1" strokeWidth="2" />
              <text fill="white" fontSize="9" fontWeight="700" textAnchor="middle" x={x} y={y + 3}>
                {index + 2}
              </text>
            </g>
          ))}
          <circle
            className="login-tactic-ball"
            cx="112"
            cy="120"
            fill="white"
            filter="url(#login-ball-shadow)"
            r="7"
            stroke="#0f172a"
            strokeWidth="2"
          />
        </svg>
      </div>
    </div>
  );
}
