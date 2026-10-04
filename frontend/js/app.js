const API = '/api';

let PRODUCTS = [];
let cart = {};
try { cart = JSON.parse(localStorage.getItem('atelier_cart') || '{}'); } catch (e) { cart = {}; }
let activeCat = "Tout";
let query = "";

function saveCart() {
  try { localStorage.setItem('atelier_cart', JSON.stringify(cart)); } catch (e) {}
}
function fmt(n) { return n.toFixed(2).replace('.', ',') + ' €'; }

// ---- Chargement des produits depuis le back-end ----
async function loadCategories() {
  const res = await fetch(`${API}/products`);
  const all = await res.json();
  const cats = ["Tout", ...new Set(all.map(p => p.cat))];
  const nav = document.getElementById('catNav');
  nav.innerHTML = cats.map(c => `<button class="${c === activeCat ? 'active' : ''}" onclick="setCat('${c}')">${c}</button>`).join('');
}

async function loadProducts() {
  const params = new URLSearchParams();
  if (activeCat !== "Tout") params.set('cat', activeCat);
  if (query) params.set('q', query);
  const res = await fetch(`${API}/products?${params.toString()}`);
  PRODUCTS = await res.json();
  renderProducts();
}

function setCat(c) { activeCat = c; loadCategories(); loadProducts(); }

document.getElementById('searchInput').addEventListener('input', e => {
  query = e.target.value.toLowerCase();
  loadProducts();
});

function renderProducts() {
  document.getElementById('resultCount').textContent = PRODUCTS.length + (PRODUCTS.length > 1 ? ' articles' : ' article');
  const grid = document.getElementById('productGrid');
  if (PRODUCTS.length === 0) {
    grid.innerHTML = '<div class="empty">Aucun article ne correspond à votre recherche.</div>';
    return;
  }
  grid.innerHTML = PRODUCTS.map(p => `
    <div class="card">
      <div class="card-visual">${p.emoji}<span class="stock-tag">${p.stock} en stock</span></div>
      <div class="card-body">
        <div class="cat">${p.cat}</div>
        <h3>${p.name}</h3>
        <div class="price-row">
          <span class="price">${fmt(p.price)}</span>
          <button class="add-btn" onclick="addToCart(${p.id}, event)">+</button>
        </div>
      </div>
    </div>
  `).join('');
}

// ---- Panier (côté client, persistant en local) ----
function addToCart(id, e) {
  if (e) e.stopPropagation();
  cart[id] = (cart[id] || 0) + 1;
  saveCart(); renderCart();
  toggleCart(true);
}
function changeQty(id, delta) {
  cart[id] = (cart[id] || 0) + delta;
  if (cart[id] <= 0) delete cart[id];
  saveCart(); renderCart();
}
function removeItem(id) { delete cart[id]; saveCart(); renderCart(); }

function cartCount() { return Object.values(cart).reduce((a, b) => a + b, 0); }

async function findProduct(id) {
  // On recherche d'abord dans la liste déjà chargée, sinon on interroge l'API
  let p = PRODUCTS.find(p => p.id == id);
  if (!p) {
    const res = await fetch(`${API}/products/${id}`);
    if (res.ok) p = await res.json();
  }
  return p;
}

async function renderCart() {
  const count = cartCount();
  const badge = document.getElementById('cartBadge');
  badge.style.display = count > 0 ? 'flex' : 'none';
  badge.textContent = count;

  const itemsEl = document.getElementById('cartItems');
  const ids = Object.keys(cart);
  if (ids.length === 0) {
    itemsEl.innerHTML = '<div class="empty">Votre panier est vide.</div>';
    document.getElementById('cartTotal').textContent = fmt(0);
    updateCheckoutBtn();
    return;
  }

  let total = 0;
  const rows = [];
  for (const id of ids) {
    const p = await findProduct(id);
    if (!p) continue;
    total += p.price * cart[id];
    rows.push(`
      <div class="cart-row">
        <div class="cart-thumb">${p.emoji}</div>
        <div class="cart-info">
          <div class="name">${p.name}</div>
          <div class="unit">${fmt(p.price)} l'unité</div>
          <div class="qty-ctrl">
            <button onclick="changeQty(${p.id},-1)">−</button>
            <span>${cart[id]}</span>
            <button onclick="changeQty(${p.id},1)">+</button>
            <button class="remove-x" onclick="removeItem(${p.id})">retirer</button>
          </div>
        </div>
      </div>`);
  }
  itemsEl.innerHTML = rows.join('');
  document.getElementById('cartTotal').textContent = fmt(total);
  updateCheckoutBtn();
}
function updateCheckoutBtn() {
  const btn = document.getElementById('checkoutBtn');
  const empty = cartCount() === 0;
  btn.disabled = empty;
  btn.style.opacity = empty ? .5 : 1;
}

function toggleCart(open) {
  document.getElementById('cartDrawer').classList.toggle('open', open);
  document.getElementById('overlay').classList.toggle('open', open);
}

// ---- Checkout : appelle le back-end pour créer la commande ----
function openCheckout() {
  if (cartCount() === 0) return;
  document.getElementById('checkoutModal').innerHTML = `
    <h2>Finaliser la commande</h2>
    <div class="field"><label>Nom complet</label><input id="ckName" required></div>
    <div class="field"><label>E-mail</label><input id="ckEmail" type="email" required></div>
    <div class="field"><label>Adresse de livraison</label><textarea id="ckAddr" rows="2" required></textarea></div>
    <div id="ckError"></div>
    <button class="btn full" onclick="submitOrder()">Confirmer la commande</button>
  `;
  document.getElementById('checkoutOverlay').classList.add('open');
}
function closeCheckout() { document.getElementById('checkoutOverlay').classList.remove('open'); }

async function submitOrder() {
  const name = document.getElementById('ckName').value.trim();
  const email = document.getElementById('ckEmail').value.trim();
  const address = document.getElementById('ckAddr').value.trim();
  const errEl = document.getElementById('ckError');
  errEl.innerHTML = '';

  if (!name || !email || !address) {
    errEl.innerHTML = '<div class="error-msg">Merci de remplir tous les champs.</div>';
    return;
  }

  const items = Object.entries(cart).map(([id, qty]) => ({ id: Number(id), qty }));

  try {
    const res = await fetch(`${API}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, address, items })
    });
    const data = await res.json();

    if (!res.ok) {
      errEl.innerHTML = `<div class="error-msg">${data.error || 'Une erreur est survenue.'}</div>`;
      return;
    }

    document.getElementById('checkoutModal').innerHTML = `
      <div class="confirm">
        <div class="check">✓</div>
        <h2>Merci, ${name.split(' ')[0]} !</h2>
        <p style="color:var(--ink-soft)">Votre commande <strong>${data.orderNumber}</strong> a bien été enregistrée. Une confirmation sera envoyée à ${email}.</p>
        <button class="btn" onclick="closeCheckout(); resetAfterOrder();">Fermer</button>
      </div>`;
    cart = {};
    saveCart();
  } catch (e) {
    errEl.innerHTML = '<div class="error-msg">Impossible de contacter le serveur. Vérifiez que le back-end tourne bien.</div>';
  }
}
function resetAfterOrder() {
  renderCart();
  toggleCart(false);
  loadProducts(); // rafraîchit les stocks après la commande
}

document.getElementById('checkoutOverlay').addEventListener('click', e => {
  if (e.target.id === 'checkoutOverlay') closeCheckout();
});

// ---- Démarrage ----
loadCategories();
loadProducts();
renderCart();
