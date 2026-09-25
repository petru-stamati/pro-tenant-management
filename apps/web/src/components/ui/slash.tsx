import { cn } from "@/lib/utils";

/**
 * The redesign's signature mark — a small skewed parallelogram used as an
 * active-nav marker, a prefix before card/section titles, a stepper
 * separator, kanban column heads, and (scaled way up via width/height) the
 * decorative background shapes on login/hero cards. See
 * design_handoff_protenant_redesign/README.md, "The slash".
 */
export function Slash({
  className,
  width = 4,
  height = 15,
}: {
  className?: string;
  width?: number;
  height?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block shrink-0 rounded-[1px] bg-primary", className)}
      style={{ width, height, transform: "skewX(-16deg)" }}
    />
  );
}
