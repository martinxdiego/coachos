import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { Workspace, WorkspaceMember } from "@prisma/client";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  clearLoginAttempts,
  getLoginThrottle,
  recordFailedLogin,
} from "./login-throttle";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // No PrismaAdapter: Credentials + JWT strategy does not need a database adapter.
  // The adapter caused CallbackRouteError because it tried to SELECT emailVerified
  // from our User model which does not have that field.
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string().min(1) })
          .safeParse(credentials);

        if (!parsedCredentials.success) return null;

        const { email, password } = parsedCredentials.data;
        const normalizedEmail = email.toLowerCase();

        // Block brute-force / credential-stuffing before touching the DB.
        const throttle = await getLoginThrottle(normalizedEmail);
        if (throttle.locked) {
          throw new Error(
            `Zu viele Fehlversuche. Bitte in ${Math.ceil(
              throttle.retryAfterSeconds / 60
            )} Minuten erneut versuchen.`
          );
        }

        try {
          const user = await db.user.findUnique({
            where: { email: normalizedEmail },
          });

          // Always run bcrypt.compare to keep timing constant whether or not the
          // user exists (mitigates user-enumeration via response time).
          const hash =
            user?.passwordHash ??
            "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu";
          const passwordsMatch = await bcrypt.compare(password, hash);

          if (!user || !passwordsMatch) {
            await recordFailedLogin(normalizedEmail);
            return null;
          }

          await clearLoginAttempts(normalizedEmail);
          return { id: user.id, email: user.email, name: user.name, role: user.role };
        } catch (err) {
          // Re-throw lockout signal; swallow everything else without logging PII.
          if (err instanceof Error && err.message.startsWith("Zu viele")) throw err;
          console.error("[auth] authorize error");
          return null;
        }
      },
    }),
  ],
});

export const ACTIVE_TEAM_COOKIE = "coachos-active-team";

export type TeamMembership = WorkspaceMember;

export interface ActiveTeamContext {
  team: Workspace;
  membership: WorkspaceMember;
}

export interface TeamOption {
  team: Workspace;
  membership: WorkspaceMember;
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return {
    user: {
      id: session.user.id!,
      email: session.user.email!,
      role: (session.user as any).role,
    },
  };
}

export async function getTeamOptionsForUser(userId: string): Promise<TeamOption[]> {
  const members = await db.workspaceMember.findMany({
    where: { userId },
    include: {
      workspace: true,
    },
  });

  return members.map((m) => {
    const { workspace, ...membership } = m;
    return { team: workspace, membership };
  });
}

export async function getActiveTeamForUser(userId: string) {
  const teamOptions = await getTeamOptionsForUser(userId);

  if (teamOptions.length === 0) {
    return { activeTeam: null, teamOptions };
  }

  const cookieStore = await cookies();
  const preferredTeamId = cookieStore.get(ACTIVE_TEAM_COOKIE)?.value;
  const activeTeam =
    teamOptions.find((option) => option.team.id === preferredTeamId) ??
    teamOptions[0];

  return { activeTeam, teamOptions };
}

export async function getOptionalActiveTeam() {
  const { user } = await requireUser();
  const { activeTeam, teamOptions } = await getActiveTeamForUser(user.id);

  return { user, activeTeam, teamOptions };
}

export async function requireActiveTeam() {
  const { user } = await requireUser();
  const { activeTeam, teamOptions } = await getActiveTeamForUser(user.id);

  if (!activeTeam) {
    redirect("/workspaces");
  }

  return {
    user,
    team: activeTeam.team,
    membership: activeTeam.membership,
    teamOptions,
  };
}
