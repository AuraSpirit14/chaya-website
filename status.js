// ================= ORDER STATUS TRACKING =================
// Reads the same "orders" collection used by index.html / admin.js.
// Looks up an order by its human-readable orderId (e.g. "PC-1023"), NOT the
// Firestore document id, since that's what the customer actually has.

const STATUS_STEPS = [
  { key: "new", label: "Order Received" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready for Pickup / Out for Delivery" },
  { key: "delivered", label: "Completed" },
];

// Admin's Orders tab now has 8 possible status values — this maps each one onto
// whichever of the 4 visual steps above it should light up as.
const STATUS_STEP_MAP = {
  new: "new",
  accepted: "new",
  preparing: "preparing",
  ready: "ready",
  out_for_delivery: "ready",
  delivered: "delivered",
};

const STATUS_NOTES = {
  new: "We've got your order — it'll go into the kitchen shortly.",
  accepted: "We've accepted your order — it'll go into the kitchen shortly.",
  preparing: "Your food is being made fresh right now.",
  ready: "Your order is ready! If it's Delivery, it's on its way. If it's Takeaway, come on by.",
  out_for_delivery: "Your order is on its way to you!",
  delivered: "This order is complete. Thanks for ordering from us!",
  cancelled: "This order has been cancelled. If you have questions, please contact us.",
  refunded: "This order has been refunded. If you have questions, please contact us.",
};

const lookupCard = document.getElementById("lookup-card");
const statusCard = document.getElementById("status-card");
let currentUnsubscribe = null;

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function fmt(n) {
  return Number(n || 0).toFixed(2);
}

function showLookup(errorMsg) {
  statusCard.classList.add("hidden");
  lookupCard.classList.remove("hidden");
  document.getElementById("lookup-error").textContent = errorMsg || "";
}

function showStatusCard() {
  lookupCard.classList.add("hidden");
  statusCard.classList.remove("hidden");
}

function renderOrder(order) {
  showStatusCard();
  document.getElementById("order-id-display").textContent = "#" + order.orderId;

  const status = order.status || "new";
  const stepsList = document.getElementById("steps-list");
  const noteEl = document.getElementById("status-note");

  if (status === "cancelled" || status === "refunded") {
    // Cancelled/refunded aren't a step on the normal progress line — show a clear standalone message instead
    const color = status === "cancelled" ? "#B33F2E" : "#6B6455";
    const label = status === "cancelled" ? "Order Cancelled" : "Order Refunded";
    stepsList.innerHTML = `<li style="color:${color};font-weight:700;"><span class="dot" style="background:${color};border-color:${color};"></span>${label}</li>`;
  } else {
    const mappedKey = STATUS_STEP_MAP[status] || "new";
    const currentIndex = STATUS_STEPS.findIndex((s) => s.key === mappedKey);
    stepsList.innerHTML = STATUS_STEPS.map((step, i) => {
      let cls = "";
      if (i < currentIndex) cls = "done";
      else if (i === currentIndex) cls = "current";
      return `<li class="${cls}"><span class="dot"></span>${step.label}</li>`;
    }).join("");
  }

  noteEl.textContent = STATUS_NOTES[status] || "We'll update this page as your order progresses.";

  const addressLine = order.address
    ? `${order.address.line1}${order.address.line2 ? ", " + order.address.line2 : ""}, ${order.address.suburb}, ${order.address.city} ${order.address.postcode}`
    : "Pickup at kitchen";

  const itemsHtml = (order.items || [])
    .map((i) => `${i.qty}x ${i.name} — $${fmt(i.price * i.qty)}`)
    .join("<br>");

  document.getElementById("order-details").innerHTML = `
    <strong>${order.type || "Order"}</strong> · Requested: ${order.time || "ASAP"}<br>
    ${order.type === "Delivery" ? addressLine + "<br>" : ""}
    ${itemsHtml}<br>
    <strong>Total: $${fmt(order.total)}</strong> — ${order.paymentMethod || ""}
  `;
}

function trackOrder(orderId) {
  if (currentUnsubscribe) {
    currentUnsubscribe();
    currentUnsubscribe = null;
  }

  document.getElementById("lookup-input").value = orderId;

  if (typeof DEMO_MODE !== "undefined" && DEMO_MODE) {
    showLookup("Firebase isn't connected yet — order tracking needs firebase-config.js set up first.");
    return;
  }

  try {
    currentUnsubscribe = db
      .collection("orders")
      .where("orderId", "==", orderId)
      .limit(1)
      .onSnapshot(
        (snap) => {
          if (snap.empty) {
            showLookup(`We couldn't find an order with number "${orderId}". Please check and try again.`);
            return;
          }
          renderOrder(snap.docs[0].data());
        },
        (err) => {
          console.error("Order tracking error:", err);
          showLookup("Something went wrong looking up your order. Please try again.");
        }
      );
  } catch (err) {
    console.error("Couldn't start order tracking:", err);
    showLookup("Something went wrong connecting to order tracking. Please refresh and try again.");
  }
}

document.getElementById("lookup-btn").addEventListener("click", () => {
  const value = document.getElementById("lookup-input").value.trim();
  if (!value) {
    document.getElementById("lookup-error").textContent = "Please enter your order number.";
    return;
  }
  const params = new URLSearchParams(window.location.search);
  params.set("order", value);
  window.history.replaceState(null, "", "status.html?" + params.toString());
  trackOrder(value);
});

document.getElementById("lookup-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("lookup-btn").click();
});

// ================= INIT =================
const initialOrderId = getParam("order");
if (initialOrderId) {
  trackOrder(initialOrderId);
} else {
  showLookup("");
}
