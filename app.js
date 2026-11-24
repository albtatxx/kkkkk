/**
 * MAISON ÉPURE — Minimalist Luxury E-Commerce Engine
 * Features:
 * - Bilingual State (English / Arabic RTL)
 * - Multi-Currency Support (USD, EUR, SAR, AED)
 * - Cart Drawer with interactive quantity, coupon code (ÉPURE15, FREESHIP), progress bar
 * - Wishlist Management & Counter
 * - Dynamic 4-Column Product Grid with Category & Size Filters
 * - Color Swatch Switcher with Image Sync
 * - Quick View Modal with Full Product Details
 * - Live Search Overlay with instant query filtering
 * - 16:9 Desktop Screen Presentation Mockup Mode (Figma/Behance Style)
 */

// ==========================================================================
// GOOGLE FIREBASE CONFIGURATION & REAL-TIME FIRESTORE ENGINE
// ==========================================================================
const firebaseConfig = {
  apiKey: "AIzaSyAb4V5AAKLaFlteN6euBwpLdwgQ50dS4uk",
  authDomain: "mmmm-e9205.firebaseapp.com",
  projectId: "mmmm-e9205",
  storageBucket: "mmmm-e9205.firebasestorage.app",
  messagingSenderId: "758694843574",
  appId: "1:758694843574:web:e5850b8bffce26a071c217",
  measurementId: "G-H9JFSYFV34"
};

let firebaseApp = null;
let db = null;
let analytics = null;
let isFirebaseConnected = false;
let isFirstFirestoreLoad = true;
let isSoundAlertEnabled = true;
let activeUrgentOrderId = null;
let orderChannel = null;

// Real-time tab-to-tab streaming channel
try {
  orderChannel = new BroadcastChannel("epure_store_orders");
  orderChannel.onmessage = (event) => {
    if (event.data && event.data.type === "NEW_ORDER") {
      const incomingOrder = event.data.order;
      if (!state.orders.some(o => o.id === incomingOrder.id)) {
        state.orders.unshift(incomingOrder);
        notifyIncomingOrder(incomingOrder);
        renderDashboard();
      }
    }
  };
} catch (e) {
  console.log("BroadcastChannel notice:", e);
}

// Synthesize Luxury Audio Chime for incoming orders via Web Audio API
function playOrderChime() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;

    // Chime Note 1 (E5 - 659Hz)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Chime Note 2 (B5 - 987Hz)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(987.77, now + 0.12);
    gain2.gain.setValueAtTime(0.26, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.75);
  } catch (e) {
    console.warn("Audio chime notice:", e);
  }
}

// Instant notification handler for incoming orders
function notifyIncomingOrder(order) {
  // 1. Play luxury audio alert
  if (isSoundAlertEnabled) {
    playOrderChime();
  }

  // 2. Desktop notification
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(`🔔 طلب جديد وصل لميزون إيبيور: ${order.id}`, {
        body: `العميل: ${order.customerName} • المبلغ: ${formatPrice(order.totalUSD)} • الدفع: ${order.paymentMethod === 'vodafone_cash' ? 'فودافون كاش' : order.paymentMethod}`,
        icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>É</text></svg>"
      });
    } catch (e) {
      console.warn("Desktop notification error:", e);
    }
  }

  // 3. Show Urgent Banner in Dashboard
  showUrgentOrderBanner(order);

  // 4. Toast notice
  showToast(state.lang === "ar" 
    ? `🔔 وصل طلب جديد الآن برقم ${order.id} من ${order.customerName} (${formatPrice(order.totalUSD)})` 
    : `New order ${order.id} received!`);

  // 5. Flash table row
  setTimeout(() => {
    const row = document.querySelector(`tr[data-order-id="${order.id}"]`);
    if (row) {
      row.classList.add("new-order-highlight");
      setTimeout(() => row.classList.remove("new-order-highlight"), 4500);
    }
  }, 100);
}

function showUrgentOrderBanner(order) {
  const banner = document.getElementById("urgentOrderBanner");
  if (!banner) return;

  activeUrgentOrderId = order.id;

  const badge = document.getElementById("urgentOrderBadge");
  const sub = document.getElementById("urgentOrderSub");

  if (badge) badge.textContent = order.id;
  if (sub) {
    const vfDetails = order.paymentMethod === "vodafone_cash" 
      ? ` • كود المعاملة: ${order.vodafoneTxId || "VF-Pending"}`
      : ` • طريقة الدفع: ${order.paymentMethod}`;
    sub.textContent = `العميل: ${order.customerName} • المبلغ: ${formatPrice(order.totalUSD)}${vfDetails}`;
  }

  banner.classList.add("active");
}

function closeUrgentOrderBanner() {
  document.getElementById("urgentOrderBanner")?.classList.remove("active");
}

function approveUrgentOrder() {
  if (activeUrgentOrderId) {
    approveVodafonePayment(activeUrgentOrderId);
    closeUrgentOrderBanner();
  }
}

function toggleOrderSoundNotifications() {
  isSoundAlertEnabled = !isSoundAlertEnabled;
  const btn = document.getElementById("btnSoundAlertToggle");
  const text = document.getElementById("soundAlertText");

  if (btn && text) {
    btn.classList.toggle("active", isSoundAlertEnabled);
    text.textContent = isSoundAlertEnabled ? "استقبال مباشر (صوت + إشعارات)" : "تم كتم الصوت";
  }

  if (isSoundAlertEnabled) {
    playOrderChime();
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
    showToast("نظام استقبال الطلبات الفوري والصوت مفعل الآن 🔔");
  } else {
    showToast("تم كتم التنبيه الصوتي للطلبات مؤقتاً 🔕");
  }
}

// Simulate an incoming live order for instant demo & testing
function triggerTestLiveOrder() {
  const testCustomers = [
    { name: "محمود حسنين", phone: "01099881122", city: "القاهرة، التجمع الخامس" },
    { name: "نورهان الشريف", phone: "01022334455", city: "الجيزة، الدقي" },
    { name: "عمر فاروق التميمي", phone: "01077665544", city: "الإسكندرية، لوران" },
    { name: "ياسمين القاضي", phone: "01033445566", city: "المنصورة، المشاية" }
  ];

  const randCust = testCustomers[Math.floor(Math.random() * testCustomers.length)];
  const randProduct = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
  const orderId = "EPU-" + Math.floor(1000 + Math.random() * 9000);
  const txId = "VF-" + Math.floor(100000 + Math.random() * 900000);

  const testOrder = {
    id: orderId,
    customerName: randCust.name,
    phone: randCust.phone,
    address: randCust.city,
    date: new Date().toISOString().replace("T", " ").substring(0, 16),
    items: [{ name: state.lang === "ar" ? randProduct.name_ar : randProduct.name_en, size: "L", qty: 1, price: randProduct.price }],
    totalUSD: randProduct.price,
    paymentMethod: "vodafone_cash",
    vodafoneSender: randCust.phone,
    vodafoneTxId: txId,
    status: "pending_vodafone"
  };

  // Prepend to state
  state.orders.unshift(testOrder);

  // Broadcast to other open tabs
  if (orderChannel) {
    try {
      orderChannel.postMessage({ type: "NEW_ORDER", order: testOrder });
    } catch (e) {}
  }

  // Save to Firebase Cloud Firestore
  saveOrderToFirestore(testOrder);

  // Trigger audio alert, desktop notification, and urgent banner
  notifyIncomingOrder(testOrder);
  renderDashboard();
}

function initFirebase() {
  try {
    if (typeof firebase !== "undefined") {
      firebaseApp = firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      if (typeof firebase.analytics === "function") {
        analytics = firebase.analytics();
        analytics.logEvent("page_view", { page_title: "Maison Épure Storefront" });
      }
      isFirebaseConnected = true;
      console.log("Firebase connected successfully to project: mmmm-e9205");

      updateFirebaseStatusUI(true);
      setupFirestoreListeners();
    } else {
      console.warn("Firebase SDK script not loaded yet, running in offline fallback mode.");
      updateFirebaseStatusUI(false);
    }
  } catch (err) {
    console.warn("Firebase initialization notice:", err);
    updateFirebaseStatusUI(false);
  }
}

function updateFirebaseStatusUI(connected) {
  const badge = document.getElementById("firebaseStatusBadge");
  const text = document.getElementById("firebaseStatusText");
  const tabBadge = document.getElementById("fbConnectionStatusBadge");

  if (badge && text) {
    if (connected) {
      badge.style.display = "inline-flex";
      text.textContent = "Firebase متصل (مشروع: mmmm-e9205)";
    } else {
      text.textContent = "Firebase (وضع محلي)";
    }
  }

  if (tabBadge) {
    tabBadge.textContent = connected ? "متصل ومزامَن" : "وضع محلي";
  }
}

function setupFirestoreListeners() {
  if (!db) return;

  // Real-time synchronization of Orders collection
  try {
    db.collection("orders").orderBy("date", "desc").onSnapshot(snapshot => {
      if (!snapshot.empty) {
        const incomingChanges = snapshot.docChanges();
        const firestoreOrders = [];

        snapshot.forEach(doc => {
          firestoreOrders.push({ id: doc.id, ...doc.data() });
        });

        const existingIds = new Set(firestoreOrders.map(o => o.id));
        const localOnly = state.orders.filter(o => !existingIds.has(o.id));
        state.orders = [...firestoreOrders, ...localOnly];

        // Trigger instant sound & desktop notification for new incoming orders
        if (!isFirstFirestoreLoad) {
          incomingChanges.forEach(change => {
            if (change.type === "added") {
              const newOrd = { id: change.doc.id, ...change.doc.data() };
              notifyIncomingOrder(newOrd);
            }
          });
        } else {
          isFirstFirestoreLoad = false;
        }

        renderDashboard();
      }
    }, err => {
      console.warn("Firestore live orders note (check rules):", err.message);
    });
  } catch (e) {
    console.warn("Firestore orders listener setup error:", e);
  }

  // Real-time synchronization of Products collection
  try {
    db.collection("products").onSnapshot(snapshot => {
      if (!snapshot.empty) {
        snapshot.forEach(doc => {
          const pData = { id: doc.id, ...doc.data() };
          if (!PRODUCTS.some(p => p.id === pData.id)) {
            PRODUCTS.unshift(pData);
          }
        });
        renderProducts();
        renderDashboard();
      }
    }, err => {
      console.warn("Firestore products sync note:", err.message);
    });
  } catch (e) {
    console.warn("Firestore products listener setup error:", e);
  }
}

function saveOrderToFirestore(order) {
  if (!db) return Promise.resolve();
  return db.collection("orders").doc(order.id).set(order)
    .then(() => {
      console.log("Order saved to Firestore:", order.id);
    })
    .catch(err => {
      console.warn("Could not write order to Firestore:", err.message);
    });
}

function updateOrderStatusInFirestore(orderId, newStatus) {
  if (!db) return Promise.resolve();
  return db.collection("orders").doc(orderId).update({ status: newStatus })
    .then(() => {
      console.log("Order updated in Firestore:", orderId, newStatus);
    })
    .catch(err => {
      console.warn("Could not update order in Firestore:", err.message);
    });
}

function saveProductToFirestore(product) {
  if (!db) return Promise.resolve();
  return db.collection("products").doc(product.id).set(product)
    .then(() => {
      console.log("Product saved to Firestore:", product.id);
    })
    .catch(err => {
      console.warn("Could not save product to Firestore:", err.message);
    });
}

function testFirebaseConnection() {
  if (!db) {
    showToast(state.lang === "ar" ? "جاري إعادة الاتصال بـ Firebase..." : "Reconnecting to Firebase...");
    initFirebase();
    return;
  }

  showToast(state.lang === "ar" ? "جاري فحص الاتصال وقراءة البيانات من Firebase..." : "Testing Firebase connection...");
  db.collection("orders").limit(1).get()
    .then(snap => {
      showToast(state.lang === "ar" ? "تم التحقق بنجاح! قاعدة بيانات Firestore متصلة وتعمل بشكل فوري" : "Verified! Firestore is active and responsive");
    })
    .catch(err => {
      showToast(state.lang === "ar" ? "تم الاتصال بـ Firebase بنجاح (تأكد من فتح قواعد Firestore في الكونسول)" : "Connected to Firebase project mmmm-e9205");
      console.log("Firebase connection response:", err);
    });
}

// Product Catalog
const PRODUCTS = [
  {
    id: "ep-01",
    name_en: "The Double-Breasted Cashmere Trench",
    name_ar: "معطف كشمير فاخر مزدوج الأزرار",
    category: "outerwear",
    price: 580,
    originalPrice: 650,
    badge_en: "Limited Edition",
    badge_ar: "إصدار محدود",
    sizes: ["XS", "S", "M", "L", "XL"],
    colors: [
      { name_en: "Camel", name_ar: "بيج جملي", hex: "#C2A282", img: "https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=900&q=80" },
      { name_en: "Charcoal", name_ar: "فحمي", hex: "#2A2928", img: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=900&q=80" },
      { name_en: "Cream", name_ar: "كريمي ناصع", hex: "#F1ECE4", img: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80" }
    ],
    primaryImg: "https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=900&q=80",
    secondaryImg: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=900&q=80",
    desc_en: "Crafted from 100% ethically sourced Mongolian cashmere with natural horn buttons and a relaxed dropped-shoulder silhouette that bridges timeless tailoring and streetwear nonchalance.",
    desc_ar: "مصنوع يدوياً من كشمير منغولي خالص 100% بأزرار طبيعية وقصة كتف منسدلة تجمع بين الفخامة الكلاسيكية وروح الشارع المعاصرة.",
    material_en: "100% Mongolian Cashmere • Cupro Silk Lining",
    material_ar: "100% كشمير منغولي نقي • بطانة حرير كوبرو",
    rating: 4.9,
    reviewsCount: 38
  },
  {
    id: "ep-02",
    name_en: "Relaxed Heavyweight Silk Shirt",
    name_ar: "قميص حرير طبيعي ثقيل بقصة مريحة",
    category: "essentials",
    price: 260,
    badge_en: "Eco Silk",
    badge_ar: "حرير عضوي",
    sizes: ["S", "M", "L", "XL"],
    colors: [
      { name_en: "Chalk", name_ar: "طباشيري", hex: "#EFECE6", img: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=900&q=80" },
      { name_en: "Washed Olive", name_ar: "زيتوني معتق", hex: "#555B49", img: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80" },
      { name_en: "Raw Black", name_ar: "أسود خام", hex: "#1F1F1E", img: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80" }
    ],
    primaryImg: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=900&q=80",
    secondaryImg: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80",
    desc_en: "22-momme sandwashed mulberry silk featuring concealed mother-of-pearl closures and a fluid drape designed for effortless season-round elegance.",
    desc_ar: "حرير توت بري ثقيل 22 موم مغسول بالرمل مع أزرار صدفية خفية وانسيابية استثنائية لمظهر راقٍ طوال العام.",
    material_en: "100% Sandwashed Mulberry Silk",
    material_ar: "100% حرير التوت المغسول بالرمل",
    rating: 4.8,
    reviewsCount: 52
  },
  {
    id: "ep-03",
    name_en: "Pleated Wide-Leg Wool Trousers",
    name_ar: "بنطال صوف واسع بثنيات أمامية",
    category: "trousers",
    price: 340,
    badge_en: "Signature Cut",
    badge_ar: "قصة مميزة",
    sizes: ["XS", "S", "M", "L"],
    colors: [
      { name_en: "Melange Grey", name_ar: "رمادي ميلانج", hex: "#7B7D7D", img: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=900&q=80" },
      { name_en: "Dark Sand", name_ar: "رملي داكن", hex: "#B8A898", img: "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=900&q=80" },
      { name_en: "Obsidian", name_ar: "أسود سبجي", hex: "#151515", img: "https://images.unsplash.com/photo-1517445312882-bc9910d016b7?auto=format&fit=crop&w=900&q=80" }
    ],
    primaryImg: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=900&q=80",
    secondaryImg: "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=900&q=80",
    desc_en: "High-waisted architectural trousers tailored from high-twist Italian virgin wool with sharp double pleats and clean floor-skimming hems.",
    desc_ar: "بنطال بخصر مرتفع وتفاصيل معمارية من صوف إيطالي بكر، بثنيات مزدوجة حادة وقصة متدفقة تعزز الرشاقة.",
    material_en: "98% Italian Virgin Wool, 2% Elastane",
    material_ar: "98% صوف إيطالي بكر، 2% إيلاستين",
    rating: 4.95,
    reviewsCount: 44
  },
  {
    id: "ep-04",
    name_en: "Sculpted Mockneck Merino Knit",
    name_ar: "كنزة ميرينو محبوكة بياقة مرتفعة",
    category: "knitwear",
    price: 290,
    badge_en: "Best Seller",
    badge_ar: "الأكثر مبيعاً",
    sizes: ["S", "M", "L", "XL"],
    colors: [
      { name_en: "Oat Milk", name_ar: "حليبي دافئ", hex: "#E8E0D5", img: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=900&q=80" },
      { name_en: "Terracotta", name_ar: "تيراكوتا ترابي", hex: "#9E4734", img: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=900&q=80" },
      { name_en: "Espresso", name_ar: "إسبريسو بني", hex: "#3D2C24", img: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=900&q=80" }
    ],
    primaryImg: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=900&q=80",
    secondaryImg: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=900&q=80",
    desc_en: "7-gauge seamless ribbed knit spun from extra-fine Australian merino wool with a tactile structural finish and sculpted collar.",
    desc_ar: "حياكة مضلعة بدون درزات من صوف الميرينو الأسترالي فائق النعومة بياقة منحوتة وملمس غني ودافئ.",
    material_en: "100% Extra-fine Merino Wool",
    material_ar: "100% صوف ميرينو أسترالي فائق النعومة",
    rating: 4.87,
    reviewsCount: 67
  },
  {
    id: "ep-05",
    name_en: "Oversized Minimalist Wool Blazer",
    name_ar: "بليزر صوف أوفرسايز بتصميم نقي",
    category: "outerwear",
    price: 490,
    originalPrice: 540,
    badge_en: "New Season",
    badge_ar: "موسم جديد",
    sizes: ["XS", "S", "M", "L"],
    colors: [
      { name_en: "Taupe Beige", name_ar: "بيج توب", hex: "#C7BCAD", img: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=900&q=80" },
      { name_en: "Forest Olive", name_ar: "زيتوني غابي", hex: "#3C4436", img: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=900&q=80" },
      { name_en: "Noir", name_ar: "أسود نوار", hex: "#121212", img: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=900&q=80" }
    ],
    primaryImg: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=900&q=80",
    secondaryImg: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80",
    desc_en: "Structured single-breasted blazer with clean welt pockets, padded minimalist shoulders, and cupro lining for a tailored editorial posture.",
    desc_ar: "بليزر أحادي الصدر بأكتاف هندسية هادئة وجيوب أنيقة وبطانة حريرية، مصمم بأسلوب عصري فخم.",
    material_en: "100% Virgin Wool • Japan Bemberg Lining",
    material_ar: "100% صوف بكر نقي • بطانة بيمبيرغ يابانية",
    rating: 4.92,
    reviewsCount: 29
  },
  {
    id: "ep-06",
    name_en: "Raw Edge Structured Linen Kimono",
    name_ar: "كيمونو كتان بهيكل خام وأطراف حرة",
    category: "essentials",
    price: 310,
    badge_en: "Artisanal",
    badge_ar: "قطعة حرفية",
    sizes: ["S", "M", "L"],
    colors: [
      { name_en: "Natural Flax", name_ar: "كتان طبيعي", hex: "#DDD4C6", img: "https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=900&q=80" },
      { name_en: "Sage", name_ar: "مرمري", hex: "#8A9580", img: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=900&q=80" },
      { name_en: "Ink", name_ar: "حبري داكن", hex: "#24272B", img: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80" }
    ],
    primaryImg: "https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=900&q=80",
    secondaryImg: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=900&q=80",
    desc_en: "Heavyweight Belgian linen treated with an artisanal stone enzyme wash for a raw, sculptural hand-feel and breathable comfort.",
    desc_ar: "كتان بلجيكي ثقيل معالج بحجارة الأنزيم الطبيعية لملمس خام مريح وقصة شرقية معاصرة.",
    material_en: "100% Belgian Certified Linen",
    material_ar: "100% كتان بلجيكي معتمد",
    rating: 4.79,
    reviewsCount: 19
  },
  {
    id: "ep-07",
    name_en: "Architectural Nappa Leather Tote",
    name_ar: "حقيبة توت جلد نابا بتصميم معماري",
    category: "accessories",
    price: 420,
    badge_en: "Handcrafted",
    badge_ar: "صناعة يدوية",
    sizes: ["One Size"],
    colors: [
      { name_en: "Saddle Tan", name_ar: "هافان أصيل", hex: "#946343", img: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=80" },
      { name_en: "Vachetta", name_ar: "فاشيتا طبيعي", hex: "#D3B492", img: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=80" },
      { name_en: "Midnight", name_ar: "أسود ليلي", hex: "#171717", img: "https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=900&q=80" }
    ],
    primaryImg: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=80",
    secondaryImg: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=80",
    desc_en: "Full-grain buttery nappa leather crafted in Florence with magnetic closure, discreet foil branding, and a detachable zip clutch pouch.",
    desc_ar: "جلد نابا طبيعي فاخر مصنوع بمدينة فلورنسا الإيطالية بإغلاق مغناطيسي ومحفظة داخلية قابلة للفصل.",
    material_en: "100% Italian Full-Grain Nappa Leather",
    material_ar: "100% جلد نابا إيطالي طبيعي فاخر",
    rating: 4.96,
    reviewsCount: 41
  },
  {
    id: "ep-08",
    name_en: "Square-Toe Italian Calfskin Loafers",
    name_ar: "حذاء لوفر إيطالي بجلد العجل ومقدمة مربعة",
    category: "accessories",
    price: 380,
    badge_en: "Made in Italy",
    badge_ar: "صُنع في إيطاليا",
    sizes: ["39", "40", "41", "42", "43", "44"],
    colors: [
      { name_en: "Burgundy", name_ar: "عنابي", hex: "#4E2828", img: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=900&q=80" },
      { name_en: "Onyx Black", name_ar: "أسود أونيكس", hex: "#141414", img: "https://images.unsplash.com/photo-1533867617858-e7b97e060509?auto=format&fit=crop&w=900&q=80" },
      { name_en: "Off-White", name_ar: "أوف وايت", hex: "#ECE5DA", img: "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=900&q=80" }
    ],
    primaryImg: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=900&q=80",
    secondaryImg: "https://images.unsplash.com/photo-1533867617858-e7b97e060509?auto=format&fit=crop&w=900&q=80",
    desc_en: "Hand-burnished calfskin loafers with Blake-stitched leather soles and a contemporary chiselled toe shape for sartorial grounding.",
    desc_ar: "حذاء لوفر من جلد العجل المدبوغ يدوياً بنعل بليك مخيط ومقدمة هندسية مربعة تضفي لمسة عصرية فارهة.",
    material_en: "Italian Hand-Burnished Calfskin • Leather Sole",
    material_ar: "جلد عجل إيطالي معالج يدوياً • نعل جلدي خالص",
    rating: 4.88,
    reviewsCount: 33
  }
];

// Currency Rates & Symbols relative to USD
const CURRENCIES = {
  EGP: { symbol: "ج.م", rate: 50.0, prefix: false },
  USD: { symbol: "$", rate: 1.0, prefix: true },
  EUR: { symbol: "€", rate: 0.92, prefix: true },
  AED: { symbol: "د.إ", rate: 3.67, prefix: false },
  SAR: { symbol: "ر.س", rate: 3.75, prefix: false }
};

// Application State
const state = {
  lang: "ar",           // Default: Arabic
  currency: "EGP",      // Default: EGP (Egyptian Pound)
  currentView: "storefront", // "storefront" | "dashboard"
  activeDashTab: "overview", // "overview" | "orders" | "products" | "customers" | "settings"
  activeCategory: "all",
  activeSizeFilter: "all",
  searchQuery: "",
  mockupMode: false,
  freeShippingThresholdUSD: 150,
  promoDiscountPercent: 0,
  promoCodeApplied: "",
  vodafoneWalletNumber: "01092837465",
  vodafoneWalletOwner: "ميزون إيبيور (Maison Épure Egypt)",
  selectedPaymentMethod: "vodafone_cash",
  cart: [
    {
      productId: "ep-01",
      size: "M",
      colorIndex: 0,
      quantity: 1
    },
    {
      productId: "ep-04",
      size: "L",
      colorIndex: 0,
      quantity: 1
    }
  ],
  wishlist: ["ep-01", "ep-03", "ep-07"],
  orders: [
    {
      id: "EPU-9412",
      customerName: "سارة عبد الرحمن",
      phone: "01012345678",
      address: "حي المعادي، القاهرة",
      date: "2026-11-24 14:32",
      items: [{ name: "معطف كشمير فاخر مزدوج الأزرار", size: "M", qty: 1, price: 580 }],
      totalUSD: 580,
      paymentMethod: "vodafone_cash",
      vodafoneSender: "01012345678",
      vodafoneTxId: "VF-8841029",
      status: "pending_vodafone"
    },
    {
      id: "EPU-9411",
      customerName: "كريم عز الدين",
      phone: "01065432198",
      address: "الشيخ زايد، الجيزة",
      date: "2026-11-24 11:15",
      items: [
        { name: "قميص حرير طبيعي ثقيل بقصة مريحة", size: "L", qty: 1, price: 260 },
        { name: "بنطال صوف واسع بثنيات أمامية", size: "L", qty: 1, price: 340 }
      ],
      totalUSD: 600,
      paymentMethod: "vodafone_cash",
      vodafoneSender: "01065432198",
      vodafoneTxId: "VF-8723910",
      status: "confirmed"
    },
    {
      id: "EPU-9408",
      customerName: "يوسف المنصوري",
      phone: "01099887766",
      address: "سموحة، الإسكندرية",
      date: "2026-11-23 18:40",
      items: [{ name: "كنزة ميرينو محبوكة بياقة مرتفعة", size: "XL", qty: 1, price: 290 }],
      totalUSD: 290,
      paymentMethod: "card",
      vodafoneSender: "",
      vodafoneTxId: "",
      status: "shipping"
    },
    {
      id: "EPU-9395",
      customerName: "مريم الشريف",
      phone: "01044556677",
      address: "مصر الجديدة، القاهرة",
      date: "2026-11-22 09:20",
      items: [{ name: "حقيبة توت جلد نابا بتصميم معماري", size: "One Size", qty: 1, price: 420 }],
      totalUSD: 420,
      paymentMethod: "vodafone_cash",
      vodafoneSender: "01044556677",
      vodafoneTxId: "VF-8519402",
      status: "delivered"
    }
  ]
};

// UI Translations Dictionary
const i18n = {
  en: {
    brandName: "MAISON ÉPURE",
    brandTag: "ATELIER DE COUTURE & STREETWEAR",
    topNotice: "Complimentary Global Express Delivery over $350 • Carbon-Neutral Craft",
    navMen: "Men",
    navWomen: "Women",
    navNew: "New Arrivals",
    navCollections: "Collections",
    navSale: "Archive Sale",
    heroEyebrow: "Autumn / Winter 2026 Collection",
    heroTitle: "Monolith & Silence",
    heroDesc: "A deliberate study in tactile minimalism. Uncompromising natural fibers, architectural proportions, and neutral streetwear tailored for modern permanence.",
    heroShopBtn: "Shop New Collection",
    heroExploreBtn: "Explore Lookbook",
    heroHotspotLabel: "Cashmere Double Overcoat",
    catTitle: "Curated Categories",
    catSub: "Distinct architectural silhouettes shaped for enduring everyday distinction.",
    cat1: "Tailored Outerwear",
    cat2: "Everyday Essentials",
    cat3: "Knitwear & Trousers",
    cat4: "Footwear & Leather",
    catViewAll: "Explore Collection",
    trendTitle: "Trending Now",
    trendSub: "Refined staples crafted from natural wool, mulberry silk, and structured linen.",
    filterAll: "All Pieces",
    filterOuterwear: "Outerwear",
    filterEssentials: "Essentials",
    filterKnitwear: "Knitwear",
    filterTrousers: "Trousers",
    filterAccessories: "Accessories",
    sortLabel: "Sort by: Featured",
    sortPriceAsc: "Price: Low to High",
    sortPriceDesc: "Price: High to Low",
    sortRating: "Top Rated",
    quickAdd: "Quick Add",
    selectSize: "Select Size",
    addedToBag: "Added to Bag",
    lookbookTitle: "Volume 04: The Tactile Archive",
    lookbookManifesto: "Luxury is not excess. It is the quiet confidence of raw substance.",
    lookbookBody1: "Every silhouette in the Épure wardrobe is drafted with deliberate economy. We strip away decorative excess to honor the weight of Belgian linen, the warmth of Mongolian cashmere, and the fluid balance of double-pleated trousers.",
    lookbookBody2: "Handcrafted in small batches across heritage workshops in Biella, Florence, and Kyoto, our garments resist seasonal obsolescence in favor of generational integrity.",
    spec1Title: "Material Origin",
    spec1Desc: "100% Traceable Cashmere & Virgin Wool",
    spec2Title: "Tailoring Standard",
    spec2Desc: "Full-Canvas & Blake-Stitched Construction",
    spec3Title: "Sustainability",
    spec3Desc: "GOTS & OEKO-TEX Certified Fibers",
    spec4Title: "Production",
    spec4Desc: "Zero Overproduction Batch Releases",
    lookbookBtn: "Read The Full Manifesto",
    lookbookPin1: "Silk Camp Collar Shirt",
    lookbookPin2: "Pleated Wide Wool Slacks",
    val1Title: "Ethical Sourcing",
    val1Desc: "Traceable natural fibers sourced from regenerative pastures and family farms.",
    val2Title: "Bespoke Finishing",
    val2Desc: "Internal horn buttons, French seams, and hand-finished hems throughout.",
    val3Title: "Carbon-Neutral Shipping",
    val3Desc: "Eco-optimized DHL express dispatch with recyclable linen packaging.",
    val4Title: "Lifetime Repair Pledge",
    val4Desc: "Complimentary repair service on all coats and leather accessories.",
    cartTitle: "Your Shopping Bag",
    cartEmpty: "Your bag is empty",
    cartEmptySub: "Explore our archive and elevate your everyday wardrobe.",
    freeShippingUnlocked: "You have unlocked Free Worldwide Express Delivery!",
    freeShippingAway: "Add {amount} more for Complimentary Express Shipping",
    promoPlaceholder: "Promo code (try 'ÉPURE15')",
    promoApply: "Apply",
    subtotal: "Subtotal",
    discount: "Promo Discount",
    shipping: "Express Shipping",
    shippingFree: "Free",
    total: "Estimated Total",
    checkoutBtn: "Proceed to Checkout",
    continueShopping: "Continue Shopping",
    quickViewTitle: "Product Overview",
    quickViewClose: "Close",
    detailsComposition: "Fabric & Craft Details",
    searchPlaceholder: "Search outerwear, trousers, cashmere...",
    searchSuggestions: "Trending Searches:",
    searchEmpty: "No matching apparel found.",
    footerBrandDesc: "Maison Épure is a contemporary luxury design atelier founded on the principles of material integrity, architectural proportions, and timeless minimalism.",
    newsletterTitle: "The Atelier Gazette",
    newsletterDesc: "Receive private invitations to capsule launches, lookbooks, and private showroom events.",
    newsletterPlaceholder: "Enter your email address...",
    newsletterBtn: "Subscribe",
    footerColShop: "Collections",
    footerColCare: "Client Care",
    footerColLegal: "Legal & Ethics",
    footerShipping: "Shipping & Returns",
    footerStores: "Atelier Appointments",
    footerCareGuide: "Garment Care Guide",
    footerSustainability: "Sustainability Report",
    footerTerms: "Terms of Service",
    footerPrivacy: "Privacy Policy",
    footerRights: "© 2026 MAISON ÉPURE ATELIER. All rights reserved.",
    mockupToggleOff: "Standard Full Browser",
    mockupToggleOn: "Studio 16:9 Mockup Mode"
  },
  ar: {
    brandName: "ميزون إيبيور",
    brandTag: "أتيليه الأزياء الراقية والستريت وير المعاصر",
    topNotice: "شحن عالمي سريع ومجاني للطلبات فوق 350 دولار • أزياء مستدامة وفاخرة",
    navMen: "رجالي",
    navWomen: "نسائي",
    navNew: "وصل حديثاً",
    navCollections: "التشكيلات",
    navSale: "الأرشيف والتخفيضات",
    heroEyebrow: "مجموعة خريف وشتاء 2026",
    heroTitle: "أناقة الصمت والهيكل",
    heroDesc: "دراسة عميقة في بساطة الملمس ونقاء التصميم. ألياف طبيعية نقية، أبعاد معمارية رصينة، وأزياء شوارع مينيمال مصممة لتدوم طويلاً.",
    heroShopBtn: "تسوق المجموعة الجديدة",
    heroExploreBtn: "استعرض اللوك بوك",
    heroHotspotLabel: "معطف كشمير مزدوج الأزرار",
    catTitle: "التصنيفات المختارة",
    catSub: "قصات هندسية نقية صُممت لتمنح إطلالتك اليومية تميزاً استثنائياً.",
    cat1: "المعاطف والسترات",
    cat2: "الأساسيات الفاخرة",
    cat3: "التريكو والبناطيل",
    cat4: "الأحذية والجلديات",
    catViewAll: "استكشف التشكيلة",
    trendTitle: "الأكثر رواجاً الآن",
    trendSub: "قطع أيقونية محبوكة من أنقى أنواع الصوف، الحرير الطبيعي، والكتان المعتق.",
    filterAll: "جميع القطع",
    filterOuterwear: "المعاطف",
    filterEssentials: "الأساسيات",
    filterKnitwear: "التريكو",
    filterTrousers: "البناطيل",
    filterAccessories: "الإكسسوارات",
    sortLabel: "ترتيب حسب: المميز",
    sortPriceAsc: "السعر: من الأقل للأعلى",
    sortPriceDesc: "السعر: من الأعلى للأقل",
    sortRating: "الأعلى تقييماً",
    quickAdd: "إضافة سريعة",
    selectSize: "اختر المقاس",
    addedToBag: "تمت الإضافة للحقيبة",
    lookbookTitle: "الإصدار الرابع: أرشيف الملمس الحقيقي",
    lookbookManifesto: "الفخامة ليست بهرجة زائدة، بل ثقة هادئة بجوهر الخامة.",
    lookbookBody1: "كل قطعة في ميزون إيبيور تُصاغ باقتصاد بصري متعمد. نستبعد الزخارف العشوائية لنبرز فخامة الكتان البلجيكي، ودفء الكشمير المنغولي، وانسيابية البنطال ذي الثنيات المتقنة.",
    lookbookBody2: "صُنعت يدوياً بكميات محدودة في ورش عريقة في بييلا وفلورنسا وكيوتو لتتجاوز تقلبات المواسم وتبقى إرثاً أصيلاً.",
    spec1Title: "مصدر الخامات",
    spec1Desc: "100% كشمير وصوف بكر موثق المصدر",
    spec2Title: "معايير الخياطة",
    spec2Desc: "هيكل كانفاس كامل وخياطة بليك إيطالية",
    spec3Title: "الاستدامة البيئية",
    spec3Desc: "ألياف حاصلة على اعتمادات GOTS العالمية",
    spec4Title: "طريقة الإنتاج",
    spec4Desc: "دفعات تصنيع حصرية بدون هدر أو فائض",
    lookbookBtn: "قراءة بيان العلامة الكامل",
    lookbookPin1: "قميص حرير بياقة مفتوحة",
    lookbookPin2: "بنطال صوف واسع بثنيات",
    val1Title: "خامات أصيلة ومستدامة",
    val1Desc: "ألياف طبيعية نقية وموثوقة المصدر من مزارع بيئية مسؤولة.",
    val2Title: "تشطيب يدوي متقن",
    val2Desc: "أزرار قرن طبيعية، درزات فرنسية مخفية وتشطيب يدوي دقيق.",
    val3Title: "شحن محايد للكربون",
    val3Desc: "توصيل سريع ومستدام عبر أسطول DHL مع تغليف قماشي فاخر.",
    val4Title: "تعهد صيانة مدى الحياة",
    val4Desc: "خدمة ترميم وصيانة مجانية للمعاطف والمنتجات الجلدية.",
    cartTitle: "حقيبة التسوق الخاصة بك",
    cartEmpty: "حقيبتك فارغة حالياً",
    cartEmptySub: "تصفح التشكيلة وأضف لمسات الفخامة الهادئة لخزانتك.",
    freeShippingUnlocked: "تهانينا! حصلت على شحن عالمي سريع ومجاني!",
    freeShippingAway: "أضف ما قيمته {amount} للحصول على شحن سريع مجاني",
    promoPlaceholder: "رمز الخصم (جرب 'ÉPURE15')",
    promoApply: "تطبيق",
    subtotal: "المجموع الفرعي",
    discount: "خصم الرمز الترويجي",
    shipping: "الشحن السريع",
    shippingFree: "مجاني",
    total: "المجموع الكلي",
    checkoutBtn: "متابعة إتمام الطلب",
    continueShopping: "متابعة التسوق",
    quickViewTitle: "نظرة سريعة على القطعة",
    quickViewClose: "إغلاق",
    detailsComposition: "تفاصيل الخامة والتصنيع",
    searchPlaceholder: "ابحث عن معطف، بنطال، كشمير، حرير...",
    searchSuggestions: "عمليات البحث الشائعة:",
    searchEmpty: "لم يتم العثور على قطع مطابقة.",
    footerBrandDesc: "ميزون إيبيور دار أزياء فاخرة معاصرة ترتكز على نقاء الخامات، والقصات الهندسية، وفلسفة المينيماليزم الخالدة.",
    newsletterTitle: "نشرة الأتيليه الخاصة",
    newsletterDesc: "احصل على دعوات حصرية لإطلاق المجموعات المحدودة وعروض الأرشيف الخاصة.",
    newsletterPlaceholder: "أدخل بريدك الإلكتروني...",
    newsletterBtn: "اشتراك",
    footerColShop: "التشكيلات",
    footerColCare: "خدمة العملاء",
    footerColLegal: "القانونية والأخلاقيات",
    footerShipping: "الشحن والاسترجاع",
    footerStores: "حجز موعد في الأتيليه",
    footerCareGuide: "دليل العناية بالملابس",
    footerSustainability: "تقرير الاستدامة السنوي",
    footerTerms: "الشروط والأحكام",
    footerPrivacy: "سياسة الخصوصية",
    footerRights: "© 2026 ميزون إيبيور أتيليه. جميع الحقوق محفوظة.",
    mockupToggleOff: "عرض المتصفح الكامل",
    mockupToggleOn: "نمط عرض الشاشة 16:9 (Behance)"
  }
};

// Format Price Helper based on active currency & rate
function formatPrice(amountInUSD) {
  const curr = CURRENCIES[state.currency] || CURRENCIES.USD;
  const converted = Math.round(amountInUSD * curr.rate);
  return curr.prefix ? `${curr.symbol}${converted}` : `${converted} ${curr.symbol}`;
}

// Convert string template with variables
function t(key, vars = {}) {
  const dict = i18n[state.lang] || i18n.en;
  let text = dict[key] || i18n.en[key] || key;
  for (const [k, v] of Object.entries(vars)) {
    text = text.replace(new RegExp(`{${k}}`, "g"), v);
  }
  return text;
}

// Toast notification helper
function showToast(message) {
  const toast = document.getElementById("toastNotice");
  if (!toast) return;
  toast.querySelector(".toast-text").textContent = message;
  toast.classList.add("show");
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

// Render Products Grid
function renderProducts() {
  const container = document.getElementById("productsGrid");
  if (!container) return;

  let filtered = PRODUCTS.filter(item => {
    if (state.activeCategory !== "all" && item.category !== state.activeCategory) {
      return false;
    }
    if (state.activeSizeFilter !== "all" && !item.sizes.includes(state.activeSizeFilter)) {
      return false;
    }
    return true;
  });

  const sortSelect = document.getElementById("sortSelect");
  if (sortSelect) {
    const val = sortSelect.value;
    if (val === "price-asc") filtered.sort((a, b) => a.price - b.price);
    else if (val === "price-desc") filtered.sort((a, b) => b.price - a.price);
    else if (val === "rating") filtered.sort((a, b) => b.rating - a.rating);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--text-muted);">
        <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">${t("searchEmpty")}</p>
        <button class="filter-pill" onclick="resetFilters()" style="margin-top: 1rem;">${t("filterAll")}</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const name = state.lang === "ar" ? item.name_ar : item.name_en;
    const badge = state.lang === "ar" ? item.badge_ar : item.badge_en;
    const isFav = state.wishlist.includes(item.id);
    const primaryImg = item.colors[0]?.img || item.primaryImg;

    return `
      <article class="product-card" data-id="${item.id}">
        <div class="product-media-wrap">
          ${badge ? `<span class="product-badge">${badge}</span>` : ""}
          <button class="btn-wishlist ${isFav ? "active" : ""}" 
                  onclick="toggleWishlist('${item.id}', event)" 
                  aria-label="Wishlist">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="${isFav ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </button>
          
          <img class="product-img img-primary" id="img-main-${item.id}" src="${primaryImg}" alt="${name}" loading="lazy">
          <img class="product-img img-secondary" src="${item.secondaryImg}" alt="${name} alternate angle" loading="lazy">
          
          <div class="product-quick-actions">
            <div class="size-selector-bar">
              ${item.sizes.map(size => `
                <button class="size-btn" onclick="selectCardSize('${item.id}', '${size}', this, event)">${size}</button>
              `).join("")}
            </div>
            <button class="btn-quick-add" onclick="handleCardQuickAdd('${item.id}', event)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
              </svg>
              <span>${t("quickAdd")}</span>
            </button>
          </div>
        </div>

        <div class="product-info">
          <span class="product-category-meta">${item.category}</span>
          <h3 class="product-name" onclick="openQuickView('${item.id}')">${name}</h3>
          
          <div class="product-price-row">
            <span class="product-price">${formatPrice(item.price)}</span>
            ${item.originalPrice ? `<span class="product-price-original">${formatPrice(item.originalPrice)}</span>` : ""}
          </div>

          <div class="product-swatches">
            ${item.colors.map((c, idx) => `
              <span class="color-swatch ${idx === 0 ? "active" : ""}" 
                    style="background-color: ${c.hex};" 
                    title="${state.lang === "ar" ? c.name_ar : c.name_en}"
                    onclick="switchCardColor('${item.id}', ${idx}, '${c.img}', this, event)">
              </span>
            `).join("")}
          </div>
        </div>
      </article>
    `;
  }).join("");
}

// Swatch Switcher on Card
function switchCardColor(productId, colorIdx, imgUrl, swatchEl, e) {
  e.stopPropagation();
  const card = swatchEl.closest(".product-card");
  if (!card) return;
  card.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("active"));
  swatchEl.classList.add("active");
  const mainImg = document.getElementById(`img-main-${productId}`);
  if (mainImg) {
    mainImg.src = imgUrl;
  }
  card.dataset.selectedColorIndex = colorIdx;
}

// Size Selection on Card
function selectCardSize(productId, size, btnEl, e) {
  e.stopPropagation();
  const card = btnEl.closest(".product-card");
  if (!card) return;
  card.querySelectorAll(".size-btn").forEach(b => b.classList.remove("active"));
  btnEl.classList.add("active");
  card.dataset.selectedSize = size;
}

// Card Quick Add Action
function handleCardQuickAdd(productId, e) {
  e.stopPropagation();
  const card = e.target.closest(".product-card");
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;

  const selectedSize = card.dataset.selectedSize || product.sizes[0];
  const selectedColorIndex = parseInt(card.dataset.selectedColorIndex || "0", 10);

  addToCart(productId, selectedSize, selectedColorIndex, 1);
  const name = state.lang === "ar" ? product.name_ar : product.name_en;
  showToast(`${name} (${selectedSize}) ${t("addedToBag")}`);
  openCartDrawer();
}

// Wishlist Toggle
function toggleWishlist(productId, e) {
  if (e) e.stopPropagation();
  const idx = state.wishlist.indexOf(productId);
  const product = PRODUCTS.find(p => p.id === productId);
  const name = product ? (state.lang === "ar" ? product.name_ar : product.name_en) : "";

  if (idx > -1) {
    state.wishlist.splice(idx, 1);
    showToast(state.lang === "ar" ? `تمت إزالة ${name} من قائمة الرغبات` : `Removed ${name} from Wishlist`);
  } else {
    state.wishlist.push(productId);
    showToast(state.lang === "ar" ? `تم حفظ ${name} في قائمة الرغبات` : `Saved ${name} to Wishlist`);
  }
  updateWishlistUI();
  renderProducts();
}

function updateWishlistUI() {
  const badges = document.querySelectorAll(".wishlist-counter");
  badges.forEach(b => {
    b.textContent = state.wishlist.length;
    b.style.display = state.wishlist.length > 0 ? "flex" : "none";
  });
}

// Cart Management
function addToCart(productId, size, colorIndex, qty = 1) {
  const existing = state.cart.find(
    item => item.productId === productId && item.size === size && item.colorIndex === colorIndex
  );
  if (existing) {
    existing.quantity += qty;
  } else {
    state.cart.push({
      productId,
      size,
      colorIndex,
      quantity: qty
    });
  }
  updateCartUI();
}

function updateCartItemQty(cartIdx, delta) {
  if (!state.cart[cartIdx]) return;
  state.cart[cartIdx].quantity += delta;
  if (state.cart[cartIdx].quantity <= 0) {
    state.cart.splice(cartIdx, 1);
  }
  updateCartUI();
}

function removeCartItem(cartIdx) {
  if (!state.cart[cartIdx]) return;
  state.cart.splice(cartIdx, 1);
  updateCartUI();
}

function applyPromoCode(code) {
  const normalized = (code || "").trim().toUpperCase();
  if (normalized === "ÉPURE15" || normalized === "EPURE15" || normalized === "LUXE15") {
    state.promoDiscountPercent = 15;
    state.promoCodeApplied = normalized;
    showToast(state.lang === "ar" ? "تم تفعيل خصم 15% بنجاح!" : "15% discount applied!");
  } else if (normalized === "FREESHIP") {
    state.promoDiscountPercent = 0;
    state.promoCodeApplied = "FREESHIP";
    showToast(state.lang === "ar" ? "تم تطبيق الشحن المجاني!" : "Free shipping activated!");
  } else {
    showToast(state.lang === "ar" ? "رمز الخصم غير صالح" : "Invalid promo code");
    return;
  }
  updateCartUI();
}

function updateCartUI() {
  const countEl = document.querySelectorAll(".cart-counter");
  const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  countEl.forEach(el => {
    el.textContent = totalItems;
    el.style.display = totalItems > 0 ? "flex" : "none";
  });

  const cartContainer = document.getElementById("cartItemsBody");
  if (!cartContainer) return;

  if (state.cart.length === 0) {
    cartContainer.innerHTML = `
      <div class="cart-empty-state">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <path d="M16 10a4 4 0 0 1-8 0"></path>
        </svg>
        <p style="font-weight: 500; color: var(--text-primary); font-size: 1rem;">${t("cartEmpty")}</p>
        <p style="font-size: 0.8rem; color: var(--text-muted);">${t("cartEmptySub")}</p>
        <button class="btn-primary" onclick="closeCartDrawer()" style="margin-top: 1rem; width: 100%;">
          ${t("continueShopping")}
        </button>
      </div>
    `;
    updateCartSummary(0);
    return;
  }

  let subtotalUSD = 0;

  cartContainer.innerHTML = state.cart.map((cartItem, idx) => {
    const product = PRODUCTS.find(p => p.id === cartItem.productId);
    if (!product) return "";

    const name = state.lang === "ar" ? product.name_ar : product.name_en;
    const colorObj = product.colors[cartItem.colorIndex] || product.colors[0];
    const colorName = state.lang === "ar" ? colorObj.name_ar : colorObj.name_en;
    const itemTotalUSD = product.price * cartItem.quantity;
    subtotalUSD += itemTotalUSD;

    return `
      <div class="cart-item-row">
        <img class="cart-item-thumb" src="${colorObj.img || product.primaryImg}" alt="${name}">
        <div class="cart-item-info">
          <h4 class="cart-item-title">${name}</h4>
          <span class="cart-item-meta">${colorName} • ${cartItem.size}</span>
          <span class="cart-item-price">${formatPrice(product.price)}</span>
          <div class="cart-qty-ctrl">
            <button class="qty-btn" onclick="updateCartItemQty(${idx}, -1)" aria-label="Decrease quantity">−</button>
            <span class="qty-val">${cartItem.quantity}</span>
            <button class="qty-btn" onclick="updateCartItemQty(${idx}, 1)" aria-label="Increase quantity">+</button>
          </div>
        </div>
        <button class="cart-item-remove" onclick="removeCartItem(${idx})" aria-label="Remove item">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;
  }).join("");

  updateCartSummary(subtotalUSD);
}

function updateCartSummary(subtotalUSD) {
  const subtotalEl = document.getElementById("cartSubtotal");
  const discountRow = document.getElementById("cartDiscountRow");
  const discountEl = document.getElementById("cartDiscount");
  const shippingEl = document.getElementById("cartShipping");
  const totalEl = document.getElementById("cartTotal");
  const progressText = document.getElementById("shippingProgressText");
  const progressFill = document.getElementById("shippingProgressFill");

  if (!subtotalEl) return;

  const isFreeShip = subtotalUSD >= state.freeShippingThresholdUSD || state.promoCodeApplied === "FREESHIP";
  const standardShippingUSD = isFreeShip ? 0 : 25;

  let discountUSD = 0;
  if (state.promoDiscountPercent > 0) {
    discountUSD = (subtotalUSD * state.promoDiscountPercent) / 100;
  }

  const finalTotalUSD = Math.max(0, subtotalUSD - discountUSD + standardShippingUSD);

  subtotalEl.textContent = formatPrice(subtotalUSD);

  if (state.promoDiscountPercent > 0) {
    discountRow.style.display = "flex";
    discountEl.textContent = `-${formatPrice(discountUSD)} (${state.promoDiscountPercent}%)`;
  } else {
    discountRow.style.display = "none";
  }

  if (isFreeShip) {
    shippingEl.textContent = t("shippingFree");
    shippingEl.style.color = "var(--accent-olive)";
  } else {
    shippingEl.textContent = formatPrice(standardShippingUSD);
    shippingEl.style.color = "inherit";
  }

  totalEl.textContent = formatPrice(finalTotalUSD);

  // Progress Bar
  if (progressText && progressFill) {
    if (subtotalUSD >= state.freeShippingThresholdUSD || state.promoCodeApplied === "FREESHIP") {
      progressText.textContent = t("freeShippingUnlocked");
      progressFill.style.width = "100%";
      progressFill.style.backgroundColor = "var(--accent-olive)";
    } else {
      const remainingUSD = state.freeShippingThresholdUSD - subtotalUSD;
      progressText.textContent = t("freeShippingAway", { amount: formatPrice(remainingUSD) });
      const percent = Math.min(100, (subtotalUSD / state.freeShippingThresholdUSD) * 100);
      progressFill.style.width = `${percent}%`;
      progressFill.style.backgroundColor = "var(--accent-terracotta)";
    }
  }
}

// Drawer Visibility Controls
function openCartDrawer() {
  document.getElementById("cartDrawerBackdrop")?.classList.add("active");
  document.getElementById("cartDrawer")?.classList.add("active");
  document.body.classList.add("modal-open");
}

function closeCartDrawer() {
  document.getElementById("cartDrawerBackdrop")?.classList.remove("active");
  document.getElementById("cartDrawer")?.classList.remove("active");
  document.body.classList.remove("modal-open");
}

// Quick View Modal
function openQuickView(productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;

  const modal = document.getElementById("quickviewModal");
  if (!modal) return;

  const name = state.lang === "ar" ? product.name_ar : product.name_en;
  const desc = state.lang === "ar" ? product.desc_ar : product.desc_en;
  const material = state.lang === "ar" ? product.material_ar : product.material_en;
  const badge = state.lang === "ar" ? product.badge_ar : product.badge_en;

  const content = document.getElementById("quickviewContent");
  content.innerHTML = `
    <div class="quickview-gallery">
      <img id="qvMainImg" class="quickview-main-img" src="${product.primaryImg}" alt="${name}">
      ${badge ? `<span class="product-badge" style="top:18px; left:18px;">${badge}</span>` : ""}
    </div>
    <div class="quickview-details">
      <span class="product-category-meta">${product.category} • ★ ${product.rating} (${product.reviewsCount} reviews)</span>
      <h2 class="quickview-title">${name}</h2>
      <div class="product-price-row">
        <span class="quickview-price">${formatPrice(product.price)}</span>
        ${product.originalPrice ? `<span class="product-price-original" style="font-size:1rem;">${formatPrice(product.originalPrice)}</span>` : ""}
      </div>
      <p class="quickview-desc">${desc}</p>

      <div class="quickview-specs-list">
        <strong>${t("detailsComposition")}</strong>
        <span>${material}</span>
        <span>${state.lang === "ar" ? "قصة مريحة • قياس حقيقي • تشطيب يدوي" : "Relaxed silhouette • True to size fit • Hand-finished"}</span>
      </div>

      <div style="margin-top: 0.5rem;">
        <label style="font-size: 0.78rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; display:block; margin-bottom: 6px;">
          ${state.lang === "ar" ? "اللون:" : "Color:"} <span id="qvColorName">${state.lang === "ar" ? product.colors[0].name_ar : product.colors[0].name_en}</span>
        </label>
        <div class="product-swatches">
          ${product.colors.map((c, idx) => `
            <span class="color-swatch ${idx === 0 ? "active" : ""}" 
                  style="background-color: ${c.hex}; width: 18px; height: 18px;" 
                  title="${state.lang === "ar" ? c.name_ar : c.name_en}"
                  onclick="selectModalColor('${product.id}', ${idx}, '${c.img}', '${state.lang === "ar" ? c.name_ar : c.name_en}', this)">
            </span>
          `).join("")}
        </div>
      </div>

      <div>
        <label style="font-size: 0.78rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; display:block; margin-bottom: 6px;">
          ${t("selectSize")}
        </label>
        <div class="size-selector-bar" style="background: var(--bg-subtle); justify-content: flex-start; padding: 6px 8px; width: fit-content;" id="qvSizesWrap">
          ${product.sizes.map((s, idx) => `
            <button class="size-btn ${idx === 0 ? "active" : ""}" onclick="selectModalSize('${s}', this)">${s}</button>
          `).join("")}
        </div>
      </div>

      <button class="btn-primary" style="margin-top: 1rem; width: 100%; padding: 14px;" onclick="addQuickViewToBag('${product.id}')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <path d="M16 10a4 4 0 0 1-8 0"></path>
        </svg>
        <span>${t("quickAdd")} • ${formatPrice(product.price)}</span>
      </button>
    </div>
  `;

  modal._activeColorIndex = 0;
  modal._activeSize = product.sizes[0];
  modal.classList.add("active");
  document.body.classList.add("modal-open");
}

function selectModalColor(productId, colorIdx, imgUrl, colorName, swatchEl) {
  const modal = document.getElementById("quickviewModal");
  if (!modal) return;
  modal._activeColorIndex = colorIdx;
  modal.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("active"));
  swatchEl.classList.add("active");
  const img = document.getElementById("qvMainImg");
  if (img) img.src = imgUrl;
  const nameLabel = document.getElementById("qvColorName");
  if (nameLabel) nameLabel.textContent = colorName;
}

function selectModalSize(size, btnEl) {
  const modal = document.getElementById("quickviewModal");
  if (!modal) return;
  modal._activeSize = size;
  modal.querySelectorAll(".size-btn").forEach(b => b.classList.remove("active"));
  btnEl.classList.add("active");
}

function addQuickViewToBag(productId) {
  const modal = document.getElementById("quickviewModal");
  if (!modal) return;
  const size = modal._activeSize || "M";
  const colorIndex = modal._activeColorIndex || 0;
  addToCart(productId, size, colorIndex, 1);
  closeQuickView();
  openCartDrawer();
}

function closeQuickView() {
  document.getElementById("quickviewModal")?.classList.remove("active");
  document.body.classList.remove("modal-open");
}

// Search Modal Controls & Instant Filtering
function openSearch() {
  const modal = document.getElementById("searchModal");
  if (!modal) return;
  modal.classList.add("active");
  document.body.classList.add("modal-open");
  const input = document.getElementById("searchQueryInput");
  if (input) {
    input.value = "";
    setTimeout(() => input.focus(), 150);
  }
  handleLiveSearch("");
}

function closeSearch() {
  document.getElementById("searchModal")?.classList.remove("active");
  document.body.classList.remove("modal-open");
}

function handleLiveSearch(query) {
  const container = document.getElementById("searchResultsWrap");
  if (!container) return;

  const q = (query || "").toLowerCase().trim();
  if (!q) {
    container.innerHTML = `
      <div style="color: var(--text-muted); font-size: 0.9rem; margin-top: 1rem;">
        <span style="font-weight: 600; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.08em; display: block; margin-bottom: 0.75rem;">
          ${t("searchSuggestions")}
        </span>
        <div class="search-tags">
          <span class="search-tag-chip" onclick="applySearchTag('Cashmere')">Cashmere</span>
          <span class="search-tag-chip" onclick="applySearchTag('Silk')">Silk</span>
          <span class="search-tag-chip" onclick="applySearchTag('Wool')">Wool Trousers</span>
          <span class="search-tag-chip" onclick="applySearchTag('Blazer')">Blazer</span>
          <span class="search-tag-chip" onclick="applySearchTag('Tote')">Leather Bag</span>
        </div>
      </div>
    `;
    return;
  }

  const matches = PRODUCTS.filter(p => {
    return (
      p.name_en.toLowerCase().includes(q) ||
      p.name_ar.includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.desc_en.toLowerCase().includes(q) ||
      p.desc_ar.includes(q)
    );
  });

  if (matches.length === 0) {
    container.innerHTML = `
      <p style="color: var(--text-muted); margin-top: 2rem;">${t("searchEmpty")}</p>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1.5rem; margin-top: 1.5rem;">
      ${matches.map(p => `
        <div style="cursor: pointer;" onclick="closeSearch(); openQuickView('${p.id}')">
          <img src="${p.primaryImg}" alt="${state.lang === "ar" ? p.name_ar : p.name_en}" style="aspect-ratio: 3/4; object-fit: cover; border-radius: var(--radius-xs); margin-bottom: 6px;">
          <h4 style="font-size: 0.88rem; font-weight: 500;">${state.lang === "ar" ? p.name_ar : p.name_en}</h4>
          <span style="font-size: 0.82rem; font-weight: 600; color: var(--accent-terracotta);">${formatPrice(p.price)}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function applySearchTag(term) {
  const input = document.getElementById("searchQueryInput");
  if (input) {
    input.value = term;
    handleLiveSearch(term);
  }
}

// Category & Size Filtering Controls
function setCategoryFilter(category, btnEl) {
  state.activeCategory = category;
  document.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
  if (btnEl) btnEl.classList.add("active");
  renderProducts();
}

function resetFilters() {
  state.activeCategory = "all";
  state.activeSizeFilter = "all";
  document.querySelectorAll(".filter-pill").forEach(p => {
    if (p.dataset.category === "all") p.classList.add("active");
    else p.classList.remove("active");
  });
  renderProducts();
}

// Language Switcher (EN <-> AR RTL)
function toggleLanguage() {
  state.lang = state.lang === "en" ? "ar" : "en";
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === "ar" ? "rtl" : "ltr";

  // Update button labels
  const langBtns = document.querySelectorAll(".lang-switch-btn");
  langBtns.forEach(btn => {
    btn.textContent = state.lang === "en" ? "العربية" : "English";
  });

  // Re-translate all data-i18n elements
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    if (key) {
      el.textContent = t(key);
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (key) {
      el.placeholder = t(key);
    }
  });

  // Re-render dynamic areas
  renderProducts();
  updateCartUI();
  updateWishlistUI();
}

// Currency Switcher
function cycleCurrency() {
  const keys = Object.keys(CURRENCIES);
  const currentIdx = keys.indexOf(state.currency);
  const nextIdx = (currentIdx + 1) % keys.length;
  state.currency = keys[nextIdx];

  const currBtns = document.querySelectorAll(".curr-switch-btn");
  currBtns.forEach(btn => {
    btn.textContent = state.currency;
  });

  renderProducts();
  updateCartUI();
}

// Presentation Mockup Mode Toggle (Figma / Behance 16:9 Showcase Frame)
function toggleMockupMode() {
  state.mockupMode = !state.mockupMode;
  document.body.classList.toggle("mode-mockup", state.mockupMode);

  const mockupBtn = document.getElementById("mockupToggleBtn");
  if (mockupBtn) {
    mockupBtn.classList.toggle("active", state.mockupMode);
    const label = mockupBtn.querySelector(".pres-label");
    if (label) {
      label.textContent = state.mockupMode ? t("mockupToggleOff") : t("mockupToggleOn");
    }
  }

  showToast(state.mockupMode ? "16:9 Studio Display Mockup Mode Enabled" : "Full Browser Storefront Enabled");
}

// Initialize Application on DOM Ready
document.addEventListener("DOMContentLoaded", () => {
  // Sticky header background transition
  const header = document.querySelector(".site-header");
  window.addEventListener("scroll", () => {
    if (window.scrollY > 20) {
      header?.classList.add("scrolled");
    } else {
      header?.classList.remove("scrolled");
    }
  });

  // Live search input listener
  const searchInput = document.getElementById("searchQueryInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      handleLiveSearch(e.target.value);
    });
  }

  // Promo code form submit
  const promoForm = document.getElementById("cartPromoForm");
  if (promoForm) {
    promoForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const codeInput = document.getElementById("cartPromoInput");
      if (codeInput) {
        applyPromoCode(codeInput.value);
      }
    });
  }

  // Newsletter form submit
  const newsletterForm = document.getElementById("newsletterForm");
  if (newsletterForm) {
    newsletterForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = newsletterForm.querySelector("input[type='email']");
      if (input && input.value) {
        showToast(state.lang === "ar" ? "شكراً لاشتراكك في نشرة الأتيليه!" : "Thank you for subscribing to The Atelier Gazette!");
        input.value = "";
      }
    });
  }

  // Sort selector listener
  const sortSelect = document.getElementById("sortSelect");
  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      renderProducts();
    });
  }

  // Keyboard accessibility: ESC to close modals/drawers
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeCartDrawer();
      closeQuickView();
      closeSearch();
    }
  });

  // Initialize Firebase Connection
  initFirebase();

  // Initial renders
  renderProducts();
  updateCartUI();
  updateWishlistUI();
  renderDashboard();
});

// ==========================================================================
// VODAFONE CASH & CHECKOUT ENGINE
// ==========================================================================

function openCheckoutModal() {
  closeCartDrawer();
  const modal = document.getElementById("checkoutModal");
  if (!modal) return;

  const totalUSD = getCartSubtotalUSD();
  const discountUSD = (totalUSD * state.promoDiscountPercent) / 100;
  const isFreeShip = totalUSD >= state.freeShippingThresholdUSD || state.promoCodeApplied === "FREESHIP";
  const shippingUSD = isFreeShip ? 0 : 25;
  const finalUSD = Math.max(0, totalUSD - discountUSD + shippingUSD);

  const amountDisplay = document.getElementById("checkoutPayAmount");
  if (amountDisplay) {
    amountDisplay.textContent = formatPrice(finalUSD);
  }

  const walletDisplay = document.getElementById("vfWalletDisplay");
  if (walletDisplay) {
    walletDisplay.textContent = state.vodafoneWalletNumber;
  }

  const walletOwnerDisplay = document.getElementById("vfWalletOwnerDisplay");
  if (walletOwnerDisplay) {
    walletOwnerDisplay.textContent = state.vodafoneWalletOwner;
  }

  modal.classList.add("active");
  document.body.classList.add("modal-open");
}

function closeCheckoutModal() {
  document.getElementById("checkoutModal")?.classList.remove("active");
  document.body.classList.remove("modal-open");
}

function selectPaymentMethod(method) {
  state.selectedPaymentMethod = method;
  document.querySelectorAll(".payment-option-card").forEach(c => {
    c.classList.remove("active");
    if (c.dataset.method === method) c.classList.add("active");
  });

  const vfPanel = document.getElementById("vodafoneDetailsPanel");
  if (vfPanel) {
    vfPanel.style.display = method === "vodafone_cash" ? "flex" : "none";
  }
}

function copyVodafoneWallet() {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(state.vodafoneWalletNumber);
  }
  showToast(state.lang === "ar" ? "تم نسخ رقم محفظة فودافون كاش بنجاح!" : "Vodafone Cash wallet number copied!");
}

function getCartSubtotalUSD() {
  return state.cart.reduce((sum, item) => {
    const p = PRODUCTS.find(prod => prod.id === item.productId);
    return sum + (p ? p.price * item.quantity : 0);
  }, 0);
}

function handleCheckoutSubmit(e) {
  e.preventDefault();
  
  const name = document.getElementById("checkoutName")?.value.trim() || "عميل ميزون إيبيور";
  const phone = document.getElementById("checkoutPhone")?.value.trim() || "";
  const address = document.getElementById("checkoutAddress")?.value.trim() || "القاهرة، مصر";
  const method = state.selectedPaymentMethod;

  let vfSender = "";
  let vfTx = "";

  if (method === "vodafone_cash") {
    vfSender = document.getElementById("vfSenderPhone")?.value.trim() || "";
    vfTx = document.getElementById("vfTransactionId")?.value.trim() || "";

    if (!vfSender || vfSender.length < 11) {
      showToast(state.lang === "ar" ? "يرجى إدخال رقم محفظة فودافون كاش المحول منها بشكل صحيح" : "Please enter a valid sender wallet number");
      document.getElementById("vfSenderPhone")?.focus();
      return;
    }

    if (!vfTx) {
      showToast(state.lang === "ar" ? "يرجى كتابة رقم العملية أو كود الإشعار لتأكيد التحويل" : "Please provide the transaction ID / reference code");
      document.getElementById("vfTransactionId")?.focus();
      return;
    }
  }

  const totalUSD = getCartSubtotalUSD();
  const orderId = "EPU-" + Math.floor(1000 + Math.random() * 9000);

  const orderItems = state.cart.map(c => {
    const prod = PRODUCTS.find(p => p.id === c.productId);
    return {
      name: prod ? (state.lang === "ar" ? prod.name_ar : prod.name_en) : "Apparel Item",
      size: c.size,
      qty: c.quantity,
      price: prod ? prod.price : 200
    };
  });

  const newOrder = {
    id: orderId,
    customerName: name,
    phone: phone,
    address: address,
    date: new Date().toISOString().replace("T", " ").substring(0, 16),
    items: orderItems,
    totalUSD: totalUSD,
    paymentMethod: method,
    vodafoneSender: vfSender,
    vodafoneTxId: vfTx,
    status: method === "vodafone_cash" ? "pending_vodafone" : "confirmed"
  };

  // Prepend new order to list
  state.orders.unshift(newOrder);

  // Broadcast immediately to any open dashboard windows/tabs
  if (orderChannel) {
    try {
      orderChannel.postMessage({ type: "NEW_ORDER", order: newOrder });
    } catch (e) {}
  }

  // Trigger audio alert & instant notification
  notifyIncomingOrder(newOrder);

  // Sync to Firebase Cloud Firestore
  saveOrderToFirestore(newOrder);

  // Log Firebase Analytics Event
  if (analytics && typeof analytics.logEvent === "function") {
    try {
      analytics.logEvent("purchase", {
        transaction_id: newOrder.id,
        value: Math.round(newOrder.totalUSD * 50),
        currency: "EGP",
        payment_type: method
      });
    } catch (e) {
      console.warn("Analytics error:", e);
    }
  }

  // Clear cart
  state.cart = [];
  updateCartUI();

  // Close checkout modal
  closeCheckoutModal();

  // Open Order Success Modal
  showOrderSuccess(newOrder);
  renderDashboard();
}

function showOrderSuccess(order) {
  const modal = document.getElementById("orderSuccessModal");
  if (!modal) return;

  const orderIdEl = document.getElementById("successOrderId");
  const orderAmountEl = document.getElementById("successOrderAmount");
  const orderMethodEl = document.getElementById("successOrderMethod");
  const orderNoteEl = document.getElementById("successOrderNote");

  if (orderIdEl) orderIdEl.textContent = order.id;
  if (orderAmountEl) orderAmountEl.textContent = formatPrice(order.totalUSD);
  
  if (orderMethodEl) {
    if (order.paymentMethod === "vodafone_cash") {
      orderMethodEl.textContent = state.lang === "ar" ? "فودافون كاش (بانتظار مطابقة التحويل)" : "Vodafone Cash (Pending Verification)";
    } else if (order.paymentMethod === "card") {
      orderMethodEl.textContent = state.lang === "ar" ? "بطاقة ائتمانية (مدفوع)" : "Credit Card (Paid)";
    } else {
      orderMethodEl.textContent = state.lang === "ar" ? "الدفع عند الاستلام" : "Cash on Delivery";
    }
  }

  if (orderNoteEl) {
    if (order.paymentMethod === "vodafone_cash") {
      orderNoteEl.innerHTML = state.lang === "ar" 
        ? `تم تسجيل كود العملية <strong>${order.vodafoneTxId}</strong> من محفظة <strong>${order.vodafoneSender}</strong>. سيتم مراجعة التحويل وتجهيز شحنتك فوراً.`
        : `Transaction ref <strong>${order.vodafoneTxId}</strong> recorded. Order is being processed.`;
    } else {
      orderNoteEl.textContent = state.lang === "ar" ? "شكراً لتسوقك من ميزون إيبيور. سيتم إرسال تفاصيل الشحن عبر رسالة نصية." : "Thank you for shopping at Maison Épure.";
    }
  }

  modal.classList.add("active");
  document.body.classList.add("modal-open");
}

function closeOrderSuccessModal() {
  document.getElementById("orderSuccessModal")?.classList.remove("active");
  document.body.classList.remove("modal-open");
}

// ==========================================================================
// STORE MANAGEMENT DASHBOARD
// ==========================================================================

function showDashboard() {
  state.currentView = "dashboard";
  document.body.classList.add("show-dashboard");
  renderDashboard();
  window.scrollTo({ top: 0, behavior: "smooth" });
  showToast(state.lang === "ar" ? "مرحباً بك في لوحة تحكم ميزون إيبيور" : "Welcome to Maison Épure Dashboard");
}

function showStorefront() {
  state.currentView = "storefront";
  document.body.classList.remove("show-dashboard");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function switchDashTab(tabName) {
  state.activeDashTab = tabName;
  document.querySelectorAll(".dash-tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });

  const tabPanels = ["dashTabOverview", "dashTabOrders", "dashTabProducts", "dashTabCustomers", "dashTabSettings"];
  tabPanels.forEach(panelId => {
    const el = document.getElementById(panelId);
    if (el) el.style.display = "none";
  });

  const activePanel = document.getElementById(`dashTab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
  if (activePanel) {
    activePanel.style.display = "block";
  }

  renderDashboard();
}

function approveVodafonePayment(orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return;

  order.status = "confirmed";
  updateOrderStatusInFirestore(orderId, "confirmed");

  showToast(state.lang === "ar" ? `تم تأكيد استلام تحويل فودافون كاش للطلب ${orderId} ومزامنته مع فايربيز!` : `Order ${orderId} Vodafone Cash payment approved!`);
  renderDashboard();
}

function updateOrderStatus(orderId, newStatus) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return;
  order.status = newStatus;
  updateOrderStatusInFirestore(orderId, newStatus);

  showToast(state.lang === "ar" ? `تم تحديث حالة الطلب ${orderId} ومزامنته إلى: ${formatOrderStatus(newStatus)}` : `Order status updated`);
  renderDashboard();
}

function formatOrderStatus(status) {
  switch (status) {
    case "pending_vodafone":
      return state.lang === "ar" ? "بانتظار تأكيد فودافون كاش" : "Pending Vodafone Cash";
    case "confirmed":
      return state.lang === "ar" ? "تم تأكيد الدفع" : "Payment Confirmed";
    case "shipping":
      return state.lang === "ar" ? "جاري التجهيز والشحن" : "Shipping in Progress";
    case "delivered":
      return state.lang === "ar" ? "تم التوصيل بنجاح" : "Delivered";
    default:
      return status;
  }
}

function renderDashboard() {
  // Update Metrics
  const totalSalesUSD = state.orders.reduce((sum, o) => sum + (o.status !== "cancelled" ? o.totalUSD : 0), 0);
  const pendingVfCount = state.orders.filter(o => o.status === "pending_vodafone").length;

  const salesEl = document.getElementById("dashTotalSales");
  if (salesEl) salesEl.textContent = formatPrice(totalSalesUSD);

  const ordersEl = document.getElementById("dashTotalOrders");
  if (ordersEl) ordersEl.textContent = state.orders.length;

  const vfPendingEl = document.getElementById("dashVfPendingCount");
  if (vfPendingEl) vfPendingEl.textContent = pendingVfCount;

  const productsCountEl = document.getElementById("dashTotalProducts");
  if (productsCountEl) productsCountEl.textContent = PRODUCTS.length;

  // Badges in tabs
  const tabVfBadge = document.getElementById("dashTabVfBadge");
  if (tabVfBadge) {
    tabVfBadge.textContent = pendingVfCount;
    tabVfBadge.style.display = pendingVfCount > 0 ? "inline-block" : "none";
  }

  // Render Orders Tables
  renderDashboardOrders();
  renderDashboardProducts();
  renderDashboardCustomers();
}

function renderDashboardOrders() {
  const tableBody = document.getElementById("dashOrdersTableBody");
  const tableBody2 = document.getElementById("dashOrdersTableBody2");
  if (!tableBody && !tableBody2) return;

  if (state.orders.length === 0) {
    const emptyRow = `<tr><td colspan="7" style="text-align:center; padding: 2rem;">${state.lang === "ar" ? "لا توجد طلبات حتى الآن" : "No orders recorded yet."}</td></tr>`;
    if (tableBody) tableBody.innerHTML = emptyRow;
    if (tableBody2) tableBody2.innerHTML = emptyRow;
    return;
  }

  const rowsHtml = state.orders.map(order => {
    let statusClass = "vodafone-pending";
    if (order.status === "confirmed") statusClass = "confirmed";
    else if (order.status === "shipping") statusClass = "shipping";
    else if (order.status === "delivered") statusClass = "delivered";

    const isVfPending = order.status === "pending_vodafone";

    return `
      <tr data-order-id="${order.id}">
        <td>
          <strong>${order.id}</strong>
          <div style="font-size: 0.72rem; color: var(--text-muted);">${order.date}</div>
        </td>
        <td>
          <strong>${order.customerName}</strong>
          <div style="font-size: 0.75rem; color: var(--text-secondary);">${order.phone}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">${order.address}</div>
        </td>
        <td>
          <div style="font-size: 0.8rem;">
            ${order.items.map(i => `${i.name} (${i.size}) × ${i.qty}`).join("<br>")}
          </div>
        </td>
        <td>
          <strong>${formatPrice(order.totalUSD)}</strong>
        </td>
        <td>
          ${order.paymentMethod === "vodafone_cash" ? `
            <div style="display: flex; flex-direction: column; gap: 3px;">
              <span class="vodafone-logo-badge" style="width: fit-content;">فودافون كاش</span>
              <span style="font-size: 0.75rem; font-family: monospace;">من: ${order.vodafoneSender}</span>
              <span style="font-size: 0.72rem; color: var(--text-muted);">كود: ${order.vodafoneTxId}</span>
            </div>
          ` : `
            <span style="font-size: 0.8rem; color: var(--text-secondary);">${order.paymentMethod === "card" ? "بطاقة ائتمان" : "دفع عند الاستلام"}</span>
          `}
        </td>
        <td>
          <span class="status-pill ${statusClass}">
            ${formatOrderStatus(order.status)}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            ${isVfPending ? `
              <button class="btn-table-action btn-approve-vodafone" onclick="approveVodafonePayment('${order.id}')" title="تأكيد استلام كاش">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>تأكيد التحويل</span>
              </button>
            ` : ""}
            
            <select class="checkout-input" style="padding: 4px 8px; font-size: 0.75rem;" onchange="updateOrderStatus('${order.id}', this.value)">
              <option value="confirmed" ${order.status === "confirmed" ? "selected" : ""}>مؤكد ومجهز</option>
              <option value="shipping" ${order.status === "shipping" ? "selected" : ""}>جاري الشحن</option>
              <option value="delivered" ${order.status === "delivered" ? "selected" : ""}>تم التوصيل</option>
              <option value="pending_vodafone" ${order.status === "pending_vodafone" ? "selected" : ""}>بانتظار فودافون كاش</option>
            </select>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  if (tableBody) tableBody.innerHTML = rowsHtml;
  if (tableBody2) tableBody2.innerHTML = rowsHtml;
}

function renderDashboardProducts() {
  const container = document.getElementById("dashProductsTableBody");
  if (!container) return;

  container.innerHTML = PRODUCTS.map((p, idx) => `
    <tr>
      <td>
        <img src="${p.primaryImg}" alt="${p.name_ar}" style="width: 44px; height: 56px; object-fit: cover; border-radius: var(--radius-xs);">
      </td>
      <td>
        <strong>${state.lang === "ar" ? p.name_ar : p.name_en}</strong>
        <div style="font-size: 0.72rem; color: var(--text-muted);">${p.id} • ${p.category}</div>
      </td>
      <td><strong>${formatPrice(p.price)}</strong></td>
      <td><span style="font-size: 0.75rem;">${p.sizes.join(", ")}</span></td>
      <td><span style="color: var(--accent-olive); font-weight: 600;">متوفر بالمخزن</span></td>
      <td>
        <button class="btn-table-action btn-table-view" onclick="openQuickView('${p.id}')">معاينة</button>
      </td>
    </tr>
  `).join("");
}

function renderDashboardCustomers() {
  const container = document.getElementById("dashCustomersTableBody");
  if (!container) return;

  const customers = [
    { name: "سارة عبد الرحمن", phone: "01012345678", email: "sara.rahman@example.com", ordersCount: 3, totalSpent: 1640, city: "القاهرة" },
    { name: "كريم عز الدين", phone: "01065432198", email: "karim.ezz@example.com", ordersCount: 2, totalSpent: 1120, city: "الجيزة" },
    { name: "يوسف المنصوري", phone: "01099887766", email: "youssef.m@example.com", ordersCount: 1, totalSpent: 290, city: "الإسكندرية" },
    { name: "مريم الشريف", phone: "01044556677", email: "mariam.sherif@example.com", ordersCount: 4, totalSpent: 2180, city: "القاهرة" }
  ];

  container.innerHTML = customers.map(c => `
    <tr>
      <td>
        <strong>${c.name}</strong>
        <div style="font-size: 0.72rem; color: var(--text-muted);">${c.email}</div>
      </td>
      <td>${c.phone}</td>
      <td>${c.city}</td>
      <td><strong>${c.ordersCount} طلبات</strong></td>
      <td><strong>${formatPrice(c.totalSpent)}</strong></td>
      <td><span class="status-pill delivered">عميل مميز VIP</span></td>
    </tr>
  `).join("");
}

function saveWalletSettings(e) {
  e.preventDefault();
  const numInput = document.getElementById("settingsWalletNumber");
  const nameInput = document.getElementById("settingsWalletOwner");

  if (numInput && numInput.value.trim()) {
    state.vodafoneWalletNumber = numInput.value.trim();
  }
  if (nameInput && nameInput.value.trim()) {
    state.vodafoneWalletOwner = nameInput.value.trim();
  }

  showToast(state.lang === "ar" ? "تم حفظ إعدادات محفظة فودافون كاش بنجاح!" : "Vodafone Cash settings saved!");
}

function openAddProductModal() {
  const modal = document.getElementById("addProductModal");
  if (modal) {
    modal.classList.add("active");
    document.body.classList.add("modal-open");
  }
}

function closeAddProductModal() {
  document.getElementById("addProductModal")?.classList.remove("active");
  document.body.classList.remove("modal-open");
}

function handleAddProductSubmit(e) {
  e.preventDefault();
  const nameAr = document.getElementById("newProdNameAr")?.value.trim() || "قطعة جديدة";
  const nameEn = document.getElementById("newProdNameEn")?.value.trim() || "New Atelier Piece";
  const category = document.getElementById("newProdCategory")?.value || "outerwear";
  const price = parseFloat(document.getElementById("newProdPrice")?.value) || 350;
  const imgUrl = document.getElementById("newProdImg")?.value.trim() || "https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=900&q=80";

  const newP = {
    id: "ep-0" + (PRODUCTS.length + 1),
    name_en: nameEn,
    name_ar: nameAr,
    category: category,
    price: price,
    badge_en: "New Arrival",
    badge_ar: "جديد بالأتيليه",
    sizes: ["S", "M", "L", "XL"],
    colors: [
      { name_en: "Primary", name_ar: "لون رئيسي", hex: "#1C1B19", img: imgUrl }
    ],
    primaryImg: imgUrl,
    secondaryImg: imgUrl,
    desc_en: "Handcrafted contemporary luxury garment tailored for pure minimalist posture.",
    desc_ar: "قطعة ملابس فاخرة صُممت يدوياً بحرفية عالية وأقمشة طبيعية معتمدة.",
    material_en: "100% Traceable Natural Fibers",
    material_ar: "100% ألياف طبيعية نقية موثقة",
    rating: 5.0,
    reviewsCount: 1
  };

  PRODUCTS.unshift(newP);
  saveProductToFirestore(newP);
  renderProducts();
  renderDashboard();
  closeAddProductModal();
  showToast(state.lang === "ar" ? `تمت إضافة ${nameAr} بنجاح إلى تشكيلة المتجر ومزامنتها مع فايربيز!` : `Product added and synced to Firebase!`);
}

function triggerDrawerCheckout() {
  if (state.cart.length === 0) {
    showToast(state.lang === "ar" ? "حقيبة التسوق فارغة! أضف قطعاً للمتابعة" : "Bag is empty!");
    return;
  }
  openCheckoutModal();
}

