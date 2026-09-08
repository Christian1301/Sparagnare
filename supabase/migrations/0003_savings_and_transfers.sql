-- ============================================================
-- Sparagnare — conti di risparmio e trasferimenti tra conti propri
-- Esegui questo file nel SQL Editor di Supabase (o via CLI:
-- supabase db push) DOPO 0002_shared_visibility_and_wallet_membership.sql
-- ============================================================

-- ---------- WALLETS: tipo di conto ----------
-- 'principale' = il portafoglio personale principale (o un condiviso);
-- 'risparmio'  = un conto di risparmio/asset personale, non condivisibile.
alter table public.wallets
  add column kind text not null default 'principale' check (kind in ('principale', 'risparmio'));

-- ---------- TRANSACTIONS: trasferimenti tra conti propri ----------
-- Un trasferimento e' rappresentato da due righe (una per conto),
-- collegate da transfer_group_id, ciascuna con un riferimento al
-- conto "gemello" per poterlo mostrare nell'interfaccia.
alter table public.transactions
  add column is_transfer boolean not null default false,
  add column transfer_group_id uuid,
  add column transfer_peer_wallet_id uuid references public.wallets(id);

create index transactions_transfer_group_idx
  on public.transactions (transfer_group_id)
  where transfer_group_id is not null;
