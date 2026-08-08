import { supabase, extractYouTubeId } from "./supabaseClient.js";
import { SUPABASE_ANON_KEY, FUNCTIONS_URL } from "./config.js";

const codeInput = document.getElementById("codeInput");
const pinForm = document.getElementById("pinForm");
const submitBtn = document.getElementById("submitBtn");
const errorText = document.getElementById("errorText");
const pinScreen = document.getElementById("pinScreen");
const playerScreen = document.getElementById("playerScreen");
const liveTitle = document.getElementById("liveTitle");
const ytFrame = document.getElementById("ytFrame");
const topBar = document.getElementById("topBar");
const viewerCountText = document.getElementById("viewerCountText");

let lockoutTimer = null;

// --- ตัวระบุอุปกรณ์ (ใช้ล็อกรหัสให้ดูได้แค่ 1 เครื่องต่อรหัส) ---
// สุ่มครั้งเดียวแล้วเก็บไว้ในเครื่อง ไม่ใช่ข้อมูลส่วนตัว ใช้แยกแยะอุปกรณ์เท่านั้น
function getDeviceId() {
  const KEY = "star_live_device_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

// --- Code input: อนุญาตแค่ตัวอักษร A-Z และตัวเลข พิมพ์แล้วแปลงเป็นตัวใหญ่อัตโนมัติ ---
codeInput.addEventListener("input", () => {
  const cleaned = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  codeInput.value = cleaned;
  codeInput.classList.toggle("filled", cleaned.length === 8);
});

pinForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = codeInput.value.trim().toUpperCase();

  if (!/^ST[A-Z0-9]{6}$/.test(code)) {
    showError("กรุณากรอกรหัสให้ครบ 8 หลัก ขึ้นต้นด้วย ST");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "กำลังตรวจสอบ...";
  errorText.textContent = "";

  let res, body;
  try {
    res = await fetch(`${FUNCTIONS_URL}/verify-pin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ code, device_id: getDeviceId() }),
    });
    body = await res.json();
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = "เข้าสู่การถ่ายทอดสด";
    showError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
    return;
  }

  submitBtn.disabled = false;
  submitBtn.textContent = "เข้าสู่การถ่ายทอดสด";

  if (res.status === 429) {
    startLockoutCountdown(body.retry_after_seconds ?? 300);
    return;
  }

  if (!res.ok) {
    if (typeof body.attempts_left === "number" && body.attempts_left > 0) {
      showError(`รหัสไม่ถูกต้อง เหลืออีก ${body.attempts_left} ครั้งก่อนถูกล็อกชั่วคราว`);
    } else if (body.locked) {
      startLockoutCountdown(300);
    } else if (body.error === "expired") {
      showError("รหัสนี้หมดอายุการรับชมแล้ว กรุณาติดต่อแอดมิน");
    } else if (body.error === "device_mismatch") {
      showError("รหัสนี้ถูกใช้งานจากอุปกรณ์อื่นไปแล้ว (ดูได้ 1 เครื่องต่อรหัส)");
    } else {
      showError("รหัสไม่ถูกต้อง หรือหมดอายุ");
    }
    return;
  }

  enterStage(body);
});

function showError(message) {
  errorText.textContent = message;
  codeInput.classList.remove("shake");
  // force reflow so the animation can restart
  void codeInput.offsetWidth;
  codeInput.classList.add("shake");
}

function startLockoutCountdown(seconds) {
  clearInterval(lockoutTimer);
  submitBtn.disabled = true;
  let remaining = seconds;

  const render = () => {
    const m = Math.floor(remaining / 60);
    const s = String(remaining % 60).padStart(2, "0");
    errorText.textContent = `กรอกผิดครบ 3 ครั้ง กรุณารอ ${m}:${s} แล้วลองใหม่`;
  };
  render();

  lockoutTimer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(lockoutTimer);
      submitBtn.disabled = false;
      errorText.textContent = "";
      return;
    }
    render();
  }, 1000);
}

function enterStage(session) {
  let src = null;

  if (session.platform === "cloudflare") {
    const code = session.customer_code;
    src = `https://customer-${code}.cloudflarestream.com/${session.token}/iframe?autoplay=true`;
  } else {
    const videoId = extractYouTubeId(session.youtube_url);
    if (!videoId) {
      showError("ลิงก์การถ่ายทอดสดไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ");
      return;
    }
    src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
  }

  liveTitle.textContent = session.title;
  ytFrame.src = src;
  topBar.style.display = "flex";
  startViewerTracking(session.live_session_id);

  pinScreen.classList.add("curtain-exit");
  setTimeout(() => {
    pinScreen.style.display = "none";
    playerScreen.style.display = "block";
  }, 480);
}

// --- นับจำนวนคนกำลังดูแบบเรียลไทม์ (Supabase Realtime Presence) ---
// นับตามคอนเสิร์ต (live_session_id): ทุกคนที่ดูงานเดียวกันจะถูกนับรวมกัน
// ไม่ว่าจะใช้รหัสต่อออเดอร์คนละอันก็ตาม ไม่ใช่การเก็บข้อมูลส่วนตัวใด ๆ
function startViewerTracking(liveSessionId) {
  if (!liveSessionId) return;
  const viewerId = crypto.randomUUID();
  const channel = supabase.channel(`viewers:${liveSessionId}`, {
    config: { presence: { key: viewerId } },
  });

  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const count = Object.keys(state).length;
      viewerCountText.textContent = `${count.toLocaleString("en-US")} view`;
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ online_at: new Date().toISOString() });
      }
    });

  // เอาตัวเองออกจากการนับเมื่อปิดแท็บ/ออกจากหน้า
  window.addEventListener("beforeunload", () => {
    channel.unsubscribe();
  });
}
