import { redirect } from "next/navigation";

export const metadata = { title: "Dashboard" };

/** Dashboard merged into Profile — keep URL for old bookmarks/links. */
export default function DashboardPage() {
  redirect("/profile");
}
