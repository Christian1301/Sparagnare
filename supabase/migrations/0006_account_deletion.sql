-- ============================================================
-- Sparagnare — cancellazione account
-- Esegui questo file nel SQL Editor di Supabase (o via CLI:
-- supabase db push) DOPO 0005_split_expenses.sql
-- ============================================================

-- Elimina in modo permanente l'utente che chiama la funzione e tutti
-- i suoi dati. SECURITY DEFINER perche' l'eliminazione da auth.users
-- richiede privilegi che l'utente autenticato normalmente non ha.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
as $$
begin
  -- Evita violazioni di foreign key sulle transazioni create
  -- dall'utente in portafogli condivisi altrui (created_by non ha
  -- "on delete cascade" verso profiles).
  update public.transactions set created_by = null where created_by = auth.uid();

  -- Elimina tutti i portafogli di proprieta' dell'utente (personali e
  -- condivisi). Categorie, transazioni e appartenenze collegate
  -- vengono rimosse a cascata tramite i vincoli su wallet_id. Se
  -- l'utente possiede un portafoglio condiviso, viene eliminato anche
  -- per gli altri membri (stesso comportamento della cancellazione
  -- manuale di un portafoglio da parte del proprietario).
  delete from public.wallets where owner_id = auth.uid();

  -- Elimina l'utente: la riga in profiles e le appartenenze rimaste
  -- (portafogli condivisi altrui di cui l'utente era membro) vengono
  -- rimosse a cascata.
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_own_account() to authenticated;
