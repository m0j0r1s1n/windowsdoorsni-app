-- Run this in Supabase Dashboard → SQL Editor → New Query

create extension if not exists pgcrypto;

-- Drop existing tables if schema is wrong
drop table if exists jobs  cascade;
drop table if exists stock cascade;

create table jobs (
  id         uuid primary key default gen_random_uuid(),
  customer   text,
  address    text,
  type       text,
  price      numeric(10,2) default 0,
  status     text default 'Pending',
  date       date,
  created_at timestamptz default now()
);

create table stock (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  category   text,
  qty        integer default 0,
  min        integer default 0,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table jobs  enable row level security;
alter table stock enable row level security;

-- Allow the anon key full access (internal portal)
drop policy if exists "anon full access" on jobs;
drop policy if exists "anon full access" on stock;
create policy "anon full access" on jobs  for all using (true) with check (true);
create policy "anon full access" on stock for all using (true) with check (true);
