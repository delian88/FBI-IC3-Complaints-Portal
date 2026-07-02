/* =====================================================
   ADMIN JS — IC3 Dashboard
   ===================================================== */

const SUPABASE_URL     = "https://hmfuppjdagkufqzwsbrr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtZnVwcGpkYWdrdWZxendzYnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMTkzMTgsImV4cCI6MjA5ODU5NTMxOH0.nkrwlF_v_6HFFn89UGCbova_Zfo69GvN3TJbmMxF3Cg";
const supabaseClient   = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentPage    = 1;
const PAGE_SIZE    = 10;
let allComplaints  = [];

/* ============ ANIMATED NUMBER COUNTER ============ */
function animateCount(el, target, prefix, suffix, duration) {
  prefix   = prefix   || "";
  suffix   = suffix   || "";
  duration = duration || 1200;
  const start     = performance.now();
  const isFloat   = String(target).includes(".");
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const ease     = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
    const current  = isFloat ? (target * ease).toFixed(1) : Math.floor(target * ease);
    el.textContent = prefix + Number(current).toLocaleString() + suffix;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}


/* ============ TOAST ============ */
function showToast(message, type) {
  type = type || "success";
  let container = document.getElementById("toast-container");
  const toast   = document.createElement("div");
  toast.className = "toast toast-" + type;
  const icon  = type === "error" ? "✗" : type === "info" ? "ℹ" : "✓";
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.add("toast-fade-out");
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => { if (toast.parentNode) toast.remove(); }, { once: true });
  }, 5000);
}

/* ============ SHOW / HIDE PAGES ============ */
function showDashboard() {
  document.getElementById("login-page").style.display     = "none";
  document.getElementById("dashboard-page").style.display = "block";
  loadComplaints();
}

function showLogin() {
  document.getElementById("dashboard-page").style.display = "none";
  document.getElementById("login-page").style.display     = "block";
}

/* ============ CATEGORY BADGE ============ */
function categoryBadge(cat) {
  cat = cat || "";
  const map = {
    "Crypto Scam":      "badge-cat-crypto",
    "Romance Scam":     "badge-cat-romance",
    "Investment Fraud": "badge-cat-invest",
    "Social Media Scam":"badge-cat-social",
    "Identity Theft":   "badge-cat-identity",
  };
  const cls = map[cat] || "badge-cat-other";
  return `<span class="badge-category ${cls}">${cat || "Other"}</span>`;
}

/* ============ STATUS BADGE ============ */
function statusBadge(status) {
  status = status || "New";
  const map = {
    "New":         "badge-st-new",
    "In Review":   "badge-st-review",
    "In Progress": "badge-st-progress",
    "Resolved":    "badge-st-resolved",
  };
  const cls = map[status] || "badge-st-new";
  return `<span class="badge-status ${cls}">${status}</span>`;
}

/* ============ RENDER TABLE ============ */
function renderTable(data) {
  const tbody   = document.querySelector("#complaints-table tbody");
  const infoEl  = document.getElementById("table-info");
  tbody.innerHTML = "";

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="loading-row">No complaints found.</td></tr>`;
    infoEl.textContent = "Showing 0 entries";
    return;
  }

  const start  = (currentPage - 1) * PAGE_SIZE;
  const end    = Math.min(start + PAGE_SIZE, data.length);
  const page   = data.slice(start, end);

  page.forEach(c => {
    const date = new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const tr   = document.createElement("tr");
    tr.innerHTML = `
      <td>${date}</td>
      <td><strong>${c.fullname || "N/A"}</strong></td>
      <td style="color:#6b7280">${c.email || "N/A"}</td>
      <td>${categoryBadge(c.category)}</td>
      <td>${c.lossamount ? "$" + Number(String(c.lossamount).replace(/[^0-9.]/g,"")).toLocaleString() : "N/A"}</td>
      <td>${statusBadge(c.status)}</td>
      <td>
        <div class="action-btns">
          <button class="act-btn" onclick="viewComplaint('${c.id}')" title="View"><i class="fa fa-eye"></i></button>
          <button class="act-btn" onclick="editComplaint('${c.id}')" title="Edit"><i class="fa fa-pen"></i></button>
          <button class="act-btn delete" onclick="deleteComplaint('${c.id}')" title="Delete"><i class="fa fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  infoEl.textContent = `Showing ${start + 1} to ${end} of ${data.length} entries`;
  renderPagination(data.length);
}

/* ============ PAGINATION ============ */
function renderPagination(total) {
  const pages  = Math.ceil(total / PAGE_SIZE);
  const el     = document.getElementById("pagination");
  el.innerHTML = "";

  const prev   = document.createElement("button");
  prev.className = "pg-btn";
  prev.innerHTML = '<i class="fa fa-chevron-left"></i>';
  prev.disabled  = currentPage === 1;
  prev.onclick   = () => { currentPage--; renderTable(allComplaints); };
  el.appendChild(prev);

  const range = visiblePages(currentPage, pages);
  range.forEach(p => {
    if (p === "...") {
      const dots = document.createElement("button");
      dots.className = "pg-btn";
      dots.textContent = "…";
      dots.disabled = true;
      el.appendChild(dots);
    } else {
      const btn = document.createElement("button");
      btn.className = "pg-btn" + (p === currentPage ? " active" : "");
      btn.textContent = p;
      btn.onclick = () => { currentPage = p; renderTable(allComplaints); };
      el.appendChild(btn);
    }
  });

  const next  = document.createElement("button");
  next.className = "pg-btn";
  next.innerHTML = '<i class="fa fa-chevron-right"></i>';
  next.disabled  = currentPage === pages || pages === 0;
  next.onclick   = () => { currentPage++; renderTable(allComplaints); };
  el.appendChild(next);
}

function visiblePages(current, total) {
  if (total <= 6) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, "...", total];
  if (current >= total - 2) return [1, "...", total - 2, total - 1, total];
  return [1, "...", current, "...", total];
}

/* ============ LOAD COMPLAINTS ============ */
async function loadComplaints() {
  const { data, error } = await supabaseClient
    .from("complaints")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading complaints:", error);
    showToast("Failed to load complaints.", "error");
    return;
  }

  allComplaints = data || [];
  updateStats(allComplaints);
  currentPage = 1;
  renderTable(allComplaints);
}

/* ============ STATS ============ */
function updateStats(data) {
  const total   = data.length;
  const pending = data.filter(c => !c.status || c.status === "New").length;
  const loss    = data.reduce((sum, c) => {
    const n = parseFloat(String(c.lossamount || "0").replace(/[^0-9.]/g, ""));
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  // Animate total complaints
  animateCount(document.getElementById("stat-total"), total);

  // Animate pending
  animateCount(document.getElementById("stat-pending"), pending);

  // Animate loss
  if (loss >= 1_000_000) {
    animateCount(document.getElementById("stat-loss"), loss / 1_000_000, "$", "M");
  } else {
    animateCount(document.getElementById("stat-loss"), loss, "$");
  }

  // Emails (placeholder)
  document.getElementById("stat-emails").textContent = "—";
}

/* ============ VIEW COMPLAINT MODAL ============ */
window.viewComplaint = function(id) {
  const c = allComplaints.find(x => x.id === id);
  if (!c) return;
  const date = new Date(c.created_at).toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" });
  document.getElementById("modal-body").innerHTML = `
    <div class="detail-section">Personal Information</div>
    <div class="detail-row"><strong>Full Name</strong><span>${c.fullname || "—"}</span></div>
    <div class="detail-row"><strong>Email</strong><span>${c.email || "—"}</span></div>
    <div class="detail-row"><strong>Phone</strong><span>${c.phone || "—"}</span></div>
    <div class="detail-row"><strong>Business Name</strong><span>${c.businessName || "—"}</span></div>
    <div class="detail-row"><strong>Gender</strong><span>${c.gender || "—"}</span></div>
    <div class="detail-row"><strong>Affected</strong><span>${c.affected || "—"}</span></div>
    <div class="detail-section">Location</div>
    <div class="detail-row"><strong>Country</strong><span>${c.country || "—"}</span></div>
    <div class="detail-row"><strong>State</strong><span>${c.state || "—"}</span></div>
    <div class="detail-row"><strong>City</strong><span>${c.city || "—"}</span></div>
    <div class="detail-row"><strong>Address</strong><span>${c.address || "—"}</span></div>
    <div class="detail-row"><strong>Zip Code</strong><span>${c.zipcode || "—"}</span></div>
    <div class="detail-section">Complaint Details</div>
    <div class="detail-row"><strong>Category</strong><span>${categoryBadge(c.category)}</span></div>
    <div class="detail-row"><strong>How Scammed</strong><span>${c.scammethod || "—"}</span></div>
    <div class="detail-row"><strong>Times Scammed</strong><span>${c.timesscammed || "—"}</span></div>
    <div class="detail-row"><strong>Payments Sent</strong><span>${c.timespaid || "—"}</span></div>
    <div class="detail-row"><strong>Total Loss</strong><span>${c.lossamount || "—"}</span></div>
    <div class="detail-row"><strong>Scammer Handle</strong><span>${c.scammerhandle || "—"}</span></div>
    <div class="detail-row"><strong>Date of Payment</strong><span>${c.datepaymentmade || "—"}</span></div>
    <div class="detail-row"><strong>Submitted On</strong><span>${date}</span></div>
    <div class="detail-section">Additional Information</div>
    <div class="detail-row"><strong>Personal Info Shared</strong><span style="white-space:pre-wrap">${c.personalinfosent || "—"}</span></div>
  `;
  document.getElementById("modal-overlay").style.display = "flex";
};

window.editComplaint = function(id) {
  showToast("Edit feature coming soon.", "info");
};

window.deleteComplaint = async function(id) {
  if (!confirm("Are you sure you want to delete this complaint?")) return;
  const { error } = await supabaseClient.from("complaints").delete().eq("id", id);
  if (error) { showToast("Failed to delete complaint.", "error"); return; }
  showToast("Complaint deleted.", "success");
  loadComplaints();
};

/* ============ MAIN ============ */
document.addEventListener("DOMContentLoaded", () => {

  /* Auth */
  supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (session) showDashboard(); else showLogin();
  });

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session) showDashboard(); else showLogin();
  });

  /* Login Form */
  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email    = document.getElementById("admin-email").value;
    const password = document.getElementById("admin-password").value;
    const errorEl  = document.getElementById("login-error");
    const btn      = document.getElementById("login-btn");
    const btnText  = document.getElementById("login-btn-text");
    const spinner  = document.getElementById("login-spinner");
    errorEl.textContent = "";
    btnText.style.display = "none";
    spinner.style.display = "inline-block";
    btn.disabled = true;

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

    btn.disabled = false;
    btnText.style.display = "inline";
    spinner.style.display = "none";

    if (error) {
      errorEl.textContent = error.message;
      showToast(error.message, "error");
    } else {
      showToast("Logged in successfully!", "success");
    }
  });

  /* Toggle password visibility */
  document.getElementById("toggle-password").addEventListener("click", () => {
    const pw = document.getElementById("admin-password");
    const icon = document.querySelector("#toggle-password i");
    if (pw.type === "password") {
      pw.type = "text";
      icon.className = "fa fa-eye-slash";
    } else {
      pw.type = "password";
      icon.className = "fa fa-eye";
    }
  });

  /* Logout */
  document.getElementById("logout-btn").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    showToast("Logged out.", "info");
  });

  /* Sidebar collapse */
  const sidebar     = document.getElementById("sidebar");
  const mainWrapper = document.getElementById("main-wrapper");
  document.getElementById("collapse-btn").addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    mainWrapper.classList.toggle("collapsed");
  });

  /* Mobile hamburger */
  document.getElementById("hamburger").addEventListener("click", () => {
    sidebar.classList.toggle("mobile-open");
  });

  /* Dark mode */
  document.getElementById("dark-mode-btn").addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const icon = document.querySelector("#dark-mode-btn i");
    icon.className = document.body.classList.contains("dark-mode") ? "fa fa-sun" : "fa fa-moon";
  });

  /* Modal close */
  document.getElementById("modal-close").addEventListener("click", () => {
    document.getElementById("modal-overlay").style.display = "none";
  });

  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target === document.getElementById("modal-overlay")) {
      document.getElementById("modal-overlay").style.display = "none";
    }
  });

  /* Bulk Email Send */
  document.getElementById("send-email-btn").addEventListener("click", async () => {
    const subject    = document.getElementById("email-subject").value;
    const bodyEl     = document.getElementById("email-body");
    const htmlBody   = bodyEl.innerHTML;
    const statusEl   = document.getElementById("email-status");
    const btn        = document.getElementById("send-email-btn");

    if (!subject.trim()) { showToast("Please enter an email subject.", "error"); return; }
    if (!bodyEl.textContent.trim()) { showToast("Please write an email body.", "error"); return; }

    btn.disabled = true;
    statusEl.style.color = "orange";
    statusEl.textContent = "Sending emails...";
    showToast("Sending emails to all complainants...", "info");

    try {
      const { error } = await supabaseClient.functions.invoke("send-email", {
        body: { subject, htmlBody, bulk: true }
      });
      if (error) throw error;
      statusEl.style.color = "green";
      statusEl.textContent = "Bulk email sent successfully!";
      showToast("Bulk email sent successfully!", "success");
      document.getElementById("email-subject").value = "";
      bodyEl.innerHTML = "";
    } catch (err) {
      statusEl.style.color = "red";
      statusEl.textContent = "Error: " + err.message;
      showToast("Error: " + err.message, "error");
    } finally {
      btn.disabled = false;
    }
  });

  /* Word count in editor */
  document.getElementById("email-body").addEventListener("input", () => {
    const text  = document.getElementById("email-body").innerText.trim();
    const words = text ? text.split(/\s+/).length : 0;
    document.getElementById("word-count").textContent = "Words: " + words;
  });

  /* Search filter */
  document.getElementById("global-search").addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = allComplaints.filter(c =>
      (c.fullname  || "").toLowerCase().includes(q) ||
      (c.email     || "").toLowerCase().includes(q) ||
      (c.category  || "").toLowerCase().includes(q)
    );
    currentPage = 1;
    renderTable(filtered);
  });
});
