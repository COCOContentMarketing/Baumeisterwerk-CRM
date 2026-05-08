import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface EmailTemplate {
  id: string;
  name: string;
  language: "de" | "en";
  use_case: string;
  target_company_type: string | null;
  subject_template: string | null;
  body_template: string;
  ai_guidance: string | null;
  is_active: boolean;
}

// Findet die passendste Template-Vorlage fuer eine Email-Generierung.
// Suchstrategie:
//   1) exakter Name (use_case) + company_type
//   2) Name (use_case) ohne company_type
//   3) "anschreiben_generic_<usecase>" als Fallback
export async function findTemplate(args: {
  useCase: string;
  companyType?: string | null;
  language?: "de" | "en";
}): Promise<EmailTemplate | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("email_templates")
    .select("*")
    .eq("is_active", true)
    .eq("language", args.language ?? "de");
  if (error) throw error;
  const list = (data ?? []) as EmailTemplate[];
  if (list.length === 0) return null;

  const exact = list.find(
    (t) => t.use_case === args.useCase && t.target_company_type === (args.companyType ?? null),
  );
  if (exact) return exact;
  const byUseCase = list.find((t) => t.use_case === args.useCase);
  if (byUseCase) return byUseCase;
  return null;
}

export async function findTemplateByName(name: string): Promise<EmailTemplate | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("email_templates")
    .select("*")
    .eq("name", name)
    .maybeSingle();
  if (error) throw error;
  return (data as EmailTemplate | null) ?? null;
}
