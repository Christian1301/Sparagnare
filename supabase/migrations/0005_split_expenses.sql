-- ============================================================
-- Sparagnare — spese cointestate a percentuale
-- Esegui questo file nel SQL Editor di Supabase (o via CLI:
-- supabase db push) DOPO 0004_mirroring_and_privacy.sql
-- ============================================================

alter table public.transactions
  add column split_group_id uuid;

create index transactions_split_group_idx
  on public.transactions (split_group_id)
  where split_group_id is not null;

-- Crea una spesa cointestata: una riga nel portafoglio condiviso con
-- l'importo totale, piu' una riga di addebito nel portafoglio
-- "principale" di ciascun membro secondo la percentuale indicata.
-- SECURITY DEFINER perche' chi aggiunge la spesa in genere non e'
-- membro del portafoglio "principale" altrui (serve per scrivere li').
create or replace function public.create_split_expense(
  p_wallet_id uuid,
  p_category_id uuid,
  p_amount numeric,
  p_description text,
  p_date date,
  p_shares jsonb -- [{ "user_id": "...", "percent": 50 }, ...]
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_group_id uuid := gen_random_uuid();
  v_share jsonb;
  v_user_id uuid;
  v_percent numeric;
  v_total_percent numeric := 0;
  v_member_wallet_id uuid;
begin
  if not public.is_wallet_member(p_wallet_id) then
    raise exception 'Non sei membro di questo portafoglio.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Importo non valido.';
  end if;

  if p_shares is null or jsonb_array_length(p_shares) = 0 then
    raise exception 'Nessuna suddivisione specificata.';
  end if;

  for v_share in select * from jsonb_array_elements(p_shares) loop
    v_total_percent := v_total_percent + coalesce((v_share->>'percent')::numeric, 0);
  end loop;

  if abs(v_total_percent - 100) > 0.5 then
    raise exception 'Le percentuali devono sommare a 100.';
  end if;

  insert into public.transactions
    (wallet_id, type, amount, category_id, description, date, created_by, split_group_id)
  values
    (p_wallet_id, 'expense', p_amount, p_category_id, p_description, p_date, auth.uid(), v_group_id);

  for v_share in select * from jsonb_array_elements(p_shares) loop
    v_user_id := (v_share->>'user_id')::uuid;
    v_percent := (v_share->>'percent')::numeric;

    if not exists (
      select 1 from public.wallet_members
      where wallet_id = p_wallet_id and user_id = v_user_id
    ) then
      raise exception 'Un membro selezionato non fa parte di questo portafoglio.';
    end if;

    select id into v_member_wallet_id
    from public.wallets
    where owner_id = v_user_id and kind = 'principale' and is_shared = false
    limit 1;

    if v_member_wallet_id is null then
      raise exception 'Impossibile trovare il conto principale di un membro.';
    end if;

    insert into public.transactions
      (wallet_id, type, amount, category_id, description, date, created_by, split_group_id)
    values
      (v_member_wallet_id, 'expense', round(p_amount * v_percent / 100.0, 2), p_category_id,
       p_description, p_date, auth.uid(), v_group_id);
  end loop;

  return v_group_id;
end;
$$;

-- Elimina una spesa cointestata: rimuove la riga nel portafoglio
-- condiviso e tutte le quote nei conti principali dei membri.
create or replace function public.delete_split_expense(p_group_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_shared_wallet_id uuid;
begin
  select t.wallet_id into v_shared_wallet_id
  from public.transactions t
  join public.wallets w on w.id = t.wallet_id
  where t.split_group_id = p_group_id and w.is_shared = true
  limit 1;

  if v_shared_wallet_id is null then
    raise exception 'Spesa cointestata non trovata.';
  end if;

  if not public.is_wallet_member(v_shared_wallet_id) then
    raise exception 'Non sei autorizzato a eliminare questa spesa.';
  end if;

  delete from public.transactions where split_group_id = p_group_id;
end;
$$;

grant execute on function public.create_split_expense(uuid, uuid, numeric, text, date, jsonb) to authenticated;
grant execute on function public.delete_split_expense(uuid) to authenticated;
