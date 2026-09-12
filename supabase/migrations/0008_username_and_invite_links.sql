-- ============================================================
-- Username univoco + inviti nei portafogli condivisi via username
-- o tramite link condivisibile.
-- ============================================================

-- ---------- PROFILES: username ----------
alter table public.profiles add column username text;

alter table public.profiles add constraint username_format
  check (username is null or username ~ '^[a-z0-9_]{3,20}$');

create unique index profiles_username_unique_idx on public.profiles (username);

-- Backfill: assegna uno username di default (ricavato dall'email) a chi
-- non ce l'ha ancora, gestendo le collisioni con un suffisso numerico.
do $$
declare
  r record;
  base_username text;
  candidate_username text;
  suffix int;
begin
  for r in select id, email from public.profiles where username is null loop
    base_username := regexp_replace(lower(split_part(r.email, '@', 1)), '[^a-z0-9_]', '', 'g');
    if base_username = '' then base_username := 'utente'; end if;
    base_username := left(base_username, 17);
    if length(base_username) < 3 then base_username := rpad(base_username, 3, '0'); end if;

    candidate_username := base_username;
    suffix := 0;
    loop
      begin
        update public.profiles set username = candidate_username where id = r.id;
        exit;
      exception when unique_violation then
        suffix := suffix + 1;
        candidate_username := left(base_username, 17) || '_' || suffix::text;
      end;
    end loop;
  end loop;
end $$;

alter table public.profiles alter column username set not null;

-- lookup sicuro per invitare qualcuno via username senza esporre
-- l'intera tabella profiles (stesso pattern di get_user_id_by_email)
create function public.get_user_id_by_username(lookup_username text)
returns uuid as $$
  select id from public.profiles where username = lower(lookup_username);
$$ language sql security definer stable;

-- Da qui in poi ogni nuovo utente riceve subito uno username di default
-- (derivato dall'email, con la stessa logica del backfill sopra).
create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_profile_id uuid;
  base_username text;
  candidate_username text;
  suffix int := 0;
begin
  base_username := regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9_]', '', 'g');
  if base_username = '' then base_username := 'utente'; end if;
  base_username := left(base_username, 17);
  if length(base_username) < 3 then base_username := rpad(base_username, 3, '0'); end if;
  candidate_username := base_username;

  loop
    begin
      insert into public.profiles (id, email, display_name, username)
      values (new.id, new.email, split_part(new.email, '@', 1), candidate_username);
      exit;
    exception when unique_violation then
      suffix := suffix + 1;
      candidate_username := left(base_username, 17) || '_' || suffix::text;
    end;
  end loop;

  insert into public.wallets (owner_id, name, is_shared)
  values (new.id, 'Personale', false);

  return new;
end;
$$ language plpgsql security definer;

-- ---------- WALLET INVITES (link condivisibile) ----------
create table public.wallet_invites (
  id uuid default gen_random_uuid() primary key,
  wallet_id uuid references public.wallets(id) on delete cascade not null,
  token text unique not null default replace(gen_random_uuid()::text, '-', ''),
  created_by uuid references public.profiles(id) not null,
  created_at timestamptz default now(),
  expires_at timestamptz,
  revoked boolean default false not null
);

-- un solo link attivo per portafoglio alla volta
create unique index wallet_invites_one_active_idx on public.wallet_invites (wallet_id) where not revoked;

alter table public.wallet_invites enable row level security;

create policy "owner can view invites"
  on public.wallet_invites for select
  using (exists (select 1 from public.wallets w where w.id = wallet_id and w.owner_id = auth.uid()));

create policy "owner can create invites"
  on public.wallet_invites for insert
  with check (
    created_by = auth.uid()
    and exists (select 1 from public.wallets w where w.id = wallet_id and w.owner_id = auth.uid())
  );

create policy "owner can revoke invites"
  on public.wallet_invites for update
  using (exists (select 1 from public.wallets w where w.id = wallet_id and w.owner_id = auth.uid()));

create policy "owner can delete invites"
  on public.wallet_invites for delete
  using (exists (select 1 from public.wallets w where w.id = wallet_id and w.owner_id = auth.uid()));

-- Anteprima pubblica di un invito dato il token (usata dalla pagina
-- /invite/[token] anche per chi non ha ancora effettuato l'accesso).
-- SECURITY DEFINER: espone solo la riga che corrisponde ESATTAMENTE
-- al token passato (non enumerabile), mai l'elenco degli inviti.
create function public.get_wallet_invite(p_token text)
returns table(wallet_id uuid, wallet_name text, is_shared boolean, revoked boolean, expires_at timestamptz)
language sql
security definer
stable
as $$
  select w.id, w.name, w.is_shared, wi.revoked, wi.expires_at
  from public.wallet_invites wi
  join public.wallets w on w.id = wi.wallet_id
  where wi.token = p_token;
$$;

-- Accetta un invito: aggiunge l'utente autenticato come membro del
-- portafoglio corrispondente al token. SECURITY DEFINER perche' chi
-- accetta non e' ancora membro (e quindi non potrebbe altrimenti
-- inserire la propria riga in wallet_members).
create function public.join_wallet_via_invite(p_token text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_wallet_id uuid;
  v_revoked boolean;
  v_expires_at timestamptz;
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Non autenticato';
  end if;

  select wallet_id, revoked, expires_at into v_wallet_id, v_revoked, v_expires_at
  from public.wallet_invites
  where token = p_token;

  if v_wallet_id is null then
    raise exception 'Link di invito non valido';
  end if;
  if v_revoked then
    raise exception 'Questo link di invito e'' stato revocato';
  end if;
  if v_expires_at is not null and v_expires_at < now() then
    raise exception 'Questo link di invito e'' scaduto';
  end if;

  insert into public.wallet_members (wallet_id, user_id, role)
  values (v_wallet_id, v_user_id, 'member')
  on conflict (wallet_id, user_id) do nothing;

  return v_wallet_id;
end;
$$;

NOTIFY pgrst, 'reload schema';
