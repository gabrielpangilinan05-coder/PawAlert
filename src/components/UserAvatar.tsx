import { mediaUrl } from "@/lib/media";
import { userInitial } from "@/lib/format";

export function UserAvatar({
  name,
  src,
  size = "md",
  className = "",
}: {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const url = mediaUrl(src);
  const sizeClass =
    size === "sm" ? "small" : size === "lg" ? "lg" : size === "xl" ? "xl" : "";
  const classes = ["composer-avatar", sizeClass, className].filter(Boolean).join(" ");

  if (url) {
    return (
      <div className={`${classes} composer-avatar--photo`} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" />
      </div>
    );
  }

  return <div className={classes}>{userInitial(name || "?")}</div>;
}
