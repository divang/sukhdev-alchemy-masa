-- Auth audit logging + profile auto-provisioning from auth.users.
-- This helps debug exactly where signup failed (Auth created, profile insert failed, etc.).

create table if not exists public.auth_audit_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null,
  stage text not null,
  status text not null default 'info' check (status in ('info', 'success', 'failure')),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.auth_audit_logs enable row level security;

revoke all on table public.auth_audit_logs from anon;
revoke all on table public.auth_audit_logs from authenticated;
grant select, insert, update, delete on table public.auth_audit_logs to service_role;

create index if not exists auth_audit_logs_created_at_idx on public.auth_audit_logs(created_at desc);
create index if not exists auth_audit_logs_kind_stage_idx on public.auth_audit_logs(kind, stage);
create index if not exists auth_audit_logs_user_id_idx on public.auth_audit_logs(user_id);
create index if not exists auth_audit_logs_email_idx on public.auth_audit_logs(email);

create or replace function public.log_auth_audit(
  p_kind text,
  p_stage text,
  p_status text default 'info',
  p_email text default null,
  p_user_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.auth_audit_logs (
    kind,
    stage,
    status,
    email,
    user_id,
    metadata,
    error_message
  )
  values (
    coalesce(nullif(trim(p_kind), ''), 'unknown'),
    coalesce(nullif(trim(p_stage), ''), 'unknown_stage'),
    case
      when p_status in ('info', 'success', 'failure') then p_status
      else 'info'
    end,
    nullif(trim(p_email), ''),
    p_user_id,
    coalesce(p_metadata, '{}'::jsonb),
    nullif(trim(p_error_message), '')
  );
end;
$$;

grant execute on function public.log_auth_audit(text, text, text, text, uuid, jsonb, text) to anon;
grant execute on function public.log_auth_audit(text, text, text, text, uuid, jsonb, text) to authenticated;
grant execute on function public.log_auth_audit(text, text, text, text, uuid, jsonb, text) to service_role;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  perform public.log_auth_audit(
    'db_trigger',
    'auth_user_created',
    'info',
    new.email,
    new.id,
    jsonb_build_object(
      'email_confirmed_at', new.email_confirmed_at,
      'created_at', new.created_at
    ),
    null
  );

  v_role := case
    when coalesce(new.raw_user_meta_data ->> 'role', 'customer') = 'admin' then 'admin'
    else 'customer'
  end;

  begin
    insert into public.profiles (
      id,
      email,
      full_name,
      phone,
      role,
      review_opt_in,
      marketing_opt_in
    )
    values (
      new.id,
      coalesce(new.email, ''),
      coalesce(new.raw_user_meta_data ->> 'full_name', ''),
      coalesce(new.phone, new.raw_user_meta_data ->> 'phone', ''),
      v_role,
      coalesce((new.raw_user_meta_data ->> 'review_opt_in')::boolean, true),
      coalesce((new.raw_user_meta_data ->> 'marketing_opt_in')::boolean, true)
    )
    on conflict (id) do update
    set
      email = excluded.email,
      full_name = excluded.full_name,
      phone = excluded.phone,
      review_opt_in = excluded.review_opt_in,
      marketing_opt_in = excluded.marketing_opt_in,
      updated_at = now();

    perform public.log_auth_audit(
      'db_trigger',
      'profile_upsert_from_auth_user',
      'success',
      new.email,
      new.id,
      jsonb_build_object('role_applied', v_role),
      null
    );
  exception
    when others then
      perform public.log_auth_audit(
        'db_trigger',
        'profile_upsert_from_auth_user',
        'failure',
        new.email,
        new.id,
        jsonb_build_object('sqlstate', sqlstate),
        sqlerrm
      );
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

do $$
declare
  v_backfilled_count integer := 0;
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    phone,
    role,
    review_opt_in,
    marketing_opt_in
  )
  select
    u.id,
    coalesce(u.email, ''),
    coalesce(u.raw_user_meta_data ->> 'full_name', ''),
    coalesce(u.phone, u.raw_user_meta_data ->> 'phone', ''),
    case when coalesce(u.raw_user_meta_data ->> 'role', 'customer') = 'admin' then 'admin' else 'customer' end,
    coalesce((u.raw_user_meta_data ->> 'review_opt_in')::boolean, true),
    coalesce((u.raw_user_meta_data ->> 'marketing_opt_in')::boolean, true)
  from auth.users u
  left join public.profiles p on p.id = u.id
  where p.id is null;

  get diagnostics v_backfilled_count = row_count;

  perform public.log_auth_audit(
    'db_trigger',
    'profile_backfill_completed',
    'info',
    null,
    null,
    jsonb_build_object('rows_backfilled', v_backfilled_count),
    null
  );
end;
$$;

comment on table public.auth_audit_logs is 'Audit trail for auth and profile provisioning stages used for signup/signin debugging.';
comment on function public.log_auth_audit(text, text, text, text, uuid, jsonb, text) is 'Writes one auth audit event. Exposed to anon/authenticated for client-side stage tracing.';
comment on function public.handle_new_auth_user() is 'Trigger: auto-upserts public.profiles after auth.users insert and logs success/failure.';