import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import nodemailer from "npm:nodemailer";

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
    const token = authHeader ? authHeader.replace('Bearer ', '') : '';
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // If it's bulk or custom recipients list, ensure user is authenticated
    if (bulk || toEmails || smtpSettings) {
      const { data: { user } } = await supabaseClient.auth.getUser(token);
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Determine SMTP configuration
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

    // Create Nodemailer Transporter
    const transporter = nodemailer.createTransport({
      host: hostname,
      port: port,
      secure: port === 465,
      auth: {
        user: username,
        pass: password,
      },
    });

    // Process attachments
    const formattedAttachments = [];
    if (attachments && Array.isArray(attachments)) {
      for (const att of attachments) {
        if (att.filename && att.content) {
          formattedAttachments.push({
            filename: att.filename,
            content: att.content,
            encoding: 'base64',
            contentType: att.contentType || "application/octet-stream"
          });
        }
      }
    }

    const senderIdentity = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;

    // Send emails helper
    const sendMailPromise = (to, htmlContent) => {
      return transporter.sendMail({
        from: senderIdentity,
        to: to,
        subject: subject,
        html: htmlContent,
        attachments: formattedAttachments,
      });
    };

    if (bulk) {
      // Send to all complainants
      const { data: complaints, error } = await supabaseClient
        .from('complaints')
        .select('email, fullname');

      if (error) throw error;

      for (const complainant of complaints) {
        if (complainant.email) {
          await sendMailPromise(complainant.email, htmlBody.replace("{{name}}", complainant.fullname || "User"));
        }
      }
    } else if (toEmails && Array.isArray(toEmails)) {
      // Send to specified array of emails
      for (const email of toEmails) {
        if (email) {
          await sendMailPromise(email, htmlBody);
        }
      }
    } else if (toEmail) {
      // Single recipient fallback
      await sendMailPromise(toEmail, htmlBody);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    let message = error.message;
    if (message.includes("Authentication failed") || message.includes("Username and Password not accepted")) {
      message = "SMTP Authentication Failed: Please verify your SMTP username/email and App Password in Settings.";
    } else if (message.includes("connection closed") || message.includes("Failed to connect") || message.includes("getaddrinfo")) {
      message = "SMTP Connection Failed: Could not reach the SMTP server. Please verify your SMTP host and port in Settings.";
    }
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
