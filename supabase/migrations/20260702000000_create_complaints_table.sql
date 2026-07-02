-- Create the complaints table
CREATE TABLE public.complaints (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  fullname text,
  email text,
  phone text,
  businessName text,
  gender text,
  affected text,
  country text,
  state text,
  city text,
  address text,
  zipcode text,
  category text,
  scammethod text,
  timesscammed text,
  timespaid text,
  lossamount text,
  scammerhandle text,
  datepaymentmade text,
  personalinfosent text
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (since the form is public)
CREATE POLICY "Allow public inserts" ON public.complaints
  FOR INSERT
  WITH CHECK (true);

-- Allow only authenticated users (admins) to select (read)
CREATE POLICY "Allow authenticated reads" ON public.complaints
  FOR SELECT
  USING (auth.role() = 'authenticated');
