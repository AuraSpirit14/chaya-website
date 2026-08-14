// ================= DEFAULT SITE CONTENT =================
// This is the fallback content shown before Firestore's siteSettings/content
// doc loads (or if it's empty). Admin's Site Editor edits a copy of this
// same shape and saves it to Firestore; script.js merges Firestore's data
// on top of these defaults, so anything you haven't customized yet still
// shows something sensible.

const DEFAULT_SITE_CONTENT = {
  theme: {
    accent: "#BE6A45",
    dark: "#2F3B28",
    cream: "#F4EFE2",
  },

  announcement: {
    text: "Today's special: Sev-Puri · Takeaway ready in ~20 min · Delivering across central Rotorua",
    bgColor: "#1F2819",
    textColor: "#F4EFE2",
  },

  hero: {
    eyebrow: "Artisanal Bites · New Zealand",
    headline: "Street food, treated\nlike it deserves a menu card.",
    copy: "Every puri is filled to order. Every chutney is made the same morning it's served. Order ahead for Takeaway, or have it delivered across Rotorua.",
    cta1Text: "Order Now",
    cta2Text: "View Menu",
    image: "./photos/Staring.png",
    imageWidth: 270,
    imageShape: "rounded",
    headlineSize: 42,
    bodySize: 15,
    padding: "normal",
  },

  signature: {
    eyebrow: "Bestsellers",
    padding: "normal",
    cards: [
      { image: "./photos/panipuri.png", name: "Classic Pani Puri", price: "$8.00" },
      { image: "./photos/BhelPuri.png", name: "Bhel Puri", price: "$8.50" },
      { image: "./photos/DahiPuri.png", name: "Dahi Puri", price: "$9.00" },
    ],
  },

  menuSection: {
    eyebrow: "The Menu",
    title: "Order Ahead",
    quote: '"Our masala pani is steeped fresh every morning — no shortcuts, no concentrate." — Kanha, founder',
  },

  story: {
    eyebrow: "Our Story",
    headline: "From a Bangarpet Kolar street cart to a Rotorua kitchen",
    paragraph1: "The Chaya & Co. began as a single market stall in 2005, built on recipes carried over from Kolar. Twenty One years on, we're still a small, family-run kitchen — everything made fresh, nothing sitting under a heat lamp.",
    paragraph2: "We're proud to be a New Zealand based business, serving our community one order at a time.",
    image: "./photos/ourstory.png",
    imageShape: "rounded",
    headlineSize: 26,
    padding: "normal",
  },

  delivery: {
    eyebrow: "Delivery & Takeaway",
    title: "How to Order",
    padding: "normal",
    feeAmount: 5.0,
    card1Title: "Takeaway",
    card1Text: "Ready in approximately 20 minutes. Order ahead and skip the queue at our Cuba Street kitchen.",
    card2Title: "Delivery",
    card2Text: "We deliver across central Rotorua. Flat delivery fee of $5.00. Typical delivery time is 35–45 minutes.",
    card3Title: "Hours",
    card3Text: "Monday–Sunday, 03:30pm–8:00pm.\nClosed Saturday.",
  },

  findUs: {
    eyebrow: "Find Us",
    headline: "The Chaya & Co.",
    line1: "44 Cuba Street, Te Aro, Rotorua 6011",
    line2: "Monday–Sunday, 03:30pm–8:00pm",
    line3: "021 123 4567 · help@thechayaandco.nz",
    mapImage: "./photos/map.png",
    mapLink: "https://www.google.com/maps/place/28+Manuka+Crescent,+Hillcrest,+Rotorua+3015,+New+Zealand/@-38.1518837,176.2355002,18.94z/data=!4m6!3m5!1s0x6d6c27400b996f21:0x37cf17543a4d4322!8m2!3d-38.1521317!4d176.2364278!16s%2Fg%2F11gfd5j300",
  },

  footer: {
    brand: "The Chaya & Co.",
    tagline: "This is a New Zealand based business.",
    address: "44 Cuba Street, Te Aro, Rotorua 6011",
    contact: "021 123 4567 · hello@thechayaandco.nz",
    copyright: "© 2026 The Chaya & Co. All prices in NZD RTG.",
  },

  // number: country code + number, no + or spaces (e.g. NZ number "6421 123 4567" -> "64211234567")
  whatsapp: {
    number: "64211234567",
    businessName: "The Chaya & Co.",
    headerLabel: "WhatsApp",
    footerLabel: "Message us on WhatsApp",
  },

  // body: plain text — each new line becomes its own paragraph.
  policies: {
    delivery: {
      title: "Delivery Policy",
      body:
        "We deliver across central Rotorua. A flat delivery fee of $5.00 NZD applies to all delivery orders.\n" +
        "Typical delivery time is 35–45 minutes from confirmation, depending on traffic and order volume.\n" +
        "Takeaway orders are usually ready within 20 minutes at our Cuba Street kitchen.",
    },
    refunds: {
      title: "Refunds & Cancellations",
      body:
        "Since every dish is made fresh to order, we're unable to offer refunds once preparation has started.\n" +
        "If there's an issue with your order — wrong items, quality concerns, or a missed Takeaway/delivery on our end — message us on WhatsApp within 2 hours and we'll make it right.\n" +
        "Orders can be cancelled free of charge if you contact us before we begin preparing your food.",
    },
    privacy: {
      title: "Privacy Policy",
      body:
        "We collect the name, phone number, email, and (for delivery) address you provide at checkout solely to fulfil your order.\n" +
        "Your details are never sold or shared with third parties beyond what's needed to deliver your order (e.g. a delivery partner, if used).\n" +
        "You can ask us to delete your order history at any time by messaging us on WhatsApp.",
    },
    terms: {
      title: "Terms & Conditions",
      body:
        "By placing an order with The Chaya & Co., you confirm the details you've provided are accurate and that you're authorised to order to the address given.\n" +
        "Prices are listed in New Zealand dollars (NZD) and may change without notice. The price shown at checkout is the price charged.\n" +
        "Payment is made in cash or by card directly to our team at the point of delivery or pickup.\n" +
        "The Chaya & Co. is a New Zealand based business operating from 44 Cuba Street, Te Aro, Rotorua.",
    },
  },
};

// ---- Deep-merge helper: Firestore's saved content (which may only have
// some fields customized) gets merged on top of the defaults above, so
// anything not yet customized still falls back sensibly. ----
function mergeDeep(base, override) {
  if (Array.isArray(base)) {
    return Array.isArray(override) ? override : base;
  }
  if (typeof base === "object" && base !== null) {
    const result = { ...base };
    if (override && typeof override === "object") {
      Object.keys(override).forEach((key) => {
        result[key] = key in base ? mergeDeep(base[key], override[key]) : override[key];
      });
    }
    return result;
  }
  return override !== undefined && override !== null && override !== "" ? override : base;
}

// ---- Dot-path get/set helpers used by Admin's Site Editor ----
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
