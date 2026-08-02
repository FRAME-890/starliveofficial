import { supabase, extractYouTubeId } from "./supabaseClient.js";
import { SUPABASE_ANON_KEY, FUNCTIONS_URL } from "./config.js";

const pinBoxes = Array.from(document.querySelectorAll(".pin-box"));
const pinRow = document.getElementById("pinRow");
const pinForm = document.getElementById("pinForm");
const submitBtn = document.getElementById("submitBtn");
const errorText = document.getElementById("errorText");
const pinScreen = document.getElementById("pinScreen");
const playerScreen = document.getElementById("playerScreen");
const liveTitle = document.getElementById("liveTitle");
const ytFrame = document.getElementById("ytFrame");
const topBar = document.getElementById("topBar");
const viewerCountEl = document.getElementById("viewerCount");

let lockoutTimer = null;

// --- PIN box behaviour: auto-advance, backspace, paste-friendly ---
pinBoxes.forEach((box, i) => {
  box.addEventListener("input", () => {
    box.value = box.value.replace(/[^0-9]/g, "").slice(0, 1);
    box.classList.toggle("filled", box.value.length === 1);
    if (box.value && i < pinBoxes.length - 1) pinBoxes[i + 1].focus();
  });

  box.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !box.value && i > 0) {
      pinBoxes[i - 1].focus();
    }
  });

  box.addEventListener("paste", (e) => {
    e.preventDefault();
    const digits = (e.clipboardData.getData("text") || "").replace(/[^0-9]/g, "").slice(0, 6).split("");
    digits.forEach((d, idx) => {
      if (pinBoxes[idx]) {
        pinBoxes[idx].value = d;
        pinBoxes[idx].classList.add("filled");
      }
    });
    (pinBoxes[digits.length - 1] || pinBoxes[0]).focus();
  });
});

pinForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const pin = pinBoxes.map((b) => b.value).join("");

  if (pin.length !== 6) {
    showError("กรุณากรอกรหัส PIN ให้ครบ 6 หลัก");
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
      body: JSON.stringify({ pin }),
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
      showError(`รหัส PIN ไม่ถูกต้อง เหลืออีก ${body.attempts_left} ครั้งก่อนถูกล็อกชั่วคราว`);
    } else if (body.locked) {
      startLockoutCountdown(300);
    } else {
      showError("รหัส PIN ไม่ถูกต้อง หรือหมดอายุ");
    }
    return;
  }

  enterStage(body, pin);
});

function showError(message) {
  errorText.textContent = message;
  pinRow.classList.remove("shake");
  // force reflow so the animation can restart
  void pinRow.offsetWidth;
  pinRow.classList.add("shake");
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

function enterStage(session, pin) {
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
  startViewerTracking(pin);

  pinScreen.classList.add("curtain-exit");
  setTimeout(() => {
    pinScreen.style.display = "none";
    playerScreen.style.display = "block";
  }, 480);
}

// --- นับจำนวนคนกำลังดูแบบเรียลไทม์ (Supabase Realtime Presence) ---
// นับตาม PIN: ใครก็ตามที่เข้าห้องไลฟ์เดียวกันตอนนี้จะถูกนับรวมกัน
// เป็นการนับ "จำนวนแท็บ/อุปกรณ์ที่เปิดหน้านี้อยู่" ไม่ใช่การเก็บข้อมูลส่วนตัวใด ๆ
function startViewerTracking(pin) {
  const viewerId = crypto.randomUUID();
  const channel = supabase.channel(`viewers:${pin}`, {
    config: { presence: { key: viewerId } },
  });

  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const count = Object.keys(state).length;
      viewerCountEl.textContent = `👁 ${count.toLocaleString("th-TH")} คนกำลังดู`;
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
