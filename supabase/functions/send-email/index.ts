import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { SmtpClient } from "https://deno.land/x/smtp/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { subject, htmlBody, toEmail, toEmails, bulk, smtpSettings, attachments } = await req.json();

    // Verify authentication
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // If it's bulk or custom recipients list, ensure user is authenticated
    if (bulk || toEmails || smtpSettings) {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Determine SMTP configuration (dynamic settings from client OR fallback to Env vars)
    const isDynamic = smtpSettings && smtpSettings.enabled;
    const hostname = isDynamic ? smtpSettings.host : "smtp.gmail.com";
    const port = isDynamic ? parseInt(smtpSettings.port) : 465;
    const username = isDynamic ? smtpSettings.user : (Deno.env.get('SMTP_EMAIL') ?? '');
    const password = isDynamic ? smtpSettings.pass : (Deno.env.get('SMTP_PASSWORD') ?? '');
    const fromName = isDynamic ? smtpSettings.fromName : "IC3 Complaints Team";
    const fromEmail = isDynamic ? smtpSettings.fromEmail : username;

    if (!username || !password) {
      throw new Error("SMTP credentials are not configured.");
    }

    const smtpClient = new SmtpClient();
    
    // Connect
    if (port === 465) {
      await smtpClient.connectTLS({ hostname, port, username, password });
    } else {
      await smtpClient.connect({ hostname, port, username, password });
    }

    // Process attachments
    const formattedAttachments = [];
    if (attachments && Array.isArray(attachments)) {
      for (const att of attachments) {
        if (att.filename && att.content) {
          formattedAttachments.push({
            filename: att.filename,
            content: decode(att.content),
            contentType: att.contentType || "application/octet-stream"
          });
        }
      }
    }

    const senderIdentity = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;

    // Send emails
    if (bulk) {
      // Send to all complainants
      const { data: complaints, error } = await supabaseClient
        .from('complaints')
        .select('email, fullname');

      if (error) throw error;

      for (const complainant of complaints) {
        if (complainant.email) {
          await smtpClient.send({
            from: senderIdentity,
            to: complainant.email,
            subject: subject,
            content: "text/html",
            html: htmlBody.replace("{{name}}", complainant.fullname || "User"),
            attachments: formattedAttachments,
          });
        }
      }
    } else if (toEmails && Array.isArray(toEmails)) {
      // Send to specified array of emails
      for (const email of toEmails) {
        if (email) {
          await smtpClient.send({
            from: senderIdentity,
            to: email,
            subject: subject,
            content: "text/html",
            html: htmlBody,
            attachments: formattedAttachments,
          });
        }
      }
    } else if (toEmail) {
      // Single recipient fallback
      await smtpClient.send({
        from: senderIdentity,
        to: toEmail,
        subject: subject,
        content: "text/html",
        html: htmlBody,
        attachments: formattedAttachments,
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
