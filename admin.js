// ==========================================================================
// THE CHAYA & CO. — UPGRADED ADMIN SCRIPT
// ==========================================================================

/* ---- CONSTANTS & STATE ---- */
const INACTIVITY_TIMEOUT_MINUTES = 20;
const WARNING_BEFORE_MINUTES = 2;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];

let inactivityTimer = null;
let warningTimer = null;
let warningBanner = null;
let menuItemsCache = [];
let editingItemId = null;
let currentSiteContent = null;
let ordersListener = null;
let currentOrderFilter = { status: "", payment: "", channel: "", search: "" };

/* ---- HELPER FUNCTIONS ---- */
function fmt(n) { return Number(n || 0).toFixed(2); }

function icon(name, size = 16) {
  const paths = ICONS[name] || "";
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

function showToast(message, type = "info", duration = 4000) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.setAttribute("role", "alert");
  toast.setAttribute("aria-live", "polite");

  const icons = {
    success: `<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error: `<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info: `<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  };

  toast.innerHTML = `${icons[type]}<span class="toast__message">${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "slideInRight 0.3s var(--ease-out) reverse";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ---- INACTIVITY TIMER ---- */
function clearWarningBanner() {
  if (warningBanner) { warningBanner.remove(); warningBanner = null; }
}

function showInactivityWarning() {
  clearWarningBanner();
  warningBanner = document.getElementById("inactivity-warning-banner");
  if (!warningBanner) return;
  warningBanner.textContent = `You'll be logged out in ${WARNING_BEFORE_MINUTES} minutes due to inactivity — move your mouse or tap anywhere to stay logged in.`;
  warningBanner.classList.remove("hidden");
}

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  clearTimeout(warningTimer);
  clearWarningBanner();

  const warningMs = (INACTIVITY_TIMEOUT_MINUTES - WARNING_BEFORE_MINUTES) * 60 * 1000;
  const logoutMs = INACTIVITY_TIMEOUT_MINUTES * 60 * 1000;

  warningTimer = setTimeout(showInactivityWarning, warningMs);
  inactivityTimer = setTimeout(() => auth.signOut(), logoutMs);
}

function startInactivityTimer() {
  resetInactivityTimer();
  ACTIVITY_EVENTS.forEach(evt => document.addEventListener(evt, resetInactivityTimer, { passive: true }));
}

function stopInactivityTimer() {
  clearTimeout(inactivityTimer);
  clearTimeout(warningTimer);
  clearWarningBanner();
  ACTIVITY_EVENTS.forEach(evt => document.removeEventListener(evt, resetInactivityTimer));
}

/* ---- AUTH ---- */
document.getElementById("login-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errorEl = document.getElementById("login-error");
  const btn = document.getElementById("login-btn");

  errorEl.textContent = "";
  if (typeof DEMO_MODE !== "undefined" && DEMO_MODE) {
    errorEl.textContent = "Firebase isn't connected yet — paste your config into firebase-config.js first.";
    return;
  }

  btn.disabled = true;
  btn.classList.add("btn--loading");

  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    errorEl.textContent = "Couldn't sign in — check your email and password and try again.";
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.classList.remove("btn--loading");
  }
});

document.getElementById("logout-btn")?.addEventListener("click", () => auth.signOut());

if (typeof DEMO_MODE !== "undefined" && !DEMO_MODE) {
  auth.onAuthStateChanged(async (user) => {
    const loginScreen = document.getElementById("login-screen");
    const adminApp = document.getElementById("admin-app");

    if (user) {
      loginScreen.classList.add("hidden");
      adminApp.classList.remove("hidden");
      document.getElementById("admin-user-email").textContent = user.email;

      await loadMenuAdmin();
      startOrdersListener();
      loadSiteEditor();
      startInactivityTimer();
    } else {
      loginScreen.classList.remove("hidden");
      adminApp.classList.add("hidden");
      stopInactivityTimer();
      if (ordersListener) { ordersListener(); ordersListener = null; }
    }
  });
} else {
  document.getElementById("login-error").textContent = "Firebase isn't connected yet — paste your config into firebase-config.js to enable login.";
}

/* ---- TABS ---- */
document.querySelectorAll(".admin-tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab-btn").forEach(b => {
      b.classList.remove("active");
      b.setAttribute("aria-selected", "false");
    });
    btn.classList.add("active");
    btn.setAttribute("aria-selected", "true");

    document.getElementById("panel-orders").classList.toggle("hidden", btn.dataset.tab !== "orders");
    document.getElementById("panel-menu").classList.toggle("hidden", btn.dataset.tab !== "menu");
    document.getElementById("panel-site").classList.toggle("hidden", btn.dataset.tab !== "site");

    // Update aria-controls
    btn.setAttribute("aria-controls", `panel-${btn.dataset.tab}`);
  });
});

/* ---- ORDERS ---- */
const ORDER_STATUSES = [
  { value: "new", label: "New" }, { value: "accepted", label: "Accepted" },
  { value: "preparing", label: "Preparing" }, { value: "ready", label: "Ready" },
  { value: "out_for_delivery", label: "Out for Delivery" }, { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" }, { value: "refunded", label: "Refunded" },
];

const PAYMENT_STATUSES = [
  { value: "cod", label: "COD" }, { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" }, { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" }, { value: "partial_refund", label: "Partially Refunded" },
];

function startOrdersListener() {
  if (ordersListener) ordersListener();

  ordersListener = db.collection("orders")
    .orderBy("createdAt", "desc")
    .onSnapshot(
      (snap) => {
        const list = document.getElementById("orders-list");
        const empty = document.getElementById("orders-empty");
        if (!list) return;

        list.innerHTML = "";
        const orders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(filterOrder);

        empty.classList.toggle("hidden", orders.length > 0);

        // Update badge
        const badge = document.getElementById("orders-badge");
        if (badge) {
          badge.textContent = orders.length;
          badge.classList.toggle("tab-badge--visible", orders.length > 0);
        }

        orders.forEach(order => list.appendChild(renderOrderCard(order)));
      },
      (err) => console.error("Orders listener error:", err)
    );
}

function filterOrder(order) {
  if (currentOrderFilter.status && order.status !== currentOrderFilter.status) return false;
  if (currentOrderFilter.payment && order.paymentStatus !== currentOrderFilter.payment) return false;
  if (currentOrderFilter.channel && order.orderChannel !== currentOrderFilter.channel) return false;
  if (currentOrderFilter.search) {
    const search = currentOrderFilter.search.toLowerCase();
    const orderId = (order.orderId || "").toLowerCase();
    const name = (order.name || "").toLowerCase();
    const phone = (order.phone || "").toLowerCase();
    if (!orderId.includes(search) && !name.includes(search) && !phone.includes(search)) return false;
  }
  return true;
}

// Filter event listeners
document.getElementById("filter-status")?.addEventListener("change", (e) => {
  currentOrderFilter.status = e.target.value;
  startOrdersListener(); // Re-trigger to re-filter
});
document.getElementById("filter-payment")?.addEventListener("change", (e) => {
  currentOrderFilter.payment = e.target.value;
  startOrdersListener();
});
document.getElementById("filter-channel")?.addEventListener("change", (e) => {
  currentOrderFilter.channel = e.target.value;
  startOrdersListener();
});
document.getElementById("search-orders")?.addEventListener("input", (e) => {
  currentOrderFilter.search = e.target.value.trim();
  // Debounce
  clearTimeout(window.searchDebounce);
  window.searchDebounce = setTimeout(() => startOrdersListener(), 200);
});

function renderOrderCard(order) {
  const card = document.createElement("div");
  const status = order.status || "new";
  const paymentStatus = order.paymentStatus || (order.orderChannel ? "cod" : "pending");

  card.className = `order-card order-card--${status}`;
  card.dataset.orderId = order.id;

  const createdDateObj = order.createdAt && order.createdAt.toDate ? order.createdAt.toDate() : new Date();
  const dateStr = createdDateObj.toLocaleDateString("en-NZ");
  const timeStr = createdDateObj.toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const itemsHtml = (order.items || []).map(i => {
    const menuItem = menuItemsCache.find(m => m.id === i.id);
    const photo = menuItem && menuItem.photoUrl
      ? `<img src="${menuItem.photoUrl}" alt="${i.name}" loading="lazy">`
      : `<div class="photo-placeholder">${icon("bag", 18)}</div>`;
    return `
      <li class="order-item-row">
        <div class="order-item-photo">${photo}</div>
        <span class="item-qty-pill">${i.qty}×</span>
        <span class="item-name">${i.name}</span>
        <span class="item-price">NZD ${fmt(i.price * i.qty)}</span>
      </li>
    `;
  }).join("");

  const isDelivery = order.type === "Delivery";
  const addressLine = order.address
    ? `${order.address.line1}${order.address.line2 ? ", " + order.address.line2 : ""}, ${order.address.suburb}, ${order.address.city} ${order.address.postcode}${order.address.notes ? "\nNotes: " + order.address.notes : ""}`
    : "Pickup at kitchen";

  const channelLabel = order.orderChannel === "whatsapp" ? "WhatsApp" : "Pay on Delivery";
  const channelClass = order.orderChannel === "whatsapp" ? "channel-whatsapp" : "channel-cod";

  const statusOptionsHtml = ORDER_STATUSES.map(s =>
    `<option value="${s.value}" ${status === s.value ? "selected" : ""}>${s.label}</option>`
  ).join("");

  const paymentOptionsHtml = PAYMENT_STATUSES.map(s =>
    `<option value="${s.value}" ${paymentStatus === s.value ? "selected" : ""}>${s.label}</option>`
  ).join("");

  card.innerHTML = `
    <div class="order-card__header">
      <span class="order-number">${order.orderId || order.id.slice(0, 6)}</span>
      <span class="order-channel-badge ${channelClass}">${channelLabel}</span>
      <span class="order-type-label">${order.type || "Takeaway"}</span>
      <div class="order-card__actions">
        <select class="order-status-select status-${status}" data-field="status" aria-label="Order status">
          ${statusOptionsHtml}
        </select>
        <select class="payment-status-select pay-${paymentStatus}" data-field="paymentStatus" aria-label="Payment status">
          ${paymentOptionsHtml}
        </select>
        <button class="print-icon-btn" title="Print this order" aria-label="Print order">
          ${icon("printer", 16)}
        </button>
      </div>
    </div>

    <div class="order-meta-row">
      <span>${icon("calendar", 14)} <strong>${dateStr}</strong></span>
      <span>${icon("clock", 14)} <strong>${timeStr}</strong></span>
      <span>${icon("clock", 14)} Requested <strong>${order.time || "ASAP"}</strong></span>
    </div>

    <div class="order-section-label">${icon("receipt", 12)} ITEMS ORDERED</div>
    <ul class="order-items-list">${itemsHtml}</ul>

    <div class="order-total-row">
      <span>Total to collect</span>
      <span class="order-total-amount">NZD ${fmt(order.total)}</span>
    </div>

    <div class="order-section-label">${icon("receipt", 12)} ORDER DETAILS</div>
    <div class="order-detail-rows">
      <div class="order-detail-row">
        ${icon("card", 14)}
        <span class="detail-label">Payment</span>
        <span class="detail-value">${order.paymentMethod || ("Pay on " + (order.type?.toLowerCase() || "delivery"))}</span>
      </div>
      <div class="order-detail-row">
        ${icon("person", 14)}
        <span class="detail-label">Customer</span>
        <span class="detail-value">${order.name}</span>
      </div>
      <div class="order-detail-row">
        ${icon("phone", 14)}
        <span class="detail-label">Phone</span>
        <span class="detail-value"><a href="tel:${order.phone}">${order.phone}</a></span>
      </div>
      <div class="order-detail-row">
        ${icon("mail", 14)}
        <span class="detail-label">Email</span>
        <span class="detail-value"><a href="mailto:${order.email}">${order.email}</a></span>
      </div>
      <div class="order-detail-row">
        ${icon("pin", 14)}
        <span class="detail-label">${isDelivery ? "Delivery" : "Pickup"}</span>
        <span class="detail-value" style="white-space:pre-line;">${addressLine}</span>
      </div>
    </div>
    ${order.notes ? `<div class="order-notes">${order.notes}</div>` : ""}
  `;

  // Event listeners for status changes
  card.querySelector(".order-status-select")?.addEventListener("change", (e) => {
    const newStatus = e.target.value;
    card.className = `order-card order-card--${newStatus}`;
    e.target.className = `order-status-select status-${newStatus}`;
    db.collection("orders").doc(order.id).update({ status: newStatus })
      .catch(err => console.error("Status update error:", err));
    showToast(`Order status updated to ${ORDER_STATUSES.find(s => s.value === newStatus)?.label}`, "success");
  });

  card.querySelector(".payment-status-select")?.addEventListener("change", (e) => {
    const newPayStatus = e.target.value;
    e.target.className = `payment-status-select pay-${newPayStatus}`;
    db.collection("orders").doc(order.id).update({ paymentStatus: newPayStatus })
      .catch(err => console.error("Payment status update error:", err));
    showToast(`Payment status updated to ${PAYMENT_STATUSES.find(s => s.value === newPayStatus)?.label}`, "success");
  });

  card.querySelector(".print-icon-btn")?.addEventListener("click", () => {
    document.querySelectorAll(".order-card").forEach(c => c.classList.remove("printing"));
    card.classList.add("printing");
    window.print();
  });

  // Clean up printing class after print
  window.addEventListener("afterprint", () => {
    document.querySelectorAll(".order-card").forEach(c => c.classList.remove("printing"));
  }, { once: true });

  return card;
}

/* ---- MENU ADMIN ---- */
async function loadMenuAdmin() {
  try {
    const snap = await db.collection("menu").orderBy("name").get();
    menuItemsCache = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderMenuAdmin();
  } catch (err) {
    console.error("Couldn't load menu:", err);
    showToast("Failed to load menu from Firestore", "error");
  }
}

function renderMenuAdmin() {
  const list = document.getElementById("menu-admin-list");
  const empty = document.getElementById("menu-empty");
  if (!list) return;

  list.innerHTML = "";
  empty.classList.toggle("hidden", menuItemsCache.length > 0);

  menuItemsCache.forEach(item => {
    const soldOut = item.inStock === false;
    const isHidden = item.hidden === true;

    const card = document.createElement("div");
    card.className = `menu-admin-card ${soldOut ? "sold-out" : ""} ${isHidden ? "hidden-item" : ""}`;
    card.innerHTML = `
      <div class="menu-admin-photo">
        ${item.photoUrl ? `<img src="${item.photoUrl}" alt="${item.name}" loading="lazy">` : `${icon("bag", 28)}`}
      </div>
      <div class="menu-admin-name">${item.name}</div>
      <div class="menu-admin-cat">${item.category}</div>
      <div class="menu-admin-price">NZD ${fmt(item.price)}</div>
      ${soldOut ? `<div class="menu-admin-badge">Sold Out</div>` : ""}
      ${isHidden ? `<div class="menu-admin-badge hidden-badge">Hidden</div>` : ""}
    `;
    card.addEventListener("click", () => openItemModal(item));
    list.appendChild(card);
  });
}

document.getElementById("add-item-btn")?.addEventListener("click", () => openItemModal(null));

function openItemModal(item) {
  editingItemId = item ? item.id : null;
  const modal = document.getElementById("item-modal-overlay");
  const title = document.getElementById("item-modal-title");
  const deleteBtn = document.getElementById("delete-item-btn");
  const errorEl = document.getElementById("item-modal-error");

  title.textContent = item ? "Edit Item" : "Add Menu Item";
  document.getElementById("item-name").value = item?.name || "";
  document.getElementById("item-desc").value = item?.desc || "";
  document.getElementById("item-price").value = item?.price ?? "";
  document.getElementById("item-category").value = item?.category || "Pani Puri";
  document.getElementById("item-tags").value = item?.tags?.join(", ") || "";
  document.getElementById("item-instock").checked = item?.inStock !== false;
  document.getElementById("item-hidden").checked = item?.hidden === true;
  document.getElementById("item-photo-url").value = item?.photoUrl || "";
  errorEl.textContent = "";

  const preview = document.getElementById("item-photo-preview");
  if (item?.photoUrl) {
    preview.src = item.photoUrl;
    preview.classList.remove("hidden");
  } else {
    preview.classList.add("hidden");
  }

  deleteBtn.classList.toggle("hidden", !item);
  modal.classList.remove("hidden");
  modal.hidden = false;
  document.body.style.overflow = "hidden";

  setTimeout(() => document.getElementById("item-name").focus(), 100);
}

document.getElementById("close-item-modal")?.addEventListener("click", closeItemModal);
document.getElementById("item-modal-overlay")?.addEventListener("click", (e) => {
  if (e.target.id === "item-modal-overlay") closeItemModal();
});

document.getElementById("item-photo-url")?.addEventListener("input", (e) => {
  const url = e.target.value.trim();
  const preview = document.getElementById("item-photo-preview");
  if (url) {
    preview.src = url;
    preview.classList.remove("hidden");
  } else {
    preview.classList.add("hidden");
  }
});

function closeItemModal() {
  const modal = document.getElementById("item-modal-overlay");
  modal.classList.add("hidden");
  setTimeout(() => { modal.hidden = true; document.body.style.overflow = ""; }, 250);
  editingItemId = null;
}

document.getElementById("item-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("item-name").value.trim();
  const desc = document.getElementById("item-desc").value.trim();
  const price = parseFloat(document.getElementById("item-price").value);
  const category = document.getElementById("item-category").value;
  const tags = document.getElementById("item-tags").value.split(",").map(t => t.trim()).filter(Boolean);
  const inStock = document.getElementById("item-instock").checked;
  const hidden = document.getElementById("item-hidden").checked;
  const errorEl = document.getElementById("item-modal-error");
  const saveBtn = document.getElementById("item-form").querySelector("button[type='submit']");

  if (!name || isNaN(price) || price < 0) {
    errorEl.textContent = "Please enter a name and a valid price.";
    return;
  }

  const photoUrl = document.getElementById("item-photo-url").value.trim();

  const data = { name, desc, price, category, tags, inStock, hidden, photoUrl };

  saveBtn.disabled = true;
  saveBtn.classList.add("btn--loading");

  try {
    if (editingItemId) {
      await db.collection("menu").doc(editingItemId).update(data);
      showToast(`${name} updated`, "success");
    } else {
      await db.collection("menu").add(data);
      showToast(`${name} added to menu`, "success");
    }
    closeItemModal();
    await loadMenuAdmin();
  } catch (err) {
    console.error(err);
    errorEl.textContent = "Something went wrong saving this item. Please try again.";
    showToast("Failed to save item", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.classList.remove("btn--loading");
  }
});

document.getElementById("delete-item-btn")?.addEventListener("click", async () => {
  if (!editingItemId) return;
  if (!confirm("Delete this menu item? This can't be undone.")) return;

  const errorEl = document.getElementById("item-modal-error");
  try {
    await db.collection("menu").doc(editingItemId).delete();
    closeItemModal();
    await loadMenuAdmin();
    showToast("Item deleted", "success");
  } catch (err) {
    console.error(err);
    errorEl.textContent = "Couldn't delete this item. Please try again.";
    showToast("Failed to delete item", "error");
  }
});

/* ---- SITE EDITOR ---- */
const SITE_FIELD_MAP = [
  ["theme.accent", "site-theme-accent"], ["theme.dark", "site-theme-dark"], ["theme.cream", "site-theme-cream"],
  ["whatsapp.number", "site-whatsapp-number"], ["whatsapp.businessName", "site-whatsapp-businessname"],
  ["whatsapp.headerLabel", "site-whatsapp-headerlabel"], ["whatsapp.footerLabel", "site-whatsapp-footerlabel"],
  ["delivery.feeAmount", "site-delivery-fee", "number"],
  ["branding.brandName", "site-branding-name"],
  ["branding.logoUrl", "site-branding-logo"], ["branding.logoHeight", "site-branding-logoheight", "number"],
  ["announcement.text", "site-announcement-text"],
  ["announcement.bgColor", "site-announcement-bg"], ["announcement.textColor", "site-announcement-color"],
  ["hero.eyebrow", "site-hero-eyebrow"], ["hero.headline", "site-hero-headline"], ["hero.copy", "site-hero-copy"],
  ["hero.cta1Text", "site-hero-cta1"], ["hero.cta2Text", "site-hero-cta2"],
  ["hero.image", "site-hero-image"], ["hero.imageWidth", "site-hero-image-width", "number"],
  ["hero.imageShape", "site-hero-image-shape"], ["hero.headlineSize", "site-hero-headline-size", "number"],
  ["hero.bodySize", "site-hero-body-size", "number"], ["hero.padding", "site-hero-padding"],
  ["signature.eyebrow", "site-signature-eyebrow"], ["signature.padding", "site-signature-padding"],
  ["signature.cards.0.image", "site-sig-1-image"], ["signature.cards.0.name", "site-sig-1-name"], ["signature.cards.0.price", "site-sig-1-price"],
  ["signature.cards.1.image", "site-sig-2-image"], ["signature.cards.1.name", "site-sig-2-name"], ["signature.cards.1.price", "site-sig-2-price"],
  ["signature.cards.2.image", "site-sig-3-image"], ["signature.cards.2.name", "site-sig-3-name"], ["signature.cards.2.price", "site-sig-3-price"],
  ["menuSection.eyebrow", "site-menu-eyebrow"], ["menuSection.title", "site-menu-title"], ["menuSection.quote", "site-menu-quote"],
  ["story.eyebrow", "site-story-eyebrow"], ["story.headline", "site-story-headline"],
  ["story.paragraph1", "site-story-para1"], ["story.paragraph2", "site-story-para2"],
  ["story.image", "site-story-image"], ["story.imageShape", "site-story-image-shape"],
  ["story.headlineSize", "site-story-headline-size", "number"], ["story.padding", "site-story-padding"],
  ["delivery.eyebrow", "site-delivery-eyebrow"], ["delivery.title", "site-delivery-title"], ["delivery.padding", "site-delivery-padding"],
  ["delivery.card1Title", "site-delivery-card1-title"], ["delivery.card1Text", "site-delivery-card1-text"],
  ["delivery.card2Title", "site-delivery-card2-title"], ["delivery.card2Text", "site-delivery-card2-text"],
  ["delivery.card3Title", "site-delivery-card3-title"], ["delivery.card3Text", "site-delivery-card3-text"],
  ["findUs.eyebrow", "site-findus-eyebrow"], ["findUs.headline", "site-findus-headline"],
  ["findUs.line1", "site-findus-line1"], ["findUs.line2", "site-findus-line2"], ["findUs.line3", "site-findus-line3"],
  ["findUs.mapImage", "site-findus-map-image"], ["findUs.mapLink", "site-findus-map-link"],
  ["footer.brand", "site-footer-brand"], ["footer.tagline", "site-footer-tagline"],
  ["footer.address", "site-footer-address"], ["footer.contact", "site-footer-contact"], ["footer.copyright", "site-footer-copyright"],
  ["policies.delivery.title", "site-policy-delivery-title"], ["policies.delivery.body", "site-policy-delivery-body"],
  ["policies.refunds.title", "site-policy-refunds-title"], ["policies.refunds.body", "site-policy-refunds-body"],
  ["policies.privacy.title", "site-policy-privacy-title"], ["policies.privacy.body", "site-policy-privacy-body"],
  ["policies.terms.title", "site-policy-terms-title"], ["policies.terms.body", "site-policy-terms-body"],
];

function getByPath(obj, path) {
  return path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function setByPath(obj, path, value) {
  const keys = path.split(".");
  let target = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (target[key] === undefined || target[key] === null) target[key] = {};
    target = target[key];
  }
  target[keys[keys.length - 1]] = value;
}

function populateSiteEditor(content) {
  SITE_FIELD_MAP.forEach(([path, id, type]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const val = getByPath(content, path);
    if (val !== undefined && val !== null) {
      if (type === "number") el.value = Number(val);
      else el.value = val;
    }
  });

  // Logo preview
  const logoUrl = getByPath(content, "branding.logoUrl");
  const logoPreview = document.getElementById("site-branding-logo-preview");
  if (logoUrl) {
    logoPreview.src = logoUrl;
    logoPreview.classList.remove("hidden");
  } else {
    logoPreview.classList.add("hidden");
  }

  // Signature card previews
  for (let i = 1; i <= 3; i++) {
    const img = document.getElementById(`site-sig-${i}-image`);
    const preview = document.getElementById(`site-sig-${i}-image`)?.nextElementSibling;
    if (preview && preview.classList.contains("item-photo-preview")) {
      const val = getByPath(content, `signature.cards.${i-1}.image`);
      if (val) { preview.src = val; preview.classList.remove("hidden"); }
      else preview.classList.add("hidden");
    }
  }
}

function gatherSiteEditor() {
  const result = JSON.parse(JSON.stringify(DEFAULT_SITE_CONTENT));
  SITE_FIELD_MAP.forEach(([path, id, type]) => {
    const el = document.getElementById(id);
    if (!el) return;
    let val = el.value;
    if (type === "number") val = Number(val);
    setByPath(result, path, val);
  });
  return result;
}

async function loadSiteEditor() {
  let content = DEFAULT_SITE_CONTENT;
  try {
    const doc = await db.collection("siteSettings").doc("content").get();
    if (doc.exists) content = mergeDeep(DEFAULT_SITE_CONTENT, doc.data());
  } catch (err) {
    console.error("Couldn't load site content:", err);
  }
  populateSiteEditor(content);

  // Live listener
  db.collection("siteSettings").doc("content").onSnapshot(
    (doc) => { if (doc.exists) populateSiteEditor(mergeDeep(DEFAULT_SITE_CONTENT, doc.data())); },
    (err) => console.error("Site content listener error:", err)
  );
}

document.getElementById("site-editor-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("save-site-btn");
  const statusEl = document.getElementById("site-save-status");

  btn.disabled = true;
  btn.classList.add("btn--loading");
  statusEl.textContent = "Saving…";

  try {
    const content = gatherSiteEditor();
    await db.collection("siteSettings").doc("content").set(content);
    statusEl.textContent = "Saved! Your site is updated live.";
    showToast("Site content saved successfully", "success");
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Something went wrong saving. Please try again.";
    showToast("Failed to save site content", "error");
  } finally {
    btn.disabled = false;
    btn.classList.remove("btn--loading");
  }
});

// Live preview for logo
document.getElementById("site-branding-logo")?.addEventListener("input", (e) => {
  const url = e.target.value.trim();
  const preview = document.getElementById("site-branding-logo-preview");
  if (url) { preview.src = url; preview.classList.remove("hidden"); }
  else preview.classList.add("hidden");
});

/* ---- MERGE DEEP HELPER (from site-content-defaults.js) ---- */
function mergeDeep(base, override) {
  if (Array.isArray(base)) return Array.isArray(override) ? override : base;
  if (typeof base === "object" && base !== null) {
    const result = { ...base };
    if (override && typeof override === "object") {
      Object.keys(override).forEach(key => {
        result[key] = key in base ? mergeDeep(base[key], override[key]) : override[key];
      });
    }
    return result;
  }
  return override !== undefined && override !== null && override !== "" ? override : base;
}

/* ---- INIT ---- */
document.addEventListener("DOMContentLoaded", () => {
  // Signature card preview listeners
  for (let i = 1; i <= 3; i++) {
    const input = document.getElementById(`site-sig-${i}-image`);
    const preview = input?.nextElementSibling;
    if (input && preview && preview.classList.contains("item-photo-preview")) {
      input.addEventListener("input", (e) => {
        const url = e.target.value.trim();
        if (url) { preview.src = url; preview.classList.remove("hidden"); }
        else preview.classList.add("hidden");
      });
    }
  }
});

/* ---- EXPORT FOR DEBUGGING ---- */
window.AdminDebug = {
  getMenuItems: () => menuItemsCache,
  getSiteContent: () => currentSiteContent,
  showToast,
  fmt
};