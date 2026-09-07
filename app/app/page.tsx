import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Dashboard from "@/components/Dashboard";

export default async function AppPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("wallet_members")
    .select("role, wallets(id, name, is_shared, owner_id)")
    .eq("user_id", user.id);

  const wallets = (memberships || [])
    .map((m: any) => ({ ...m.wallets, role: m.role }))
    .filter(Boolean)
    .sort((a: any, b: any) => (a.is_shared === b.is_shared ? 0 : a.is_shared ? 1 : -1));

  return <Dashboard wallets={wallets} userId={user.id} userEmail={user.email ?? ""} />;
}
