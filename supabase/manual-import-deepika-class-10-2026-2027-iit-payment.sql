-- Deepika Class 10 only: add the verified IIT unit test and receipt line items.
-- Existing annualFee, paidFee, fee charges, and all other education records are unchanged.

begin;

create temporary table deepika_class10_iit_exams (
  id text primary key,
  name text not null,
  assessment_type text not null,
  subject text not null,
  exam_date text not null,
  marks_obtained numeric not null,
  maximum_marks numeric not null,
  notes text not null default '',
  check (marks_obtained >= 0 and marks_obtained <= maximum_marks),
  check (maximum_marks > 0)
) on commit drop;

insert into deepika_class10_iit_exams
  (id, name, assessment_type, subject, exam_date, marks_obtained, maximum_marks, notes)
values
  ('edu-deepika-class10-2026-2027-iit-unit-test-1-mathematics', 'IIT Unit Test 1', 'IIT Assessment', 'Mathematics', '2026-08-05', 36, 40, ''),
  ('edu-deepika-class10-2026-2027-iit-unit-test-1-physics', 'IIT Unit Test 1', 'IIT Assessment', 'Physics', '2026-08-05', 30, 30, ''),
  ('edu-deepika-class10-2026-2027-iit-unit-test-1-chemistry', 'IIT Unit Test 1', 'IIT Assessment', 'Chemistry', '2026-08-05', 26, 30, ''),
  ('edu-deepika-class10-2026-2027-iit-unit-test-1-overall', 'IIT Unit Test 1', 'IIT Assessment', 'Overall', '2026-08-05', 92, 100, 'Class rank: 3.');

create temporary table deepika_class10_iit_payments (
  id text primary key,
  fee_type text not null,
  period text not null,
  amount numeric not null,
  payment_date text not null,
  method text not null,
  reference text not null,
  notes text not null,
  check (amount > 0)
) on commit drop;

insert into deepika_class10_iit_payments
  (id, fee_type, period, amount, payment_date, method, reference, notes)
values
  ('edu-deepika-class10-2026-2027-receipt-2026-05-tuition-1', 'Tuition', 'May 2026 - Tuition installment 1', 16000, '2026-05-27', 'NEFT/RTGS/UPI Payments', '915941195113', 'Receipt transaction ID: S18SVEI2705261540018095344. Receipt total: INR 43,400.'),
  ('edu-deepika-class10-2026-2027-receipt-2026-05-tuition-2', 'Tuition', 'May 2026 - Tuition installment 2', 16000, '2026-05-27', 'NEFT/RTGS/UPI Payments', '915941195113', 'Receipt transaction ID: S18SVEI2705261540018095344. Receipt total: INR 43,400.'),
  ('edu-deepika-class10-2026-2027-receipt-2026-05-transport-1', 'School van / transport', 'May 2026 - Bus fee installment 1', 4560, '2026-05-27', 'NEFT/RTGS/UPI Payments', '915941195113', 'Receipt transaction ID: S18SVEI2705261540018095344. Receipt total: INR 43,400.'),
  ('edu-deepika-class10-2026-2027-receipt-2026-05-transport-2', 'School van / transport', 'May 2026 - Bus fee installment 2', 3420, '2026-05-27', 'NEFT/RTGS/UPI Payments', '915941195113', 'Receipt transaction ID: S18SVEI2705261540018095344. Receipt total: INR 43,400.'),
  ('edu-deepika-class10-2026-2027-receipt-2026-05-transport-3', 'School van / transport', 'May 2026 - Bus fee installment 3', 3420, '2026-05-27', 'NEFT/RTGS/UPI Payments', '915941195113', 'Receipt transaction ID: S18SVEI2705261540018095344. Receipt total: INR 43,400.');

do $$
declare
  target_id text;
  matched_count integer;
  id_conflict_count integer;
  duplicate_receipt_count integer;
begin
  select count(*), min(record.id)
  into matched_count, target_id
  from (
    select id, record
    from public.education_records
  ) as record
  where lower(btrim(record.record ->> 'studentName')) in ('deepika', 'juvvanupadi deepika sherlin')
    and lower(btrim(record.record ->> 'gradeCourse')) in ('class 10', 'grade 10', '10th')
    and regexp_replace(coalesce(record.record ->> 'academicYear', ''), '[^0-9]', '', 'g') in ('20262027', '202627')
    and lower(btrim(record.record ->> 'section')) = 'cds1'
    and btrim(coalesce(record.record ->> 'rollNumber', '')) = '37';

  if matched_count <> 1 then
    raise exception 'Expected exactly one Deepika Class 10, 2026-2027, CDS1, roll 37 record; found %. No changes were committed.', matched_count;
  end if;

  if (select sum(amount) from pg_temp.deepika_class10_iit_payments) <> 43400 then
    raise exception 'The imported payment lines do not add up to the receipt total of INR 43,400.';
  end if;

  if exists (
    select 1
    from pg_temp.deepika_class10_iit_exams as source
    join public.education_exams as existing on existing.id = source.id
    where existing.education_id <> target_id
  ) then
    raise exception 'An IIT exam import id already belongs to another education record. No changes were committed.';
  end if;

  if exists (
    select 1
    from pg_temp.deepika_class10_iit_payments as source
    join public.education_payments as existing on existing.id = source.id
    where existing.education_id <> target_id
  ) then
    raise exception 'A payment import id already belongs to another education record. No changes were committed.';
  end if;

  select count(*)
  into duplicate_receipt_count
  from public.education_payments as existing
  where existing.education_id = target_id
    and existing.record ->> 'reference' = '915941195113'
    and existing.id not in (select id from pg_temp.deepika_class10_iit_payments);

  if duplicate_receipt_count > 0 then
    raise exception 'A payment with this receipt UTR already exists under different ids. Review the existing entries before importing to avoid double-counting.';
  end if;

  select count(*)
  into id_conflict_count
  from pg_temp.deepika_class10_iit_payments as source
  join public.education_payments as existing on existing.id = source.id
  where existing.education_id = target_id
    and (
      existing.record ->> 'reference' is distinct from source.reference
      or (existing.record ->> 'amount')::numeric is distinct from source.amount
      or existing.record ->> 'date' is distinct from source.payment_date
    );

  if id_conflict_count > 0 then
    raise exception 'An imported payment id already exists with different receipt details. No changes were committed.';
  end if;

  insert into public.education_exams (id, education_id, position, record)
  select
    source.id,
    target_id,
    coalesce(existing.position, positions.last_position + source.source_position),
    jsonb_build_object(
      'id', source.id,
      'name', source.name,
      'assessmentType', source.assessment_type,
      'subject', source.subject,
      'date', source.exam_date,
      'marksObtained', source.marks_obtained,
      'maximumMarks', source.maximum_marks,
      'grade', '',
      'resultStatus', 'Scored',
      'teacherRemark', '',
      'notes', source.notes
    )
  from (
    select *, row_number() over (order by id)::integer as source_position
    from pg_temp.deepika_class10_iit_exams
  ) as source
  left join public.education_exams as existing on existing.id = source.id
  cross join lateral (
    select coalesce(max(prior.position), 0)::integer as last_position
    from public.education_exams as prior
    where prior.education_id = target_id
      and prior.id not in (select id from pg_temp.deepika_class10_iit_exams)
  ) as positions
  on conflict (id) do update
  set education_id = excluded.education_id,
      position = excluded.position,
      record = excluded.record;

  select count(*)
  into id_conflict_count
  from pg_temp.deepika_class10_iit_payments as source
  join public.education_payments as existing on existing.id = source.id
  where existing.education_id = target_id
    and (
      existing.record ->> 'reference' is distinct from source.reference
      or (existing.record ->> 'amount')::numeric is distinct from source.amount
      or existing.record ->> 'date' is distinct from source.payment_date
    );

  if id_conflict_count > 0 then
    raise exception 'An imported payment id already exists with different receipt details. No changes were committed.';
  end if;

  insert into public.education_payments (id, education_id, position, record)
  select
    source.id,
    target_id,
    coalesce(existing.position, positions.last_position + source.source_position),
    jsonb_build_object(
      'id', source.id,
      'feeType', source.fee_type,
      'period', source.period,
      'amount', source.amount,
      'date', source.payment_date,
      'method', source.method,
      'reference', source.reference,
      'notes', source.notes
    )
  from (
    select *, row_number() over (order by id)::integer as source_position
    from pg_temp.deepika_class10_iit_payments
  ) as source
  left join public.education_payments as existing on existing.id = source.id
  cross join lateral (
    select coalesce(max(prior.position), 0)::integer as last_position
    from public.education_payments as prior
    where prior.education_id = target_id
      and prior.id not in (select id from pg_temp.deepika_class10_iit_payments)
  ) as positions
  on conflict (id) do update
  set education_id = excluded.education_id,
      position = excluded.position,
      record = excluded.record;
end;
$$;

commit;
