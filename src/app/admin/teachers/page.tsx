import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/database.types";
import { TeachersClient } from "./TeachersClient";

export default async function AdminTeachersPage() {
  const me = await requireAdmin();
  const supabase = await createClient();

  const { data: profiles } = await supabase.from("profiles").select("*").order("created_at");

  return <TeachersClient currentUserId={me.id} initialProfiles={(profiles ?? []) as Profile[]} />;
}
