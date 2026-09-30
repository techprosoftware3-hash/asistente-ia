create extension if not exists pgcrypto;

-- =========================================
-- EMPLOYEES
-- =========================================

create table public.employees (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references auth.users(id)
    on delete cascade
    not null,

  name text not null,
  role text not null,
  objective text not null,

  personality text,
  instructions text,

  rules jsonb not null default '[]'::jsonb,
  tools jsonb not null default '[]'::jsonb,

  status text not null default 'active',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- =========================================
-- MEMORIES
-- =========================================

create table public.memories (
  id uuid primary key default gen_random_uuid(),

  employee_id uuid
    references public.employees(id)
    on delete cascade
    not null,

  content text not null,

  type text not null default 'general',

  created_at timestamptz not null default now()
);


-- =========================================
-- MESSAGES
-- =========================================

create table public.messages (
  id uuid primary key default gen_random_uuid(),

  employee_id uuid
    references public.employees(id)
    on delete cascade
    not null,

  role text not null,

  content text not null,

  created_at timestamptz not null default now()
);


-- =========================================
-- TASKS
-- =========================================

create table public.tasks (
  id uuid primary key default gen_random_uuid(),

  employee_id uuid
    references public.employees(id)
    on delete cascade
    not null,

  title text not null,

  description text,

  status text not null default 'pending',

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()
);


-- =========================================
-- INDEXES
-- =========================================

create index employees_user_id_idx
on public.employees(user_id);

create index memories_employee_id_idx
on public.memories(employee_id);

create index messages_employee_id_idx
on public.messages(employee_id);

create index tasks_employee_id_idx
on public.tasks(employee_id);


-- =========================================
-- ROW LEVEL SECURITY
-- =========================================

alter table public.employees enable row level security;
alter table public.memories enable row level security;
alter table public.messages enable row level security;
alter table public.tasks enable row level security;


-- =========================================
-- EMPLOYEES POLICIES
-- =========================================

create policy "Users can view own employees"
on public.employees
for select
using (
  auth.uid() = user_id
);


create policy "Users can create own employees"
on public.employees
for insert
with check (
  auth.uid() = user_id
);


create policy "Users can update own employees"
on public.employees
for update
using (
  auth.uid() = user_id
);


create policy "Users can delete own employees"
on public.employees
for delete
using (
  auth.uid() = user_id
);


-- =========================================
-- MEMORIES POLICIES
-- =========================================

create policy "Users can view own memories"
on public.memories
for select
using (
  exists (
    select 1
    from public.employees
    where employees.id = memories.employee_id
    and employees.user_id = auth.uid()
  )
);


create policy "Users can create own memories"
on public.memories
for insert
with check (
  exists (
    select 1
    from public.employees
    where employees.id = memories.employee_id
    and employees.user_id = auth.uid()
  )
);


create policy "Users can delete own memories"
on public.memories
for delete
using (
  exists (
    select 1
    from public.employees
    where employees.id = memories.employee_id
    and employees.user_id = auth.uid()
  )
);


-- =========================================
-- MESSAGES POLICIES
-- =========================================

create policy "Users can view own messages"
on public.messages
for select
using (
  exists (
    select 1
    from public.employees
    where employees.id = messages.employee_id
    and employees.user_id = auth.uid()
  )
);


create policy "Users can create own messages"
on public.messages
for insert
with check (
  exists (
    select 1
    from public.employees
    where employees.id = messages.employee_id
    and employees.user_id = auth.uid()
  )
);


-- =========================================
-- TASKS POLICIES
-- =========================================

create policy "Users can view own tasks"
on public.tasks
for select
using (
  exists (
    select 1
    from public.employees
    where employees.id = tasks.employee_id
    and employees.user_id = auth.uid()
  )
);


create policy "Users can create own tasks"
on public.tasks
for insert
with check (
  exists (
    select 1
    from public.employees
    where employees.id = tasks.employee_id
    and employees.user_id = auth.uid()
  )
);


create policy "Users can update own tasks"
on public.tasks
for update
using (
  exists (
    select 1
    from public.employees
    where employees.id = tasks.employee_id
    and employees.user_id = auth.uid()
  )
);


create policy "Users can delete own tasks"
on public.tasks
for delete
using (
  exists (
    select 1
    from public.employees
    where employees.id = tasks.employee_id
    and employees.user_id = auth.uid()
  )
);