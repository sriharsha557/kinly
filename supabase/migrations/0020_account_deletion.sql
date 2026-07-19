-- Real "delete my account". Migration 0019 deliberately never calls
-- Supabase's user-deletion API and broke profiles' FK to auth.users (`on
-- delete no action`) specifically so an eventual account-deletion feature
-- would have to go through an explicit path instead of an accidental
-- cascade. This is that path.
--
-- Soft deletes (0019) are for reversible, in-app actions - leaving a
-- circle, deleting a goal. Account deletion is different: it's the one
-- place a genuine hard delete is correct (erasure, and it frees the email
-- for reuse). This function leaves every circle the caller is in (via the
-- existing leave_circle(), which already handles ownership transfer
-- correctly) then hard-deletes their profiles row, which cascades through
-- every table rooted at it per 0019's comment (goals, ask_posts,
-- vision_items, achievements, events, nudges, future_letters, push_tokens,
-- etc). The delete-account Edge Function calls this, then separately
-- removes the auth.users row via the Admin API - the one part that needs
-- the service role key and can't happen from SQL alone.
create or replace function delete_my_account()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  membership record;
begin
  for membership in
    select circle_id from circle_members
    where user_id = auth.uid() and deleted_at is null
  loop
    perform leave_circle(membership.circle_id);
  end loop;

  delete from profiles where id = auth.uid();
end;
$$;

grant execute on function delete_my_account() to authenticated;
