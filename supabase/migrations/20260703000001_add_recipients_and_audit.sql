-- Create email_recipients table for manually added recipients
CREATE TABLE public.email_recipients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  name text,
  email text NOT NULL,
  tags text
);

-- Enable RLS
ALTER TABLE public.email_recipients ENABLE ROW LEVEL SECURITY;

-- Only authenticated admins can manage recipients
CREATE POLICY "Allow authenticated access" ON public.email_recipients
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  action text NOT NULL,
  details text,
  user_email text
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated reads for audit_logs" ON public.audit_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated inserts for audit_logs" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
