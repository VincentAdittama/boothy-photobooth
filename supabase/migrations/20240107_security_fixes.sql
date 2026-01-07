-- Enable RLS
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_photo_captures ENABLE ROW LEVEL SECURITY;

-- Policies for 'uploads'
-- Allow public inserts (used by Booth.jsx / uploadPhoto)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'uploads' AND policyname = 'Allow public insert on uploads'
    ) THEN
        CREATE POLICY "Allow public insert on uploads" ON public.uploads
            FOR INSERT WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'uploads' AND policyname = 'Allow public select on uploads'
    ) THEN
        CREATE POLICY "Allow public select on uploads" ON public.uploads
            FOR SELECT USING (true);
    END IF;
END $$;

-- Policies for 'live_photo_captures'
-- Allow public inserts (used by uploadLivePhotoCapture)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'live_photo_captures' AND policyname = 'Allow public insert on live_photo_captures'
    ) THEN
        CREATE POLICY "Allow public insert on live_photo_captures" ON public.live_photo_captures
            FOR INSERT WITH CHECK (true);
    END IF;
END $$;

-- No SELECT policy defined for public means access is denied by default when RLS is enabled.
-- This protects the 'session_id' column from being exposed via the API.
