-- Run this whole file once in the Supabase SQL Editor.
create extension if not exists "pgcrypto";

-- Drop old tables if they exist to prevent conflicts during migration
drop table if exists public.access_logs cascade;
drop table if exists public.qr_codes cascade;
drop table if exists public.parking_sessions cascade;
drop table if exists public.parking_reservations cascade;
drop table if exists public.vehicles cascade;
drop table if exists public.parking_slots cascade;
drop table if exists public.profiles cascade;

create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null default '',
    email text,
    student_id text unique not null,
    role text not null default 'student' check (role in ('student','security','admin')),
    created_at timestamptz not null default now()
);

create table public.vehicles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    vehicle_number text unique not null,
    vehicle_type text not null check (vehicle_type in ('bike','car')),
    created_at timestamptz not null default now()
);

create table public.parking_slots (
    id uuid primary key default gen_random_uuid(),
    slot_number text unique not null,
    vehicle_type text not null check (vehicle_type in ('bike','car')),
    status text not null default 'available' check (status in ('available','reserved','occupied')),
    created_at timestamptz not null default now()
);

create table public.parking_reservations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    vehicle_id uuid not null references public.vehicles(id) on delete cascade,
    parking_slot_id uuid not null references public.parking_slots(id) on delete restrict,
    access_token text unique not null,
    reservation_date date not null default CURRENT_DATE,
    status text not null default 'reserved' check (status in ('reserved','active','completed','cancelled','expired')),
    created_at timestamptz not null default now(),
    used_at timestamptz,
    expires_at timestamptz
);

create table public.access_logs (
    id uuid primary key default gen_random_uuid(),
    reservation_id uuid not null references public.parking_reservations(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    vehicle_id uuid not null references public.vehicles(id) on delete cascade,
    parking_slot_id uuid not null references public.parking_slots(id) on delete restrict,
    status text not null default 'active' check (status in ('active','completed')),
    check_in_time timestamptz not null default now(),
    check_out_time timestamptz,
    created_at timestamptz not null default now()
);

-- Indexes for performance and uniqueness
create unique index one_open_reservation_per_student on public.parking_reservations(user_id) where status in ('reserved','active');
create unique index one_reserved_slot on public.parking_reservations(parking_slot_id) where status in ('reserved','active');
create unique index one_open_log_per_vehicle on public.access_logs(vehicle_id) where status = 'active';

-- Auth Trigger
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$ 
begin 
    insert into public.profiles (id,full_name,email,student_id,role) 
    values (new.id,coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),new.email,new.raw_user_meta_data->>'student_id','student'); 
    return new; 
end; 
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Utility functions
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = public as $$ 
    select exists(select 1 from public.profiles where id=auth.uid() and role in ('security','admin')) 
$$;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ 
    select exists(select 1 from public.profiles where id=auth.uid() and role='admin') 
$$;

-- Enable RLS
alter table public.profiles enable row level security; 
alter table public.vehicles enable row level security;
alter table public.parking_slots enable row level security; 
alter table public.parking_reservations enable row level security; 
alter table public.access_logs enable row level security;

-- Policies
create policy "profile self or staff read" on public.profiles for select using (id=auth.uid() or public.is_staff());
create policy "profile self update" on public.profiles for update using (id=auth.uid()) with check (id=auth.uid() and role='student');

create policy "vehicles own read" on public.vehicles for select using (user_id=auth.uid() or public.is_staff());
create policy "vehicles own insert" on public.vehicles for insert with check (user_id=auth.uid());
create policy "vehicles own update" on public.vehicles for update using (user_id=auth.uid());

create policy "slots authenticated read" on public.parking_slots for select to authenticated using (true);
create policy "admin slot insert" on public.parking_slots for insert to authenticated with check (public.is_admin());
create policy "admin slot delete" on public.parking_slots for delete to authenticated using (public.is_admin());

create policy "own or staff reservation read" on public.parking_reservations for select using (user_id=auth.uid() or public.is_staff());
create policy "own or staff logs read" on public.access_logs for select using (user_id=auth.uid() or public.is_staff());

-- RPC: Reserve Parking Slot
create or replace function public.reserve_parking_slot(
    p_vehicle_id uuid,
    p_parking_slot_id uuid,
    p_access_token text
) returns public.parking_reservations language plpgsql security definer set search_path=public as $$ 
declare 
    p public.profiles; 
    v public.vehicles;
    s public.parking_slots; 
    result public.parking_reservations; 
begin 
    -- Check user
    select * into p from public.profiles where id=auth.uid(); 
    if not found or p.role<>'student' then 
        raise exception 'Access denied'; 
    end if; 
    
    -- Check vehicle
    select * into v from public.vehicles where id=p_vehicle_id and user_id=auth.uid();
    if not found then
        raise exception 'Vehicle not found or does not belong to user';
    end if;

    -- Prevent double reservation
    if exists(select 1 from public.parking_reservations where user_id=auth.uid() and status in ('reserved','active')) then 
        raise exception 'You already have an active parking reservation'; 
    end if; 
    
    -- Lock slot and verify availability
    select * into s from public.parking_slots where id=p_parking_slot_id for update; 
    if not found or s.status<>'available' or s.vehicle_type<>v.vehicle_type then 
        raise exception 'Parking slot is no longer available'; 
    end if; 
    
    -- Create reservation (expires in 24 hours for demo purposes)
    insert into public.parking_reservations(user_id, vehicle_id, parking_slot_id, access_token, status, expires_at) 
    values(auth.uid(), p_vehicle_id, p_parking_slot_id, p_access_token, 'reserved', now() + interval '24 hours') 
    returning * into result; 
    
    -- Update slot
    update public.parking_slots set status='reserved' where id=p_parking_slot_id;
    
    return result; 
end; 
$$;

-- RPC: Approve Entry
create or replace function public.approve_parking_entry(p_reservation_id uuid) returns public.parking_reservations language plpgsql security definer set search_path=public as $$ 
declare 
    result public.parking_reservations; 
begin 
    if not public.is_staff() then 
        raise exception 'Access denied'; 
    end if; 
    
    -- Lock reservation
    select * into result from public.parking_reservations where id=p_reservation_id for update; 
    if not found then 
        raise exception 'Reservation not found'; 
    end if; 
    
    if result.status<>'reserved' then 
        raise exception 'This reservation cannot be approved (Status: %)', result.status; 
    end if; 
    
    if result.expires_at < now() then
        raise exception 'This parking reservation has expired';
    end if;

    -- Verify vehicle isn't already active somewhere else
    if exists(select 1 from public.access_logs where vehicle_id=result.vehicle_id and status='active') then
        raise exception 'Vehicle already has an active parking session.';
    end if;

    -- Update slot
    update public.parking_slots set status='occupied' where id=result.parking_slot_id and status='reserved'; 
    if not found then 
        raise exception 'Parking slot state is invalid'; 
    end if; 
    
    -- Update reservation
    update public.parking_reservations set status='active', used_at=now() where id=p_reservation_id returning * into result; 
    
    -- Create access log
    insert into public.access_logs(reservation_id, user_id, vehicle_id, parking_slot_id, status, check_in_time)
    values (result.id, result.user_id, result.vehicle_id, result.parking_slot_id, 'active', now());

    return result; 
end; 
$$;

-- RPC: Complete Exit
create or replace function public.complete_parking_exit(p_reservation_id uuid) returns public.parking_reservations language plpgsql security definer set search_path=public as $$ 
declare 
    result public.parking_reservations; 
begin 
    if not public.is_staff() then 
        raise exception 'Access denied'; 
    end if; 
    
    -- Lock reservation
    select * into result from public.parking_reservations where id=p_reservation_id for update; 
    if not found then 
        raise exception 'Reservation not found'; 
    end if; 
    
    if result.status<>'active' then 
        raise exception 'This session is not active'; 
    end if; 
    
    -- Update reservation
    update public.parking_reservations set status='completed' where id=p_reservation_id returning * into result; 
    
    -- Update slot
    update public.parking_slots set status='available' where id=result.parking_slot_id; 
    
    -- Update access log
    update public.access_logs set status='completed', check_out_time=now() where reservation_id=p_reservation_id and status='active';

    return result; 
end; 
$$;

grant execute on function public.reserve_parking_slot(uuid,uuid,text),public.approve_parking_entry(uuid),public.complete_parking_exit(uuid) to authenticated;

-- Seed Data
insert into public.parking_slots(slot_number,vehicle_type) values 
('B01','bike'),('B02','bike'),('B03','bike'),('B04','bike'),('B05','bike'),
('B06','bike'),('B07','bike'),('B08','bike'),('B09','bike'),('B10','bike'),
('C01','car'),('C02','car'),('C03','car'),('C04','car'),('C05','car'),
('C06','car'),('C07','car'),('C08','car'),('C09','car'),('C10','car') 
on conflict (slot_number) do nothing;

-- ==============================================================================
-- MIGRATION SCRIPT FOR EXISTING DATABASES
-- Run this if your database already exists and you are migrating to Phone Auth
-- ==============================================================================
/*
alter table public.profiles rename column name to full_name;
alter table public.profiles drop column if exists phone;
alter table public.profiles drop column if exists student_id;
alter table public.profiles add column student_id text unique not null;

-- Recreate trigger with updated column name
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$ 
begin 
    insert into public.profiles (id,full_name,email,student_id,role) 
    values (new.id,coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),new.email,new.raw_user_meta_data->>'student_id','student'); 
    return new; 
end; 
$$;
*/
