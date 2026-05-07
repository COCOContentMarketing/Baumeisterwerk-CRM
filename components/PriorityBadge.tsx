import type { Priority } from "@/types/db";

const styles: Record<Priority, string> = {
  hoch: "bg-red-100 text-red-800",
  mittel: "bg-amber-100 text-amber-800",
  niedrig: "bg-slate-100 text-slate-700",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`chip ${styles[priority]}`}>{priority}</span>;
}
