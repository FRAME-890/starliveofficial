import { supabase } from "./supabaseClient.js";
import { SUPABASE_ANON_KEY, FUNCTIONS_URL } from "./config.js";

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
const eventDatesInput = document.getElementById("eventDatesInput");
const platformSelect = document.getElementById("platformSelect");
const youtubeField = document.getElementById("youtubeField");
const cloudflareField = document.getElementById("cloudflareField");
const urlInput = document.getElementById("urlInput");
const cfUidInput = document.getElementById("cfUidInput");
const activeToggle = document.getElementById("activeToggle");
const formError = document.getElementById("formError");
const sessionList = document.getElementById("sessionList");
const emptyState = document.getElementById("emptyState");

const codeFormCard = document.getElementById("codeFormCard");
const codeForm = document.getElementById("codeForm");
const codeConcertSelect = document.getElementById("codeConcertSelect");
const noConcertHint = document.getElementById("noConcertHint");
const customerNameInput = document.getElementById("customerNameInput");
const orderDateInput = document.getElementById("orderDateInput");
const validUntilInput = document.getElementById("validUntilInput");
const codeFormError = document.getElementById("codeFormError");
const finishCodeBtn = document.getElementById("finishCodeBtn");
const codeResult = document.getElementById("codeResult");
const codeMessageText = document.getElementById("codeMessageText");

platformSelect.addEventListener("change", () => togglePlatformFields(platformSelect.value));

function togglePlatformFields(platform) {
  const isCloudflare = platform === "cloudflare";
  youtubeField.style.display = isCloudflare ? "none" : "block";
  cloudflareField.style.display = isCloudflare ? "block" : "none";
}

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
  authSubtitle.textContent = "สำหรับควบคุมการถ่ายทอดสดและรหัสลูกค้า";
});

// ---------- สมัครสมาชิกแอดมิน (ผ่าน Edge Function — เช็ครหัสเชิญฝั่งเซิร์ฟเวอร์) ----------
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  signupError.textContent = "";

  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;
  const passwordConfirm = document.getElementById("signupPasswordConfirm").value;
  const inviteCode = document.getElementById("inviteCode").value.trim();

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

  let res, body;
  try {
    res = await fetch(`${FUNCTIONS_URL}/admin-signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ email, password, inviteCode }),
    });
    body = await res.json();
  } catch (err) {
    signupBtn.disabled = false;
    signupBtn.textContent = "สมัครสมาชิก";
    signupError.textContent = "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง";
    return;
  }

  signupBtn.disabled = false;
  signupBtn.textContent = "สมัครสมาชิก";

  if (!res.ok) {
    const messages = {
      invalid_invite_code: "รหัสเชิญไม่ถูกต้อง",
      already_registered: "อีเมลนี้สมัครไว้แล้ว กรุณาเข้าสู่ระบบแทน",
      weak_password: "รหัสผ่านต้องมีอย่างน้อย 8 ตัว",
      missing_fields: "กรุณากรอกข้อมูลให้ครบ",
    };
    signupError.textContent = messages[body.error] || "สมัครไม่สำเร็จ กรุณาลองใหม่";
    return;
  }

  const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
  if (loginErr) {
    signupForm.reset();
    document.getElementById("showLogin").click();
    return;
  }
  showDashboard();
});

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

// ---------- Concert form open/close ----------
document.getElementById("newSessionBtn").addEventListener("click", () => {
  closeCodeForm();
  openForm();
});
document.getElementById("cancelFormBtn").addEventListener("click", () => closeForm());

function openForm(session = null) {
  formError.textContent = "";
  if (session) {
    formTitle.textContent = "แก้ไขไลฟ์";
    sessionIdInput.value = session.id;
    titleInput.value = session.title;
    eventDatesInput.value = session.event_dates || "";
    platformSelect.value = session.platform || "youtube";
    urlInput.value = session.youtube_url || "";
    cfUidInput.value = session.cloudflare_uid || "";
    setToggle(session.is_active);
  } else {
    formTitle.textContent = "สร้างไลฟ์ใหม่";
    sessionForm.reset();
    sessionIdInput.value = "";
    platformSelect.value = "youtube";
    setToggle(false);
  }
  togglePlatformFields(platformSelect.value);
  formCard.style.display = "block";
  formCard.scrollIntoView({ behavior: "smooth", block: "center" });
}

function closeForm() {
  formCard.style.display = "none";
  sessionForm.reset();
}

// ---------- Active toggle (concert) ----------
let toggleState = false;
function setToggle(state) {
  toggleState = state;
  activeToggle.classList.toggle("on", state);
}
activeToggle.addEventListener("click", () => setToggle(!toggleState));

// ---------- Save concert (create or update) ----------
sessionForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.textContent = "";

  const platform = platformSelect.value;
  const payload = {
    title: titleInput.value.trim(),
    event_dates: eventDatesInput.value.trim() || null,
    platform,
    youtube_url: platform === "youtube" ? urlInput.value.trim() : null,
    cloudflare_uid: platform === "cloudflare" ? cfUidInput.value.trim() : null,
    is_active: toggleState,
  };

  if (platform === "youtube" && !payload.youtube_url) {
    formError.textContent = "กรุณาวางลิงก์ YouTube Live";
    return;
  }
  if (platform === "cloudflare" && !payload.cloudflare_uid) {
    formError.textContent = "กรุณากรอก Cloudflare Stream UID";
    return;
  }

  const id = sessionIdInput.value;
  const query = id
    ? supabase.from("live_sessions").update(payload).eq("id", id)
    : supabase.from("live_sessions").insert(payload);

  const { error } = await query;

  if (error) {
    formError.textContent = "เกิดข้อผิดพลาด: " + error.message;
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
        ${s.event_dates ? `<span class="muted" style="font-size:12px;">${escapeHtml(s.event_dates)}</span>` : ""}
        <span class="muted" style="font-size:12px;">${s.platform === "cloudflare" ? "Cloudflare Stream" : "YouTube"}</span>
        <span class="muted" style="font-size:12px;">สร้างเมื่อ ${created}</span>
      </div>
    </div>
    <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
      <button class="toggle ${s.is_active ? "on" : ""}" data-action="toggle" title="เปิด/ปิดการถ่ายทอดสด"></button>
      <button class="icon-btn ghost" data-action="edit">แก้ไข</button>
      <button class="icon-btn" data-action="delete">ลบ</button>
    </div>
  `;

  row.querySelector('[data-action="toggle"]').addEventListener("click", async () => {
    await supabase.from("live_sessions").update({ is_active: !s.is_active }).eq("id", s.id);
    loadSessions();
  });

  row.querySelector('[data-action="edit"]').addEventListener("click", () => openForm(s));

  row.querySelector('[data-action="delete"]').addEventListener("click", async () => {
    if (!confirm(`ลบไลฟ์ "${s.title}" ใช่หรือไม่? รหัสลูกค้าที่ผูกกับไลฟ์นี้จะถูกลบไปด้วย`)) return;
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

// ============================================================
// สร้างรหัสลูกค้า (1 รหัส = 1 ออเดอร์ ผูกกับคอนเสิร์ต + วันหมดอายุ)
// ============================================================
let concertsById = {};

document.getElementById("newCodeBtn").addEventListener("click", () => {
  closeForm();
  openCodeForm();
});
document.getElementById("cancelCodeFormBtn").addEventListener("click", () => closeCodeForm());
document.getElementById("closeCodeResultBtn").addEventListener("click", () => closeCodeForm());

async function openCodeForm() {
  codeFormError.textContent = "";
  codeForm.reset();
  codeForm.style.display = "block";
  codeResult.style.display = "none";
  orderDateInput.value = new Date().toISOString().slice(0, 10);

  await loadConcertsIntoSelect();

  codeFormCard.style.display = "block";
  codeFormCard.scrollIntoView({ behavior: "smooth", block: "center" });
}

function closeCodeForm() {
  codeFormCard.style.display = "none";
  codeForm.reset();
  codeForm.style.display = "block";
  codeResult.style.display = "none";
}

async function loadConcertsIntoSelect() {
  const { data, error } = await supabase
    .from("live_sessions")
    .select("id, title, event_dates")
    .order("created_at", { ascending: false });

  concertsById = {};
  codeConcertSelect.innerHTML = "";

  if (error || !data || data.length === 0) {
    noConcertHint.style.display = "block";
    finishCodeBtn.disabled = true;
    return;
  }

  noConcertHint.style.display = "none";
  finishCodeBtn.disabled = false;

  data.forEach((c) => {
    concertsById[c.id] = c;
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.title;
    codeConcertSelect.appendChild(opt);
  });
}

function generateCustomerCode() {
  // ตัดตัวอักษร/ตัวเลขที่สับสนง่ายออก (O, 0, I, 1, L)
  const charset = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let rand = "";
  for (let i = 0; i < 6; i++) {
    rand += charset[Math.floor(Math.random() * charset.length)];
  }
  return "ST" + rand;
}

codeForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  codeFormError.textContent = "";

  const concertId = codeConcertSelect.value;
  const concert = concertsById[concertId];
  const customerName = customerNameInput.value.trim();
  const orderDate = orderDateInput.value;
  const validUntilLocal = validUntilInput.value;

  if (!concert) {
    codeFormError.textContent = "กรุณาเลือกคอนเสิร์ต";
    return;
  }
  if (!customerName) {
    codeFormError.textContent = "กรุณากรอกชื่อลูกค้า";
    return;
  }
  if (!orderDate || !validUntilLocal) {
    codeFormError.textContent = "กรุณากรอกวันที่ซื้อและวันหมดอายุการรับชม";
    return;
  }

  finishCodeBtn.disabled = true;
  finishCodeBtn.textContent = "กำลังสร้างรหัส...";

  const validUntilIso = new Date(validUntilLocal).toISOString();

  // ลองสุ่มรหัสแล้ว insert ถ้าชนกับรหัสเดิม (unique) ให้สุ่มใหม่ ลองสูงสุด 5 ครั้ง
  let insertedCode = null;
  let lastError = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCustomerCode();
    const { error } = await supabase.from("customer_codes").insert({
      code,
      live_session_id: concertId,
      customer_name: customerName,
      order_date: orderDate,
      valid_until: validUntilIso,
    });

    if (!error) {
      insertedCode = code;
      break;
    }
    lastError = error;
    if (!error.message.includes("duplicate")) break; // error อื่นที่ไม่ใช่รหัสชนกัน ไม่ต้องลองซ้ำ
  }

  finishCodeBtn.disabled = false;
  finishCodeBtn.textContent = "เสร็จสิ้น";

  if (!insertedCode) {
    codeFormError.textContent = "สร้างรหัสไม่สำเร็จ: " + (lastError?.message || "ไม่ทราบสาเหตุ กรุณาลองใหม่");
    return;
  }

  const siteUrl = window.location.origin;
  const message = `${concert.title}
วัน: ${concert.event_dates || "-"}
ขอบคุณที่ใช้บริการ STARLIVE OFFICIAL ครับ💙
รหัสชมไลฟ์และรีรัน: ${insertedCode} *รหัสสามารถรับชมได้1เครื่องต่อรหัส*
ลิงก์เว็บไซต์รับชมไลฟ์และรีรัน: ${siteUrl}
💬 มีแอดมินดูแลตลอดการรับชม
หากพบปัญหาในการเข้ากลุ่มหรือรับชม สามารถแจ้งแอดมินได้ตลอดครับ
ขอบคุณที่ไว้วางใจ STARLIVE OFFICIAL ขอให้สนุกกับการรับชมคอนเสิร์ตครับ 💙`;

  codeMessageText.value = message;
  codeForm.style.display = "none";
  codeResult.style.display = "block";
});

document.getElementById("copyCodeMessageBtn").addEventListener("click", () => {
  navigator.clipboard.writeText(codeMessageText.value);
  const btn = document.getElementById("copyCodeMessageBtn");
  const original = btn.textContent;
  btn.textContent = "คัดลอกแล้ว";
  setTimeout(() => (btn.textContent = original), 1200);
});
