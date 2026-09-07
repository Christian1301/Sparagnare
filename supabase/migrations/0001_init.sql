-- ============================================================
-- Bilancio Personale — schema iniziale
-- Esegui questo file nel SQL Editor di Supabase (o via CLI:
-- supabase db push)
-- ============================================================

-- ---------- PROFILES ----------
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  display_name text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "user can view own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "user can update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- lookup sicuro per invitare qualcuno via email senza esporre
-- l'intera tabella profiles
create function public.get_user_id_by_email(lookup_email text)
returns uuid as $$
  select id from public.profiles where email = lookup_email;
$$ language sql security definer stable;

-- ---------- WALLETS ----------
create table public.wallets (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references public.profiles(id) not null,
  name text not null,
  is_shared boolean default false,
  created_at timestamptz default now()
);

create function public.is_wallet_member(wallet uuid)
returns boolean as $$
  select exists (
    select 1 from public.wallet_members
    where wallet_id = wallet and user_id = auth.uid()
  );
$$ language sql security definer stable;

alter table public.wallets enable row level security;

create policy "members can view wallet"
  on public.wallets for select
  using (public.is_wallet_member(id));

create policy "owner can insert wallet"
  on public.wallets for insert
  with check (owner_id = auth.uid());

create policy "owner can update wallet"
  on public.wallets for update
  using (owner_id = auth.uid());

create policy "owner can delete wallet"
  on public.wallets for delete
  using (owner_id = auth.uid());

-- ---------- WALLET MEMBERS ----------
create table public.wallet_members (
  wallet_id uuid references public.wallets(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz default now(),
  primary key (wallet_id, user_id)
);

alter table public.wallet_members enable row level security;

create policy "members can view membership"
  on public.wallet_members for select
  using (public.is_wallet_member(wallet_id));

create policy "owner can add members"
  on public.wallet_members for insert
  with check (
    exists (select 1 from public.wallets w where w.id = wallet_id and w.owner_id = auth.uid())
  );

create policy "owner can remove members"
  on public.wallet_members for delete
  using (
    exists (select 1 from public.wallets w where w.id = wallet_id and w.owner_id = auth.uid())
  );

-- ---------- CATEGORIES ----------
create table public.categories (
  id uuid default gen_random_uuid() primary key,
  wallet_id uuid references public.wallets(id) on delete cascade not null,
  name text not null,
  color text not null default '#5B6B73'
);

alter table public.categories enable row level security;

create policy "members can view categories"
  on public.categories for select
  using (public.is_wallet_member(wallet_id));

create policy "members can insert categories"
  on public.categories for insert
  with check (public.is_wallet_member(wallet_id));

create policy "members can update categories"
  on public.categories for update
  using (public.is_wallet_member(wallet_id));

create policy "members can delete categories"
  on public.categories for delete
  using (public.is_wallet_member(wallet_id));

-- ---------- TRANSACTIONS ----------
create table public.transactions (
  id uuid default gen_random_uuid() primary key,
  wallet_id uuid references public.wallets(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete set null,
  type text not null check (type in ('income', 'expense')),
  amount numeric(12, 2) not null check (amount > 0),
  description text,
  date date not null,
  is_recurring boolean default false,
  recurring_end_date date,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

alter table public.transactions enable row level security;

create policy "members can view transactions"
  on public.transactions for select
  using (public.is_wallet_member(wallet_id));

create policy "members can insert transactions"
  on public.transactions for insert
  with check (public.is_wallet_member(wallet_id));

create policy "members can update transactions"
  on public.transactions for update
  using (public.is_wallet_member(wallet_id));

create policy "members can delete transactions"
  on public.transactions for delete
  using (public.is_wallet_member(wallet_id));

-- ---------- AUTOMAZIONI ----------

-- quando un wallet viene creato: aggiungi il proprietario come
-- membro e crea le categorie di default
create function public.handle_new_wallet()
returns trigger as $$
begin
  insert into public.wallet_members (wallet_id, user_id, role)
  values (new.id, new.owner_id, 'owner');

  insert into public.categories (wallet_id, name, color) values
    (new.id, 'Casa', '#8B5E3C'),
    (new.id, 'Utenze', '#3F6C87'),
    (new.id, 'Spesa', '#2F6F62'),
    (new.id, 'Trasporti', '#C9A227'),
    (new.id, 'Svago', '#6B5B95'),
    (new.id, 'Salute', '#B5473D'),
    (new.id, 'Altro', '#5B6B73');

  return new;
end;
$$ language plpgsql security definer;

create trigger on_wallet_created
  after insert on public.wallets
  for each row execute procedure public.handle_new_wallet();

-- quando un utente si registra: crea il profilo e un wallet
-- "Personale" di default
create function public.handle_new_user()
returns trigger as $$
declare
  new_profile_id uuid;
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1));

  insert into public.wallets (owner_id, name, is_shared)
  values (new.id, 'Personale', false);

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
