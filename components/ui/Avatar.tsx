export function Avatar({ name, src, size = "md" }: { name: string; src?: string | null; size?: "sm" | "md" | "lg" }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const sizes = { sm: "h-8 w-8 text-xs", md: "h-11 w-11 text-sm", lg: "h-16 w-16 text-lg" };
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full ${sizes[size]}`} style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}>
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initials || "?"}
    </div>
  );
}
