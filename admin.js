/* =====================================================
   ADMIN JS — IC3 Dashboard  (Full implementation)
   ===================================================== */

const SUPABASE_URL      = "https://hmfuppjdagkufqzwsbrr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtZnVwcGpkYWdrdWZxendzYnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMTkzMTgsImV4cCI6MjA5ODU5NTMxOH0.nkrwlF_v_6HFFn89UGCbova_Zfo69GvN3TJbmMxF3Cg";
const supabaseClient    = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ── State ── */
let allComplaints  = [];
let allRecipients  = [];
let currentPage    = 1;
const PAGE_SIZE    = 10;
let customEmailTags = [];
let currentUserEmail = "";
let dashboardFiles = [];
let ecFiles = [];

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = error => reject(error);
  });
}

/* =====================================================
   TOAST
   ===================================================== */
function showToast(message, type) {
  type = type || "success";
  const container = document.getElementById("toast-container");
  const toast     = document.createElement("div");
  toast.className = "toast toast-" + type;
  const icon = type === "error" ? "✗" : type === "info" ? "ℹ" : "✓";
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.add("toast-fade-out");
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => { if (toast.parentNode) toast.remove(); }, { once: true });
  }, 5000);
}

/* =====================================================
   ANIMATED COUNTER
   ===================================================== */
function animateCount(el, target, prefix, suffix, duration) {
  prefix = prefix || ""; suffix = suffix || ""; duration = duration || 1200;
  const start = performance.now();
  const isFloat = String(target).includes(".");
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const ease     = 1 - Math.pow(1 - progress, 3);
    const current  = isFloat ? (target * ease).toFixed(1) : Math.floor(target * ease);
    el.textContent = prefix + Number(current).toLocaleString() + suffix;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* =====================================================
   PAGE ROUTING
   ===================================================== */
const PAGE_TITLES = {
  dashboard:    "IC3 Admin Dashboard",
  complaints:   "Complaints",
  "email-center": "Email Center",
  reports:      "Reports",
  users:        "Users",
  settings:     "Settings",
  audit:        "Audit Logs",
};

window.switchPage = function(pageId) {
  // Update nav
  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle("active", item.dataset.page === pageId);
  });

  // Hide all pages
  document.querySelectorAll(".page-content").forEach(p => p.style.display = "none");

  // Show target page
  const target = document.getElementById("page-" + pageId);
  if (target) target.style.display = "block";

  // Update title
  document.getElementById("page-title").textContent = PAGE_TITLES[pageId] || "Dashboard";

  // Trigger page-specific load
  if (pageId === "complaints")   renderComplaintsPage();
  if (pageId === "email-center") loadRecipients();
  if (pageId === "reports")      renderReports();
  if (pageId === "users")        loadUsers();
  if (pageId === "audit")        loadAuditLogs();
};

/* =====================================================
   AUTH
   ===================================================== */
function showDashboard(email) {
  currentUserEmail = email || "";
  document.getElementById("login-page").style.display     = "none";
  document.getElementById("dashboard-page").style.display = "block";
  if (email) {
    const name = email.split("@")[0];
    document.getElementById("sidebar-username").textContent = name;
    document.getElementById("topbar-username").textContent  = name;
  }
  loadDashboard();
}

function showLogin() {
  document.getElementById("dashboard-page").style.display = "none";
  document.getElementById("login-page").style.display     = "block";
}

/* =====================================================
   DASHBOARD PAGE
   ===================================================== */
async function loadDashboard() {
  let complaints = [];
  let recipients = [];

  try {
    const { data, error } = await supabaseClient
      .from("complaints")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    complaints = data || [];
  } catch (err) {
    console.error("Error loading complaints:", err);
    showToast("Complaints table query failed. Check database configuration.", "error");
  }

  try {
    const { data, error } = await supabaseClient
      .from("email_recipients")
      .select("*");
    if (error) throw error;
    recipients = data || [];
  } catch (err) {
    console.error("Error loading email recipients:", err);
    showToast("Email recipients query failed. Run settings migration.", "info");
  }

  allComplaints = complaints;
  allRecipients = recipients;

  updateStats(allComplaints, allRecipients);
  renderDashboardTable(allComplaints.slice(0, 5));
}

function updateStats(complaints, recipients) {
  const total   = complaints.length;
  const pending = complaints.filter(c => !c.status || c.status === "New").length;
  const loss    = complaints.reduce((sum, c) => {
    const n = parseFloat(String(c.lossamount || "0").replace(/[^0-9.]/g, ""));
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  animateCount(document.getElementById("stat-total"),   total);
  animateCount(document.getElementById("stat-pending"), pending);
  animateCount(document.getElementById("stat-emails"),  (recipients || []).length);

  if (loss >= 1_000_000) {
    animateCount(document.getElementById("stat-loss"), loss / 1_000_000, "$", "M");
  } else {
    animateCount(document.getElementById("stat-loss"), loss, "$");
  }
}

function renderDashboardTable(data) {
  const tbody = document.getElementById("dashboard-complaints-body");
  tbody.innerHTML = "";
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="loading-row">No complaints yet.</td></tr>`;
    return;
  }
  data.forEach(c => {
    const tr = document.createElement("tr");
    const date = new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    tr.innerHTML = `
      <td>${date}</td>
      <td><strong>${c.fullname || "N/A"}</strong></td>
      <td style="color:var(--text-muted)">${c.email || "N/A"}</td>
      <td>${categoryBadge(c.category)}</td>
      <td>${c.lossamount ? "$" + Number(String(c.lossamount).replace(/[^0-9.]/g, "")).toLocaleString() : "N/A"}</td>
      <td>${statusBadge(c.status)}</td>
      <td><div class="action-btns">
        <button class="act-btn" onclick="viewComplaint('${c.id}', 'dashboard')" title="View"><i class="fa fa-eye"></i></button>
      </div></td>
    `;
    tbody.appendChild(tr);
  });
}

/* =====================================================
   COMPLAINTS PAGE
   ===================================================== */
function renderComplaintsPage() {
  applyComplaintFilters();
}

function applyComplaintFilters() {
  const cat    = document.getElementById("filter-category").value;
  const status = document.getElementById("filter-status").value;
  const q      = (document.getElementById("complaint-search").value || "").toLowerCase();

  let filtered = allComplaints.filter(c => {
    const matchCat    = !cat    || c.category === cat;
    const matchStatus = !status || (c.status || "New") === status;
    const matchQ      = !q || (c.fullname || "").toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q);
    return matchCat && matchStatus && matchQ;
  });

  currentPage = 1;
  renderComplaintsTable(filtered);
}

function renderComplaintsTable(data) {
  const tbody  = document.getElementById("complaints-tbody");
  const infoEl = document.getElementById("table-info");
  tbody.innerHTML = "";

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="loading-row">No complaints found.</td></tr>`;
    infoEl.textContent = "Showing 0 entries";
    renderPagination(0, data);
    return;
  }

  const start = (currentPage - 1) * PAGE_SIZE;
  const end   = Math.min(start + PAGE_SIZE, data.length);
  const page  = data.slice(start, end);

  page.forEach(c => {
    const date = new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const tr   = document.createElement("tr");
    tr.innerHTML = `
      <td>${date}</td>
      <td><strong>${c.fullname || "N/A"}</strong></td>
      <td style="color:var(--text-muted)">${c.email || "N/A"}</td>
      <td>${categoryBadge(c.category)}</td>
      <td>${c.lossamount ? "$" + Number(String(c.lossamount).replace(/[^0-9.]/g, "")).toLocaleString() : "N/A"}</td>
      <td>${statusBadge(c.status)}</td>
      <td><div class="action-btns">
        <button class="act-btn" onclick="viewComplaint('${c.id}', 'complaints')" title="View"><i class="fa fa-eye"></i></button>
        <button class="act-btn delete" onclick="deleteComplaint('${c.id}')" title="Delete"><i class="fa fa-trash"></i></button>
      </div></td>
    `;
    tbody.appendChild(tr);
  });

  infoEl.textContent = `Showing ${start + 1}–${end} of ${data.length} entries`;
  renderPagination(data.length, data);
}

/* Pagination */
function renderPagination(total, data) {
  const pages = Math.ceil(total / PAGE_SIZE);
  const el    = document.getElementById("pagination");
  el.innerHTML = "";

  const prev = document.createElement("button");
  prev.className = "pg-btn"; prev.innerHTML = '<i class="fa fa-chevron-left"></i>';
  prev.disabled  = currentPage === 1;
  prev.onclick   = () => { currentPage--; renderComplaintsTable(data); };
  el.appendChild(prev);

  visiblePages(currentPage, pages).forEach(p => {
    const btn = document.createElement("button");
    btn.className = "pg-btn" + (p === currentPage ? " active" : "");
    btn.textContent = p === "..." ? "…" : p;
    btn.disabled    = p === "...";
    btn.onclick     = () => { if (p !== "...") { currentPage = p; renderComplaintsTable(data); } };
    el.appendChild(btn);
  });

  const next = document.createElement("button");
  next.className = "pg-btn"; next.innerHTML = '<i class="fa fa-chevron-right"></i>';
  next.disabled  = currentPage >= pages || pages === 0;
  next.onclick   = () => { currentPage++; renderComplaintsTable(data); };
  el.appendChild(next);
}

function visiblePages(current, total) {
  if (total <= 6) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, "...", total];
  if (current >= total - 2) return [1, "...", total - 2, total - 1, total];
  return [1, "...", current, "...", total];
}

/* =====================================================
   COMPLAINT VIEW / DELETE
   ===================================================== */
window.viewComplaint = function(id, source) {
  const data = allComplaints;
  const c    = data.find(x => x.id === id);
  if (!c) return;
  const date = new Date(c.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
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
    <div class="detail-row"><strong>State / City</strong><span>${[c.state, c.city].filter(Boolean).join(", ") || "—"}</span></div>
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

window.deleteComplaint = async function(id) {
  if (!confirm("Delete this complaint? This cannot be undone.")) return;
  const { error } = await supabaseClient.from("complaints").delete().eq("id", id);
  if (error) { showToast("Failed to delete: " + error.message, "error"); return; }
  showToast("Complaint deleted.", "success");
  logAudit("DELETE_COMPLAINT", "Deleted complaint ID: " + id);
  allComplaints = allComplaints.filter(c => c.id !== id);
  applyComplaintFilters();
  updateStats(allComplaints, allRecipients);
};

/* =====================================================
   EMAIL CENTER
   ===================================================== */
async function loadRecipients() {
  try {
    const { data, error } = await supabaseClient.from("email_recipients").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    allRecipients = data || [];
    renderRecipientsList(allRecipients);
    animateCount(document.getElementById("stat-emails"), allRecipients.length);
  } catch (err) {
    console.error("Error loading recipients:", err);
    renderRecipientsList([]);
  }
}

function renderRecipientsList(data) {
  const container = document.getElementById("recipients-list");
  container.innerHTML = "";
  if (!data.length) {
    container.innerHTML = `<div class="empty-state"><i class="fa fa-inbox"></i><p>No recipients yet</p></div>`;
    return;
  }
  data.forEach(r => {
    const div = document.createElement("div");
    div.className = "recipient-item";
    const initial = (r.name || r.email).charAt(0).toUpperCase();
    div.innerHTML = `
      <div class="recip-avatar">${initial}</div>
      <div class="recip-info">
        <div class="recip-name">${r.name || "—"}</div>
        <div class="recip-email-text">${r.email}</div>
      </div>
      ${r.tags ? `<span class="recip-tag-badge">${r.tags}</span>` : ""}
      <button class="recip-del-btn" onclick="deleteRecipient('${r.id}')"><i class="fa fa-trash"></i></button>
    `;
    container.appendChild(div);
  });
}

window.deleteRecipient = async function(id) {
  if (!confirm("Remove this recipient?")) return;
  const { error } = await supabaseClient.from("email_recipients").delete().eq("id", id);
  if (error) { showToast("Failed to remove.", "error"); return; }
  showToast("Recipient removed.", "info");
  allRecipients = allRecipients.filter(r => r.id !== id);
  renderRecipientsList(allRecipients);
  animateCount(document.getElementById("stat-emails"), allRecipients.length);
};

/* Tag input for custom emails */
function addEmailTag(email) {
  if (!email || !email.includes("@")) return;
  if (customEmailTags.includes(email)) return;
  customEmailTags.push(email);
  renderTags();
}

function removeEmailTag(email) {
  customEmailTags = customEmailTags.filter(e => e !== email);
  renderTags();
}

function renderTags() {
  const container = document.getElementById("email-tags");
  container.innerHTML = customEmailTags.map(e =>
    `<span class="email-tag">${e}<button type="button" onclick="removeEmailTag('${e}')">×</button></span>`
  ).join("");
}

/* =====================================================
   SEND EMAIL (shared)
   ===================================================== */
async function sendEmail(subject, htmlBody, targetEmails, attachments) {
  const smtpSettings = getSMTPSettings();

  if (!smtpSettings.enabled) {
    showToast("Email is disabled. Enable SMTP in Settings.", "error");
    return false;
  }

  const { error } = await supabaseClient.functions.invoke("send-email", {
    body: { subject, htmlBody, toEmails: targetEmails, smtpSettings, attachments }
  });

  if (error) {
    showToast("Error: " + error.message, "error");
    return false;
  }

  showToast(`Email sent to ${targetEmails.length} recipient(s)!`, "success");
  logAudit("BULK_EMAIL_SENT", `Sent "${subject}" to ${targetEmails.length} recipients.`);
  return true;
}

function collectRecipientEmails(mode) {
  const complainantEmails = allComplaints.map(c => c.email).filter(Boolean);
  const savedEmails       = allRecipients.map(r => r.email).filter(Boolean);

  if (mode === "all-complainants") return [...new Set(complainantEmails)];
  if (mode === "all-recipients")   return [...new Set(savedEmails)];
  if (mode === "both")             return [...new Set([...complainantEmails, ...savedEmails])];
  if (mode === "custom")           return [...new Set(customEmailTags)];
  return [];
}

/* =====================================================
   REPORTS PAGE
   ===================================================== */
function renderReports() {
  const catCounts = {};
  const stCounts  = { "New": 0, "In Review": 0, "In Progress": 0, "Resolved": 0 };
  let totalLoss = 0, maxLoss = 0;

  allComplaints.forEach(c => {
    const cat = c.category || "Other";
    catCounts[cat] = (catCounts[cat] || 0) + 1;

    const st = c.status || "New";
    stCounts[st] = (stCounts[st] || 0) + 1;

    const n = parseFloat(String(c.lossamount || "0").replace(/[^0-9.]/g, ""));
    if (!isNaN(n)) { totalLoss += n; maxLoss = Math.max(maxLoss, n); }
  });

  renderBarChart("category-chart", catCounts, "#6C63FF");
  renderBarChart("status-chart",   stCounts,  "#10b981");
  renderLossSummary(totalLoss, maxLoss, allComplaints.length);
}

function renderBarChart(containerId, counts, color) {
  const el    = document.getElementById(containerId);
  el.innerHTML = "";
  const max   = Math.max(...Object.values(counts), 1);

  Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([label, val]) => {
    const pct = (val / max * 100).toFixed(1);
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <span class="bar-label">${label}</span>
      <div class="bar-track"><div class="bar-fill" style="background:${color}"></div></div>
      <span class="bar-value">${val}</span>
    `;
    el.appendChild(row);
    setTimeout(() => { row.querySelector(".bar-fill").style.width = pct + "%"; }, 50);
  });
}

function renderLossSummary(total, max, count) {
  const avg = count ? (total / count) : 0;
  document.getElementById("loss-summary").innerHTML = `
    <div class="loss-item">
      <div class="loss-label">Total Loss Reported</div>
      <div class="loss-value">$${total.toLocaleString()}</div>
      <div class="loss-sub">Across ${count} complaints</div>
    </div>
    <div class="loss-item">
      <div class="loss-label">Average Loss</div>
      <div class="loss-value">$${Math.round(avg).toLocaleString()}</div>
      <div class="loss-sub">Per complaint</div>
    </div>
    <div class="loss-item">
      <div class="loss-label">Highest Single Loss</div>
      <div class="loss-value">$${max.toLocaleString()}</div>
      <div class="loss-sub">Maximum reported</div>
    </div>
  `;
}

/* =====================================================
   USERS PAGE
   ===================================================== */
async function loadUsers() {
  const container = document.getElementById("users-list");
  // Show current admin since Service Role is needed for full user list
  const { data: { user } } = await supabaseClient.auth.getUser();
  container.innerHTML = "";

  if (user) {
    const name = user.email.split("@")[0];
    const div  = document.createElement("div");
    div.className = "user-card";
    div.innerHTML = `
      <div class="user-avatar">${name.charAt(0).toUpperCase()}</div>
      <div class="user-card-info">
        <div class="user-card-name">${name}</div>
        <div class="user-card-email">${user.email}</div>
      </div>
      <span class="user-role-badge">Administrator</span>
    `;
    container.appendChild(div);
  }

  const note = document.createElement("p");
  note.style.cssText = "text-align:center;color:var(--text-muted);font-size:12px;padding:16px";
  note.textContent = "Full user management requires Supabase Service Role access. Add users directly via the Supabase Dashboard → Authentication → Users.";
  container.appendChild(note);
}

/* =====================================================
   SETTINGS PAGE
   ===================================================== */
function getSMTPSettings() {
  return JSON.parse(localStorage.getItem("ic3_smtp") || "{}");
}

function saveSMTPSettings(settings) {
  localStorage.setItem("ic3_smtp", JSON.stringify(settings));
}

function loadSettingsForm() {
  const s = getSMTPSettings();
  if (s.enabled !== undefined) document.getElementById("smtp-enabled").checked = s.enabled;
  if (s.host)          document.getElementById("smtp-host").value          = s.host;
  if (s.port)          document.getElementById("smtp-port").value          = s.port;
  if (s.user)          document.getElementById("smtp-user").value          = s.user;
  if (s.pass)          document.getElementById("smtp-pass").value          = s.pass;
  if (s.fromName)      document.getElementById("smtp-from-name").value     = s.fromName;
  if (s.fromEmail)     document.getElementById("smtp-from-email").value    = s.fromEmail;
  if (s.template)      document.getElementById("smtp-confirm-template").value = s.template;

  const portal = JSON.parse(localStorage.getItem("ic3_portal") || "{}");
  if (portal.name)        document.getElementById("portal-name").value          = portal.name;
  if (portal.contact)     document.getElementById("portal-contact-email").value  = portal.contact;
  if (portal.autoConfirm !== undefined) document.getElementById("auto-confirm-email").checked = portal.autoConfirm;
  if (portal.darkMode !== undefined)    document.getElementById("default-dark-mode").checked  = portal.darkMode;
}

window.toggleSmtpPass = function() {
  const pw   = document.getElementById("smtp-pass");
  const icon = document.getElementById("smtp-pass-eye");
  if (pw.type === "password") { pw.type = "text"; icon.className = "fa fa-eye-slash"; }
  else                        { pw.type = "password"; icon.className = "fa fa-eye"; }
};

/* =====================================================
   AUDIT LOGS
   ===================================================== */
async function logAudit(action, details) {
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    await supabaseClient.from("audit_logs").insert([{
      action, details, user_email: user ? user.email : currentUserEmail
    }]);
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

async function loadAuditLogs() {
  const tbody = document.getElementById("audit-tbody");
  tbody.innerHTML = "";

  try {
    const { data, error } = await supabaseClient
      .from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100);

    if (error || !data || !data.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="loading-row">No audit logs found.</td></tr>`;
      return;
    }

    const actionType = (a) => {
      if (a.includes("DELETE")) return "danger";
      if (a.includes("SENT"))   return "success";
      if (a.includes("LOGIN"))  return "info";
      return "warning";
    };

    data.forEach(log => {
      const date = new Date(log.created_at).toLocaleString();
      const tr   = document.createElement("tr");
      tr.innerHTML = `
        <td style="color:var(--text-muted);font-size:12px">${date}</td>
        <td><span class="audit-action ${actionType(log.action)}">${log.action}</span></td>
        <td style="font-size:13px">${log.details || "—"}</td>
        <td style="font-size:12px;color:var(--text-muted)">${log.user_email || "—"}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Error loading audit logs:", err);
    tbody.innerHTML = `<tr><td colspan="4" class="loading-row">No audit logs found.</td></tr>`;
  }
}

/* =====================================================
   BADGE HELPERS
   ===================================================== */
function categoryBadge(cat) {
  cat = cat || "";
  const map = {
    "Crypto Scam":      "badge-cat-crypto",
    "Romance Scam":     "badge-cat-romance",
    "Investment Fraud": "badge-cat-invest",
    "Social Media Scam":"badge-cat-social",
    "Identity Theft":   "badge-cat-identity",
  };
  return `<span class="badge-category ${map[cat] || "badge-cat-other"}">${cat || "Other"}</span>`;
}

function statusBadge(status) {
  status = status || "New";
  const map = { "New":"badge-st-new","In Review":"badge-st-review","In Progress":"badge-st-progress","Resolved":"badge-st-resolved" };
  return `<span class="badge-status ${map[status] || "badge-st-new"}">${status}</span>`;
}

/* =====================================================
   MAIN — DOMContentLoaded
   ===================================================== */
document.addEventListener("DOMContentLoaded", () => {

  /* ── Auth ── */
  supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (session) showDashboard(session.user.email); else showLogin();
  });

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session) showDashboard(session.user.email); else showLogin();
  });

  /* ── Login form ── */
  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email    = document.getElementById("admin-email").value;
    const password = document.getElementById("admin-password").value;
    const errorEl  = document.getElementById("login-error");
    const btn      = document.getElementById("login-btn");
    const btnText  = document.getElementById("login-btn-text");
    const spinner  = document.getElementById("login-spinner");
    errorEl.textContent = "";
    btnText.style.display = "none"; spinner.style.display = "inline-block"; btn.disabled = true;

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

    btn.disabled = false; btnText.style.display = "inline"; spinner.style.display = "none";
    if (error) { errorEl.textContent = error.message; showToast(error.message, "error"); }
    else { showToast("Logged in successfully!", "success"); logAudit("ADMIN_LOGIN", "Admin logged in."); }
  });

  /* ── Toggle password ── */
  document.getElementById("toggle-password").addEventListener("click", () => {
    const pw = document.getElementById("admin-password");
    const ic = document.querySelector("#toggle-password i");
    pw.type = pw.type === "password" ? "text" : "password";
    ic.className = pw.type === "password" ? "fa fa-eye" : "fa fa-eye-slash";
  });

  /* ── Logout ── */
  document.getElementById("logout-btn").addEventListener("click", async () => {
    logAudit("ADMIN_LOGOUT", "Admin logged out.");
    await supabaseClient.auth.signOut();
    showToast("Logged out.", "info");
  });

  /* ── Nav items ── */
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      switchPage(item.dataset.page);
    });
  });

  /* ── Sidebar collapse ── */
  const sidebar = document.getElementById("sidebar");
  const wrapper = document.getElementById("main-wrapper");
  document.getElementById("collapse-btn").addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    wrapper.classList.toggle("collapsed");
  });

  document.getElementById("hamburger").addEventListener("click", () => {
    sidebar.classList.toggle("mobile-open");
  });

  /* ── Dark mode ── */
  document.getElementById("dark-mode-btn").addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const ic = document.querySelector("#dark-mode-btn i");
    ic.className = document.body.classList.contains("dark-mode") ? "fa fa-sun" : "fa fa-moon";
  });

  /* ── Modal close ── */
  document.getElementById("modal-close").addEventListener("click", () => {
    document.getElementById("modal-overlay").style.display = "none";
  });
  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target.id === "modal-overlay") document.getElementById("modal-overlay").style.display = "none";
  });

  // Dashboard attachment input change
  const dashAttachInput = document.getElementById("dashboard-attachment-input");
  const dashAttachList = document.getElementById("dashboard-attachment-list");
  if (dashAttachInput) {
    dashAttachInput.addEventListener("change", () => {
      dashboardFiles = Array.from(dashAttachInput.files);
      if (dashboardFiles.length > 0) {
        dashAttachList.textContent = `${dashboardFiles.length} file(s) selected`;
      } else {
        dashAttachList.textContent = "";
      }
    });
  }

  /* ── Dashboard send email ── */
  document.getElementById("send-email-btn").addEventListener("click", async () => {
    const subject = document.getElementById("email-subject").value.trim();
    const htmlBody = document.getElementById("email-body").innerHTML;
    const statusEl = document.getElementById("email-status");

    if (!subject) { showToast("Enter a subject.", "error"); return; }
    if (!document.getElementById("email-body").textContent.trim()) { showToast("Write an email body.", "error"); return; }

    const emails = [...new Set(allComplaints.map(c => c.email).filter(Boolean))];
    if (!emails.length) { showToast("No complainant emails found.", "error"); return; }

    document.getElementById("send-email-btn").disabled = true;
    statusEl.style.color = "orange"; statusEl.textContent = "Sending...";
    showToast("Sending emails...", "info");

    try {
      // Convert attachments to base64
      const attachments = await Promise.all(
        dashboardFiles.map(async (file) => {
          const content = await fileToBase64(file);
          return {
            filename: file.name,
            contentType: file.type,
            content: content
          };
        })
      );

      const ok = await sendEmail(subject, htmlBody, emails, attachments);
      if (ok) {
        statusEl.style.color = "green"; statusEl.textContent = "Sent successfully!";
        document.getElementById("email-subject").value = "";
        document.getElementById("email-body").innerHTML = "";
        dashboardFiles = [];
        if (dashAttachInput) dashAttachInput.value = "";
        if (dashAttachList) dashAttachList.textContent = "";
      } else {
        statusEl.style.color = "red"; statusEl.textContent = "Failed. Check Settings → SMTP.";
      }
    } catch (err) {
      statusEl.style.color = "red"; statusEl.textContent = "Error preparing attachments: " + err.message;
      showToast("Error preparing attachments: " + err.message, "error");
    } finally {
      document.getElementById("send-email-btn").disabled = false;
    }
  });

  /* ── Dashboard word count ── */
  document.getElementById("email-body").addEventListener("input", () => {
    const t = document.getElementById("email-body").innerText.trim();
    document.getElementById("word-count").textContent = "Words: " + (t ? t.split(/\s+/).length : 0);
  });

  /* ── Complaint page filters ── */
  ["filter-category", "filter-status", "complaint-search"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", applyComplaintFilters);
    if (el && el.tagName === "SELECT") el.addEventListener("change", applyComplaintFilters);
  });

  /* ── Global search ── */
  document.getElementById("global-search").addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = allComplaints.filter(c =>
      (c.fullname || "").toLowerCase().includes(q) ||
      (c.email    || "").toLowerCase().includes(q) ||
      (c.category || "").toLowerCase().includes(q)
    );
    renderDashboardTable(filtered.slice(0, 5));
  });

  /* ── Email Center: recipient mode ── */
  document.querySelectorAll('input[name="recip-mode"]').forEach(radio => {
    radio.addEventListener("change", () => {
      const box = document.getElementById("custom-recip-box");
      box.style.display = radio.value === "custom" ? "block" : "none";
    });
  });

  /* ── Tag input ── */
  const tagInput = document.getElementById("tag-input");
  if (tagInput) {
    tagInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        addEmailTag(tagInput.value.trim().replace(/,$/, ""));
        tagInput.value = "";
      }
    });
    document.getElementById("tag-input").parentElement.addEventListener("click", () => tagInput.focus());
  }

  /* ── Recipient search ── */
  const recipSearch = document.getElementById("recip-search");
  if (recipSearch) {
    recipSearch.addEventListener("input", () => {
      const q = recipSearch.value.toLowerCase();
      renderRecipientsList(allRecipients.filter(r =>
        (r.name  || "").toLowerCase().includes(q) ||
        (r.email || "").toLowerCase().includes(q)
      ));
    });
  }

  /* ── Add recipient form ── */
  document.getElementById("add-recipient-btn").addEventListener("click", () => {
    const form = document.getElementById("add-recip-form");
    form.style.display = form.style.display === "none" ? "flex" : "none";
  });

  document.getElementById("cancel-recip-btn").addEventListener("click", () => {
    document.getElementById("add-recip-form").style.display = "none";
  });

  document.getElementById("save-recipient-btn").addEventListener("click", async () => {
    const name  = document.getElementById("recip-name").value.trim();
    const email = document.getElementById("recip-email").value.trim();
    const tags  = document.getElementById("recip-tags").value.trim();

    if (!email || !email.includes("@")) { showToast("Enter a valid email.", "error"); return; }

    const { data, error } = await supabaseClient.from("email_recipients").insert([{ name, email, tags }]).select();
    if (error) { showToast("Failed to save: " + error.message, "error"); return; }

    showToast("Recipient added!", "success");
    allRecipients.unshift(data[0]);
    renderRecipientsList(allRecipients);
    animateCount(document.getElementById("stat-emails"), allRecipients.length);
    document.getElementById("add-recip-form").style.display = "none";
    document.getElementById("recip-name").value  = "";
    document.getElementById("recip-email").value = "";
    document.getElementById("recip-tags").value  = "";
  });

  // Email Center attachment input change
  const ecAttachInput = document.getElementById("ec-attachment-input");
  const ecAttachList = document.getElementById("ec-attachment-list");
  if (ecAttachInput) {
    ecAttachInput.addEventListener("change", () => {
      ecFiles = Array.from(ecAttachInput.files);
      if (ecFiles.length > 0) {
        ecAttachList.textContent = `${ecFiles.length} file(s) selected`;
      } else {
        ecAttachList.textContent = "";
      }
    });
  }

  /* ── Email Center send ── */
  document.getElementById("ec-send-btn").addEventListener("click", async () => {
    const subject  = document.getElementById("ec-subject").value.trim();
    const htmlBody = document.getElementById("ec-body").innerHTML;
    const mode     = document.querySelector('input[name="recip-mode"]:checked').value;

    if (!subject) { showToast("Enter an email subject.", "error"); return; }
    if (!document.getElementById("ec-body").textContent.trim()) { showToast("Write an email body.", "error"); return; }

    const emails = collectRecipientEmails(mode);
    if (!emails.length) { showToast("No recipients selected.", "error"); return; }

    document.getElementById("ec-send-btn").disabled = true;
    const statusEl = document.getElementById("ec-status");
    statusEl.style.color = "orange"; statusEl.textContent = `Sending to ${emails.length} recipients...`;
    showToast(`Sending to ${emails.length} recipients...`, "info");

    try {
      // Convert attachments to base64
      const attachments = await Promise.all(
        ecFiles.map(async (file) => {
          const content = await fileToBase64(file);
          return {
            filename: file.name,
            contentType: file.type,
            content: content
          };
        })
      );

      const ok = await sendEmail(subject, htmlBody, emails, attachments);
      if (ok) {
        statusEl.style.color = "green"; statusEl.textContent = `Sent to ${emails.length} recipients!`;
        document.getElementById("ec-subject").value = "";
        document.getElementById("ec-body").innerHTML = "";
        customEmailTags = []; renderTags();
        ecFiles = [];
        if (ecAttachInput) ecAttachInput.value = "";
        if (ecAttachList) ecAttachList.textContent = "";
      } else {
        statusEl.style.color = "red"; statusEl.textContent = "Send failed. Check Settings → SMTP.";
      }
    } catch (err) {
      statusEl.style.color = "red"; statusEl.textContent = "Error preparing attachments: " + err.message;
      showToast("Error preparing attachments: " + err.message, "error");
    } finally {
      document.getElementById("ec-send-btn").disabled = false;
    }
  });

  /* EC word count */
  document.getElementById("ec-body").addEventListener("input", () => {
    const t = document.getElementById("ec-body").innerText.trim();
    document.getElementById("ec-word-count").textContent = "Words: " + (t ? t.split(/\s+/).length : 0);
  });

  /* ── Settings: save SMTP ── */
  document.getElementById("save-smtp-btn").addEventListener("click", () => {
    const settings = {
      enabled:   document.getElementById("smtp-enabled").checked,
      host:      document.getElementById("smtp-host").value.trim(),
      port:      document.getElementById("smtp-port").value.trim(),
      user:      document.getElementById("smtp-user").value.trim(),
      pass:      document.getElementById("smtp-pass").value.trim(),
      fromName:  document.getElementById("smtp-from-name").value.trim(),
      fromEmail: document.getElementById("smtp-from-email").value.trim(),
      template:  document.getElementById("smtp-confirm-template").value.trim(),
    };
    saveSMTPSettings(settings);
    const statusEl = document.getElementById("smtp-status");
    statusEl.style.color = "green"; statusEl.textContent = "SMTP settings saved!";
    showToast("SMTP settings saved!", "success");
    logAudit("SMTP_UPDATED", "SMTP configuration updated.");
  });

  /* ── Settings: test SMTP ── */
  document.getElementById("test-smtp-btn").addEventListener("click", async () => {
    const settings = getSMTPSettings();
    if (!settings.user) { showToast("Save your SMTP settings first.", "error"); return; }
    showToast("Sending test email...", "info");
    const ok = await sendEmail("IC3 Admin - Test Email", "<p>This is a test email from your IC3 Admin Dashboard.</p>", [settings.user]);
    if (ok) showToast("Test email sent to " + settings.user, "success");
  });

  /* ── Settings: save portal ── */
  document.getElementById("save-portal-btn").addEventListener("click", () => {
    const portal = {
      name:        document.getElementById("portal-name").value.trim(),
      contact:     document.getElementById("portal-contact-email").value.trim(),
      autoConfirm: document.getElementById("auto-confirm-email").checked,
      darkMode:    document.getElementById("default-dark-mode").checked,
    };
    localStorage.setItem("ic3_portal", JSON.stringify(portal));
    showToast("Portal settings saved!", "success");
    if (portal.darkMode) document.body.classList.add("dark-mode");
    else document.body.classList.remove("dark-mode");
  });

  /* ── Settings page load ── */
  document.querySelector('[data-page="settings"]').addEventListener("click", () => {
    setTimeout(loadSettingsForm, 100);
  });

  /* ── Audit clear ── */
  document.getElementById("clear-logs-btn").addEventListener("click", async () => {
    if (!confirm("Clear all audit logs?")) return;
    await supabaseClient.from("audit_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    loadAuditLogs();
    showToast("Logs cleared.", "info");
  });

  /* Apply saved portal settings */
  const savedPortal = JSON.parse(localStorage.getItem("ic3_portal") || "{}");
  if (savedPortal.darkMode) document.body.classList.add("dark-mode");

  /* ── Notification Bell Dropdown ── */
  const notifBtn = document.getElementById("notif-btn");
  const notifDropdown = document.getElementById("notif-dropdown");
  if (notifBtn && notifDropdown) {
    notifBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      notifDropdown.style.display = notifDropdown.style.display === "none" ? "block" : "none";
    });
    document.addEventListener("click", (e) => {
      if (!notifDropdown.contains(e.target) && e.target !== notifBtn) {
        notifDropdown.style.display = "none";
      }
    });
  }

  /* ── User Profile Click & Update ── */
  const topbarUser = document.querySelector(".topbar-user");
  const sidebarUser = document.querySelector(".sidebar-user");
  const profileOverlay = document.getElementById("profile-modal-overlay");
  const profileClose = document.getElementById("profile-modal-close");
  const profileForm = document.getElementById("profile-form");

  const openProfileModal = async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
      document.getElementById("profile-email").value = user.email;
      document.getElementById("profile-new-password").value = "";
      profileOverlay.style.display = "flex";
    } else if (currentUserEmail) {
      document.getElementById("profile-email").value = currentUserEmail;
      document.getElementById("profile-new-password").value = "";
      profileOverlay.style.display = "flex";
    } else {
      showToast("No active user session found.", "error");
    }
  };

  if (topbarUser) topbarUser.addEventListener("click", openProfileModal);
  if (sidebarUser) {
    // Click on sidebar user container (excluding the logout button inside it)
    sidebarUser.addEventListener("click", (e) => {
      if (!e.target.closest("#logout-btn")) {
        openProfileModal();
      }
    });
  }

  if (profileClose) {
    profileClose.addEventListener("click", () => {
      profileOverlay.style.display = "none";
    });
  }

  if (profileOverlay) {
    profileOverlay.addEventListener("click", (e) => {
      if (e.target === profileOverlay) {
        profileOverlay.style.display = "none";
      }
    });
  }

  if (profileForm) {
    profileForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const newPassword = document.getElementById("profile-new-password").value;
      if (newPassword.length < 6) {
        showToast("Password must be at least 6 characters.", "error");
        return;
      }
      showToast("Updating password...", "info");
      const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
      if (error) {
        showToast("Error updating password: " + error.message, "error");
      } else {
        showToast("Password updated successfully!", "success");
        profileOverlay.style.display = "none";
        logAudit("PROFILE_UPDATED", "Admin updated account password.");
      }
    });
  }
});
