-- ===========================================================================
-- RTNLAMS — Seed Data (apply AFTER 001_schema.sql in the SQL editor)
--
-- 3 projects, 30 parcels, 60 documents, 10 hearings, 15 awards,
-- 20 audit findings, 30 risk assessments.
--
-- Parcel status is NOT set manually: the seed inserts parcels, the
-- seed_parcel_stages trigger creates 12 stage rows, then a DO block
-- advances each parcel to its target stage via raw updates — the
-- sync_parcel_status trigger derives status from completed stages.
-- Targets: p1-p8  → stage 2 (Preliminary Survey in progress)
--          p9-p16 → stage 5 (Objection Handling)
--          p17-p23 → stage 8 (Award Declaration)
--          p24-p30 → stage 11 (Title Transfer)
-- Two parcels flagged disputed afterwards; one stage given a past
-- deadline (breached) for demo.
--
-- owner_aadhaar values are 12-digit demo numbers. To test the citizen view,
-- register a citizen with aadhaar 100000000001 (parcel p1's owner).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Re-runnable: wipe any previous seed first. Deleting projects cascades to
-- parcels → stages/documents/hearings/awards/risks; the NULL-parcel audit
-- rows are not children of anything, so clear audit_logs explicitly.
-- ---------------------------------------------------------------------------
DELETE FROM public.audit_logs;
DELETE FROM public.projects;

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------
INSERT INTO public.projects (id, name, description, corridor_type, status, total_parcels, total_area_hectares, corridor_geometry) VALUES
('p-highway', 'Delhi-Mumbai Expressway (NH-148N)', 'Highway corridor demo parcel cluster near Gurugram/Delhi', 'highway', 'active', 10, 32.42, ST_GeomFromText('LINESTRING(77.1100 28.4000, 77.2450 28.5450)', 4326)),
('p-rail', 'Mumbai-Ahmedabad High-Speed Rail', 'Rail corridor demo parcel cluster north of Mumbai', 'rail', 'active', 10, 28.58, ST_GeomFromText('LINESTRING(72.8200 19.0200, 72.9650 19.1850)', 4326)),
('p-industrial', 'Dholera Industrial Estate', 'Industrial township demo parcel cluster near Dholera', 'industrial', 'planning', 10, 29.12, ST_GeomFromText('LINESTRING(72.1400 22.2000, 72.2850 22.3500)', 4326));

-- ---------------------------------------------------------------------------
-- Parcels — each row has latitude/longitude plus a generated square polygon,
-- so every seeded parcel is visible on the map after a fresh reset.
-- status stays DEFAULT 'identified'; the DO block below advances stages and
-- the trigger sets real statuses. owner_aadhaar: 12-digit demos.
-- ---------------------------------------------------------------------------
INSERT INTO public.parcels (id, project_id, parcel_number, owner_name, owner_aadhaar, area_hectares, land_use, latitude, longitude, geometry, risk_score, village, district, state) VALUES
('p1',  'p-highway',   'DL-SURV-001', 'Rajesh Kumar',    '100000000001', 5.29, 'agricultural', 28.429462, 77.154650, public.make_parcel_square(28.429462, 77.154650), 0.73, 'Sohna', 'Gurugram', 'Haryana'),
('p2',  'p-rail',      'MH-RAIL-001', 'Priya Sharma',    '100000000002', 3.95, 'commercial',   19.061000, 72.851000, public.make_parcel_square(19.061000, 72.851000), 0.59, 'Bandra East', 'Mumbai Suburban', 'Maharashtra'),
('p3',  'p-industrial','GJ-DHL-001',  'Aman Singh',      '100000000003', 1.54, 'industrial',   22.245000, 72.190000, public.make_parcel_square(22.245000, 72.190000), 0.53, 'Dholera', 'Ahmedabad', 'Gujarat'),
('p4',  'p-highway',   'DL-SURV-002', 'Sunita Devi',     '100000000004', 2.55, 'industrial',   28.441000, 77.166000, public.make_parcel_square(28.441000, 77.166000), 0.12, 'Sohna', 'Gurugram', 'Haryana'),
('p5',  'p-rail',      'MH-RAIL-002', 'Vikram Patel',    '100000000005', 2.99, 'commercial',   19.073000, 72.864000, public.make_parcel_square(19.073000, 72.864000), 0.24, 'Kurla', 'Mumbai Suburban', 'Maharashtra'),
('p6',  'p-industrial','GJ-DHL-002',  'Anjali Mehta',    '100000000006', 1.63, 'residential',  22.257000, 72.203000, public.make_parcel_square(22.257000, 72.203000), 0.53, 'Dholera', 'Ahmedabad', 'Gujarat'),
('p7',  'p-highway',   'DL-SURV-003', 'Suresh Yadav',    '100000000007', 2.49, 'barren',       28.452000, 77.178000, public.make_parcel_square(28.452000, 77.178000), 0.78, 'Sohna', 'Gurugram', 'Haryana'),
('p8',  'p-rail',      'MH-RAIL-003', 'Kavita Rao',      '100000000008', 4.25, 'commercial',   19.086000, 72.878000, public.make_parcel_square(19.086000, 72.878000), 0.92, 'Ghatkopar', 'Mumbai Suburban', 'Maharashtra'),
('p9',  'p-industrial','GJ-DHL-003',  'Arjun Nair',      '100000000009', 1.56, 'industrial',   22.270000, 72.216000, public.make_parcel_square(22.270000, 72.216000), 0.34, 'Dholera', 'Ahmedabad', 'Gujarat'),
('p10', 'p-highway',   'DL-SURV-004', 'Neha Gupta',      '100000000010', 3.14, 'barren',       28.464000, 77.191000, public.make_parcel_square(28.464000, 77.191000), 0.87, 'Bhondsi', 'Gurugram', 'Haryana'),
('p11', 'p-rail',      'MH-RAIL-004', 'Ramesh Chandra',  '100000000011', 2.45, 'barren',       19.099000, 72.891000, public.make_parcel_square(19.099000, 72.891000), 0.38, 'Vikhroli', 'Mumbai Suburban', 'Maharashtra'),
('p12', 'p-industrial','GJ-DHL-004',  'Pooja Verma',     '100000000012', 4.09, 'residential',  22.283000, 72.229000, public.make_parcel_square(22.283000, 72.229000), 0.36, 'Dholera', 'Ahmedabad', 'Gujarat'),
('p13', 'p-highway',   'DL-SURV-005', 'Mohammed Khan',   '100000000013', 5.30, 'barren',       28.476000, 77.204000, public.make_parcel_square(28.476000, 77.204000), 0.60, 'Bhondsi', 'Gurugram', 'Haryana'),
('p14', 'p-rail',      'MH-RAIL-005', 'Lakshmi Iyer',    '100000000014', 2.27, 'residential',  19.112000, 72.904000, public.make_parcel_square(19.112000, 72.904000), 0.63, 'Bhandup', 'Mumbai Suburban', 'Maharashtra'),
('p15', 'p-industrial','GJ-DHL-005',  'Harpreet Kaur',   '100000000015', 1.15, 'commercial',   22.296000, 72.242000, public.make_parcel_square(22.296000, 72.242000), 0.73, 'Dholera', 'Ahmedabad', 'Gujarat'),
('p16', 'p-highway',   'DL-SURV-006', 'Deepak Joshi',    '100000000016', 1.08, 'agricultural', 28.488000, 77.217000, public.make_parcel_square(28.488000, 77.217000), 0.88, 'Badshahpur', 'Gurugram', 'Haryana'),
('p17', 'p-rail',      'MH-RAIL-006', 'Sanjay Mishra',   '100000000017', 4.35, 'residential',  19.125000, 72.917000, public.make_parcel_square(19.125000, 72.917000), 0.85, 'Mulund', 'Mumbai Suburban', 'Maharashtra'),
('p18', 'p-industrial','GJ-DHL-006',  'Rekha Jain',      '100000000018', 2.79, 'agricultural', 22.309000, 72.255000, public.make_parcel_square(22.309000, 72.255000), 0.67, 'Dholera', 'Ahmedabad', 'Gujarat'),
('p19', 'p-highway',   'DL-SURV-007', 'Imran Ali',       '100000000019', 1.19, 'agricultural', 28.500000, 77.230000, public.make_parcel_square(28.500000, 77.230000), 0.42, 'Badshahpur', 'Gurugram', 'Haryana'),
('p20', 'p-rail',      'MH-RAIL-007', 'Gita Nair',       '100000000020', 1.40, 'residential',  19.138000, 72.930000, public.make_parcel_square(19.138000, 72.930000), 0.60, 'Thane West', 'Thane', 'Maharashtra'),
('p21', 'p-industrial','GJ-DHL-007',  'Rohit Desai',     '100000000021', 4.53, 'residential',  22.322000, 72.268000, public.make_parcel_square(22.322000, 72.268000), 0.90, 'Dholera', 'Ahmedabad', 'Gujarat'),
('p22', 'p-highway',   'DL-SURV-008', 'Sunil Kumar',     '100000000022', 3.75, 'agricultural', 28.512000, 77.243000, public.make_parcel_square(28.512000, 77.243000), 0.48, 'Sector 67', 'Gurugram', 'Haryana'),
('p23', 'p-rail',      'MH-RAIL-008', 'Meena Kumari',    '100000000023', 4.40, 'agricultural', 19.151000, 72.943000, public.make_parcel_square(19.151000, 72.943000), 0.70, 'Thane West', 'Thane', 'Maharashtra'),
('p24', 'p-industrial','GJ-DHL-008',  'Ashok Singh',     '100000000024', 3.02, 'residential',  22.335000, 72.281000, public.make_parcel_square(22.335000, 72.281000), 0.19, 'Dholera', 'Ahmedabad', 'Gujarat'),
('p25', 'p-highway',   'DL-SURV-009', 'Shalini Rao',     '100000000025', 2.90, 'residential',  28.524000, 77.256000, public.make_parcel_square(28.524000, 77.256000), 0.54, 'Sector 67', 'Gurugram', 'Haryana'),
('p26', 'p-rail',      'MH-RAIL-009', 'Nitin Agrawal',   '100000000026', 1.48, 'commercial',   19.164000, 72.956000, public.make_parcel_square(19.164000, 72.956000), 0.66, 'Majiwada', 'Thane', 'Maharashtra'),
('p27', 'p-industrial','GJ-DHL-009',  'Poonam Devi',     '100000000027', 4.09, 'residential',  22.348000, 72.294000, public.make_parcel_square(22.348000, 72.294000), 0.25, 'Dholera', 'Ahmedabad', 'Gujarat'),
('p28', 'p-highway',   'DL-SURV-010', 'Vijay Kumar',     '100000000028', 2.93, 'residential',  28.536000, 77.269000, public.make_parcel_square(28.536000, 77.269000), 0.13, 'Sector 70A', 'Gurugram', 'Haryana'),
('p29', 'p-rail',      'MH-RAIL-010', 'Anita Sharma',    '100000000029', 1.96, 'industrial',   19.177000, 72.969000, public.make_parcel_square(19.177000, 72.969000), 0.63, 'Majiwada', 'Thane', 'Maharashtra'),
('p30', 'p-industrial','GJ-DHL-010',  'Rajendra Prasad', '100000000030', 4.56, 'commercial',   22.361000, 72.307000, public.make_parcel_square(22.361000, 72.307000), 0.74, 'Dholera', 'Ahmedabad', 'Gujarat');

-- ---------------------------------------------------------------------------
-- Advance parcels to their target stages. Runs as superuser in the SQL
-- editor (bypasses RLS); sync_parcel_status trigger derives statuses.
-- For each parcel: complete stages < target, set target in_progress with a
-- fresh SLA clock (future deadline, except one deliberate breach below).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  rec RECORD;
  v_target INT;
  v_sla INT;
BEGIN
  FOR rec IN SELECT id FROM public.parcels ORDER BY id LOOP
    -- spread: p1-p8 stage 2, p9-p16 stage 5, p17-p23 stage 8, p24-p30 stage 11
    v_target := CASE
      WHEN rec.id IN ('p1','p2','p3','p4','p5','p6','p7','p8') THEN 2
      WHEN rec.id IN ('p9','p10','p11','p12','p13','p14','p15','p16') THEN 5
      WHEN rec.id IN ('p17','p18','p19','p20','p21','p22','p23') THEN 8
      ELSE 11
    END;

    UPDATE public.acquisition_stages
    SET status = 'completed',
        completed_at = NOW() - (interval '30 days' * (v_target - stage_number))
    WHERE parcel_id = rec.id AND stage_number < v_target;

    SELECT sla_days INTO v_sla FROM public.stage_defs WHERE stage_number = v_target;

    UPDATE public.acquisition_stages
    SET status = 'in_progress',
        sla_deadline = NOW() + make_interval(days => COALESCE(v_sla, 30)) / 2  -- midway clock
    WHERE parcel_id = rec.id AND stage_number = v_target;
  END LOOP;
END $$;

-- Two disputed parcels (manual flag; trigger will not overwrite)
UPDATE public.parcels SET status = 'disputed' WHERE id IN ('p4', 'p25');

-- One breached stage for demo: p8's in-progress stage overdue
UPDATE public.acquisition_stages
SET status = 'breached', sla_deadline = NOW() - interval '3 days'
WHERE parcel_id = 'p8' AND stage_number = 2;

-- ---------------------------------------------------------------------------
-- Documents (2 per parcel; file_url = storage path within documents bucket —
-- files themselves don't exist in a fresh project, demo rows only)
-- ---------------------------------------------------------------------------
INSERT INTO public.documents (id, parcel_id, doc_type, file_url, file_name, language, status, ocr_confidence) VALUES
('d1_1', 'p1', 'deed', 'p1/doc1.pdf', 'doc1.pdf', 'hi', 'flagged', 0.66),
('d1_2', 'p1', 'deed', 'p1/doc2.pdf', 'doc2.pdf', 'ur', 'uploaded', 0.58),
('d2_1', 'p2', 'deed', 'p2/doc1.pdf', 'doc1.pdf', 'hi', 'uploaded', 0.84),
('d2_2', 'p2', 'deed', 'p2/doc2.pdf', 'doc2.pdf', 'hi', 'uploaded', 0.72),
('d3_1', 'p3', 'survey_map', 'p3/doc1.pdf', 'doc1.pdf', 'en', 'verified', 0.73),
('d3_2', 'p3', 'survey_map', 'p3/doc2.pdf', 'doc2.pdf', 'hi', 'uploaded', 0.83),
('d4_1', 'p4', 'survey_map', 'p4/doc1.pdf', 'doc1.pdf', 'en', 'extracted', 0.75),
('d4_2', 'p4', 'deed', 'p4/doc2.pdf', 'doc2.pdf', 'en', 'uploaded', 0.93),
('d5_1', 'p5', 'handwritten_deed', 'p5/doc1.pdf', 'doc1.pdf', 'en', 'verified', 0.46),
('d5_2', 'p5', 'deed', 'p5/doc2.pdf', 'doc2.pdf', 'ur', 'processing', 0.60),
('d6_1', 'p6', 'survey_map', 'p6/doc1.pdf', 'doc1.pdf', 'en', 'extracted', 0.90),
('d6_2', 'p6', 'survey_map', 'p6/doc2.pdf', 'doc2.pdf', 'hi', 'uploaded', 0.61),
('d7_1', 'p7', 'handwritten_deed', 'p7/doc1.pdf', 'doc1.pdf', 'hi', 'flagged', 0.48),
('d7_2', 'p7', 'handwritten_deed', 'p7/doc2.pdf', 'doc2.pdf', 'en', 'processing', 0.56),
('d8_1', 'p8', 'handwritten_deed', 'p8/doc1.pdf', 'doc1.pdf', 'ur', 'extracted', 0.45),
('d8_2', 'p8', 'deed', 'p8/doc2.pdf', 'doc2.pdf', 'en', 'processing', 0.94),
('d9_1', 'p9', 'deed', 'p9/doc1.pdf', 'doc1.pdf', 'hi', 'flagged', 0.55),
('d9_2', 'p9', 'handwritten_deed', 'p9/doc2.pdf', 'doc2.pdf', 'en', 'processing', 0.82),
('d10_1', 'p10', 'deed', 'p10/doc1.pdf', 'doc1.pdf', 'en', 'flagged', 0.91),
('d10_2', 'p10', 'survey_map', 'p10/doc2.pdf', 'doc2.pdf', 'hi', 'uploaded', 0.49),
('d11_1', 'p11', 'survey_map', 'p11/doc1.pdf', 'doc1.pdf', 'ur', 'flagged', 0.95),
('d11_2', 'p11', 'handwritten_deed', 'p11/doc2.pdf', 'doc2.pdf', 'hi', 'uploaded', 0.77),
('d12_1', 'p12', 'survey_map', 'p12/doc1.pdf', 'doc1.pdf', 'hi', 'flagged', 0.60),
('d12_2', 'p12', 'survey_map', 'p12/doc2.pdf', 'doc2.pdf', 'hi', 'processing', 0.59),
('d13_1', 'p13', 'handwritten_deed', 'p13/doc1.pdf', 'doc1.pdf', 'en', 'flagged', 0.93),
('d13_2', 'p13', 'handwritten_deed', 'p13/doc2.pdf', 'doc2.pdf', 'en', 'processing', 0.57),
('d14_1', 'p14', 'survey_map', 'p14/doc1.pdf', 'doc1.pdf', 'ur', 'verified', 0.74),
('d14_2', 'p14', 'handwritten_deed', 'p14/doc2.pdf', 'doc2.pdf', 'ur', 'uploaded', 0.75),
('d15_1', 'p15', 'handwritten_deed', 'p15/doc1.pdf', 'doc1.pdf', 'hi', 'extracted', 0.64),
('d15_2', 'p15', 'handwritten_deed', 'p15/doc2.pdf', 'doc2.pdf', 'hi', 'processing', 0.92),
('d16_1', 'p16', 'deed', 'p16/doc1.pdf', 'doc1.pdf', 'ur', 'extracted', 0.52),
('d16_2', 'p16', 'survey_map', 'p16/doc2.pdf', 'doc2.pdf', 'en', 'uploaded', 0.82),
('d17_1', 'p17', 'handwritten_deed', 'p17/doc1.pdf', 'doc1.pdf', 'en', 'flagged', 0.54),
('d17_2', 'p17', 'survey_map', 'p17/doc2.pdf', 'doc2.pdf', 'hi', 'uploaded', 0.73),
('d18_1', 'p18', 'survey_map', 'p18/doc1.pdf', 'doc1.pdf', 'hi', 'verified', 0.72),
('d18_2', 'p18', 'handwritten_deed', 'p18/doc2.pdf', 'doc2.pdf', 'ur', 'processing', 0.54),
('d19_1', 'p19', 'deed', 'p19/doc1.pdf', 'doc1.pdf', 'en', 'uploaded', 0.66),
('d19_2', 'p19', 'survey_map', 'p19/doc2.pdf', 'doc2.pdf', 'ur', 'uploaded', 0.69),
('d20_1', 'p20', 'handwritten_deed', 'p20/doc1.pdf', 'doc1.pdf', 'hi', 'flagged', 0.91),
('d20_2', 'p20', 'deed', 'p20/doc2.pdf', 'doc2.pdf', 'en', 'uploaded', 0.70),
('d21_1', 'p21', 'survey_map', 'p21/doc1.pdf', 'doc1.pdf', 'en', 'flagged', 0.82),
('d21_2', 'p21', 'survey_map', 'p21/doc2.pdf', 'doc2.pdf', 'en', 'processing', 0.82),
('d22_1', 'p22', 'handwritten_deed', 'p22/doc1.pdf', 'doc1.pdf', 'hi', 'uploaded', 0.73),
('d22_2', 'p22', 'deed', 'p22/doc2.pdf', 'doc2.pdf', 'en', 'processing', 0.96),
('d23_1', 'p23', 'handwritten_deed', 'p23/doc1.pdf', 'doc1.pdf', 'hi', 'verified', 0.69),
('d23_2', 'p23', 'handwritten_deed', 'p23/doc2.pdf', 'doc2.pdf', 'en', 'uploaded', 0.87),
('d24_1', 'p24', 'deed', 'p24/doc1.pdf', 'doc1.pdf', 'en', 'uploaded', 0.83),
('d24_2', 'p24', 'handwritten_deed', 'p24/doc2.pdf', 'doc2.pdf', 'en', 'uploaded', 0.91),
('d25_1', 'p25', 'deed', 'p25/doc1.pdf', 'doc1.pdf', 'en', 'uploaded', 0.59),
('d25_2', 'p25', 'handwritten_deed', 'p25/doc2.pdf', 'doc2.pdf', 'ur', 'uploaded', 0.70),
('d26_1', 'p26', 'handwritten_deed', 'p26/doc1.pdf', 'doc1.pdf', 'hi', 'extracted', 0.77),
('d26_2', 'p26', 'survey_map', 'p26/doc2.pdf', 'doc2.pdf', 'en', 'processing', 0.72),
('d27_1', 'p27', 'deed', 'p27/doc1.pdf', 'doc1.pdf', 'en', 'uploaded', 0.96),
('d27_2', 'p27', 'deed', 'p27/doc2.pdf', 'doc2.pdf', 'en', 'uploaded', 0.92),
('d28_1', 'p28', 'handwritten_deed', 'p28/doc1.pdf', 'doc1.pdf', 'ur', 'extracted', 0.84),
('d28_2', 'p28', 'survey_map', 'p28/doc2.pdf', 'doc2.pdf', 'ur', 'processing', 0.69),
('d29_1', 'p29', 'handwritten_deed', 'p29/doc1.pdf', 'doc1.pdf', 'en', 'extracted', 0.96),
('d29_2', 'p29', 'handwritten_deed', 'p29/doc2.pdf', 'doc2.pdf', 'en', 'uploaded', 0.85),
('d30_1', 'p30', 'survey_map', 'p30/doc1.pdf', 'doc1.pdf', 'en', 'uploaded', 0.48),
('d30_2', 'p30', 'survey_map', 'p30/doc2.pdf', 'doc2.pdf', 'en', 'processing', 0.80);

-- ---------------------------------------------------------------------------
-- Hearings (10)
-- ---------------------------------------------------------------------------
INSERT INTO public.hearings (id, parcel_id, hearing_date, type, outcome, notes) VALUES
('h1', 'p1', NOW() + interval '1 day', 'valuation', 'Valuation hearing for p1 — outcome pending', 'Generated seed hearing'),
('h2', 'p2', NOW() + interval '2 days', 'objection', 'Objection hearing for p2 — outcome pending', 'Generated seed hearing'),
('h3', 'p3', NOW() + interval '3 days', 'final', 'Final hearing for p3 — outcome pending', 'Generated seed hearing'),
('h4', 'p4', NOW() + interval '4 days', 'public', 'Public hearing for p4 — outcome pending', 'Generated seed hearing'),
('h5', 'p5', NOW() + interval '5 days', 'objection', 'Objection hearing for p5 — outcome pending', 'Generated seed hearing'),
('h6', 'p6', NOW() + interval '6 days', 'final', 'Final hearing for p6 — outcome pending', 'Generated seed hearing'),
('h7', 'p7', NOW() + interval '7 days', 'objection', 'Objection hearing for p7 — outcome pending', 'Generated seed hearing'),
('h8', 'p8', NOW() + interval '8 days', 'public', 'Public hearing for p8 — outcome pending', 'Generated seed hearing'),
('h9', 'p9', NOW() + interval '9 days', 'public', 'Public hearing for p9 — outcome pending', 'Generated seed hearing'),
('h10', 'p10', NOW() + interval '10 days', 'valuation', 'Valuation hearing for p10 — outcome pending', 'Generated seed hearing');

-- ---------------------------------------------------------------------------
-- Compensation Awards (15)
-- ---------------------------------------------------------------------------
INSERT INTO public.compensation_awards (id, parcel_id, calculated_amount, awarded_amount, payment_status, payment_reference) VALUES
('c1', 'p1', 7174202, 7235908, 'failed', NULL),
('c2', 'p2', 6944753, 6914684, 'failed', NULL),
('c3', 'p3', 7285016, 7467381, 'completed', 'REF0003'),
('c4', 'p4', 2143523, 2178780, 'completed', 'REF0004'),
('c5', 'p5', 4051557, 4126515, 'completed', 'REF0005'),
('c6', 'p6', 6981195, 7087222, 'pending', NULL),
('c7', 'p7', 5765267, 5775688, 'failed', NULL),
('c8', 'p8', 6501223, 6679339, 'initiated', NULL),
('c9', 'p9', 8192975, 8357567, 'pending', NULL),
('c10', 'p10', 4084356, 4005836, 'initiated', NULL),
('c11', 'p11', 5338108, 5532392, 'initiated', NULL),
('c12', 'p12', 5884158, 5929640, 'pending', NULL),
('c13', 'p13', 2438793, 2397495, 'failed', NULL),
('c14', 'p14', 4558514, 4570563, 'completed', 'REF0014'),
('c15', 'p15', 4487035, 4427607, 'completed', 'REF0015');

-- ---------------------------------------------------------------------------
-- Audit Logs (20: mix severities, some project-level)
-- ---------------------------------------------------------------------------
INSERT INTO public.audit_logs (id, parcel_id, audit_type, finding, severity, resolved) VALUES
('a1', 'p1', 'field', 'Field verification mismatch for p1 — boundary differs from survey record', 'high', false),
('a2', NULL, 'satellite', 'Encroachment detected along NH-148N km 42-45', 'critical', false),
('a3', 'p3', 'field', 'Field verification mismatch for p3', 'high', false),
('a4', NULL, 'field', 'Field verification mismatch — corridor section B', 'medium', true),
('a5', 'p5', 'field', 'Field verification mismatch for p5', 'medium', true),
('a6', NULL, 'field', 'Field verification mismatch — corridor section C', 'medium', false),
('a7', 'p7', 'satellite', 'Encroachment detected on p7 — temporary structure', 'critical', false),
('a8', NULL, 'satellite', 'Encroachment detected — rail alignment km 12', 'high', false),
('a9', 'p9', 'satellite', 'Encroachment detected on p9', 'high', false),
('a10', NULL, 'satellite', 'Encroachment detected — Dholera block 3', 'medium', false),
('a11', 'p11', 'compliance', 'SIA report compliance check for p11 — families count mismatch', 'critical', false),
('a12', NULL, 'field', 'Field verification mismatch — corridor section D', 'high', false),
('a13', 'p13', 'field', 'Field verification mismatch for p13', 'high', false),
('a14', NULL, 'compliance', 'Notification U/S 19 compliance check — batch 2', 'critical', false),
('a15', 'p15', 'compliance', 'Compliance check for p15 — award timeline', 'high', false),
('a16', NULL, 'compliance', 'Compliance check — escrow deposit reconciliation', 'low', false),
('a17', 'p17', 'field', 'Field verification mismatch for p17', 'critical', false),
('a18', NULL, 'satellite', 'Encroachment detected — viaduct section km 88', 'high', false),
('a19', 'p19', 'field', 'Field verification mismatch for p19', 'critical', false),
('a20', NULL, 'field', 'Field verification mismatch — corridor section E', 'low', true);

-- ---------------------------------------------------------------------------
-- Risk Assessments (30)
-- ---------------------------------------------------------------------------
INSERT INTO public.risk_assessments (id, parcel_id, ownership_score, litigation_score, compensation_sla_score, completeness_score, document_quality_score, area_discrepancy_score, encroachment_score, overall_risk, risk_level, factors) VALUES
('r1', 'p1', 0.25, 0.87, 0.20, 0.12, 0.38, 0.39, 0.83, 0.40, 'medium', '{"weights":"ownership 0.25"}'),
('r2', 'p2', 0.81, 0.71, 0.45, 0.53, 0.29, 0.77, 0.41, 0.62, 'high', '{"weights":"ownership 0.25"}'),
('r3', 'p3', 0.33, 0.61, 0.22, 0.35, 0.84, 0.18, 0.21, 0.40, 'medium', '{"weights":"ownership 0.25"}'),
('r4', 'p4', 0.26, 0.30, 0.44, 0.30, 0.37, 0.30, 0.29, 0.32, 'medium', '{"weights":"ownership 0.25"}'),
('r5', 'p5', 0.59, 0.37, 0.40, 0.71, 0.15, 0.22, 0.78, 0.46, 'medium', '{"weights":"ownership 0.25"}'),
('r6', 'p6', 0.44, 0.72, 0.21, 0.52, 0.78, 0.37, 0.71, 0.51, 'medium', '{"weights":"ownership 0.25"}'),
('r7', 'p7', 0.59, 0.42, 0.90, 0.41, 0.48, 0.60, 0.35, 0.55, 'medium', '{"weights":"ownership 0.25"}'),
('r8', 'p8', 0.77, 0.58, 0.57, 0.53, 0.89, 0.89, 0.77, 0.69, 'high', '{"weights":"ownership 0.25"}'),
('r9', 'p9', 0.46, 0.43, 0.52, 0.14, 0.19, 0.90, 0.20, 0.42, 'medium', '{"weights":"ownership 0.25"}'),
('r10', 'p10', 0.85, 0.64, 0.83, 0.16, 0.34, 0.74, 0.11, 0.60, 'high', '{"weights":"ownership 0.25"}'),
('r11', 'p11', 0.18, 0.38, 0.24, 0.22, 0.64, 0.17, 0.88, 0.32, 'medium', '{"weights":"ownership 0.25"}'),
('r12', 'p12', 0.62, 0.14, 0.82, 0.29, 0.49, 0.55, 0.21, 0.46, 'medium', '{"weights":"ownership 0.25"}'),
('r13', 'p13', 0.50, 0.15, 0.26, 0.83, 0.76, 0.52, 0.65, 0.48, 'medium', '{"weights":"ownership 0.25"}'),
('r14', 'p14', 0.80, 0.21, 0.49, 0.21, 0.19, 0.19, 0.27, 0.40, 'medium', '{"weights":"ownership 0.25"}'),
('r15', 'p15', 0.14, 0.27, 0.40, 0.60, 0.79, 0.82, 0.67, 0.43, 'medium', '{"weights":"ownership 0.25"}'),
('r16', 'p16', 0.51, 0.83, 0.23, 0.18, 0.75, 0.60, 0.27, 0.50, 'medium', '{"weights":"ownership 0.25"}'),
('r17', 'p17', 0.40, 0.34, 0.44, 0.44, 0.42, 0.74, 0.75, 0.45, 'medium', '{"weights":"ownership 0.25"}'),
('r18', 'p18', 0.55, 0.48, 0.33, 0.71, 0.89, 0.28, 0.66, 0.54, 'medium', '{"weights":"ownership 0.25"}'),
('r19', 'p19', 0.66, 0.63, 0.12, 0.54, 0.26, 0.26, 0.56, 0.47, 'medium', '{"weights":"ownership 0.25"}'),
('r20', 'p20', 0.62, 0.60, 0.69, 0.66, 0.48, 0.14, 0.72, 0.58, 'medium', '{"weights":"ownership 0.25"}'),
('r21', 'p21', 0.76, 0.77, 0.58, 0.13, 0.26, 0.19, 0.61, 0.53, 'medium', '{"weights":"ownership 0.25"}'),
('r22', 'p22', 0.54, 0.25, 0.86, 0.88, 0.82, 0.47, 0.33, 0.59, 'medium', '{"weights":"ownership 0.25"}'),
('r23', 'p23', 0.27, 0.76, 0.66, 0.32, 0.82, 0.56, 0.43, 0.53, 'medium', '{"weights":"ownership 0.25"}'),
('r24', 'p24', 0.43, 0.68, 0.46, 0.63, 0.20, 0.66, 0.32, 0.51, 'medium', '{"weights":"ownership 0.25"}'),
('r25', 'p25', 0.83, 0.27, 0.37, 0.53, 0.41, 0.52, 0.84, 0.53, 'medium', '{"weights":"ownership 0.25"}'),
('r26', 'p26', 0.26, 0.72, 0.65, 0.73, 0.46, 0.46, 0.38, 0.53, 'medium', '{"weights":"ownership 0.25"}'),
('r27', 'p27', 0.48, 0.30, 0.25, 0.48, 0.25, 0.48, 0.56, 0.39, 'medium', '{"weights":"ownership 0.25"}'),
('r28', 'p28', 0.35, 0.24, 0.58, 0.79, 0.28, 0.59, 0.63, 0.46, 'medium', '{"weights":"ownership 0.25"}'),
('r29', 'p29', 0.81, 0.65, 0.35, 0.27, 0.77, 0.34, 0.11, 0.54, 'medium', '{"weights":"ownership 0.25"}'),
('r30', 'p30', 0.80, 0.26, 0.35, 0.36, 0.30, 0.68, 0.37, 0.48, 'medium', '{"weights":"ownership 0.25"}');

-- ===========================================================================
-- Verify: 30 parcels, 360 stage rows (30x12), statuses spread:
--   identified (p1-p3,p5-p8 minus disputed/breached → stage<4),
--   notified   (p9-p16, stage 5),
--   surveyed   (p17-p23, stage 8),
--   acquired   (p24-p30, stage 11),
--   disputed   (p4, p25), breached stage row on p8.
--   map check:
--     SELECT count(*) total,
--            count(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL) with_lat_lng,
--            count(*) FILTER (WHERE geometry IS NOT NULL) with_geometry
--     FROM public.parcels;
-- ===========================================================================
