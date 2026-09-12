-- Aggira il comportamento anomalo di "owner_id = auth.uid()" nel
-- controllo RLS: invece di confrontare owner_id con auth.uid() nella
-- policy, lo impostiamo forzatamente con un trigger PRIMA
-- dell'inserimento. Il client non puo' piu' specificare owner_id di
-- un altro utente (viene sempre sovrascritto), e la policy si limita
-- a verificare che tu sia autenticato.
create or replace function public.set_wallet_owner()
returns trigger
language plpgsql
as $$
begin
  new.owner_id := auth.uid();
  return new;
end;
$$;

create trigger before_wallet_insert_set_owner
  before insert on public.wallets
  for each row execute procedure public.set_wallet_owner();

drop policy "owner can insert wallet" on public.wallets;
create policy "owner can insert wallet" on public.wallets
  for insert
  with check (auth.uid() is not null);

NOTIFY pgrst, 'reload schema';
