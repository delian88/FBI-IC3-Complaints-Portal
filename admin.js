const SUPABASE_URL = "https://hmfuppjdagkufqzwsbrr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtZnVwcGpkYWdrdWZxendzYnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMTkzMTgsImV4cCI6MjA5ODU5NTMxOH0.nkrwlF_v_6HFFn89UGCbova_Zfo69GvN3TJbmMxF3Cg";

// Initialize Supabase Client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function showToast(message, type) {
  type = type || "success";
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = "toast toast-" + type;
  const icon = type === "error" ? "✗" : type === "info" ? "ℹ" : "✓";
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-message">${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.add("toast-fade-out");
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => {
      if (toast.parentNode) toast.remove();
    }, { once: true });
  }, 5000);
}

document.addEventListener("DOMContentLoaded", () => {
  const loginSection = document.getElementById("login-section");
  const dashboardSection = document.getElementById("dashboard-section");
  const loginForm = document.getElementById("login-form");
  const logoutBtn = document.getElementById("logout-btn");
  const bulkEmailForm = document.getElementById("bulk-email-form");

  // Check auth state
  supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      showDashboard();
    }
  });

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session) {
      showDashboard();
    } else {
      showLogin();
    }
  });

  // Handle Login
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const errorEl = document.getElementById("login-error");
    
    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      errorEl.innerText = error.message;
      showToast(error.message, "error");
    } else {
      showToast("Logged in successfully!", "success");
    }
  });

  // Handle Logout
  logoutBtn.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    showToast("Logged out successfully!", "info");
  });

  // Show Dashboard
  function showDashboard() {
    loginSection.classList.remove("active");
    dashboardSection.classList.add("active");
    loadComplaints();
  }

  // Show Login
  function showLogin() {
    dashboardSection.classList.remove("active");
    loginSection.classList.add("active");
  }

  // Load Complaints
  async function loadComplaints() {
    const { data, error } = await supabaseClient
      .from("complaints")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading complaints:", error);
      return;
    }

    const tbody = document.querySelector("#complaints-table tbody");
    tbody.innerHTML = "";

    data.forEach(complaint => {
      const date = new Date(complaint.created_at).toLocaleDateString();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${date}</td>
        <td>${complaint.fullname || "N/A"}</td>
        <td>${complaint.email || "N/A"}</td>
        <td>${complaint.category || "N/A"}</td>
        <td>${complaint.lossamount || "N/A"}</td>
        <td><button onclick="viewDetails('${complaint.id}')">View</button></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Handle Bulk Email
  bulkEmailForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const subject = document.getElementById("email-subject").value;
    const body = document.getElementById("email-body").value;
    const btn = document.getElementById("send-email-btn");
    const statusEl = document.getElementById("email-status");

    btn.disabled = true;
    statusEl.style.color = "orange";
    statusEl.innerText = "Sending emails to all complainants...";

    try {
      showToast("Sending emails to all complainants...", "info");
      // Call Supabase Edge Function to send bulk email
      const { data, error } = await supabaseClient.functions.invoke("send-email", {
        body: { subject, htmlBody: body, bulk: true }
      });

      if (error) throw error;
      
      statusEl.style.color = "green";
      statusEl.innerText = "Bulk email sent successfully!";
      showToast("Bulk email sent successfully!", "success");
      bulkEmailForm.reset();
    } catch (err) {
      console.error(err);
      statusEl.style.color = "red";
      statusEl.innerText = "Error sending emails: " + err.message;
      showToast("Error sending emails: " + err.message, "error");
    } finally {
      btn.disabled = false;
    }
  });
});

window.viewDetails = function(id) {
  // In a real app, this would open a modal with the full complaint details.
  // For now we'll just alert the user that the data exists.
  alert("View details for complaint ID: " + id);
};
