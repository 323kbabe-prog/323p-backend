alter table if exists public.ai_beings
  add column if not exists connection1 text,
  add column if not exists connection2 text,
  add column if not exists connection3 text;

comment on column public.ai_beings.connection1 is 'First HUMAN object or place connection keyword.';
comment on column public.ai_beings.connection2 is 'Second HUMAN object or place connection keyword.';
comment on column public.ai_beings.connection3 is 'Third HUMAN object or place connection keyword.';
