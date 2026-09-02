-- ----------------------------------------------------------------------------
-- 0008_auth_allowlist
--
-- Restrict sign-in to a fixed set of allowed emails. Enforced at the database
-- level (a BEFORE INSERT trigger on auth.users), so it holds even if the client
-- allowlist is bypassed. Update the list here to change who can sign in.
-- ----------------------------------------------------------------------------

create or replace function public.enforce_email_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(new.email) not in (
    'aqakhtargroup@gmail.com',
    'aqakhtar96@gmail.com'
  ) then
    raise exception 'Email % is not permitted to sign in to this app', new.email
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_email_allowlist_trigger on auth.users;
create trigger enforce_email_allowlist_trigger
  before insert on auth.users
  for each row
  execute function public.enforce_email_allowlist();
