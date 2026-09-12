import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Dashboard from "@/components/Dashboard";

export default async function AppPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("wallet_members")
    .select("role, wallets(id, name, is_shared, owner_id, kind)")
    .eq("user_id", user.id);

  function walletOrder(w: any) {
    // principale (0) prima, poi i conti di risparmio (1), poi i condivisi (2)
    if (w.is_shared) return 2;
    return w.kind === "risparmio" ? 1 : 0;
  }

  const wallets = (memberships || [])
    .map((m: any) => ({ ...m.wallets, role: m.role }))
    .filter(Boolean)
    .sort((a: any, b: any) => walletOrder(a) - walletOrder(b));

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", user.id)
    .single();

  return (
    <Dashboard
      wallets={wallets}
      userId={user.id}
      userEmail={user.email ?? ""}
      userDisplayName={profile?.display_name ?? ""}
      userUsername={profile?.username ?? ""}
    />
  );
}
