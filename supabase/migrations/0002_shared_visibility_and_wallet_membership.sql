-- ============================================================
-- Bilancio Personale — visibilita' profili condivisi e gestione
-- membership dei portafogli
-- Esegui questo file nel SQL Editor di Supabase (o via CLI:
-- supabase db push) DOPO 0001_init.sql
-- ============================================================

-- ---------- PROFILES: visibilita' tra membri dello stesso wallet ----------
-- La policy "user can view own profile" di 0001 impedisce a un membro di
-- un portafoglio condiviso di vedere nome/email degli altri membri: la
-- lista "Persone con accesso" risultava vuota per chiunque non fosse se
-- stesso. Questa funzione (security definer, come is_wallet_member) e la
-- policy che la usa risolvono il problema.

create function public.shares_wallet_with(target_user_id uuid)
returns boolean as $$
  select exists (
    select 1
    from public.wallet_members wm1
    join public.wallet_members wm2 on wm1.wallet_id = wm2.wallet_id
    where wm1.user_id = auth.uid()
      and wm2.user_id = target_user_id
  );
$$ language sql security definer stable;

create policy "members can view co-members profiles"
  on public.profiles for select
  using (public.shares_wallet_with(id));

-- ---------- WALLET_MEMBERS: un membro puo' uscire da un portafoglio ----------
-- Finora solo il proprietario poteva rimuovere membri. Un membro non
-- proprietario deve poter rimuovere la propria riga (uscire dal
-- portafoglio condiviso). Il proprietario non puo' "uscire": deve
-- eliminare il portafoglio (policy "owner can delete wallet" di 0001,
-- che elimina a cascata anche wallet_members).

create policy "member can leave shared wallet"
  on public.wallet_members for delete
  using (user_id = auth.uid() and role <> 'owner');

-- ---------- CATEGORIES: niente nomi duplicati nello stesso portafoglio ----------
create unique index categories_wallet_name_unique
  on public.categories (wallet_id, lower(name));
