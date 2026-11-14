-- Deepika Class VI, Section CDS.2, Roll 23, academic year 2022-2023.
-- Adds the report subjects, assessment marks, and monthly attendance to the
-- existing education record. It does not create another student or class.
-- The PA-4 subject marks add to 288, while the report's grand-total row says
-- 289; the individual subject marks are imported without inventing a point.

begin;

create temporary table deepika_class6_import_subjects (
  source_position integer primary key,
  id text unique not null,
  name text not null,
  code text not null default '',
  credits numeric,
  notes text not null default '',
  check (source_position > 0)
) on commit drop;

create temporary table deepika_class6_import_exams (
  source_position integer primary key,
  id text unique not null,
  subject_id text not null references deepika_class6_import_subjects(id),
  name text not null,
  assessment_type text not null,
  subject text not null,
  marks_obtained numeric not null,
  maximum_marks numeric not null,
  grade text not null default '',
  notes text not null default '',
  check (source_position > 0),
  check (marks_obtained >= 0 and marks_obtained <= maximum_marks),
  check (maximum_marks > 0)
) on commit drop;

create temporary table deepika_class6_import_attendance (
  month text primary key,
  id text unique not null,
  working_days integer not null,
  days_present integer not null,
  notes text not null default '',
  check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  check (working_days >= 0 and days_present >= 0 and days_present <= working_days)
) on commit drop;

insert into deepika_class6_import_subjects (source_position, id, name)
values
  (1, 'edu-deepika-class6-2022-2023-subject-language1', 'Telugu/Hindi 1st language'),
  (2, 'edu-deepika-class6-2022-2023-subject-language2', 'English 2nd language'),
  (3, 'edu-deepika-class6-2022-2023-subject-language3', 'Telugu/Hindi 3rd language'),
  (4, 'edu-deepika-class6-2022-2023-subject-mathematics', 'Mathematics'),
  (5, 'edu-deepika-class6-2022-2023-subject-science', 'Science'),
  (6, 'edu-deepika-class6-2022-2023-subject-social-science', 'Social Science'),
  (7, 'edu-deepika-class6-2022-2023-subject-computer-science', 'Computer Science');

insert into deepika_class6_import_exams (
  source_position, id, subject_id, name, assessment_type, subject,
  marks_obtained, maximum_marks, grade, notes
) values
  (1, 'edu-deepika-class6-2022-2023-exam-language1-pa1', 'edu-deepika-class6-2022-2023-subject-language1', 'PA-1', 'Periodic Assessment', 'Telugu/Hindi 1st language', 45, 50, 'A2', 'Pen & paper 22/25; slip test 10/10; speaking + reading 8/10; C.W./B.M./discipline 5/5.'),
  (2, 'edu-deepika-class6-2022-2023-exam-language1-pa2', 'edu-deepika-class6-2022-2023-subject-language1', 'PA-2', 'Periodic Assessment', 'Telugu/Hindi 1st language', 48, 50, 'A1', 'Pen & paper 24/25; slip test 10/10; speaking + reading 9/10; C.W./B.M./discipline 5/5.'),
  (3, 'edu-deepika-class6-2022-2023-exam-language1-sa1', 'edu-deepika-class6-2022-2023-subject-language1', 'SA-1', 'Summative Assessment', 'Telugu/Hindi 1st language', 96, 100, 'A1', 'Report component marks: 78 and 18; total 96.'),
  (4, 'edu-deepika-class6-2022-2023-exam-language1-pa3', 'edu-deepika-class6-2022-2023-subject-language1', 'PA-3', 'Periodic Assessment', 'Telugu/Hindi 1st language', 49, 50, 'A1', 'Pen & paper 25/25; slip test 9/10; speaking + reading 10/10; C.W./B.M./discipline 5/5.'),
  (5, 'edu-deepika-class6-2022-2023-exam-language1-pa4', 'edu-deepika-class6-2022-2023-subject-language1', 'PA-4', 'Periodic Assessment', 'Telugu/Hindi 1st language', 50, 50, 'A1', 'Pen & paper 25/25; slip test 10/10; speaking + reading 10/10; C.W./B.M./discipline 5/5.'),
  (6, 'edu-deepika-class6-2022-2023-exam-language1-sa2', 'edu-deepika-class6-2022-2023-subject-language1', 'SA-2', 'Summative Assessment', 'Telugu/Hindi 1st language', 95, 100, 'A1', 'Report component marks: 75 and 20; total 95.'),

  (7, 'edu-deepika-class6-2022-2023-exam-language2-pa1', 'edu-deepika-class6-2022-2023-subject-language2', 'PA-1', 'Periodic Assessment', 'English 2nd language', 29, 50, 'C1', 'Pen & paper 12/25; slip test 8/10; speaking + reading 6/10; C.W./B.M./discipline 3/5.'),
  (8, 'edu-deepika-class6-2022-2023-exam-language2-pa2', 'edu-deepika-class6-2022-2023-subject-language2', 'PA-2', 'Periodic Assessment', 'English 2nd language', 38, 50, 'B1', 'Pen & paper 18/25; slip test 10/10; speaking + reading 7/10; C.W./B.M./discipline 3/5.'),
  (9, 'edu-deepika-class6-2022-2023-exam-language2-sa1', 'edu-deepika-class6-2022-2023-subject-language2', 'SA-1', 'Summative Assessment', 'English 2nd language', 69, 100, 'B1', 'Report component marks: 52 and 17; total 69.'),
  (10, 'edu-deepika-class6-2022-2023-exam-language2-pa3', 'edu-deepika-class6-2022-2023-subject-language2', 'PA-3', 'Periodic Assessment', 'English 2nd language', 39, 50, 'B1', 'Pen & paper 18/25; slip test 10/10; speaking + reading 6/10; C.W./B.M./discipline 5/5.'),
  (11, 'edu-deepika-class6-2022-2023-exam-language2-pa4', 'edu-deepika-class6-2022-2023-subject-language2', 'PA-4', 'Periodic Assessment', 'English 2nd language', 40, 50, 'B1', 'Pen & paper 20/25; slip test 9/10; speaking + reading 6/10; C.W./B.M./discipline 5/5.'),
  (12, 'edu-deepika-class6-2022-2023-exam-language2-sa2', 'edu-deepika-class6-2022-2023-subject-language2', 'SA-2', 'Summative Assessment', 'English 2nd language', 83, 100, 'A2', 'Report component marks: 68 and 15; total 83.'),

  (13, 'edu-deepika-class6-2022-2023-exam-language3-pa1', 'edu-deepika-class6-2022-2023-subject-language3', 'PA-1', 'Periodic Assessment', 'Telugu/Hindi 3rd language', 37, 50, 'B1', 'Pen & paper 20/25; slip test 7/10; speaking + reading 6/10; C.W./B.M./discipline 4/5.'),
  (14, 'edu-deepika-class6-2022-2023-exam-language3-pa2', 'edu-deepika-class6-2022-2023-subject-language3', 'PA-2', 'Periodic Assessment', 'Telugu/Hindi 3rd language', 40, 50, 'A2', 'Pen & paper 21/25; slip test 6/10; speaking + reading 8/10; C.W./B.M./discipline 5/5.'),
  (15, 'edu-deepika-class6-2022-2023-exam-language3-sa1', 'edu-deepika-class6-2022-2023-subject-language3', 'SA-1', 'Summative Assessment', 'Telugu/Hindi 3rd language', 72, 100, 'B1', 'Report component marks: 56 and 16; total 72.'),
  (16, 'edu-deepika-class6-2022-2023-exam-language3-pa3', 'edu-deepika-class6-2022-2023-subject-language3', 'PA-3', 'Periodic Assessment', 'Telugu/Hindi 3rd language', 48, 50, 'A1', 'Pen & paper 24/25; slip test 9/10; speaking + reading 10/10; C.W./B.M./discipline 5/5.'),
  (17, 'edu-deepika-class6-2022-2023-exam-language3-pa4', 'edu-deepika-class6-2022-2023-subject-language3', 'PA-4', 'Periodic Assessment', 'Telugu/Hindi 3rd language', 49, 50, 'A1', 'Pen & paper 25/25; slip test 10/10; speaking + reading 9/10; C.W./B.M./discipline 5/5.'),
  (18, 'edu-deepika-class6-2022-2023-exam-language3-sa2', 'edu-deepika-class6-2022-2023-subject-language3', 'SA-2', 'Summative Assessment', 'Telugu/Hindi 3rd language', 99, 100, 'A1', 'Report component marks: 79 and 20; total 99.'),

  (19, 'edu-deepika-class6-2022-2023-exam-mathematics-pa1', 'edu-deepika-class6-2022-2023-subject-mathematics', 'PA-1', 'Periodic Assessment', 'Mathematics', 37, 50, 'B1', 'Pen & paper 15/25; slip test 8/10; project work 9/10; C.W./B.M./discipline 5/5.'),
  (20, 'edu-deepika-class6-2022-2023-exam-mathematics-pa2', 'edu-deepika-class6-2022-2023-subject-mathematics', 'PA-2', 'Periodic Assessment', 'Mathematics', 48, 50, 'A1', 'Pen & paper 25/25; slip test 9/10; project work 9/10; C.W./B.M./discipline 5/5.'),
  (21, 'edu-deepika-class6-2022-2023-exam-mathematics-sa1', 'edu-deepika-class6-2022-2023-subject-mathematics', 'SA-1', 'Summative Assessment', 'Mathematics', 80, 100, 'B1', 'Report component marks: 65 and 15; total 80.'),
  (22, 'edu-deepika-class6-2022-2023-exam-mathematics-pa3', 'edu-deepika-class6-2022-2023-subject-mathematics', 'PA-3', 'Periodic Assessment', 'Mathematics', 48, 50, 'A1', 'Pen & paper 24/25; slip test 9/10; project work 10/10; C.W./B.M./discipline 5/5.'),
  (23, 'edu-deepika-class6-2022-2023-exam-mathematics-pa4', 'edu-deepika-class6-2022-2023-subject-mathematics', 'PA-4', 'Periodic Assessment', 'Mathematics', 49, 50, 'A1', 'Pen & paper 25/25; slip test 9/10; project work 10/10; C.W./B.M./discipline 5/5.'),
  (24, 'edu-deepika-class6-2022-2023-exam-mathematics-sa2', 'edu-deepika-class6-2022-2023-subject-mathematics', 'SA-2', 'Summative Assessment', 'Mathematics', 96, 100, 'A1', 'Report component marks: 76 and 20; total 96.'),

  (25, 'edu-deepika-class6-2022-2023-exam-science-pa1', 'edu-deepika-class6-2022-2023-subject-science', 'PA-1', 'Periodic Assessment', 'Science', 50, 50, 'A1', 'Pen & paper 25/25; slip test 10/10; project work 10/10; C.W./B.M./discipline 5/5.'),
  (26, 'edu-deepika-class6-2022-2023-exam-science-pa2', 'edu-deepika-class6-2022-2023-subject-science', 'PA-2', 'Periodic Assessment', 'Science', 45, 50, 'A2', 'Pen & paper 21/25; slip test 10/10; project work 10/10; C.W./B.M./discipline 4/5.'),
  (27, 'edu-deepika-class6-2022-2023-exam-science-sa1', 'edu-deepika-class6-2022-2023-subject-science', 'SA-1', 'Summative Assessment', 'Science', 92, 100, 'A1', 'Report component marks: 72 and 20; total 92.'),
  (28, 'edu-deepika-class6-2022-2023-exam-science-pa3', 'edu-deepika-class6-2022-2023-subject-science', 'PA-3', 'Periodic Assessment', 'Science', 50, 50, 'A1', 'Pen & paper 25/25; slip test 10/10; project work 10/10; C.W./B.M./discipline 5/5.'),
  (29, 'edu-deepika-class6-2022-2023-exam-science-pa4', 'edu-deepika-class6-2022-2023-subject-science', 'PA-4', 'Periodic Assessment', 'Science', 50, 50, 'A1', 'Pen & paper 25/25; slip test 10/10; project work 10/10; C.W./B.M./discipline 5/5.'),
  (30, 'edu-deepika-class6-2022-2023-exam-science-sa2', 'edu-deepika-class6-2022-2023-subject-science', 'SA-2', 'Summative Assessment', 'Science', 99, 100, 'A1', 'Report component marks: 79 and 20; total 99.'),

  (31, 'edu-deepika-class6-2022-2023-exam-social-science-pa1', 'edu-deepika-class6-2022-2023-subject-social-science', 'PA-1', 'Periodic Assessment', 'Social Science', 47, 50, 'A1', 'Pen & paper 22/25; slip test 10/10; project work 10/10; C.W./B.M./discipline 5/5.'),
  (32, 'edu-deepika-class6-2022-2023-exam-social-science-pa2', 'edu-deepika-class6-2022-2023-subject-social-science', 'PA-2', 'Periodic Assessment', 'Social Science', 48, 50, 'A1', 'Pen & paper 23/25; slip test 10/10; project work 10/10; C.W./B.M./discipline 5/5.'),
  (33, 'edu-deepika-class6-2022-2023-exam-social-science-sa1', 'edu-deepika-class6-2022-2023-subject-social-science', 'SA-1', 'Summative Assessment', 'Social Science', 100, 100, 'A1', 'Report component marks: 80 and 20; total 100.'),
  (34, 'edu-deepika-class6-2022-2023-exam-social-science-pa3', 'edu-deepika-class6-2022-2023-subject-social-science', 'PA-3', 'Periodic Assessment', 'Social Science', 50, 50, 'A1', 'Pen & paper 25/25; slip test 10/10; project work 10/10; C.W./B.M./discipline 5/5.'),
  (35, 'edu-deepika-class6-2022-2023-exam-social-science-pa4', 'edu-deepika-class6-2022-2023-subject-social-science', 'PA-4', 'Periodic Assessment', 'Social Science', 50, 50, 'A1', 'Pen & paper 25/25; slip test 10/10; project work 10/10; C.W./B.M./discipline 5/5.'),
  (36, 'edu-deepika-class6-2022-2023-exam-social-science-sa2', 'edu-deepika-class6-2022-2023-subject-social-science', 'SA-2', 'Summative Assessment', 'Social Science', 90, 100, 'A2', 'Report component marks: 70 and 20; total 90.'),

  (37, 'edu-deepika-class6-2022-2023-exam-computer-science-sa1', 'edu-deepika-class6-2022-2023-subject-computer-science', 'SA-1', 'Summative Assessment', 'Computer Science', 43, 50, 'A2', 'The report shows a score and grade without a component breakdown.'),
  (38, 'edu-deepika-class6-2022-2023-exam-computer-science-sa2', 'edu-deepika-class6-2022-2023-subject-computer-science', 'SA-2', 'Summative Assessment', 'Computer Science', 41, 50, 'A2', 'The report shows a score and grade without a component breakdown.');

insert into deepika_class6_import_attendance (month, id, working_days, days_present)
values
  ('2022-08', 'edu-deepika-class6-2022-2023-att-2022-08', 21, 9),
  ('2022-09', 'edu-deepika-class6-2022-2023-att-2022-09', 19, 17),
  ('2022-10', 'edu-deepika-class6-2022-2023-att-2022-10', 17, 14),
  ('2022-11', 'edu-deepika-class6-2022-2023-att-2022-11', 25, 23),
  ('2022-12', 'edu-deepika-class6-2022-2023-att-2022-12', 26, 18),
  ('2023-01', 'edu-deepika-class6-2022-2023-att-2023-01', 19, 16),
  ('2023-02', 'edu-deepika-class6-2022-2023-att-2023-02', 20, 13),
  ('2023-03', 'edu-deepika-class6-2022-2023-att-2023-03', 21, 21),
  ('2023-04', 'edu-deepika-class6-2022-2023-att-2023-04', 23, 20);

do $$
declare
  target_id text;
  target_record jsonb;
  matched_count integer;
  merged_attendance jsonb;
begin
  if (select count(*) from pg_temp.deepika_class6_import_subjects) <> 7
    or (select count(*) from pg_temp.deepika_class6_import_exams) <> 38
    or (select count(*) from pg_temp.deepika_class6_import_attendance) <> 9 then
    raise exception 'The imported subject, exam, or attendance row count is incomplete.';
  end if;

  if (select sum(marks_obtained) from pg_temp.deepika_class6_import_exams where name = 'PA-1') <> 245
    or (select sum(marks_obtained) from pg_temp.deepika_class6_import_exams where name = 'PA-2') <> 267
    or (select sum(marks_obtained) from pg_temp.deepika_class6_import_exams where name = 'SA-1' and subject <> 'Computer Science') <> 509
    or (select sum(marks_obtained) from pg_temp.deepika_class6_import_exams where name = 'PA-3') <> 284
    or (select sum(marks_obtained) from pg_temp.deepika_class6_import_exams where name = 'PA-4') <> 288
    or (select sum(marks_obtained) from pg_temp.deepika_class6_import_exams where name = 'SA-2' and subject <> 'Computer Science') <> 562 then
    raise exception 'Imported assessment marks do not match the report subject totals.';
  end if;

  select count(*), min(edu.id)
  into matched_count, target_id
  from public.education_records as edu
  where edu.id = '0e3a4ad5-51da-4632-af11-3783f417d92a'
    and regexp_replace(coalesce(edu.record ->> 'academicYear', ''), '[^0-9]', '', 'g') = '20222023'
    and lower(btrim(coalesce(edu.record ->> 'studentName', ''))) in ('deepika', 'j deepika')
    and lower(btrim(coalesce(edu.record ->> 'institution', ''))) in (
      'viswasanthi english meduum school',
      'viswasanthi senior secondary residential school'
    )
    and lower(btrim(coalesce(edu.record ->> 'gradeCourse', ''))) in ('class 6', 'class vi');

  if matched_count <> 1 then
    raise exception
      'Expected exactly one existing Deepika Class VI record for 2022-2023; found %. No changes were committed.',
      matched_count;
  end if;

  select edu.record
  into target_record
  from public.education_records as edu
  where edu.id = target_id;

  if target_record ? 'monthlyAttendance'
    and jsonb_typeof(target_record -> 'monthlyAttendance') is distinct from 'array' then
    raise exception 'Existing monthly attendance is not an array. No changes were committed.';
  end if;

  if exists (
    select 1
    from pg_temp.deepika_class6_import_subjects as source
    join public.education_subjects as existing on existing.id = source.id
    where existing.education_id <> target_id
  ) then
    raise exception 'An imported subject ID already belongs to another education record.';
  end if;

  if exists (
    select 1
    from pg_temp.deepika_class6_import_subjects as source
    join public.education_subjects as existing on existing.id = source.id
    where existing.education_id = target_id
      and (
        existing.record ->> 'name' is distinct from source.name
        or coalesce(existing.record ->> 'code', '') is distinct from source.code
      )
  ) then
    raise exception 'An imported subject ID already exists with different subject details.';
  end if;

  if exists (
    select 1
    from pg_temp.deepika_class6_import_subjects as source
    join public.education_subjects as existing
      on existing.education_id = target_id
     and lower(btrim(existing.record ->> 'name')) = lower(btrim(source.name))
     and existing.id <> source.id
  ) then
    raise exception 'A report subject already exists under a different ID. Review it before importing to avoid duplicates.';
  end if;

  if exists (
    select 1
    from pg_temp.deepika_class6_import_exams as source
    join public.education_exams as existing on existing.id = source.id
    where existing.education_id <> target_id
  ) then
    raise exception 'An imported exam ID already belongs to another education record.';
  end if;

  if exists (
    select 1
    from pg_temp.deepika_class6_import_exams as source
    join public.education_exams as existing on existing.id = source.id
    where existing.education_id = target_id
      and (
        existing.record ->> 'subjectId' is distinct from source.subject_id
        or existing.record ->> 'name' is distinct from source.name
        or existing.record ->> 'assessmentType' is distinct from source.assessment_type
        or existing.record ->> 'subject' is distinct from source.subject
        or existing.record ->> 'marksObtained' is distinct from source.marks_obtained::text
        or existing.record ->> 'maximumMarks' is distinct from source.maximum_marks::text
        or existing.record ->> 'grade' is distinct from source.grade
        or existing.record ->> 'notes' is distinct from source.notes
      )
  ) then
    raise exception 'An imported exam ID already exists with different report details.';
  end if;

  if exists (
    select 1
    from pg_temp.deepika_class6_import_exams as source
    join public.education_exams as existing
      on existing.education_id = target_id
     and existing.record ->> 'name' = source.name
     and existing.record ->> 'subject' = source.subject
     and existing.id <> source.id
  ) then
    raise exception 'A report assessment already exists under a different ID. Review it before importing to avoid duplicates.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(target_record -> 'monthlyAttendance', '[]'::jsonb)) as existing(value)
    join pg_temp.deepika_class6_import_attendance as source
      on existing.value ->> 'month' = source.month
    where coalesce((existing.value ->> 'workingDays')::integer, -1) <> source.working_days
       or coalesce((existing.value ->> 'daysPresent')::integer, -1) <> source.days_present
  ) then
    raise exception 'Existing attendance differs from the report for one or more months. Review it before importing.';
  end if;

  select coalesce(jsonb_agg(merged.value order by merged.value ->> 'month'), '[]'::jsonb)
  into merged_attendance
  from (
    select existing.value
    from jsonb_array_elements(coalesce(target_record -> 'monthlyAttendance', '[]'::jsonb)) as existing(value)
    where not exists (
      select 1
      from pg_temp.deepika_class6_import_attendance as source
      where source.month = existing.value ->> 'month'
    )
    union all
    select jsonb_build_object(
      'id', coalesce(existing.value ->> 'id', source.id),
      'month', source.month,
      'workingDays', source.working_days,
      'daysPresent', source.days_present,
      'notes', case
        when coalesce(existing.value ->> 'notes', '') <> '' then existing.value ->> 'notes'
        else source.notes
      end
    )
    from pg_temp.deepika_class6_import_attendance as source
    left join lateral (
      select attendance.value
      from jsonb_array_elements(coalesce(target_record -> 'monthlyAttendance', '[]'::jsonb)) as attendance(value)
      where attendance.value ->> 'month' = source.month
      limit 1
    ) as existing on true
  ) as merged;

  update public.education_records as edu
  set record = target_record || jsonb_build_object(
    'studentName', 'J Deepika',
    'institution', 'Viswasanthi Senior Secondary Residential School',
    'boardUniversity', 'Central Board of Secondary Education (CBSE)',
    'gradeCourse', 'Class VI',
    'section', 'CDS.2',
    'rollNumber', '23',
    'monthlyAttendance', merged_attendance,
    'notes', concat_ws(
      E'\n',
      nullif(btrim(coalesce(target_record ->> 'notes', '')), ''),
      case
        when coalesce(target_record ->> 'notes', '') ilike
          '%School location: Vuyyuru, Krishna District, Andhra Pradesh.%'
          then null
        else 'School location: Vuyyuru, Krishna District, Andhra Pradesh.'
      end,
      case
        when coalesce(target_record ->> 'notes', '') ilike
          '%PA-4 subject totals add to 288, but the printed grand total is 289.%'
          then null
        else 'Report discrepancy: PA-4 subject totals add to 288, but the printed grand total is 289.'
      end
    )
  )
  where edu.id = target_id;

  insert into public.education_subjects (id, education_id, position, record)
  select
    source.id,
    target_id,
    coalesce(existing.position, positions.last_position + source.source_position),
    jsonb_build_object(
      'id', source.id,
      'name', source.name,
      'code', source.code,
      'credits', source.credits,
      'notes', source.notes
    )
  from pg_temp.deepika_class6_import_subjects as source
  left join public.education_subjects as existing on existing.id = source.id
  cross join lateral (
    select coalesce(max(prior.position), 0)::integer as last_position
    from public.education_subjects as prior
    where prior.education_id = target_id
      and prior.id not in (select imported.id from pg_temp.deepika_class6_import_subjects as imported)
  ) as positions
  on conflict (id) do update
  set education_id = excluded.education_id,
      position = excluded.position,
      record = excluded.record;

  insert into public.education_exams (id, education_id, position, record)
  select
    source.id,
    target_id,
    coalesce(existing.position, positions.last_position + source.source_position),
    jsonb_build_object(
      'id', source.id,
      'subjectId', source.subject_id,
      'name', source.name,
      'assessmentType', source.assessment_type,
      'subject', source.subject,
      'date', '',
      'marksObtained', source.marks_obtained,
      'maximumMarks', source.maximum_marks,
      'grade', source.grade,
      'resultStatus', 'Scored',
      'teacherRemark', '',
      'notes', source.notes
    )
  from pg_temp.deepika_class6_import_exams as source
  left join public.education_exams as existing on existing.id = source.id
  cross join lateral (
    select coalesce(max(prior.position), 0)::integer as last_position
    from public.education_exams as prior
    where prior.education_id = target_id
      and prior.id not in (select imported.id from pg_temp.deepika_class6_import_exams as imported)
  ) as positions
  on conflict (id) do update
  set education_id = excluded.education_id,
      position = excluded.position,
      record = excluded.record;
end;
$$;

commit;

select
  edu.id,
  edu.record ->> 'studentName' as student_name,
  edu.record ->> 'institution' as school,
  edu.record ->> 'gradeCourse' as class,
  edu.record ->> 'academicYear' as academic_year,
  edu.record ->> 'section' as section,
  edu.record ->> 'rollNumber' as roll_number,
  (select count(*) from public.education_subjects as subject where subject.education_id = edu.id) as subject_count,
  (select count(*) from public.education_exams as exam where exam.education_id = edu.id) as exam_count,
  jsonb_array_length(coalesce(edu.record -> 'monthlyAttendance', '[]'::jsonb)) as monthly_attendance_count
from public.education_records as edu
where edu.id = '0e3a4ad5-51da-4632-af11-3783f417d92a';

select
  exam.record ->> 'name' as assessment,
  count(*) as subject_rows,
  sum((exam.record ->> 'marksObtained')::numeric) as marks_obtained,
  sum((exam.record ->> 'maximumMarks')::numeric) as maximum_marks
from public.education_exams as exam
where exam.education_id = '0e3a4ad5-51da-4632-af11-3783f417d92a'
  and exam.id like 'edu-deepika-class6-2022-2023-exam-%'
group by exam.record ->> 'name'
order by min(exam.position);

select
  attendance.value ->> 'month' as month,
  (attendance.value ->> 'workingDays')::integer as working_days,
  (attendance.value ->> 'daysPresent')::integer as days_present
from public.education_records as edu
cross join lateral jsonb_array_elements(coalesce(edu.record -> 'monthlyAttendance', '[]'::jsonb)) as attendance(value)
where edu.id = '0e3a4ad5-51da-4632-af11-3783f417d92a'
  and attendance.value ->> 'id' like 'edu-deepika-class6-2022-2023-att-%'
order by attendance.value ->> 'month';
