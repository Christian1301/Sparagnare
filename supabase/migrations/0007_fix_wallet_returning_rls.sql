-- ============================================================
-- Fix: creazione di un portafoglio condiviso falliva sempre con
-- "new row violates row-level security policy for table wallets",
-- anche con owner_id corretto e utente autenticato correttamente.
--
-- Causa reale: in Postgres un INSERT ... RETURNING deve soddisfare
-- non solo la policy di INSERT (WITH CHECK) ma ANCHE la policy di
-- SELECT sulla riga appena inserita, perché RETURNING restituisce
-- la riga come se fosse letta. La policy "members can view wallet"
-- si basava su is_wallet_member(id), che dipende dalla riga inserita
-- da handle_new_wallet() (trigger AFTER INSERT su wallets) in
-- wallet_members: da dentro la stessa istruzione INSERT quella riga
-- non è ancora visibile al controllo della SELECT policy, quindi la
-- RETURNING falliva con lo stesso identico messaggio di errore di un
-- fallimento della policy di INSERT (i due casi sono indistinguibili
-- dal solo testo dell'errore).
--
-- Fix: il proprietario può sempre vedere il portafoglio che ha appena
-- creato, indipendentemente da wallet_members.
-- ============================================================

drop policy "members can view wallet" on public.wallets;
create policy "members can view wallet" on public.wallets
  for select
  using (owner_id = auth.uid() or public.is_wallet_member(id));

-- ---------------------------------------------------------------
-- Indurimento aggiuntivo (non la causa del bug, ma buona norma):
-- owner_id viene sempre impostato lato server con auth.uid(), cosi'
-- il client non puo' mai specificare un owner_id diverso dal proprio.
-- ---------------------------------------------------------------
create or replace function public.set_wallet_owner()
returns trigger
language plpgsql
as $$
begin
  new.owner_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists before_wallet_insert_set_owner on public.wallets;
create trigger before_wallet_insert_set_owner
  before insert on public.wallets
  for each row execute procedure public.set_wallet_owner();

drop policy "owner can insert wallet" on public.wallets;
create policy "owner can insert wallet" on public.wallets
  for insert
  with check (auth.uid() is not null);

-- ---------------------------------------------------------------
-- Pulizia funzioni di debug temporanee usate durante la diagnosi
-- (non piu' referenziate da nessun trigger o dal codice dell'app).
-- ---------------------------------------------------------------
drop function if exists public.debug_wallet_insert() cascade;
drop function if exists public.whoami();

NOTIFY pgrst, 'reload schema';
