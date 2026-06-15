"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Direction = "low-good" | "high-good";

interface ScoreScaleProps {
  name: string;
  label: string;
  hint?: string;
  defaultValue?: number;
  direction?: Direction;
  size?: "sm" | "md";
}

const colorMap = {
  1: { bg: "bg-emerald-500", text: "text-white", ring: "ring-emerald-500" },
  2: { bg: "bg-emerald-400", text: "text-white", ring: "ring-emerald-400" },
  3: { bg: "bg-amber-400", text: "text-amber-950", ring: "ring-amber-400" },
  4: { bg: "bg-orange-500", text: "text-white", ring: "ring-orange-500" },
  5: { bg: "bg-red-600", text: "text-white", ring: "ring-red-600" }
} as const;

function colorFor(value: number, direction: Direction) {
  if (direction === "high-good") {
    const mirrored = (6 - value) as 1 | 2 | 3 | 4 | 5;
    return colorMap[mirrored];
  }
  return colorMap[value as 1 | 2 | 3 | 4 | 5];
}

export function ScoreScale({
  name,
  label,
  hint,
  defaultValue = 3,
  direction = "low-good",
  size = "md"
}: ScoreScaleProps) {
  const [value, setValue] = useState<number>(defaultValue);
  const [popped, setPopped] = useState<number | null>(null);
  const active = colorFor(value, direction);
  const heightClass = size === "sm" ? "h-9 text-[13px]" : "h-11 text-[14px]";
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function select(option: number) {
    setValue(option);
    setPopped(option);
    setTimeout(() => setPopped(null), 300);
  }

  // Arrow/Home/End move the selection within the radiogroup (WCAG 2.1.1) and
  // keep focus on the newly selected option, matching native radio behaviour.
  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    let next: number | null = null;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = value === 5 ? 1 : value + 1;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = value === 1 ? 5 : value - 1;
        break;
      case "Home":
        next = 1;
        break;
      case "End":
        next = 5;
        break;
      default:
        return;
    }
    event.preventDefault();
    select(next);
    buttonRefs.current[next - 1]?.focus();
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium tracking-tight text-foreground">
          {label}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
            active.bg,
            active.text
          )}
        >
          {value}/5
        </span>
      </div>
      <input name={name} type="hidden" value={value} />
      <div
        className="grid grid-cols-5 gap-1.5"
        role="radiogroup"
        aria-label={label}
      >
        {[1, 2, 3, 4, 5].map((option) => {
          const isActive = option === value;
          const optColor = colorFor(option, direction);
          return (
            <button
              aria-checked={isActive}
              aria-label={`${option}/5`}
              className={cn(
                "flex items-center justify-center rounded-lg border font-semibold tracking-tight transition-all duration-150 active:scale-[0.97]",
                heightClass,
                isActive
                  ? cn(optColor.bg, optColor.text, "border-transparent shadow-sm", popped === option && "animate-score-pop")
                  : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              )}
              key={option}
              onClick={() => select(option)}
              onKeyDown={handleKeyDown}
              ref={(el) => {
                buttonRefs.current[option - 1] = el;
              }}
              role="radio"
              tabIndex={isActive ? 0 : -1}
              type="button"
            >
              {option}
            </button>
          );
        })}
      </div>
      {hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
