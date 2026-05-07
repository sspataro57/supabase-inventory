create type measure_type as enum ('mass','volume','count');

create table units (
  code              text primary key,
  measure_type      measure_type not null,
  to_base_factor    numeric(20,10) not null check (to_base_factor > 0),
  display_name      text not null,
  system            text not null check (system in ('si','imperial','custom')),
  is_active         boolean not null default true
);
