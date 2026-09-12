-- TEST TEMPORANEO 2: mostra il risultato ESATTO del confronto usato
-- dalla policy, con lunghezza delle stringhe per scovare differenze
-- invisibili (spazi, encoding). Blocca la creazione di portafogli
-- finche' non lo rimuovi (vedi query di pulizia in fondo).
create or replace function public.debug_wallet_insert()
returns trigger
language plpgsql
as $$
begin
  raise exception 'DEBUG: uid=[%] owner=[%] equal=% uid_len=% owner_len=% uid_type=% owner_type=%',
    auth.uid(), new.owner_id,
    (new.owner_id = auth.uid()),
    length(auth.uid()::text),
    length(new.owner_id::text),
    pg_typeof(auth.uid()),
    pg_typeof(new.owner_id);
end;
$$;

create trigger debug_before_wallet_insert
  before insert on public.wallets
  for each row execute procedure public.debug_wallet_insert();

-- Pulizia (esegui SUBITO dopo aver testato una volta nell'app):
-- drop trigger debug_before_wallet_insert on public.wallets;
-- drop function public.debug_wallet_insert();
