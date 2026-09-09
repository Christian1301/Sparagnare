-- Funzione temporanea di debug: restituisce cosa vede il database come
-- utente autenticato (auth.uid()) nella richiesta corrente. Sola lettura,
-- nessun privilegio elevato. Da rimuovere una volta risolto il problema.
create or replace function public.whoami()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;
