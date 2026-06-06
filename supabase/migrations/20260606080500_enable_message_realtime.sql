GRANT SELECT ON public.messages TO anon, authenticated;

DROP POLICY IF EXISTS "public can read messages" ON public.messages;
CREATE POLICY "public can read messages"
  ON public.messages
  FOR SELECT
  TO anon, authenticated
  USING (true);

ALTER TABLE public.messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
