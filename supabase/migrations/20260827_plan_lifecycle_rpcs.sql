-- Plan lifecycle RPCs: join, leave, cancel, cleanup
-- Run this THIRD in Supabase SQL Editor (using baseline schema: user_id, profiles)

-- Join a plan: locks the row, validates, decrements, records — no race
create or replace function public.join_plan(p_plan_id uuid, p_user_id uuid)
returns table (success boolean, message text, current_spots integer)
language plpgsql security definer as $$
declare
  v_plan record;
  v_current_spots integer;
  v_is_member boolean;
begin
  -- Lock the plan row
  select * into v_plan
  from public.plans
  where id = p_plan_id
  for update;
  
  if not found then
    return query select false, 'Plan not found', 0;
  end if;
  
  if not v_plan.is_active then
    return query select false, 'Plan is no longer active', v_plan.spots_left;
  end if;
  
  if v_plan.expires_at <= now() then
    return query select false, 'Plan has expired', v_plan.spots_left;
  end if;
  
  -- Check if already joined
  select exists(select 1 from public.plan_joins where plan_id = p_plan_id and user_id = p_user_id)
  into v_is_member;
  
  if v_is_member then
    return query select false, 'Already joined', v_plan.spots_left;
  end if;
  
  if v_plan.spots_left <= 0 then
    return query select false, 'Plan is full', v_plan.spots_left;
  end if;
  
  -- Insert join record
  insert into public.plan_joins (plan_id, user_id)
  values (p_plan_id, p_user_id);
  
  -- Decrement spots_left
  update public.plans
  set spots_left = spots_left - 1
  where id = p_plan_id
  returning spots_left into v_current_spots;
  
  return query select true, 'Joined successfully', v_current_spots;
end $$;

-- Leave a plan
create or replace function public.leave_plan(p_plan_id uuid, p_user_id uuid)
returns table (success boolean, message text, current_spots integer)
language plpgsql security definer as $$
declare
  v_plan record;
  v_deleted boolean;
  v_current_spots integer;
begin
  -- Delete the join record
  delete from public.plan_joins
  where plan_id = p_plan_id and user_id = p_user_id
  returning true into v_deleted;
  
  if not v_deleted then
    return query select false, 'Not joined this plan', 0;
  end if;
  
  -- Increment spots_left
  update public.plans
  set spots_left = spots_left + 1
  where id = p_plan_id
  returning spots_left into v_current_spots;
  
  return query select true, 'Left plan', v_current_spots;
end $$;

-- Cancel a plan (creator only)
create or replace function public.cancel_plan(p_plan_id uuid, p_user_id uuid)
returns table (success boolean, message text)
language plpgsql security definer as $$
declare
  v_plan record;
begin
  select * into v_plan
  from public.plans
  where id = p_plan_id
  for update;
  
  if not found then
    return query select false, 'Plan not found';
  end if;
  
  if v_plan.user_id != p_user_id then
    return query select false, 'Only creator can cancel';
  end if;
  
  update public.plans
  set is_active = false
  where id = p_plan_id;
  
  return query select true, 'Plan cancelled';
end $$;

-- Cleanup expired plans (run via pg_cron or scheduled job)
create or replace function public.cleanup_expired_plans()
returns integer
language plpgsql security definer as $$
declare
  v_count integer;
begin
  update public.plans
  set is_active = false
  where is_active = true and expires_at <= now();
  
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Grant execute
grant execute on function public.join_plan to anon, authenticated;
grant execute on function public.leave_plan to anon, authenticated;
grant execute on function public.cancel_plan to anon, authenticated;
grant execute on function public.cleanup_expired_plans to anon, authenticated;