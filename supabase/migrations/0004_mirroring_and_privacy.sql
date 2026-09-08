-- ============================================================
-- Sparagnare — mirroring nel portafoglio condiviso e privacy
-- Esegui questo file nel SQL Editor di Supabase (o via CLI:
-- supabase db push) DOPO 0003_savings_and_transfers.sql
-- ============================================================

-- ---------- WALLET_MEMBERS: opt-in al mirroring ----------
-- Un membro di un portafoglio condiviso puo' scegliere, in qualsiasi
-- momento, se le proprie entrate/uscite/trasferimenti personali
-- vengano "rispecchiate" (mirror) in questo portafoglio condiviso.
alter table public.wallet_members
  add column mirror_enabled boolean not null default false;

-- ---------- TRANSACTIONS: privacy e collegamento al mirror ----------
-- is_private: se true, la transazione rispecchiata nel portafoglio
-- condiviso mostra l'importo ma con categoria generica "Altro" invece
-- della categoria reale (la descrizione non e' MAI mostrata nel mirror).
-- mirror_of_id: collega la riga "mirror" (nel portafoglio condiviso)
-- alla transazione originale (nel portafoglio personale). ON DELETE
-- CASCADE come rete di sicurezza a livello DB; l'eliminazione esplicita
-- del mirror e' comunque gestita anche lato applicazione.
alter table public.transactions
  add column is_private boolean not null default false,
  add column mirror_of_id uuid references public.transactions(id) on delete cascade;

create index transactions_mirror_of_idx
  on public.transactions (mirror_of_id)
  where mirror_of_id is not null;

-- Imposta la propria preferenza di mirroring per un portafoglio condiviso.
-- SECURITY DEFINER e limitata alla sola colonna mirror_enabled della
-- riga dell'utente stesso, cosi' un membro non puo' alterare il proprio
-- ruolo (owner/member) ne' quello di altri tramite una UPDATE generica.
create or replace function public.set_mirror_enabled(p_wallet_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
as $$
begin
  update public.wallet_members
  set mirror_enabled = p_enabled
  where wallet_id = p_wallet_id and user_id = auth.uid();
end;
$$;

grant execute on function public.set_mirror_enabled(uuid, boolean) to authenticated;
