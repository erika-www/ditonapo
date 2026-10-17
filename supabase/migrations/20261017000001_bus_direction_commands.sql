CREATE TABLE IF NOT EXISTS public.bus_direction_commands (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    bus_id UUID NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('Northbound', 'Southbound')),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bus_direction_commands_bus_id_id
    ON public.bus_direction_commands(bus_id, id);

ALTER TABLE public.bus_direction_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bus_direction_commands FROM anon, authenticated;
GRANT ALL ON public.bus_direction_commands TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.bus_direction_commands_id_seq TO service_role;