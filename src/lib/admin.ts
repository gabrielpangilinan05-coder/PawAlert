import { cache } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, type User } from "@/lib/auth";
import { getPool } from "@/lib/db";

export type AdminUser = User & { role: "user" | "admin" };

function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function emailIsAdmin(email: string): boolean {
  return adminEmails().has(email.trim().toLowerCase());
}

export function userIsAdmin(user: Pick<User, "email" | "role">): boolean {
  return user.role === "admin" || emailIsAdmin(user.email);
}

/** Ensure ADMIN_EMAILS bootstrap is persisted as role=admin (once). */
async function syncAdminRole(user: AdminUser): Promise<void> {
  if (user.role === "admin") return;
  if (!emailIsAdmin(user.email)) return;
  const pool = getPool();
  await pool.execute(`UPDATE users SET role = 'admin' WHERE id = ? AND role <> 'admin'`, [user.id]);
  user.role = "admin";
}

export const getAdminUser = cache(async (): Promise<AdminUser | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!userIsAdmin(user)) return null;
  const admin = user as AdminUser;
  await syncAdminRole(admin);
  return admin;
});

export async function requireAdminPage(): Promise<AdminUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!userIsAdmin(user)) redirect("/");
  const admin = user as AdminUser;
  await syncAdminRole(admin);
  return admin;
}

export async function requireAdminApi(): Promise<AdminUser | null> {
  return getAdminUser();
}
