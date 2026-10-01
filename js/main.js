import { SUPABASE_ANON_KEY, FUNCTIONS_URL, DEMO_SECONDS } from "./config.js";
import { extractYouTubeId } from "./supabaseClient.js";

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
const countdownEl = document.getElementById("countdown");
const expiredNote = document.getElementById("expiredNote");

const params = new URLSearchParams(location.search);
const expired = params.has("expired");

// รหัสที่สุ่มได้ เก็บไว้ในหน่วยความจำเท่านั้น (หน้า expired จะไม่มีรหัส)
let currentPin = null;

function randomPin() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1000000).padStart(6, "0");
}

function fillPin(pin) {
  pin.split("").forEach((d, i) => {
    pinBoxes[i].value = d;
    pinBoxes[i].classList.add("filled");
  });
}

// --- ตอนเปิดหน้า ---
if (expired) {
  // หมดเวลา: ช่องรหัสว่าง ไม่มีรหัสขึ้นมาให้
  expiredNote.style.display = "block";
  pinBoxes[0].focus();
} else {
  // กดลิงก์เข้ามาใหม่ = สุ่มรหัสใหม่ + กรอกให้อัตโนมัติ
  currentPin = randomPin();
  fillPin(currentPin);
}

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

pinForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const pin = pinBoxes.map((b) => b.value).join("");

  if (pin.length !== 6) {
    showError("กรุณากรอกรหัส PIN ให้ครบ 6 หลัก");
    return;
  }

  if (!currentPin || pin !== currentPin) {
    showError("รหัส PIN ไม่ถูกต้อง หรือหมดอายุ กรุณากดลิงก์ทดลองรับชมใหม่อีกครั้ง");
    return;
  }

  errorText.textContent = "";
  startDemo();
});

function showError(message) {
  errorText.textContent = message;
  pinRow.classList.remove("shake");
  void pinRow.offsetWidth;
  pinRow.classList.add("shake");
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

// ขอ token ทดลองรับชมจาก Supabase Edge Function "demo-session" (ใช้ไลฟ์ที่เปิดใช้งานล่าสุดในหน้า /admin)
async function fetchDemoSession() {
  const res = await fetch(`${FUNCTIONS_URL}/demo-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: "{}",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.text()).slice(0, 160); } catch (e) {}
    throw new Error(`HTTP ${res.status} ${detail}`);
  }
  return await res.json();
}

async function startDemo() {
  submitBtn.disabled = true;
  submitBtn.textContent = "กำลังตรวจสอบ...";

  let session;
  try {
    session = await fetchDemoSession();
  } catch (err) {
    resetSubmit();
    console.error("demo-session error:", err);
    showError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง [" + (err.message || err) + "]");
    return;
  }
  resetSubmit();

  if (!session) {
    showError("ขณะนี้ยังไม่มีคลิปให้ทดลองรับชม กรุณาลองใหม่ภายหลัง");
    return;
  }

  let src = null;
  if (session.platform === "cloudflare") {
    src = `https://customer-${session.customer_code}.cloudflarestream.com/${session.token}/iframe?autoplay=true`;
  } else {
    const videoId = extractYouTubeId(session.youtube_url);
    if (!videoId) {
      showError("ลิงก์คลิปไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ");
      return;
    }
    src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
  }

  enterStage(session, src);
}

function resetSubmit() {
  submitBtn.disabled = false;
  submitBtn.textContent = "เริ่มทดลองรับชม";
}

function enterStage(session, src) {
  ytFrame.src = src;
  liveTitle.textContent = session.title || "ทดลองรับชม";
  topBar.style.display = "flex";

  pinScreen.classList.add("curtain-exit");
  setTimeout(() => {
    pinScreen.style.display = "none";
    playerScreen.style.display = "block";
  }, 480);

  // นับถอยหลังด้วยเวลาจริง (กันแท็บถูกหน่วง) ครบเวลาแล้วเด้งกลับหน้าใส่รหัส
  const deadline = Date.now() + DEMO_SECONDS * 1000;
  const tick = () => {
    const left = Math.ceil((deadline - Date.now()) / 1000);
    if (left <= 0) {
      ytFrame.src = "";
      location.replace("./?expired=1");
      return;
    }
    countdownEl.textContent = `เหลือ ${formatTime(left)}`;
    setTimeout(tick, 250);
  };
  tick();
}
