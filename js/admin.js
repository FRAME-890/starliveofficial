import { supabase } from "./supabaseClient.js";
import { ADMIN_INVITE_CODE } from "./config.js";

const loginScreen = document.getElementById("loginScreen");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const loginBtn = document.getElementById("loginBtn");

const signupForm = document.getElementById("signupForm");
const signupError = document.getElementById("signupError");
const signupBtn = document.getElementById("signupBtn");
const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");

const formCard = document.getElementById("formCard");
const formTitle = document.getElementById("formTitle");
const sessionForm = document.getElementById("sessionForm");
const sessionIdInput = document.getElementById("sessionId");
const titleInput = document.getElementById("titleInput");
const urlInput = document.getElementById("urlInput");
const pinInput = document.getElementById("pinInput");
const activeToggle = document.getElementById("activeToggle");
const formError = document.getElementById("formError");
const sessionList = document.getElementById("sessionList");
const emptyState = document.getElementById("emptyState");

// ---------- Login gate (Supabase Auth) ----------
const { data: { session } } = await supabase.auth.getSession();
if (session) showDashboard();

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  loginBtn.disabled = true;
  loginBtn.textContent = "กำลังเข้าสู่ระบบ...";

  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  loginBtn.disabled = false;
  loginBtn.textContent = "เข้าสู่ระบบ";

  if (error) {
    loginError.textContent = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
    return;
  }
  showDashboard();
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  location.reload();
});

// ---------- สลับระหว่างฟอร์ม เข้าสู่ระบบ / สมัครสมาชิก ----------
document.getElementById("showSignup").addEventListener("click", (e) => {
  e.preventDefault();
  loginForm.style.display = "none";
  signupForm.style.display = "block";
  authTitle.textContent = "สมัครสมาชิกแอดมิน";
  authSubtitle.textContent = "ต้องมีรหัสเชิญจากผู้ดูแลระบบเท่านั้น";
});

document.getElementById("showLogin").addEventListener("click", (e) => {
  e.preventDefault();
  signupForm.style.display = "none";
  loginForm.style.display = "block";
  authTitle.textContent = "เข้าสู่ระบบผู้ดูแล";
  authSubtitle.textContent = "สำหรับควบคุมการถ่ายทอดสดและรหัส PIN";
});

// ---------- สมัครสมาชิกแอดมิน (Supabase Auth) ----------
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  signupError.textContent = "";

  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;
  const passwordConfirm = document.getElementById("signupPasswordConfirm").value;
  const invite = document.getElementById("inviteCode").value.trim();

  if (invite !== ADMIN_INVITE_CODE) {
    signupError.textContent = "รหัสเชิญไม่ถูกต้อง";
    return;
  }
  if (password.length < 8) {
    signupError.textContent = "รหัสผ่านต้องมีอย่างน้อย 8 ตัว";
    return;
  }
  if (password !== passwordConfirm) {
    signupError.textContent = "รหัสผ่านทั้งสองช่องไม่ตรงกัน";
    return;
  }

  signupBtn.disabled = true;
  signupBtn.textContent = "กำลังสมัครสมาชิก...";

  const { data, error } = await supabase.auth.signUp({ email, password });

  signupBtn.disabled = false;
  signupBtn.textContent = "สมัครสมาชิก";

  if (error) {
    signupError.textContent = error.message.includes("already registered")
      ? "อีเมลนี้สมัครไว้แล้ว กรุณาเข้าสู่ระบบแทน"
      : "สมัครไม่สำเร็จ: " + error.message;
    return;
  }

  // ถ้าโปรเจกต์เปิด "Confirm email" ไว้ ผู้ใช้ต้องกดยืนยันในอีเมลก่อนถึงจะล็อกอินได้
  if (data.user && !data.session) {
    signupForm.reset();
    signupError.style.color = "var(--amber)";
    signupError.textContent = "สมัครสำเร็จ กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ";
    return;
  }

  // ถ้าปิด email confirmation ไว้ จะได้ session ทันทีและเข้าแดชบอร์ดได้เลย
  showDashboard();
});

// เผื่อ session หมดอายุระหว่างใช้งาน (เช่น token ถูก revoke) ให้เด้งกลับหน้า login อัตโนมัติ
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    dashboard.style.display = "none";
    loginScreen.style.display = "flex";
  }
});

function showDashboard() {
  loginScreen.style.display = "none";
  dashboard.style.display = "block";
  loadSessions();
}

// ---------- Form open/close ----------
document.getElementById("newSessionBtn").addEventListener("click", () => openForm());
document.getElementById("cancelFormBtn").addEventListener("click", () => closeForm());

function openForm(session = null) {
  formError.textContent = "";
  if (session) {
    formTitle.textContent = "แก้ไขไลฟ์";
    sessionIdInput.value = session.id;
    titleInput.value = session.title;
    urlInput.value = session.youtube_url;
    pinInput.value = session.pin;
    setToggle(session.is_active);
  } else {
    formTitle.textContent = "สร้างไลฟ์ใหม่";
    sessionForm.reset();
    sessionIdInput.value = "";
    setToggle(false);
  }
  formCard.style.display = "block";
  formCard.scrollIntoView({ behavior: "smooth", block: "center" });
}

function closeForm() {
  formCard.style.display = "none";
  sessionForm.reset();
}

// ---------- Active toggle ----------
let toggleState = false;
function setToggle(state) {
  toggleState = state;
  activeToggle.classList.toggle("on", state);
}
activeToggle.addEventListener("click", () => setToggle(!toggleState));

// ---------- Random PIN ----------
document.getElementById("randomPinBtn").addEventListener("click", () => {
  pinInput.value = String(Math.floor(100000 + Math.random() * 900000));
});

// ---------- Save (create or update) ----------
sessionForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.textContent = "";

  const pin = pinInput.value.trim();
  if (!/^\d{6}$/.test(pin)) {
    formError.textContent = "รหัส PIN ต้องเป็นตัวเลข 6 หลัก";
    return;
  }

  const payload = {
    title: titleInput.value.trim(),
    youtube_url: urlInput.value.trim(),
    pin,
    is_active: toggleState,
  };

  const id = sessionIdInput.value;
  const query = id
    ? supabase.from("live_sessions").update(payload).eq("id", id)
    : supabase.from("live_sessions").insert(payload);

  const { error } = await query;

  if (error) {
    formError.textContent = error.message.includes("duplicate")
      ? "รหัส PIN นี้ถูกใช้งานแล้ว กรุณาเลือกรหัสอื่น"
      : "เกิดข้อผิดพลาด: " + error.message;
    return;
  }

  closeForm();
  loadSessions();
});

// ---------- List + row actions ----------
async function loadSessions() {
  const { data, error } = await supabase
    .from("live_sessions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    sessionList.innerHTML = `<p class="error-text">โหลดข้อมูลไม่สำเร็จ: ${error.message}</p>`;
    return;
  }

  sessionList.innerHTML = "";
  emptyState.style.display = data.length === 0 ? "block" : "none";

  data.forEach((s) => sessionList.appendChild(renderRow(s)));
}

function renderRow(s) {
  const row = document.createElement("div");
  row.className = "session-row";

  const created = new Date(s.created_at).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  row.innerHTML = `
    <div style="min-width:0;">
      <div style="font-family:'Prompt',sans-serif; font-weight:600; font-size:15px; margin-bottom:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
        ${escapeHtml(s.title)}
      </div>
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <span class="pin-chip">${s.pin}</span>
        <span class="muted" style="font-size:12px;">สร้างเมื่อ ${created}</span>
      </div>
    </div>
    <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
      <button class="icon-btn ghost" data-action="copy">คัดลอก PIN</button>
      <button class="toggle ${s.is_active ? "on" : ""}" data-action="toggle" title="เปิด/ปิดการถ่ายทอดสด"></button>
      <button class="icon-btn ghost" data-action="edit">แก้ไข</button>
      <button class="icon-btn" data-action="delete">ลบ</button>
    </div>
  `;

  row.querySelector('[data-action="copy"]').addEventListener("click", () => {
    navigator.clipboard.writeText(s.pin);
    const btn = row.querySelector('[data-action="copy"]');
    const original = btn.textContent;
    btn.textContent = "คัดลอกแล้ว";
    setTimeout(() => (btn.textContent = original), 1200);
  });

  row.querySelector('[data-action="toggle"]').addEventListener("click", async () => {
    await supabase.from("live_sessions").update({ is_active: !s.is_active }).eq("id", s.id);
    loadSessions();
  });

  row.querySelector('[data-action="edit"]').addEventListener("click", () => openForm(s));

  row.querySelector('[data-action="delete"]').addEventListener("click", async () => {
    if (!confirm(`ลบไลฟ์ "${s.title}" ใช่หรือไม่?`)) return;
    await supabase.from("live_sessions").delete().eq("id", s.id);
    loadSessions();
  });

  return row;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
