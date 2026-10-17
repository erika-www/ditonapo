ALTER TABLE public.passenger_journeys
  ADD COLUMN IF NOT EXISTS passenger_category TEXT NOT NULL DEFAULT 'Regular';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'passenger_journeys_passenger_category_check'
      AND conrelid = 'public.passenger_journeys'::regclass
  ) THEN
    ALTER TABLE public.passenger_journeys
      ADD CONSTRAINT passenger_journeys_passenger_category_check
      CHECK (passenger_category IN ('Regular', 'Student', 'Senior Citizen', 'PWD', 'Pregnant'));
  END IF;
END;
$$;