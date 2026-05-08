import type { CoachMessageCategory } from "@/lib/types";

export const coachMessageCategoryLabel: Record<CoachMessageCategory, string> = {
  training_goal: "Trainingsziel",
  match_goal: "Spielziel",
  note: "Notiz",
  praise: "Lob"
};

export const coachMessageCategoryAccent: Record<CoachMessageCategory, string> = {
  training_goal: "border-emerald-300 bg-emerald-50 text-emerald-900",
  match_goal: "border-amber-300 bg-amber-50 text-amber-900",
  note: "border-slate-300 bg-slate-50 text-slate-900",
  praise: "border-violet-300 bg-violet-50 text-violet-900"
};

export const coachMessageCategoryEmoji: Record<CoachMessageCategory, string> = {
  training_goal: "🎯",
  match_goal: "⚽️",
  note: "📝",
  praise: "🏆"
};
