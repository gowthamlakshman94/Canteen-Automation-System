// cart.js - improved, backward-compatible cart script
(function () {
  'use strict';

  const STORAGE_KEY = 'canteenCart';
  const CART_CONTAINER_SEL = '.cartItems';
  const TOTAL_PRICE_SEL = '.cart-total-price';
  const PURCHASE_BTN_SEL = '.purchaseBtn';
  const DEFAULT_API_BASE = 'http://localhost';

  // Resolve base URL for order submission (use existing globals if present)
  const BASE_URL = (function () {
    if (typeof window.BASE_URL !== 'undefined') return window.BASE_URL;
    if (typeof window.API_BASE !== 'undefined') return window.API_BASE;
    if (typeof window.config !== 'undefined' && window.config.BASE_URL) return window.config.BASE_URL;
    return DEFAULT_API_BASE;
  })();

  // In-memory cart: array of { id, title, price, imageSrc, quantity }
  let cart = [];

  // ---------- Utilities ----------
  function qs(sel, root = document) { return root.querySelector(sel); }
  function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
  function formatPrice(num) {
    // always two decimals
    return (Math.round(num * 100) / 100).toFixed(2);
  }
  function parsePriceText(text) {
    if (!text) return 0;
    const cleaned = String(text).replace(/[^\d.-]/g, '');
    const p = parseFloat(cleaned);
    return isNaN(p) ? 0 : p;
  }
  function escapeHtml(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---------- Storage ----------
  function saveCart() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch (e) {
      console.error('Failed to save cart', e);
    }
  }
  function loadCart() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      cart = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(cart)) cart = [];
    } catch (e) {
      console.error('Failed to load cart', e);
      cart = [];
    }
  }
  function clearCart() {
    cart = [];
    saveCart();
    renderCart();
  }

  // ---------- Cart model operations ----------
  function findCartIndexById(idOrTitle) {
    if (!idOrTitle) return -1;
    return cart.findIndex(it => (it.id && String(it.id) === String(idOrTitle)) || String(it.title) === String(idOrTitle));
  }

  function addOrIncrementItem(item) {
    // item: { id?, title, price, imageSrc?, quantity? }
    const qty = Math.max(1, parseInt(item.quantity || 1, 10));
    const idKey = item.id ?? item.title;
    const idx = findCartIndexById(idKey);
    if (idx !== -1) {
      cart[idx].quantity = (parseInt(cart[idx].quantity, 10) || 0) + qty;
    } else {
      cart.push({
        id: item.id ?? item.title,
        title: item.title,
        price: Number(item.price) || 0,
        imageSrc: item.imageSrc || '',
        quantity: qty
      });
    }
    saveCart();
    renderCart();
  }

  function updateItemQuantity(idOrTitle, quantity) {
    const idx = findCartIndexById(idOrTitle);
    if (idx === -1) return;
    cart[idx].quantity = Math.max(1, parseInt(quantity, 10) || 1);
    saveCart();
    renderCart();
  }

  function removeItem(idOrTitle) {
    const idx = findCartIndexById(idOrTitle);
    if (idx === -1) return;
    cart.splice(idx, 1);
    saveCart();
    renderCart();
  }

  // ---------- Rendering ----------
  function renderCart() {
    const container = qs(CART_CONTAINER_SEL);
    const totalEl = qs(TOTAL_PRICE_SEL);
    if (!container) return;

    container.innerHTML = '';

    if (cart.length === 0) {
      container.innerHTML = '<p style="padding:12px">Your cart is empty.</p>';
      if (totalEl) totalEl.innerHTML = '&#8377;0.00';
      return;
    }

    cart.forEach(item => {
      const row = document.createElement('div');
      row.className = 'cart-row';
      row.dataset.id = item.id ?? item.title;

      const safeTitle = escapeHtml(item.title);
      const safeImage = escapeHtml(item.imageSrc || 'placeholder.jpg');
      const safePrice = formatPrice(Number(item.price || 0));
      const qty = Number(item.quantity || 1);

      row.innerHTML = `
        <div class="cart-item cart-column" style="display:flex;align-items:center">
          <img class="cart-item-image" src="${safeImage}" alt="${safeTitle}" style="width:60px;height:60px;object-fit:cover;margin-right:10px">
          <span class="cart-item-title">${safeTitle}</span>
        </div>
        <span class="cart-price cart-column">&#8377; ${safePrice}</span>
        <div class="cart-quantity cart-column" style="display:flex;align-items:center">
          <input class="cart-quantity-input form-control" type="number" min="1" value="${qty}" style="width:90px;margin-right:8px">
          <button class="removeBtn btn btn-danger btn-sm" type="button">Remove</button>
        </div>
      `;

      // attach listeners for this row
      const qtyInput = row.querySelector('.cart-quantity-input');
      const removeBtn = row.querySelector('.removeBtn');

      qtyInput.addEventListener('change', function () {
        let v = parseInt(this.value, 10);
        if (isNaN(v) || v < 1) v = 1;
        this.value = v;
        updateItemQuantity(item.id ?? item.title, v);
      });

      removeBtn.addEventListener('click', function () {
        removeItem(item.id ?? item.title);
      });

      container.appendChild(row);
    });

    updateCartTotal();
  }

  // ---------- Totals ----------
  function updateCartTotal() {
    const totalEl = qs(TOTAL_PRICE_SEL);
    const container = qs(CART_CONTAINER_SEL);
    if (!container) {
      if (totalEl) totalEl.innerHTML = '&#8377;0.00';
      return;
    }
    let total = 0;
    const rows = qsa('.cart-row', container);
    rows.forEach(row => {
      const priceEl = row.querySelector('.cart-price');
      const qtyEl = row.querySelector('.cart-quantity-input');
      const price = parsePriceText(priceEl ? priceEl.innerText : '0');
      const qty = parseInt(qtyEl ? qtyEl.value : '0', 10) || 0;
      total += price * qty;
    });

    total = Math.round(total * 100) / 100;
    if (totalEl) totalEl.innerHTML = '&#8377;' + formatPrice(total);
  }

  // ---------- DOM event handlers (legacy compatibility) ----------
  function removeCartItem(event) {
    const btn = event.target;
    const row = btn && btn.closest('.cart-row');
    if (!row) return;
    const id = row.dataset.id || (row.querySelector('.cart-item-title') && row.querySelector('.cart-item-title').innerText);
    removeItem(id);
  }

  function quantityChanged(event) {
    const input = event.target;
    let val = parseInt(input.value, 10);
    if (isNaN(val) || val <= 0) {
      val = 1;
      input.value = 1;
    }
    const row = input && input.closest('.cart-row');
    const id = row && (row.dataset.id || (row.querySelector('.cart-item-title') && row.querySelector('.cart-item-title').innerText));
    if (id) updateItemQuantity(id, val);
  }

  function addToCartClicked(event) {
    // Compatible with your existing markup where click is on a wrapper addToCartbutton
    const button = event.target.closest('.addToCartbutton, .add-to-cart, button');
    if (!button) return;
    // attempt to find containing shopItem
    const shopItem = button.closest('.thumbnail') || button.closest('.col-sm-6') || button.closest('.col-md-3') || button.closest('.shop-item');
    if (!shopItem) return;
    const titleEl = shopItem.querySelector('.item-title');
    const priceEl = shopItem.querySelector('.item-price');
    const imgEl = shopItem.querySelector('.item-image');

    const title = titleEl ? titleEl.innerText.trim() : 'Item';
    const price = priceEl ? parsePriceText(priceEl.innerText) : 0;
    const imageSrc = imgEl ? imgEl.src : '';
    addItemToCart(title, price, imageSrc, 1);
  }

  // ---------- Primary addItemToCart function (exposed globally) ----------
  function addItemToCart(a, b, c, d) {
    // Support both:
    // addItemToCart(title, price, imageSrc, quantity)
    // addItemToCart({ title, price, imageSrc, id, quantity })
    let item;
    if (typeof a === 'object' && a !== null) {
      item = {
        id: a.id,
        title: a.title || a.name || a.itemName || 'Item',
        price: Number(a.price || a.price_amount || a.cost || 0),
        imageSrc: a.imageSrc || a.image || a.image_url || '',
        quantity: a.quantity || 1
      };
    } else {
      // positional arguments
      item = {
        id: undefined,
        title: a || 'Item',
        price: Number(b || 0),
        imageSrc: c || '',
        quantity: d || 1
      };
    }

    if (!item.title) item.title = 'Item';
    item.price = Number(item.price) || 0;
    item.quantity = Math.max(1, parseInt(item.quantity, 10) || 1);

    // Prevent duplicate by exact title (legacy behavior), but if ID provided use ID match
    const existsIdx = findCartIndexById(item.id ?? item.title);
    if (existsIdx !== -1) {
      // if exists, increment quantity (keeps backward alert-free behavior)
      cart[existsIdx].quantity = (parseInt(cart[existsIdx].quantity, 10) || 0) + item.quantity;
      saveCart();
      renderCart();
      return;
    }

    addOrIncrementItem(item);
  }

  // Expose addItemToCart globally for the menu loader
  window.addItemToCart = addItemToCart;

  // Listen for custom event 'canteen:addToCart' (used by your HTML menu code)
  window.addEventListener('canteen:addToCart', function (e) {
    if (!e || !e.detail) return;
    addItemToCart(e.detail);
  });

  // ---------- Prepare and submit order ----------
  function getCookieValue(name) {
    const match = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return match ? decodeURIComponent(match.pop()) : '';
  }

  function prepareOrderData() {
    if (!cart || cart.length === 0) {
      alert('Your cart is empty!');
      return null;
    }
    const createdAt = new Date().toISOString();
    const items = cart.map(it => ({
      itemName: it.title,
      price: Number(it.price),
      quantity: Number(it.quantity),
      createdAt
    }));

    const orderId = new Date().getTime();
    localStorage.setItem('orderId', orderId);

    const userEmail = getCookieValue('userEmail') || getCookieValue('user_email') || 'unknown';
    const total = cart.reduce((s, it) => s + Number(it.price) * Number(it.quantity), 0);

    return {
      orderId,
      userEmail,
      items,
      total: Math.round(total * 100) / 100,
      createdAt
    };
  }

  function submitOrder(orderData) {
    if (!orderData) return;
    const email = orderData.userEmail;
    if (!email || email === 'unknown') {
      alert('User email not found. Please log in before submitting an order.');
      return;
    }

    const submitUrl = (BASE_URL || DEFAULT_API_BASE).replace(/\/$/, '') + '/submitOrder';
    console.log('Submitting order to', submitUrl, orderData);

    fetch(submitUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    }).then(resp => {
      if (!resp.ok) throw new Error('Server returned ' + resp.status);
      return resp.json().catch(() => ({}));
    }).then(data => {
      // Consider server's response; assume success if no error
      alert('Order submitted successfully! Order ID: ' + orderData.orderId);
      clearCart();

      // --- NEW: redirect to Order Confirmation page after successful submission ---
      // small timeout so alert is seen and state is cleared
      setTimeout(function () {
        window.location.href = 'Order Confirmation.html';
      }, 700);
      // --------------------------------------------------------------------------
    }).catch(err => {
      console.error('Order submission failed', err);
      alert('Failed to submit order. Please try again later.');
    });
  }

  // ---------- Purchase click ----------
  function purchaseClicked(event) {
    // If the purchase button is a wrapper containing an anchor, prevent immediate navigation
    event && event.preventDefault && event.preventDefault();

    const orderData = prepareOrderData();
    if (!orderData) return;

    // Submit to backend
    submitOrder(orderData);
  }

  // ---------- Initialization ----------
  function wireStaticButtons() {
    // Attach remove button listeners for any pre-existing rows (legacy)
    qsa('.removeBtn').forEach(btn => {
      btn.removeEventListener('click', removeCartItem); // avoid duplicate
      btn.addEventListener('click', removeCartItem);
    });

    // Attach quantity change listeners for any pre-existing inputs (legacy)
    qsa('.cart-quantity-input').forEach(inp => {
      inp.removeEventListener('change', quantityChanged);
      inp.addEventListener('change', quantityChanged);
    });

    // For legacy markup where the "add to cart" wrapper was clickable
    qsa('.addToCartbutton').forEach(wrapper => {
      wrapper.removeEventListener('click', addToCartClicked);
      wrapper.addEventListener('click', addToCartClicked);
    });

    // Also support modern buttons with class 'add-to-cart' (from your dynamic menu script)
    qsa('.add-to-cart').forEach(btn => {
      btn.removeEventListener('click', addToCartClicked);
      btn.addEventListener('click', addToCartClicked);
    });

    // Purchase button
    const purchaseBtnWrapper = qs(PURCHASE_BTN_SEL);
    if (purchaseBtnWrapper) {
      // the button is inside wrapper; find button
      const btn = purchaseBtnWrapper.querySelector('button') || purchaseBtnWrapper;
      btn.removeEventListener('click', purchaseClicked);
      btn.addEventListener('click', purchaseClicked);
    }
  }

  function init() {
    loadCart();
    renderCart();
    wireStaticButtons();

    // Also observe for newly added .cart-row elements (if other scripts add them)
    const cartContainer = qs(CART_CONTAINER_SEL);
    if (cartContainer) {
      const obs = new MutationObserver(() => {
        // ensure listeners attached and total updated
        wireStaticButtons();
        updateCartTotal();
      });
      obs.observe(cartContainer, { childList: true, subtree: true });
    }

    // If page previously had click handlers wired on DOMContentLoaded, ensure compatibility:
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', wireStaticButtons);
    } else {
      // already ready
      wireStaticButtons();
    }

    // --- NEW: prevent outer anchor from navigating immediately when purchase button is clicked ---
    // This keeps your existing HTML <a href="Order Confirmation.html"> wrapper but prevents premature navigation.
    document.querySelectorAll('.purchaseBtn').forEach(btn => {
      const anchor = btn.closest('a');
      if (anchor) {
        // avoid adding duplicate listeners
        anchor.addEventListener('click', function (e) {
          e.preventDefault();
        });
      }
    });
    // --------------------------------------------------------------------------

  }

  // Start
  init();

  // For debugging convenience
  window.canteenCart = {
    getCart: () => cart.slice(),
    clearCart,
    addOrIncrementItem,
    removeItem,
    updateItemQuantity
  };

})();
