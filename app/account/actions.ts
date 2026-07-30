"use server";

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireUser, signOut } from "@/lib/auth";
import { getStripeClient } from "@/lib/stripe";

export async function deleteCoachAccount(formData: FormData) {
  const { user } = await requireUser();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (email !== user.email.toLowerCase() || password.length > 128) {
    throw new Error("E-Mail-Adresse oder Passwort ist nicht korrekt.");
  }

  const account = await db.user.findUnique({
    where: { id: user.id },
    select: {
      passwordHash: true,
      stripeCustomerId: true,
      stripeSubscriptionStatus: true,
      _count: {
        select: {
          workspaces: {
            where: { role: "OWNER" }
          }
        }
      }
    }
  });
  if (!account || !(await bcrypt.compare(password, account.passwordHash))) {
    throw new Error("E-Mail-Adresse oder Passwort ist nicht korrekt.");
  }
  if (account._count.workspaces > 0) {
    throw new Error(
      "Lösche oder übertrage zuerst alle Workspaces, die du besitzt. So werden auch private Medien korrekt bereinigt."
    );
  }
  if (
    ["active", "trialing", "past_due"].includes(
      account.stripeSubscriptionStatus ?? ""
    )
  ) {
    throw new Error(
      "Beende zuerst das aktive Abonnement im Kundenportal."
    );
  }

  if (account.stripeCustomerId) {
    await getStripeClient().customers.del(account.stripeCustomerId);
  }
  await db.user.delete({ where: { id: user.id } });
  await signOut({ redirectTo: "/login?account=deleted" });
}
