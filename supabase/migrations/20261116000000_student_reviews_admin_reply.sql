-- Add admin reply columns to student_reviews
alter table public.student_reviews
  add column if not exists admin_reply text,
  add column if not exists admin_reply_at timestamptz,
  add column if not exists admin_reply_by text;

comment on column public.student_reviews.admin_reply is 'Official support/admin reply to the student review';
comment on column public.student_reviews.admin_reply_at is 'Timestamp when the admin reply was created or last updated';
comment on column public.student_reviews.admin_reply_by is 'Email or identifier of the admin who replied';
