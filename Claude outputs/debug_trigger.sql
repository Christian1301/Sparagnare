-- TEST TEMPORANEO: intercetta l'inserimento su wallets e mostra i
-- valori esatti visti dal database in quel preciso istante.
-- Blocca la creazione di portafogli finche' non lo rimuovi (vedi sotto).
create or replace function public.debug_wallet_insert()
returns trigger
language plpgsql
as $$
begin
  raise exception 'DEBUG: auth.uid()=% owner_id=% is_shared=% role=%',
    auth.uid(), new.owner_id, new.is_shared, current_setting('request.jwt.claim.role', true);
end;
$$;

create trigger debug_before_wallet_insert
  before insert on public.wallets
  for each row execute procedure public.debug_wallet_insert();
