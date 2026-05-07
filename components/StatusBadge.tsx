import { COMPANY_STATUS_LABELS, type CompanyStatus } from "@/types/db";

const styles: Record<CompanyStatus, string> = {
  lead: "bg-slate-100 text-slate-800",
  kontaktiert: "bg-blue-100 text-blue-800",
  in_gespraech: "bg-indigo-100 text-indigo-800",
  kunde: "bg-emerald-100 text-emerald-800",
  pausiert: "bg-amber-100 text-amber-800",
  verloren: "bg-rose-100 text-rose-800",
};

export function StatusBadge({ status }: { status: CompanyStatus }) {
  return <span className={`chip ${styles[status]}`}>{COMPANY_STATUS_LABELS[status]}</span>;
}
