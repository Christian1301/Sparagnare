"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
}

export async function addTransaction(input: {
  walletId: string;
  type: "income" | "expense";
  amount: number;
  categoryId: string | null;
  description: string;
  date: string;
  isRecurring: boolean;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato." };

  const { error } = await supabase.from("transactions").insert({
    wallet_id: input.walletId,
    type: input.type,
    amount: input.amount,
    category_id: input.type === "expense" ? input.categoryId : null,
    description: input.description || null,
    date: input.date,
    is_recurring: input.isRecurring,
    created_by: user.id,
  });

  if (error) return { error: error.message };
  revalidatePath("/app");
  return { error: null };
}

export async function stopRecurring(transactionId: string, endDate: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ recurring_end_date: endDate })
    .eq("id", transactionId);

  if (error) return { error: error.message };
  revalidatePath("/app");
  return { error: null };
}

export async function deleteTransaction(transactionId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("transactions").delete().eq("id", transactionId);
  if (error) return { error: error.message };
  revalidatePath("/app");
  return { error: null };
}

export async function addCategory(walletId: string, name: string, color: string) {
  const supabase = createClient();
  const { error } = await supabase.from("categories").insert({ wallet_id: walletId, name, color });
  if (error) {
    if (error.code === "23505") {
      return { error: "Esiste già una categoria con questo nome in questo portafoglio." };
    }
    return { error: error.message };
  }
  revalidatePath("/app");
  return { error: null };
}

export async function deleteCategory(categoryId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("categories").delete().eq("id", categoryId);
  if (error) {
    // violazione FK: la categoria è usata da almeno una transazione
    if (error.code === "23503") {
      return { error: "Non puoi eliminare una categoria usata da una transazione esistente." };
    }
    return { error: error.message };
  }
  revalidatePath("/app");
  return { error: null };
}

export async function createSharedWallet(name: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato." };

  const { data, error } = await supabase
    .from("wallets")
    .insert({ owner_id: user.id, name, is_shared: true })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/app");
  return { error: null, wallet: data };
}

export async function inviteMember(walletId: string, email: string) {
  const supabase = createClient();

  const { data: userId, error: lookupError } = await supabase.rpc("get_user_id_by_email", {
    lookup_email: email.trim().toLowerCase(),
  });

  if (lookupError) return { error: lookupError.message };
  if (!userId) {
    return { error: "Nessun utente registrato con questa email. Deve prima creare un account." };
  }

  const { error } = await supabase
    .from("wallet_members")
    .insert({ wallet_id: walletId, user_id: userId, role: "member" });

  if (error) {
    if (error.code === "23505") return { error: "Questa persona ha già accesso al portafoglio." };
    return { error: error.message };
  }

  revalidatePath("/app");
  return { error: null };
}

export async function removeMember(walletId: string, userId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("wallet_members")
    .delete()
    .eq("wallet_id", walletId)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  revalidatePath("/app");
  return { error: null };
}

export async function deleteWallet(walletId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("wallets").delete().eq("id", walletId);
  if (error) return { error: error.message };
  revalidatePath("/app");
  return { error: null };
}

export async function leaveWallet(walletId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato." };

  const { error } = await supabase
    .from("wallet_members")
    .delete()
    .eq("wallet_id", walletId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/app");
  return { error: null };
}
