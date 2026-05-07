alter table profiles
  add column if not exists theme text not null default 'system'
    check (theme in ('light', 'dark', 'system'));
