"use client";

type LuminousAvatarProps = {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

function initialsFor(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";
}

export function LuminousAvatar({ name, photoUrl, size = "md", className = "" }: LuminousAvatarProps) {
  const sizes = { sm: 32, md: 44, lg: 64 };
  const px = sizes[size];
  return (
    <span
      className={`luminous-avatar ${className}`}
      role="img"
      aria-label={name ? `${name} avatar` : "User avatar"}
      style={{ width: px, height: px }}
    >
      <span className="luminous-avatar-back" aria-hidden="true" />
      {photoUrl ? (
        <img src={photoUrl} alt="" className="luminous-avatar-image" />
      ) : (
        <span className="luminous-avatar-initials" aria-hidden="true">{initialsFor(name)}</span>
      )}
    </span>
  );
}
