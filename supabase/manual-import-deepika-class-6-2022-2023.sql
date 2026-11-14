-- Deepika Class VI, Section CDS.2, Roll 23, academic year 2022-2023.
-- Updates the existing education record only. No marks or assessments are
-- added because they were not present in the supplied report image.

begin;

do $$
declare
  matched_count integer;
begin
  select count(*)
  into matched_count
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

  update public.education_records as edu
  set record = edu.record || jsonb_build_object(
    'studentName', 'J Deepika',
    'institution', 'Viswasanthi Senior Secondary Residential School',
    'boardUniversity', 'Central Board of Secondary Education (CBSE)',
    'gradeCourse', 'Class VI',
    'section', 'CDS.2',
    'rollNumber', '23',
    'notes', case
      when coalesce(edu.record ->> 'notes', '') ilike
        '%School location: Vuyyuru, Krishna District, Andhra Pradesh.%'
        then edu.record ->> 'notes'
      else concat_ws(
        E'\n',
        nullif(btrim(coalesce(edu.record ->> 'notes', '')), ''),
        'School location: Vuyyuru, Krishna District, Andhra Pradesh.'
      )
    end
  )
  where edu.id = '0e3a4ad5-51da-4632-af11-3783f417d92a';
end;
$$;

commit;

select
  edu.id,
  edu.record ->> 'studentName' as student_name,
  edu.record ->> 'institution' as school,
  edu.record ->> 'boardUniversity' as board,
  edu.record ->> 'gradeCourse' as class,
  edu.record ->> 'academicYear' as academic_year,
  edu.record ->> 'section' as section,
  edu.record ->> 'rollNumber' as roll_number
from public.education_records as edu
where edu.id = '0e3a4ad5-51da-4632-af11-3783f417d92a';
