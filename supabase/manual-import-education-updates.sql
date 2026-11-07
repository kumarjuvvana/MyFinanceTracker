-- Education-only, repeatable import of verified report-card marks and monthly
-- attendance. It updates matching student/class/year records or creates them
-- when absent. Existing fee fields and all other modules are left unchanged.

begin;

create temporary table education_import_records (
  import_key text primary key,
  student_name text not null,
  institution text not null,
  grade_course text not null,
  academic_year text not null,
  section text not null,
  roll_number text not null,
  record_template jsonb not null,
  monthly_attendance jsonb not null,
  education_id text unique
) on commit drop;

create temporary table education_import_exams (
  import_key text not null references education_import_records(import_key),
  source_position integer not null,
  id text primary key,
  name text not null,
  assessment_type text not null,
  subject text not null,
  marks_obtained numeric not null,
  maximum_marks numeric not null,
  grade text not null,
  teacher_remark text not null default '',
  notes text not null default '',
  check (source_position > 0),
  check (marks_obtained >= 0 and marks_obtained <= maximum_marks),
  check (maximum_marks > 0)
) on commit drop;

insert into education_import_records (
  import_key, student_name, institution, grade_course, academic_year,
  section, roll_number, record_template, monthly_attendance
) values
(
  'deepika-class-10-2026-2027',
  'Deepika',
  'Viswasanthi English Meduum School',
  'Class 10',
  '2026-2027',
  'CDS1',
  '37',
  jsonb_build_object(
    'studentName', 'Deepika',
    'institution', 'Viswasanthi English Meduum School',
    'level', 'Secondary (Grades 9–10)',
    'gradeCourse', 'Class 10',
    'academicYear', '2026-2027',
    'status', 'Current',
    'boardUniversity', 'Central Board of Secondary Education (CBSE)',
    'startDate', '',
    'endDate', '',
    'annualFee', null,
    'paidFee', null,
    'currency', 'INR',
    'contactName', 'ViswaSanthi Admin',
    'contact', '',
    'link', '',
    'notes', 'Created from verified report-card data; fee details are intentionally excluded from this import.'
  ),
  '[
    {"id":"edu-import-deepika-2026-2027-att-2026-07","month":"2026-07","workingDays":15,"daysPresent":14,"notes":""},
    {"id":"edu-import-deepika-2026-2027-att-2026-08","month":"2026-08","workingDays":21,"daysPresent":19,"notes":""},
    {"id":"edu-import-deepika-2026-2027-att-2026-09","month":"2026-09","workingDays":20,"daysPresent":20,"notes":""},
    {"id":"edu-import-deepika-2026-2027-att-2026-10","month":"2026-10","workingDays":10,"daysPresent":10,"notes":""},
    {"id":"edu-import-deepika-2026-2027-att-2026-11","month":"2026-11","workingDays":1,"daysPresent":1,"notes":""}
  ]'::jsonb
),
(
  'arun-class-3-2025-2026',
  'Arun Kumar J',
  'A.N.M (E.M) High School',
  'Class 3',
  '2025–2026',
  'A',
  '5',
  jsonb_build_object(
    'studentName', 'Arun Kumar J',
    'institution', 'A.N.M (E.M) High School',
    'level', 'Primary (Grades 1–5)',
    'gradeCourse', 'Class 3',
    'academicYear', '2025–2026',
    'status', 'Completed',
    'boardUniversity', 'Board of Secondary Education, Andhra Pradesh (BSEAP)',
    'startDate', '',
    'endDate', '',
    'annualFee', null,
    'paidFee', null,
    'currency', 'INR',
    'contactName', 'ANM Admin',
    'contact', '',
    'link', '',
    'notes', 'Created from verified report-card data; fee details are intentionally excluded from this import.'
  ),
  '[
    {"id":"edu-import-arun-2025-2026-att-2025-06","month":"2025-06","workingDays":15,"daysPresent":10,"notes":""},
    {"id":"edu-import-arun-2025-2026-att-2025-07","month":"2025-07","workingDays":26,"daysPresent":23,"notes":""},
    {"id":"edu-import-arun-2025-2026-att-2025-08","month":"2025-08","workingDays":21,"daysPresent":17,"notes":""},
    {"id":"edu-import-arun-2025-2026-att-2025-09","month":"2025-09","workingDays":15,"daysPresent":13,"notes":""},
    {"id":"edu-import-arun-2025-2026-att-2025-10","month":"2025-10","workingDays":19,"daysPresent":11,"notes":""},
    {"id":"edu-import-arun-2025-2026-att-2025-11","month":"2025-11","workingDays":25,"daysPresent":21,"notes":""},
    {"id":"edu-import-arun-2025-2026-att-2025-12","month":"2025-12","workingDays":26,"daysPresent":19,"notes":""},
    {"id":"edu-import-arun-2025-2026-att-2026-01","month":"2026-01","workingDays":18,"daysPresent":15,"notes":""},
    {"id":"edu-import-arun-2025-2026-att-2026-02","month":"2026-02","workingDays":24,"daysPresent":21,"notes":""},
    {"id":"edu-import-arun-2025-2026-att-2026-03","month":"2026-03","workingDays":21,"daysPresent":14,"notes":""},
    {"id":"edu-import-arun-2025-2026-att-2026-04","month":"2026-04","workingDays":18,"daysPresent":16,"notes":""}
  ]'::jsonb
);

insert into education_import_exams (
  import_key, source_position, id, name, assessment_type, subject,
  marks_obtained, maximum_marks, grade, teacher_remark, notes
) values
  ('deepika-class-10-2026-2027', 1, 'edu-import-deepika-2026-2027-pa3-english', 'PA-3', 'Periodic Assessment', 'English', 45, 50, 'A2', '', ''),
  ('deepika-class-10-2026-2027', 2, 'edu-import-deepika-2026-2027-pa3-language-2', 'PA-3', 'Periodic Assessment', 'II Language', 37, 50, 'B1', '', ''),
  ('deepika-class-10-2026-2027', 3, 'edu-import-deepika-2026-2027-pa3-mathematics', 'PA-3', 'Periodic Assessment', 'Mathematics', 44, 50, 'A2', '', ''),
  ('deepika-class-10-2026-2027', 4, 'edu-import-deepika-2026-2027-pa3-science', 'PA-3', 'Periodic Assessment', 'Science', 42, 50, 'A2', '', ''),
  ('deepika-class-10-2026-2027', 5, 'edu-import-deepika-2026-2027-pa3-social-science', 'PA-3', 'Periodic Assessment', 'Social Science', 49, 50, 'A1', '', ''),
  ('deepika-class-10-2026-2027', 6, 'edu-import-deepika-2026-2027-pa4-english', 'PA-4', 'Periodic Assessment', 'English', 44, 50, 'A2', '', ''),
  ('deepika-class-10-2026-2027', 7, 'edu-import-deepika-2026-2027-pa4-language-2', 'PA-4', 'Periodic Assessment', 'II Language', 38, 50, 'B1', '', ''),
  ('deepika-class-10-2026-2027', 8, 'edu-import-deepika-2026-2027-pa4-mathematics', 'PA-4', 'Periodic Assessment', 'Mathematics', 41, 50, 'A2', '', ''),
  ('deepika-class-10-2026-2027', 9, 'edu-import-deepika-2026-2027-pa4-science', 'PA-4', 'Periodic Assessment', 'Science', 40, 50, 'B1', '', ''),
  ('deepika-class-10-2026-2027', 10, 'edu-import-deepika-2026-2027-pa4-social-science', 'PA-4', 'Periodic Assessment', 'Social Science', 36, 50, 'B1', '', ''),
  ('deepika-class-10-2026-2027', 11, 'edu-import-deepika-2026-2027-pa5-english', 'PA-5', 'Periodic Assessment', 'English', 43, 50, 'A2', '', ''),
  ('deepika-class-10-2026-2027', 12, 'edu-import-deepika-2026-2027-pa5-language-2', 'PA-5', 'Periodic Assessment', 'II Language', 41, 50, 'A2', '', ''),
  ('deepika-class-10-2026-2027', 13, 'edu-import-deepika-2026-2027-pa5-mathematics', 'PA-5', 'Periodic Assessment', 'Mathematics', 43, 50, 'A2', '', ''),
  ('deepika-class-10-2026-2027', 14, 'edu-import-deepika-2026-2027-pa5-science', 'PA-5', 'Periodic Assessment', 'Science', 48, 50, 'A1', '', ''),
  ('deepika-class-10-2026-2027', 15, 'edu-import-deepika-2026-2027-pa5-social-science', 'PA-5', 'Periodic Assessment', 'Social Science', 45, 50, 'A2', '', ''),

  ('arun-class-3-2025-2026', 1, 'edu-import-arun-2025-2026-fa1-language-1', 'FA-1', 'Formative Assessment', '1st Language', 48, 50, 'A+', 'Overall: Improve your Hindi and social marks.', ''),
  ('arun-class-3-2025-2026', 2, 'edu-import-arun-2025-2026-fa1-language-2', 'FA-1', 'Formative Assessment', '2nd Language', 39, 50, 'A', '', ''),
  ('arun-class-3-2025-2026', 3, 'edu-import-arun-2025-2026-fa1-english', 'FA-1', 'Formative Assessment', 'English', 46, 50, 'A+', '', ''),
  ('arun-class-3-2025-2026', 4, 'edu-import-arun-2025-2026-fa1-mathematics', 'FA-1', 'Formative Assessment', 'Mathematics', 50, 50, 'A+', '', ''),
  ('arun-class-3-2025-2026', 5, 'edu-import-arun-2025-2026-fa1-evs-bs', 'FA-1', 'Formative Assessment', 'EVS - B.S.', 47, 50, 'A+', '', ''),
  ('arun-class-3-2025-2026', 6, 'edu-import-arun-2025-2026-fa1-social-studies', 'FA-1', 'Formative Assessment', 'Social Studies', 39, 50, 'A', '', ''),
  ('arun-class-3-2025-2026', 7, 'edu-import-arun-2025-2026-fa2-language-1', 'FA-2', 'Formative Assessment', '1st Language', 44, 50, 'A+', '', ''),
  ('arun-class-3-2025-2026', 8, 'edu-import-arun-2025-2026-fa2-language-2', 'FA-2', 'Formative Assessment', '2nd Language', 46, 50, 'A+', '', ''),
  ('arun-class-3-2025-2026', 9, 'edu-import-arun-2025-2026-fa2-english', 'FA-2', 'Formative Assessment', 'English', 48, 50, 'A+', '', ''),
  ('arun-class-3-2025-2026', 10, 'edu-import-arun-2025-2026-fa2-mathematics', 'FA-2', 'Formative Assessment', 'Mathematics', 50, 50, 'A+', '', ''),
  ('arun-class-3-2025-2026', 11, 'edu-import-arun-2025-2026-fa2-evs-bs', 'FA-2', 'Formative Assessment', 'EVS - B.S.', 48, 50, 'A+', '', ''),
  ('arun-class-3-2025-2026', 12, 'edu-import-arun-2025-2026-fa2-social-studies', 'FA-2', 'Formative Assessment', 'Social Studies', 47, 50, 'A+', '', ''),
  ('arun-class-3-2025-2026', 13, 'edu-import-arun-2025-2026-sa1-language-1', 'SA-1', 'Summative Assessment', '1st Language', 82, 100, 'A+', '', ''),
  ('arun-class-3-2025-2026', 14, 'edu-import-arun-2025-2026-sa1-language-2', 'SA-1', 'Summative Assessment', '2nd Language', 92, 100, 'A+', '', ''),
  ('arun-class-3-2025-2026', 15, 'edu-import-arun-2025-2026-sa1-english', 'SA-1', 'Summative Assessment', 'English', 96, 100, 'A+', '', ''),
  ('arun-class-3-2025-2026', 16, 'edu-import-arun-2025-2026-sa1-mathematics', 'SA-1', 'Summative Assessment', 'Mathematics', 90, 100, 'A+', '', ''),
  ('arun-class-3-2025-2026', 17, 'edu-import-arun-2025-2026-sa1-evs-bs', 'SA-1', 'Summative Assessment', 'EVS - B.S.', 98, 100, 'A+', '', ''),
  ('arun-class-3-2025-2026', 18, 'edu-import-arun-2025-2026-sa1-social-studies', 'SA-1', 'Summative Assessment', 'Social Studies', 96, 100, 'A+', '', ''),
  ('arun-class-3-2025-2026', 19, 'edu-import-arun-2025-2026-sa1-gk', 'SA-1', 'Summative Assessment', 'G.K.', 96, 100, 'A+', '', ''),
  ('arun-class-3-2025-2026', 20, 'edu-import-arun-2025-2026-sa1-computer', 'SA-1', 'Summative Assessment', 'Computer', 48, 50, 'A+', '', ''),
  ('arun-class-3-2025-2026', 21, 'edu-import-arun-2025-2026-sa1-abacus', 'SA-1', 'Summative Assessment', 'Abacus', 93, 100, 'A+', '', ''),
  ('arun-class-3-2025-2026', 22, 'edu-import-arun-2025-2026-fa3-language-1', 'FA-3', 'Formative Assessment', '1st Language', 44, 50, 'A+', 'Overall: Try to get Rank.', ''),
  ('arun-class-3-2025-2026', 23, 'edu-import-arun-2025-2026-fa3-language-2', 'FA-3', 'Formative Assessment', '2nd Language', 49, 50, 'A+', '', ''),
  ('arun-class-3-2025-2026', 24, 'edu-import-arun-2025-2026-fa3-english', 'FA-3', 'Formative Assessment', 'English', 49, 50, 'A+', '', ''),
  ('arun-class-3-2025-2026', 25, 'edu-import-arun-2025-2026-fa3-mathematics', 'FA-3', 'Formative Assessment', 'Mathematics', 50, 50, 'A+', '', ''),
  ('arun-class-3-2025-2026', 26, 'edu-import-arun-2025-2026-fa3-evs-bs', 'FA-3', 'Formative Assessment', 'EVS - B.S.', 47, 50, 'A+', '', ''),
  ('arun-class-3-2025-2026', 27, 'edu-import-arun-2025-2026-fa3-social-studies', 'FA-3', 'Formative Assessment', 'Social Studies', 46, 50, 'A+', '', ''),
  ('arun-class-3-2025-2026', 28, 'edu-import-arun-2025-2026-sa2-language-1', 'SA-2', 'Summative Assessment', '1st Language', 45, 50, 'A+', 'Overall: Very good.', ''),
  ('arun-class-3-2025-2026', 29, 'edu-import-arun-2025-2026-sa2-language-2', 'SA-2', 'Summative Assessment', '2nd Language', 50, 50, 'A+', '', ''),
  ('arun-class-3-2025-2026', 30, 'edu-import-arun-2025-2026-sa2-english', 'SA-2', 'Summative Assessment', 'English', 48, 50, 'A+', '', ''),
  ('arun-class-3-2025-2026', 31, 'edu-import-arun-2025-2026-sa2-mathematics', 'SA-2', 'Summative Assessment', 'Mathematics', 47, 50, 'A+', '', ''),
  ('arun-class-3-2025-2026', 32, 'edu-import-arun-2025-2026-sa2-evs-ps', 'SA-2', 'Summative Assessment', 'EVS - P.S.', 50, 50, 'A+', '', ''),
  ('arun-class-3-2025-2026', 33, 'edu-import-arun-2025-2026-sa2-social-studies', 'SA-2', 'Summative Assessment', 'Social Studies', 49, 50, 'A+', '', ''),
  ('arun-class-3-2025-2026', 34, 'edu-import-arun-2025-2026-fa4-language-1', 'FA-4', 'Formative Assessment', '1st Language', 45, 50, 'A+', 'Overall: Improve your maths in Telugu language.', ''),
  ('arun-class-3-2025-2026', 35, 'edu-import-arun-2025-2026-fa4-language-2', 'FA-4', 'Formative Assessment', '2nd Language', 49, 50, 'A+', '', ''),
  ('arun-class-3-2025-2026', 36, 'edu-import-arun-2025-2026-fa4-english', 'FA-4', 'Formative Assessment', 'English', 48, 50, 'A+', '', ''),
  ('arun-class-3-2025-2026', 37, 'edu-import-arun-2025-2026-fa4-mathematics', 'FA-4', 'Formative Assessment', 'Mathematics', 48, 50, 'A+', '', ''),
  ('arun-class-3-2025-2026', 38, 'edu-import-arun-2025-2026-fa4-evs-ps', 'FA-4', 'Formative Assessment', 'EVS - P.S.', 49, 50, 'A+', '', ''),
  ('arun-class-3-2025-2026', 39, 'edu-import-arun-2025-2026-fa4-social-studies', 'FA-4', 'Formative Assessment', 'Social Studies', 48, 50, 'A+', '', ''),
  ('arun-class-3-2025-2026', 40, 'edu-import-arun-2025-2026-sa3-language-1', 'SA-3 / Pre-Final', 'Summative Assessment', '1st Language', 90, 100, 'A+', 'Overall: Very good.', ''),
  ('arun-class-3-2025-2026', 41, 'edu-import-arun-2025-2026-sa3-language-2', 'SA-3 / Pre-Final', 'Summative Assessment', '2nd Language', 100, 100, 'A+', '', ''),
  ('arun-class-3-2025-2026', 42, 'edu-import-arun-2025-2026-sa3-english', 'SA-3 / Pre-Final', 'Summative Assessment', 'English', 94, 100, 'A+', '', ''),
  ('arun-class-3-2025-2026', 43, 'edu-import-arun-2025-2026-sa3-mathematics', 'SA-3 / Pre-Final', 'Summative Assessment', 'Mathematics', 98, 100, 'A+', '', ''),
  ('arun-class-3-2025-2026', 44, 'edu-import-arun-2025-2026-sa3-evs-ps', 'SA-3 / Pre-Final', 'Summative Assessment', 'EVS - P.S.', 100, 100, 'A+', '', ''),
  ('arun-class-3-2025-2026', 45, 'edu-import-arun-2025-2026-sa3-social-studies', 'SA-3 / Pre-Final', 'Summative Assessment', 'Social Studies', 99, 100, 'A+', '', ''),
  ('arun-class-3-2025-2026', 46, 'edu-import-arun-2025-2026-sa3-gk', 'SA-3 / Pre-Final', 'Summative Assessment', 'G.K.', 100, 100, 'A+', '', ''),
  ('arun-class-3-2025-2026', 47, 'edu-import-arun-2025-2026-sa3-computer', 'SA-3 / Pre-Final', 'Summative Assessment', 'Computer', 47, 50, 'A+', '', ''),
  ('arun-class-3-2025-2026', 48, 'edu-import-arun-2025-2026-sa3-abacus', 'SA-3 / Pre-Final', 'Summative Assessment', 'Abacus', 98, 100, 'A+', '', '');

do $$
declare
  source_row record;
  matched_count integer;
  resolved_id text;
  next_position integer;
  target_record jsonb;
  merged_attendance jsonb;
begin
  if exists (
    select 1
    from pg_temp.education_import_records as source
    where jsonb_typeof(source.record_template) <> 'object'
      or jsonb_typeof(source.monthly_attendance) <> 'array'
  ) then
    raise exception 'Education import records must contain a JSON object and monthly-attendance array.';
  end if;

  if exists (
    select 1
    from pg_temp.education_import_records as source
    cross join lateral jsonb_array_elements(source.monthly_attendance) as attendance(value)
    where jsonb_typeof(attendance.value) <> 'object'
      or nullif(attendance.value ->> 'id', '') is null
      or (attendance.value ->> 'month') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
      or jsonb_typeof(attendance.value -> 'workingDays') <> 'number'
      or jsonb_typeof(attendance.value -> 'daysPresent') <> 'number'
      or (attendance.value ->> 'workingDays')::integer < 0
      or (attendance.value ->> 'daysPresent')::integer < 0
      or (attendance.value ->> 'daysPresent')::integer > (attendance.value ->> 'workingDays')::integer
      or jsonb_typeof(attendance.value -> 'notes') <> 'string'
  ) then
    raise exception 'An imported monthly-attendance entry is incomplete or invalid.';
  end if;

  if exists (
    select 1
    from pg_temp.education_import_exams as exam
    where nullif(exam.id, '') is null
      or exam.name = ''
      or exam.assessment_type = ''
      or exam.subject = ''
      or exam.marks_obtained < 0
      or exam.maximum_marks <= 0
      or exam.marks_obtained > exam.maximum_marks
  ) then
    raise exception 'An imported exam result is incomplete or has invalid marks.';
  end if;

  for source_row in
    select *
    from pg_temp.education_import_records
    order by import_key
  loop
    select count(*), min(target.id)
    into matched_count, resolved_id
    from public.education_records as target
    where lower(btrim(target.record ->> 'studentName')) = lower(btrim(source_row.student_name))
      and lower(btrim(target.record ->> 'institution')) = lower(btrim(source_row.institution))
      and lower(btrim(target.record ->> 'gradeCourse')) = lower(btrim(source_row.grade_course))
      and regexp_replace(coalesce(target.record ->> 'academicYear', ''), '[^0-9]', '', 'g')
        = regexp_replace(source_row.academic_year, '[^0-9]', '', 'g');

    if matched_count > 1 then
      raise exception 'More than one education record matches import key %; no changes were committed.', source_row.import_key;
    elsif matched_count = 0 then
      resolved_id := gen_random_uuid()::text;
      select coalesce(max(position), 0) + 1
      into next_position
      from public.education_records;

      insert into public.education_records (id, position, record)
      values (
        resolved_id,
        next_position,
        source_row.record_template || jsonb_build_object(
          'id', resolved_id,
          'section', source_row.section,
          'rollNumber', source_row.roll_number
        )
      );
    end if;

    update pg_temp.education_import_records
    set education_id = resolved_id
    where import_key = source_row.import_key;

    select target.record
    into target_record
    from public.education_records as target
    where target.id = resolved_id;

    if target_record ? 'monthlyAttendance'
      and jsonb_typeof(target_record -> 'monthlyAttendance') <> 'array' then
      raise exception 'Existing monthly attendance for import key % is not an array.', source_row.import_key;
    end if;

    select coalesce(jsonb_agg(merged.value order by merged.value ->> 'month'), '[]'::jsonb)
    into merged_attendance
    from (
      select existing.value
      from jsonb_array_elements(coalesce(target_record -> 'monthlyAttendance', '[]'::jsonb)) as existing(value)
      where not exists (
        select 1
        from jsonb_array_elements(source_row.monthly_attendance) as imported(value)
        where imported.value ->> 'month' = existing.value ->> 'month'
      )
      union all
      select imported.value
      from jsonb_array_elements(source_row.monthly_attendance) as imported(value)
    ) as merged;

    update public.education_records as target
    set record = target_record || jsonb_build_object(
      'section', source_row.section,
      'rollNumber', source_row.roll_number,
      'monthlyAttendance', merged_attendance
    )
    where target.id = resolved_id;
  end loop;

  if exists (
    select 1
    from pg_temp.education_import_exams as source
    join pg_temp.education_import_records as record on record.import_key = source.import_key
    join public.education_exams as existing on existing.id = source.id
    where existing.education_id <> record.education_id
  ) then
    raise exception 'An imported exam id already belongs to a different education record.';
  end if;

  insert into public.education_exams (id, education_id, position, record)
  select
    source.id,
    parent.education_id,
    coalesce(existing.position, positions.last_position + source.source_position),
    jsonb_build_object(
      'id', source.id,
      'name', source.name,
      'assessmentType', source.assessment_type,
      'subject', source.subject,
      'date', '',
      'marksObtained', source.marks_obtained,
      'maximumMarks', source.maximum_marks,
      'grade', source.grade,
      'resultStatus', 'Scored',
      'teacherRemark', source.teacher_remark,
      'notes', source.notes
    )
  from pg_temp.education_import_exams as source
  join pg_temp.education_import_records as parent on parent.import_key = source.import_key
  join lateral (
    select coalesce(max(prior.position), 0)::integer as last_position
    from public.education_exams as prior
    where prior.education_id = parent.education_id
      and prior.id not in (
        select imported.id
        from pg_temp.education_import_exams as imported
      )
  ) as positions on true
  left join public.education_exams as existing on existing.id = source.id
  on conflict (id) do update
  set education_id = excluded.education_id,
      position = excluded.position,
      record = excluded.record;
end;
$$;

commit;
