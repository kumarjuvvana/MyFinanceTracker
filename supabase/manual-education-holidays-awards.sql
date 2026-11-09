begin;

update public.education_records
set record = record
  || case when record ? 'schoolHolidays' then '{}'::jsonb
          else jsonb_build_object('schoolHolidays', '[]'::jsonb) end
  || case when record ? 'awards' then '{}'::jsonb
          else jsonb_build_object('awards', '[]'::jsonb) end
  || case when record ? 'studentLeaves' then '{}'::jsonb
          else jsonb_build_object('studentLeaves', '[]'::jsonb) end
where jsonb_typeof(record) = 'object'
  and not (record ? 'schoolHolidays' and record ? 'awards' and record ? 'studentLeaves');

commit;
