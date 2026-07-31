"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveTeam } from "@/lib/auth";
import { db } from "@/lib/db";

const feedbackCategories = new Set(["idea", "problem", "praise", "other"]);

export async function submitProductFeedback(formData: FormData) {
  const { user, team } = await requireActiveTeam();
  const categoryValue = formData.get("category");
  const messageValue = formData.get("message");
  const ratingValue = Number(formData.get("rating"));
  const pagePathValue = formData.get("pagePath");

  const category =
    typeof categoryValue === "string" && feedbackCategories.has(categoryValue)
      ? categoryValue
      : "other";
  const message = typeof messageValue === "string" ? messageValue.trim() : "";
  const pagePath = typeof pagePathValue === "string" ? pagePathValue.trim().slice(0, 500) : null;
  const rating = Number.isInteger(ratingValue) && ratingValue >= 1 && ratingValue <= 5 ? ratingValue : null;

  if (message.length < 10) throw new Error("Bitte beschreibe dein Feedback in mindestens 10 Zeichen.");
  if (message.length > 4000) throw new Error("Das Feedback darf maximal 4000 Zeichen lang sein.");

  await db.productFeedback.create({
    data: {
      workspaceId: team.id,
      userId: user.id,
      category,
      rating,
      message,
      pagePath: pagePath || null
    }
  });

  revalidatePath("/feedback");
  redirect("/feedback?sent=1");
}
