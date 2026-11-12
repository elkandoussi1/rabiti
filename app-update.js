/* Refresh the Rabiti shell without clearing the session or unsaved edits. */
window.RABITI_UPDATES = (() => {
  const version = "2026.11.12.4";
  let registration;
  let lastCheck = 0;
  let busy = false;

  function toast(message, ms = 4200, type = "info") {
    if (window.RABITI_APP?.toast) return window.RABITI_APP.toast(message, type === "info" ? "ok" : type, ms);
    const box = document.createElement("div");
    box.textContent = message;
    box.style.cssText = "position:fixed;inset-inline:16px;bottom:16px;z-index:9999;padding:12px 16px;border-radius:12px;background:#1f2937;color:#fff;font:600 13px Cairo,system-ui,sans-serif;text-align:center";
    document.body.appendChild(box);
    setTimeout(() => box.remove(), ms);
  }

  function banner() {
    if (document.getElementById("app-update-banner")) return;
    const node = document.createElement("div");
    node.id = "app-update-banner";
    node.className = "update-banner";
    node.setAttribute("role", "status");
    node.innerHTML = '<span class="sp">يتوفر تحديث جديد لرابطي</span><button class="btn sm" type="button">حفظ وتحديث</button>';
    node.querySelector("button").onclick = apply;
    document.body.appendChild(node);
  }

  async function apply() {
    if (busy) return;
    if (document.querySelector(".overlay")) {
      toast("أغلق النافذة المفتوحة أولًا ثم حدّث التطبيق.", 4200, "err");
      return;
    }
    busy = true;
    try {
      if (window.RABITI_APP?.persist) {
        const saved = await window.RABITI_APP.persist();
        if (saved === false) throw new Error("تعذر حفظ المسودة. أعد المحاولة عند الاتصال.");
      }
      location.reload();
    } catch (error) {
      toast(error?.message || "تعذر حفظ المسودة.", 4200, "err");
      busy = false;
    }
  }

  async function check(manual = false) {
    if (!manual && Date.now() - lastCheck < 60000) return;
    lastCheck = Date.now();
    try {
      if (registration) await registration.update();
      const response = await fetch(new URL("release.json", location.href), { cache: "no-store" });
      if (!response.ok) throw new Error("release unavailable");
      const next = await response.json();
      if (next.version !== version) {
        banner();
        return;
      }
      if (manual) toast("أنت تستخدم أحدث إصدار: Rabiti 2.1", 4200, "ok");
    } catch {
      if (manual) toast("تعذر التحقق من التحديث. تحقق من اتصال الإنترنت.", 4200, "err");
    }
  }

  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" })
      .then((value) => { registration = value; return check(); })
      .catch(() => {});
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // The first install also fires this event; only an actual replacement
      // deserves the "new version" toast.
      if (hadController) check(true);
    });
    window.addEventListener("online", () => check());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") check();
    });
  }

  return { version, check, apply };
})();
