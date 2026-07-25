export type ShareKind = "missing" | "found" | "post";

export function postShareKind(type: string, status: string): ShareKind {
  if (type === "missing") return status === "resolved" ? "found" : "missing";
  if (type === "found") return "found";
  return "post";
}
