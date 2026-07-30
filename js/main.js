import { supabase, extractYouTubeId } from "./supabaseClient.js";

const pinBoxes = Array.from(document.querySelectorAll(".pin-box"));
const pinRow = document.getElementById("pinRow");
const pinForm = document.getElementById("pinForm");
const submitBtn = document.getElementById("submitBtn");
const errorText = document.getElementById("errorText");
const pinScreen = document.getElementById("pinScreen");
const playerScreen = document.getElementById("playerScreen");
const liveTitle = document.getElementById("liveTitle");
const ytFrame = document.getElementById("ytFrame");

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

  const { data, error } = await supabase.rpc("verify_pin", { input_pin: pin });

  submitBtn.disabled = false;
  submitBtn.textContent = "เข้าสู่การถ่ายทอดสด";

  if (error || !data || data.length === 0) {
    showError("รหัส PIN ไม่ถูกต้อง หรือหมดอายุ");
    return;
  }

  const session = data[0];
  enterStage(session);
});

function showError(message) {
  errorText.textContent = message;
  pinRow.classList.remove("shake");
  // force reflow so the animation can restart
  void pinRow.offsetWidth;
  pinRow.classList.add("shake");
}

function enterStage(session) {
  const videoId = extractYouTubeId(session.youtube_url);
  if (!videoId) {
    showError("ลิงก์การถ่ายทอดสดไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ");
    return;
  }

  liveTitle.textContent = session.title;
  ytFrame.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;

  pinScreen.classList.add("curtain-exit");
  setTimeout(() => {
    pinScreen.style.display = "none";
    playerScreen.style.display = "block";
  }, 480);
}
