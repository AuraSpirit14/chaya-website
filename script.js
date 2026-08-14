// ==========================================================================
// THE CHAYA & CO. — UPGRADED CUSTOMER SITE SCRIPT
// ==========================================================================

/* ---- CONFIG & CONSTANTS ---- */
const WHATSAPP_NUMBER = "64211234567";
const DELIVERY_FEE = 5.0;
const BUSINESS_NAME = "The Chaya & Co.";

const MENU_FALLBACK = [
  { id: "classic-pani-puri", name: "Bangarpat Pani Puri", category: "Pani Puri", desc: "Crisp puris, spiced potato, tangy masala pani", price: 8.0, tags: ["Bestseller", "Vegetarian"], inStock: true, photoUrl: "" },
  { id: "sweet-puri", name: "Sweet Puri", category: "Pani Puri", desc: "Tamarind and jaggery water, no chilli", price: 8.0, tags: ["Vegan"], inStock: true, photoUrl: "" },
  { id: "sev-puri", name: "Sev Puri", category: "Chaat", desc: "Crisp puris topped with potato, chutneys, sev", price: 9.5, tags: ["Vegetarian"], inStock: true, photoUrl: "" },
  { id: "dahi-puri", name: "Dahi Puri", category: "Chaat", desc: "Puris filled with yoghurt, chutney, spice", price: 9.0, tags: ["Bestseller", "Vegetarian"], inStock: true, photoUrl: "" },
  { id: "bhel-puri", name: "Bhel Puri", category: "Chaat", desc: "Puffed rice, sev, vegetables, tamarind chutney", price: 8.5, tags: ["Vegan"], inStock: true, photoUrl: "" },
  { id: "masala-chai", name: "Masala Chai", category: "Beverages", desc: "Spiced tea, made fresh to order", price: 4.5, tags: ["Vegetarian"], inStock: true, photoUrl: "" },
  { id: "sweet-lassi", name: "Sweet Lassi", category: "Beverages", desc: "Yoghurt, cardamom, a little sugar", price: 6.0, tags: ["Vegetarian"], inStock: true, photoUrl: "" },
  { id: "chaat-combo", name: "Chaat Combo", category: "Combos", desc: "Sev puri, dahi puri, and a masala chai", price: 19.0, tags: ["Bestseller"], inStock: true, photoUrl: "" },
];

const CATEGORIES = ["All", "Pani Puri", "Chaat", "Beverages", "Combos"];

let MENU = [];
let activeCategory = "All";
const cart = {}; // id -> qty
let currentSiteContent = null;
let demoOrderCounter = 1000;

/* ---- HELPER FUNCTIONS ---- */
function fmt(n) { return Number(n || 0).toFixed(2); }
function findItem(id) { return MENU.find(m => m.id === id); }
function cartEntries() { return Object.entries(cart).filter(([, qty]) => qty > 0); }
function cartSubtotal() { return cartEntries().reduce((sum, [id, qty]) => sum + (findItem(id)?.price || 0) * qty, 0); }
function cartCount() { return cartEntries().reduce((sum, [, qty]) => sum + qty, 0); }
function isDelivery() { const el = document.querySelector('input[name="order-type"]:checked'); return el && el.value === "delivery"; }
function currentDeliveryFee() { if (!isDelivery()) return 0; const fee = currentSiteContent?.delivery?.feeAmount; return typeof fee === "number" && !isNaN(fee) ? fee : DELIVERY_FEE; }
function cartTotal() { return cartSubtotal() + currentDeliveryFee(); }

function randomSuffix() { return Math.random().toString(36).slice(2, 6).toUpperCase(); }

async function nextOrderNumber() {
  if (typeof DEMO_MODE !== "undefined" && !DEMO_MODE) {
    const counterRef = db.collection("counters").doc("orders");
    const next = await db.runTransaction(async (t) => {
      const doc = await t.get(counterRef);
      const current = doc.exists ? doc.data().last : 1000;
      const updated = current + 1;
      t.set(counterRef, { last: updated });
      return updated;
    });
    return "PC-" + next + "-" + randomSuffix();
  }
  demoOrderCounter += 1;
  return "PC-" + demoOrderCounter + "-" + randomSuffix();
}

function buildStatusLink(orderId) {
  let path = window.location.pathname;
  if (path.endsWith("index.html")) path = path.slice(0, -"index.html".length);
  else if (!path.endsWith("/")) path = path.substring(0, path.lastIndexOf("/") + 1);
  return window.location.origin + path + "status.html?order=" + encodeURIComponent(orderId);
}

function getWhatsAppSettings() {
  return (currentSiteContent && currentSiteContent.whatsapp) || {
    number: WHATSAPP_NUMBER,
    businessName: BUSINESS_NAME,
    headerLabel: "WhatsApp",
    footerLabel: "Message us on WhatsApp",
  };
}

/* ---- ICON HELPER ---- */
function icon(name, size = 16) {
  const paths = ICONS[name] || "";
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

/* ---- TOAST NOTIFICATIONS ---- */
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

/* ---- SCROLL REVEAL ---- */
function initScrollReveal() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.querySelectorAll(".reveal").forEach(el => el.classList.add("reveal--visible"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("reveal--visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

  document.querySelectorAll(".reveal").forEach(el => observer.observe(el));
}

/* ---- HEADER SCROLL EFFECT ---- */
function initHeaderScroll() {
  const header = document.getElementById("site-header");
  if (!header) return;

  let lastScroll = 0;
  window.addEventListener("scroll", () => {
    const scrollY = window.scrollY;
    if (scrollY > 20) header.classList.add("site-header--scrolled");
    else header.classList.remove("site-header--scrolled");
    lastScroll = scrollY;
  }, { passive: true });
}

/* ---- MOBILE NAV ---- */
function initMobileNav() {
  const toggle = document.getElementById("mobile-menu-toggle");
  const nav = document.getElementById("mobile-nav");
  const closeBtn = document.getElementById("mobile-nav-close");
  const menuIcon = toggle?.querySelector(".menu-icon");
  const closeIcon = toggle?.querySelector(".close-icon");

  if (!toggle || !nav) return;

  function openNav() {
    nav.classList.add("mobile-nav--open");
    toggle.setAttribute("aria-expanded", "true");
    menuIcon?.classList.add("hidden");
    closeIcon?.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeNav() {
    nav.classList.remove("mobile-nav--open");
    toggle.setAttribute("aria-expanded", "false");
    menuIcon?.classList.remove("hidden");
    closeIcon?.classList.add("hidden");
    document.body.style.overflow = "";
  }

  toggle.addEventListener("click", () => {
    if (nav.classList.contains("mobile-nav--open")) closeNav();
    else openNav();
  });

  closeBtn?.addEventListener("click", closeNav);
  nav.querySelectorAll("a").forEach(a => a.addEventListener("click", closeNav));

  // Close on overlay click
  nav.addEventListener("click", (e) => {
    if (e.target === nav) closeNav();
  });

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("mobile-nav--open")) closeNav();
  });
}

/* ---- DRAWER MANAGEMENT ---- */
const drawerOverlay = document.getElementById("drawer-overlay");
const cartDrawer = document.getElementById("cart-drawer");
const checkoutDrawer = document.getElementById("checkout-drawer");

function openDrawer(drawer) {
  drawerOverlay?.classList.add("drawer-overlay--visible");
  drawer?.classList.add("drawer--open");
  document.body.style.overflow = "hidden";
  // Focus first focusable element
  setTimeout(() => {
    const focusable = drawer.querySelector("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
    focusable?.focus();
  }, 300);
}

function closeDrawers() {
  drawerOverlay?.classList.remove("drawer-overlay--visible");
  cartDrawer?.classList.remove("drawer--open");
  checkoutDrawer?.classList.remove("drawer--open");
  document.body.style.overflow = "";
}

function closeCheckoutAndReset() {
  closeDrawers();
  finishCheckoutSession();
}

drawerOverlay?.addEventListener("click", closeDrawers);
document.getElementById("close-cart")?.addEventListener("click", closeDrawers);
document.getElementById("close-checkout")?.addEventListener("click", closeCheckoutAndReset);

// Close on Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && (cartDrawer?.classList.contains("drawer--open") || checkoutDrawer?.classList.contains("drawer--open"))) {
    if (checkoutDrawer.classList.contains("drawer--open")) closeCheckoutAndReset();
    else closeDrawers();
  }
});

/* ---- CART RENDERING ---- */
function updateCartBadge() {
  const badge = document.getElementById("cart-badge");
  const count = cartCount();
  if (badge) {
    badge.textContent = count;
    badge.classList.toggle("cart-badge--visible", count > 0);
  }
}

function updateMobileBar() {
  const bar = document.getElementById("mobile-sticky-bar");
  const summary = document.getElementById("mobile-cart-summary");
  const count = cartCount();
  if (summary) summary.textContent = `${count} item${count !== 1 ? "s" : ""} · NZD ${fmt(cartTotal())}`;
  if (bar) bar.classList.toggle("mobile-sticky-bar--visible", count > 0 && window.innerWidth < 860);
}

function renderCart() {
  const list = document.getElementById("cart-items");
  const empty = document.getElementById("cart-empty");
  const totals = document.getElementById("cart-totals");
  const entries = cartEntries();

  if (!list) return;

  list.innerHTML = "";
  empty.classList.toggle("hidden", entries.length > 0);
  totals?.classList.toggle("hidden", entries.length === 0);

  entries.forEach(([id, qty]) => {
    const item = findItem(id);
    if (!item) return;

    const line = document.createElement("div");
    line.className = "cart-item";
    line.innerHTML = `
      <div class="cart-item__image">
        ${item.photoUrl ? `<img src="${item.photoUrl}" alt="${item.name}">` : `<div class="photo-placeholder">${icon("bag", 24)}</div>`}
      </div>
      <div class="cart-item__info">
        <div class="cart-item__name">${item.name}</div>
        <div class="cart-item__price">NZD ${fmt(item.price)} × ${qty}</div>
      </div>
      <div class="cart-item__qty">
        <div class="qty-control">
          <button class="qty-control__btn" data-action="dec" data-id="${id}" aria-label="Decrease quantity">${icon("check", 14).replace('stroke="currentColor"', 'stroke="currentColor"')}−</button>
          <span class="qty-control__value">${qty}</span>
          <button class="qty-control__btn" data-action="inc" data-id="${id}" aria-label="Increase quantity">+</button>
        </div>
      </div>
    `;
    list.appendChild(line);
  });

  document.getElementById("cart-subtotal").textContent = `NZD ${fmt(cartSubtotal())}`;
  const deliveryEl = document.getElementById("cart-delivery");
  const deliveryRow = document.getElementById("cart-delivery-row");
  if (deliveryEl && deliveryRow) {
    deliveryEl.textContent = isDelivery() ? `NZD ${fmt(currentDeliveryFee())}` : "Free";
    deliveryRow.classList.toggle("hidden", !isDelivery());
  }
  document.getElementById("cart-total").textContent = `NZD ${fmt(cartTotal())}`;

  updateCartBadge();
  updateMobileBar();
}

/* ---- CART EVENT DELEGATION ---- */
document.getElementById("cart-items")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action][data-id]");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  const current = cart[id] || 0;
  cart[id] = action === "inc" ? current + 1 : Math.max(0, current - 1);
  renderCart();
  renderMenu();
  renderSignatureCards();
});

/* ---- DRAWER OPEN/CLOSE ---- */
document.getElementById("open-cart")?.addEventListener("click", () => openDrawer(cartDrawer));
document.getElementById("mobile-cart-btn")?.addEventListener("click", () => openDrawer(cartDrawer));

/* ---- MENU RENDERING ---- */
function renderTabs() {
  const wrap = document.getElementById("category-tabs");
  if (!wrap) return;

  wrap.innerHTML = "";
  CATEGORIES.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = `tab-btn ${cat === activeCategory ? "tab-btn--active" : ""}`;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", cat === activeCategory);
    btn.textContent = cat;
    btn.addEventListener("click", () => {
      activeCategory = cat;
      renderTabs();
      renderMenu();
    });
    wrap.appendChild(btn);
  });
}

function renderMenu() {
  const grid = document.getElementById("menu-grid");
  if (!grid) return;

  const items = MENU.filter(item => activeCategory === "All" || item.category === activeCategory);

  grid.innerHTML = "";
  items.forEach((item, index) => {
    const qty = cart[item.id] || 0;
    const soldOut = item.inStock === false;

    const card = document.createElement("article");
    card.className = `menu-card ${soldOut ? "menu-card--sold-out" : ""}`;
    card.style.animationDelay = `${index * 50}ms`;
    card.setAttribute("role", "listitem");

    card.innerHTML = `
      <div class="menu-card__image" aria-hidden="true">
        ${item.photoUrl ? `<img src="${item.photoUrl}" alt="" loading="lazy">` : `<div class="menu-card__image--placeholder">${icon("bag", 28)}</div>`}
      </div>
      <div class="menu-card__body">
        <div class="menu-card__top">
          <h3 class="menu-card__name">${item.name}</h3>
          <span class="menu-card__price">NZD ${fmt(item.price)}</span>
        </div>
        <p class="menu-card__desc">${item.desc}</p>
        <div class="menu-card__tags">
          ${item.tags.map(t => `<span class="badge badge--primary">${t}</span>`).join("")}
          ${soldOut ? '<span class="badge badge--error">Sold Out</span>' : ""}
        </div>
        <div class="menu-card__footer">
          ${soldOut || qty > 0 ? `
            <div class="qty-control" data-id="${item.id}">
              <button class="qty-control__btn" data-action="dec" data-id="${item.id}" aria-label="Decrease ${item.name}">−</button>
              <span class="qty-control__value">${qty}</span>
              <button class="qty-control__btn" data-action="inc" data-id="${item.id}" aria-label="Increase ${item.name}">+</button>
            </div>
          ` : `
            <button class="add-btn" data-action="inc" data-id="${item.id}" aria-label="Add ${item.name} to cart">
              ${icon("bag", 16)} Add
            </button>
          `}
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  // Stagger animation
  grid.querySelectorAll(".menu-card").forEach((card, i) => {
    card.style.animationDelay = `${i * 60}ms`;
  });
}

/* ---- MENU EVENT DELEGATION ---- */
document.getElementById("menu-grid")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action][data-id]");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  const current = cart[id] || 0;
  cart[id] = action === "inc" ? current + 1 : Math.max(0, current - 1);
  renderCart();
  renderMenu();
  renderSignatureCards();
  showToast(`${findItem(id)?.name || "Item"} added to cart`, "success");
});

/* ---- SIGNATURE / BESTSELLERS CARDS ---- */
function renderSignatureCards() {
  const row = document.getElementById("signature-row");
  if (!row) return;

  row.innerHTML = "";
  const cards = currentSiteContent?.signature?.cards || [];

  cards.forEach((card, i) => {
    const menuItem = MENU.find(m => m.name.trim().toLowerCase() === card.name.trim().toLowerCase());
    const qty = menuItem ? (cart[menuItem.id] || 0) : 0;
    const soldOut = menuItem ? menuItem.inStock === false : false;

    const el = document.createElement("article");
    el.className = "signature-card";
    el.style.animationDelay = `${i * 100}ms`;
    el.innerHTML = `
      <div class="signature-card__image" aria-hidden="true">
        ${card.image ? `<img src="${card.image}" alt="${card.name}" loading="lazy">` : `<div class="photo-placeholder">${icon("bag", 32)}</div>`}
      </div>
      <div class="signature-card__content">
        <h3 class="signature-card__name">${card.name}</h3>
        <p class="signature-card__price">${card.price}</p>
        <div class="signature-card__action">
          ${menuItem && !soldOut && qty === 0 ? `
            <button class="add-btn" data-action="inc" data-id="${menuItem.id}" aria-label="Add ${menuItem.name} to cart">
              ${icon("bag", 16)} Add
            </button>
          ` : menuItem ? `
            <div class="qty-control" data-id="${menuItem.id}">
              <button class="qty-control__btn" data-action="dec" data-id="${menuItem.id}" aria-label="Decrease ${menuItem.name}">−</button>
              <span class="qty-control__value">${qty}</span>
              <button class="qty-control__btn" data-action="inc" data-id="${menuItem.id}" aria-label="Increase ${menuItem.name}">+</button>
            </div>
          ` : soldOut ? `<span class="badge badge--error">Sold Out</span>` : ""}
        </div>
      </div>
    `;
    row.appendChild(el);
  });
}

/* Signature card click delegation */
document.getElementById("signature-row")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action][data-id]");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  const current = cart[id] || 0;
  cart[id] = action === "inc" ? current + 1 : Math.max(0, current - 1);
  renderCart();
  renderMenu();
  renderSignatureCards();
  showToast(`${findItem(id)?.name || "Item"} added to cart`, "success");
});

/* ---- SITE CONTENT APPLICATION ---- */
function setText(id, value) {
  const el = document.getElementById(id);
  if (el && value !== undefined && value !== null) el.textContent = value;
}

function setHtmlLines(id, value) {
  const el = document.getElementById(id);
  if (el && value !== undefined && value !== null) el.innerHTML = String(value).split("\n").join("<br>");
}

function applyPadding(el, size) {
  if (!el) return;
  const map = { compact: "32px 0", normal: "72px 0", spacious: "120px 0" };
  el.style.padding = map[size] || map.normal;
}

function applyImageShape(img, shape, widthPx) {
  if (!img) return;
  const radiusMap = { square: "4px", rounded: "18px", circle: "50%", pill: "999px" };
  img.style.borderRadius = radiusMap[shape] || radiusMap.rounded;
  if (widthPx) img.style.width = widthPx + "px";
  img.style.objectFit = "cover";
  if (shape === "circle") img.style.aspectRatio = "1 / 1";
}

function applySiteContent(c) {
  if (!c) return;
  currentSiteContent = c;

  // Theme - updates CSS custom properties instantly
  if (c.theme) {
    const root = document.documentElement;
    if (c.theme.accent) root.style.setProperty("--terracotta", c.theme.accent);
    if (c.theme.dark) {
      root.style.setProperty("--forest-deep", c.theme.dark);
      root.style.setProperty("--forest", c.theme.dark);
    }
    if (c.theme.cream) root.style.setProperty("--cream", c.theme.cream);
  }

  // Branding
  if (c.branding) {
    const logoImg = document.getElementById("brand-logo");
    const textEl = document.getElementById("brand-text");
    if (textEl && c.branding.brandName) textEl.textContent = c.branding.brandName;
    if (logoImg) {
      if (c.branding.logoUrl) {
        logoImg.src = c.branding.logoUrl;
        logoImg.alt = c.branding.brandName || "Logo";
        logoImg.classList.remove("hidden");
        if (c.branding.logoHeight) logoImg.style.height = c.branding.logoHeight + "px";
      } else {
        logoImg.classList.add("hidden");
      }
    }
  }

  // Announcement bar
  if (c.announcement) {
    setText("announce-bar", c.announcement.text);
    const ann = document.getElementById("announce-bar");
    if (ann) {
      ann.style.background = c.announcement.bgColor || "";
      ann.style.color = c.announcement.textColor || "";
    }
  }

  // Hero
  if (c.hero) {
    setText("hero-eyebrow", c.hero.eyebrow);
    setHtmlLines("hero-headline", c.hero.headline);
    setText("hero-copy", c.hero.copy);
    setText("hero-cta1", c.hero.cta1Text);
    setText("hero-cta2", c.hero.cta2Text);
    const heroImg = document.getElementById("hero-image");
    if (heroImg && c.hero.image) {
      heroImg.src = c.hero.image;
      applyImageShape(heroImg, c.hero.imageShape, c.hero.imageWidth);
    }
    const headlineEl = document.getElementById("hero-headline");
    if (headlineEl && c.hero.headlineSize) headlineEl.style.fontSize = c.hero.headlineSize + "px";
    const copyEl = document.getElementById("hero-copy");
    if (copyEl && c.hero.bodySize) copyEl.style.fontSize = c.hero.bodySize + "px";
    applyPadding(document.getElementById("section-hero"), c.hero.padding);
  }

  // Signature
  if (c.signature) {
    setText("signature-eyebrow", c.signature.eyebrow);
    (c.signature.cards || []).forEach((card, i) => {
      const n = i + 1;
      const img = document.getElementById(`signature-card-${n}-img`);
      if (img && card.image) img.src = card.image;
      setText(`signature-card-${n}-name`, card.name);
      setText(`signature-card-${n}-price`, card.price);
    });
    applyPadding(document.getElementById("section-signature"), c.signature.padding);
    renderSignatureCards();
  }

  // Menu section
  if (c.menuSection) {
    setText("menu-eyebrow", c.menuSection.eyebrow);
    setText("menu-title", c.menuSection.title);
    setText("menu-quote", c.menuSection.quote);
  }

  // Story
  if (c.story) {
    setText("story-eyebrow", c.story.eyebrow);
    setText("story-headline", c.story.headline);
    setText("story-para1", c.story.paragraph1);
    setText("story-para2", c.story.paragraph2);
    const storyImg = document.getElementById("story-image");
    if (storyImg && c.story.image) {
      storyImg.src = c.story.image;
      applyImageShape(storyImg, c.story.imageShape, null);
    }
    const storyHeadlineEl = document.getElementById("story-headline");
    if (storyHeadlineEl && c.story.headlineSize) storyHeadlineEl.style.fontSize = c.story.headlineSize + "px";
    applyPadding(document.getElementById("story"), c.story.padding);
  }

  // Delivery
  if (c.delivery) {
    setText("delivery-eyebrow", c.delivery.eyebrow);
    setText("delivery-title", c.delivery.title);
    setText("delivery-card1-title", c.delivery.card1Title);
    setText("delivery-card1-text", c.delivery.card1Text);
    setText("delivery-card2-title", c.delivery.card2Title);
    setText("delivery-card2-text", c.delivery.card2Text);
    setText("delivery-card3-title", c.delivery.card3Title);
    setHtmlLines("delivery-card3-text", c.delivery.card3Text);
    applyPadding(document.getElementById("delivery"), c.delivery.padding);
    renderDeliveryCards(c.delivery);
    renderCart(); // delivery fee may have changed
  }

  // Find Us
  if (c.findUs) {
    setText("findus-eyebrow", c.findUs.eyebrow);
    setText("findus-headline", c.findUs.headline);
    setText("findus-line1", c.findUs.line1);
    setText("findus-line2", c.findUs.line2);
    setText("findus-line3", c.findUs.line3);
    const mapLink = document.getElementById("findus-map-link");
    if (mapLink && c.findUs.mapLink) mapLink.href = c.findUs.mapLink;
  }

  // Footer
  if (c.footer) {
    setText("footer-brand", c.footer.brand);
    setText("footer-tagline", c.footer.tagline);
    setText("footer-address", c.footer.address);
    setText("footer-contact", c.footer.contact);
    setText("footer-copyright", c.footer.copyright);
  }

  // WhatsApp labels
  if (c.whatsapp) {
    const headerLink = document.getElementById("header-whatsapp-link");
    if (headerLink && c.whatsapp.headerLabel) headerLink.querySelector("span").textContent = c.whatsapp.headerLabel;
    setText("footer-whatsapp-link", c.whatsapp.footerLabel);
  }
}

function renderDeliveryCards(delivery) {
  const container = document.getElementById("delivery-cards");
  if (!container) return;

  container.innerHTML = `
    <article class="info-card">
      ${icon("bag", 40)}
      <h3 class="info-card__title">${delivery.card1Title}</h3>
      <p class="info-card__text">${delivery.card1Text}</p>
    </article>
    <article class="info-card">
      ${icon("pin", 40)}
      <h3 class="info-card__title">${delivery.card2Title}</h3>
      <p class="info-card__text">${delivery.card2Text}</p>
    </article>
    <article class="info-card">
      ${icon("clock", 40)}
      <h3 class="info-card__title">${delivery.card3Title}</h3>
      <p class="info-card__text">${delivery.card3Text}</p>
    </article>
  `;
}

/* ---- LOAD SITE CONTENT ---- */
async function loadSiteContent() {
  const defaults = typeof DEFAULT_SITE_CONTENT !== "undefined" ? DEFAULT_SITE_CONTENT : null;
  applySiteContent(defaults);

  if (typeof DEMO_MODE !== "undefined" && !DEMO_MODE) {
    try {
      const doc = await db.collection("siteSettings").doc("content").get();
      if (doc.exists) applySiteContent(mergeDeep(defaults, doc.data()));
    } catch (err) {
      console.error("Couldn't load site content:", err);
    }

    // Live updates
    db.collection("siteSettings").doc("content").onSnapshot(
      (doc) => { if (doc.exists) applySiteContent(mergeDeep(defaults, doc.data())); },
      (err) => console.error("Site content listener error:", err)
    );
  }
}

/* ---- LOAD MENU FROM FIRESTORE ---- */
async function loadMenu() {
  const grid = document.getElementById("menu-grid");
  if (grid) grid.innerHTML = `<div class="menu-loading" style="grid-column:1/-1;text-align:center;color:var(--color-text-muted);padding:var(--space-8);">${icon("clock", 32)} Loading menu…</div>`;

  if (typeof DEMO_MODE !== "undefined" && !DEMO_MODE) {
    try {
      const snap = await db.collection("menu").orderBy("name").get();
      MENU = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(item => item.hidden !== true);
      if (MENU.length === 0) MENU = MENU_FALLBACK;
    } catch (err) {
      console.error("Couldn't load menu from Firestore, using local fallback:", err);
      MENU = MENU_FALLBACK;
    }
  } else {
    MENU = MENU_FALLBACK;
  }

  renderTabs();
  renderMenu();
  renderSignatureCards();
  renderCart();
}

/* ---- CHECKOUT FORM ---- */
function initCheckout() {
  const orderTypeRadios = document.querySelectorAll('input[name="order-type"]');
  orderTypeRadios.forEach(el => el.addEventListener("change", () => {
    document.getElementById("address-fields").classList.toggle("hidden", !isDelivery());
    renderCart();
    renderCheckoutSummary();
  }));

  document.getElementById("proceed-checkout")?.addEventListener("click", () => {
    if (cartCount() === 0) return;
    cartDrawer?.classList.remove("drawer--open");
    renderCheckoutSummary();
    openDrawer(checkoutDrawer);
  });

  document.getElementById("close-checkout")?.addEventListener("click", closeCheckoutAndReset);
}

function renderCheckoutSummary() {
  const entries = cartEntries();
  const lines = entries.map(([id, qty]) => `${qty}× ${findItem(id)?.name}`).join(", ");
  const summaryEl = document.getElementById("checkout-summary");
  if (summaryEl) {
    summaryEl.innerHTML = `<strong>${cartCount()} item${cartCount() !== 1 ? "s" : ""}</strong> ${lines || "No items"}<br>Total <strong>NZD ${fmt(cartTotal())}</strong> — Pay on delivery/pickup`;
  }
}

function validateForm() {
  const name = document.getElementById("cf-name").value.trim();
  const phone = document.getElementById("cf-phone").value.trim();
  const email = document.getElementById("cf-email").value.trim();
  const terms = document.getElementById("cf-terms").checked;
  const errorEl = document.getElementById("form-error");

  if (cartCount() === 0) { errorEl.textContent = "Your cart is empty."; return null; }
  if (!name || !phone || !email) { errorEl.textContent = "Please fill in your name, phone, and email."; return null; }
  if (!terms) { errorEl.textContent = "Please accept the Terms & Conditions to continue."; return null; }

  let address = null;
  if (isDelivery()) {
    const address1 = document.getElementById("cf-address1").value.trim();
    const suburb = document.getElementById("cf-suburb").value.trim();
    const city = document.getElementById("cf-city").value.trim();
    const postcode = document.getElementById("cf-postcode").value.trim();
    if (!address1 || !suburb || !city || !postcode) { errorEl.textContent = "Please complete the full delivery address."; return null; }
    address = {
      line1: address1,
      line2: document.getElementById("cf-address2").value.trim(),
      suburb, city, postcode,
      notes: document.getElementById("cf-delivery-notes").value.trim()
    };
  }

  errorEl.textContent = "";
  return {
    name, phone, email,
    type: isDelivery() ? "Delivery" : "Takeaway",
    address,
    time: document.getElementById("cf-time").value.trim() || "ASAP",
    notes: document.getElementById("cf-notes").value.trim()
  };
}

/* ---- ORDER PLACEMENT ---- */
async function buildOrderRecord(data, orderChannel) {
  const id = await nextOrderNumber();
  const now = new Date();
  const entries = cartEntries();
  const items = entries.map(([itemId, qty]) => {
    const item = findItem(itemId);
    return { id: itemId, name: item?.name, qty, price: item?.price || 0 };
  });
  const subtotal = cartSubtotal();
  const delivery = currentDeliveryFee();
  const total = cartTotal();

  const record = {
    orderId: id,
    createdAt: typeof DEMO_MODE !== "undefined" && !DEMO_MODE ? firebase.firestore.FieldValue.serverTimestamp() : now.toISOString(),
    name: data.name,
    phone: data.phone,
    email: data.email,
    type: data.type,
    address: data.address,
    time: data.time,
    notes: data.notes,
    items,
    subtotal,
    deliveryFee: delivery,
    total,
    orderChannel,
    paymentMethod: orderChannel === "cod" ? `Cash/Card on ${data.type}` : `Confirmed via WhatsApp`,
    status: "new",
    paymentStatus: orderChannel === "cod" ? "cod" : "pending",
  };
  return { id, now, items, subtotal, delivery, total, record };
}

async function saveOrderToFirestore(record) {
  if (typeof DEMO_MODE !== "undefined" && !DEMO_MODE) {
    await db.collection("orders").add(record);
  }
}

function clearCartKeepDrawerOpen() {
  Object.keys(cart).forEach(k => delete cart[k]);
  renderMenu();
  renderSignatureCards();
  renderCart();
  updateCartBadge();
}

function finishCheckoutSession() {
  document.getElementById("checkout-form-inner")?.reset();
  document.getElementById("cf-city").value = "Rotorua";
  document.getElementById("form-error").textContent = "";
  document.getElementById("address-fields").classList.add("hidden");
  document.getElementById("cod-order-btn").classList.remove("hidden");
  document.getElementById("whatsapp-order-btn").classList.remove("hidden");
}

// Pay on Delivery / Pickup
document.getElementById("cod-order-btn")?.addEventListener("click", async () => {
  const data = validateForm();
  if (!data) return;

  const btn = document.getElementById("cod-order-btn");
  btn.disabled = true;
  btn.classList.add("btn--loading");
  btn.textContent = "Placing order…";

  try {
    const { id, now, items, subtotal, delivery, total, record } = await buildOrderRecord(data, "cod");
    await saveOrderToFirestore(record);

    const statusLink = buildStatusLink(record.orderId);
    document.getElementById("form-error").style.color = "var(--color-success)";
    document.getElementById("form-error").innerHTML = `Order <strong>${record.orderId}</strong> placed! Pay ${record.paymentMethod.toLowerCase()} — we'll start preparing it shortly.<br><a href="${statusLink}" target="_blank" style="color:var(--color-primary);font-weight:600;text-decoration:underline;">Track your order status</a>`;

    clearCartKeepDrawerOpen();
    document.getElementById("cod-order-btn").classList.add("hidden");
    document.getElementById("whatsapp-order-btn").classList.add("hidden");
    showToast(`Order ${record.orderId} placed successfully!`, "success");
  } catch (err) {
    console.error("Couldn't save order:", err);
    document.getElementById("form-error").style.color = "var(--brand-error)";
    document.getElementById("form-error").textContent = "Couldn't place your order — please try again, or use Order on WhatsApp instead.";
    showToast("Order failed. Please try again.", "error");
  } finally {
    btn.disabled = false;
    btn.classList.remove("btn--loading");
    btn.textContent = "Pay on Delivery / Pickup";
  }
});

// Order on WhatsApp
document.getElementById("whatsapp-order-btn")?.addEventListener("click", async () => {
  const data = validateForm();
  if (!data) return;

  const btn = document.getElementById("whatsapp-order-btn");
  btn.disabled = true;
  btn.classList.add("btn--loading");
  btn.textContent = "Opening WhatsApp…";

  try {
    const { id, now, items, subtotal, delivery, total, record } = await buildOrderRecord(data, "whatsapp");

    // Still save to Firestore so admin sees it
    try { await saveOrderToFirestore(record); } catch (err) { console.error("Couldn't save order to Firestore:", err); }

    sendWhatsAppOrder(id, now, data, items, subtotal, delivery, total);

    const statusLink = buildStatusLink(id);
    document.getElementById("form-error").style.color = "var(--color-success)";
    document.getElementById("form-error").innerHTML = `Order <strong>${id}</strong> sent on WhatsApp!<br><a href="${statusLink}" target="_blank" style="color:var(--color-primary);font-weight:600;text-decoration:underline;">Track your order status</a>`;

    clearCartKeepDrawerOpen();
    document.getElementById("cod-order-btn").classList.add("hidden");
    document.getElementById("whatsapp-order-btn").classList.add("hidden");
    showToast("Order sent via WhatsApp!", "success");
  } catch (err) {
    console.error("WhatsApp order error:", err);
    document.getElementById("form-error").style.color = "var(--brand-error)";
    document.getElementById("form-error").textContent = "Couldn't open WhatsApp — please try again.";
    showToast("Failed to open WhatsApp.", "error");
  } finally {
    btn.disabled = false;
    btn.classList.remove("btn--loading");
    btn.textContent = "Order on WhatsApp";
  }
});

function sendWhatsAppOrder(id, now, data, items, subtotal, delivery, total) {
  const wa = getWhatsAppSettings();
  const dateStr = now.toLocaleDateString("en-NZ");
  const timeStr = now.toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit" });

  const itemLines = items.map(i => `${i.qty}× ${i.name} — NZD ${fmt(i.price * i.qty)}`).join("\n");
  const addressLine = data.address
    ? `${data.address.line1}${data.address.line2 ? ", " + data.address.line2 : ""}, ${data.address.suburb}, ${data.address.city} ${data.address.postcode}${data.address.notes ? "\nNotes: " + data.address.notes : ""}`
    : "Pickup at 44 Cuba Street, Te Aro, Rotorua";

  const messageLines = [
    `*NEW ORDER — ${wa.businessName}*`,
    `Order ${id} — ${dateStr} ${timeStr}`,
    "",
    `${data.type.toUpperCase()} ${data.type === "Delivery" ? addressLine : "Pickup at 44 Cuba Street, Te Aro, Rotorua"}`,
    `Requested: ${data.time}`,
    "",
    "*Items*",
    itemLines,
    "",
    `Subtotal: NZD ${fmt(subtotal)}`,
    data.type === "Delivery" ? `Delivery fee: NZD ${fmt(delivery)}` : null,
    `*Total to collect: NZD ${fmt(total)}*`,
    `Pay on ${data.type.toLowerCase()}`,
    "",
    `Customer: ${data.name}`,
    `Phone: ${data.phone}`,
    data.notes ? `Notes: ${data.notes}` : null,
    "",
    `Track: ${buildStatusLink(id)}`,
  ].filter(Boolean);

  const message = encodeURIComponent(messageLines.join("\n"));
  window.open(`https://wa.me/${wa.number}?text=${message}`, "_blank");
}

/* ---- WHATSAPP QUICK LINKS ---- */
document.getElementById("header-whatsapp-link")?.addEventListener("click", (e) => {
  e.preventDefault();
  window.open(`https://wa.me/${getWhatsAppSettings().number}`, "_blank");
});
document.getElementById("footer-whatsapp-link")?.addEventListener("click", (e) => {
  e.preventDefault();
  window.open(`https://wa.me/${getWhatsAppSettings().number}`, "_blank");
});

/* ---- POLICY MODAL ---- */
function openPolicy(key) {
  const policies = (currentSiteContent && currentSiteContent.policies) || (typeof DEFAULT_SITE_CONTENT !== "undefined" ? DEFAULT_SITE_CONTENT.policies : {});
  const policy = policies[key];
  if (!policy) return;

  const paragraphs = String(policy.body).split("\n").filter(Boolean);
  document.getElementById("policy-title").textContent = policy.title;
  document.getElementById("policy-content").innerHTML = `<h3>${policy.title}</h3>` + paragraphs.map(p => `<p>${p}</p>`).join("");
  document.getElementById("policy-overlay").classList.add("policy-overlay--visible");
  document.getElementById("policy-overlay").hidden = false;
  document.body.style.overflow = "hidden";
  // Focus close button
  setTimeout(() => document.getElementById("close-policy")?.focus(), 300);
}

function closePolicy() {
  document.getElementById("policy-overlay").classList.remove("policy-overlay--visible");
  setTimeout(() => { document.getElementById("policy-overlay").hidden = true; document.body.style.overflow = ""; }, 250);
}

document.querySelectorAll("[data-policy]").forEach(el => {
  el.addEventListener("click", () => openPolicy(el.dataset.policy));
});
document.getElementById("close-policy")?.addEventListener("click", closePolicy);
document.getElementById("policy-overlay")?.addEventListener("click", (e) => {
  if (e.target.id === "policy-overlay") closePolicy();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.getElementById("policy-overlay")?.classList.contains("policy-overlay--visible")) closePolicy();
});

/* ---- INITIALIZATION ---- */
document.addEventListener("DOMContentLoaded", () => {
  initScrollReveal();
  initHeaderScroll();
  initMobileNav();
  initCheckout();
  loadSiteContent();
  loadMenu();

  // Handle initial cart from URL params (for shared cart links)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("cart")) {
    try {
      const savedCart = JSON.parse(decodeURIComponent(urlParams.get("cart")));
      Object.assign(cart, savedCart);
      renderCart();
      renderMenu();
      renderSignatureCards();
    } catch (e) {}
  }
});

/* ---- WINDOW RESIZE ---- */
window.addEventListener("resize", () => {
  updateMobileBar();
});

/* ---- EXPORT FOR DEBUGGING ---- */
window.ChayaDebug = {
  getCart: () => cart,
  getMenu: () => MENU,
  getSiteContent: () => currentSiteContent,
  fmt,
  showToast
};