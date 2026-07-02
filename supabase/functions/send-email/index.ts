import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { SmtpClient } from "https://deno.land/x/smtp/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { subject, htmlBody, toEmail, bulk } = await req.json();

    // Verify authentication
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // If it's a bulk email, ensure the user is an admin (authenticated)
    if (bulk) {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const smtpClient = new SmtpClient();
    
    // Connect to Google Workspace SMTP
    await smtpClient.connectTLS({
      hostname: "smtp.gmail.com",
      port: 465,
      username: Deno.env.get('SMTP_EMAIL') ?? '',
      password: Deno.env.get('SMTP_PASSWORD') ?? '',
    });

    if (bulk) {
      // Fetch all complainants
      const { data: complaints, error } = await supabaseClient
        .from('complaints')
        .select('email, fullname');

      if (error) throw error;

      // Send email to each (batching might be needed for very large lists, but doing a loop for now)
      for (const complainant of complaints) {
        if (complainant.email) {
          await smtpClient.send({
            from: Deno.env.get('SMTP_EMAIL') ?? '',
            to: complainant.email,
            subject: subject,
            content: "text/html",
            html: htmlBody.replace("{{name}}", complainant.fullname || "User"),
          });
        }
      }
    } else if (toEmail) {
      // Send single confirmation email
      await smtpClient.send({
        from: Deno.env.get('SMTP_EMAIL') ?? '',
        to: toEmail,
        subject: subject,
        content: "text/html",
        html: htmlBody,
      });
    }

    await smtpClient.close();

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
