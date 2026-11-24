/* Wag & Tails app — runs on the "Wag & Tails" page. Data comes from the plugin's REST API. */
(function () {
'use strict';
const B = window.WT_BOOT;
if (!B || !document.getElementById('app')) return;

/* ---------- constants ---------- */
const LOGO = B.logo;
const PAW = '<svg viewBox="0 0 64 64" fill="currentColor" aria-hidden="true"><ellipse cx="32" cy="42" rx="14" ry="12"/><ellipse cx="14" cy="26" rx="6" ry="8"/><ellipse cx="25" cy="15" rx="6" ry="8"/><ellipse cx="39" cy="15" rx="6" ry="8"/><ellipse cx="50" cy="26" rx="6" ry="8"/></svg>';
const PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>';
const BAG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 7h12l-1 14H7L6 7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>';
const IC = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M9 15l2 2 4-4"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/></svg>',
  desk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
  chev: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>'
};
const COORDS = {kanpur:[26.4499,80.3319],lucknow:[26.8467,80.9462],hyderabad:[17.385,78.4867],'north-mumbai':[19.2307,72.8567],'south-mumbai':[18.9388,72.8354],'navi-mumbai':[19.033,73.0297],pune:[18.5204,73.8567],pcmc:[18.6298,73.7997],indore:[22.7196,75.8577],jaipur:[26.9124,75.7873]};
const AGGRESSION = ['Calm — loves people','Mild — nervous with strangers','Moderate — may nip when handled','High — needs a muzzle'];
const CANCEL_REASONS = ['Customer requested','Pet is unwell','Customer not reachable','Groomer unavailable','Weather / traffic','Duplicate booking','Other'];
const SOURCES = ['Phone call','WhatsApp','Instagram / Facebook','Walk-in / referral','Website'];
const OPEN = ['Confirmed','Rescheduled'];

const db = B.config;
db.products = B.products || [];
const CAT_ORDER = ['Beds & Mats', 'Winter Jackets', 'Summer Shirts', 'Harnesses', 'Collars & Leashes', 'Shampoo & Grooming', 'Treats', 'Accessories'];
const catSort = list => [...new Set(list)].sort((a, b) => (CAT_ORDER.indexOf(a) + 1 || 99) - (CAT_ORDER.indexOf(b) + 1 || 99));
const CATS = catSort(db.products.map(p => p.cat));

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const fmtDate = s => s ? new Date(s + 'T00:00').toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'}) : '';
const addDays = (ymd, d) => { const t = new Date(ymd + 'T12:00'); t.setDate(t.getDate() + d); return t.toISOString().slice(0, 10); };
const TODAY = B.today;
function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
function toast(msg, href, label) {
  const t = $('#toast');
  t.innerHTML = esc(msg) + (href ? ` <a href="${esc(href)}" style="color:inherit;font-weight:800;margin-left:6px">${esc(label)}</a>` : '');
  t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 3200);
}
function apiUrl(path, q) {
  let u = B.rest + path;
  if (q) { const qs = new URLSearchParams(q).toString(); if (qs) u += (u.includes('?') ? '&' : '?') + qs; }
  return u;
}
async function api(path, opts = {}) {
  let r;
  try {
    const get = !opts.method || opts.method === 'GET';
    r = await fetch(apiUrl(path, get ? Object.assign({}, opts.q || {}, {_: Date.now()}) : opts.q), {
      method: opts.method || 'GET', credentials: 'same-origin', cache: 'no-store',
      headers: Object.assign({'X-WP-Nonce': B.nonce}, opts.body ? {'Content-Type': 'application/json'} : {}),
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
  } catch (e) { throw new Error('Could not reach the server. Check your internet connection and try again.'); }
  let j = null; try { j = await r.json(); } catch (e) { /* not json */ }
  if (!r.ok) {
    if (j && j.code === 'rest_cookie_invalid_nonce') throw new Error('Your session has expired. Refresh the page and try again.');
    throw new Error((j && j.message) || 'Something went wrong. Please try again.');
  }
  return j;
}

/* ---------- state ---------- */
const role = B.user ? B.user.role : null;
const S = {
  view: 'home', city: null, points: B.user ? B.user.points : 0,
  shopCat: 'All', shopPet: 'All', shopSize: 'All', shopBreed: '', shopQ: '', shopSort: 'pop', shopN: 24, banner: 0, adminTab: 'dashboard',
  deskFilter: 'upcoming', deskCity: 'all', deskQ: '', loginAs: 'customer', regMode: false,
  lastBooking: null, thanks: null
};
const savedCity = ls('wt_city');
if (savedCity === 'other' || (savedCity && db.cities.some(c => c.id === savedCity))) S.city = savedCity;
const cityObj = id => db.cities.find(c => c.id === id);
const isService = () => { const c = cityObj(S.city); return !!(c && c.service); };
const walkOn = () => { const c = cityObj(S.city); return !!(c && c.service && c.walking); };
const cityName = id => id === 'all' ? 'All cities' : ((cityObj(id) || {}).name || id || '');
const prod = id => db.products.find(p => String(p.id) === String(id));
const pkgObj = id => db.packages.find(p => p.id === id);
const pkgLabel = b => (b.custom ? b.pkgName + ' (custom)' : '') || (pkgObj(b.pkg) || {}).name || b.pkgName || b.pkg || 'Grooming';
const mrpOf = (p, city) => Number((p.mrp || {})[city]) || 0;
function priceTag(p, city) {
  const pr = Number(p.prices[city]) || 0, m = mrpOf(p, city);
  return `<b class="num">${money(pr)}</b>${m > pr ? ` <s class="num mrp">${money(m)}</s> <span class="off">${Math.round((1 - pr / m) * 100)}% off</span>` : ''}`;
}
const isSug = id => (db.suggested || []).map(Number).includes(Number(id));
const R = () => db.rewards;

/* ---------- async data cache ---------- */
const C = {};
function need(key, loader) {
  const c = C[key];
  if (c && c.data) return c.data;
  if (!c) {
    C[key] = {loading: true};
    loader().then(d => { C[key] = {data: d}; rerenderKeep(); }).catch(e => { C[key] = {error: e.message}; rerenderKeep(); });
  }
  return null;
}
function view(key, loader, fn) {
  const d = need(key, loader);
  if (d) return fn(d);
  const c = C[key];
  if (c && c.error) return `<div class="card stack"><p class="err">${esc(c.error)}</p><div><button class="btn ghost sm" data-act="retry" data-v="${esc(key)}">Try again</button></div></div>`;
  return '<div class="loading">Loading…</div>';
}
function drop(prefix) { Object.keys(C).forEach(k => { if (k === prefix || k.startsWith(prefix + ':')) delete C[k]; }); }
function findBooking(ref) {
  for (const k of Object.keys(C)) {
    const d = C[k] && C[k].data; if (!d) continue;
    for (const arr of [d.list, d.next, d.bookings]) { if (Array.isArray(arr)) { const b = arr.find(x => x && x.id === ref); if (b) return b; } }
  }
  return null;
}

/* ---------- points ---------- */
const earnFor = (amount, kind) => R().enabled ? Math.floor(amount / 100 * (kind === 'booking' ? R().bookingRate : R().orderRate)) : 0;
function redeemable(bill) {
  const r = R(); const bal = S.points;
  if (!r.enabled || role !== 'customer') return {pts: 0, amount: 0, bal, why: ''};
  if (bal < r.minRedeem) return {pts: 0, amount: 0, bal, why: `You can use points from ${r.minRedeem}. ${r.minRedeem - bal} more to go.`};
  const amount = Math.min(Math.floor(bill * r.maxPct / 100), Math.floor(bal * r.pointValue));
  return {pts: Math.ceil(amount / r.pointValue), amount, bal, why: amount ? '' : "Points can't be used on this amount."};
}
const XCP = {};
function couponDiscount(code, subtotal) {
  const up = String(code || '').toUpperCase();
  if (XCP[up] === 'checking') return {ok: false, msg: 'Checking code…'};
  const c = db.coupons.find(x => x.code.toUpperCase() === up && x.active) || (typeof XCP[up] === 'object' ? XCP[up] : null);
  if (!c) return {ok: false, msg: 'This coupon code is not valid.'};
  if (subtotal < c.min) return {ok: false, msg: `Add ${money(c.min - subtotal)} more to use ${c.code}.`};
  const d = c.type === 'pct' ? subtotal * c.value / 100 : Number(c.value);
  return {ok: true, amount: Math.min(Math.round(d), subtotal)};
}

/* ---------- shared UI ---------- */
function pimg(p) {
  return `<div class="pimg">${PAW}<span>${esc(p.cat)}</span>${p.img ? `<img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy" onerror="this.remove()">` : ''}</div>`;
}
const pill = s => { const m = {Open:'bad',Resolved:'ok',Completed:'ok',Delivered:'ok',Paid:'ok',Confirmed:'warn',New:'warn',Due:'warn',Rescheduled:'warn','Pending payment':'neu',Cancelled:'bad',Contacted:'ok',Closed:'neu',Active:'ok',Registered:'ok',Sent:'ok',Present:'ok','On duty':'warn','Missed punch-out':'bad',Read:'ok'}; return `<span class="pill ${m[s] || (String(s).startsWith('Paid') ? 'ok' : String(s).startsWith('Failed') ? 'bad' : 'neu')}">${esc(s)}</span>`; };
const delBtn = (act, id, label = 'Delete', extra = '') => `<button class="btn danger sm" data-act="${act}" data-id="${esc(id)}" ${extra} data-confirm>${label}</button>`;
function navItems() {
  const evOn = (B.events || []).length > 0;
  if (role === 'admin') return [['admin','Admin panel'],['staff','Booking desk'],...(evOn ? [['gate','Event check-in']] : []),['home','View site']];
  if (role === 'staff') return [['staff','Booking desk'],['clients','Customers'],['complaints','Complaints'],['perf','My work'],...(evOn ? [['gate','Event check-in']] : []),['home','View site']];
  const items = [['home','Home']];
  if (isService()) items.push(['book','Book Grooming']);
  if (walkOn()) items.push(['walk','Dog Walking']);
  items.push(['shop','Shop']);
  if (evOn) items.push(['events','Events']);
  items.push(['insurance','Pet Insurance'],['about','About Us'],['contact','Contact Us']);
  if (role === 'customer') items.push(['complaint','Complaints']);
  return items;
}
function header() {
  const cn = S.city === 'other' ? (ls('wt_city_other') || 'Other city') : cityName(S.city);
  const cart = B.woo ? `<a class="chip" href="${esc(B.cartUrl)}" aria-label="Cart">${BAG}<span class="badge num" id="cartcount">${B.cartCount}</span></a>` : '';
  return `<header class="top"><div class="wrap topin">
    <a class="brandmark" href="#home" aria-label="${esc(B.siteName)} home"><img src="${LOGO}" alt=""><span><b>Wag &amp; Tails</b><small>Home pet grooming</small></span></a>
    <nav class="nav" aria-label="Main">${navItems().map(([v, l]) => `<button class="${S.view === v ? 'on' : ''}" data-act="go" data-v="${v}">${l}</button>`).join('')}</nav>
    <div class="tools">
      ${S.city && role !== 'staff' ? `<button class="chip city" data-act="city" title="Change city">${PIN}${esc(cn)}</button>` : ''}
      ${dutyChip()}${cart}
      ${role === 'customer' ? `<button class="chip hide-m ${S.view === 'account' ? 'on' : ''}" data-act="go" data-v="account">My account · <span class="num">${S.points}</span> pts</button>` : ''}
      ${role ? `<button class="chip hide-m" data-act="logout">Log out</button>` : `<button class="chip hide-m" data-act="go" data-v="login">Login</button>`}
    </div></div></header>`;
}
function tabbar() {
  let items;
  if (role === 'admin' || role === 'staff') {
    items = [['staff', 'Desk', IC.desk]];
    items.push(role === 'admin' ? ['admin', 'Admin', IC.grid] : ['perf', 'My work', IC.grid]);
    items.push(['@desk-add', 'Add', IC.plus], ['home', 'Website', IC.home], ['@more', 'More', IC.more]);
  } else {
    items = [['home', 'Home', IC.home], isService() ? ['book', 'Book', IC.book] : ['insurance', 'Insurance', IC.shield], ['shop', 'Shop', BAG], role === 'customer' ? ['account', 'Account', IC.user] : ['login', 'Login', IC.user], ['@more', 'More', IC.more]];
  }
  return `<nav class="tabbar" aria-label="Quick menu">${items.map(([v, l, ic]) => v[0] === '@' ? `<button data-act="${v.slice(1)}">${ic}<span>${l}</span></button>` : `<button class="${S.view === v ? 'on' : ''}" data-act="go" data-v="${v}" ${S.view === v ? 'aria-current="page"' : ''}>${ic}<span>${l}</span></button>`).join('')}</nav>`;
}
function moreSheet() {
  const shown = role === 'admin' || role === 'staff' ? ['staff', 'admin', 'perf', 'home'] : ['home', 'book', 'insurance', 'shop', 'account', 'login'];
  const links = navItems().filter(([v]) => !shown.includes(v) || (v === 'insurance' && isService()));
  const cn = S.city === 'other' ? (ls('wt_city_other') || 'Other city') : cityName(S.city);
  openModal(`<div class="row between"><h3>Menu</h3><button class="x" data-act="close" aria-label="Close">×</button></div>
    <div class="more" style="margin-top:8px">
      ${links.map(([v, l]) => `<button data-act="go" data-v="${v}">${l}${IC.chev}</button>`).join('')}
      ${role !== 'staff' && role !== 'admin' ? `<button data-act="city">Change city <span class="muted">${esc(cn || 'Not set')}</span></button>` : ''}
      ${B.woo ? `<a href="${esc(B.cartUrl)}">Cart <span class="muted num">${B.cartCount} item${B.cartCount === 1 ? '' : 's'}</span></a>` : ''}
      ${db.settings.notifyWhatsApp ? `<a href="https://wa.me/${esc(String(db.settings.notifyWhatsApp).replace(/\D/g, ''))}" target="_blank" rel="noopener">Chat on WhatsApp${IC.chev}</a>` : ''}
      ${role ? '<button data-act="logout">Log out</button>' : '<button data-act="go" data-v="login">Login / Create account' + IC.chev + '</button>'}
    </div>`);
}
const LEGAL = [['privacy', 'Privacy policy'], ['terms', 'Terms & conditions'], ['refund', 'Returns & refunds'], ['shipping', 'Shipping policy'], ['cancel', 'Cancellation policy']].filter(([k]) => (B.legal || {})[k]);
function footer() {
  return `<footer><div class="wrap">
    <div class="stack"><img src="${LOGO}" alt="Wag & Tails logo"><p class="muted">Professional pet grooming at your doorstep since 2022. Trained groomers, sanitised kits, pet-safe products.</p></div>
    <div><h4>We groom in</h4><p class="small">${db.cities.filter(c => c.service).map(c => esc(c.name)).join(' · ')}</p></div>
    <div><h4>Explore</h4>${navItems().filter(([v]) => !['admin','staff'].includes(v)).map(([v, l]) => `<button data-act="go" data-v="${v}">${l}</button>`).join('')}${role ? '' : '<button data-act="go" data-v="login">Login · My account</button>'}</div>
    ${LEGAL.length ? `<div><h4>Policies</h4>${LEGAL.map(([k, l]) => `<a href="${esc(B.legal[k])}">${l}</a>`).join('')}</div>` : ''}
  </div></footer>`;
}
const pname = p => String(p.name).split(' | ')[0];
const SZN = {XS: 'X-Small', S: 'Small', M: 'Medium', L: 'Large', XL: 'X-Large'};
const SZO = ['XS', 'S', 'M', 'L', 'XL'];
/** Which of the product's sizes suits a pet of size sz ('' = none; 'any' = one-size product). */
function fitSize(p, sz) {
  const ss = p.sizes || [];
  if (!ss.length) return 'any';
  if (ss.includes(sz)) return sz;
  if (sz === 'XL' && ss.includes('L') && p.guide !== 'bed') return 'L';
  if (sz === 'XS' && ss.includes('S') && p.guide !== 'jacket' && p.guide !== 'shirt') return 'S';
  return '';
}
function productCard(p) {
  const off = p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0;
  const fit = S.shopSize !== 'All' && p.sizes ? fitSize(p, wantSize(p)) : '';
  const opts = p.type === 'variable';
  const sz = (p.sizes || []).length ? `<div class="szrow" aria-label="Sizes">${SZO.filter(c => p.sizes.includes(c)).map(c => `<span class="${c === fit ? 'on' : ''}">${c}</span>`).join('')}</div>` : '';
  return `<article class="prod"><button class="plink" data-act="pview" data-id="${p.id}" aria-label="View ${esc(p.name)}">${pimg(p)}</button><div class="body">
    <div class="row" style="gap:6px"><span class="tag">${esc(p.cat)}</span>${p.pet !== 'Both' ? `<span class="tag">${esc(p.pet)}</span>` : ''}</div>
    <h4><a href="${esc(p.url)}" data-act="pview" data-id="${p.id}" style="color:inherit;text-decoration:none">${esc(pname(p))}</a></h4>${sz}
    <div class="pr">${p.from ? '<span class="small muted">from</span>' : ''}<b class="num">${money(p.price)}</b>${off ? `<s class="num">${money(p.mrp)}</s><span class="small" style="color:var(--ok);font-weight:800">${off}% off</span>` : ''}</div>
    <button class="btn sm" data-act="${opts ? 'pview' : 'add'}" data-id="${p.id}" ${p.stock < 1 ? 'disabled' : ''}>${p.stock < 1 ? 'Out of stock' : opts ? (fit && fit !== 'any' ? 'Choose ' + SZN[fit] : 'Choose options') : 'Add to cart'}</button>
  </div></article>`;
}
async function addToCart(id, label) {
  const p = prod(id) || catProd(id);
  if (p && p.type === 'variable') { openProduct(id); return false; }
  return addToCartRaw(id, label);
}
async function addToCartRaw(id, label) {
  try {
    const r = await fetch(B.addToCart, {method: 'POST', credentials: 'same-origin', body: new URLSearchParams({product_id: id, quantity: 1})});
    const j = await r.json();
    if (!j || j.error) { if (j && j.product_url) location.href = j.product_url; else toast('Could not add this item. Please try again.'); return false; }
    B.cartCount++; const cc = $('#cartcount'); if (cc) cc.textContent = B.cartCount;
    toast((label ? label + ' added' : 'Added') + ' to cart.', B.cartUrl, 'View cart');
    return true;
  } catch (e) { toast('Could not add this item. Please try again.'); return false; }
}

/* ---------- store catalogue: filters by pet, breed and size ---------- */
const catData = () => (C.catalog && C.catalog.data) || null;
const catProd = id => { const d = catData(); return d ? d.products.find(p => String(p.id) === String(id)) : null; };
async function loadCatalog() {
  if (catData()) return catData();
  const d = await api('products'); C.catalog = {data: d}; return d;
}
function breedSize(d, val) {
  const [pet, ...rest] = String(val).split('|'); const name = rest.join('|');
  return {pet, name, size: ((d.breeds || {})[pet] || {})[name] || ''};
}
/** The size to look for on this product: the chosen size, or the breed's usual size (big breeds go one up for beds). */
function wantSize(p) {
  const d = catData();
  if (S.shopBreed && d) { const br = breedSize(d, S.shopBreed); if (br.size) return p.guide === 'bed' && (d.bedUp || []).includes(br.name) ? 'XL' : br.size; }
  return S.shopSize;
}
function shopList(d) {
  let list = d.products;
  if (S.shopCat !== 'All') list = list.filter(p => p.cat === S.shopCat);
  if (S.shopPet !== 'All') list = list.filter(p => !p.pets.length || p.pets.includes(S.shopPet));
  if (S.shopSize !== 'All') list = list.filter(p => { const f = fitSize(p, wantSize(p)); return f && f !== 'any'; });
  const q = S.shopQ.toLowerCase().split(/\s+/).filter(Boolean);
  if (q.length) list = list.filter(p => { const h = (p.name + ' ' + p.cat + ' ' + (p.pts || []).join(' ')).toLowerCase(); return q.every(w => h.includes(w)); });
  if (S.shopSort === 'pop') list = [...list].sort((a, b) => (b.img ? 1 : 0) - (a.img ? 1 : 0));
  if (S.shopSort === 'low') list = [...list].sort((a, b) => a.price - b.price);
  if (S.shopSort === 'high') list = [...list].sort((a, b) => b.price - a.price);
  if (S.shopSort === 'off') list = [...list].sort((a, b) => (b.mrp ? 1 - b.price / b.mrp : 0) - (a.mrp ? 1 - a.price / a.mrp : 0));
  return list;
}
function shopBody(d) {
  const cats = catSort(d.products.map(p => p.cat));
  const pool = d.products.filter(p => S.shopPet === 'All' || !p.pets.length || p.pets.includes(S.shopPet));
  const sizesHere = SZO.filter(c => pool.some(p => (p.sizes || []).includes(c)));
  const list = shopList(d), shown = list.slice(0, S.shopN);
  const br = S.shopBreed ? breedSize(d, S.shopBreed) : null;
  const breedOpts = ['Dog', 'Cat'].map(pet => `<optgroup label="${pet}s">${Object.keys((d.breeds || {})[pet] || {}).map(n => `<option value="${esc(pet + '|' + n)}" ${S.shopBreed === pet + '|' + n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</optgroup>`).join('');
  const any = S.shopCat !== 'All' || S.shopPet !== 'All' || S.shopSize !== 'All' || S.shopBreed || S.shopQ;
  return `<div class="shopbar">
      <div class="seg" role="group" aria-label="Pet">${['All', 'Dog', 'Cat'].map(c => `<button class="${S.shopPet === c ? 'on' : ''}" data-act="pet" data-v="${c}" aria-pressed="${S.shopPet === c}">${c === 'All' ? 'All pets' : c + 's'}</button>`).join('')}</div>
      <div class="field"><label for="shop-breed">Shop by breed</label><select id="shop-breed" data-chg="shop-breed"><option value="">Any breed</option>${breedOpts}</select></div>
      <div class="field"><label for="shop-q">Search</label><input id="shop-q" type="search" value="${esc(S.shopQ)}" placeholder="Bed, jacket, shampoo…" autocomplete="off"></div>
      <div class="field"><label for="shop-sort">Sort</label><select id="shop-sort" data-chg="shop-sort">${[['pop', 'Recommended'], ['low', 'Price: low to high'], ['high', 'Price: high to low'], ['off', 'Biggest discount']].map(([v, t]) => `<option value="${v}" ${S.shopSort === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    </div>
    ${br ? `<div class="breedhint">${br.size ? `Showing <b>${esc(SZN[br.size])}</b> sizes${(d.bedUp || []).includes(br.name) ? ' (X-Large for beds)' : ''}, the usual fit for a <b>${esc(br.name)}</b>. Check the size guide on each product before you buy.` : `We don't have a usual size for ${esc(br.name)}. Pick a size below, or open a product to see its size guide.`}</div>` : ''}
    <div class="filters" style="margin-top:12px"><span class="flabel">Size</span>${['All', ...sizesHere].map(c => `<button class="${S.shopSize === c ? 'on' : ''}" data-act="shop-size" data-v="${c}" aria-pressed="${S.shopSize === c}">${c === 'All' ? 'All sizes' : SZN[c]}</button>`).join('')}</div>
    <div class="filters" style="margin-top:0"><span class="flabel">Category</span>${['All', ...cats].map(c => `<button class="${S.shopCat === c ? 'on' : ''}" data-act="cat" data-v="${esc(c)}" aria-pressed="${S.shopCat === c}">${c === 'All' ? 'Everything' : esc(c)}</button>`).join('')}</div>
    <div class="row" style="justify-content:space-between;margin-bottom:12px"><p class="small muted" role="status">${list.length} product${list.length === 1 ? '' : 's'}${S.shopSize !== 'All' ? ' in ' + SZN[S.shopSize] : ''}</p>${any ? '<button class="btn ghost sm" data-act="shop-clear">Clear filters</button>' : ''}</div>
    <div class="products">${shown.length ? shown.map(productCard).join('') : `<p class="muted">${d.products.length ? 'Nothing matches these filters. Try another size or category.' : 'Products will appear here soon.'}</p>`}</div>
    ${list.length > shown.length ? `<div style="text-align:center;padding-bottom:48px"><button class="btn ghost" data-act="shop-more">Show more (${list.length - shown.length} left)</button></div>` : ''}`;
}
function pickVar(p, sel) {
  return (p.vars || []).find(v => p.opts.every(o => !sel[o.k] || v.a[o.k] === '' || v.a[o.k] === sel[o.k]) && p.opts.every(o => sel[o.k]));
}
let PV = null;
async function openProduct(id) {
  let d;
  try { d = await loadCatalog(); } catch (e) { const p = prod(id); if (p) location.href = p.url; return; }
  const p = d.products.find(x => String(x.id) === String(id));
  if (!p) { const q = prod(id); if (q) location.href = q.url; return; }
  const sel = {};
  if (p.opts) {
    const want = S.shopSize !== 'All' ? fitSize(p, wantSize(p)) : '';
    p.opts.forEach(o => {
      let v = '';
      if (o.size && want && want !== 'any') { const m = o.vals.find(x => p.vars.some(vr => vr.sz === want && vr.a[o.k] === x.v)); if (m) v = m.v; }
      if (!v && o.vals.length === 1) v = o.vals[0].v;
      if (!v && !o.size) { const m = o.vals.find(x => p.vars.some(vr => vr.stock && vr.a[o.k] === x.v)); if (m) v = m.v; }
      sel[o.k] = v;
    });
  }
  PV = {p, sel, img: 0, d};
  openModal(productModal());
  const m = $('#layer .modal'); if (m) m.classList.add('wide');
}
function productModal() {
  const {p, sel, d} = PV;
  const v = p.opts ? pickVar(p, sel) : null;
  const price = v ? v.price : p.price, mrp = v ? v.mrp : p.mrp;
  const off = mrp > price ? Math.round((1 - price / mrp) * 100) : 0;
  const imgs = [...new Set([...(v && v.img ? [v.img] : []), ...(p.imgs && p.imgs.length ? p.imgs : [p.img].filter(Boolean))])];
  const big = imgs[Math.min(PV.img, imgs.length - 1)] || '';
  const g = p.guide && d.guides ? d.guides[p.guide] : null;
  const chosenSz = v ? v.sz : '';
  const br = S.shopBreed ? breedSize(d, S.shopBreed) : null;
  const rec = br && br.size ? fitSize(p, wantSize(p)) : '';
  const missing = p.opts ? p.opts.filter(o => !sel[o.k]).map(o => o.label.toLowerCase()) : [];
  const can = p.opts ? (v && v.stock) : p.stock;
  const avail = (o, val) => p.vars.some(vr => vr.stock && vr.a[o.k] === val && p.opts.every(o2 => o2.k === o.k || !sel[o2.k] || vr.a[o2.k] === sel[o2.k]));
  return `<div class="pv">
    <div class="pv-gal"><div class="pimg">${big ? `<img src="${esc(big)}" alt="${esc(p.name)}">` : PAW}</div>
      ${imgs.length > 1 ? `<div class="pv-thumbs">${imgs.map((u, i) => `<button class="${u === big ? 'on' : ''}" data-act="pv-img" data-v="${i}" aria-label="Photo ${i + 1}"><img src="${esc(u)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}</div>
    <div class="pv-info stack">
      <div class="row" style="justify-content:space-between;align-items:start"><div class="row" style="gap:6px"><span class="tag">${esc(p.cat)}</span>${p.pets.map(x => `<span class="tag">${x}</span>`).join('')}</div><button class="btn ghost sm" data-act="close" aria-label="Close">✕</button></div>
      <h3 style="font-size:1.25rem;line-height:1.3">${esc(pname(p))}</h3>
      <div class="pr" style="display:flex;gap:10px;align-items:baseline">${p.opts && !v ? '<span class="small muted">from</span>' : ''}<b class="num" style="font-family:var(--f-display);font-size:1.6rem">${money(price)}</b>${off ? `<s class="num muted">${money(mrp)}</s><span class="small" style="color:var(--ok);font-weight:800">${off}% off</span>` : ''}</div>
      ${(p.opts || []).map(o => `<div><p class="small" style="font-weight:800;margin-bottom:6px">${esc(o.label)}${sel[o.k] ? ': <span class="muted" style="font-weight:600">' + esc((o.vals.find(x => x.v === sel[o.k]) || {}).t || '') + '</span>' : ''}</p>
        <div class="optrow">${o.vals.map(x => { const ok = avail(o, x.v); const isRec = o.size && rec && rec !== 'any' && p.vars.some(vr => vr.sz === rec && vr.a[o.k] === x.v); return `<button class="${sel[o.k] === x.v ? 'on' : ''} ${ok ? '' : 'na'}" data-act="pv-opt" data-k="${esc(o.k)}" data-v="${esc(x.v)}" aria-pressed="${sel[o.k] === x.v}" ${ok ? '' : 'title="Out of stock"'}>${esc(x.t)}${isRec ? ' <small>fits ' + esc(br.name.split(' ')[0]) + '</small>' : ''}</button>`; }).join('')}</div></div>`).join('')}
      <div class="row"><button class="btn" data-act="pv-add" ${can ? '' : 'disabled'}>${can ? 'Add to cart' : missing.length ? 'Choose ' + missing.join(' and ') : 'Out of stock'}</button><a class="btn ghost" href="${esc(p.url)}">Full details</a></div>
      ${p.lead ? `<p class="muted">${esc(p.lead)}</p>` : ''}
      ${p.pts && p.pts.length ? `<ul class="pv-pts">${p.pts.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${g ? `<details class="pv-guide" ${p.opts && p.opts.some(o => o.size) ? 'open' : ''}><summary>Size guide</summary><p class="small muted">${esc(g.how)}</p>
        <table class="tbl"><tbody>${SZO.filter(c => g.rows[c] && (!p.sizes.length || p.sizes.includes(c))).map(c => `<tr class="${c === chosenSz ? 'on' : ''}"><th>${SZN[c]}</th><td class="small">${esc(g.rows[c])}</td></tr>`).join('')}</tbody></table></details>` : ''}
      <p class="small muted">Ships across India. Unused items in original packing can be returned within 3 days of delivery; courier charges are paid by the customer.${(B.legal || {}).refund ? ` <a href="${esc(B.legal.refund)}">Return policy</a>` : ''}</p>
    </div></div>`;
}
function pvRedraw() { const m = $('#layer .modal'); if (m && PV) m.innerHTML = productModal(); }

/* ---------- customer pages ---------- */
function pageHome() {
  const svc = isService(), cn = cityName(S.city);
  const pk = db.packages.slice(0, 4);
  const hero = svc ? `
    <div><p class="eyebrow">Home grooming in ${esc(cn)}</p>
      <h1 style="margin-top:10px">A full salon groom, without leaving your living room.</h1>
      <p class="lead">Our groomer arrives with a sanitised kit, pet-safe products and a calm pair of hands. Bath, haircut, nails, ears and a happy pet in about 90 minutes.</p>
      <div class="row" style="margin-top:22px"><button class="btn honey" data-act="go" data-v="book">Book a groomer</button><button class="btn ghost" data-act="go" data-v="shop">Visit the store</button></div></div>
    <div class="hero-card"><p class="eyebrow" style="color:#7A3A12">Packages in ${esc(cn)}</p>
      ${pk.map(p => `<button class="pk" data-act="pick-pkg" data-id="${esc(p.id)}" aria-label="Book ${esc(p.name)}"><span><b>${esc(p.name)}</b><br><span class="small" style="color:#76624F">${esc(p.duration)} · ${p.pet === 'Both' ? 'Dogs & cats' : esc(p.pet) + 's'}</span></span><span style="text-align:right">${priceTag(p, S.city)}<br><span class="small go">Book →</span></span></button>`).join('')}
    </div>` : `
    <div><p class="eyebrow">Wag &amp; Tails pet store</p>
      <h1 style="margin-top:10px">Beds, jackets, food and shampoo, delivered across India.</h1>
      <p class="lead">Home grooming isn't in your city yet, but our store ships everywhere. You can also ask us about pet insurance.</p>
      <div class="row" style="margin-top:22px"><button class="btn honey" data-act="go" data-v="shop">Shop now</button><button class="btn ghost" data-act="go" data-v="insurance">Pet insurance</button></div></div>
    <div class="hero-card"><p class="eyebrow" style="color:#7A3A12">Shop by category</p>
      ${CATS.map(c => `<button class="pk" data-act="cat" data-v="${esc(c)}"><span><b>${esc(c)}</b></span><span class="small" style="color:#76624F">${db.products.filter(p => p.cat === c).length} items</span></button>`).join('') || '<p class="small" style="color:#76624F">Products coming soon.</p>'}</div>`;
  const feat = db.products.slice(0, 4);
  return `<section class="hero">${PAW.replace('<svg', '<svg class="hero-paw"')}<div class="wrap">${hero}</div></section>
  ${svc ? `<section class="block"><div class="wrap">
    <div class="sechead"><div><p class="eyebrow">How it works</p><h2>Booked in two minutes</h2></div></div>
    <div class="steps">
      <div class="step"><div class="n">1</div><h3>Pick a package</h3><p class="muted">Prices are set for ${esc(cn)}. Tell us about your pet so we send the right groomer.</p></div>
      <div class="step"><div class="n">2</div><h3>Pin your home</h3><p class="muted">Drop a pin on the map or use your current location, then choose a date and time slot.</p></div>
      <div class="step"><div class="n">3</div><h3>Pay your way</h3><p class="muted">Pay online with Razorpay, or pay after the service. Confirmation arrives on email and WhatsApp.</p></div>
    </div></div></section>` : ''}
  ${feat.length ? `<section class="block" style="padding-top:${svc ? 0 : 48}px"><div class="wrap">
    <div class="sechead"><div><p class="eyebrow">From the store</p><h2>Picked by our groomers</h2></div><button class="btn ghost" data-act="go" data-v="shop">See all products</button></div>
    <div class="products" style="padding-bottom:0">${feat.map(productCard).join('')}</div>
  </div></section>` : ''}
  <section class="block"><div class="wrap"><div class="band">
    <div style="max-width:560px"><p class="eyebrow">Pet insurance</p><h2 style="margin-top:6px">Vet bills, covered</h2><p class="muted" style="margin-top:8px">Fill a short form and our partner advisor will explain plans that fit your pet's age and breed.</p></div>
    <button class="btn" data-act="go" data-v="insurance">Know more about insurance</button></div>
    <div style="margin-top:28px"><p class="eyebrow" style="margin-bottom:10px">Home grooming cities</p><div class="citylist">${db.cities.filter(c => c.service).map(c => `<span>${esc(c.name)}</span>`).join('')}</div></div>
  </div></section>`;
}

function pageShop() {
  const banners = db.banners || [];
  const b = banners.length ? banners[S.banner % banners.length] : null;
  return `<div class="wrap">
    ${b ? `<div class="banner" id="banner"><div class="bg" style="background-color:${esc(b.color || '#4B1D00')};${b.img ? `background-image:url('${esc(b.img)}')` : ''}"></div>
      <div class="txt"><p class="eyebrow" style="color:var(--honey)">Wag &amp; Tails store</p><h2>${esc(b.title)}</h2><p style="color:#F1DDCB">${esc(b.sub)}</p>
      ${b.cta ? `<div><button class="btn honey sm" data-act="cat" data-v="${esc(b.cta)}">Shop ${esc(b.cta)}</button></div>` : ''}</div>
      ${banners.length > 1 ? `<div class="dots">${banners.map((_, i) => `<button class="${i === S.banner % banners.length ? 'on' : ''}" data-act="banner" data-i="${i}" aria-label="Banner ${i + 1}"></button>`).join('')}</div>` : ''}</div>` : ''}
    ${view('catalog', () => api('products'), shopBody)}
  </div>`;
}

/* ----- booking (3 steps: package → date & time → details & payment) ----- */
let BK = null, MAP = null, MARK = null;
const SLOTC = {};
const STEPS = ['Package', 'Date & time', 'Details & payment'];
function newDraft() {
  const u = role === 'customer' ? B.user : {}, pr = (role === 'customer' && B.user.profile) || {}, pet = (pr.pets || [])[0] || {};
  return {step: 1, city: S.city, pkg: '', name: pr.name || u.name || '', email: pr.email || u.email || '', phone: u.phone || '', address: pr.address || '', pincode: pr.pincode || '', petType: pet.type || 'Dog', breed: pet.breed || '', gender: pet.gender || '', age: String(pet.age || '').replace(/\D+$/, '').trim(), ageUnit: 'years', aggression: '', lat: null, lng: null, date: '', start: '', slotLabel: '', addons: [], coupon: '', pay: db.settings.razorpayOn ? 'online' : 'later', usePts: false};
}
const pkgsFor = b => db.packages.filter(p => p.pet === 'Both' || p.pet === b.petType);
function bookTotals(b) {
  const p = pkgObj(b.pkg);
  const base = p ? (Number(p.prices[b.city]) || 0) : 0;
  const add = b.addons.reduce((a, id) => a + ((prod(id) || {}).price || 0), 0);
  const subtotal = base + add;
  let discount = 0, cmsg = '';
  if (b.coupon) { const r = couponDiscount(b.coupon, subtotal); if (r.ok) discount = r.amount; else cmsg = r.msg; }
  const after = subtotal - discount;
  const rd = redeemable(after);
  const ptsAmt = b.usePts && rd.amount > 0 ? rd.amount : 0;
  return {base, subtotal, discount, ptsAmt, ptsUsed: ptsAmt ? rd.pts : 0, rd, total: after - ptsAmt, cmsg};
}
function pointsBox(t) {
  if (!R().enabled) return '';
  const earn = `<span class="small muted">You'll earn <b class="num">${earnFor(t.total, 'booking')}</b> points after the service.</span>`;
  if (role !== 'customer') return `<div class="ptsbox">${earn}<span class="small"><button type="button" class="linkbtn" data-act="go" data-v="login">Log in</button> to collect and use reward points.</span></div>`;
  const rd = t.rd;
  return `<div class="ptsbox"><div class="row between"><b>Reward points</b><span class="small num">Balance ${rd.bal}</span></div>
    ${rd.amount > 0 ? `<label class="row" style="font-weight:700;flex-wrap:nowrap"><input type="checkbox" data-bk="usePts" ${BK.usePts ? 'checked' : ''}> Use ${rd.pts} points to save ${money(rd.amount)}</label>` : `<span class="small muted">${esc(rd.why)}</span>`}${earn}</div>`;
}
function stepper() {
  return `<ol class="stepper">${STEPS.map((l, i) => { const n = i + 1, st = n < BK.step ? 'done' : n === BK.step ? 'on' : ''; return `<li class="${st}">${n < BK.step ? `<button type="button" data-act="bk-step" data-v="${n}"><span class="dot">✓</span>${l}</button>` : `<span><span class="dot">${n}</span>${l}</span>`}</li>`; }).join('')}</ol>`;
}
function pageBook() {
  if (!BK || BK.city !== S.city) BK = newDraft();
  const b = BK;
  return `<div class="wrap"><div class="pagehead"><p class="eyebrow">Home grooming · ${esc(cityName(b.city))}</p><h1>Book a groomer</h1></div>
  ${stepper()}
  <form class="bookgrid" data-form="book" novalidate>
    <input class="hp" type="text" name="website" id="bk-website" tabindex="-1" autocomplete="off" aria-hidden="true">
    <div class="card" id="bk-main">${stepBody()}</div>
    <aside class="card summary" id="bk-summary">${bookSummary()}</aside>
    <div class="mbar" id="bk-mbar">${mbarHtml()}</div>
  </form></div>`;
}
function stepBody() {
  const b = BK, opt = (arr, v) => arr.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('');
  if (b.step === 1) return `<div class="stack">
      <div class="field" style="max-width:320px"><label for="bk-city">City</label>
        <select id="bk-city" data-bk="city">${db.cities.filter(c => c.service).map(c => `<option value="${esc(c.id)}" ${c.id === b.city ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Your pet</label><div class="seg">${['Dog','Cat'].map(t => `<label><input type="radio" name="petType" value="${t}" data-bk="petType" ${b.petType === t ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div></div>
      <div class="field"><label>Choose a package</label><div class="pkgs" id="bk-pkgs">${pkgCards()}</div></div>
      <div class="err" id="bk-step-err" role="alert"></div>
      <div class="stepnav"><span></span><button class="btn" type="submit">Next: choose date &amp; time</button></div></div>`;
  if (b.step === 2) {
    const days = [...Array(14)].map((_, i) => addDays(TODAY, i));
    return `<div class="stack">
      <div class="field"><label>Date</label><div class="days">${days.map(d => { const dt = new Date(d + 'T12:00'); return `<button type="button" class="day ${b.date === d ? 'on' : ''} ${dayFull(b.city, d) ? 'full' : ''}" data-act="bk-date" data-v="${d}"><small>${d === TODAY ? 'Today' : dt.toLocaleDateString('en-IN', {weekday: 'short'})}</small><b>${dt.getDate()}</b><small>${dayFull(b.city, d) ? 'Booked' : dt.toLocaleDateString('en-IN', {month: 'short'})}</small></button>`; }).join('')}</div>
        <label class="small muted" for="bk-date" style="font-weight:600">Or pick another date</label><input id="bk-date" type="date" min="${TODAY}" max="${addDays(TODAY, Number(db.settings.maxDaysAhead) || 45)}" value="${esc(b.date)}" data-bk="date" style="max-width:220px"></div>
      <div class="field"><label>Time <span class="small muted">· ${esc(pkgLabel(b))} takes about ${esc((pkgObj(b.pkg) || {}).duration || '1 hour')}</span></label><div id="bk-slots">${slotGrid()}</div></div>
      <div class="err" id="bk-step-err" role="alert"></div>
      <div class="stepnav"><button type="button" class="btn ghost" data-act="bk-step" data-v="1">Back</button><button class="btn" type="submit">Next: your details</button></div></div>`;
  }
  return `<div class="stack" style="gap:0">
      <div class="formsec"><h3>About your pet</h3>
        <div class="f2">
          <div class="field"><label for="bk-breed">Breed <span class="req">*</span></label><select id="bk-breed" data-bk="breed"><option value="">Select breed</option>${opt(db.breeds[b.petType] || [], b.breed)}</select></div>
          <div class="field"><label>Gender <span class="req">*</span></label><div class="seg">${['Male','Female'].map(g => `<label><input type="radio" name="gender" value="${g}" data-bk="gender" ${b.gender === g ? 'checked' : ''}><span>${g}</span></label>`).join('')}</div></div>
          <div class="field"><label for="bk-age">Age <span class="req">*</span></label><div class="row" style="flex-wrap:nowrap"><input id="bk-age" type="number" min="0" max="30" value="${esc(b.age)}" data-bk="age" placeholder="e.g. 3"><select id="bk-ageunit" data-bk="ageUnit" style="width:120px">${['years','months'].map(u => `<option ${b.ageUnit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div></div>
          <div class="field"><label for="bk-agg">Aggression level <span class="req">*</span></label><select id="bk-agg" data-bk="aggression"><option value="">Select</option>${opt(AGGRESSION, b.aggression)}</select></div>
        </div></div>
      <div class="formsec"><h3>Your details</h3>
        <div class="f2">
          <div class="field"><label for="bk-name">Full name <span class="req">*</span></label><input id="bk-name" type="text" value="${esc(b.name)}" data-bk="name" autocomplete="name"></div>
          <div class="field"><label for="bk-phone">Phone (WhatsApp) <span class="req">*</span></label><input id="bk-phone" type="tel" value="${esc(b.phone)}" data-bk="phone" placeholder="10-digit mobile" autocomplete="tel"></div>
          <div class="field"><label for="bk-email">Email <span class="req">*</span></label><input id="bk-email" type="email" value="${esc(b.email)}" data-bk="email" autocomplete="email"></div>
          <div class="field"><label for="bk-pin">Pincode <span class="req">*</span></label><input id="bk-pin" type="text" inputmode="numeric" maxlength="6" value="${esc(b.pincode)}" data-bk="pincode" autocomplete="postal-code"></div>
        </div>
        <div class="field"><label for="bk-addr">Full address <span class="req">*</span></label><textarea id="bk-addr" data-bk="address" placeholder="Flat / house no., building, street, landmark" autocomplete="street-address">${esc(b.address)}</textarea></div>
      </div>
      <div class="formsec"><h3>Pin your location <small>helps the groomer find you</small></h3>
        <div class="row"><button type="button" class="btn ghost sm" data-act="locate">${PIN} Use my current location</button><span class="small muted" id="bk-loc">${b.lat ? `Pinned at ${b.lat.toFixed(5)}, ${b.lng.toFixed(5)}` : 'Tap the map to drop a pin.'}</span></div>
        <div id="map" role="application" aria-label="Map: tap to set your location"></div>
        <p class="small muted">Map data © OpenStreetMap contributors.</p>
      </div>
      <div class="stepnav"><button type="button" class="btn ghost" data-act="bk-step" data-v="2">Back</button><span></span></div>
    </div>`;
}
const dayFull = (city, d) => ((B.blockedDays || {})[city] || []).includes(d);
const slotKey = (city, date, pkg) => `${city}|${date}|${pkg}`;
function slotGrid() {
  const b = BK;
  if (!b.date) return '<p class="muted small">Choose a date to see available times.</p>';
  const k = slotKey(b.city, b.date, b.pkg);
  if (SLOTC[k] && SLOTC[k].at && Date.now() - SLOTC[k].at > 60000) delete SLOTC[k];
  const c = SLOTC[k];
  if (!c) { loadSlots(k, {city: b.city, date: b.date, pkg: b.pkg}).then(() => { const el = $('#bk-slots'); if (el && BK && slotKey(BK.city, BK.date, BK.pkg) === k) el.innerHTML = slotGrid(); }); return '<p class="loading">Checking available times…</p>'; }
  if (c.loading) return '<p class="loading">Checking available times…</p>';
  if (c.error) return `<p class="err">${esc(c.error)}</p>`;
  if (!c.list.length) return `<p class="muted">No times left on ${fmtDate(b.date)}. Please choose another date.</p>`;
  if (!c.list.some(s => s.free)) return `<p class="muted">${fmtDate(b.date)} is fully booked. Please choose another date.</p>` + slotButtons(c.list);
  return slotButtons(c.list);
}
function slotButtons(list) {
  return `<div class="slotgrid">${list.map(s => s.free
    ? `<label class="slot"><input type="radio" name="start" value="${esc(s.start)}" data-bk="start" data-label="${esc(s.label)}" ${BK.start === s.start ? 'checked' : ''}><span class="num">${esc(s.label)}</span></label>`
    : `<span class="slot booked" aria-disabled="true"><span class="num">${esc(s.label)}</span><small>Booked</small></span>`).join('')}</div>`;
}
async function loadSlots(k, q) {
  SLOTC[k] = {loading: true};
  try { const r = await api('slots', {q}); SLOTC[k] = {list: r.slots || [], at: Date.now()}; }
  catch (e) { SLOTC[k] = {error: e.message}; }
  return SLOTC[k];
}
function pkgCards() {
  const b = BK;
  return pkgsFor(b).map(p => `<label class="pkg"><input type="radio" name="pkg" value="${esc(p.id)}" data-bk="pkg" ${b.pkg === p.id ? 'checked' : ''}><div class="in">
    <div class="row between"><b>${esc(p.name)}</b><span class="tag">${esc(p.duration)}</span></div>
    <div class="price">${priceTag(p, b.city)}</div><ul>${(p.items || []).map(i => `<li>${esc(i)}</li>`).join('')}</ul></div></label>`).join('') || '<p class="muted">No packages for this pet type yet.</p>';
}
function bookSummary() {
  const b = BK, t = bookTotals(b), p = pkgObj(b.pkg);
  const sug = db.products.filter(x => isSug(x.id) && x.stock > 0 && x.type === 'simple');
  const tk = it => `<div class="tk">${pimg(it)}<span>${esc(it.name.length > 26 ? it.name.slice(0, 25) + '…' : it.name)} · <b class="num">${money(it.price)}</b></span><button type="button" class="${b.addons.includes(it.id) ? 'added' : ''}" data-act="addon" data-id="${it.id}">${b.addons.includes(it.id) ? 'Added' : '+ Add'}</button></div>`;
  const online = db.settings.razorpayOn, last = b.step === 3;
  const listed = db.coupons.filter(c => c.active && (c.visibility || 'listed') === 'listed');
  return `<h3>Your booking</h3>
    <p class="small muted" style="margin-top:4px">${esc(cityName(b.city))}${b.date ? ' · ' + fmtDate(b.date) : ''}${b.slotLabel ? ' · ' + esc(b.slotLabel) : ''}</p>
    <div style="margin-top:12px">
      <div class="sumline"><span>${p ? esc(p.name) : '<span class="muted">Choose a package</span>'}</span><span class="num">${p && mrpOf(p, b.city) > t.base ? `<s class="mrp">${money(mrpOf(p, b.city))}</s> ` : ''}${money(t.base)}</span></div>
      ${b.addons.map(id => { const x = prod(id); return x ? `<div class="sumline small"><span>${esc(x.name)} <button type="button" class="linkbtn small" data-act="addon" data-id="${x.id}">remove</button></span><span class="num">${money(x.price)}</span></div>` : ''; }).join('')}
      ${t.discount ? `<div class="sumline" style="color:var(--ok)"><span>Coupon ${esc(b.coupon.toUpperCase())}</span><span class="num">−${money(t.discount)}</span></div>` : ''}
      ${t.ptsAmt ? `<div class="sumline" style="color:var(--ok)"><span>Reward points (${t.ptsUsed})</span><span class="num">−${money(t.ptsAmt)}</span></div>` : ''}
      <div class="sumline total"><span>Total</span><span class="num">${money(t.total)}</span></div>
      ${p && mrpOf(p, b.city) > t.total ? `<p class="small" style="color:var(--ok);margin:0;font-weight:700">You save ${money(mrpOf(p, b.city) - t.total + (t.subtotal - t.base))} on MRP</p>` : ''}
    </div>
    ${sug.length && b.pkg ? `<p class="eyebrow" style="margin-top:14px;margin-bottom:6px">Add to your visit</p>
      <div class="ticker" tabindex="0" aria-label="Suggested products"><div class="track"${sug.length < 3 ? ' style="animation:none"' : ''}>${sug.map(tk).join('')}${sug.length < 3 ? '' : sug.map(tk).join('').replace(/data-act="addon"/g, 'data-act="addon" tabindex="-1"')}</div></div>
      <p class="small muted" style="margin-top:4px">Your groomer brings these along.</p>` : ''}
    ${last ? `<div class="field" style="margin-top:14px"><label for="bk-coupon">Coupon code</label>
      <div class="row" style="flex-wrap:nowrap"><input id="bk-coupon" type="text" value="${esc(b.coupon)}" placeholder="Enter code" style="text-transform:uppercase"><button type="button" class="btn ghost sm" data-act="bk-coupon">Apply</button></div>
      ${t.cmsg ? `<span class="err">${esc(t.cmsg)}</span>` : ''}
      ${listed.length ? `<div class="coupons">${listed.map(c => `<button type="button" class="coupon ${b.coupon.toUpperCase() === c.code ? 'on' : ''}" data-act="bk-pick" data-v="${esc(c.code)}">${esc(c.code)}<small>${esc(c.desc)}</small></button>`).join('')}</div>` : ''}</div>
    ${pointsBox(t)}
    <div class="field" style="margin-top:14px"><label>Payment</label>
      <div class="seg">${online ? `<label><input type="radio" name="pay" value="online" data-bk="pay" ${b.pay === 'online' ? 'checked' : ''}><span>Pay now (Razorpay)</span></label>` : ''}<label><input type="radio" name="pay" value="later" data-bk="pay" ${b.pay === 'later' || !online ? 'checked' : ''}><span>Pay after service</span></label></div></div>
    <div id="bk-err" class="err" role="alert" style="margin-top:10px"></div>
    <button class="btn" type="submit" id="bk-submit" style="width:100%;margin-top:12px">${b.pay === 'online' && online ? 'Pay ' + money(t.total) + ' & confirm' : 'Confirm booking'}</button>
    <p class="small muted" style="margin-top:8px;text-align:center">Confirmation is sent on email and WhatsApp.</p>` : ''}`;
}
function mbarHtml() {
  const t = bookTotals(BK), online = db.settings.razorpayOn && BK.pay === 'online';
  const label = BK.step === 1 ? 'Next' : BK.step === 2 ? 'Next' : (online ? 'Pay & confirm' : 'Confirm booking');
  return `<div><span class="small muted">Total${BK.pkg ? '' : ' · choose a package'}</span><b class="num">${money(t.total)}</b></div><button class="btn" type="submit">${label}</button>`;
}
function refreshSummary() { const el = $('#bk-summary'); if (el) el.innerHTML = bookSummary(); const m = $('#bk-mbar'); if (m) m.innerHTML = mbarHtml(); }
function goStep(n) {
  BK.step = n;
  if (MAP) { MAP.remove(); MAP = null; MARK = null; }
  const main = $('#bk-main'); if (!main) { render(); return; }
  main.innerHTML = stepBody(); refreshSummary();
  const st = document.querySelector('.stepper'); if (st) st.outerHTML = stepper();
  if (n === 3) initMap();
  const top = document.querySelector('.stepper'); if (top) window.scrollTo({top: Math.max(0, top.getBoundingClientRect().top + window.scrollY - 90), behavior: 'smooth'});
}
function stepError(msg) { const e = $('#bk-step-err'); if (e) e.textContent = msg; toast(msg); }
function nextStep() {
  const b = BK;
  if (b.step === 1) { if (!b.pkg) return stepError('Choose a grooming package.'); goStep(2); return; }
  if (b.step === 2) { if (!b.date) return stepError('Choose a date.'); if (!b.start) return stepError('Choose a time.'); goStep(3); return; }
  submitBooking();
}
function initMap() {
  const el = $('#map'); if (!el) return;
  if (!window.L) { el.innerHTML = '<p class="muted small" style="padding:16px">The map could not load. Tap "Use my current location" instead.</p>'; return; }
  const c = COORDS[BK.city] || [22.5, 79];
  MAP = L.map(el, {zoomControl: true, attributionControl: false}).setView(BK.lat ? [BK.lat, BK.lng] : c, BK.lat ? 16 : 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19}).addTo(MAP);
  if (BK.lat) setPin(BK.lat, BK.lng, false);
  MAP.on('click', e => setPin(e.latlng.lat, e.latlng.lng, false));
}
function setPin(lat, lng, pan) {
  BK.lat = lat; BK.lng = lng;
  if (MAP) {
    if (MARK) MARK.setLatLng([lat, lng]); else MARK = L.circleMarker([lat, lng], {radius: 10, color: '#FFFFFF', weight: 3, fillColor: '#4B1D00', fillOpacity: 1}).addTo(MAP);
    if (pan) MAP.setView([lat, lng], 16);
  }
  const l = $('#bk-loc'); if (l) l.innerHTML = `Pinned at ${lat.toFixed(5)}, ${lng.toFixed(5)} · <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener">check on Google Maps</a>`;
}
function validateBooking(b) {
  const t = bookTotals(b);
  if (!b.pkg) return 'Choose a grooming package.';
  if (!b.date || !b.start) return 'Choose a date and time.';
  if (!b.breed) return "Select your pet's breed.";
  if (!b.gender) return "Select your pet's gender.";
  if (b.age === '') return "Enter your pet's age.";
  if (!b.aggression) return 'Select the aggression level so we can send the right groomer.';
  if (b.name.trim().length < 2) return 'Enter your full name.';
  if (!/^[6-9]\d{9}$/.test(b.phone.replace(/\D/g, '').slice(-10))) return 'Enter a valid 10-digit mobile number.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email)) return 'Enter a valid email address.';
  if (!/^\d{6}$/.test(b.pincode)) return 'Pincode must be 6 digits.';
  if (b.address.trim().length < 8) return 'Enter your full address.';
  if (b.lat == null) return 'Pin your location on the map, or tap "Use my current location".';
  if (b.coupon && t.cmsg) return t.cmsg;
  return '';
}
function loadRazorpay() {
  return new Promise(res => {
    if (window.Razorpay) return res(true);
    const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => res(true); s.onerror = () => res(false); document.head.appendChild(s);
  });
}
async function payWithRazorpay(o) {
  if (!await loadRazorpay()) throw new Error('Could not open Razorpay. Check your connection, or choose Pay after service.');
  return new Promise(resolve => {
    const rz = new window.Razorpay({
      key: o.key, order_id: o.order_id, amount: o.amount, currency: 'INR', name: 'Wag & Tails', description: 'Home grooming booking', image: LOGO,
      prefill: {name: o.name, email: o.email, contact: o.contact}, theme: {color: '#4B1D00'},
      handler: r => resolve(r), modal: {ondismiss: () => resolve(null)}
    });
    rz.open();
  });
}
async function submitBooking() {
  const b = BK, out = $('#bk-err'), btn = $('#bk-submit');
  const err = validateBooking(b);
  if (err) { out.textContent = err; toast(err); return; }
  out.textContent = ''; btn.disabled = true; const label = btn.textContent; btn.textContent = 'Please wait…';
  try {
    const payload = Object.assign({}, b, {website: ($('#bk-website') || {}).value || ''});
    const res = await api('bookings', {method: 'POST', body: payload});
    let booking = res.booking;
    if (res.rzp) {
      const r = await payWithRazorpay(res.rzp);
      if (!r) { out.textContent = 'Payment was not completed. You can try again, or choose Pay after service.'; toast(out.textContent); return; }
      btn.textContent = 'Confirming payment…';
      booking = (await api('bookings/verify', {method: 'POST', body: Object.assign({ref: res.ref}, r)})).booking;
    }
    if (booking.pointsUsed) S.points = Math.max(0, S.points - booking.pointsUsed);
    drop('me');
    Object.keys(SLOTC).forEach(k => delete SLOTC[k]);
    S.lastBooking = booking; BK = null; go('booked');
  } catch (e) {
    out.textContent = e.message; toast(e.message);
    if (/just booked|available time/i.test(e.message)) { Object.keys(SLOTC).forEach(k => delete SLOTC[k]); BK.start = ''; BK.slotLabel = ''; goStep(2); }
  }
  finally { if (btn.isConnected) { btn.disabled = false; btn.textContent = label; } }
}
function pageBooked() {
  const b = S.lastBooking; if (!b) return pageHome();
  const p = pkgObj(b.pkg);
  const wa = db.settings.notifyWhatsApp ? `https://wa.me/${String(db.settings.notifyWhatsApp).replace(/\D/g, '')}?text=${encodeURIComponent('Hi Wag & Tails, my booking ID is ' + b.id)}` : '';
  const earn = earnFor(b.total, 'booking');
  return `<div class="wrap" style="padding-block:40px 56px;max-width:760px"><div class="okbox stack">
    <p class="eyebrow" style="color:var(--ok)">Booking confirmed</p><h1>See you on ${fmtDate(b.date)}, ${esc(b.name.split(' ')[0])}!</h1>
    <p>Booking ID <b class="num">${esc(b.id)}</b>. We've sent the details to <b>${esc(b.email)}</b> and on WhatsApp to <b class="num">${esc(b.phone)}</b>.</p>
    ${R().enabled && earn ? `<p class="small">You'll earn <b class="num">${earn}</b> reward points once the groom is done.${role === 'customer' ? '' : ' <button class="linkbtn" data-act="go" data-v="login">Create an account</button> with this mobile number to use them.'}</p>` : ''}
  </div><div class="card stack" style="margin-top:16px">
    <div class="sumline"><span>Package</span><b>${esc(pkgLabel(b))}</b></div>
    <div class="sumline"><span>Pet</span><b>${esc(b.petType)} · ${esc(b.breed)} · ${esc(b.gender)}</b></div>
    <div class="sumline"><span>When</span><b>${fmtDate(b.date)}, ${esc(b.slot)}</b></div>
    <div class="sumline"><span>Where</span><b style="text-align:right">${esc(b.address)}, ${esc(cityName(b.city))} ${esc(b.pincode)}</b></div>
    <div class="sumline"><span>Payment</span><b>${b.payStatus === 'Paid' ? 'Paid online' : 'Pay after service'}</b></div>
    <div class="sumline total"><span>Total</span><span class="num">${money(b.total)}</span></div>
    <div class="row">${wa ? `<a class="btn" href="${esc(wa)}" target="_blank" rel="noopener">Message us on WhatsApp</a>` : ''}<button class="btn ghost" data-act="go" data-v="shop">Browse the store</button></div>
  </div>
  <div class="card stack" style="margin-top:16px"><h3>Happy-groom promise</h3><p class="muted">Not happy with anything? Within <b>24 hours</b> of the groom, log in here with your mobile number and raise a complaint. We'll send the groomer back for a <b>free redo</b>.</p>
    <div><button class="btn ghost sm" data-act="go" data-v="${role === 'customer' ? 'complaint' : 'login'}">${role === 'customer' ? 'Raise a complaint' : 'Log in with your number'}</button></div></div>
  <div class="card stack" style="margin-top:16px;background:var(--tint)"><h3>More for your pet</h3><p class="muted">We also help you choose the right <b>pet insurance</b> for vet bills, and our store has beds, jackets, shampoos, treats and more.</p>
    <div class="row"><button class="btn ghost sm" data-act="go" data-v="insurance">Pet insurance</button><button class="btn ghost sm" data-act="go" data-v="shop">Pet products</button></div></div></div>`;
}

/* ----- walking, insurance, about, contact ----- */
function pageWalk() {
  if (!walkOn()) return pageHome();
  return `<div class="wrap" style="padding-bottom:48px"><div class="pagehead"><p class="eyebrow">Dog walking · ${esc(cityName(S.city))}</p><h1>Daily walks with a trained walker</h1><p class="muted">GPS-tracked walks, water breaks and a photo update after every walk. Tell us what you need and we'll confirm a walker within a day.</p></div>
  <form class="card stack" data-form="walk" style="max-width:820px;margin-top:16px" novalidate>
    <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
    <div class="f2">
      <div class="field"><label for="w-name">Your name <span class="req">*</span></label><input id="w-name" name="name" type="text" value="${esc(role === 'customer' ? B.user.name : '')}"></div>
      <div class="field"><label for="w-phone">Phone (WhatsApp) <span class="req">*</span></label><input id="w-phone" name="phone" type="tel" value="${esc(role === 'customer' ? B.user.phone : '')}"></div>
      <div class="field"><label for="w-email">Email <span class="req">*</span></label><input id="w-email" name="email" type="email" value="${esc(role === 'customer' ? B.user.email : '')}"></div>
      <div class="field"><label for="w-pin">Pincode <span class="req">*</span></label><input id="w-pin" name="pincode" type="text" inputmode="numeric" maxlength="6"></div>
      <div class="field"><label for="w-dog">Dog's name &amp; breed <span class="req">*</span></label><input id="w-dog" name="dog" type="text"></div>
      <div class="field"><label for="w-plan">Walk plan <span class="req">*</span></label><select id="w-plan" name="plan">${db.walkPlans.map(p => `<option value="${esc(p.id)}">${esc(p.name)} · ${money(p.price)} per walk</option>`).join('')}</select></div>
      <div class="field"><label for="w-freq">How often</label><select id="w-freq" name="freq"><option>One-time walk</option><option>Daily for 1 week</option><option>Daily for 1 month</option><option>Twice daily for 1 month</option></select></div>
      <div class="field"><label for="w-start">Start date <span class="req">*</span></label><input id="w-start" name="start" type="date" min="${addDays(TODAY, 1)}"></div>
      <div class="field"><label for="w-time">Preferred time</label><select id="w-time" name="time"><option>Morning (6–9 AM)</option><option>Evening (5–8 PM)</option><option>Both</option></select></div>
    </div>
    <div class="field"><label for="w-addr">Address <span class="req">*</span></label><textarea id="w-addr" name="address"></textarea></div>
    <div class="err" id="w-err" role="alert"></div>
    <div><button class="btn" type="submit">Request a walker</button></div>
  </form></div>`;
}
function insFieldHtml(f) {
  const id = 'ins-' + f.id, req = f.required ? ' <span class="req">*</span>' : '';
  const opts = String(f.options || '').split(',').map(s => s.trim()).filter(Boolean);
  let input;
  if (f.type === 'textarea') input = `<textarea id="${id}" name="${esc(f.id)}"></textarea>`;
  else if (f.type === 'select') input = `<select id="${id}" name="${esc(f.id)}"><option value="">Select</option>${opts.map(o => `<option>${esc(o)}</option>`).join('')}</select>`;
  else if (f.type === 'radio') input = `<div class="seg">${opts.map(o => `<label><input type="radio" name="${esc(f.id)}" value="${esc(o)}"><span>${esc(o)}</span></label>`).join('')}</div>`;
  else if (f.type === 'checkbox') input = `<label class="row" style="font-weight:600"><input type="checkbox" id="${id}" name="${esc(f.id)}" value="Yes"> ${esc(opts[0] || 'Yes')}</label>`;
  else input = `<input id="${id}" name="${esc(f.id)}" type="${esc(f.type)}">`;
  const wide = ['textarea','radio'].includes(f.type) ? ' style="grid-column:1/-1"' : '';
  return `<div class="field"${wide}><label for="${id}">${esc(f.label)}${req}</label>${input}</div>`;
}
function pageInsurance() {
  return `<div class="wrap" style="padding-bottom:48px"><div class="pagehead"><p class="eyebrow">Pet insurance</p><h1>Protect your pet from big vet bills</h1><p class="muted">Share a few details and an insurance advisor will call you with plans that suit your pet. No obligation to buy.</p></div>
  <form class="card stack" data-form="ins" style="max-width:820px;margin-top:16px" novalidate>
    <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
    <div class="f2">${db.insFields.map(insFieldHtml).join('')}</div>
    <div class="err" id="ins-err" role="alert"></div>
    <div><button class="btn" type="submit">Request a callback</button></div>
  </form></div>`;
}
function pageAbout() {
  return `<div class="wrap" style="padding-bottom:48px"><div class="pagehead"><p class="eyebrow">About us</p><h1>Grooming that comes home</h1></div>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));align-items:start;margin-top:16px">
    <div class="prose"><p>Wag &amp; Tails started in 2022 with one idea: grooming shouldn't mean a stressful car ride and hours in a cage at a salon. Our groomers come to your home with a full kit, so your pet stays in a place it knows.</p>
    <p>Every groomer is trained in breed-specific cuts, gentle handling of anxious pets, and hygiene. Tools are sanitised between visits and we use only pet-safe, pH-balanced products.</p>
    <p>Today we groom dogs and cats across ${db.cities.filter(c => c.service).length} cities, run dog walking in select cities, and stock the products our groomers trust in our online store.</p></div>
    <div class="card stack"><img src="${LOGO}" alt="" style="width:120px;border-radius:50%"><h3>What we promise</h3>
      <ul style="padding-left:18px" class="stack"><li>Verified, trained groomers</li><li>Sanitised kit for every visit</li><li>Pet-safe, cruelty-free products</li><li>Pay online or after the service</li></ul></div>
  </div></div>`;
}
function pageContact() {
  const s = db.settings, wa = String(s.notifyWhatsApp || '').replace(/\D/g, '');
  return `<div class="wrap" style="padding-bottom:48px"><div class="pagehead"><p class="eyebrow">Contact us</p><h1>We usually reply within an hour</h1></div>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));align-items:start;margin-top:16px">
    <div class="card stack">
      ${s.phone ? `<div><p class="eyebrow">Phone / WhatsApp</p><p class="num" style="font-weight:700"><a href="tel:${esc(s.phone.replace(/\s/g, ''))}" style="color:inherit">${esc(s.phone)}</a></p></div>` : ''}
      ${s.email ? `<div><p class="eyebrow">Email</p><p style="font-weight:700"><a href="mailto:${esc(s.email)}" style="color:inherit">${esc(s.email)}</a></p></div>` : ''}
      ${s.address ? `<div><p class="eyebrow">Office</p><p>${esc(s.address)}</p></div>` : ''}
      ${wa ? `<a class="btn" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">Chat on WhatsApp</a>` : ''}</div>
    <form class="card stack" data-form="contact" novalidate>
      <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="field"><label for="c-name">Name <span class="req">*</span></label><input id="c-name" name="name" type="text"></div>
      <div class="field"><label for="c-phone">Phone <span class="req">*</span></label><input id="c-phone" name="phone" type="tel"></div>
      <div class="field"><label for="c-msg">Message <span class="req">*</span></label><textarea id="c-msg" name="msg"></textarea></div>
      <div class="err" id="c-err" role="alert"></div><div><button class="btn" type="submit">Send message</button></div></form>
  </div></div>`;
}
function pageThanks() {
  const [title, body] = S.thanks || ['Thank you', ''];
  return `<div class="wrap" style="padding-block:40px 56px;max-width:720px"><div class="okbox stack"><p class="eyebrow" style="color:var(--ok)">Received</p><h1>${title}</h1><p>${body}</p><div><button class="btn" data-act="go" data-v="home">Back to home</button></div></div></div>`;
}

/* ----- login & account ----- */
function pageLogin() {
  if (role) return pageHome();
  const who = S.loginAs;
  return `<div class="wrap" style="padding-block:40px 56px;max-width:460px">
    <div class="card stack"><img src="${LOGO}" alt="" style="width:64px;border-radius:50%">
      <h2>${who === 'customer' && S.regMode ? 'Create your account' : 'Sign in'}</h2>
      <div class="seg">${[['customer','Pet parent'],['staff','Booking staff'],['admin','Admin']].map(([k, l]) => `<label><input type="radio" name="who" value="${k}" data-act="login-as" ${who === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
      ${who === 'customer' ? otpBox() : who === 'customer' && S.regMode ? `
      <form class="stack" data-form="register" novalidate>
        <div class="field"><label for="r-name">Full name</label><input id="r-name" name="name" type="text" autocomplete="name"></div>
        <div class="field"><label for="r-phone">Mobile number</label><input id="r-phone" name="phone" type="tel" autocomplete="tel" placeholder="10-digit mobile"></div>
        <div class="field"><label for="r-email">Email</label><input id="r-email" name="email" type="email" autocomplete="email"></div>
        <div class="field"><label for="r-pass">Create a password</label><input id="r-pass" name="pass" type="password" autocomplete="new-password"></div>
        <div class="err" id="r-err" role="alert"></div><button class="btn" type="submit">Create account</button>
        ${R().enabled && R().signupBonus ? `<p class="small muted">Get <b>${R().signupBonus} bonus points</b> when you join. Points from earlier bookings on this number are added too.</p>` : ''}
        <p class="small">Already have an account? <button type="button" class="linkbtn" data-act="reg-toggle">Sign in</button></p></form>` : `
      <form class="stack" data-form="login" novalidate><input type="hidden" name="who" value="${who}">
        <div class="field"><label for="l-user">${who === 'customer' ? 'Mobile number' : 'Username or email'}</label><input id="l-user" name="user" type="${who === 'customer' ? 'tel' : 'text'}" autocomplete="username"></div>
        <div class="field"><label for="l-pass">Password</label><input id="l-pass" name="pass" type="password" autocomplete="current-password"></div>
        <div class="err" id="l-err" role="alert"></div><button class="btn" type="submit">Sign in</button>
        <p class="small"><a href="${esc(B.links.lostPass)}">Forgot your password?</a></p>
        ${who === 'customer' ? `<p class="small">New here? <button type="button" class="linkbtn" data-act="reg-toggle">Create an account</button> to see your bookings and collect reward points.</p>` : ''}</form>`}
    </div></div>`;
}
function pageAccount() {
  if (role !== 'customer') return pageLogin();
  return `<div class="wrap" style="padding-bottom:56px">${view('me', () => api('me'), d => {
    S.points = d.balance;
    const r = R(), bal = d.balance;
    return `<div class="pagehead"><p class="eyebrow">My account</p><h1>Hi ${esc((d.user.name || '').split(' ')[0])}</h1><p class="muted num">${esc(d.user.phone)} · ${esc(d.user.email)}</p></div>
    <div class="acctgrid">
      <div class="ptscard"><p class="eyebrow">Reward points</p><b class="big num">${bal}</b><p>Worth <b class="num">${money(bal * r.pointValue)}</b></p>
        <p class="small" style="color:#F1DDCB">${!r.enabled ? 'Reward points are paused right now.' : bal >= r.minRedeem ? 'Use them on your next grooming (tick "Use points" before paying) or in the store cart.' : `You can use points from ${r.minRedeem}. ${r.minRedeem - bal} more to go.`}</p>
        <div class="row">${isService() ? '<button class="btn honey sm" data-act="go" data-v="book">Book &amp; redeem</button>' : ''}<button class="btn ghost sm" data-act="go" data-v="shop">Shop &amp; redeem</button></div>
        <ul class="small" style="padding-left:18px"><li>${r.bookingRate} points for every ₹100 on grooming, added when the groom is done</li><li>${r.orderRate} points for every ₹100 in the store, added on delivery</li><li>1 point = ${money(r.pointValue)}. Use points for up to ${r.maxPct}% of a bill</li></ul></div>
      <div class="stack" style="min-width:0;gap:20px">
        ${myDetailsCard(d.profile)}
        <div class="card"><h3>My bookings</h3>${d.bookings.map(b => { const p = pkgObj(b.pkg); const cl = cityObj(b.city); return `<div class="mini"><div><b>${esc(pkgLabel(b))}</b> · ${esc(b.petType)}, ${esc(b.breed)}<div class="small muted">${fmtDate(b.date)}, ${esc(b.slot)} · ${esc(cityName(b.city))} · <span class="num">${esc(b.id)}</span></div>
          ${b.status === 'Cancelled' ? `<div class="small" style="color:var(--bad)">${esc(b.cancelReason || '')}</div>` : ''}${b.status === 'Completed' && cl && cl.reviewLink ? `<a class="small" href="${esc(cl.reviewLink)}" target="_blank" rel="noopener">Leave a review</a>` : ''}
          ${b.complaintRef && !b.complaintClosed ? `<div class="small"><span class="pill warn">Complaint ${esc(b.complaintRef)} open</span></div>` : b.cmpLeft > 0 ? `<div><button class="linkbtn small" data-act="cmp-for" data-id="${esc(b.id)}">Not happy? Raise a complaint (free redo)</button></div>` : ''}</div>
          <div style="text-align:right">${pill(b.status)}<div class="num"><b>${money(b.total)}</b></div>${b.ptsEarned && !b.ptsReversed ? `<div class="small plus">+${b.ptsEarned} pts</div>` : ''}${b.pointsUsed ? `<div class="small minus">−${b.pointsUsed} pts used</div>` : ''}</div></div>`; }).join('') || '<p class="muted" style="margin-top:8px">No bookings yet.</p>'}</div>
        <div class="card"><h3>My orders</h3>${d.orders.map(o => `<div class="mini"><div><a href="${esc(o.url)}"><b class="num">${esc(o.id)}</b></a> <span class="small muted">${esc(o.date)}</span><div class="small muted">${o.items.map(i => esc(i.name) + ' × ' + i.qty).join(', ')}</div></div>
          <div style="text-align:right">${pill(o.status)}<div class="num"><b>${money(o.total)}</b></div>${o.ptsEarned ? `<div class="small plus">+${o.ptsEarned} pts</div>` : ''}${o.pointsUsed ? `<div class="small minus">−${o.pointsUsed} pts used</div>` : ''}</div></div>`).join('') || '<p class="muted" style="margin-top:8px">No store orders yet.</p>'}</div>
        <div class="card"><h3>Points history</h3>${d.points.map(p => `<div class="mini"><div>${esc(p.reason)}<div class="small muted">${esc(p.at)}</div></div><b class="num ${p.pts > 0 ? 'plus' : 'minus'}">${p.pts > 0 ? '+' : ''}${p.pts}</b></div>`).join('') || '<p class="muted" style="margin-top:8px">No points yet. Book a groom or shop to start earning.</p>'}</div>
      </div></div>`;
  })}</div>`;
}

/* ---------- booking desk ---------- */
const deskKey = () => `desk:${S.deskFilter}:${S.deskCity}:${S.deskQ}`;
const loadDesk = () => api('desk/bookings', {q: {filter: S.deskFilter, city: S.deskCity, q: S.deskQ}});
function reviewUrl(b) {
  const c = cityObj(b.city); if (!c || !c.reviewLink) return '';
  const msg = (db.settings.reviewMsg || '{link}').replace(/\{name\}/g, String(b.name).split(' ')[0]).replace(/\{pet\}/g, b.breed || b.petType).replace(/\{link\}/g, c.reviewLink);
  return `https://wa.me/91${String(b.phone).replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(msg)}`;
}
function deskCard(b) {
  const p = pkgObj(b.pkg), open = OPEN.includes(b.status), rv = reviewUrl(b);
  return `<div class="card desk">
    <div class="row between"><div><div class="row" style="gap:8px"><b class="num">${fmtDate(b.date)} · ${esc(b.slot)}</b>${pill(b.status)}</div>
      <div class="small muted num">${esc(b.id)} · ${esc(cityName(b.city))} · via ${esc(b.source || 'Website')}${b.by && b.by !== 'Website' ? ' · added by ' + esc(b.by) : ''}</div></div>
      <div class="row" style="gap:8px"><b class="num">${money(b.total)}</b>${b.redo ? pill('Free redo') : b.payMode ? pill('Paid · ' + b.payMode) : pill('Due')}</div></div>
    ${appsJob(b)}
    <div class="f2 small"><div><b>${esc(b.name)}</b> · <a class="num" href="tel:${esc(b.phone)}">${esc(b.phone)}</a><br>${esc(b.address)}, ${esc(b.pincode)}</div>
      <div><b>${esc(pkgLabel(b))}</b> · ${esc(b.petType)}, ${esc(b.breed)}, ${esc(b.gender)}, ${esc(b.age)}<br><span style="color:var(--warn);font-weight:700">${esc(b.aggression)}</span>${b.custom && b.items ? `<br><span class="small"><b>Includes:</b> ${esc(b.items)}</span>` : ''}${(b.addonItems || []).length ? `<br>Bring: ${b.addonItems.map(i => esc(i.name)).join(', ')}` : ''}</div></div>
    ${b.status === 'Cancelled' ? `<p class="small" style="color:var(--bad)"><b>Cancelled:</b> ${esc(b.cancelReason || '')}${b.cancelledBy ? ' · by ' + esc(b.cancelledBy) : ''}</p>` : ''}
    ${(b.history || []).length ? `<p class="small muted">Rescheduled from ${b.history.map(h => `${fmtDate(h.date)} ${esc(h.slot)}${h.reason ? ' (' + esc(h.reason) + ')' : ''}`).join(', ')}</p>` : ''}
    ${b.notes ? `<p class="small muted">Note: ${esc(b.notes)}</p>` : ''}
    ${b.redo ? `<p class="small"><span class="pill warn">Free redo</span> of <b>${esc(b.redoOf)}</b> · ${esc(b.redoReason || '')}</p>` : ''}
    ${b.redoRef ? `<p class="small"><span class="pill neu">Redo booked</span> ${esc(b.redoRef)} · ${esc(b.redoReason || '')}${b.redoBy ? ' · by ' + esc(b.redoBy) : ''}</p>` : ''}
    ${(b.priceLog || []).length ? `<p class="small"><b>Price changed</b> ${b.priceLog.map(l => `${money(l.from)} → ${money(l.to)} (${esc(l.reason)} · ${esc(l.by)})`).join('; ')}</p>` : ''}
    ${b.balanceDue ? `<p class="small" style="color:var(--warn)"><b>Balance due ${money(b.balanceDue)}</b> · collect the difference</p>` : ''}
    ${b.extraDiscount ? `<p class="small" style="color:var(--ok)"><b>Discount −${money(b.extraDiscount)}</b> (was ${money(b.totalBefore)}) · ${esc(b.discountReason || '')}${b.discountBy ? ' · by ' + esc(b.discountBy) : ''}</p>` : ''}
    <div class="row between deskacts">
      <div class="row">${appsBtn(b)}${open ? `<button class="btn sm" data-act="desk-complete" data-id="${esc(b.id)}">Mark complete</button><button class="btn ghost sm" data-act="desk-resched" data-id="${esc(b.id)}">Reschedule</button><button class="btn danger sm" data-act="desk-cancel" data-id="${esc(b.id)}">Cancel</button>` : ''}
        ${b.status === 'Completed' && b.redoLeft > 0 ? `<button class="btn ghost sm" data-act="desk-redo" data-id="${esc(b.id)}" title="Available for ${redoDays(b.redoLeft)} more">Redo service <span class="small muted">(${redoDays(b.redoLeft)} left)</span></button>` : ''}
        ${['Confirmed','Rescheduled','Completed'].includes(b.status) && !b.redo ? `<button class="btn ghost sm" data-act="desk-disc" data-id="${esc(b.id)}">${b.extraDiscount ? 'Edit discount' : 'Give discount'}</button>` : ''}
        ${b.status !== 'Cancelled' && b.status !== 'Pending payment' ? `<button class="btn ghost sm" data-act="desk-edit" data-id="${esc(b.id)}">Change date / price</button>` : ''}
        <button class="btn ghost sm" data-act="bk-view" data-id="${esc(b.id)}">Details</button></div>
      <div class="row">${b.status !== 'Cancelled' && b.status !== 'Pending payment' && !b.redo ? `<label class="small" for="pm-${esc(b.id)}"><b>Payment received</b></label><select id="pm-${esc(b.id)}" data-chg="pay-mode" data-id="${esc(b.id)}"><option value="">Not yet</option>${['Online','Cash'].map(m => `<option ${b.payMode === m ? 'selected' : ''}>${m}</option>`).join('')}</select>` : ''}
        ${b.status === 'Completed' ? (rv ? `<a class="btn honey sm" href="${esc(rv)}" target="_blank" rel="noopener" data-act="review" data-id="${esc(b.id)}">${b.reviewAt ? 'Send review link again' : 'Take review'}</a>` : `<button class="btn honey sm" data-act="review-missing" data-id="${esc(b.city)}">Take review</button>`) : ''}</div></div>
    ${b.reviewAt ? `<p class="small muted">Review link sent on WhatsApp · ${esc(b.reviewAt)}${b.reviewBy ? ' by ' + esc(b.reviewBy) : ''}</p>` : ''}
  </div>`;
}
function deskView(withCity) {
  return `<div class="row between">
    <div class="row">${[['upcoming','Upcoming'],['today','Today'],...(APPS_ON ? [['nogroomer','No groomer yet'],['late','Running late'],['inprogress','In progress now'],['attention','Needs attention']] : []),['completed','Completed'],['cancelled','Cancelled'],['pending','Payment pending'],['all','All']].map(([k, l]) => `<button class="chip ${S.deskFilter === k ? 'on' : ''}" data-act="desk-filter" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="row">${withCity ? `<select data-chg="desk-city" aria-label="City" style="width:auto"><option value="all">All cities</option>${db.cities.map(c => `<option value="${esc(c.id)}" ${S.deskCity === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>` : ''}
      <input type="text" id="desk-q" placeholder="Search name, phone or booking ID" value="${esc(S.deskQ)}" style="width:260px;max-width:100%"></div></div>
    <div class="stack" id="desk-list">${view(deskKey(), loadDesk, d => d.list.map(deskCard).join('') || '<div class="card muted">No bookings in this view.</div>')}</div>`;
}
function pageStaff() {
  if (role !== 'staff' && role !== 'admin') return pageLogin();
  const scope = role === 'staff' ? B.user.city : 'all';
  const d = C[deskKey()] && C[deskKey()].data;
  const k = d ? [['Today', d.counts.today], ['Upcoming', d.counts.upcoming], ['Payment not recorded', d.counts.payPending], ['Reviews to request', d.counts.reviewsDue]] : [];
  return `<div class="wrap" style="padding-block:28px 56px"><div class="row between"><div><p class="eyebrow">Booking desk · ${esc(cityName(scope))}</p><h1>Hi ${esc((B.user.name || '').split(' ')[0])}</h1></div><button class="btn honey" data-act="desk-add">Add booking</button></div>
  <div class="kpis" style="margin-block:18px">${k.map(([l, n]) => `<div class="kpi"><span class="muted small">${l}</span><b class="num">${n}</b></div>`).join('')}</div>
  <div class="stack">${deskView(role === 'admin')}</div></div>`;
}
function completeModal(b) {
  if (b.redo) {
    openModal(`<form class="stack" data-form="desk-complete" data-id="${esc(b.id)}" novalidate><div class="row between"><h3>Mark redo complete</h3><button type="button" class="x" data-act="close" aria-label="Close">×</button></div>
      <p class="muted">${esc(b.id)} · ${esc(b.name)} · free redo of ${esc(b.redoOf)}. No payment to collect.</p><input type="hidden" name="mode" value="Free redo">
      <div class="field"><label for="dc-note">Note (optional)</label><input id="dc-note" name="note" type="text"></div>
      <div class="err" id="m-err" role="alert"></div><div class="row"><button class="btn" type="submit">Mark complete</button><button type="button" class="btn ghost" data-act="close">Back</button></div></form>`);
    return;
  }
  const pre = b.payMode || (b.payStatus === 'Paid' ? 'Online' : '');
  openModal(`<form class="stack" data-form="desk-complete" data-id="${esc(b.id)}" novalidate><div class="row between"><h3>Mark grooming complete</h3><button type="button" class="x" data-act="close" aria-label="Close">×</button></div>
    <p class="muted">${esc(b.id)} · ${esc(b.name)} · <b class="num">${money(b.total)}</b> ${b.payStatus === 'Paid' ? '(paid online at booking)' : 'to collect'}</p>
    <div class="field"><label>How was the payment received? <span class="req">*</span></label><div class="seg">${['Online','Cash'].map(m => `<label><input type="radio" name="mode" value="${m}" ${pre === m ? 'checked' : ''}><span>${m}</span></label>`).join('')}</div></div>
    <div class="field"><label for="dc-note">Note (optional)</label><input id="dc-note" name="note" type="text" placeholder="e.g. groomer name, extra charges"></div>
    <div class="err" id="m-err" role="alert"></div><div class="row"><button class="btn" type="submit">Mark complete</button><button type="button" class="btn ghost" data-act="close">Back</button></div></form>`);
}
function cancelModal(b) {
  openModal(`<form class="stack" data-form="desk-cancel" data-id="${esc(b.id)}" novalidate><div class="row between"><h3>Cancel booking</h3><button type="button" class="x" data-act="close" aria-label="Close">×</button></div>
    <p class="muted">${esc(b.id)} · ${esc(b.name)} · ${fmtDate(b.date)}, ${esc(b.slot)}</p>
    <div class="field"><label for="dx-r">Reason <span class="req">*</span></label><select id="dx-r" name="reason"><option value="">Select a reason</option>${CANCEL_REASONS.map(r => `<option>${r}</option>`).join('')}</select></div>
    <div class="field"><label for="dx-d">Details</label><textarea id="dx-d" name="details" placeholder="Required if you choose Other"></textarea></div>
    ${b.payStatus === 'Paid' && b.payMode === 'Online' ? '<p class="note"><b>Paid online.</b> Refund the amount from your Razorpay dashboard after cancelling.</p>' : ''}
    <div class="err" id="m-err" role="alert"></div><div class="row"><button class="btn" type="submit" style="background:var(--bad);color:var(--bg)">Cancel booking</button><button type="button" class="btn ghost" data-act="close">Keep booking</button></div></form>`);
}
function discountModal(b) {
  const before = Number(b.totalBefore ?? b.total) || 0;
  openModal(`<form class="stack" data-form="desk-disc" data-id="${esc(b.id)}" data-before="${before}" novalidate><div class="row between"><h3>${b.extraDiscount ? 'Edit discount' : 'Give a discount'}</h3><button type="button" class="x" data-act="close" aria-label="Close">×</button></div>
    <p class="muted">${esc(b.id)} · ${esc(b.name)} · ${esc(b.status)} · price before discount <b class="num">${money(before)}</b></p>
    <div class="field"><label>Discount in</label><div class="seg"><label><input type="radio" name="kind" value="amt" checked data-chg="disc-calc"><span>₹ Amount</span></label><label><input type="radio" name="kind" value="pct" data-chg="disc-calc"><span>% Percent</span></label></div></div>
    <div class="field"><label for="dd-v">Discount <span class="req">*</span></label><input id="dd-v" name="value" type="number" min="0" step="1" inputmode="decimal" value="${b.extraDiscount ? esc(b.extraDiscount) : ''}" data-chg="disc-calc"></div>
    <div class="field"><label for="dd-r">Reason <span class="req">*</span></label><textarea id="dd-r" name="reason" placeholder="e.g. Groomer arrived late, pet was very small, loyal customer">${esc(b.discountReason || '')}</textarea></div>
    <p class="sumline total" style="margin:0"><span>New total</span><span class="num" id="dd-new"></span></p>
    ${b.payStatus === 'Paid' && b.payMode === 'Online' ? '<p class="note small"><b>Paid online.</b> Refund the discount from your Razorpay dashboard.</p>' : ''}
    <div class="err" id="m-err" role="alert"></div><div class="row"><button class="btn" type="submit">Save discount</button>${b.extraDiscount ? `<button type="button" class="btn danger sm" data-act="desk-disc-remove" data-id="${esc(b.id)}" data-confirm>Remove discount</button>` : ''}<button type="button" class="btn ghost" data-act="close">Back</button></div></form>`);
  discCalc();
}
function discCalc() {
  const f = document.querySelector('form[data-form="desk-disc"]'); if (!f) return;
  const before = Number(f.dataset.before) || 0, v = Number($('#dd-v').value) || 0, pct = f.querySelector('input[name=kind]:checked').value === 'pct';
  const amt = Math.min(before, Math.round(pct ? before * Math.min(100, v) / 100 : v));
  $('#dd-new').textContent = amt ? `${money(before - amt)} (−${money(amt)})` : money(before);
}
function editModal(b) {
  const open = ['Confirmed', 'Rescheduled'].includes(b.status);
  openModal(`<form class="stack" data-form="desk-edit" data-id="${esc(b.id)}" novalidate><div class="row between"><h3>Change date or price</h3><button type="button" class="x" data-act="close" aria-label="Close">×</button></div>
    <p class="muted">${esc(b.id)} · ${esc(b.name)} · ${esc(pkgLabel(b))} · now ${fmtDate(b.date)}, ${esc(b.slot)} · ${money(b.total)}</p>
    <div class="f2"><div class="field"><label for="de-d">Date</label><input id="de-d" name="date" type="date" value="${esc(b.date)}" data-chg="edit-slots"></div>
    <div class="field"><label for="de-s">Time</label><select id="de-s" name="start"><option value="">Loading…</option></select></div></div>
    <div class="f2"><div class="field"><label for="de-p">Price (₹)</label><input id="de-p" name="price" type="number" min="0" step="1" inputmode="numeric" value="${esc(b.total)}"><span class="small muted">Raise or lower the amount the customer pays.${b.extraDiscount ? ' This replaces the current discount.' : ''}</span></div>
    <div class="field"><label for="de-r">Reason <span class="small muted">(needed for a price change)</span></label><input id="de-r" name="reason" type="text" maxlength="300" placeholder="e.g. Extra matting, second pet added, wrong date entered"></div></div>
    ${open ? '<label class="small"><input type="checkbox" name="notify" checked> Send the new date and time to the customer on WhatsApp</label>' : '<p class="small muted">This booking is ' + esc(b.status.toLowerCase()) + ', so a date change is only corrected in the records (no message).</p>'}
    <div class="err" id="m-err" role="alert"></div><div class="row"><button class="btn" type="submit">Save changes</button><button type="button" class="btn ghost" data-act="close">Cancel</button></div></form>`);
  fillSlotSelect('#de-s', {city: b.city, date: b.date, ref: b.id}).then(() => { const el = $('#de-s'); if (el && [...el.options].some(o => o.value === b.start)) el.value = b.start; else if (el && b.start) { el.insertAdjacentHTML('afterbegin', `<option value="${esc(b.start)}" selected>${esc(b.slot)} (current)</option>`); } });
}
function reschedModal(b) {
  openModal(`<form class="stack" data-form="desk-resched" data-id="${esc(b.id)}" novalidate><div class="row between"><h3>Reschedule</h3><button type="button" class="x" data-act="close" aria-label="Close">×</button></div>
    <p class="muted">${esc(b.id)} · ${esc(b.name)} · now on ${fmtDate(b.date)}, ${esc(b.slot)}</p>
    <div class="f2"><div class="field"><label for="dr-d">New date <span class="req">*</span></label><input id="dr-d" name="date" type="date" value="${esc(b.date >= TODAY ? b.date : TODAY)}" data-chg="resched-slots"></div>
    <div class="field"><label for="dr-s">New time <span class="req">*</span></label><select id="dr-s" name="start" data-slotfor="resched" data-ref="${esc(b.id)}"><option value="">Choose a date first</option></select></div></div>
    <div class="field"><label for="dr-r">Reason (optional)</label><input id="dr-r" name="reason" type="text" placeholder="e.g. customer travelling"></div>
    <div class="err" id="m-err" role="alert"></div><div class="row"><button class="btn" type="submit">Save new time</button><button type="button" class="btn ghost" data-act="close">Back</button></div></form>`);
  fillSlotSelect('#dr-s', {city: b.city, date: $('#dr-d').value, ref: b.id});
}
/* Fill a desk time dropdown with available times; booked ones are shown but can't be picked. */
async function fillSlotSelect(sel, q) {
  const el = $(sel); if (!el) return;
  if (!q.date) { el.innerHTML = '<option value="">Choose a date first</option>'; return; }
  el.innerHTML = '<option value="">Checking times…</option>';
  if (!el.nextElementSibling || !el.nextElementSibling.classList.contains('ctime')) el.insertAdjacentHTML('afterend', '<input type="time" name="customStart" class="ctime" hidden aria-label="Custom start time" style="margin-top:6px">');
  el.dataset.chg = el.dataset.chg || 'slot-pick';
  try {
    const r = await api('slots', {q: Object.assign({desk: 1}, q)});
    const list = r.slots || [];
    el.innerHTML = '<option value="">Choose a time</option>' + list.map(s => `<option value="${esc(s.start)}" ${s.free ? '' : 'disabled'}>${esc(s.label)}${s.free ? '' : ' (Booked)'}</option>`).join('') + '<option value="__custom">Custom time…</option>';
  } catch (e) { el.innerHTML = `<option value="">${esc(e.message)}</option><option value="__custom">Custom time…</option>`; }
  const ct = el.nextElementSibling; if (ct && ct.classList.contains('ctime')) ct.hidden = el.value !== '__custom';
}
function addBookingModal() {
  const scope = role === 'staff' ? B.user.city : 'all';
  const cities = db.cities.filter(c => c.service && (scope === 'all' || scope === c.id));
  const allBreeds = [...(db.breeds.Dog || []), ...(db.breeds.Cat || []).filter(x => !(db.breeds.Dog || []).includes(x))];
  openModal(`<form class="stack" data-form="desk-add" novalidate><div class="row between"><h3>Add a booking</h3><button type="button" class="x" data-act="close" aria-label="Close">×</button></div>
    <div class="f2">
      <div class="field"><label for="da-city">City</label><select id="da-city" name="city" data-chg="add-calc">${cities.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="da-pkg">Package</label><select id="da-pkg" name="pkg" data-chg="add-calc">${db.packages.map(p => `<option value="${esc(p.id)}">${esc(p.name)} (${p.pet === 'Both' ? 'Dog/Cat' : esc(p.pet)})</option>`).join('')}<option value="__custom">Custom package…</option></select></div>
      <div class="field"><label for="da-src">Booked via</label><select id="da-src" name="source">${SOURCES.map(s => `<option>${s}</option>`).join('')}</select></div>
      <div class="field"><label for="da-cp">Coupon</label><select id="da-cp" name="coupon" data-chg="add-calc"><option value="">None</option>${db.coupons.filter(c => c.active).map(c => `<option value="${esc(c.code)}">${esc(c.code)} · ${esc(c.desc)}</option>`).join('')}</select></div>
    </div>
    <div class="card stack" id="da-custom" hidden style="background:var(--tint)"><b>Custom package</b>
      <div class="f3"><div class="field"><label for="da-cname">Package name *</label><input id="da-cname" name="customName" type="text" placeholder="e.g. Bath + tick treatment"></div>
      <div class="field"><label for="da-cprice">Price (₹) *</label><input id="da-cprice" name="customPrice" type="number" min="1" inputmode="numeric" data-chg="add-calc"></div>
      <div class="field"><label for="da-cmins">Time it takes (minutes)</label><input id="da-cmins" name="customMins" type="number" min="15" step="15" value="60" data-chg="add-calc"></div></div>
      <div class="field"><label for="da-cnote">What's included (optional)</label><input id="da-cnote" name="customNote" type="text" placeholder="Shown to the groomer in the booking"></div></div>
    <p class="sumline total" style="margin:0"><span>Price</span><span class="num" id="da-price"></span></p>
    <h4 style="font-family:var(--f-body)">Customer</h4>
    <div class="f2">
      <div class="field"><label for="da-name">Name *</label><input id="da-name" name="name" type="text"></div>
      <div class="field"><label for="da-phone">Mobile (WhatsApp) *</label><input id="da-phone" name="phone" type="tel" inputmode="numeric"><span class="small" id="da-known"></span></div>
      <div class="field"><label for="da-email">Email</label><input id="da-email" name="email" type="email"></div>
      <div class="field"><label for="da-pin">Pincode *</label><input id="da-pin" name="pincode" type="text" maxlength="6" inputmode="numeric"></div></div>
    <div class="field"><label for="da-addr">Address *</label><textarea id="da-addr" name="address"></textarea></div>
    <div class="field"><label for="da-map">Google Maps link (optional)</label><input id="da-map" name="mapLink" type="url" placeholder="Paste the location the customer shared on WhatsApp"></div>
    <h4 style="font-family:var(--f-body)">Pet</h4>
    <div class="f3">
      <div class="field"><label for="da-pt">Pet type</label><select id="da-pt" name="petType"><option>Dog</option><option>Cat</option></select></div>
      <div class="field"><label for="da-br">Breed *</label><input id="da-br" name="breed" type="text" list="da-breeds"><datalist id="da-breeds">${allBreeds.map(b => `<option value="${esc(b)}">`).join('')}</datalist></div>
      <div class="field"><label for="da-g">Gender</label><select id="da-g" name="gender"><option>Male</option><option>Female</option></select></div>
      <div class="field"><label for="da-age">Age *</label><input id="da-age" name="age" type="text" placeholder="e.g. 3 years"></div>
      <div class="field" style="grid-column:span 2"><label for="da-agg">Aggression level</label><select id="da-agg" name="aggression">${AGGRESSION.map(a => `<option>${a}</option>`).join('')}</select></div></div>
    <h4 style="font-family:var(--f-body)">Appointment &amp; payment</h4>
    <div class="f3">
      <div class="field"><label for="da-date">Date *</label><input id="da-date" name="date" type="date" data-chg="add-slots"></div>
      <div class="field"><label for="da-slot">Time *</label><select id="da-slot" name="start" data-slotfor="add"><option value="">Choose a date first</option></select></div>
      <div class="field"><label for="da-pay">Payment</label><select id="da-pay" name="pay"><option value="later">Pay after service</option><option value="online">Already paid online</option></select></div></div>
    <p class="small muted">Past dates and times can be added for records. Pick <b>Custom time…</b> in the time list for a time that isn't shown.</p>
    <label class="small" id="da-past" hidden><input type="checkbox" name="notifyPast"> This booking is in the past. Also send the confirmation message to the customer</label>
    <div class="err" id="m-err" role="alert"></div><div class="row"><button class="btn" type="submit">Save booking &amp; notify customer</button><button type="button" class="btn ghost" data-act="close">Cancel</button></div></form>`);
  addCalc();
}
function addSlotQ() {
  const q = {city: $('#da-city').value, date: $('#da-date').value, pkg: $('#da-pkg').value};
  if (q.pkg === '__custom') q.mins = ($('#da-cmins') || {}).value || 60;
  return q;
}
function addCalc() {
  const el = $('#da-price'); if (!el) return;
  const custom = $('#da-pkg').value === '__custom'; const cb = $('#da-custom'); if (cb) cb.hidden = !custom;
  const p = pkgObj($('#da-pkg').value), base = custom ? (Number(($('#da-cprice') || {}).value) || 0) : p ? (Number(p.prices[$('#da-city').value]) || 0) : 0;
  const cp = $('#da-cp').value, r = cp ? couponDiscount(cp, base) : null;
  const mrp = p ? mrpOf(p, $('#da-city').value) : 0;
  el.textContent = (mrp > base && base ? `MRP ${money(mrp)} · ` : '') + (!base ? (custom ? 'Enter the price' : 'No price set for this city') :  r && r.ok ? `${money(base - r.amount)} (${cp} −${money(r.amount)})` : money(base) + (r && !r.ok ? ' · ' + r.msg : ''));
}
function bookingDetail(ref) {
  const b = findBooking(ref); if (!b) return;
  const p = pkgObj(b.pkg);
  const rows = [['Package', pkgLabel(b) + (b.custom && b.items ? ' — ' + b.items : '')], ['City', cityName(b.city)], ['Date & time', fmtDate(b.date) + ', ' + b.slot], ['Customer', b.name], ['Phone', b.phone], ['Email', b.email || '—'], ['Address', b.address + ' — ' + b.pincode],
    ['Pet', `${b.petType} · ${b.breed} · ${b.gender} · ${b.age}`], ['Aggression', b.aggression], ['Add-ons', (b.addonItems || []).map(i => i.name).join(', ') || 'None'],
    ['Coupon', b.coupon || 'None'], ['Subtotal', money(b.subtotal)], ['Discount', money(b.discount)], ['Points used', b.pointsUsed || 0], ...(b.extraDiscount ? [['Discount after booking', '−' + money(b.extraDiscount) + ' · ' + (b.discountReason || '') + (b.discountBy ? ' (by ' + b.discountBy + ')' : '')]] : []), ['Total', money(b.total)],
    ['Payment', b.payMode ? 'Paid · ' + b.payMode + (b.payId && b.payId !== 'free' ? ' (' + b.payId + ')' : '') : 'Not yet received'], ['Booked via', (b.source || 'Website') + (b.by && b.by !== 'Website' ? ' · ' + b.by : '')], ['Booked on', b.created], ['Points earned', b.ptsEarned || 0], ['Status', b.status + (b.cancelReason ? ' — ' + b.cancelReason : '')]];
  openModal(`<div class="row between"><h3>Booking ${esc(b.id)}</h3><button class="x" data-act="close" aria-label="Close">×</button></div>
    <div style="margin-top:12px">${rows.map(([k, v]) => `<div class="sumline small" style="border-bottom:1px solid var(--line)"><span class="muted">${k}</span><b style="text-align:right">${esc(v)}</b></div>`).join('')}</div>
    <div class="row" style="margin-top:14px">${b.lat ? `<a class="btn sm" href="https://www.google.com/maps?q=${b.lat},${b.lng}" target="_blank" rel="noopener">Open location in Google Maps</a>` : ''}${b.mapLink ? `<a class="btn sm" href="${esc(b.mapLink)}" target="_blank" rel="noopener">Open shared location</a>` : ''}<a class="btn ghost sm" href="https://wa.me/91${esc(b.phone)}" target="_blank" rel="noopener">WhatsApp customer</a>
    ${role === 'admin' ? delBtn('bk-delete', b.id, 'Delete booking') : ''}</div>`);
}

/* ---------- ADMIN ---------- */
const TABS = [
  ['grp','Overview'],['dashboard','Dashboard'],
  ['grp','Grooming'],['bookings','Bookings'],['apps','Apps & partners'],['packages','Packages & prices'],['cities','Cities & walking'],['blocks','Leave & holidays'],['walks','Walk requests'],['staff','Booking staff'],
  ['grp','Store'],['store','Orders & shipping'],['products','Products'],['banners','Shop banners'],['suggested','Checkout suggestions'],['coupons','Booking coupons'],
  ['grp','Events'],['events','Events & passes'],['broadcast','WhatsApp broadcast'],['grp','Customers'],['customers','Customers'],['complaints','Complaints'],['rewards','Reward points'],
  ['grp','Leads'],['insform','Insurance form'],['insleads','Insurance leads'],['enquiries','Enquiries'],
  ['grp','System'],['admins','Admin logins'],['notifs','Notifications log'],['settings','Settings'],['import','Import from BookingPress']
];
let cfgTimer = null;
function cfgPayload() { const o = {}; ['cities','packages','breeds','coupons','insFields','walkPlans','banners','suggested','rewards','settings'].forEach(k => o[k] = db[k]); return o; }
function saveConfig(msg, immediate) {
  clearTimeout(cfgTimer);
  const run = async () => {
    try {
      const r = await api('admin/config', {method: 'POST', body: cfgPayload()});
      ['razorpaySecret','waToken'].forEach(k => { db.settings[k] = ''; });
      db.settings.secretSet = r.config.settings.secretSet; db.settings.waTokenSet = r.config.settings.waTokenSet; db.settings.razorpayOn = r.config.settings.razorpayOn;
      toast(msg || 'Saved');
      if (immediate) rerenderKeep();
    } catch (e) { toast('Not saved: ' + e.message); }
  };
  if (immediate) run(); else cfgTimer = setTimeout(run, 500);
}
function pageAdmin() {
  if (role !== 'admin') return pageLogin();
  return `<div class="wrap admin"><nav class="side" aria-label="Admin">${TABS.map(([k, l]) => k === 'grp' ? `<div class="grp">${l}</div>` : `<button class="${S.adminTab === k ? 'on' : ''}" data-act="tab" data-v="${k}"><span>${l}</span></button>`).join('')}</nav>
    <div class="stack" style="gap:18px;min-width:0">${(ADMIN[S.adminTab] || ADMIN.dashboard)()}</div></div>`;
}
const recList = type => () => api('admin/records', {q: {type}});
const VIS = [['listed','Shown to customers'],['hidden','Hidden (customers can type it)'],['staff','Booking staff only']];
const ADMIN = {
  dashboard() {
    return view('dash', () => api('admin/dashboard'), d => `<div class="row between"><h2>Dashboard</h2><button class="btn honey sm" data-act="desk-add">Add booking</button></div>
      <div class="kpis"><div class="kpi"><span class="muted small">Today's bookings</span><b class="num">${d.today}</b></div><div class="kpi"><span class="muted small">Upcoming bookings</span><b class="num">${d.upcoming}</b></div><div class="kpi"><span class="muted small">New insurance leads</span><b class="num">${d.leads}</b></div><div class="kpi"><span class="muted small">Collected, last 30 days</span><b class="num">${money(d.collected)}</b></div></div>
      ${d.walks ? `<p class="note"><b>${d.walks} new walk request${d.walks === 1 ? '' : 's'}.</b> <button class="linkbtn" data-act="tab" data-v="walks">Open walk requests</button></p>` : ''}
      <div class="row between"><h3>Next appointments</h3><button class="btn ghost sm" data-act="tab" data-v="bookings">All bookings</button></div>
      <div class="stack">${d.next.map(deskCard).join('') || '<div class="card muted">No upcoming bookings yet.</div>'}</div>`);
  },
  bookings() {
    return `<div class="row between"><h2>Bookings</h2><button class="btn honey sm" data-act="desk-add">Add booking</button></div>${deskView(true)}`;
  },
  packages() {
    const cs = db.cities.filter(c => c.service);
    return `<h2>Packages &amp; city prices</h2><p class="muted">Prices change by city. In each city cell, <b>MRP</b> is the full price customers see crossed out, and <b>Price</b> is the discount price they actually pay. Leave MRP empty to show only the price. Edit a box and it saves. <b>Minutes</b> is how long the groom takes; it decides which time slots are free.</p>
    <div class="tablewrap"><table><thead><tr><th>Package</th><th>Pet</th><th>Minutes</th>${cs.map(c => `<th>${esc(c.name)}</th>`).join('')}<th></th></tr></thead><tbody>
    ${db.packages.map(p => `<tr><td style="min-width:210px"><b>${esc(p.name)}</b><div class="small muted">${esc(p.duration)}</div><div class="small muted">${(p.items || []).map(esc).join(' · ')}</div></td><td>${esc(p.pet)}</td><td><input type="number" min="15" step="15" class="num" value="${esc(p.mins || (String(p.duration).match(/\d+/) || [60])[0])}" data-chg="pkg-mins" data-id="${esc(p.id)}" aria-label="${esc(p.name)} length in minutes" style="width:80px"></td>${cs.map(c => `<td><div class="pricecell"><label><span>MRP</span><input type="number" min="0" class="num" value="${(p.mrp || {})[c.id] ?? ''}" data-chg="mrp" data-pkg="${esc(p.id)}" data-city="${esc(c.id)}" aria-label="${esc(p.name)} MRP in ${esc(c.name)}"></label><label><span>Price</span><input type="number" min="0" class="num" value="${p.prices[c.id] ?? ''}" data-chg="price" data-pkg="${esc(p.id)}" data-city="${esc(c.id)}" aria-label="${esc(p.name)} discount price in ${esc(c.name)}"></label></div></td>`).join('')}<td>${delBtn('del-pkg', p.id)}</td></tr>`).join('')}
    </tbody></table></div>
    <form class="card stack" data-form="pkg"><h3>Add a package</h3><div class="f3">
      <div class="field"><label for="pk-name">Name</label><input id="pk-name" name="name" type="text" required></div>
      <div class="field"><label for="pk-pet">For</label><select id="pk-pet" name="pet"><option>Both</option><option>Dog</option><option>Cat</option></select></div>
      <div class="field"><label for="pk-dur">Duration</label><input id="pk-dur" name="duration" type="text" placeholder="90 min"></div>
      <div class="field"><label for="pk-mrp">MRP (all cities)</label><input id="pk-mrp" name="mrp" type="number" min="0"></div>
      <div class="field"><label for="pk-price">Discount price (all cities)</label><input id="pk-price" name="price" type="number" min="0" required></div></div>
      <div class="field"><label for="pk-items">What's included (one per line)</label><textarea id="pk-items" name="items"></textarea></div>
      <div><button class="btn" type="submit">Add package</button></div></form>`;
  },
  cities() {
    return `<h2>Cities, dog walking &amp; review links</h2><p class="muted">Customers in a city with grooming switched off see only Home, Shop, Pet Insurance, About and Contact. Dog walking appears only where you switch it on. The review link is sent on WhatsApp by "Take review".</p>
    <div class="tablewrap"><table><thead><tr><th>City</th><th>Home grooming</th><th>Dog walking</th><th>Groomers at a time</th><th>Google review link</th><th></th></tr></thead><tbody>
    ${db.cities.map(c => `<tr><td><b>${esc(c.name)}</b></td>
      <td><label class="toggle"><input type="checkbox" data-chg="city-svc" data-id="${esc(c.id)}" ${c.service ? 'checked' : ''} aria-label="Grooming in ${esc(c.name)}"><span></span></label></td>
      <td><label class="toggle"><input type="checkbox" data-chg="city-walk" data-id="${esc(c.id)}" ${c.walking ? 'checked' : ''} aria-label="Dog walking in ${esc(c.name)}"><span></span></label></td>
      <td><input type="number" min="1" max="20" class="num" value="${esc(c.capacity || 1)}" data-chg="city-cap" data-id="${esc(c.id)}" aria-label="Groomers available at the same time in ${esc(c.name)}" style="width:70px"></td>
      <td style="min-width:260px"><input type="url" value="${esc(c.reviewLink || '')}" data-chg="city-review" data-id="${esc(c.id)}" placeholder="https://g.page/r/…/review" aria-label="Review link for ${esc(c.name)}"></td>
      <td>${delBtn('del-city', c.id, 'Remove')}</td></tr>`).join('')}
    </tbody></table></div>
    <form class="card row" data-form="city" style="align-items:end"><div class="field" style="flex:1;min-width:200px"><label for="ct-name">Add a city</label><input id="ct-name" name="name" type="text" placeholder="e.g. Bhopal" required></div><button class="btn" type="submit">Add city</button></form>
    <h3>Walk plans</h3>
    <div class="tablewrap"><table><thead><tr><th>Plan</th><th>Price per walk</th><th></th></tr></thead><tbody>
    ${db.walkPlans.map(w => `<tr><td>${esc(w.name)}</td><td><input type="number" class="num" value="${w.price}" data-chg="walk-price" data-id="${esc(w.id)}" aria-label="Price"></td><td>${delBtn('del-wplan', w.id)}</td></tr>`).join('')}</tbody></table></div>
    <form class="card row" data-form="wplan" style="align-items:end"><div class="field" style="flex:1;min-width:180px"><label for="wp-name">Plan name</label><input id="wp-name" name="name" type="text" required></div><div class="field"><label for="wp-price">Price</label><input id="wp-price" name="price" type="number" required></div><button class="btn" type="submit">Add plan</button></form>`;
  },
  walks() {
    return `<h2>Walk requests</h2>` + view('walks', recList('walk'), d => d.list.length ? `<div class="tablewrap"><table><thead><tr><th>Received</th><th>Customer</th><th>Dog</th><th>Plan</th><th>Start</th><th>Status</th><th></th></tr></thead><tbody>
    ${d.list.map(w => `<tr><td class="small">${esc(w.created)}</td><td><b>${esc(w.name)}</b><div class="small num">${esc(w.phone)}</div><div class="small muted">${esc(cityName(w.city))} ${esc(w.pincode)}</div><div class="small muted">${esc(w.address)}</div></td><td>${esc(w.dog)}</td><td>${esc(w.planName)}<div class="small muted">${esc(w.freq)} · ${esc(w.time)}</div></td><td>${fmtDate(w.start)}</td>
    <td><select data-chg="rec-status" data-type="walk" data-id="${esc(w.id)}" aria-label="Status">${['New','Contacted','Active','Closed'].map(s => `<option ${w.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></td><td>${delBtn('rec-del', w.id, 'Delete', 'data-type="walk"')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="card muted">No walk requests yet. They appear here when customers in walking cities submit the form.</div>');
  },
  staff() {
    return `<h2>Booking staff</h2><p class="muted">Your booking team signs in on the website with these details and lands on the Booking desk. They can add bookings, mark them complete, cancelled or rescheduled, record how payment was received, and send review requests on WhatsApp. Choose a city to limit what they see.</p>
    ${view('staff', () => api('admin/staff'), d => `<div class="tablewrap"><table><thead><tr><th>Name</th><th>Username</th><th>Phone</th><th>City access</th><th>Today</th><th>Report access</th><th></th></tr></thead><tbody>
    ${d.list.map(s => `<tr><td><b>${esc(s.name)}</b></td><td>${esc(s.username)}</td><td class="num">${esc(s.phone)}</td><td>${esc(cityName(s.city))}</td>
      <td class="small">${s.att && s.att.in ? (s.att.out ? 'In ' + esc(s.att.in) + ', out ' + esc(s.att.out) : pill('On duty') + ' since ' + esc(s.att.in)) : '<span class="muted">Not punched in</span>'}</td>
      <td><div class="perms">${Object.entries(KINDS).map(([k, l]) => `<label class="small"><input type="checkbox" value="${k}" data-chg="tm-perm" data-uid="${s.id}" ${(s.perms || []).includes(k) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div></td>
      <td>${delBtn('del-staff', s.id, 'Remove login')}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">No booking staff yet.</td></tr>'}</tbody></table></div>
    <p class="small muted">Every staff member always sees their own targets, performance and attendance on their <b>My work</b> page. Tick a report to let them download it too (limited to their city if they have one). Sales dashboard shows them the full charts.</p>`)}
    <form class="card stack" data-form="staff"><h3>Create a staff login</h3><div class="f3">
      <div class="field"><label for="st-name">Full name</label><input id="st-name" name="name" type="text" required></div>
      <div class="field"><label for="st-phone">Phone</label><input id="st-phone" name="phone" type="tel"></div>
      <div class="field"><label for="st-email">Email (for password reset)</label><input id="st-email" name="email" type="email"></div>
      <div class="field"><label for="st-city">City access</label><select id="st-city" name="city"><option value="all">All cities</option>${db.cities.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="st-user">Username</label><input id="st-user" name="username" type="text" autocomplete="off" required></div>
      <div class="field"><label for="st-pass">Password (8+ characters)</label><input id="st-pass" name="password" type="text" autocomplete="new-password" required></div></div>
      <div class="err" id="st-err" role="alert"></div><div><button class="btn" type="submit">Create login</button></div></form>`;
  },
  store() {
    const L = B.links;
    return `<h2>Orders &amp; shipping</h2><p class="muted">Store orders are handled by WooCommerce. Connect WooCommerce to Shiprocket or BigShip once, and every new order syncs there for pickup and tracking.</p>
    ${B.woo ? '' : '<p class="note"><b>WooCommerce is not installed.</b> Install it from Plugins → Add New to switch on the store.</p>'}
    <div class="adminlinks"><a class="btn" href="${esc(L.orders)}">Open store orders</a><a class="btn ghost" href="${esc(L.payments)}">Payment settings (Razorpay, COD)</a><a class="btn ghost" href="${esc(L.wooCoupons)}">Store coupons</a>${db.settings.shipPanel ? `<a class="btn ghost" href="${esc(db.settings.shipPanel)}" target="_blank" rel="noopener">Open shipping panel</a>` : ''}</div>
    <div class="card stack"><h3>Connect Shiprocket</h3><ol class="small" style="padding-left:18px">
      <li>In WordPress go to WooCommerce → Settings → Advanced → REST API → Add key. Description "Shiprocket", permission Read/Write. Copy the Consumer key and Consumer secret.</li>
      <li>In Shiprocket go to Settings → Channels → Add New Channel → WooCommerce → Integrate.</li>
      <li>Turn on order and inventory sync, paste the two keys and your store URL, then Save &amp; Test Connection.</li></ol>
      <p class="small muted">Using BigShip instead? Add a WooCommerce channel from the BigShip panel the same way, using the same API keys.</p></div>
    <div class="card stack"><h3>Processing an order</h3><ol class="small" style="padding-left:18px"><li>New paid orders arrive as <b>Processing</b> (cash on delivery orders too).</li><li>Create the shipment in Shiprocket/BigShip. The tracking number syncs back.</li><li>When delivered, set the order to <b>Completed</b>. The customer earns reward points at that moment.</li><li>Cancelling or refunding an order gives back any points used and removes points earned.</li></ol></div>`;
  },
  products() {
    const L = B.links;
    return `<h2>Products</h2><p class="muted">Products live in WooCommerce. Add them one by one, or upload many at once with a CSV file that includes image links.</p>
    <div class="adminlinks"><a class="btn" href="${esc(L.newProduct)}">Add a product</a><a class="btn ghost" href="${esc(L.import)}">Bulk upload (CSV)</a><a class="btn ghost" href="${esc(L.products)}">All products</a><a class="btn ghost" href="${esc(L.template)}">Download CSV template</a></div>
    <div class="card stack"><h3>Bulk upload tips</h3><ul class="small" style="padding-left:18px">
      <li><b>Images</b>: paste the full image link (https://…). Separate several images with commas. WooCommerce downloads them into your Media Library.</li>
      <li><b>Regular price</b> is the MRP, <b>Sale price</b> is the selling price.</li>
      <li><b>Categories</b>: Beds, T-Shirts, Winter Jackets, Dog Adult Food, Shampoo (or your own).</li>
      <li><b>Tags</b>: write Dog or Cat so the Dogs / Cats filter in the shop works. Leave empty for both.</li></ul></div>
    <h3>In the shop now (${db.products.length})</h3>
    <div class="tablewrap"><table><thead><tr><th></th><th>Product</th><th>Category</th><th>Pet</th><th>Price</th><th>Stock</th></tr></thead><tbody>
    ${db.products.map(p => `<tr><td style="width:56px"><div class="citem" style="display:block">${pimg(p)}</div></td><td><a href="${esc(p.url)}"><b>${esc(p.name)}</b></a></td><td>${esc(p.cat)}</td><td>${esc(p.pet)}</td><td class="num">${money(p.price)}${p.mrp > p.price ? `<div class="small muted"><s>${money(p.mrp)}</s></div>` : ''}</td><td>${p.stock ? pill('In stock') : pill('Out of stock')}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">No products yet.</td></tr>'}</tbody></table></div>`;
  },
  banners() {
    return `<h2>Shop banners</h2><p class="muted">Banners rotate at the top of the Shop page. Use a wide image (about 1600 × 500). Upload it in Media → Add New and paste its link here.</p>
    <div class="stack">${(db.banners || []).map((b, i) => `<div class="card row between"><div class="row" style="min-width:0;flex:1"><div style="width:120px;height:56px;border-radius:10px;flex:none;background:${esc(b.color)} ${b.img ? `url('${esc(b.img)}') center/cover` : ''}"></div><div style="min-width:0"><b>${esc(b.title)}</b><div class="small muted">${esc(b.sub)}</div>${b.cta ? `<div class="small">Button → ${esc(b.cta)}</div>` : ''}</div></div>
      <div class="row">${i > 0 ? `<button class="btn ghost sm" data-act="ban-up" data-id="${esc(b.id)}">Move up</button>` : ''}${delBtn('del-ban', b.id)}</div></div>`).join('') || '<div class="card muted">No banners. The Shop page shows products only.</div>'}</div>
    <form class="card stack" data-form="banner"><h3>Add a banner</h3><div class="f2">
      <div class="field"><label for="bn-title">Headline</label><input id="bn-title" name="title" type="text" required></div>
      <div class="field"><label for="bn-sub">Subtext</label><input id="bn-sub" name="sub" type="text"></div>
      <div class="field"><label for="bn-img">Image link</label><input id="bn-img" name="img" type="url" placeholder="https://"></div>
      <div class="field"><label for="bn-cta">Button opens category</label><select id="bn-cta" name="cta"><option value="">No button</option>${CATS.map(c => `<option>${esc(c)}</option>`).join('')}</select></div>
      <div class="field"><label for="bn-color">Background colour (if no image)</label><input id="bn-color" name="color" type="text" value="#4B1D00"></div></div>
      <div><button class="btn" type="submit">Add banner</button></div></form>`;
  },
  suggested() {
    const list = db.products.filter(p => p.type === 'simple');
    return `<h2>Checkout suggestions</h2><p class="muted">Products switched on here scroll in a small loop on the grooming checkout. The groomer brings them along and they're added to the booking bill.</p>
    <div class="tablewrap"><table><thead><tr><th>Product</th><th>Price</th><th>Show at checkout</th></tr></thead><tbody>
    ${list.map(p => `<tr><td>${esc(p.name)}</td><td class="num">${money(p.price)}</td><td><label class="toggle"><input type="checkbox" data-chg="prod-sug" data-id="${p.id}" ${isSug(p.id) ? 'checked' : ''} aria-label="Suggest ${esc(p.name)}"><span></span></label></td></tr>`).join('') || '<tr><td colspan="3" class="muted">Add products in WooCommerce first.</td></tr>'}</tbody></table></div>`;
  },
  coupons() {
    return `<h2>Booking coupons</h2><p class="muted"><b>Shown to customers</b>: listed at checkout to tap. <b>Hidden</b>: not listed, but works if a customer types it (for codes you share privately). <b>Booking staff only</b>: only your team can use it when adding a booking. Store coupons are set in WooCommerce → Marketing → Coupons.</p>
    <div class="tablewrap"><table><thead><tr><th>Code</th><th>Discount</th><th>Min. booking</th><th>Description</th><th>Who can use it</th><th>Active</th><th></th></tr></thead><tbody>
    ${db.coupons.map(c => `<tr><td><b>${esc(c.code)}</b></td><td>${c.type === 'pct' ? esc(c.value) + '%' : money(c.value)}</td><td class="num">${money(c.min)}</td><td class="small">${esc(c.desc)}</td>
    <td><select data-chg="cp-vis" data-id="${esc(c.code)}" aria-label="Who can use ${esc(c.code)}">${VIS.map(([v, l]) => `<option value="${v}" ${(c.visibility || 'listed') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
    <td><label class="toggle"><input type="checkbox" data-chg="cp-active" data-id="${esc(c.code)}" ${c.active ? 'checked' : ''} aria-label="Active"><span></span></label></td><td>${delBtn('del-cp', c.code)}</td></tr>`).join('')}</tbody></table></div>
    <form class="card stack" data-form="coupon"><h3>Create a coupon</h3><div class="f3">
      <div class="field"><label for="cp-code">Code</label><input id="cp-code" name="code" type="text" required style="text-transform:uppercase"></div>
      <div class="field"><label for="cp-type">Type</label><select id="cp-type" name="type"><option value="pct">Percent off</option><option value="flat">Flat ₹ off</option></select></div>
      <div class="field"><label for="cp-val">Value</label><input id="cp-val" name="value" type="number" min="1" required></div>
      <div class="field"><label for="cp-min">Minimum booking (₹)</label><input id="cp-min" name="min" type="number" min="0" value="0"></div>
      <div class="field"><label for="cp-vis">Who can use it</label><select id="cp-vis" name="visibility">${VIS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
      <div class="field" style="grid-column:span 2"><label for="cp-desc">Shown to customers as</label><input id="cp-desc" name="desc" type="text" placeholder="10% off your first groom"></div></div>
      <div class="err" id="cp-err" role="alert"></div><div><button class="btn" type="submit">Create coupon</button></div></form>`;
  },
  customers() {
    return `<h2>Customers</h2><p class="muted">Everyone with an account, a booking or reward points. Points belong to the mobile number, so bookings made before signing up still count.</p>` +
      view('customers', () => api('admin/customers'), d => `<div class="tablewrap"><table><thead><tr><th>Customer</th><th>Mobile</th><th>Account</th><th>Bookings</th><th>Points</th></tr></thead><tbody>
      ${d.list.map(c => `<tr><td><b>${esc(c.name || '—')}</b><div class="small muted">${esc(c.email || '')}</div></td><td class="num">${esc(c.phone)}</td><td>${c.registered ? pill('Registered') : '<span class="pill neu">Guest</span>'}</td><td class="num">${c.bookings}</td><td class="num"><b>${c.points}</b></td></tr>`).join('') || '<tr><td colspan="5" class="muted">No customers yet.</td></tr>'}</tbody></table></div>`);
  },
  rewards() {
    const r = db.rewards, ex = 1299;
    return `<h2>Reward points</h2><p class="muted">Customers earn points on completed grooming and completed store orders, and use them at checkout.</p>
    <form class="card stack" data-form="rewards">
      <label class="row" style="font-weight:700"><span class="toggle"><input type="checkbox" name="enabled" ${r.enabled ? 'checked' : ''}><span></span></span> Reward points are switched on</label>
      <div class="f3">
        <div class="field"><label for="rw-b">Points per ₹100 on grooming</label><input id="rw-b" name="bookingRate" type="number" min="0" step="0.5" value="${r.bookingRate}"></div>
        <div class="field"><label for="rw-o">Points per ₹100 on store orders</label><input id="rw-o" name="orderRate" type="number" min="0" step="0.5" value="${r.orderRate}"></div>
        <div class="field"><label for="rw-v">Value of 1 point (₹)</label><input id="rw-v" name="pointValue" type="number" min="0.01" step="0.01" value="${r.pointValue}"></div>
        <div class="field"><label for="rw-m">Minimum points to redeem</label><input id="rw-m" name="minRedeem" type="number" min="0" value="${r.minRedeem}"></div>
        <div class="field"><label for="rw-p">Max % of a bill paid with points</label><input id="rw-p" name="maxPct" type="number" min="1" max="100" value="${r.maxPct}"></div>
        <div class="field"><label for="rw-s">Welcome bonus on sign-up</label><input id="rw-s" name="signupBonus" type="number" min="0" value="${r.signupBonus}"></div></div>
      <p class="small muted">With these settings a ${money(ex)} groom earns ${Math.floor(ex / 100 * r.bookingRate)} points, worth ${money(Math.floor(ex / 100 * r.bookingRate) * r.pointValue)}. Points are added when a booking is marked complete or an order is completed, and taken back if it is cancelled.</p>
      <div><button class="btn" type="submit">Save reward settings</button></div></form>
    <form class="card stack" data-form="pts-adjust"><h3>Add or remove points</h3><p class="small muted">For goodwill gestures or corrections. Use a minus number to remove points.</p><div class="f3">
      <div class="field"><label for="pa-ph">Customer mobile</label><input id="pa-ph" name="phone" type="tel" required></div>
      <div class="field"><label for="pa-pts">Points</label><input id="pa-pts" name="pts" type="number" required placeholder="e.g. 50 or -20"></div>
      <div class="field"><label for="pa-r">Reason</label><input id="pa-r" name="reason" type="text" placeholder="Goodwill for late arrival"></div></div>
      <div class="err" id="pa-err" role="alert"></div><div><button class="btn" type="submit">Update points</button></div></form>
    <h3>Recent point activity</h3>` + view('points', recList('points'), d => `<div class="tablewrap"><table><thead><tr><th>When</th><th>Mobile</th><th>Points</th><th>Reason</th></tr></thead><tbody>
    ${d.list.slice(0, 60).map(p => `<tr><td class="small">${esc(p.at)}</td><td class="num">${esc(p.phone)}</td><td class="num ${p.pts > 0 ? 'plus' : 'minus'}">${p.pts > 0 ? '+' : ''}${p.pts}</td><td class="small">${esc(p.reason)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No activity yet.</td></tr>'}</tbody></table></div>`);
  },
  insform() {
    const types = [['text','Short text'],['textarea','Long text'],['email','Email'],['tel','Phone'],['number','Number'],['date','Date'],['select','Dropdown'],['radio','Choice buttons'],['checkbox','Checkbox']];
    return `<h2>Insurance form</h2><p class="muted">Add, remove, reorder and edit the questions customers see. Changes go live immediately.</p>
    <div class="tablewrap"><table><thead><tr><th>Order</th><th>Question</th><th>Type</th><th>Options (comma separated)</th><th>Required</th><th></th></tr></thead><tbody>
    ${db.insFields.map((f, i) => `<tr><td class="row" style="flex-wrap:nowrap"><button class="btn ghost sm" data-act="if-up" data-id="${esc(f.id)}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button><button class="btn ghost sm" data-act="if-down" data-id="${esc(f.id)}" ${i === db.insFields.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button></td>
      <td><input type="text" value="${esc(f.label)}" data-chg="if-label" data-id="${esc(f.id)}" aria-label="Question"></td>
      <td><select data-chg="if-type" data-id="${esc(f.id)}" aria-label="Type">${types.map(([v, l]) => `<option value="${v}" ${f.type === v ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
      <td><input type="text" value="${esc(f.options)}" data-chg="if-opts" data-id="${esc(f.id)}" ${['select','radio','checkbox'].includes(f.type) ? '' : 'disabled'} aria-label="Options"></td>
      <td><label class="toggle"><input type="checkbox" data-chg="if-req" data-id="${esc(f.id)}" ${f.required ? 'checked' : ''} aria-label="Required"><span></span></label></td><td>${delBtn('del-if', f.id, 'Remove')}</td></tr>`).join('')}</tbody></table></div>
    <form class="card row" data-form="insfield" style="align-items:end"><div class="field" style="flex:2;min-width:200px"><label for="if-new">New question</label><input id="if-new" name="label" type="text" required></div>
      <div class="field" style="flex:1;min-width:150px"><label for="if-newtype">Type</label><select id="if-newtype" name="type">${types.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div><button class="btn" type="submit">Add question</button></form>
    <button class="btn ghost sm" style="align-self:start" data-act="go" data-v="insurance">Preview the form</button>`;
  },
  insleads() {
    return `<h2>Insurance leads</h2>` + view('insleads', recList('insurance'), d => {
      const cols = [...new Set(d.list.flatMap(l => Object.keys(l.data || {})))];
      return d.list.length ? `<div class="tablewrap"><table><thead><tr><th>Received</th><th>Status</th>${cols.map(c => `<th>${esc(c)}</th>`).join('')}<th></th></tr></thead><tbody>
      ${d.list.map(l => `<tr><td class="small">${esc(l.created)}</td><td><select data-chg="rec-status" data-type="insurance" data-id="${esc(l.id)}" aria-label="Status">${['New','Contacted','Closed'].map(s => `<option ${l.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></td>${cols.map(c => `<td class="small">${esc((l.data || {})[c] || '')}</td>`).join('')}<td>${delBtn('rec-del', l.id, 'Delete', 'data-type="insurance"')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="card muted">No leads yet.</div>';
    });
  },
  enquiries() {
    return `<h2>Enquiries</h2>` + view('enquiries', recList('enquiry'), d => d.list.length ? `<div class="tablewrap"><table><thead><tr><th>Received</th><th>Name</th><th>Phone</th><th>Message</th><th></th></tr></thead><tbody>
    ${d.list.map(e => `<tr><td class="small">${esc(e.created)}</td><td>${esc(e.name)}</td><td class="num">${esc(e.phone)}</td><td class="small">${esc(e.msg)}</td><td>${delBtn('rec-del', e.id, 'Delete', 'data-type="enquiry"')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="card muted">No messages from the Contact page yet.</div>');
  },
  notifs() {
    return `<div class="row between"><h2>Notifications log</h2><button class="btn ghost sm" data-act="retry" data-v="notifs">Refresh</button></div><p class="muted">Every email and WhatsApp message the site sends, and whether it went through.</p>` +
      view('notifs', recList('notif'), d => d.list.length ? `<div class="tablewrap"><table><thead><tr><th>Time</th><th>Channel</th><th>To</th><th>Message</th><th>Result</th></tr></thead><tbody>
      ${d.list.map(n => `<tr><td class="small">${esc(n.at)}</td><td>${esc(n.channel)}</td><td class="small num">${esc(n.to)}</td><td class="small"><b>${esc(n.subject)}</b><br>${esc(n.body)}</td><td class="small">${pill(n.result)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="card muted">Nothing sent yet. Make a test booking to see the messages.</div>');
  },
  import() {
    const sc = S.bpScan, run = S.bpRun;
    const intro = `<h2>Import from BookingPress</h2>
      <p class="muted">Copies your old BookingPress customers and bookings into Wag &amp; Tails. Nothing in BookingPress is changed or deleted. You can run it again later to bring in newer bookings: anything already imported is skipped.</p>
      <div class="card stack"><h3>1. Find your BookingPress data</h3>
        <p class="small muted">If BookingPress is installed on this same WordPress site, just press Scan. If your old site is a separate WordPress install, first copy its tables that start with <b>bookingpress_</b> into this site's database (phpMyAdmin → Export on the old site, Import on this one), then scan.</p>
        <div class="row" style="align-items:end"><div class="field"><label for="bp-prefix">Table prefix</label><input id="bp-prefix" type="text" value="${esc(S.bpPrefix || (sc && sc.prefix) || '')}" placeholder="wp_" style="width:140px"></div>
        <button class="btn" data-act="bp-scan">${sc ? 'Scan again' : 'Scan'}</button></div><div class="err" id="bp-err" role="alert"></div></div>`;
    if (!sc) return intro;
    const svcOpts = v => `<option value="">Keep the old name</option>` + db.packages.map(p => `<option value="${esc(p.id)}" ${v === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
    const saved = sc.saved || {};
    const fieldVal = f => (saved.fields && saved.fields[f.key] !== undefined) ? saved.fields[f.key] : f.guess;
    const guessSvc = name => { if (saved.services && saved.services[name] !== undefined) return saved.services[name]; const n = String(name).toLowerCase(); const hit = db.packages.find(p => n.includes(p.name.toLowerCase())); return hit ? hit.id : ''; };
    return intro + `
      <div class="kpis"><div class="kpi"><span class="muted small">Customers found</span><b class="num">${sc.customers}</b></div><div class="kpi"><span class="muted small">Bookings found</span><b class="num">${sc.bookings}</b></div><div class="kpi"><span class="muted small">Already imported</span><b class="num">${sc.imported}</b></div><div class="kpi"><span class="muted small">Booking dates</span><b class="small" style="font-size:.95rem">${sc.dates[0] ? fmtDate(String(sc.dates[0]).slice(0, 10)) + ' – ' + fmtDate(String(sc.dates[1]).slice(0, 10)) : '—'}</b></div></div>
      ${sc.statuses.length ? `<p class="small muted">Statuses: ${sc.statuses.map(x => `${esc(x.label)} ${x.n}`).join(' · ')}</p>` : ''}
      <form class="stack" data-form="bp-import">
      <div class="card stack"><h3>2. Match your old services to packages</h3>
        <p class="small muted">Prices are kept exactly as they were in each old booking. This only sets the package name shown.</p>
        <div class="tablewrap"><table><thead><tr><th>Old service</th><th>Bookings</th><th>Show as</th></tr></thead><tbody>
        ${sc.services.map((x, i) => `<tr><td>${esc(x.name || '(no name)')}</td><td class="num">${x.n}</td><td><select name="svc_${i}" data-name="${esc(x.name || '')}">${svcOpts(guessSvc(x.name))}</select></td></tr>`).join('') || '<tr><td colspan="3" class="muted">No services found.</td></tr>'}</tbody></table></div></div>
      <div class="card stack"><h3>3. Match your old form fields</h3>
        <p class="small muted">These are the extra questions from your BookingPress form, with real answers from your bookings. Fields left as "Keep in notes" are saved in the booking's notes so nothing is lost.</p>
        <div class="tablewrap"><table><thead><tr><th>Old field</th><th>Example answers</th><th>Used in</th><th>Save as</th></tr></thead><tbody>
        ${sc.fields.map((f, i) => `<tr><td><b>${esc(f.label)}</b><div class="small muted">${esc(f.key)}</div></td><td class="small">${f.samples.map(esc).join('<br>')}</td><td class="num small">${f.count}</td><td><select name="fld_${i}" data-key="${esc(f.key)}">${Object.entries(sc.targets).map(([v, l]) => `<option value="${v}" ${fieldVal(f) === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></td></tr>`).join('') || '<tr><td colspan="4" class="muted">No extra form fields found. Name, phone, email, date, time and price are imported automatically.</td></tr>'}</tbody></table></div></div>
      <div class="card stack"><h3>4. Options</h3>
        <div class="field" style="max-width:340px"><label for="bp-city">City for bookings where no city can be found</label><select id="bp-city" name="defaultCity">${db.cities.map(c => `<option value="${esc(c.id)}" ${saved.defaultCity === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
          <span class="small muted">The city is read from a city field, the service name, the address or the pincode first.</span></div>
        <label class="row" style="font-weight:600;flex-wrap:nowrap;align-items:flex-start"><input type="checkbox" name="pastCompleted" ${saved.pastCompleted === false ? '' : 'checked'}> Mark past approved bookings as completed (BookingPress often leaves finished visits as "Approved")</label>
        <label class="row" style="font-weight:600;flex-wrap:nowrap;align-items:flex-start"><input type="checkbox" name="givePoints" ${saved.givePoints ? 'checked' : ''}> Give reward points for past completed bookings (no WhatsApp message is sent for these)</label>
        <p class="note small"><b>No messages are sent during import.</b> Customers are not emailed or messaged about old bookings.</p>
        <div class="row">${run && run.busy ? '' : `<button class="btn" type="submit">${sc.imported ? 'Import new bookings' : 'Start import'}</button>`}</div>
        ${run ? `<div class="stack" style="gap:6px"><p><b>${esc(run.msg)}</b></p>${run.notes && run.notes.length ? `<details><summary class="small">${run.notes.length} note${run.notes.length === 1 ? '' : 's'}</summary><ul class="small">${run.notes.slice(0, 200).map(n => `<li>${esc(n)}</li>`).join('')}</ul></details>` : ''}</div>` : ''}
      </div></form>
      ${sc.imported || (run && run.done) ? `<div class="card row between"><div><h3>Undo the import</h3><p class="small muted">Removes every booking and customer that came from BookingPress, and any points given for them. Bookings made on the new site are not touched.</p></div>${delBtn('bp-undo', 'all', 'Undo import')}</div>` : ''}`;
  },
  settings() {
    const s = db.settings, ev = B.waEvents || {};
    return `<h2>Settings</h2>
    <form class="card stack" data-form="settings">
      <h3>Booking alerts</h3><p class="small muted">Every new booking, walk request and insurance enquiry is sent to this email and WhatsApp number.</p>
      <div class="f2"><div class="field"><label for="s-ne">Alert email</label><input id="s-ne" name="notifyEmail" type="email" value="${esc(s.notifyEmail)}"></div>
      <div class="field"><label for="s-nw">Alert WhatsApp number (with 91)</label><input id="s-nw" name="notifyWhatsApp" type="tel" value="${esc(s.notifyWhatsApp)}" placeholder="919876543210"></div></div>
      <h3>Booking times</h3><p class="small muted">Time slots are worked out from these hours, each package's length (Packages &amp; prices) and bookings already made. With a 60-minute package and 30 minutes buffer, a 9:30am booking blocks the groomer until 11:00am.</p>
      <div class="f3"><div class="field"><label for="s-ds">First start time</label><input id="s-ds" name="dayStart" type="time" value="${esc(s.dayStart || '09:00')}"></div>
      <div class="field"><label for="s-de">Day ends at</label><input id="s-de" name="dayEnd" type="time" value="${esc(s.dayEnd || '19:00')}"></div>
      <div class="field"><label for="s-st">Show a slot every (minutes)</label><input id="s-st" name="slotStep" type="number" min="15" step="15" value="${esc(s.slotStep || 30)}"></div>
      <div class="field"><label for="s-bf">Buffer after each groom (minutes)</label><input id="s-bf" name="bufferMins" type="number" min="0" step="5" value="${esc(s.bufferMins ?? 30)}"></div>
      <div class="field"><label for="s-ld">Earliest booking from now (minutes)</label><input id="s-ld" name="leadMins" type="number" min="0" step="15" value="${esc(s.leadMins ?? 60)}"></div></div>
      <div class="f2">
      <div class="field"><label for="s-md">How many days ahead customers can book</label><input id="s-md" name="maxDaysAhead" type="number" min="1" max="180" value="${esc(s.maxDaysAhead)}"></div></div>
      <h3>Review request message</h3><div class="field"><label for="s-rv">WhatsApp message sent with "Take review"</label><textarea id="s-rv" name="reviewMsg">${esc(s.reviewMsg)}</textarea><span class="small muted">{name} becomes the customer's first name, {pet} the pet breed, {link} the review link of that booking's city (set in Cities &amp; walking).</span></div>
      <h3>Razorpay (grooming payments)</h3>
      <p class="small muted">From Razorpay Dashboard → Account &amp; Settings → API Keys. Use test keys first, then live keys. ${s.razorpayOn ? pill('Connected') : '<span class="pill warn">Not connected</span>'}</p>
      <div class="f2"><div class="field"><label for="s-rz">Key ID</label><input id="s-rz" name="razorpayKey" type="text" value="${esc(s.razorpayKey)}" placeholder="rzp_live_… or rzp_test_…"></div>
      <div class="field"><label for="s-rs">Key Secret</label><input id="s-rs" name="razorpaySecret" type="password" autocomplete="new-password" placeholder="${s.secretSet ? 'Saved. Leave blank to keep it' : 'Paste the key secret'}"></div></div>
      <p class="small muted">Store orders use the "Razorpay for WooCommerce" plugin with the same keys.</p>
      <h3>WhatsApp messages</h3>
      <div class="f2"><div class="field"><label for="s-wm">Send WhatsApp messages using</label><select id="s-wm" name="waMode"><option value="off" ${s.waMode === 'off' ? 'selected' : ''}>Off (only list them in the log)</option><option value="cloud" ${s.waMode === 'cloud' ? 'selected' : ''}>Meta WhatsApp Cloud API</option><option value="webhook" ${s.waMode === 'webhook' ? 'selected' : ''}>Webhook (AiSensy, Interakt, Zapier, Pabbly…)</option></select></div>
      <div class="field"><label for="s-wl">Template language code</label><input id="s-wl" name="waLang" type="text" value="${esc(s.waLang)}" placeholder="en"></div>
      <div class="field"><label for="s-wp">Phone number ID (Cloud API)</label><input id="s-wp" name="waPhoneId" type="text" value="${esc(s.waPhoneId)}"></div>
      <div class="field"><label for="s-wt">Access token (Cloud API)</label><input id="s-wt" name="waToken" type="password" autocomplete="new-password" placeholder="${s.waTokenSet ? 'Saved. Leave blank to keep it' : 'Permanent access token'}"></div>
      <div class="field" style="grid-column:1/-1"><label for="s-wh">Webhook URL</label><input id="s-wh" name="webhookUrl" type="url" value="${esc(s.webhookUrl)}" placeholder="https://"><span class="small muted">The site sends JSON: event, to, message, params.</span></div></div>
      <div class="note small"><b>Delivery reports.</b> To see whether each WhatsApp message was delivered or why it failed, open your app in developers.facebook.com → WhatsApp → Configuration → Webhook → Edit, and paste:<br>Callback URL: <b style="user-select:all">${esc(s.waHookUrl || '')}</b><br>Verify token: <b style="user-select:all">${esc(s.waHookToken || '')}</b><br>Then click Manage and subscribe to <b>messages</b>. Results appear in the Notifications log.</div>
      <p class="small muted">For the Cloud API, each message needs an approved template in Meta Business Manager. Enter each template's name below. Its body variables must be in the order shown.</p>
      <div class="tablewrap waTable"><table><thead><tr><th>Message</th><th>Template variables, in order</th><th>Template name</th></tr></thead><tbody>
      ${Object.entries(ev).map(([k, e]) => `<tr><td><b>${esc(e.label)}</b></td><td class="small">${e.vars.map((v, i) => `{{${i + 1}}} ${esc(v)}`).join('<br>')}</td><td><input type="text" name="tpl_${esc(k)}" value="${esc((s.waTemplates || {})[k] || '')}" aria-label="Template name"></td></tr>`).join('')}</tbody></table></div>
      <h3>Shipping panel</h3><div class="field"><label for="s-sp">Link to your Shiprocket or BigShip panel</label><input id="s-sp" name="shipPanel" type="url" value="${esc(s.shipPanel)}"></div>
      <h3>Contact details shown on the site</h3><div class="f2">
        <div class="field"><label for="s-ph">Phone</label><input id="s-ph" name="phone" type="text" value="${esc(s.phone)}"></div>
        <div class="field"><label for="s-em">Email</label><input id="s-em" name="email" type="email" value="${esc(s.email)}"></div></div>
      <div class="field"><label for="s-ad">Address</label><input id="s-ad" name="address" type="text" value="${esc(s.address)}"></div>
      <div><button class="btn" type="submit">Save settings</button></div></form>
    <p class="small muted">Admin login and password are your WordPress login. Change them in WordPress → Users → Profile.</p>`;
  }
};

/* ---------- modal / layer ---------- */
function openModal(html) { $('#layer').innerHTML = `<div class="scrim" data-act="scrim"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`; const f = $('#layer input:not([type=hidden]), #layer select, #layer button'); if (f) f.focus(); }
function closeLayer() { $('#layer').innerHTML = ''; }
function cityGate(force) {
  const cs = db.cities.filter(c => c.service);
  $('#layer').innerHTML = `<div class="scrim"${force ? '' : ' data-act="scrim"'}><div class="gate" role="dialog" aria-modal="true" aria-labelledby="gate-h">
    <div class="head"><img src="${LOGO}" alt=""><div><h2 id="gate-h">Which city are you in?</h2><p class="muted">Grooming packages and prices depend on your city.</p></div></div>
    <div class="gatecities">${cs.map(c => `<button data-act="setcity" data-v="${esc(c.id)}">${esc(c.name)}<small>Home grooming${c.walking ? ' · Dog walking' : ''}</small></button>`).join('')}
      <button class="other" data-act="othercity">My city isn't listed<small>Shop &amp; pet insurance</small></button></div>
    <div id="other-box" hidden style="margin-top:14px"><form class="row" data-form="othercity" style="align-items:end"><div class="field" style="flex:1;min-width:200px"><label for="oc">Your city</label><input id="oc" type="text" placeholder="e.g. Bhopal"></div><button class="btn" type="submit">Continue</button></form></div>
  </div></div>`;
}

/* ---------- render & routing ---------- */
const PAGES = {home: pageHome, book: pageBook, booked: pageBooked, walk: pageWalk, shop: pageShop, insurance: pageInsurance, about: pageAbout, contact: pageContact, login: pageLogin, account: pageAccount, admin: pageAdmin, staff: pageStaff, thanks: pageThanks};
function allowed(v) {
  if (!PAGES[v]) return false;
  if (v === 'book') return isService();
  if (v === 'walk') return walkOn();
  return true;
}
function go(v) {
  if (!allowed(v)) v = 'home';
  if (location.hash.slice(1) !== v) { location.hash = v; } else { S.view = v; render(); window.scrollTo(0, 0); }
}
function fromHash() {
  let v = location.hash.slice(1);
  if (!v) v = role === 'admin' ? 'admin' : role === 'staff' ? 'staff' : 'home';
  if ((v === 'admin' && role !== 'admin') || (v === 'staff' && role !== 'staff' && role !== 'admin') || (v === 'account' && role !== 'customer') || (v === 'perf' && role !== 'staff') || (v === 'clients' && role !== 'staff' && role !== 'admin') || (v === 'gate' && role !== 'staff' && role !== 'admin') || (v === 'complaints' && role !== 'staff' && role !== 'admin') || (v === 'complaint' && role !== 'customer')) { if (!role) S.loginAs = (v === 'account' || v === 'complaint') ? 'customer' : v; v = role ? 'home' : 'login'; }
  if (!allowed(v)) v = 'home';
  S.view = v;
}
window.addEventListener('hashchange', () => { fromHash(); render(); window.scrollTo(0, 0); });
function render() {
  if (MAP) { MAP.remove(); MAP = null; MARK = null; }
  CHQ = [];
  const bare = ['admin', 'staff', 'perf', 'clients', 'gate', 'complaints'].includes(S.view);
  const isBook = S.view === 'book' && isService();
  $('#app').className = isBook ? 'with-mbar' : 'with-tabs';
  const gated = role === 'staff' && ATT && ATT.required && !ATT.in;
  $('#app').innerHTML = header() + `<main>${staffGate((PAGES[S.view] || pageHome)())}</main>` + (bare || gated ? '' : footer()) + (isBook || gated ? '' : tabbar());
  if (S.view === 'book' && BK && BK.step === 3) initMap();
  drawCharts();
}
function rerenderKeep() {
  const a = document.activeElement, id = a && a.id, pos = a && typeof a.selectionStart === 'number' ? a.selectionStart : null;
  const y = window.scrollY; render(); window.scrollTo(0, y);
  if (id) { const el = document.getElementById(id); if (el) { el.focus(); if (pos !== null && el.setSelectionRange) try { el.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } } }
}
setInterval(() => { if (S.view !== 'shop' || (db.banners || []).length < 2 || $('#layer').innerHTML || (document.activeElement && /INPUT|SELECT/.test(document.activeElement.tagName))) return; S.banner = (S.banner + 1) % db.banners.length; const y = window.scrollY; render(); window.scrollTo(0, y); }, 6000);

/* ---------- actions ---------- */
async function deskAct(ref, body, msg) {
  try { await api('desk/bookings/' + encodeURIComponent(ref), {method: 'POST', body}); drop('desk'); drop('dash'); drop('stats'); drop('loyal'); closeLayer(); rerenderKeep(); if (msg) toast(msg); return true; }
  catch (e) { const m = $('#m-err'); if (m) m.textContent = e.message; else toast(e.message); return false; }
}
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-act]'); if (!t || !t.closest('#wt-root')) return;
  const a = t.dataset.act, id = t.dataset.id, v = t.dataset.v;
  if (a === 'scrim' && e.target !== t) return;
  if (t.hasAttribute('data-confirm') && !t.classList.contains('armed')) {
    e.preventDefault(); t.classList.add('armed'); t.dataset.label = t.textContent; t.textContent = 'Confirm?';
    setTimeout(() => { if (t.isConnected) { t.classList.remove('armed'); t.textContent = t.dataset.label; } }, 3000); return;
  }
  const cfgChange = (msg) => { saveConfig(msg, true); rerenderKeep(); };
  switch (a) {
    case 'go': if (t.closest('#layer')) closeLayer(); go(v); break;
    case 'retry': delete C[v]; rerenderKeep(); break;
    case 'city': cityGate(false); break;
    case 'more': moreSheet(); break;
    case 'setcity': S.city = v; ls('wt_city', v); BK = null; closeLayer(); if (!allowed(S.view)) go('home'); else render(); toast('Showing ' + cityName(v)); break;
    case 'othercity': $('#other-box').hidden = false; $('#oc').focus(); break;
    case 'scrim': case 'close': closeLayer(); break;
    case 'add': addToCart(id); break;
    case 'pick-pkg': { const pk = pkgObj(id); BK = newDraft(); BK.pkg = id; if (pk && pk.pet !== 'Both') BK.petType = pk.pet; BK.step = 2; go('book'); break; }
    case 'cat': S.shopCat = v; S.shopN = 24; if (S.view !== 'shop') go('shop'); else rerenderKeep(); break;
    case 'pet': S.shopPet = v; S.shopN = 24; if (S.shopBreed && !S.shopBreed.startsWith(v + '|')) { S.shopBreed = ''; S.shopSize = 'All'; } rerenderKeep(); break;
    case 'shop-size': S.shopSize = v; S.shopBreed = ''; S.shopN = 24; rerenderKeep(); break;
    case 'shop-more': S.shopN += 24; rerenderKeep(); break;
    case 'shop-clear': Object.assign(S, {shopCat: 'All', shopPet: 'All', shopSize: 'All', shopBreed: '', shopQ: '', shopSort: 'pop', shopN: 24}); rerenderKeep(); break;
    case 'pview': e.preventDefault(); openProduct(id); break;
    case 'pv-img': if (PV) { PV.img = Number(v); pvRedraw(); } break;
    case 'pv-opt': if (PV) { const k = t.dataset.k; PV.sel[k] = PV.sel[k] === v ? '' : v; PV.img = 0; pvRedraw(); } break;
    case 'pv-add': if (PV) {
      const vr = PV.p.opts ? pickVar(PV.p, PV.sel) : null; t.disabled = true;
      const label = vr ? PV.p.opts.map(o => (o.vals.find(x => x.v === PV.sel[o.k]) || {}).t).filter(Boolean).join(', ') : '';
      const ok = await addToCartRaw(vr ? vr.id : PV.p.id, label);
      if (ok) closeLayer(); else t.disabled = false;
    } break;
    case 'banner': S.banner = Number(t.dataset.i); rerenderKeep(); break;
    case 'login-as': S.loginAs = t.value; S.regMode = false; render(); break;
    case 'reg-toggle': S.regMode = !S.regMode; render(); break;
    case 'logout': try { await api('logout', {method: 'POST'}); } catch (err) { /* ignore */ } location.hash = 'home'; location.reload(); break;
    /* booking */
    case 'addon': BK.addons = BK.addons.includes(Number(id)) ? BK.addons.filter(x => x !== Number(id)) : [...BK.addons, Number(id)]; refreshSummary(); break;
    case 'bk-pick': BK.coupon = BK.coupon.toUpperCase() === v ? '' : v; refreshSummary(); break;
    case 'bk-coupon': {
      const code = $('#bk-coupon').value.trim().toUpperCase(); BK.coupon = code;
      if (code && !db.coupons.some(c => c.code.toUpperCase() === code) && typeof XCP[code] !== 'object') {
        XCP[code] = 'checking'; refreshSummary();
        try { const r = await api('coupon', {method: 'POST', body: {code}}); XCP[code] = r.coupon; } catch (err) { delete XCP[code]; XCP['__bad_' + code] = err.message; }
      }
      refreshSummary(); break; }
    case 'bk-step': { const n = Number(v); if (n < BK.step) goStep(n); break; }
    case 'bk-date': { BK.date = v; BK.start = ''; BK.slotLabel = ''; const di = $('#bk-date'); if (di) di.value = v; document.querySelectorAll('.day').forEach(d => d.classList.toggle('on', d.dataset.v === v)); const el = $('#bk-slots'); if (el) el.innerHTML = slotGrid(); refreshSummary(); break; }
    case 'locate': {
      const l = $('#bk-loc'); l.textContent = 'Finding you…';
      if (!navigator.geolocation) { l.textContent = 'Your browser cannot share location. Tap the map instead.'; break; }
      navigator.geolocation.getCurrentPosition(p => setPin(p.coords.latitude, p.coords.longitude, true), () => { l.textContent = 'Location access was blocked. Tap the map to drop a pin.'; }, {enableHighAccuracy: true, timeout: 10000});
      break; }
    /* desk */
    case 'desk-filter': S.deskFilter = v; rerenderKeep(); break;
    case 'desk-add': addBookingModal(); break;
    case 'desk-disc': { const b = findBooking(id); if (b) discountModal(b); break; }
    case 'desk-redo': { const b = findBooking(id); if (b) redoModal(b); break; }
    case 'rm-send': runReminders(); break;
    case 'cl-open': openClient(id, false); break;
    case 'cl-new': openClient('', true); break;
    case 'cl-page': S.cl.page = Number(v); rerenderKeep(); window.scrollTo(0, 0); break;
    case 'pet-del': { const row = t.closest('.petrow'); if (row) row.remove(); break; }
    case 'pw-mode': S.pwMode = !S.pwMode; render(); break;
    case 'otp-change': S.otp = {phone: S.otp.phone, sent: false, needName: false, wait: 0}; render(); break;
    case 'otp-resend': try { await api('otp/send', {method: 'POST', body: {phone: S.otp.phone}}); S.otp.wait = Date.now() + 30000; toast('New code sent on WhatsApp'); setTimeout(() => S.view === 'login' && render(), 30500); render(); } catch (err) { toast(err.message); } break;
    case 'rm-csv': try { await downloadReport('__rm', {i: v}); } catch (err) { toast(err.message); } break;
    case 'rm-test': t.disabled = true; try { await api('admin/remind/test', {method: 'POST', body: {phone: $('#rm-test').value}}); toast('Test reminder sent. Check WhatsApp.'); } catch (err) { toast(err.message); } t.disabled = false; break;
    case 'cp-noimg': { const i = $('#cp-img'); if (i) i.value = ''; const f = document.querySelector('form[data-form=campaign]'); try { await campaignSave(f); drop('campaign'); rerenderKeep(); } catch (err) { toast(err.message); } break; }
    case 'cp-test': { const f = document.querySelector('form[data-form=campaign]'); t.disabled = true; try { await campaignSave(f, {action: 'test', to: $('#cp-to').value}); toast('Test email sent to ' + $('#cp-to').value); } catch (err) { toast(err.message); } t.disabled = false; break; }
    case 'cp-stop': try { await api('admin/campaign', {method: 'POST', body: {action: 'stop'}}); drop('campaign'); rerenderKeep(); toast('Stopped. Switch it on again when ready.'); } catch (err) { toast(err.message); } break;
    case 'desk-disc-remove': await deskAct(id, {action: 'discount', value: 0, reason: 'Discount removed'}, 'Discount removed'); break;
    case 'desk-complete': completeModal(findBooking(id)); break;
    case 'desk-cancel': cancelModal(findBooking(id)); break;
    case 'desk-resched': reschedModal(findBooking(id)); break;
    case 'desk-edit': { const b = findBooking(id); if (b) editModal(b); break; }
    case 'bk-view': bookingDetail(id); break;
    case 'bk-delete': deskAct(id, {action: 'delete'}, 'Booking deleted'); break;
    case 'review': api('desk/bookings/' + encodeURIComponent(id), {method: 'POST', body: {action: 'review'}}).then(() => { drop('desk'); drop('dash'); rerenderKeep(); }).catch(() => {}); break;
    case 'review-missing': if (role === 'admin') { toast('Add the Google review link for ' + cityName(id) + ' first.'); S.adminTab = 'cities'; go('admin'); } else toast('Ask the admin to add the review link for ' + cityName(id) + '.'); break;
    /* admin */
    case 'tab': S.adminTab = v; if (S.view !== 'admin') go('admin'); else { render(); window.scrollTo(0, 0); } break;
    case 'del-pkg': db.packages = db.packages.filter(x => x.id !== id); cfgChange('Package removed'); break;
    case 'del-city': db.cities = db.cities.filter(x => x.id !== id); cfgChange('City removed'); break;
    case 'del-wplan': db.walkPlans = db.walkPlans.filter(x => x.id !== id); cfgChange('Plan removed'); break;
    case 'del-ban': db.banners = db.banners.filter(x => x.id !== id); S.banner = 0; cfgChange('Banner removed'); break;
    case 'ban-up': { const i = db.banners.findIndex(x => x.id === id); if (i > 0) [db.banners[i - 1], db.banners[i]] = [db.banners[i], db.banners[i - 1]]; cfgChange(); break; }
    case 'del-cp': db.coupons = db.coupons.filter(x => x.code !== id); cfgChange('Coupon removed'); break;
    case 'del-if': db.insFields = db.insFields.filter(x => x.id !== id); cfgChange('Question removed'); break;
    case 'if-up': case 'if-down': { const i = db.insFields.findIndex(x => x.id === id), j = a === 'if-up' ? i - 1 : i + 1; if (j >= 0 && j < db.insFields.length) [db.insFields[i], db.insFields[j]] = [db.insFields[j], db.insFields[i]]; cfgChange(); break; }
    case 'rec-del': try { await api('admin/records/' + encodeURIComponent(id), {method: 'POST', body: {type: t.dataset.type, action: 'delete'}}); drop({walk: 'walks', insurance: 'insleads', enquiry: 'enquiries'}[t.dataset.type]); drop('dash'); rerenderKeep(); toast('Deleted'); } catch (err) { toast(err.message); } break;
    case 'bp-scan': {
      const btn = t; btn.disabled = true; btn.textContent = 'Scanning…'; S.bpPrefix = ($('#bp-prefix') || {}).value || '';
      try { S.bpScan = await api('admin/bp/scan', {method: 'POST', body: {prefix: S.bpPrefix}}); S.bpRun = null; rerenderKeep(); }
      catch (err) { const el = $('#bp-err'); if (el) el.textContent = err.message; btn.disabled = false; btn.textContent = 'Scan'; }
      break; }
    case 'bp-undo': try { const r = await api('admin/bp/undo', {method: 'POST'}); S.bpRun = {msg: `Removed ${r.removed} imported bookings.`}; S.bpScan = await api('admin/bp/scan', {method: 'POST', body: {prefix: S.bpPrefix || S.bpScan.prefix}}); drop('desk'); drop('dash'); drop('customers'); rerenderKeep(); toast('Import undone'); } catch (err) { toast(err.message); } break;
    case 'del-staff': try { await api('admin/staff/' + id + '/delete', {method: 'POST'}); drop('staff'); rerenderKeep(); toast('Staff login removed'); } catch (err) { toast(err.message); } break;
    default: await teamClick(a, t, id, v);
  }
});

let qTimer = null;
document.addEventListener('input', e => {
  const t = e.target; if (!t.closest('#wt-root')) return;
  if (t.dataset.bk && BK) {
    const k = t.dataset.bk; BK[k] = t.type === 'checkbox' ? t.checked : t.value;
    if (k === 'city') { S.city = BK.city; ls('wt_city', S.city); const hd = document.querySelector('header.top'); if (hd) hd.outerHTML = header(); BK.pkg = ''; BK.start = ''; BK.slotLabel = ''; const pk = $('#bk-pkgs'); if (pk) pk.innerHTML = pkgCards(); }
    if (k === 'petType') { BK.breed = ''; if (!pkgsFor(BK).some(p => p.id === BK.pkg)) BK.pkg = ''; const pk = $('#bk-pkgs'); if (pk) pk.innerHTML = pkgCards(); }
    if (k === 'pkg') { BK.start = ''; BK.slotLabel = ''; }
    if (k === 'date') { BK.start = ''; BK.slotLabel = ''; document.querySelectorAll('.day').forEach(d => d.classList.toggle('on', d.dataset.v === BK.date)); const el = $('#bk-slots'); if (el) el.innerHTML = slotGrid(); }
    if (k === 'start') BK.slotLabel = t.dataset.label || '';
    if (['city','pkg','petType','pay','date','start','usePts'].includes(k)) refreshSummary();
  }
  if (t.id === 'dd-v') discCalc();
  if ((t.id === 'dd-v' || t.id === 'dd-r') && $('#m-err')) $('#m-err').textContent = '';
  if (t.id === 'cl-q') { clearTimeout(qTimer); qTimer = setTimeout(() => { S.cl.q = t.value.trim(); S.cl.page = 1; rerenderKeep(); }, 400); }
  if (t.id === 'da-phone') { const d = t.value.replace(/\D/g, '').slice(-10); if (d.length === 10) deskLookup(d); }
  if (t.id === 'shop-q') { clearTimeout(qTimer); qTimer = setTimeout(() => { S.shopQ = t.value.trim(); S.shopN = 24; rerenderKeep(); }, 300); }
  if (t.id === 'desk-q') { clearTimeout(qTimer); qTimer = setTimeout(() => { S.deskQ = t.value.trim(); rerenderKeep(); }, 350); }
});

document.addEventListener('change', async e => {
  const t = e.target, k = t.dataset.chg, id = t.dataset.id; if (!k || !t.closest('#wt-root')) return;
  const quiet = msg => saveConfig(msg);
  const loud = msg => { saveConfig(msg); rerenderKeep(); };
  switch (k) {
    case 'desk-city': S.deskCity = t.value; rerenderKeep(); break;
    case 'shop-sort': S.shopSort = t.value; rerenderKeep(); break;
    case 'shop-breed': {
      S.shopBreed = t.value; S.shopN = 24;
      const d = catData();
      if (t.value && d) { const br = breedSize(d, t.value); S.shopPet = br.pet; S.shopSize = br.size || 'All'; } else S.shopSize = 'All';
      rerenderKeep(); break; }
    case 'disc-calc': discCalc(); break;
    case 'cl-f': S.cl[t.dataset.k] = t.value; S.cl.page = 1; rerenderKeep(); break;
    case 'edit-slots': { const f = t.closest('form'); const b = findBooking(f.dataset.id); if (b) fillSlotSelect('#de-s', {city: b.city, date: t.value, ref: b.id}); break; }
    case 'redo-slots': { const f = t.closest('form'); const b = findBooking(f.dataset.id); if (b) fillSlotSelect('#rd-s', redoQ(b, t.value)); break; }
    case 'rm-f': S.rm[t.dataset.k] = t.dataset.k === 'city' ? t.value : Math.max(0, Number(t.value) || 0); S.rmRun = null; rerenderKeep(); break;
    case 'cp-upload': {
      const file = t.files && t.files[0]; if (!file) break;
      toast('Uploading image…');
      try {
        const fdu = new FormData(); fdu.append('file', file);
        const r = await fetch(apiUrl('admin/upload'), {method: 'POST', credentials: 'same-origin', headers: {'X-WP-Nonce': B.nonce}, body: fdu});
        const j = await r.json(); if (!r.ok) throw new Error(j.message || 'Upload failed');
        $('#cp-img').value = j.url; await campaignSave(t.closest('form')); drop('campaign'); rerenderKeep(); toast('Image added');
      } catch (err) { toast(err.message); }
      break; }
    case 'pay-mode': deskAct(id, {action: 'paymode', mode: t.value}, t.value ? 'Payment recorded as ' + t.value : 'Payment marked as not received'); break;
    case 'add-calc': addCalc(); if (t.id !== 'da-cp' && t.id !== 'da-cprice') fillSlotSelect('#da-slot', addSlotQ()); break;
    case 'add-slots': { fillSlotSelect('#da-slot', addSlotQ()); const pp = $('#da-past'); if (pp) pp.hidden = !(t.value && t.value < TODAY); break; }
    case 'slot-pick': { const ct = t.nextElementSibling; if (ct && ct.classList.contains('ctime')) { ct.hidden = t.value !== '__custom'; if (!ct.hidden) ct.focus(); } break; }
    case 'resched-slots': { const f = t.closest('form'); fillSlotSelect('#dr-s', {city: (findBooking(f.dataset.id) || {}).city, date: t.value, ref: f.dataset.id}); break; }
    case 'price': { const p = pkgObj(t.dataset.pkg); p.prices[t.dataset.city] = Number(t.value) || 0; quiet('Price saved'); break; }
    case 'mrp': { const p = pkgObj(t.dataset.pkg); if (!p.mrp || Array.isArray(p.mrp)) p.mrp = {}; p.mrp[t.dataset.city] = Number(t.value) || 0; quiet('MRP saved'); break; }
    case 'city-svc': cityObj(id).service = t.checked; loud(); break;
    case 'city-walk': cityObj(id).walking = t.checked; loud(); break;
    case 'city-review': cityObj(id).reviewLink = t.value.trim(); quiet('Review link saved'); break;
    case 'walk-price': db.walkPlans.find(w => w.id === id).price = Number(t.value) || 0; quiet(); break;
    case 'rec-status': try { await api('admin/records/' + encodeURIComponent(id), {method: 'POST', body: {type: t.dataset.type, status: t.value}}); toast('Saved'); drop('dash'); } catch (err) { toast(err.message); } break;
    case 'prod-sug': { const n = Number(id); db.suggested = (db.suggested || []).map(Number).filter(x => x !== n); if (t.checked) db.suggested.push(n); quiet(t.checked ? 'Shown at checkout' : 'Removed from checkout'); break; }
    case 'cp-vis': db.coupons.find(c => c.code === id).visibility = t.value; quiet('Saved'); break;
    case 'pkg-mins': pkgObj(id).mins = Math.max(15, Number(t.value) || 60); quiet('Length saved'); break;
    case 'city-cap': cityObj(id).capacity = Math.max(1, Number(t.value) || 1); quiet('Saved'); break;
    case 'cp-active': db.coupons.find(c => c.code === id).active = t.checked; quiet(); break;
    case 'if-label': db.insFields.find(f => f.id === id).label = t.value; quiet(); break;
    case 'if-type': { const f = db.insFields.find(x => x.id === id); f.type = t.value; if (['select','radio'].includes(f.type) && !f.options) f.options = 'Option 1, Option 2'; loud(); break; }
    case 'if-opts': db.insFields.find(f => f.id === id).options = t.value; quiet(); break;
    case 'if-req': db.insFields.find(f => f.id === id).required = t.checked; quiet(); break;
    default: await teamChange(k, t, id);
  }
});

document.addEventListener('submit', async e => {
  const f = e.target, k = f.dataset.form; if (!k || !f.closest('#wt-root')) return;
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(f).entries());
  if (fd.start === '__custom') { if (!/^\d{1,2}:\d{2}$/.test(fd.customStart || '')) { const me = $('#m-err'); if (me) me.textContent = 'Enter the custom start time.'; return; } fd.start = fd.customStart; fd.customTime = 1; }
  delete fd.customStart;
  const btn = f.querySelector('button[type=submit]');
  const busy = on => { if (btn) { btn.disabled = on; } };
  const cfg = msg => { saveConfig(msg, true); rerenderKeep(); };
  const send = async (path, body, errEl) => { busy(true); try { return await api(path, {method: 'POST', body}); } catch (err) { const el = $(errEl); if (el) el.textContent = err.message; else toast(err.message); return null; } finally { busy(false); } };
  switch (k) {
    case 'book': nextStep(); break;
    case 'othercity': { const n = $('#oc').value.trim() || 'Other city'; S.city = 'other'; ls('wt_city', 'other'); ls('wt_city_other', n); closeLayer(); if (!allowed(S.view)) go('home'); else render(); break; }
    case 'login': { const r = await send('login', fd, '#l-err'); if (r) { location.hash = r.role === 'admin' ? 'admin' : r.role === 'staff' ? 'staff' : 'account'; location.reload(); } break; }
    case 'register': { const r = await send('register', fd, '#r-err'); if (r) { location.hash = 'account'; location.reload(); } break; }
    case 'walk': { const r = await send('walks', Object.assign({city: S.city}, fd), '#w-err'); if (r) { S.thanks = ['Walk request received', `We'll call you on <b class="num">${esc(fd.phone)}</b> within a day to confirm your walker.`]; go('thanks'); } break; }
    case 'ins': {
      const fields = {}; db.insFields.forEach(fl => { if (fd[fl.id] !== undefined) fields[fl.id] = fd[fl.id]; });
      for (const fl of db.insFields) { if (fl.required && !String(fields[fl.id] || '').trim()) { $('#ins-err').textContent = `Please fill "${fl.label}".`; return; } }
      const r = await send('insurance', {fields, website: fd.website}, '#ins-err'); if (r) { S.thanks = ['Thanks! An advisor will call you', 'We usually call back within one working day with plans that suit your pet.']; go('thanks'); } break; }
    case 'contact': { const r = await send('contact', fd, '#c-err'); if (r) { S.thanks = ['Message sent', 'We usually reply within an hour during working hours.']; go('thanks'); } break; }
    /* desk */
    case 'desk-complete': if (!fd.mode) { $('#m-err').textContent = 'Choose how the payment was received.'; break; } busy(true); await deskAct(f.dataset.id, {action: 'complete', mode: fd.mode, note: fd.note}, 'Marked complete'); busy(false); break;
    case 'desk-cancel': if (!fd.reason) { $('#m-err').textContent = 'Choose a reason for cancelling.'; break; } busy(true); await deskAct(f.dataset.id, Object.assign({action: 'cancel'}, fd), 'Booking cancelled'); busy(false); break;
    case 'desk-edit': {
      const b = findBooking(f.dataset.id); if (!b) break;
      const body = {action: 'edit', reason: fd.reason || '', notify: !!fd.notify};
      if (fd.date && fd.start && (fd.date !== b.date || fd.start !== b.start || fd.customTime)) { body.date = fd.date; body.start = fd.start; if (fd.customTime) body.customTime = 1; }
      if (fd.price !== '' && Number(fd.price) !== Number(b.total)) body.price = fd.price;
      if (!body.date && body.price === undefined) { $('#m-err').textContent = 'Change the date, time or price first.'; break; }
      if (body.price !== undefined && String(fd.reason || '').trim().length < 3) { $('#m-err').textContent = 'Write the reason for the price change.'; break; }
      busy(true); await deskAct(f.dataset.id, body, 'Booking updated'); busy(false); break; }
    case 'desk-resched': if (!fd.start) { $('#m-err').textContent = 'Choose a new time.'; break; } busy(true); await deskAct(f.dataset.id, Object.assign({action: 'reschedule'}, fd), 'Rescheduled to ' + fmtDate(fd.date)); busy(false); break;
    case 'desk-redo': { if (!fd.start) { $('#m-err').textContent = 'Choose a time.'; break; } if (String(fd.reason || '').trim().length < 3) { $('#m-err').textContent = 'Write why the service is being redone.'; break; } busy(true); await deskAct(f.dataset.id, Object.assign({action: 'redo'}, fd), 'Free redo booked. Customer notified.'); busy(false); break; }
    case 'campaign': { busy(true); try { await campaignSave(f); drop('campaign'); rerenderKeep(); toast(fd.on ? 'Saved. Emails will go out daily at ' + fd.time : 'Saved (switched off)'); } catch (err) { $('#cp-err').textContent = err.message; } busy(false); break; }
    case 'otp-send': { const ph = String(fd.phone || '').replace(/\D/g, '').slice(-10); if (!/^[6-9]\d{9}$/.test(ph)) { $('#o-err').textContent = 'Enter your 10-digit mobile number.'; break; } const r = await send('otp/send', {phone: ph}, '#o-err'); if (r) { S.otp = {phone: ph, sent: true, needName: false, wait: Date.now() + 30000}; render(); const c = $('#o-code'); if (c) c.focus(); setTimeout(() => S.view === 'login' && S.otp.sent && rerenderKeep(), 30500); } break; }
    case 'otp-verify': { const r = await send('otp/verify', {phone: S.otp.phone, code: fd.code, name: fd.name || ''}, '#o-err'); if (r && r.needName) { S.otp.needName = true; render(); const n = $('#o-name'); if (n) n.focus(); break; } if (r && r.ok) { location.hash = 'account'; location.reload(); } break; }
    case 'me-profile': { const body = {name: fd.name, email: fd.email, address: fd.address, pincode: fd.pincode, city: fd.city, pets: readPets(fd, 'pet_')}; const r = await send('me/profile', body, '#me-err'); if (r) { B.user.profile = r.profile; drop('me'); rerenderKeep(); toast('Your details are saved'); } break; }
    case 'client-save': { const ph = f.dataset.phone || String(fd.phone || '').replace(/\D/g, '').slice(-10); if (!/^[6-9]\d{9}$/.test(ph)) { $('#m-err').textContent = 'Enter a valid 10-digit mobile.'; break; } const body = {name: fd.name, email: fd.email, altPhone: fd.altPhone, address: fd.address, pincode: fd.pincode, city: fd.city, notes: fd.notes, pets: readPets(fd, 'pet_')}; const r = await send('clients/' + ph, body, '#m-err'); if (r) { closeLayer(); drop('clients'); rerenderKeep(); toast('Customer details saved'); } break; }
    case 'desk-disc': { if (!(Number(fd.value) > 0)) { $('#m-err').textContent = 'Enter the discount.'; break; } if (String(fd.reason || '').trim().length < 3) { $('#m-err').textContent = 'Write the reason for this discount.'; break; } busy(true); await deskAct(f.dataset.id, {action: 'discount', kind: fd.kind, value: fd.value, reason: fd.reason}, 'Discount saved'); busy(false); break; }
    case 'desk-add': { if (!fd.start) { $('#m-err').textContent = 'Choose a date and time.'; break; } const r = await send('desk/bookings', fd, '#m-err'); if (r) { closeLayer(); S.deskFilter = r.past ? 'all' : 'upcoming'; drop('desk'); drop('dash'); rerenderKeep(); toast(r.past && !fd.notifyPast ? `Booking ${r.booking.id} saved (past date, customer not messaged).` : `Booking ${r.booking.id} saved. Customer notified.`); } break; }
    /* admin: config */
    case 'pkg': { const prices = Object.fromEntries(db.cities.map(c => [c.id, Number(fd.price) || 0])); const mrp = Object.fromEntries(db.cities.map(c => [c.id, Number(fd.mrp) || 0])); db.packages.push({id: 'pk' + Date.now().toString(36), name: fd.name, pet: fd.pet, duration: fd.duration || '', items: (fd.items || '').split('\n').map(s => s.trim()).filter(Boolean), prices, mrp}); cfg('Package added. Adjust city prices in the table.'); break; }
    case 'city': { const cid = fd.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); if (!cid || db.cities.some(c => c.id === cid)) { toast('That city is already listed'); break; } db.cities.push({id: cid, name: fd.name.trim(), service: true, walking: false, reviewLink: ''}); db.packages.forEach(p => { const vals = Object.values(p.prices).map(Number).filter(Boolean); p.prices[cid] = vals.length ? Math.min(...vals) : 0; if (p.mrp && !Array.isArray(p.mrp)) { const mv = Object.values(p.mrp).map(Number).filter(Boolean); p.mrp[cid] = mv.length ? Math.min(...mv) : 0; } }); cfg('City added. Check its prices in Packages.'); break; }
    case 'wplan': db.walkPlans.push({id: 'w' + Date.now().toString(36), name: fd.name, price: Number(fd.price) || 0}); cfg('Plan added'); break;
    case 'banner': db.banners = db.banners || []; db.banners.push({id: 'B' + Date.now().toString(36), title: fd.title, sub: fd.sub || '', img: fd.img || '', color: fd.color || '#4B1D00', cta: fd.cta || ''}); cfg('Banner added'); break;
    case 'coupon': { const code = fd.code.trim().toUpperCase(); if (!code) break; if (db.coupons.some(c => c.code === code)) { $('#cp-err').textContent = 'A coupon with this code exists.'; break; } db.coupons.push({code, type: fd.type, value: Number(fd.value), min: Number(fd.min) || 0, desc: fd.desc || (fd.type === 'pct' ? fd.value + '% off' : '₹' + fd.value + ' off'), visibility: fd.visibility || 'listed', active: true}); cfg('Coupon created'); break; }
    case 'insfield': db.insFields.push({id: 'f' + Date.now().toString(36), label: fd.label, type: fd.type, required: false, options: ['select','radio'].includes(fd.type) ? 'Option 1, Option 2' : (fd.type === 'checkbox' ? 'Yes' : '')}); cfg('Question added'); break;
    case 'rewards': { const r = db.rewards; r.enabled = !!fd.enabled; ['bookingRate','orderRate','pointValue','minRedeem','maxPct','signupBonus'].forEach(x => { const n = Number(fd[x]); if (!isNaN(n) && n >= 0) r[x] = n; }); cfg('Reward settings saved'); break; }
    case 'settings': {
      const s = db.settings;
      ['notifyEmail','notifyWhatsApp','dayStart','dayEnd','reviewMsg','razorpayKey','razorpaySecret','waMode','waLang','waPhoneId','waToken','webhookUrl','shipPanel','phone','email','address'].forEach(x => { if (fd[x] !== undefined) s[x] = String(fd[x]).trim(); });
      s.maxDaysAhead = Number(fd.maxDaysAhead) || 45; s.slotStep = Math.max(15, Number(fd.slotStep) || 30); s.bufferMins = Math.max(0, Number(fd.bufferMins) || 0); s.leadMins = Math.max(0, Number(fd.leadMins) || 0);
      s.waTemplates = {}; Object.keys(fd).filter(x => x.startsWith('tpl_')).forEach(x => { if (fd[x].trim()) s.waTemplates[x.slice(4)] = fd[x].trim(); });
      saveConfig('Settings saved', true); break; }
    case 'bp-import': {
      const sc = S.bpScan; if (!sc) break;
      const fields = {}, services = {};
      f.querySelectorAll('select[data-key]').forEach(el => fields[el.dataset.key] = el.value);
      f.querySelectorAll('select[data-name]').forEach(el => services[el.dataset.name] = el.value);
      const body = {prefix: sc.prefix, fields, services, defaultCity: fd.defaultCity, pastCompleted: !!fd.pastCompleted, givePoints: !!fd.givePoints};
      let stage = 'customers', offset = 0; const tot = {imported: 0, skipped: 0, linked: 0, notes: []}; let custDone = 0, bookDone = 0;
      S.bpRun = {busy: true, msg: 'Starting…'}; rerenderKeep();
      try {
        while (stage !== 'done') {
          const r = await api('admin/bp/import', {method: 'POST', body: Object.assign({stage, offset}, body)});
          const res = r.result; tot.notes.push(...res.notes);
          if (stage === 'customers') { custDone += res.imported; tot.linked += res.linked; } else { bookDone += res.imported; tot.skipped += res.skipped; }
          S.bpRun = {busy: true, msg: stage === 'customers' ? `Customers: ${Math.min(r.offset || r.total, r.total)} of ${r.total} checked…` : `Bookings: ${Math.min(r.offset, r.total)} of ${r.total} checked…`, notes: tot.notes};
          rerenderKeep(); stage = r.stage; offset = r.offset;
          if (stage === 'done') break;
        }
        S.bpRun = {done: true, msg: `Done. ${bookDone} bookings and ${custDone} customers imported${tot.linked ? `, ${tot.linked} existing logins linked` : ''}${tot.skipped ? `, ${tot.skipped} bookings skipped (already imported or no date)` : ''}.`, notes: tot.notes};
        S.bpScan = await api('admin/bp/scan', {method: 'POST', body: {prefix: sc.prefix}});
        drop('desk'); drop('dash'); drop('customers'); drop('points');
      } catch (err) { S.bpRun = {msg: 'The import stopped: ' + err.message + ' Press the button again to continue. Already imported bookings are skipped.', notes: tot.notes}; }
      rerenderKeep(); break; }
    /* admin: records */
    case 'pts-adjust': { const r = await send('admin/points', fd, '#pa-err'); if (r) { drop('points'); drop('customers'); rerenderKeep(); toast('Points updated. New balance ' + r.balance); } break; }
    case 'staff': { const r = await send('admin/staff', fd, '#st-err'); if (r) { drop('staff'); f.reset(); rerenderKeep(); toast('Staff login created'); } break; }
    default: await teamSubmit(k, f, fd, send);
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.target.id === 'bk-coupon')) { e.preventDefault(); const b = document.querySelector('[data-act="bk-coupon"]'); if (b) b.click(); return; }
  if (e.key === 'Escape' && $('#layer').innerHTML && !$('#layer .gate')) closeLayer();
});

/* ---------- TEAM: sales dashboard, reports, targets, attendance ---------- */
const ATT = role === 'staff' ? Object.assign({required: false, onDuty: true, in: '', out: ''}, B.user.att || {}) : null;
const PERMS = role === 'admin' ? ['customers','bookings','payments','attendance','dashboard'] : (role === 'staff' ? (B.user.perms || []) : []);
const KINDS = {customers: 'Customer data', bookings: 'Booking data', payments: 'Payment report', attendance: 'Attendance of all staff', dashboard: 'Sales dashboard'};
const MONTH = TODAY.slice(0, 7);
const monthStart = m => m + '-01';
const monthLabel = m => new Date(m + '-01T12:00').toLocaleDateString('en-IN', {month: 'long', year: 'numeric'});
const shiftMonth = (m, n) => { const d = new Date(m + '-01T12:00'); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 7); };
const monthEnd = m => { const d = new Date(m + '-01T12:00'); d.setMonth(d.getMonth() + 1); d.setDate(0); return d.toISOString().slice(0, 10); };
const shortMoney = n => { n = Number(n) || 0; const a = Math.abs(n), f = (x, s) => (x).toFixed(1).replace(/\.0$/, '') + s; return '₹' + (a >= 1e7 ? f(n / 1e7, 'Cr') : a >= 1e5 ? f(n / 1e5, 'L') : a >= 1e3 ? f(n / 1e3, 'k') : Math.round(n)); };
const num = n => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-IN');
S.st = {from: monthStart(MONTH), to: TODAY, city: 'all'};
S.rp = {from: monthStart(MONTH), to: TODAY, city: 'all', uid: '0'};
S.at = {from: addDays(TODAY, -6), to: TODAY, uid: '0'};
S.tgMonth = MONTH; S.myMonth = MONTH; S.perfTab = 'me';

/* charts: templates queue a chart, render() draws them once the HTML is on the page */
let CHQ = []; const CHS = [];
function cssv(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || getComputedStyle(document.getElementById('wt-root')).getPropertyValue(n).trim(); }
function palette() { return [cssv('--brand') || '#4B1D00', cssv('--honey') || '#E9A23B', '#2F8F7B', '#C2553A', '#5B6CA8', '#9C7A4F', '#B66A9B', '#6E9B3A', '#3E8FB0', '#D9822B', '#7D5BA6', '#8A8F2E']; }
function chart(type, data, o = {}, h = 260) {
  const id = 'wtc' + CHQ.length + Math.random().toString(36).slice(2, 7);
  CHQ.push([id, type, data, o]);
  return `<div class="chartbox" style="height:${h}px"><canvas id="${id}" role="img" aria-label="${esc(o.label || 'Chart')}"></canvas></div>`;
}
function drawCharts() {
  CHS.splice(0).forEach(c => { try { c.destroy(); } catch (e) { /* gone */ } });
  const q = CHQ; CHQ = [];
  if (!window.Chart || !q.length) return;
  const ink = cssv('--muted') || '#76624F', line = cssv('--line') || '#E7DAD0', P = palette();
  Chart.defaults.font.family = '"Nunito Sans", system-ui, sans-serif'; Chart.defaults.color = ink;
  q.forEach(([id, type, data, o]) => {
    const el = document.getElementById(id); if (!el) return;
    const round = type === 'doughnut' || type === 'pie';
    data.datasets.forEach((ds, i) => {
      if (round) { ds.backgroundColor = data.labels.map((_, j) => P[j % P.length]); ds.borderColor = cssv('--surface') || '#fff'; ds.borderWidth = 2; }
      else if (!ds.backgroundColor) { const c = P[(ds.color ?? i) % P.length]; ds.backgroundColor = c; ds.borderColor = c; }
      if (ds.type === 'line') { ds.backgroundColor = P[(ds.color ?? i) % P.length]; ds.borderWidth = 2; ds.pointRadius = 3; ds.tension = .3; }
      if (!round && ds.type !== 'line') { ds.borderRadius = 4; ds.maxBarThickness = 44; }
    });
    const fmtTip = (ds, v) => ds.money === false || (!o.money && !ds.money) ? num(v) : money(v);
    const scales = round ? {} : {
      x: {grid: {display: false}, ticks: {color: ink, maxRotation: 0, autoSkip: true}},
      y: {beginAtZero: true, grid: {color: line}, ticks: {color: ink, callback: v => o.money ? shortMoney(v) : num(v)}}
    };
    if (o.y2) scales.y2 = {beginAtZero: true, position: 'right', grid: {display: false}, ticks: {color: ink, callback: v => num(v)}, title: {display: true, text: o.y2, color: ink}};
    CHS.push(new Chart(el, {type, data, options: {responsive: true, maintainAspectRatio: false, animation: {duration: 250}, cutout: type === 'doughnut' ? '58%' : undefined,
      plugins: {legend: {display: round || data.datasets.length > 1, position: 'bottom', labels: {boxWidth: 12, color: ink}},
        tooltip: {callbacks: {label: c => {
          let s = (round ? c.label : (c.dataset.label || '')) + ': ' + fmtTip(c.dataset, c.raw);
          if (round) { const t = c.dataset.data.reduce((a, b) => a + Number(b || 0), 0); if (t) s += ` (${Math.round(c.raw / t * 100)}%)`; }
          return s; }}}},
      scales}}));
  });
}
const vbar = (label, values, extra = {}) => Object.assign({label, data: values, money: true, yAxisID: 'y'}, extra);
const cbar = (label, values, extra = {}) => Object.assign({label, data: values, money: false, yAxisID: 'y2'}, extra);
function change(a, b) {
  if (!b) return a ? '<span class="chg up">New</span>' : '<span class="chg">—</span>';
  const p = (a - b) / b * 100;
  return `<span class="chg ${p >= 0 ? 'up' : 'down'}">${p >= 0 ? '▲' : '▼'} ${Math.abs(p).toFixed(1)}%</span>`;
}
function compareCard(title, aLabel, a, bLabel, b) {
  return `<section class="card stack cmp"><h3>${title}</h3>
    <div class="cmpgrid"><div><span class="small muted">${esc(aLabel)}</span><b class="num">${money(a.value)}</b><span class="small muted num">${a.count} bookings</span></div>
    <div><span class="small muted">${esc(bLabel)}</span><b class="num">${money(b.value)}</b><span class="small muted num">${b.count} bookings</span></div></div>
    <p class="small">${change(a.value, b.value)} in sales value · ${change(a.count, b.count)} in bookings</p>
    ${chart('bar', {labels: [bLabel, aLabel], datasets: [vbar('Sales value', [b.value, a.value]), cbar('Bookings', [b.count, a.count], {type: 'line', color: 1})]}, {money: true, y2: 'Bookings', label: title}, 190)}</section>`;
}

/* ---------- sales dashboard (admin, and staff given access) ---------- */
const statKey = () => `stats:${S.st.from}:${S.st.to}:${S.st.city}`;
function rangeBar(st, prefix, withCity) {
  const pre = [['month', 'This month'], ['last', 'Last month'], ['q', 'Last 3 months'], ['year', 'This year']];
  return `<div class="card filters">
    <div class="row">${pre.map(([k, l]) => `<button class="chip" data-act="tm-preset" data-v="${k}" data-p="${prefix}">${l}</button>`).join('')}</div>
    <div class="row" style="align-items:end">
      <div class="field"><label for="${prefix}-from">From</label><input id="${prefix}-from" type="date" value="${esc(st.from)}" data-chg="tm-range" data-p="${prefix}" data-k="from"></div>
      <div class="field"><label for="${prefix}-to">To</label><input id="${prefix}-to" type="date" value="${esc(st.to)}" data-chg="tm-range" data-p="${prefix}" data-k="to"></div>
      ${withCity ? `<div class="field"><label for="${prefix}-city">City</label><select id="${prefix}-city" data-chg="tm-range" data-p="${prefix}" data-k="city"><option value="all">All cities</option>${db.cities.map(c => `<option value="${esc(c.id)}" ${st.city === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>` : ''}
    </div></div>`;
}
function salesDash() {
  const scoped = role === 'staff' && B.user.city !== 'all';
  return `${rangeBar(S.st, 'st', !scoped)}` + view(statKey(), () => api('stats', {q: S.st}), d => {
    const rl = `${fmtDate(d.range.from)} – ${fmtDate(d.range.to)}${d.range.city !== 'all' ? ' · ' + cityName(d.range.city) : ''}`;
    const avg = d.total.count ? d.total.value / d.total.count : 0;
    const cityL = d.cities.map(c => c.name), teamL = d.team.map(t => t.name);
    const yl = d.years, mnames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], mi = Number(TODAY.slice(5, 7)) - 1;
    const sameLast = {value: yl.prevVals[mi], count: yl.prevCnt[mi]};
    return `<p class="small muted">Sales count every booking that is confirmed, rescheduled or completed. Cancelled bookings are left out. Charts by city and month use the service date; team charts use the day the booking was added.</p>
    <div class="kpis"><div class="kpi"><span class="muted small">Sales value</span><b class="num">${money(d.total.value)}</b></div><div class="kpi"><span class="muted small">Bookings</span><b class="num">${d.total.count}</b></div><div class="kpi"><span class="muted small">Average booking</span><b class="num">${money(avg)}</b></div><div class="kpi"><span class="muted small">Cancelled</span><b class="num">${d.cancelled}</b></div></div>
    <div class="grid2">
      <section class="card stack"><h3>City performance</h3><p class="small muted">${rl}</p>${d.cities.length ? chart('bar', {labels: cityL, datasets: [vbar('Sales value', d.cities.map(c => c.value)), cbar('Bookings', d.cities.map(c => c.count), {color: 1})]}, {money: true, y2: 'Bookings', label: 'Sales value and bookings by city'}) : '<p class="muted">No sales in this period.</p>'}</section>
      <section class="card stack"><h3>Share of bookings by city</h3><p class="small muted">${rl}</p>${d.cities.length ? chart('doughnut', {labels: cityL, datasets: [{label: 'Bookings', data: d.cities.map(c => c.count), money: false}]}, {label: 'Share of bookings by city'}) : '<p class="muted">No sales in this period.</p>'}</section>
    </div>
    <div class="tablewrap"><table><thead><tr><th>City</th><th class="r">Bookings</th><th class="r">Sales value</th><th class="r">Average</th></tr></thead><tbody>${d.cities.map(c => `<tr><td>${esc(c.name)}</td><td class="r num">${c.count}</td><td class="r num">${money(c.value)}</td><td class="r num">${money(c.count ? c.value / c.count : 0)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No sales in this period.</td></tr>'}</tbody></table></div>
    <div class="grid2">
      <section class="card stack"><h3>Internal team performance</h3><p class="small muted">Bookings added by each team member · ${rl}</p>${d.team.length ? chart('bar', {labels: teamL, datasets: [vbar('Booking value', d.team.map(t => t.value)), cbar('Bookings', d.team.map(t => t.count), {color: 1})]}, {money: true, y2: 'Bookings', label: 'Team performance'}) : '<p class="muted">No booking staff yet.</p>'}</section>
      <section class="card stack"><h3>Share of booking value by team member</h3><p class="small muted">${rl}</p>${d.team.some(t => t.value) ? chart('doughnut', {labels: teamL, datasets: [{label: 'Booking value', data: d.team.map(t => t.value), money: true}]}, {label: 'Team share of value'}) : '<p class="muted">No bookings added by the team in this period.</p>'}</section>
    </div>
    <div class="tablewrap"><table><thead><tr><th>Team member</th><th class="r">Bookings added</th><th class="r">Booking value</th></tr></thead><tbody>${d.team.map(t => `<tr><td>${esc(t.name)}</td><td class="r num">${t.count}</td><td class="r num">${money(t.value)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No booking staff yet.</td></tr>'}</tbody></table></div>
    <section class="card stack"><h3>Month by month sales</h3><p class="small muted">Last 12 months${d.range.city !== 'all' ? ' · ' + esc(cityName(d.range.city)) : ''}</p>
      ${chart('bar', {labels: d.monthly.map(m => m.label), datasets: [vbar('Sales value', d.monthly.map(m => m.value)), cbar('Bookings', d.monthly.map(m => m.count), {type: 'line', color: 1})]}, {money: true, y2: 'Bookings', label: 'Month by month sales'}, 300)}</section>
    <div class="grid3">
      ${compareCard('This month vs last month', d.thisMonth.label, d.thisMonth, d.lastMonth.label, d.lastMonth)}
      ${compareCard('This month vs same month last year', d.thisMonth.label, d.thisMonth, mnames[mi] + ' ' + yl.prev, sameLast)}
      ${compareCard('Year to date vs last year', `${yl.cur} till ${d.ytd.asOf}`, d.ytd.cur, `${yl.prev} till ${d.ytd.asOf}`, d.ytd.prev)}
    </div>
    <section class="card stack"><h3>${yl.cur} vs ${yl.prev}, month by month</h3>
      ${chart('bar', {labels: mnames, datasets: [vbar(String(yl.prev), yl.prevVals, {color: 1}), vbar(String(yl.cur), yl.curVals, {color: 0})]}, {money: true, label: 'This year vs last year by month'}, 300)}
      <div class="tablewrap"><table><thead><tr><th>Month</th><th class="r">${yl.prev}</th><th class="r">${yl.cur}</th><th class="r">Change</th></tr></thead><tbody>${mnames.map((m, i) => `<tr><td>${m}</td><td class="r num">${money(yl.prevVals[i])}</td><td class="r num">${money(yl.curVals[i])}</td><td class="r">${i <= mi ? change(yl.curVals[i], yl.prevVals[i]) : '<span class="muted small">Upcoming</span>'}</td></tr>`).join('')}</tbody></table></div></section>`;
  });
}

/* ---------- reports (CSV) ---------- */
function reportsPanel(kinds) {
  const scoped = role === 'staff' && B.user.city !== 'all';
  const showAllAtt = kinds.includes('attendance');
  const list = kinds.filter(k => k !== 'dashboard');
  if (role === 'staff' && !list.includes('attendance')) list.push('attendance');
  const desc = {customers: 'Name, phone, email, city, bookings, total spent, first and last booking, reward points. Filtered by city only.', bookings: 'Every booking with service date between the dates: customer, pet, package, price, coupon, status, payment, who added it.', payments: 'Amount, paid or due, cash or online, Razorpay payment ID, who recorded it. Cancelled bookings are left out.', attendance: showAllAtt ? 'Punch in and punch out times, hours worked and missed punch-outs.' : 'Your own punch in and punch out times, hours worked and missed punch-outs.'};
  return `<div class="card filters"><div class="row" style="align-items:end">
      <div class="field"><label for="rp-from">From</label><input id="rp-from" type="date" value="${esc(S.rp.from)}" data-chg="tm-rp" data-k="from"></div>
      <div class="field"><label for="rp-to">To</label><input id="rp-to" type="date" value="${esc(S.rp.to)}" data-chg="tm-rp" data-k="to"></div>
      ${scoped ? `<p class="small muted">City: <b>${esc(cityName(B.user.city))}</b></p>` : `<div class="field"><label for="rp-city">City</label><select id="rp-city" data-chg="tm-rp" data-k="city"><option value="all">All cities</option>${db.cities.map(c => `<option value="${esc(c.id)}" ${S.rp.city === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>`}
      ${role === 'admin' ? view('staff', () => api('admin/staff'), d => `<div class="field"><label for="rp-uid">Staff (attendance)</label><select id="rp-uid" data-chg="tm-rp" data-k="uid"><option value="0">All staff</option>${d.list.map(s => `<option value="${s.id}" ${String(S.rp.uid) === String(s.id) ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>`) : ''}
    </div><p class="small muted">Files open in Excel or Google Sheets.</p></div>
    <div class="grid2">${list.map(k => `<section class="card stack"><h3>${esc(k === 'attendance' && !showAllAtt ? 'My attendance' : KINDS[k])}</h3><p class="small muted">${desc[k]}</p><div><button class="btn sm" data-act="tm-dl" data-v="${k}">Download CSV</button></div></section>`).join('') || '<div class="card muted">The admin has not given you access to any reports yet.</div>'}</div>`;
}
async function downloadReport(kind, extra = {}) {
  const q = Object.assign({from: S.rp.from, to: S.rp.to, city: S.rp.city}, extra);
  if (kind === 'attendance' && role === 'admin' && !('uid' in extra)) q.uid = S.rp.uid;
  if (kind === 'customers') { delete q.from; delete q.to; }
  toast('Preparing your file…');
  const r = await fetch(apiUrl(kind === '__rm' ? 'admin/remind/report' : 'report/' + kind, Object.assign(kind === '__rm' ? {i: extra.i, format: 'csv'} : q, {_: Date.now()})), {credentials: 'same-origin', cache: 'no-store', headers: {'X-WP-Nonce': B.nonce}});
  if (!r.ok) { let j = null; try { j = await r.json(); } catch (e) { /* not json */ } throw new Error((j && j.message) || 'The download did not work. Try again.'); }
  const blob = await r.blob();
  const m = (r.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/);
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = m ? m[1] : kind + '.csv';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  toast('Downloaded ' + a.download);
}

/* ---------- targets ---------- */
const pctTxt = p => p === null || p === undefined ? '—' : p.toFixed(1).replace(/\.0$/, '') + '%';
function bar(p) { const w = Math.max(0, Math.min(100, Number(p) || 0)); return `<div class="pbar" role="progressbar" aria-valuenow="${Math.round(w)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${w}%" class="${w >= 100 ? 'done' : ''}"></span></div>`; }
function progressSummary(pr) {
  const t = pr.total;
  if (!pr.hasTarget) return `<p class="muted">No target set for ${esc(monthLabel(pr.month))} yet.</p>`;
  return `<div class="grid2 tight">
    ${t.tValue > 0 ? `<div class="stack" style="gap:6px"><div class="row between small"><b>Booking value</b><span class="num">${money(t.value)} of ${money(t.tValue)} · <b>${pctTxt(t.valuePct)}</b></span></div>${bar(t.valuePct)}</div>` : ''}
    ${t.tQty > 0 ? `<div class="stack" style="gap:6px"><div class="row between small"><b>Number of bookings</b><span class="num">${num(t.qty)} of ${t.tQty} · <b>${pctTxt(t.qtyPct)}</b></span></div>${bar(t.qtyPct)}</div>` : ''}
  </div>
  ${pr.missed ? `<p class="note small"><b>${pr.missed} missed punch-out${pr.missed === 1 ? '' : 's'} this month.</b> Achievement reduced by ${num(pr.deductPct)}% (from ${money(t.rawValue)} and ${t.rawQty} bookings).</p>` : ''}
  <div class="miles">${pr.milestones.map(m => `<div class="mile ${m.reached ? 'on' : ''}"><b class="num">${num(m.pct)}%</b><span>${esc(m.reward)}</span><small>${m.basis === 'both' ? 'value and bookings' : m.basis === 'value' ? 'booking value' : 'number of bookings'} · ${m.reached ? 'Reached' : 'Not yet'}</small></div>`).join('')}</div>`;
}
function cityTargetsTable(pr, editable, staff) {
  const cs = db.cities.filter(c => c.service && (!staff || staff.city === 'all' || staff.city === c.id));
  const rows = editable ? cs.map(c => ({city: c.id, name: c.name})) : pr.cities.filter(r => r.tValue || r.tQty || r.rawQty);
  const find = id => pr.cities.find(r => r.city === id) || {tValue: 0, tQty: 0, value: 0, qty: 0, valuePct: null, qtyPct: null};
  if (!rows.length) return '';
  return `<div class="tablewrap"><table><thead><tr><th>City</th><th class="r">Target value (₹)</th><th class="r">Target bookings</th><th class="r">Achieved value</th><th class="r">Achieved bookings</th></tr></thead><tbody>
    ${rows.map(r => { const p = find(r.city); return `<tr><td>${esc(r.name)}</td>
      <td class="r">${editable ? `<input type="number" min="0" step="500" class="num" name="v_${esc(r.city)}" value="${p.tValue || ''}" aria-label="Target value in ${esc(r.name)}" style="width:120px">` : `<span class="num">${p.tValue ? money(p.tValue) : '—'}</span>`}</td>
      <td class="r">${editable ? `<input type="number" min="0" class="num" name="q_${esc(r.city)}" value="${p.tQty || ''}" aria-label="Target bookings in ${esc(r.name)}" style="width:90px">` : `<span class="num">${p.tQty || '—'}</span>`}</td>
      <td class="r num">${money(p.value)}${p.valuePct !== null ? ` <span class="small muted">(${pctTxt(p.valuePct)})</span>` : ''}</td>
      <td class="r num">${num(p.qty)}${p.qtyPct !== null ? ` <span class="small muted">(${pctTxt(p.qtyPct)})</span>` : ''}</td></tr>`; }).join('')}</tbody></table></div>`;
}
function monthPicker(id, val, chg) {
  return `<div class="row" style="align-items:end"><button class="chip" data-act="tm-month" data-v="-1" data-k="${chg}" aria-label="Previous month">‹</button><div class="field"><label for="${id}" class="sr">Month</label><input id="${id}" type="month" value="${esc(val)}" data-chg="${chg}"></div><button class="chip" data-act="tm-month" data-v="1" data-k="${chg}" aria-label="Next month">›</button></div>`;
}

/* ---------- attendance ---------- */
function attTable(list, admin) {
  return `<div class="tablewrap"><table><thead><tr><th>Date</th>${admin ? '<th>Staff</th>' : ''}<th>Punch in</th><th>Punch out</th><th class="r">Hours</th><th>Status</th>${admin ? '<th></th>' : ''}</tr></thead><tbody>
    ${list.map(a => `<tr><td class="num">${fmtDate(a.date)}</td>${admin ? `<td><b>${esc(a.name)}</b><div class="small muted">${esc(cityName(a.city))}</div></td>` : ''}<td class="num">${esc(a.in)}</td><td class="num">${esc(a.out || '—')}${a.fixedBy ? `<div class="small muted">added by ${esc(a.fixedBy)}</div>` : ''}</td><td class="r num">${a.hours === '' ? '—' : num(a.hours)}</td>
      <td>${pill(a.status === 'Present' ? 'Present' : a.status)}</td>
      ${admin ? `<td>${a.status === 'Missed punch-out' ? `<form class="row" data-form="tm-fix" data-id="${esc(a.id)}" style="gap:6px;flex-wrap:nowrap"><input type="time" name="out" required aria-label="Punch-out time for ${esc(a.name)}" style="width:120px"><button class="btn ghost sm" type="submit">Add punch-out</button></form>` : ''}${delBtn('tm-att-del', a.id, 'Delete')}</td>` : ''}</tr>`).join('') || `<tr><td colspan="${admin ? 7 : 5}" class="muted">No attendance in this period.</td></tr>`}</tbody></table></div>`;
}

/* ---------- admin tabs ---------- */
Object.assign(ADMIN, {
  insights() {
    return `<div class="row between"><h2>Sales dashboard</h2><button class="btn ghost sm" data-act="tab" data-v="reports">Download reports</button></div>${salesDash()}`;
  },
  reports() {
    return `<h2>Reports</h2><p class="muted">Download data as CSV. To let a booking staff member download a report, tick it next to their name in <button class="linkbtn" data-act="tab" data-v="staff">Booking staff</button>.</p>${reportsPanel(PERMS)}`;
  },
  targets() {
    const m = S.tgMonth;
    return `<div class="row between"><div><h2>Targets &amp; rewards</h2><p class="muted">Set a monthly target per city for each booking staff member, by booking value and by number of bookings. They see their progress and the rewards on their <b>My work</b> page.</p></div>${monthPicker('tg-month', m, 'tm-tgmonth')}</div>
    ${view('team:' + m, () => api('team', {q: {month: m}}), d => `
      <div class="row"><button class="btn ghost sm" data-act="tm-copy">Copy targets from ${esc(monthLabel(shiftMonth(m, -1)))}</button></div>
      ${d.staff.map(s => `<form class="card stack" data-form="tm-targets" data-uid="${s.id}">
        <div class="row between"><div><h3>${esc(s.name)}</h3><p class="small muted">${esc(cityName(s.city))} · ${s.progress.missed} missed punch-out${s.progress.missed === 1 ? '' : 's'} in ${esc(monthLabel(m))}</p></div>
          <div class="row">${s.progress.total.valuePct !== null ? pill('Value ' + pctTxt(s.progress.total.valuePct)) : ''}${s.progress.total.qtyPct !== null ? pill('Bookings ' + pctTxt(s.progress.total.qtyPct)) : ''}</div></div>
        ${cityTargetsTable(s.progress, true, s)}
        ${progressSummary(s.progress)}
        <div class="row"><button class="btn sm" type="submit">Save targets for ${esc(s.name.split(' ')[0])}</button></div></form>`).join('') || '<div class="card muted">Create a booking staff login first in Booking staff.</div>'}
      <form class="card stack" data-form="tm-settings"><h3>Milestone rewards &amp; attendance rules</h3>
        <p class="small muted">A milestone is reached when achievement crosses its percentage. "Value and bookings" needs both targets crossed. Leave a row empty to remove it.</p>
        <div class="tablewrap"><table><thead><tr><th>Milestone %</th><th>Based on</th><th>Reward</th></tr></thead><tbody>
          ${[...d.settings.milestones, {pct: '', basis: 'both', reward: ''}, {pct: '', basis: 'both', reward: ''}].map((ms, i) => `<tr><td><input type="number" min="1" max="500" class="num" name="ms_pct_${i}" value="${esc(ms.pct)}" aria-label="Milestone percent" style="width:90px"></td>
            <td><select name="ms_basis_${i}" aria-label="Based on">${[['both','Value and bookings'],['value','Booking value'],['qty','Number of bookings']].map(([k, l]) => `<option value="${k}" ${ms.basis === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
            <td><input type="text" name="ms_reward_${i}" value="${esc(ms.reward)}" placeholder="e.g. ₹1,000 bonus" aria-label="Reward"></td></tr>`).join('')}</tbody></table></div>
        <div class="f2">
          <label class="row" style="gap:10px"><span class="toggle"><input type="checkbox" name="attendanceOn" ${d.settings.attendanceOn ? 'checked' : ''}><span></span></span><span><b>Punch in required</b><br><span class="small muted">Booking staff must punch in before the desk opens.</span></span></label>
          <div class="field"><label for="tm-missed">Deduction per missed punch-out (%)</label><input id="tm-missed" type="number" name="missedPct" min="0" max="100" step="0.5" value="${esc(d.settings.missedPct)}"><span class="small muted">Taken off both the achieved booking value and the achieved number of bookings for that month.</span></div></div>
        <div class="err" id="tm-err" role="alert"></div><div><button class="btn" type="submit">Save rewards &amp; rules</button></div></form>`)}`;
  },
  attendance() {
    const k = `att:${S.at.from}:${S.at.to}:${S.at.uid}`;
    return `<div class="row between"><h2>Attendance</h2><button class="btn ghost sm" data-act="tm-dl-att">Download CSV</button></div>
    ${view('staff', () => api('admin/staff'), d => `<div class="card stack"><h3>Today</h3><div class="row">${d.list.map(s => `<span class="chip" style="cursor:default">${esc(s.name)} · ${s.att && s.att.in ? (s.att.out ? 'out ' + esc(s.att.out) : 'on duty since ' + esc(s.att.in)) : 'not punched in'}</span>`).join('') || '<span class="muted">No booking staff yet.</span>'}</div></div>
      <div class="card filters"><div class="row" style="align-items:end">
        <div class="field"><label for="at-from">From</label><input id="at-from" type="date" value="${esc(S.at.from)}" data-chg="tm-at" data-k="from"></div>
        <div class="field"><label for="at-to">To</label><input id="at-to" type="date" value="${esc(S.at.to)}" data-chg="tm-at" data-k="to"></div>
        <div class="field"><label for="at-uid">Staff</label><select id="at-uid" data-chg="tm-at" data-k="uid"><option value="0">All staff</option>${d.list.map(s => `<option value="${s.id}" ${String(S.at.uid) === String(s.id) ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div></div>
        <p class="small muted">A day without a punch-out shows as <b>Missed punch-out</b> and reduces that month's target achievement. Add the punch-out time here if they forgot but worked.</p></div>`)}
    ${view(k, () => api('attendance', {q: S.at}), d => attTable(d.list, true))}`;
  }
});
TABS.splice(TABS.findIndex(t => t[0] === 'dashboard') + 1, 0, ['insights', 'Sales dashboard'], ['reports', 'Reports']);
TABS.splice(TABS.findIndex(t => t[0] === 'staff') + 1, 0, ['targets', 'Targets & rewards'], ['attendance', 'Attendance']);


Object.assign(ADMIN, {
  admins() {
    return `<h2>Admin logins</h2><p class="muted">Admins have full control of the website and this panel, the same as you. They sign in from the Login page (choose <b>Admin</b>) with their email or username. For booking staff, use <button class="linkbtn" data-act="tab" data-v="staff">Booking staff</button> instead.</p>
    ${view('admins', () => api('admin/admins'), d => `<div class="tablewrap"><table><thead><tr><th>Name</th><th>Username</th><th>Email</th><th></th></tr></thead><tbody>
      ${d.list.map(u => `<tr><td><b>${esc(u.name)}</b>${u.me ? ' <span class="pill neu">You</span>' : ''}</td><td>${esc(u.username)}</td><td>${esc(u.email)}</td><td>${u.me ? '' : delBtn('del-admin', u.id, 'Remove admin')}</td></tr>`).join('')}</tbody></table></div>`)}
    <form class="card stack" data-form="admin-new" autocomplete="off"><h3>Add an admin</h3><div class="f2">
      <div class="field"><label for="ad-name">Full name</label><input id="ad-name" name="name" type="text" required></div>
      <div class="field"><label for="ad-email">Email (used to sign in)</label><input id="ad-email" name="email" type="email" required></div>
      <div class="field"><label for="ad-user">Username (optional)</label><input id="ad-user" name="username" type="text" placeholder="Leave empty to use the email"></div>
      <div class="field"><label for="ad-pass">Password (8+ characters)</label><input id="ad-pass" name="password" type="password" autocomplete="new-password" required></div></div>
      <p class="small muted">Use a strong password: admins can change prices, delete bookings and see every customer.</p>
      <div class="err" id="ad-err" role="alert"></div><div><button class="btn" type="submit">Create admin login</button></div></form>`;
  }
});
/* ---------- booking staff: punch in, my work ---------- */
function punchPage() {
  return `<div class="wrap punch"><div class="card stack" style="max-width:460px;margin:40px auto;text-align:center">
    <img src="${LOGO}" alt="" width="72" height="72" style="margin:0 auto">
    <h1>Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${esc((B.user.name || '').split(' ')[0])}</h1>
    <p class="muted">Punch in to open the booking desk. Remember to punch out when you finish. A missed punch-out reduces your monthly target achievement by ${esc(String(ATT.missedPct ?? 1))}%.</p>
    <p class="num" style="font-size:1.6rem;font-weight:800" id="clock">${new Date().toLocaleTimeString('en-IN', {hour: 'numeric', minute: '2-digit'})}</p>
    <button class="btn honey" data-act="tm-punch" data-v="in" style="justify-content:center">Punch in</button>
    <button class="linkbtn" data-act="logout">Log out</button></div></div>`;
}
function punchedOutPage() {
  return `<div class="wrap"><div class="card stack" style="max-width:520px;margin:40px auto;text-align:center">
    <h1>You punched out at ${esc(ATT.out)}</h1><p class="muted">Thanks for today. The booking desk opens again tomorrow after you punch in.</p>
    <div class="row" style="justify-content:center"><button class="btn" data-act="go" data-v="perf">See my work</button><button class="btn ghost" data-act="logout">Log out</button></div></div></div>`;
}
function pagePerf() {
  if (role !== 'staff') return pageLogin();
  const tabs = [['me', 'My performance'], ['att', 'My attendance'], ['rep', 'Reports']];
  if (PERMS.includes('dashboard')) tabs.push(['sales', 'Sales dashboard']);
  const m = S.myMonth;
  let body = '';
  if (S.perfTab === 'sales') body = salesDash();
  else if (S.perfTab === 'rep') body = reportsPanel(PERMS);
  else body = view('my:' + m, () => api('my', {q: {month: m}}), d => S.perfTab === 'att'
    ? `<div class="row between"><p class="muted">${d.attendance.filter(a => a.status === 'Missed punch-out').length} missed punch-out(s) in ${esc(monthLabel(m))}.</p><button class="btn ghost sm" data-act="tm-dl" data-v="attendance" data-from="${monthStart(m)}" data-to="${monthEnd(m)}">Download CSV</button></div>${attTable(d.attendance, false)}`
    : `<section class="card stack"><h3>Target for ${esc(monthLabel(m))}</h3>${progressSummary(d.progress)}${cityTargetsTable(d.progress, false)}</section>
      <div class="grid2">
        <section class="card stack"><h3>My bookings by city</h3><p class="small muted">${esc(monthLabel(m))} · booking value</p>${d.cities.length ? chart('doughnut', {labels: d.cities.map(c => c.name), datasets: [{label: 'Booking value', data: d.cities.map(c => c.value), money: true}]}, {label: 'My bookings by city'}) : '<p class="muted">No bookings added this month yet.</p>'}
          <div class="tablewrap"><table><thead><tr><th>City</th><th class="r">Bookings</th><th class="r">Value</th></tr></thead><tbody>${d.cities.map(c => `<tr><td>${esc(c.name)}</td><td class="r num">${c.count}</td><td class="r num">${money(c.value)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">None yet.</td></tr>'}</tbody></table></div></section>
        <section class="card stack"><h3>Last 6 months</h3><p class="small muted">Bookings I added (cancelled ones left out)</p>${chart('bar', {labels: d.months.map(x => x.label), datasets: [vbar('Booking value', d.months.map(x => x.value)), cbar('Bookings', d.months.map(x => x.count), {type: 'line', color: 1})]}, {money: true, y2: 'Bookings', label: 'My last 6 months'})}</section>
      </div>`);
  return `<div class="wrap" style="padding-block:28px 56px"><div class="row between"><div><p class="eyebrow">My work · ${esc(cityName(B.user.city))}</p><h1>${esc(B.user.name)}</h1></div>${S.perfTab === 'me' || S.perfTab === 'att' ? monthPicker('my-month', m, 'tm-mymonth') : ''}</div>
    <div class="row" style="margin-block:16px">${tabs.map(([k, l]) => `<button class="chip ${S.perfTab === k ? 'on' : ''}" data-act="tm-ptab" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="stack" style="gap:18px">${body}</div></div>`;
}
PAGES.perf = pagePerf;
function staffGate(main) {
  if (role !== 'staff' || !ATT || !ATT.required) return main;
  if (!ATT.in) return punchPage();
  if (ATT.out && S.view === 'staff') return punchedOutPage();
  return main;
}
function dutyChip() {
  if (role !== 'staff' || !ATT || !ATT.required || !ATT.in) return '';
  if (ATT.out) return `<span class="chip hide-m" style="cursor:default">Punched out ${esc(ATT.out)}</span>`;
  return `<button class="chip duty" data-act="tm-punch" data-v="out" data-confirm title="Punch out"><span class="hide-m">On duty since ${esc(ATT.in)} · </span>Punch out</button>`;
}

/* ---------- team actions (called from the main listeners) ---------- */
function presetRange(k) {
  const y = TODAY.slice(0, 4);
  if (k === 'month') return [monthStart(MONTH), TODAY];
  if (k === 'last') { const lm = shiftMonth(MONTH, -1); return [monthStart(lm), monthEnd(lm)]; }
  if (k === 'q') return [monthStart(shiftMonth(MONTH, -2)), TODAY];
  return [y + '-01-01', TODAY];
}
async function teamClick(a, t, id, v) {
  switch (a) {
    case 'tm-preset': { const [f, to] = presetRange(v); S.st.from = f; S.st.to = to; rerenderKeep(); return true; }
    case 'tm-dl': try { await downloadReport(v, t.dataset.from ? {from: t.dataset.from, to: t.dataset.to} : {}); } catch (err) { toast(err.message); } return true;
    case 'tm-dl-att': try { await downloadReport('attendance', {from: S.at.from, to: S.at.to, uid: S.at.uid, city: 'all'}); } catch (err) { toast(err.message); } return true;
    case 'tm-ptab': S.perfTab = v; rerenderKeep(); return true;
    case 'tm-month': { const k = t.dataset.k; if (k === 'tm-tgmonth') S.tgMonth = shiftMonth(S.tgMonth, Number(v)); else S.myMonth = shiftMonth(S.myMonth, Number(v)); rerenderKeep(); return true; }
    case 'tm-copy': try { await api('team', {method: 'POST', body: {what: 'copy', month: S.tgMonth}}); drop('team'); rerenderKeep(); toast('Targets copied'); } catch (err) { toast(err.message); } return true;
    case 'tm-att-del': try { await api('attendance/fix', {method: 'POST', body: {ref: id, action: 'delete'}}); drop('att'); drop('staff'); drop('team'); rerenderKeep(); toast('Attendance entry deleted'); } catch (err) { toast(err.message); } return true;
    case 'del-admin': try { await api('admin/admins/' + id + '/delete', {method: 'POST'}); drop('admins'); rerenderKeep(); toast('Admin login removed'); } catch (err) { toast(err.message); } return true;
    case 'tm-punch': {
      t.disabled = true;
      try {
        const r = await api('attendance/punch', {method: 'POST', body: {action: v}});
        Object.assign(ATT, r.att);
        toast(v === 'in' ? 'Punched in at ' + ATT.in + '. Have a good day!' : 'Punched out at ' + ATT.out + '. See you tomorrow!');
        drop('my'); if (v === 'in') go('staff'); else render();
      } catch (err) { toast(err.message); t.disabled = false; }
      return true; }
  }
  return false;
}
async function teamChange(k, t, id) {
  switch (k) {
    case 'tm-range': { const p = t.dataset.p, key = t.dataset.k; if (p === 'st') S.st[key] = t.value; rerenderKeep(); return true; }
    case 'tm-rp': S.rp[t.dataset.k] = t.value; return true;
    case 'tm-at': S.at[t.dataset.k] = t.value; rerenderKeep(); return true;
    case 'tm-tgmonth': if (t.value) { S.tgMonth = t.value; rerenderKeep(); } return true;
    case 'tm-mymonth': if (t.value) { S.myMonth = t.value; rerenderKeep(); } return true;
    case 'tm-perm': {
      const uid = t.dataset.uid, box = t.closest('tr');
      const perms = [...box.querySelectorAll('input[data-chg="tm-perm"]:checked')].map(x => x.value);
      try { await api('team', {method: 'POST', body: {what: 'perms', uid, perms}}); drop('staff'); toast('Report access saved'); } catch (err) { toast(err.message); t.checked = !t.checked; }
      return true; }
  }
  return false;
}
async function teamSubmit(k, f, fd, send) {
  switch (k) {
    case 'tm-targets': {
      const targets = {};
      Object.keys(fd).forEach(x => { const mm = x.match(/^([vq])_(.+)$/); if (!mm) return; targets[mm[2]] = targets[mm[2]] || {value: 0, qty: 0}; targets[mm[2]][mm[1] === 'v' ? 'value' : 'qty'] = Number(fd[x]) || 0; });
      const r = await send('team', {what: 'targets', month: S.tgMonth, uid: f.dataset.uid, targets});
      if (r) { drop('team'); rerenderKeep(); toast('Targets saved'); }
      return true; }
    case 'tm-settings': {
      const ms = [];
      for (let i = 0; i < 50; i++) { if (!(('ms_pct_' + i) in fd)) break; const p = Number(fd['ms_pct_' + i]); if (p > 0) ms.push({pct: p, basis: fd['ms_basis_' + i], reward: fd['ms_reward_' + i] || ''}); }
      const r = await send('team', {what: 'settings', milestones: ms, missedPct: Number(fd.missedPct) || 0, attendanceOn: !!fd.attendanceOn}, '#tm-err');
      if (r) { db.settings.missedPct = Number(fd.missedPct) || 0; drop('team'); rerenderKeep(); toast('Rewards and rules saved'); }
      return true; }
    case 'admin-new': {
      const r = await send('admin/admins', fd, '#ad-err');
      if (r) { drop('admins'); f.reset(); rerenderKeep(); toast('Admin login created for ' + fd.email); }
      return true; }
    case 'tm-fix': {
      const r = await send('attendance/fix', {ref: f.dataset.id, out: fd.out});
      if (r) { drop('att'); drop('team'); drop('staff'); rerenderKeep(); toast('Punch-out added'); }
      return true; }
  }
  return false;
}

/* ---------- reminders: bulk WhatsApp + daily email ---------- */
S.rm = {days: 15, gap: 7, city: 'all'}; S.rmRun = null;
const remindKey = () => `remind:${S.rm.days}:${S.rm.gap}:${S.rm.city}`;
Object.assign(ADMIN, {
  reminders() {
    return `<h2>Grooming reminders on WhatsApp</h2><p class="muted">Send one WhatsApp reminder to every customer whose last groom was some days ago and who has nothing booked. Customers reminded recently are skipped. To use any other approved template (with your own choice of name, pet, breed in each blank), use <button class="linkbtn" data-act="tab" data-v="broadcast">WhatsApp broadcast</button> and pick "Due for grooming".</p>
    <div class="card filters"><div class="row" style="align-items:end">
      <div class="field"><label for="rm-days">Not groomed for at least (days)</label><input id="rm-days" type="number" min="1" value="${S.rm.days}" data-chg="rm-f" data-k="days" style="width:120px"></div>
      <div class="field"><label for="rm-gap">Skip if reminded in the last (days)</label><input id="rm-gap" type="number" min="0" value="${S.rm.gap}" data-chg="rm-f" data-k="gap" style="width:120px"></div>
      <div class="field"><label for="rm-city">City</label><select id="rm-city" data-chg="rm-f" data-k="city"><option value="all">All cities</option>${db.cities.map(c => `<option value="${esc(c.id)}" ${S.rm.city === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div></div></div>
    ${view(remindKey(), () => api('admin/remind', {q: S.rm}), d => {
      const run = S.rmRun;
      return `${!d.waOn ? '<p class="note"><b>WhatsApp is not connected.</b> Set it up in Settings → WhatsApp messages.</p>' : !d.template ? '<p class="note"><b>One step left:</b> create the WhatsApp template below in Meta, then put its name next to "Grooming reminder" in <button class="linkbtn" data-act="tab" data-v="settings">Settings → WhatsApp messages</button>.</p>' : ''}
      <div class="card stack"><div class="row between"><div><b class="num" style="font-size:1.6rem">${d.count}</b> <span class="muted">customers will get the reminder</span>${d.skipped ? `<div class="small muted">${d.skipped} skipped: reminded in the last ${S.rm.gap} days</div>` : ''}</div>
        <button class="btn honey" data-act="rm-send" ${!d.count || !d.template || (run && run.busy) ? 'disabled' : ''} data-confirm>${run && run.busy ? 'Sending…' : `Send reminder to ${d.count}`}</button></div>
        ${run ? `<div class="stack" style="gap:6px">${bar(run.total ? run.offset / run.total * 100 : 0)}<p class="small">${esc(run.msg)}</p></div>` : ''}
        <p class="small muted">Messages go out in small batches. Keep this page open until it says Done.</p>
        <div class="row" style="align-items:end"><div class="field"><label for="rm-test">Send a test to</label><input id="rm-test" type="tel" placeholder="10-digit mobile" value="${esc(String(db.settings.notifyWhatsApp || '').replace(/\D/g, '').slice(-10))}" style="width:180px"></div><button class="btn ghost sm" data-act="rm-test">Send test</button></div></div>
      <div class="tablewrap"><table><thead><tr><th>Customer</th><th>Pet</th><th>City</th><th>Last groom</th><th class="r">Days</th></tr></thead><tbody>${d.sample.map(c => `<tr><td><b>${esc(c.name)}</b><div class="small num">${esc(c.phone)}</div></td><td>${esc(c.pet)}</td><td>${esc(cityName(c.city))}</td><td class="num">${fmtDate(c.last)}</td><td class="r num">${c.days}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Nobody is due right now.</td></tr>'}</tbody></table></div>
      ${d.count > d.sample.length ? `<p class="small muted">Showing ${d.sample.length} of ${d.count}.</p>` : ''}
      <div class="card stack"><h3>WhatsApp template to create in Meta</h3><p class="small">In WhatsApp Manager create a template named <b>grooming_reminder</b>, category <b>Marketing</b>, language English, with this text:</p>
        <pre class="tpl">Hi {{1}}! It has been {{3}} days since {{2}}'s last groom with Wag &amp; Tails 🐾\n\nOur groomers come home with everything needed. Book your next slot here: {{4}}\n\nReply STOP if you don't want these reminders.</pre>
        <p class="small muted">Meta limits how many marketing messages one person gets, so a few may show "not delivered" in the Notifications log. That is normal.</p></div>
      ${d.history.length ? `<h3>Past runs: did it reach them?</h3><p class="small muted">From WhatsApp's delivery reports. <b>Reached</b> = delivered or read on the customer's phone. <b>Waiting</b> = WhatsApp has not reported back yet (usually minutes). Customers whose message failed can be reminded again in the next run.</p>
      <div class="stack">${d.history.map((h, i) => { const r = h.report || {}; const reached = (r.delivered || 0) + (r.read || 0); const tot = reached + (r.failed || 0) + (r.waiting || 0); return `<div class="card stack">
        <div class="row between"><div><b>${esc(h.at)}</b> <span class="small muted">· by ${esc(h.by)} · ${h.total} customers</span></div><button class="btn ghost sm" data-act="rm-csv" data-v="${i}">Download list</button></div>
        <div class="kpis"><div class="kpi"><span class="muted small">Reached</span><b class="num" style="color:var(--ok)">${reached}</b><span class="small muted">${tot ? Math.round(reached / tot * 100) : 0}% · ${r.read || 0} read</span></div><div class="kpi"><span class="muted small">Failed</span><b class="num" style="color:var(--bad)">${r.failed || 0}</b></div><div class="kpi"><span class="muted small">Waiting</span><b class="num">${r.waiting || 0}</b></div><div class="kpi"><span class="muted small">Accepted by WhatsApp</span><b class="num">${h.sent}</b></div></div>
        ${Object.keys(r.reasons || {}).length ? `<div class="small"><b>Why some failed:</b><ul style="padding-left:18px;margin-top:4px">${Object.entries(r.reasons).map(([k, n]) => `<li><b class="num">${n}</b> · ${esc(k)}</li>`).join('')}</ul></div>` : ''}</div>`; }).join('')}</div>` : ''}`;
    })}`;
  },
  campaign() {
    return `<h2>Daily reminder email</h2><p class="muted">Every day between the dates you choose, at the set time, the website emails customers who are due for grooming (with an email address). Each customer gets it at most once in the gap you set. Every email has a "stop these emails" link.</p>
    ${view('campaign', () => api('admin/campaign'), d => { const c = d.campaign; return `
      <div class="kpis"><div class="kpi"><span class="muted small">Status</span><b>${c.on ? 'On' : 'Off'}</b></div><div class="kpi"><span class="muted small">Due customers with email</span><b class="num">${d.audience}</b></div><div class="kpi"><span class="muted small">Waiting to send today</span><b class="num">${d.queueLeft}</b></div><div class="kpi"><span class="muted small">Unsubscribed</span><b class="num">${d.unsub}</b></div></div>
      <form class="card stack" data-form="campaign">
        <label class="row" style="gap:10px"><span class="toggle"><input type="checkbox" name="on" ${c.on ? 'checked' : ''}><span></span></span><b>Send the daily reminder email</b></label>
        <div class="field"><label for="cp-subj">Subject</label><input id="cp-subj" name="subject" type="text" value="${esc(c.subject)}"></div>
        <div class="field"><label>Image</label><div class="row" style="align-items:center">${c.image ? `<img src="${esc(c.image)}" alt="" style="width:140px;border-radius:10px;border:1px solid var(--line)">` : '<span class="small muted">No image yet</span>'}
          <input type="file" id="cp-file" accept="image/*" data-chg="cp-upload" aria-label="Upload image"><input type="hidden" name="image" id="cp-img" value="${esc(c.image)}">${c.image ? '<button type="button" class="btn ghost sm" data-act="cp-noimg">Remove image</button>' : ''}</div><span class="small muted">JPG or PNG, up to 5 MB. About 1200 × 600 px looks best.</span></div>
        <div class="field"><label for="cp-text">Text</label><textarea id="cp-text" name="text" rows="6">${esc(c.text)}</textarea><span class="small muted">You can use {name}, {pet} and {days}; they are filled in for each customer.</span></div>
        <div class="field"><label for="cp-btn">Button text</label><input id="cp-btn" name="button" type="text" value="${esc(c.button)}" placeholder="Leave empty for no button"></div>
        <div class="f3">
          <div class="field"><label for="cp-start">Start date</label><input id="cp-start" name="start" type="date" value="${esc(c.start)}"></div>
          <div class="field"><label for="cp-end">End date</label><input id="cp-end" name="end" type="date" value="${esc(c.end)}"></div>
          <div class="field"><label for="cp-time">Send time each day</label><input id="cp-time" name="time" type="time" value="${esc(c.time)}"></div>
          <div class="field"><label for="cp-days">Not groomed for at least (days)</label><input id="cp-days" name="days" type="number" min="1" value="${esc(c.days)}"></div>
          <div class="field"><label for="cp-gap">Same customer at most once every (days)</label><input id="cp-gap" name="gap" type="number" min="1" value="${esc(c.gap)}"></div>
          <div class="field"><label for="cp-city">City</label><select id="cp-city" name="city"><option value="all">All cities</option>${db.cities.map(x => `<option value="${esc(x.id)}" ${c.city === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div></div>
        <div class="err" id="cp-err" role="alert"></div>
        <div class="row"><button class="btn" type="submit">Save</button>
          <input type="email" id="cp-to" placeholder="Your email for a test" value="${esc(db.settings.notifyEmail || '')}" style="max-width:260px" aria-label="Test email address"><button type="button" class="btn ghost" data-act="cp-test">Send me a test</button>
          ${d.queueLeft ? '<button type="button" class="btn danger sm" data-act="cp-stop" data-confirm>Stop sending now</button>' : ''}</div>
        <p class="small muted">Emails go out about ${esc(c.perRun)} every 5 minutes so your mailbox is not blocked. Hostinger email has a daily sending limit, so keep the list to a few hundred a day. Server time now: ${esc(d.now)}.</p>
      </form>
      ${c.log.length ? `<h3>Last days</h3><div class="tablewrap"><table><thead><tr><th>Date</th><th class="r">To send</th><th class="r">Sent</th><th class="r">Failed</th></tr></thead><tbody>${c.log.map(l => `<tr><td class="num">${fmtDate(l.date)}</td><td class="r num">${l.queued}</td><td class="r num">${l.sent}</td><td class="r num">${l.failed}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${d.sample.length ? `<h3>Next people to get it</h3><div class="tablewrap"><table><thead><tr><th>Customer</th><th>Email</th><th>Last groom</th></tr></thead><tbody>${d.sample.map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.email)}</td><td class="num">${fmtDate(x.last)}</td></tr>`).join('')}</tbody></table></div>` : ''}`; })}`;
  }
});
{
  const i = TABS.findIndex(t => t[0] === 'rewards');
  TABS.splice(i + 1, 0, ['reminders', 'WhatsApp reminders'], ['campaign', 'Reminder email']);
}
async function runReminders() {
  try {
    const st = await api('admin/remind/start', {method: 'POST', body: S.rm});
    S.rmRun = {busy: true, offset: 0, total: st.total, msg: `Sending 0 of ${st.total}…`}; rerenderKeep();
    let off = 0, r;
    do {
      r = await api('admin/remind/batch', {method: 'POST', body: {job: st.job, offset: off}});
      off = r.offset; S.rmRun = {busy: !r.done, offset: off, total: r.total, msg: r.done ? `Done. ${r.sent} sent${r.failed ? `, ${r.failed} failed (see Notifications log)` : ''}.` : `Sending ${off} of ${r.total}… keep this page open.`}; rerenderKeep();
    } while (!r.done);
    drop('remind');
  } catch (e) { S.rmRun = {busy: false, offset: 0, total: 0, msg: 'Stopped: ' + e.message}; }
  rerenderKeep();
}
async function campaignSave(f, extra) {
  const fd = Object.fromEntries(new FormData(f).entries()); fd.on = !!fd.on;
  return api('admin/campaign', {method: 'POST', body: Object.assign(fd, extra || {})});
}

/* ---------- redo service ---------- */
function redoModal(b) {
  const p = pkgObj(b.pkg);
  openModal(`<form class="stack" data-form="desk-redo" data-id="${esc(b.id)}" novalidate><div class="row between"><h3>Redo service</h3><button type="button" class="x" data-act="close" aria-label="Close">×</button></div>
    <p class="muted">${esc(b.id)} · ${esc(b.name)} · ${esc(pkgLabel(b))}. A free follow-up visit with the same pet and address. The customer gets the confirmation.</p>
    <div class="f2"><div class="field"><label for="rd-d">Date <span class="req">*</span></label><input id="rd-d" name="date" type="date" min="${TODAY}" value="${TODAY}" data-chg="redo-slots"></div>
    <div class="field"><label for="rd-s">Time <span class="req">*</span></label><select id="rd-s" name="start"><option value="">Choose a date first</option></select></div></div>
    <div class="field"><label for="rd-r">Why is it being redone? <span class="req">*</span></label><textarea id="rd-r" name="reason" placeholder="e.g. Nails not trimmed properly, customer unhappy with the haircut"></textarea></div>
    <div class="err" id="m-err" role="alert"></div><div class="row"><button class="btn" type="submit">Book free redo</button><button type="button" class="btn ghost" data-act="close">Back</button></div></form>`);
  fillSlotSelect('#rd-s', redoQ(b, TODAY));
}
function redoQ(b, date) {
  const q = {city: b.city, date, pkg: b.pkg};
  if (b.mins) { q.pkg = '__custom'; q.mins = b.mins; }
  return q;
}
const redoDays = s => { const h = Math.ceil(s / 3600); return h > 24 ? Math.ceil(h / 24) + ' days' : h + ' hour' + (h === 1 ? '' : 's'); };

/* ---------- customers: directory, own details, OTP login ---------- */
S.cl = {q: '', city: 'all', sort: 'last', page: 1}; S.otp = {phone: '', sent: false, needName: false, wait: 0}; S.pwMode = false;
const clKey = () => `clients:${S.cl.q}:${S.cl.city}:${S.cl.sort}:${S.cl.page}`;
const AGG_OPTS = AGGRESSION;
function petRows(pets, prefix) {
  const rows = [...(pets || []), {}];
  return `<div class="stack" style="gap:8px">${rows.map((p, i) => `<div class="petrow">
    <input type="text" name="${prefix}name_${i}" value="${esc(p.name || '')}" placeholder="Pet name" aria-label="Pet name">
    <select name="${prefix}type_${i}" aria-label="Pet type">${['Dog','Cat'].map(t => `<option ${p.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
    <input type="text" name="${prefix}breed_${i}" value="${esc(p.breed || '')}" placeholder="Breed" aria-label="Breed" list="pet-breeds">
    <select name="${prefix}gender_${i}" aria-label="Gender">${['Male','Female'].map(t => `<option ${p.gender === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
    <input type="text" name="${prefix}age_${i}" value="${esc(p.age || '')}" placeholder="Age" aria-label="Age">
    ${i < rows.length - 1 ? `<button type="button" class="x" data-act="pet-del" aria-label="Remove pet">×</button>` : '<span class="small muted">add pet</span>'}</div>`).join('')}
    <datalist id="pet-breeds">${[...(db.breeds.Dog || []), ...(db.breeds.Cat || [])].map(b => `<option value="${esc(b)}">`).join('')}</datalist></div>`;
}
function readPets(fd, prefix) {
  const out = [];
  for (let i = 0; i < 12; i++) { if (!((prefix + 'name_' + i) in fd)) break; const p = {name: fd[prefix + 'name_' + i].trim(), type: fd[prefix + 'type_' + i], breed: fd[prefix + 'breed_' + i].trim(), gender: fd[prefix + 'gender_' + i], age: fd[prefix + 'age_' + i].trim()}; if (p.name || p.breed) out.push(p); }
  return out;
}
function detailsFields(c, staff) {
  return `<div class="f2">
    <div class="field"><label for="cd-name">Full name *</label><input id="cd-name" name="name" type="text" value="${esc(c.name || '')}"></div>
    <div class="field"><label>Mobile</label><input type="tel" value="${esc(c.phone || '')}" disabled><span class="small muted">${staff ? 'The mobile number is the customer\'s login and cannot be changed here.' : 'To change your mobile number, contact us.'}</span></div>
    <div class="field"><label for="cd-email">Email</label><input id="cd-email" name="email" type="email" value="${esc(c.email || '')}"></div>
    ${staff ? `<div class="field"><label for="cd-alt">Other phone</label><input id="cd-alt" name="altPhone" type="tel" value="${esc(c.altPhone || '')}"></div>` : ''}
    <div class="field"><label for="cd-city">City</label><select id="cd-city" name="city"><option value="">—</option>${db.cities.map(x => `<option value="${esc(x.id)}" ${c.city === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
    <div class="field"><label for="cd-pin">Pincode</label><input id="cd-pin" name="pincode" type="text" inputmode="numeric" maxlength="6" value="${esc(c.pincode || '')}"></div></div>
    <div class="field"><label for="cd-addr">Address</label><textarea id="cd-addr" name="address">${esc(c.address || '')}</textarea></div>
    <div class="field"><label>Pets</label>${petRows(c.pets, 'pet_')}</div>
    ${staff ? `<div class="field"><label for="cd-notes">Team notes (customers don't see these)</label><textarea id="cd-notes" name="notes" placeholder="e.g. Dog bites during nail trim, call before arriving">${esc(c.notes || '')}</textarea></div>` : ''}`;
}
function clientsView() {
  const all = role === 'admin' || B.user.city === 'all';
  return `<div class="card filters"><div class="row" style="align-items:end">
      <div class="field" style="flex:1;min-width:220px"><label for="cl-q">Search</label><input id="cl-q" type="search" value="${esc(S.cl.q)}" placeholder="Name, mobile, email, pet or breed"></div>
      ${all ? `<div class="field"><label for="cl-city">City</label><select id="cl-city" data-chg="cl-f" data-k="city"><option value="all">All cities</option>${db.cities.map(c => `<option value="${esc(c.id)}" ${S.cl.city === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>` : ''}
      <div class="field"><label for="cl-sort">Sort</label><select id="cl-sort" data-chg="cl-f" data-k="sort">${[['last','Last booking'],['name','Name'],['spent','Total spent']].map(([k, l]) => `<option value="${k}" ${S.cl.sort === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <button class="btn honey sm" data-act="cl-new">Add customer</button></div></div>
    ${view(clKey(), () => api('clients', {q: S.cl}), d => `<p class="small muted">${d.total} customer${d.total === 1 ? '' : 's'}${S.cl.q ? ' found' : ''}. Tap a customer to see and edit their details.</p>
      <div class="tablewrap"><table class="clickrows"><thead><tr><th>Customer</th><th>City</th><th>Pets</th><th class="r">Bookings</th><th class="r">Spent</th><th>Last booking</th></tr></thead><tbody>
      ${d.list.map(c => `<tr data-act="cl-open" data-id="${esc(c.phone)}" tabindex="0"><td><b>${esc(c.name || '—')}</b>${c.registered ? ' <span class="pill ok">Account</span>' : ''}<div class="small num">${esc(c.phone)}</div><div class="small muted">${esc(c.email || '')}</div></td><td>${esc(cityName(c.city) || '—')}</td><td class="small">${(c.pets || []).map(p => esc([p.name, p.breed].filter(Boolean).join(' · '))).join('<br>') || '—'}</td><td class="r num">${c.bookings}</td><td class="r num">${money(c.spent)}</td><td class="num small">${c.last ? fmtDate(c.last) : '—'}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">No customers match.</td></tr>'}</tbody></table></div>
      ${d.pages > 1 ? `<div class="row" style="justify-content:center">${d.page > 1 ? `<button class="btn ghost sm" data-act="cl-page" data-v="${d.page - 1}">‹ Previous</button>` : ''}<span class="small muted">Page ${d.page} of ${d.pages}</span>${d.page < d.pages ? `<button class="btn ghost sm" data-act="cl-page" data-v="${d.page + 1}">Next ›</button>` : ''}</div>` : ''}`)}`;
}
function pageClients() {
  if (role !== 'staff' && role !== 'admin') return pageLogin();
  return `<div class="wrap" style="padding-block:28px 56px"><p class="eyebrow">Customers</p><h1 style="margin-bottom:16px">Customer details</h1><div class="stack">${clientsView()}</div></div>`;
}
PAGES.clients = pageClients;
ADMIN.customers = () => `<h2>Customers</h2><p class="muted">Every customer from bookings, website accounts and imports. Booking staff can see and edit them too from <b>Customers</b> on the booking desk.</p>${clientsView()}`;
async function openClient(phone, isNew) {
  let c = {phone: '', pets: []};
  if (!isNew) { try { c = (await api('clients/' + phone)).customer; } catch (e) { toast(e.message); return; } }
  openModal(`<form class="stack" data-form="client-save" data-phone="${esc(c.phone)}" novalidate><div class="row between"><h3>${isNew ? 'Add a customer' : esc(c.name || c.phone)}</h3><button type="button" class="x" data-act="close" aria-label="Close">×</button></div>
    ${isNew ? `<div class="field"><label for="cd-phone">Mobile *</label><input id="cd-phone" name="phone" type="tel" placeholder="10-digit mobile"></div>` : `<p class="small muted">${c.bookings} bookings · ${money(c.spent)} spent · <b>${c.points}</b> reward points${c.editedBy ? ` · last edited by ${esc(c.editedBy)}, ${esc(c.editedAt)}` : ''}</p>`}
    ${detailsFields(c, true)}
    <div class="err" id="m-err" role="alert"></div><div class="row"><button class="btn" type="submit">Save details</button><button type="button" class="btn ghost" data-act="close">Close</button>${!isNew ? `<a class="btn ghost sm" href="https://wa.me/91${esc(c.phone)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</div>
    ${!isNew && (c.history || []).length ? `<h4 style="font-family:var(--f-body);margin-top:6px">Bookings</h4><div class="stack" style="gap:0">${c.history.map(b => `<div class="mini"><div><b>${esc(pkgLabel(b))}</b> · ${esc(b.breed || b.petType || '')}<div class="small muted">${fmtDate(b.date)} · ${esc(cityName(b.city))} · <span class="num">${esc(b.id)}</span></div></div><div style="text-align:right">${pill(b.status)}<div class="num small">${money(b.total)}</div></div></div>`).join('')}</div>` : ''}</form>`);
}
function otpBox() {
  const o = S.otp;
  if (S.pwMode) return `<form class="stack" data-form="login" novalidate><input type="hidden" name="who" value="customer">
      <div class="field"><label for="l-user">Mobile number</label><input id="l-user" name="user" type="tel" autocomplete="username"></div>
      <div class="field"><label for="l-pass">Password</label><input id="l-pass" name="pass" type="password" autocomplete="current-password"></div>
      <div class="err" id="l-err" role="alert"></div><button class="btn" type="submit">Sign in</button>
      <p class="small"><a href="${esc(B.links.lostPass)}">Forgot your password?</a> · <button type="button" class="linkbtn" data-act="pw-mode">Get a code on WhatsApp instead</button></p></form>`;
  if (!o.sent) return `<form class="stack" data-form="otp-send" novalidate>
      <div class="field"><label for="o-phone">Mobile number</label><input id="o-phone" name="phone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="10-digit mobile" value="${esc(o.phone)}"></div>
      <div class="err" id="o-err" role="alert"></div><button class="btn" type="submit">Send code on WhatsApp</button>
      <p class="small muted">We'll send a 6-digit code to this number on WhatsApp. New here? The same code creates your account.</p>
      <p class="small"><button type="button" class="linkbtn" data-act="pw-mode">Sign in with password</button></p></form>`;
  return `<form class="stack" data-form="otp-verify" novalidate>
      <p class="small">Code sent on WhatsApp to <b class="num">${esc(o.phone)}</b>. <button type="button" class="linkbtn" data-act="otp-change">Change number</button></p>
      <div class="field"><label for="o-code">6-digit code</label><input id="o-code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" style="letter-spacing:.3em;font-size:1.2rem"></div>
      ${o.needName ? `<div class="field"><label for="o-name">Your full name</label><input id="o-name" name="name" type="text" autocomplete="name"></div>` : ''}
      <div class="err" id="o-err" role="alert"></div><button class="btn" type="submit">${o.needName ? 'Create account' : 'Sign in'}</button>
      <p class="small">Didn't get it? <button type="button" class="linkbtn" data-act="otp-resend" ${o.wait > Date.now() ? 'disabled' : ''}>Send again</button></p></form>`;
}
function myDetailsCard(p) {
  return `<form class="card stack" data-form="me-profile" novalidate><div class="row between"><h3>My details</h3><span class="small muted">Used to fill your next booking</span></div>
    ${detailsFields(p || {phone: B.user.phone, name: B.user.name, email: B.user.email, pets: []}, false)}
    <div class="err" id="me-err" role="alert"></div><div><button class="btn sm" type="submit">Save my details</button></div></form>`;
}
async function deskLookup(phone) {
  if (!/^\d{10}$/.test(phone)) return;
  try {
    const r = await api('desk/customer', {q: {phone}}); const c = r.customer; const note = $('#da-known');
    if (!c) { if (note) note.innerHTML = '<span class="muted">New customer</span>'; return; }
    const set = (id, v) => { const el = $(id); if (el && !el.value && v) el.value = v; };
    set('#da-name', c.name); set('#da-email', c.email); set('#da-pin', c.pincode); set('#da-addr', c.address);
    const pet = (c.pets || [])[0];
    if (pet) { set('#da-br', pet.breed); set('#da-age', pet.age); const pt = $('#da-pt'); if (pt && pet.type) pt.value = pet.type; const g = $('#da-g'); if (g && pet.gender) g.value = pet.gender; }
    if (note) note.innerHTML = `<b>Returning customer</b> · ${c.bookings} bookings${c.last ? ', last ' + fmtDate(c.last) : ''}${(c.pets || []).length > 1 ? ' · pets: ' + c.pets.map(p => esc(p.name || p.breed)).join(', ') : ''}${c.notes ? `<br><span style="color:var(--warn)"><b>Team note:</b> ${esc(c.notes)}</span>` : ''}`;
  } catch (e) { /* ignore */ }
}

/* ---------- live refresh: booking desk and dashboard pick up new bookings without a page reload ---------- */
function liveKey() {
  if (S.view === 'staff') return deskKey();
  if (S.view === 'admin' && S.adminTab === 'bookings') return deskKey();
  if (S.view === 'admin' && S.adminTab === 'dashboard') return 'dash';
  return null;
}
let liveBusy = false;
async function liveRefresh(force) {
  if (liveBusy || document.hidden || (role !== 'admin' && role !== 'staff')) return;
  if (role === 'staff' && ATT && ATT.required && (!ATT.in || ATT.out)) return;
  const key = liveKey(); if (!key || !C[key] || !C[key].data) return;
  if ($('#layer').innerHTML) return; // a form is open: don't disturb it
  const a = document.activeElement;
  if (!force && a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.id !== 'desk-q') return;
  liveBusy = true;
  try {
    const d = await (key === 'dash' ? api('admin/dashboard') : loadDesk());
    if (liveKey() !== key || !C[key] || !C[key].data || $('#layer').innerHTML) return;
    const old = C[key].data;
    if (JSON.stringify(d) === JSON.stringify(old)) return;
    const was = new Set((old.list || old.next || []).map(b => b.id));
    const added = (d.list || d.next || []).filter(b => !was.has(b.id));
    Object.keys(C).forEach(k => { if (k !== key && (k.startsWith('desk:') || k === 'dash')) delete C[k]; });
    C[key] = {data: d};
    rerenderKeep();
    if (added.length) toast(added.length === 1 ? `New booking ${added[0].id} · ${added[0].name}` : `${added.length} new bookings`);
  } catch (e) { /* offline for a moment: try again next time */ } finally { liveBusy = false; }
}
setInterval(() => liveRefresh(false), 20000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) liveRefresh(true); });
window.addEventListener('focus', () => liveRefresh(true));

/* ---------- leave & holidays: block dates per city (v1.9) ---------- */
Object.assign(ADMIN, {
  blocks() {
    const cs = db.cities.filter(c => c.service);
    const cn = id => id === 'all' ? 'All cities' : cityName(id);
    const maxCap = Math.max(1, ...cs.map(c => Number(c.capacity) || 1));
    return `<h2>Leave &amp; holidays</h2><p class="muted">Block dates when a groomer is on leave or for a holiday. Customers can't book those times and see them as <b>Booked</b>. Bookings already made are not cancelled; they are listed below so you can reschedule them.</p>
    <form class="card stack" data-form="blk-new"><h3>Block dates</h3><div class="f3">
      <div class="field"><label for="bl-city">City</label><select id="bl-city" name="city">${cs.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}<option value="all">All cities</option></select></div>
      <div class="field"><label for="bl-from">From</label><input id="bl-from" name="from" type="date" min="${TODAY}" value="${TODAY}" required></div>
      <div class="field"><label for="bl-to">To (same day for one day)</label><input id="bl-to" name="to" type="date" min="${TODAY}" value="${TODAY}"></div>
      <div class="field"><label for="bl-off">Who is off</label><select id="bl-off" name="off"><option value="0">All groomers (no bookings)</option>${[...Array(Math.max(0, maxCap - 1))].map((_, i) => `<option value="${i + 1}">${i + 1} groomer${i ? 's' : ''} (others still take bookings)</option>`).join('')}</select></div>
      <div class="field"><label for="bl-note">Reason (only you see this)</label><input id="bl-note" name="note" type="text" maxlength="120" placeholder="e.g. Ravi on leave, Diwali"></div>
      <div class="field"><label><input type="checkbox" name="allDay" checked data-chg="bl-allday"> Whole day</label><div class="row" id="bl-times" hidden style="flex-wrap:nowrap"><input name="start" type="time" value="13:00" aria-label="Block from time"><span class="small muted">to</span><input name="end" type="time" value="19:00" aria-label="Block until time"></div></div>
    </div><div class="err" id="bl-err" role="alert"></div><div><button class="btn" type="submit">Block these dates</button></div></form>
    ${view('blocks', () => api('admin/blocks'), d => d.list.length ? `<div class="tablewrap"><table><thead><tr><th>City</th><th>Dates</th><th>Time</th><th>Who is off</th><th>Reason</th><th>Bookings already made</th><th></th></tr></thead><tbody>
      ${d.list.map(b => `<tr><td><b>${esc(cn(b.city))}</b></td><td class="num">${fmtDate(b.from)}${b.to !== b.from ? ' – ' + fmtDate(b.to) : ''}</td><td>${b.start ? esc(b.start + ' – ' + b.end) : 'Whole day'}</td><td>${Number(b.off) ? b.off + ' groomer' + (b.off > 1 ? 's' : '') : 'All'}</td><td class="small">${esc(b.note || '')}<div class="muted">by ${esc(b.by || '')}</div></td>
        <td>${b.clashes.length ? `<span class="pill bad">${b.clashes.length} to reschedule</span><div class="small">${b.clashes.map(c => `<button class="linkbtn" data-act="bk-view" data-id="${esc(c.id)}">${esc(c.id)}</button> ${esc(fmtDate(c.date))} ${esc(c.slot)} · ${esc(c.name)}`).join('<br>')}</div>` : '<span class="small muted">None</span>'}</td>
        <td>${delBtn('blk-del', b.id, 'Unblock')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="card muted">No dates blocked. Customers can book any open time.</div>')}`;
  }
});
const _teamClickBlk = teamClick;
teamClick = async function (a, t, id, v) {
  if (a === 'blk-del') {
    try { await api('admin/blocks', {method: 'POST', body: {action: 'delete', id}}); drop('blocks'); Object.keys(SLOTC).forEach(k => delete SLOTC[k]); await refreshBlocked(); rerenderKeep(); toast('Dates unblocked'); } catch (err) { toast(err.message); }
    return true;
  }
  return _teamClickBlk(a, t, id, v);
};
const _teamSubmitBlk = teamSubmit;
teamSubmit = async function (k, f, fd, send) {
  if (k === 'blk-new') {
    const r = await send('admin/blocks', {...fd, allDay: !!fd.allDay}, '#bl-err');
    if (r) {
      drop('blocks'); Object.keys(SLOTC).forEach(x => delete SLOTC[x]); await refreshBlocked(); rerenderKeep();
      toast(r.clashes && r.clashes.length ? `Blocked. ${r.clashes.length} booking${r.clashes.length > 1 ? 's are' : ' is'} already on these dates – please reschedule.` : 'Dates blocked. Customers will see them as booked.');
    }
    return true;
  }
  return _teamSubmitBlk(k, f, fd, send);
};
async function refreshBlocked() {
  try { const d = await api('admin/blocks'); C.blocks = {data: d}; } catch (e) { /* ignore */ }
  try { const r = await api('blocked-days'); B.blockedDays = r.days || {}; } catch (e) { /* ignore */ }
}
document.addEventListener('change', e => { if (e.target.dataset && e.target.dataset.chg === 'bl-allday') { const t = $('#bl-times'); if (t) t.hidden = e.target.checked; } });

/* ---------- pet events: passes, check-in, WhatsApp broadcast (v1.9) ---------- */
S.eventId = new URLSearchParams(location.search).get('ev') || '';
S.evQty = {}; S.lastPass = null; S.evEdit = null; S.evView = ''; S.gateEv = ''; S.gateQ = '';
S.bc = {kind: 'event', event: '', text: '', link: '', city: 'all', who: 'all', gap: 3}; S.bcRun = null;
const evDay = e => { const d = new Date(e.date + 'T12:00'); return {d: d.getDate(), m: d.toLocaleDateString('en-IN', {month: 'short'}), w: d.toLocaleDateString('en-IN', {weekday: 'short'})}; };
const evFrom = e => { const ps = (e.passes || []).map(p => Number(p.price)).filter(x => x > 0); const m = ps.length ? Math.min(...ps) : 0; return m > 0 ? 'from ' + money(m) : 'Free'; };
function eventCard(e) {
  const d = evDay(e);
  return `<article class="evcard"><button class="evimg" data-act="ev-open" data-id="${esc(e.id)}" aria-label="${esc(e.title)}">${e.img ? `<img src="${esc(e.img)}" alt="" loading="lazy">` : PAW}<span class="evdate"><b>${d.d}</b>${esc(d.m)}</span></button>
    <div class="body stack" style="gap:6px"><div class="row" style="gap:6px"><span class="tag">${esc(cityName(e.city))}</span>${e.soldOut ? '<span class="pill bad">Sold out</span>' : !e.open ? '<span class="pill neu">Sales closed</span>' : ''}</div>
    <h3 style="font-size:1.1rem">${esc(e.title)}</h3><p class="small muted">${esc(e.when)} · ${esc(e.venue)}</p>
    <div class="row between" style="margin-top:auto"><b>${evFrom(e)}</b><button class="btn sm" data-act="ev-open" data-id="${esc(e.id)}">${e.open && !e.soldOut ? 'Get passes' : 'View'}</button></div></div></article>`;
}
function pageEvents() {
  return `<div class="wrap" style="padding-bottom:56px">${view('events', () => api('events'), d => {
    if (S.lastPass) return passDone(S.lastPass);
    const e = S.eventId && d.events.find(x => x.id === S.eventId);
    if (e) return eventDetail(e);
    const mine = d.events.filter(x => x.city === S.city), other = d.events.filter(x => x.city !== S.city);
    return `<div class="pagehead"><p class="eyebrow">Wag &amp; Tails events</p><h1>Pet events near you</h1><p class="muted">Meet-ups, pet shows and fun days for pets and their people. Buy passes online and show the pass ID at the entry.</p></div>
      ${d.events.length ? '' : '<div class="card muted">No events coming up right now. Check back soon!</div>'}
      ${mine.length ? `<div class="evgrid">${mine.map(eventCard).join('')}</div>` : ''}
      ${other.length ? `${mine.length ? '<h2 style="margin-top:28px">In other cities</h2>' : ''}<div class="evgrid">${other.map(eventCard).join('')}</div>` : ''}`;
  })}</div>`;
}
function evTotal(e) { return (e.passes || []).reduce((a, p) => a + (Number(S.evQty[p.id]) || 0) * p.price, 0); }
function eventDetail(e) {
  const u = role === 'customer' ? (B.user || {}) : {}, pr = (u.profile || {});
  const can = e.open && !e.soldOut, tot = evTotal(e), n = Object.values(S.evQty).reduce((a, b) => a + (Number(b) || 0), 0);
  return `<button class="linkbtn" data-act="ev-back" style="margin-top:20px">← All events</button>
  <div class="evdetail">
    <div class="stack">${e.img ? `<img class="evhero" src="${esc(e.img)}" alt="${esc(e.title)}">` : ''}
      <p class="eyebrow">${esc(cityName(e.city))}</p><h1 style="margin-top:4px">${esc(e.title)}</h1>
      <div class="evmeta"><div><b>When</b><span>${esc(e.when)}</span></div><div><b>Where</b><span>${esc(e.venue)}${e.address ? '<br>' + esc(e.address) : ''}${e.map ? `<br><a href="${esc(e.map)}" target="_blank" rel="noopener">Open in Maps</a>` : ''}</span></div></div>
      ${e.desc ? `<div class="prose">${esc(e.desc).split(/\n{2,}/).map(x => `<p>${x.replace(/\n/g, '<br>')}</p>`).join('')}</div>` : ''}
    </div>
    <form class="card stack evbuy" data-form="ev-buy" data-id="${esc(e.id)}" novalidate><h3>${can ? 'Get your passes' : e.soldOut ? 'Sold out' : 'Pass sales are closed'}</h3>
      ${(e.passes || []).map(p => { const q = Number(S.evQty[p.id]) || 0, out = p.left === 0; const lim = Math.min(p.max, p.left === null ? p.max : p.left);
        return `<div class="passrow"><div><b>${esc(p.name)}</b>${p.desc ? `<div class="small muted">${esc(p.desc)}</div>` : ''}<div class="small"><b>${p.price > 0 ? money(p.price) : 'Free'}</b>${p.left !== null && p.left <= 20 && p.left > 0 ? ` · <span style="color:var(--bad)">only ${p.left} left</span>` : ''}${out ? ' · <span class="muted">Sold out</span>' : ''}</div></div>
        ${can && !out ? `<div class="stepper"><button type="button" data-act="ev-q" data-id="${esc(p.id)}" data-v="-1" aria-label="One less ${esc(p.name)}" ${q ? '' : 'disabled'}>−</button><span class="num" aria-live="polite">${q}</span><button type="button" data-act="ev-q" data-id="${esc(p.id)}" data-v="1" data-max="${lim}" aria-label="One more ${esc(p.name)}" ${q >= lim ? 'disabled' : ''}>+</button></div>` : ''}</div>`; }).join('')}
      ${can ? `<div class="f2">
        <div class="field"><label for="ev-name">Your name <span class="req">*</span></label><input id="ev-name" name="name" type="text" autocomplete="name" value="${esc(pr.name || u.name || '')}"></div>
        <div class="field"><label for="ev-phone">WhatsApp number <span class="req">*</span></label><input id="ev-phone" name="phone" type="tel" autocomplete="tel" placeholder="10-digit mobile" value="${esc(u.phone || '')}"></div></div>
        <div class="field"><label for="ev-email">Email (for the receipt)</label><input id="ev-email" name="email" type="email" autocomplete="email" value="${esc(pr.email || u.email || '')}"></div>
        <input type="text" name="website" tabindex="-1" autocomplete="off" class="sr" aria-hidden="true">
        <div class="sumline total"><span>${n} pass${n === 1 ? '' : 'es'}</span><b class="num">${money(tot)}</b></div>
        <div class="err" id="ev-err" role="alert"></div>
        <button class="btn" type="submit" id="ev-pay" ${n ? '' : 'disabled'}>${tot > 0 ? 'Pay ' + money(tot) + ' securely' : 'Confirm passes'}</button>
        <p class="small muted">Your pass ID comes on WhatsApp${tot > 0 ? ' right after payment' : ''}. Passes are non-refundable unless the event is cancelled. <a href="${esc((B.legal || {}).terms || '#')}">Terms</a></p>` : ''}
    </form></div>`;
}
function passDone(p) {
  return `<div style="max-width:640px;margin:32px auto 0"><div class="okbox stack"><p class="eyebrow" style="color:var(--ok)">Passes confirmed</p><h1>See you at ${esc(p.title)}!</h1>
    <p>Your pass ID is <b class="num" style="font-size:1.4rem">${esc(p.id)}</b>. Show it at the entry. We've also sent it on WhatsApp to <b class="num">${esc(p.phone)}</b>${p.email ? ' and to ' + esc(p.email) : ''}.</p></div>
    <div class="card stack" style="margin-top:16px"><div class="sumline"><span>When</span><b>${esc(p.when || fmtDate(p.date))}</b></div><div class="sumline"><span>Where</span><b>${esc(p.venue || '')}</b></div>
    ${(p.items || []).map(it => `<div class="sumline"><span>${esc(it.name)} × ${it.qty}</span><b class="num">${money(it.price * it.qty)}</b></div>`).join('')}
    <div class="sumline total"><span>Paid</span><b class="num">${money(p.total)}</b></div></div>
    <div class="row" style="margin-top:16px"><button class="btn ghost" data-act="ev-back">More events</button>${role === 'customer' ? '<button class="btn ghost" data-act="go" data-v="account">My account</button>' : ''}</div></div>`;
}
async function buyPasses(f) {
  const e = (C.events && C.events.data && C.events.data.events || []).find(x => x.id === f.dataset.id); if (!e) return;
  const fd = Object.fromEntries(new FormData(f).entries()), out = $('#ev-err'), btn = $('#ev-pay');
  const items = {}; Object.keys(S.evQty).forEach(k => { if (S.evQty[k] > 0) items[k] = S.evQty[k]; });
  if (!Object.keys(items).length) { out.textContent = 'Choose at least one pass.'; return; }
  if ((fd.name || '').trim().length < 2) { out.textContent = 'Enter your name.'; return; }
  if (!/^\d{10}$/.test(String(fd.phone || '').replace(/\D/g, '').slice(-10))) { out.textContent = 'Enter a valid 10-digit WhatsApp number.'; return; }
  out.textContent = ''; btn.disabled = true; const label = btn.textContent; btn.textContent = 'Please wait…';
  try {
    const res = await api('events/buy', {method: 'POST', body: Object.assign(fd, {event: e.id, items})});
    let pass = res.pass;
    if (res.rzp) {
      if (!await loadRazorpay()) throw new Error('Could not open Razorpay. Check your connection and try again.');
      const r = await new Promise(resolve => { const rz = new window.Razorpay({key: res.rzp.key, order_id: res.rzp.order_id, amount: res.rzp.amount, currency: 'INR', name: 'Wag & Tails', description: res.rzp.desc, image: LOGO, prefill: {name: res.rzp.name, email: res.rzp.email, contact: res.rzp.contact}, theme: {color: '#4B1D00'}, handler: x => resolve(x), modal: {ondismiss: () => resolve(null)}}); rz.open(); });
      if (!r) { out.textContent = 'Payment was not completed. Your passes are held for 20 minutes; you can try again.'; return; }
      btn.textContent = 'Confirming payment…';
      pass = (await api('events/verify', {method: 'POST', body: Object.assign({ref: res.ref}, r)})).pass;
    }
    S.lastPass = pass; S.evQty = {}; drop('events'); drop('mypasses'); render(); window.scrollTo(0, 0);
  } catch (err) { out.textContent = err.message; toast(err.message); }
  finally { if (btn.isConnected) { btn.disabled = false; btn.textContent = label; } }
}
PAGES.events = pageEvents;
const _pageAccountEv = pageAccount;
PAGES.account = () => _pageAccountEv() + (role === 'customer' ? `<div class="wrap" style="padding-bottom:56px;margin-top:-32px">${view('mypasses', () => api('me/passes'), d => d.passes.length ? `<h2>My event passes</h2><div class="stack">${d.passes.map(p => `<div class="card row between"><div><b>${esc(p.title)}</b><div class="small muted">${esc(p.when || fmtDate(p.date))} · ${esc(p.venue || '')}</div><div class="small">${(p.items || []).map(i => i.qty + ' × ' + esc(i.name)).join(', ')}</div></div><div style="text-align:right"><div class="small muted">Pass ID</div><b class="num" style="font-size:1.2rem">${esc(p.id)}</b>${p.checked ? '<div><span class="pill ok">Checked in</span></div>' : ''}</div></div>`).join('')}</div>` : '')}</div>` : '');

/* ----- admin: events & passes ----- */
const EVST = {draft: ['Draft', 'neu'], live: ['On sale', 'ok'], closed: ['Closed', 'bad']};
function evForm(e) {
  e = e || {passes: [{name: 'Pet + 1 parent', price: 499, qty: 100, max: 10}], status: 'draft', city: (db.cities.find(c => c.service) || {}).id};
  const cs = db.cities.filter(c => c.service);
  return `<form class="card stack" data-form="ev-save" data-id="${esc(e.id || '')}"><div class="row between"><h3>${e.id ? 'Edit event' : 'New event'}</h3><button type="button" class="btn ghost sm" data-act="ev-cancel">Close</button></div>
    <div class="f3"><div class="field" style="grid-column:span 2"><label for="ef-title">Event name <span class="req">*</span></label><input id="ef-title" name="title" type="text" value="${esc(e.title || '')}" placeholder="e.g. Pawsome Sunday – Pet Carnival" required></div>
      <div class="field"><label for="ef-city">City <span class="req">*</span></label><select id="ef-city" name="city">${cs.map(c => `<option value="${esc(c.id)}" ${c.id === e.city ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="ef-date">Date <span class="req">*</span></label><input id="ef-date" name="date" type="date" value="${esc(e.date || '')}" required></div>
      <div class="field"><label for="ef-start">Starts</label><input id="ef-start" name="start" type="time" value="${esc(e.start || '')}"></div>
      <div class="field"><label for="ef-end">Ends</label><input id="ef-end" name="end" type="time" value="${esc(e.end || '')}"></div>
      <div class="field"><label for="ef-venue">Venue</label><input id="ef-venue" name="venue" type="text" value="${esc(e.venue || '')}" placeholder="e.g. Green Park Lawns"></div>
      <div class="field"><label for="ef-addr">Address</label><input id="ef-addr" name="address" type="text" value="${esc(e.address || '')}"></div>
      <div class="field"><label for="ef-map">Google Maps link</label><input id="ef-map" name="map" type="url" value="${esc(e.map || '')}" placeholder="https://maps.app.goo.gl/…"></div></div>
    <div class="field"><label for="ef-desc">About the event (what happens, what to bring, rules)</label><textarea id="ef-desc" name="desc" rows="5">${esc(e.desc || '')}</textarea></div>
    <div class="f3"><div class="field"><label for="ef-imgf">Poster or photo</label><input id="ef-imgf" type="file" accept="image/*" data-chg="ef-upload"><input type="hidden" name="img" id="ef-img" value="${esc(e.img || '')}">${e.img ? `<img src="${esc(e.img)}" alt="" style="max-width:160px;border-radius:10px;margin-top:6px">` : ''}</div>
      <div class="field"><label for="ef-status">Status</label><select id="ef-status" name="status">${Object.entries(EVST).map(([k, v]) => `<option value="${k}" ${e.status === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select><span class="small muted">Draft is hidden. On sale shows on the website.</span></div>
      <div class="field"><label for="ef-sales">Stop selling after (optional)</label><input id="ef-sales" name="salesEnd" type="date" value="${esc(e.salesEnd || '')}"></div></div>
    <h4>Pass types</h4><p class="small muted">Quantity is the total available (0 = no limit). "Max per order" limits how many one person can buy.</p>
    <div id="ef-passes" class="stack" style="gap:8px">${(e.passes || []).map((p, i) => passRowEdit(p, i)).join('')}</div>
    <div><button type="button" class="btn ghost sm" data-act="ef-addpass">+ Add pass type</button></div>
    <div class="err" id="ef-err" role="alert"></div><div class="row"><button class="btn" type="submit">${e.id ? 'Save changes' : 'Create event'}</button></div></form>`;
}
function passRowEdit(p, i) {
  return `<div class="f3 passedit" data-i="${i}"><input type="hidden" name="p_id_${i}" value="${esc(p.id || '')}">
    <div class="field"><label>Pass name</label><input name="p_name_${i}" type="text" value="${esc(p.name || '')}" placeholder="e.g. Pet + 1 parent"></div>
    <div class="field"><label>What's included</label><input name="p_desc_${i}" type="text" value="${esc(p.desc || '')}" placeholder="optional"></div>
    <div class="row" style="flex-wrap:nowrap;align-items:end"><div class="field"><label>Price ₹</label><input name="p_price_${i}" type="number" min="0" value="${esc(p.price ?? '')}"></div><div class="field"><label>Quantity</label><input name="p_qty_${i}" type="number" min="0" value="${esc(p.qty ?? 0)}"></div><div class="field"><label>Max per order</label><input name="p_max_${i}" type="number" min="1" max="50" value="${esc(p.max ?? 10)}"></div><button type="button" class="btn ghost sm" data-act="ef-delpass" aria-label="Remove pass type">✕</button></div></div>`;
}
Object.assign(ADMIN, {
  events() {
    if (S.evView) return attendeesView(S.evView, true);
    return `<div class="row between"><h2>Events &amp; passes</h2>${S.evEdit ? '' : '<button class="btn honey sm" data-act="ev-new">New event</button>'}</div>
    <p class="muted">Create an event, add pass types and set it to <b>On sale</b>. It appears under <b>Events</b> on the website, customers pay online, and their pass ID arrives on WhatsApp. Send invites from <button class="linkbtn" data-act="tab" data-v="broadcast">WhatsApp broadcast</button>.</p>
    ${S.evEdit ? evForm(S.evEdit === 'new' ? null : S.evEdit) : ''}
    ${view('aevents', () => api('admin/events'), d => d.events.length ? `<div class="tablewrap"><table><thead><tr><th>Event</th><th>City</th><th>Date</th><th>Status</th><th>Passes sold</th><th>People</th><th>Collected</th><th></th></tr></thead><tbody>
      ${d.events.map(e => { const cap = e.passes.reduce((a, p) => a + (Number(p.qty) || 0), 0), st = EVST[e.status] || EVST.draft;
        return `<tr><td><b>${esc(e.title)}</b><div class="small muted">${esc(e.venue || '')}</div></td><td>${esc(cityName(e.city))}</td><td class="num">${fmtDate(e.date)}${e.start ? '<div class="small muted">' + esc(e.start) + '</div>' : ''}</td><td>${pill(st[0]).replace(/class="pill \w+"/, `class="pill ${st[1]}"`)}</td>
        <td class="num">${e.orders} order${e.orders === 1 ? '' : 's'}<div class="small muted">${e.passes.map(p => `${esc(p.name)}: ${e.sold[p.id] || 0}${p.qty ? '/' + p.qty : ''}`).join('<br>')}</div></td><td class="num">${e.people}${cap ? ' / ' + cap : ''}<div class="small muted">${e.checked} checked in</div></td><td class="num">${money(e.revenue)}</td>
        <td><div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn ghost sm" data-act="ev-edit" data-id="${esc(e.id)}">Edit</button><button class="btn ghost sm" data-act="ev-att" data-id="${esc(e.id)}">Passes</button><button class="btn ghost sm" data-act="ev-copy" data-v="${esc(e.link)}">Copy link</button>${e.orders ? '' : delBtn('ev-del', e.id)}</div></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="card muted">No events yet. Click <b>New event</b> to add the first one.</div>')}`;
  },
  broadcast() {
    const b = S.bc, cs = db.cities.filter(c => c.service);
    const q = {city: b.city, who: b.who, event: b.kind === 'event' || b.who !== 'all' ? b.event : '', gap: b.gap};
    return `<h2>WhatsApp broadcast</h2><p class="muted">Send an event invite or a general update to customers in one city, or all cities. WhatsApp only allows approved templates for these messages. Add the template names in Settings → WhatsApp messages (<b>Event invite</b> and <b>Broadcast / update</b>).</p>
    ${view('aevents', () => api('admin/events'), d => { const evs = d.events.filter(e => e.status === 'live' && e.date >= TODAY);
      if (!b.event && evs.length) b.event = evs[0].id;
      return `<form class="card stack" data-form="bc-send"><div class="seg" role="radiogroup" aria-label="Message type">${[['event', 'Event invite'], ['text', 'General update']].map(([k, l]) => `<label><input type="radio" name="kind" value="${k}" data-chg="bc" data-k="kind" ${b.kind === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
      <div class="f3">${b.kind === 'event' || b.who !== 'all' ? `<div class="field"><label for="bc-ev">Event</label><select id="bc-ev" data-chg="bc" data-k="event">${evs.map(e => `<option value="${esc(e.id)}" ${e.id === b.event ? 'selected' : ''}>${esc(e.title)} · ${esc(cityName(e.city))} · ${fmtDate(e.date)}</option>`).join('') || '<option value="">No event on sale</option>'}</select></div>` : ''}
        <div class="field"><label for="bc-city">City</label><select id="bc-city" data-chg="bc" data-k="city"><option value="all">All cities</option>${cs.map(c => `<option value="${esc(c.id)}" ${c.id === b.city ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="bc-who">Send to</label><select id="bc-who" data-chg="bc" data-k="who">${[['all', 'All customers in the city'], ['nonholders', 'Customers without a pass for the event'], ['holders', 'Only people with a pass (event update)']].map(([k, l]) => `<option value="${k}" ${b.who === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label for="bc-gap">Skip if messaged in the last (days)</label><input id="bc-gap" type="number" min="0" max="30" value="${esc(b.gap)}" data-chg="bc" data-k="gap"></div></div>
      ${b.kind === 'text' ? `<div class="field"><label for="bc-text">Message <span class="small muted">(goes in place of {{2}}; "Hi &lt;name&gt;," is added automatically)</span></label><textarea id="bc-text" rows="3" maxlength="600" data-chg="bc" data-k="text" placeholder="e.g. we are now grooming in Pune too! Book your first home groom this week and get 15% off.">${esc(b.text)}</textarea></div>
        <div class="field"><label for="bc-link">Link (optional)</label><input id="bc-link" type="url" value="${esc(b.link)}" data-chg="bc" data-k="link" placeholder="https://wagandtails.in/#book"></div>` : ''}
      ${view('bcprev:' + JSON.stringify(q), () => api('admin/broadcast', {q}), p => `<p class="note"><b class="num">${p.count}</b> customer${p.count === 1 ? '' : 's'} will get this message${p.sample.length ? ' (e.g. ' + p.sample.filter(Boolean).map(esc).join(', ') + ')' : ''}.</p>`)}
      <div class="row" style="align-items:end"><div class="field"><label for="bc-test">Send a test to</label><input id="bc-test" type="tel" placeholder="10-digit mobile" style="max-width:180px"></div><button type="button" class="btn ghost" data-act="bc-test">Send test</button><span style="flex:1"></span><button class="btn" type="submit" ${S.bcRun && S.bcRun.busy ? 'disabled' : ''}>Send to everyone</button></div>
      ${S.bcRun ? `<p class="note" role="status">${esc(S.bcRun.msg)}</p>` : ''}
      <div class="err" id="bc-err" role="alert"></div></form>`; })}
    ${view('bclog', () => api('admin/broadcast', {q: {city: 'none', who: 'all'}}), p => p.log.length ? `<h3>Past broadcasts</h3><div class="tablewrap"><table><thead><tr><th>When</th><th>Message</th><th>City</th><th>Sent</th><th>Failed</th><th></th></tr></thead><tbody>${p.log.map(l => `<tr><td class="small">${esc(l.at)}<div class="muted">${esc(l.by)}</div></td><td>${esc(l.title)}</td><td>${esc(cityName(l.city))}</td><td class="num">${l.sent}</td><td class="num">${l.failed}</td><td><button class="btn ghost sm" data-act="bc-rep" data-v="${esc(l.job)}">Delivery report</button></td></tr>${S.bcRep && S.bcRep.job === l.job ? `<tr><td colspan="6">${S.bcRep.data ? `<p class="small"><b>${S.bcRep.data.delivered + S.bcRep.data.read}</b> delivered (${S.bcRep.data.read} read) · <b>${S.bcRep.data.failed}</b> failed · <b>${S.bcRep.data.waiting}</b> waiting. ${Object.entries(S.bcRep.data.reasons).map(([k, v]) => esc(k) + ': ' + v).join(' · ')} <button class="linkbtn" data-act="bc-csv" data-v="${esc(l.job)}">Download CSV</button></p>` : '<p class="loading">Loading…</p>'}</td></tr>` : ''}`).join('')}</tbody></table></div>` : '')}`;
  }
});
/* ----- attendees & gate check-in (admin + staff) ----- */
function attendeesView(id, admin) {
  return view('att:' + id, () => api('admin/events/' + id + '/passes'), d => {
    const q = S.gateQ.toLowerCase().replace(/\s/g, '');
    const list = d.list.filter(p => !q || (p.id + p.phone + p.name).toLowerCase().replace(/\s/g, '').includes(q));
    const people = d.list.filter(p => p.status === 'Paid').reduce((a, p) => a + p.items.reduce((x, i) => x + i.qty, 0), 0), inn = d.list.reduce((a, p) => a + (p.checked || 0), 0);
    return `${admin ? '<button class="linkbtn" data-act="ev-attback">← All events</button>' : ''}<div class="row between"><div><h2>${esc(d.event.title)}</h2><p class="muted">${fmtDate(d.event.date)} · ${esc(cityName(d.event.city))} · <b class="num">${inn}</b> of <b class="num">${people}</b> people checked in</p></div>${admin ? `<button class="btn ghost sm" data-act="ev-csv" data-id="${esc(id)}">Download CSV</button>` : ''}</div>
    <div class="field" style="max-width:360px"><label for="gate-q">Find a pass (pass ID, phone or name)</label><input id="gate-q" type="search" value="${esc(S.gateQ)}" autocomplete="off" placeholder="EP-…"></div>
    <div class="tablewrap"><table><thead><tr><th>Pass ID</th><th>Name</th><th>Passes</th><th>Paid</th><th>Entry</th></tr></thead><tbody>${list.map(p => { const n = p.items.reduce((x, i) => x + i.qty, 0);
      return `<tr><td class="num"><b>${esc(p.id)}</b>${p.status !== 'Paid' ? ' ' + pill(p.status) : ''}</td><td>${esc(p.name)}<div class="small"><a href="tel:${esc(p.phone)}">${esc(p.phone)}</a></div></td><td class="small">${p.items.map(i => i.qty + ' × ' + esc(i.name)).join('<br>')}</td><td class="num">${money(p.total)}<div class="small muted">${esc(p.payMode || '')}</div></td>
      <td>${p.status !== 'Paid' ? '—' : (p.checked || 0) >= n ? `<span class="pill ok">In (${p.checked})</span><div class="small muted">${esc(p.inAt || '')}</div>` : `<button class="btn sm" data-act="pass-in" data-id="${esc(p.id)}" data-v="${n}">Check in ${n > 1 ? n + ' people' : ''}</button>${p.checked ? `<div class="small muted">${p.checked} already in</div>` : ''}`}${admin && p.status === 'Paid' ? `<div style="margin-top:6px">${delBtn('pass-cancel', p.id, 'Cancel pass')}</div>` : ''}</td></tr>`; }).join('') || `<tr><td colspan="5" class="muted">${d.list.length ? 'No pass matches.' : 'No passes sold yet.'}</td></tr>`}</tbody></table></div>`;
  });
}
function pageGate() {
  if (role !== 'staff' && role !== 'admin') return pageLogin();
  const evs = B.events || [];
  if (!S.gateEv && evs.length) S.gateEv = (evs.find(e => e.date === TODAY) || evs[0]).id;
  return `<div class="wrap stack" style="padding-block:24px 56px"><div class="row between"><h1>Event check-in</h1>${evs.length > 1 ? `<select data-chg="gate-ev" aria-label="Event" style="max-width:320px">${evs.map(e => `<option value="${esc(e.id)}" ${e.id === S.gateEv ? 'selected' : ''}>${esc(e.title)} · ${fmtDate(e.date)}</option>`).join('')}</select>` : ''}</div>
    ${S.gateEv ? attendeesView(S.gateEv, false) : '<div class="card muted">No upcoming events.</div>'}</div>`;
}
PAGES.gate = pageGate;

const _teamClickEv = teamClick;
teamClick = async function (a, t, id, v) {
  switch (a) {
    case 'ev-open': S.eventId = id; S.evQty = {}; S.lastPass = null; if (S.view !== 'events') go('events'); else { render(); window.scrollTo(0, 0); } return true;
    case 'ev-back': S.eventId = ''; S.lastPass = null; if (location.search.includes('ev=')) history.replaceState(null, '', location.pathname + '#events'); render(); window.scrollTo(0, 0); return true;
    case 'ev-q': { const lim = Number(t.dataset.max) || 50; S.evQty[id] = Math.max(0, Math.min(lim, (Number(S.evQty[id]) || 0) + Number(v))); rerenderKeep(); return true; }
    case 'ev-new': S.evEdit = 'new'; rerenderKeep(); return true;
    case 'ev-cancel': S.evEdit = null; rerenderKeep(); return true;
    case 'ev-edit': { const d = C.aevents && C.aevents.data; S.evEdit = d ? JSON.parse(JSON.stringify(d.events.find(e => e.id === id))) : null; render(); window.scrollTo(0, 0); return true; }
    case 'ev-att': S.evView = id; S.gateQ = ''; rerenderKeep(); return true;
    case 'ev-attback': S.evView = ''; drop('aevents'); rerenderKeep(); return true;
    case 'ev-copy': try { await navigator.clipboard.writeText(v); toast('Link copied: share it on Instagram or WhatsApp'); } catch (err) { toast(v); } return true;
    case 'ev-del': try { await api('admin/events', {method: 'POST', body: {action: 'delete', id}}); drop('aevents'); rerenderKeep(); toast('Event deleted'); } catch (err) { toast(err.message); } return true;
    case 'ef-addpass': { const box = $('#ef-passes'); const i = box.children.length ? Math.max(...[...box.children].map(c => Number(c.dataset.i))) + 1 : 0; box.insertAdjacentHTML('beforeend', passRowEdit({max: 10, qty: 0}, i)); return true; }
    case 'ef-delpass': t.closest('.passedit').remove(); return true;
    case 'ev-csv': try { await dlCsv('admin/events/' + id + '/passes', {format: 'csv'}); } catch (err) { toast(err.message); } return true;
    case 'pass-in': try { await api('admin/passes/' + encodeURIComponent(id), {method: 'POST', body: {action: 'checkin', count: Number(v)}}); Object.keys(C).filter(k => k.startsWith('att:')).forEach(k => delete C[k]); rerenderKeep(); toast(id + ' checked in'); } catch (err) { toast(err.message); } return true;
    case 'pass-cancel': try { await api('admin/passes/' + encodeURIComponent(id), {method: 'POST', body: {action: 'cancel'}}); Object.keys(C).filter(k => k.startsWith('att:')).forEach(k => delete C[k]); drop('aevents'); rerenderKeep(); toast('Pass cancelled. Refund it from Razorpay if needed.'); } catch (err) { toast(err.message); } return true;
    case 'bc-test': { const fd = bcBody(); t.disabled = true; try { await api('admin/broadcast/test', {method: 'POST', body: Object.assign(fd, {phone: $('#bc-test').value})}); toast('Test sent. Check WhatsApp.'); } catch (err) { toast(err.message); } t.disabled = false; return true; }
    case 'bc-rep': S.bcRep = {job: v}; rerenderKeep(); try { S.bcRep.data = await api('admin/broadcast/report', {q: {job: v}}); } catch (err) { toast(err.message); S.bcRep = null; } rerenderKeep(); return true;
    case 'bc-csv': try { await dlCsv('admin/broadcast/report', {job: v, format: 'csv'}); } catch (err) { toast(err.message); } return true;
  }
  return _teamClickEv(a, t, id, v);
};
const bcBody = () => ({kind: S.bc.kind, event: S.bc.event, text: S.bc.text, link: S.bc.link, city: S.bc.city, who: S.bc.who, gap: S.bc.gap});
async function dlCsv(path, q) {
  toast('Preparing your file…');
  const r = await fetch(apiUrl(path, Object.assign(q, {_: Date.now()})), {credentials: 'same-origin', cache: 'no-store', headers: {'X-WP-Nonce': B.nonce}});
  if (!r.ok) { let j = null; try { j = await r.json(); } catch (e) { /* not json */ } throw new Error((j && j.message) || 'The download did not work. Try again.'); }
  const blob = await r.blob(), m = (r.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/);
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = m ? m[1] : 'export.csv'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
const _teamSubmitEv = teamSubmit;
teamSubmit = async function (k, f, fd, send) {
  if (k === 'ev-buy') { await buyPasses(f); return true; }
  if (k === 'ev-save') {
    const passes = [];
    Object.keys(fd).filter(x => x.startsWith('p_name_')).forEach(x => { const i = x.slice(7); passes.push({id: fd['p_id_' + i], name: fd['p_name_' + i], desc: fd['p_desc_' + i], price: fd['p_price_' + i], qty: fd['p_qty_' + i], max: fd['p_max_' + i]}); });
    const body = {id: f.dataset.id, title: fd.title, city: fd.city, date: fd.date, start: fd.start, end: fd.end, venue: fd.venue, address: fd.address, map: fd.map, desc: fd.desc, img: fd.img, status: fd.status, salesEnd: fd.salesEnd, passes};
    const r = await send('admin/events', body, '#ef-err');
    if (r) { S.evEdit = null; drop('aevents'); drop('events'); rerenderKeep(); toast(body.status === 'live' ? 'Saved. The event is on sale on the website.' : 'Event saved'); }
    return true;
  }
  if (k === 'bc-send') {
    const fd2 = bcBody(), err = $('#bc-err');
    try {
      const st = await api('admin/broadcast/start', {method: 'POST', body: fd2});
      S.bcRun = {busy: true, msg: `Sending 0 of ${st.total}… keep this page open.`}; rerenderKeep();
      let off = 0, r;
      do { r = await api('admin/broadcast/batch', {method: 'POST', body: {job: st.job, offset: off}}); off = r.offset; S.bcRun = {busy: !r.done, msg: r.done ? `Done. ${r.sent} sent${r.failed ? `, ${r.failed} failed` : ''}. Open the delivery report below in a few minutes.` : `Sending ${off} of ${r.total}… keep this page open.`}; rerenderKeep(); } while (!r.done);
      drop('bclog'); Object.keys(C).filter(x => x.startsWith('bcprev:')).forEach(x => delete C[x]);
    } catch (e) { S.bcRun = {busy: false, msg: 'Stopped: ' + e.message}; if (err) err.textContent = e.message; }
    rerenderKeep(); return true;
  }
  return _teamSubmitEv(k, f, fd, send);
};
document.addEventListener('change', async e => {
  const t = e.target, k = t.dataset && t.dataset.chg; if (!k) return;
  if (k === 'bc') { const key = t.dataset.k; S.bc[key] = key === 'gap' ? Math.max(0, Number(t.value) || 0) : t.value; if (key === 'kind' && t.value === 'event') S.bc.who = S.bc.who === 'holders' ? 'all' : S.bc.who; if (key !== 'text' && key !== 'link') rerenderKeep(); }
  if (k === 'gate-ev') { S.gateEv = t.value; S.gateQ = ''; rerenderKeep(); }
  if (k === 'ef-upload') {
    const file = t.files && t.files[0]; if (!file) return; toast('Uploading image…');
    try { const fdu = new FormData(); fdu.append('file', file); const r = await fetch(apiUrl('admin/upload'), {method: 'POST', credentials: 'same-origin', headers: {'X-WP-Nonce': B.nonce}, body: fdu}); const j = await r.json(); if (!r.ok) throw new Error(j.message || 'Upload failed'); $('#ef-img').value = j.url; t.insertAdjacentHTML('afterend', `<img src="${esc(j.url)}" alt="" style="max-width:160px;border-radius:10px;margin-top:6px">`); toast('Image added. Save the event to keep it.'); } catch (err) { toast(err.message); }
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'gate-q') { clearTimeout(qTimer); qTimer = setTimeout(() => { S.gateQ = e.target.value.trim(); rerenderKeep(); }, 250); }
  if (e.target.dataset && e.target.dataset.chg === 'bc' && (e.target.dataset.k === 'text' || e.target.dataset.k === 'link')) S.bc[e.target.dataset.k] = e.target.value;
});

/* ---------- complaints (v1.10) ---------- */
S.cmpBooking = ''; S.cmpPhotos = []; S.cmpDone = null; S.cmpF = 'open';
function pageComplaint() {
  if (role !== 'customer') return pageLogin();
  return `<div class="wrap" style="padding-bottom:56px;max-width:860px">${view('mycmp', () => api('me/complaints'), d => {
    const open = d.bookings.filter(b => b.left > 0 && !b.complaintRef);
    if (S.cmpBooking && !open.some(b => b.id === S.cmpBooking)) S.cmpBooking = '';
    return `<div class="pagehead"><p class="eyebrow">Help &amp; complaints</p><h1>Raise a complaint</h1><p class="muted">Not happy with a groom? Tell us within <b>${d.hours} hours</b> of the service and we'll send the groomer back for a <b>free redo</b>. For anything else, choose "Not about a grooming booking". We reply on WhatsApp.</p></div>
    ${S.cmpDone ? `<div class="okbox stack" style="margin-bottom:16px"><p class="eyebrow" style="color:var(--ok)">Complaint registered</p><p>Your complaint ID is <b class="num">${esc(S.cmpDone)}</b>. We've sent it to you on WhatsApp, and our team will call you within 24 hours.</p></div>` : ''}
    <form class="card stack" data-form="cmp-new" novalidate>
      <div class="field"><label for="cm-bk">Which booking is it about?</label><select id="cm-bk" name="booking">${open.map(b => `<option value="${esc(b.id)}" ${S.cmpBooking === b.id ? 'selected' : ''}>${esc(b.id)} · ${esc(b.label)}</option>`).join('')}<option value="" ${!S.cmpBooking && !open.length ? 'selected' : ''}>Not about a grooming booking</option></select>
        ${d.bookings.some(b => b.left <= 0 && !b.complaintRef) ? `<span class="small muted">Older bookings are past the ${d.hours}-hour window. Please call us about those.</span>` : ''}</div>
      <div class="field"><label for="cm-cat">What went wrong?</label><select id="cm-cat" name="category">${d.cats.map(c => `<option>${esc(c)}</option>`).join('')}</select></div>
      <div class="field"><label for="cm-text">Tell us more <span class="req">*</span></label><textarea id="cm-text" name="text" rows="5" maxlength="1500" placeholder="What happened, and what would make it right?"></textarea></div>
      <div class="field"><label for="cm-ph">Photos (optional, up to 3)</label><input id="cm-ph" type="file" accept="image/*" multiple data-chg="cmp-photo">
        <div class="row" id="cm-thumbs" style="gap:8px;margin-top:6px">${S.cmpPhotos.map((u, i) => `<span class="thumb"><img src="${esc(u)}" alt="Photo ${i + 1}"><button type="button" data-act="cmp-delph" data-v="${i}" aria-label="Remove photo">×</button></span>`).join('')}</div></div>
      <div class="err" id="cm-err" role="alert"></div>
      <div><button class="btn" type="submit">Submit complaint</button></div></form>
    ${d.complaints.length ? `<h2 style="margin-top:28px">My complaints</h2><div class="stack">${d.complaints.map(c => `<div class="card stack" style="gap:6px"><div class="row between"><b class="num">${esc(c.id)}</b>${pill(c.status === 'Open' ? 'Open' : 'Resolved')}</div>
      <div class="small muted">${esc(c.created)}${c.booking ? ' · ' + esc(c.booking) + ' · ' + esc(c.bkLabel) : ''}</div><div><b>${esc(c.category)}</b> – ${esc(c.text)}</div>
      ${c.status === 'Resolved' ? `<div class="note small"><b>Resolution:</b> ${esc(c.resolution)}<div class="muted">${esc(c.resolvedAt || '')}</div></div>` : '<div class="small muted">Our team will contact you soon.</div>'}</div>`).join('')}</div>` : ''}`;
  })}</div>`;
}
PAGES.complaint = pageComplaint;

function complaintsView() {
  const key = 'desk:cmp:' + S.cmpF;
  return `<div class="row between"><h2>Complaints</h2></div>
    <div class="filters" style="margin-top:4px">${[['open', 'Open'], ['resolved', 'Resolved'], ['all', 'All']].map(([k, l]) => `<button class="${S.cmpF === k ? 'on' : ''}" data-act="cmp-f" data-v="${k}">${l}</button>`).join('')}</div>
    ${view(key, () => api('desk/complaints', {q: {status: S.cmpF}}), d => `<p class="small muted">${d.open} open complaint${d.open === 1 ? '' : 's'}. Customers get a WhatsApp message when you resolve one.</p>
      <div class="stack">${d.list.map(c => { const b = d.bookings.find(x => x.id === c.booking);
        return `<div class="card stack" style="gap:8px"><div class="row between"><div><b class="num">${esc(c.id)}</b> ${pill(c.status === 'Open' ? 'Open' : 'Resolved')} <span class="small muted">${esc(c.created)}</span></div><div class="small">${esc(cityName(c.city))}</div></div>
        <div><b>${esc(c.name)}</b> · <a href="tel:${esc(c.phone)}">${esc(c.phone)}</a> · <a href="https://wa.me/91${esc(c.phone)}" target="_blank" rel="noopener">WhatsApp</a></div>
        ${c.booking ? `<div class="small">Booking <button class="linkbtn" data-act="bk-view" data-id="${esc(c.booking)}">${esc(c.booking)}</button> · ${esc(c.bkLabel)}${c.groomer ? ' · added by ' + esc(c.groomer) : ''}${b && b.redoRef ? ` · <span class="pill ok">Redo ${esc(b.redoRef)}</span>` : ''}</div>` : '<div class="small muted">Not about a booking</div>'}
        <div><b>${esc(c.category)}</b><p style="margin-top:4px;white-space:pre-wrap">${esc(c.text)}</p></div>
        ${(c.photos || []).length ? `<div class="row" style="gap:8px">${c.photos.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener" class="thumb"><img src="${esc(u)}" alt="Complaint photo"></a>`).join('')}</div>` : ''}
        ${(c.notes || []).length ? `<div class="small">${c.notes.map(n => `<div class="muted">${esc(n.at)} · ${esc(n.by)}: <span style="color:var(--ink)">${esc(n.text)}</span></div>`).join('')}</div>` : ''}
        ${c.status === 'Resolved' ? `<div class="note small"><b>Resolution:</b> ${esc(c.resolution)}<div class="muted">${esc(c.resolvedBy || '')} · ${esc(c.resolvedAt || '')}</div></div>` : ''}
        <div class="row" style="gap:8px;flex-wrap:wrap">${c.status === 'Open' ? `<button class="btn sm" data-act="cmp-resolve" data-id="${esc(c.id)}">Resolve &amp; close</button>${b && b.redoLeft > 0 && !b.redoRef ? `<button class="btn ghost sm" data-act="desk-redo" data-id="${esc(b.id)}">Book free redo</button>` : ''}<button class="btn ghost sm" data-act="cmp-note" data-id="${esc(c.id)}">Add note</button>` : `<button class="btn ghost sm" data-act="cmp-reopen" data-id="${esc(c.id)}">Reopen</button>`}</div></div>`; }).join('') || `<div class="card muted">${S.cmpF === 'open' ? 'No open complaints. 🎉' : 'No complaints here.'}</div>`}</div>`)}`;
}
ADMIN.complaints = complaintsView;
PAGES.complaints = () => (role === 'staff' || role === 'admin') ? `<div class="wrap stack" style="padding-block:24px 56px">${complaintsView()}</div>` : pageLogin();
function cmpModal(id, kind) {
  openModal(`<form class="stack" data-form="cmp-act" data-id="${esc(id)}" data-kind="${kind}" novalidate><div class="row between"><h3>${kind === 'resolve' ? 'Resolve complaint ' + esc(id) : 'Add a note'}</h3><button type="button" class="x" data-act="close" aria-label="Close">×</button></div>
    ${kind === 'resolve' ? '<p class="muted">Write what was done. The customer gets this on WhatsApp, so keep it clear and polite.</p>' : '<p class="muted">Notes are only seen by staff and admin.</p>'}
    <div class="field"><label for="ca-t">${kind === 'resolve' ? 'Resolution' : 'Note'} <span class="req">*</span></label><textarea id="ca-t" name="text" rows="4" maxlength="500" placeholder="${kind === 'resolve' ? 'e.g. Free redo done on 20 Oct by Ravi. Nails trimmed and coat finished properly.' : 'e.g. Called customer, groomer will visit tomorrow'}"></textarea></div>
    <div class="err" id="m-err" role="alert"></div><div class="row"><button class="btn" type="submit">${kind === 'resolve' ? 'Resolve &amp; notify customer' : 'Save note'}</button><button type="button" class="btn ghost" data-act="close">Cancel</button></div></form>`);
}
const _teamClickCmp = teamClick;
teamClick = async function (a, t, id, v) {
  switch (a) {
    case 'cmp-for': S.cmpBooking = id; S.cmpDone = null; go('complaint'); return true;
    case 'cmp-delph': S.cmpPhotos.splice(Number(v), 1); rerenderKeep(); return true;
    case 'cmp-f': S.cmpF = v; rerenderKeep(); return true;
    case 'cmp-resolve': cmpModal(id, 'resolve'); return true;
    case 'cmp-note': cmpModal(id, 'note'); return true;
    case 'cmp-reopen': try { await api('desk/complaints/' + encodeURIComponent(id), {method: 'POST', body: {action: 'reopen'}}); drop('desk'); rerenderKeep(); toast('Complaint reopened'); } catch (err) { toast(err.message); } return true;
  }
  return _teamClickCmp(a, t, id, v);
};
const _teamSubmitCmp = teamSubmit;
teamSubmit = async function (k, f, fd, send) {
  if (k === 'cmp-new') {
    if (String(fd.text || '').trim().length < 10) { $('#cm-err').textContent = 'Tell us what went wrong (at least a sentence).'; return true; }
    const r = await send('complaints', Object.assign(fd, {photos: S.cmpPhotos}), '#cm-err');
    if (r) { S.cmpDone = r.complaint.id; S.cmpPhotos = []; S.cmpBooking = ''; drop('mycmp'); drop('me'); render(); window.scrollTo(0, 0); }
    return true;
  }
  if (k === 'cmp-act') {
    const kind = f.dataset.kind, body = kind === 'resolve' ? {action: 'resolve', resolution: fd.text} : {action: 'note', note: fd.text};
    const r = await send('desk/complaints/' + encodeURIComponent(f.dataset.id), body, '#m-err');
    if (r) { closeLayer(); drop('desk'); rerenderKeep(); toast(kind === 'resolve' ? 'Resolved. Customer notified on WhatsApp.' : 'Note saved'); }
    return true;
  }
  return _teamSubmitCmp(k, f, fd, send);
};
document.addEventListener('change', async e => {
  const t = e.target; if (!t.dataset || t.dataset.chg !== 'cmp-photo') return;
  const files = [...(t.files || [])].slice(0, Math.max(0, 3 - S.cmpPhotos.length));
  if (!files.length) { toast('You can add up to 3 photos.'); return; }
  for (const file of files) {
    toast('Uploading photo…');
    try { const fdu = new FormData(); fdu.append('file', file); const r = await fetch(apiUrl('complaints/upload'), {method: 'POST', credentials: 'same-origin', headers: {'X-WP-Nonce': B.nonce}, body: fdu}); const j = await r.json(); if (!r.ok) throw new Error(j.message || 'Upload failed'); S.cmpPhotos.push(j.url); }
    catch (err) { toast(err.message); }
  }
  const box = $('#cm-thumbs'); if (box) box.innerHTML = S.cmpPhotos.map((u, i) => `<span class="thumb"><img src="${esc(u)}" alt="Photo ${i + 1}"><button type="button" data-act="cmp-delph" data-v="${i}" aria-label="Remove photo">×</button></span>`).join('');
  t.value = '';
});

/* ---------- WhatsApp templates: submit to Meta, auto-switch when approved (v1.10) ---------- */
const TPLST = {APPROVED: ['Approved', 'ok'], PENDING: ['Waiting for Meta', 'warn'], IN_APPEAL: ['In appeal', 'warn'], REJECTED: ['Rejected', 'bad'], PAUSED: ['Paused', 'bad'], DISABLED: ['Disabled', 'bad'], NOT_SUBMITTED: ['Not submitted', 'neu']};
const _settingsTpl = ADMIN.settings;
ADMIN.settings = () => _settingsTpl() + `<div class="card stack" id="wa-tpl"><h3>WhatsApp templates for new messages</h3><p class="small muted">Submit these templates to Meta with one click. Each message switches to its new template automatically once Meta approves it (usually within a few hours). Until then the current template keeps working.</p>
  <div class="row" style="align-items:end"><div class="field"><label for="tpl-waba">WhatsApp Business Account ID (owns your sending number)</label><input id="tpl-waba" type="text" inputmode="numeric" placeholder="e.g. 1589142088782765" style="max-width:240px"></div><button class="btn ghost sm" data-act="tpl-waba">Save</button></div>
  ${view('watpl', () => api('admin/wa/templates'), d => `<div class="tablewrap"><table><thead><tr><th>Message</th><th>Template</th><th>Status</th><th>In use</th></tr></thead><tbody>${Object.entries(d.templates).map(([k, t]) => { const st = TPLST[t.status] || [t.status, 'neu']; return `<tr><td>${esc(((B.waEvents || {})[k] || {}).label || k)}</td><td class="num">${esc(t.name)}<div class="small muted">${esc(t.category)}</div></td><td><span class="pill ${st[1]}">${esc(st[0])}</span>${t.reason && t.reason !== 'NONE' ? `<div class="small" style="color:var(--bad)">${esc(t.reason)}</div>` : ''}</td><td>${t.inUse ? '<span class="pill ok">Yes</span>' : '<span class="small muted">Not yet</span>'}</td></tr>`; }).join('')}</tbody></table></div>
  ${Object.values(d.templates).some(t => t.status === 'NOT_SUBMITTED' || t.status === 'REJECTED') ? '<div><button class="btn sm" data-act="tpl-submit">Submit to Meta for approval</button></div>' : ''}
  <div class="row" style="align-items:end"><div class="field"><label for="tpl-ph">Send all three as a test to</label><input id="tpl-ph" type="tel" placeholder="10-digit mobile" style="max-width:180px"></div><button class="btn ghost sm" data-act="tpl-test">Send test</button></div>`)}</div>`;
const _teamClickTpl = teamClick;
teamClick = async function (a, t, id, v) {
  if (a === 'tpl-waba') { try { await api('admin/wa/templates', {q: {waba: $('#tpl-waba').value.trim()}}); drop('watpl'); rerenderKeep(); toast('Saved'); } catch (err) { toast(err.message); } return true; }
  if (a === 'tpl-test') {
    t.disabled = true;
    try { const r = await api('admin/wa/templates/test', {method: 'POST', body: {phone: $('#tpl-ph').value}}); toast(Object.values(r.result).join(' · ')); } catch (err) { toast(err.message); }
    t.disabled = false; return true;
  }
  if (a === 'tpl-submit') {
    t.disabled = true; t.textContent = 'Submitting…';
    try { const r = await api('admin/wa/templates', {method: 'POST', body: {}}); drop('watpl'); rerenderKeep(); toast(Object.values(r.result).join(' · ')); } catch (err) { toast(err.message); t.disabled = false; t.textContent = 'Submit to Meta for approval'; }
    return true;
  }
  return _teamClickTpl(a, t, id, v);
};

/* ---------- loyal customers: top 50 repeat grooming customers + rewards (v1.12) ---------- */
S.loyal = {min: 2};
function loyalCard() {
  const scoped = role === 'staff' && B.user.city !== 'all';
  const city = scoped ? B.user.city : S.st.city;
  return `<section class="card stack" id="loyal"><div class="row between"><div><h3>Top 50 loyal customers</h3><p class="small muted">Customers who booked grooming ${S.loyal.min} or more times (all time${city !== 'all' ? ', ' + esc(cityName(city)) : ''}). Most grooms first, then highest spend. Redo visits and cancelled bookings are not counted.</p></div>
    <div class="field"><label for="ly-min">At least</label><select id="ly-min" data-chg="ly-min">${[2, 3, 4, 5, 10].map(n => `<option value="${n}" ${S.loyal.min === n ? 'selected' : ''}>${n} grooms</option>`).join('')}</select></div></div>
    ${view(`loyal:${city}:${S.loyal.min}`, () => api('loyal', {q: {city, min: S.loyal.min}}), d => { S.loyalList = d.list; return d.list.length ? `<p class="small muted">${d.total > 50 ? `Showing the top 50 of ${d.total} repeat customers.` : `${d.total} repeat customer${d.total === 1 ? '' : 's'}.`}</p>
    <div class="tablewrap"><table><thead><tr><th class="r">#</th><th>Customer</th><th>City</th><th class="r">Grooms</th><th class="r">Spent</th><th>Last groom</th><th class="r">Points</th><th>Last reward</th><th></th></tr></thead><tbody>${d.list.map(r => `<tr><td class="r num">${r.rank}</td><td><b>${esc(r.name || '—')}</b><div class="small muted num"><a href="tel:${esc(r.phone)}">${esc(r.phone)}</a>${r.pets.length ? ' · ' + esc(r.pets.join(', ')) : ''}</div></td><td>${esc(r.cityName)}</td><td class="r num"><b>${r.count}</b></td><td class="r num">${money(r.spent)}</td><td class="small">${fmtDate(r.last)}<div class="muted">since ${fmtDate(r.first)}</div></td><td class="r num">${r.points}</td><td class="small">${r.reward ? `${esc(r.reward.what)}<div class="muted">${esc(r.reward.at)} · ${esc(r.reward.by)}${r.reward.count > 1 ? ` · ${r.reward.count} rewards` : ''}</div>` : '<span class="muted">None yet</span>'}</td><td><button class="btn sm" data-act="ly-reward" data-id="${esc(r.phone)}">Reward</button></td></tr>`).join('')}</tbody></table></div>` : `<p class="muted">No customer has booked grooming ${S.loyal.min} or more times yet.</p>`; })}</section>`;
}
function loyalModal(r) {
  const pv = Number((B.config && B.config.rewards && B.config.rewards.pointValue) || 1);
  openModal(`<form class="stack" data-form="ly-reward" data-id="${esc(r.phone)}" novalidate><div class="row between"><h3>Reward ${esc(r.name || r.phone)}</h3><button type="button" class="x" data-act="close" aria-label="Close">×</button></div>
    <p class="muted">${r.count} grooms · ${money(r.spent)} spent · ${r.points} points now</p>
    <div class="field"><label for="ly-pts">Bonus reward points</label><div class="row">${[100, 200, 500].map(n => `<button type="button" class="btn ghost sm" data-act="ly-pts" data-v="${n}">${n}</button>`).join('')}</div><input id="ly-pts" name="points" type="number" min="0" max="5000" step="1" inputmode="numeric" placeholder="0" style="max-width:160px"><span class="small muted">1 point = ${money(pv)} off a future booking or order.</span></div>
    <div class="field"><label for="ly-gift">Gift or offer (optional)</label><input id="ly-gift" name="gift" type="text" maxlength="200" placeholder="e.g. Free nail trim on next groom, 20% off next Full Groom"></div>
    <label class="small"><input type="checkbox" name="notify" checked> Send a thank-you message on WhatsApp</label>
    <div class="err" id="m-err" role="alert"></div><div class="row"><button class="btn" type="submit">Give reward</button><button type="button" class="btn ghost" data-act="close">Cancel</button></div></form>`);
}
const _salesDashLoyal = salesDash;
salesDash = function () { return _salesDashLoyal() + loyalCard(); };
const _teamClickLoyal = teamClick;
teamClick = async function (a, t, id, v) {
  if (a === 'ly-reward') { const r = (S.loyalList || []).find(x => x.phone === id); if (r) loyalModal(r); return true; }
  if (a === 'ly-pts') { $('#ly-pts').value = v; return true; }
  return _teamClickLoyal(a, t, id, v);
};
const _teamChangeLoyal = teamChange;
teamChange = async function (k, t, id) {
  if (k === 'ly-min') { S.loyal.min = Number(t.value) || 2; rerenderKeep(); return true; }
  return _teamChangeLoyal(k, t, id);
};
const _teamSubmitLoyal = teamSubmit;
teamSubmit = async function (k, f, fd, send) {
  if (k === 'ly-reward') {
    const pts = Number(fd.points || 0);
    if (!pts && !String(fd.gift || '').trim()) { $('#m-err').textContent = 'Enter bonus points or write the gift / offer.'; return true; }
    const r = await send('loyal/reward', {phone: f.dataset.id, points: pts, gift: fd.gift || '', notify: !!fd.notify}, '#m-err');
    if (r) { closeLayer(); drop('loyal'); rerenderKeep(); toast(`Rewarded: ${r.what}${r.sent ? ' · WhatsApp sent' : ''}`); }
    return true;
  }
  return _teamSubmitLoyal(k, f, fd, send);
};

/* ---------- WhatsApp broadcast with any approved template + field picker (v1.13) ---------- */
S.bt = {tpl: '', lang: '', map: {}, city: 'all', who: 'all', days: 30, min: 2, event: '', gap: 3};
const btQ = () => ({city: S.bt.city, who: S.bt.who, days: S.bt.days, min: S.bt.min, event: S.bt.event, gap: S.bt.gap});
const btBody = () => Object.assign({kind: 'tpl', tpl: S.bt.tpl, lang: S.bt.lang, map: S.bt.map}, btQ());
const hlVars = t => esc(t || '').replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, '<mark class="tvar">{{$1}}</mark>').replace(/\n/g, '<br>');
function btSlotRow(sl, fields) {
  const m = S.bt.map[sl.key] || (S.bt.map[sl.key] = {field: sl.where === 'media' ? 'custom' : sl.guess, text: ''});
  const opts = sl.where === 'media' ? '' : `<select data-chg="bt-f" data-k="${esc(sl.key)}" aria-label="What goes in ${esc(sl.label)}">${Object.entries(fields).map(([k, l]) => `<option value="${k}" ${m.field === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const showText = sl.where === 'media' || m.field === 'custom';
  return `<div class="slotrow"><div><b>${esc(sl.label)}</b>${sl.example ? `<div class="small muted">Example you gave Meta: ${esc(sl.example.length > 80 ? sl.example.slice(0, 80) + '…' : sl.example)}</div>` : ''}</div>
    <div class="stack" style="gap:6px">${opts}${showText ? `<input type="${sl.where === 'media' ? 'url' : 'text'}" data-chg="bt-t" data-k="${esc(sl.key)}" value="${esc(m.text)}" maxlength="${sl.key.startsWith('code:') ? 15 : 900}" placeholder="${sl.where === 'media' ? 'https://wagandtails.in/wp-content/uploads/…jpg' : sl.key.startsWith('url:') ? 'e.g. book' : sl.key.startsWith('code:') ? 'e.g. GROOM15' : 'Type the text'}">` : ''}</div></div>`;
}
ADMIN.broadcast = () => {
  const b = S.bt, cs = db.cities.filter(c => c.service);
  return `<h2>WhatsApp broadcast</h2><p class="muted">Pick any template Meta has approved for your WhatsApp account, choose what goes into each blank ({{1}}, {{2}} …) and send it to the customers you choose. Each customer gets their own name, pet, breed and so on.</p>
  ${view('btpl', () => api('admin/wa/approved'), d => {
    const tpls = d.templates, fields = d.fields;
    if (!tpls.length) return `<div class="card stack"><p><b>No approved templates found.</b> Create a template in WhatsApp Manager, wait for Meta to approve it, then click Refresh.</p><div><button class="btn ghost sm" data-act="bt-refresh">Refresh list</button></div></div>`;
    let t = tpls.find(x => x.name === b.tpl && x.lang === b.lang);
    if (!t) { t = tpls.find(x => x.name !== 'login_code') || tpls[0]; b.tpl = t.name; b.lang = t.lang; b.map = {}; }
    const needEvent = t.slots.some(sl => (b.map[sl.key] || {field: sl.guess}).field.startsWith('event')) || ['holders', 'nonholders'].includes(b.who);
    return `<form class="stack" data-form="bt-send" novalidate>
    <section class="card stack"><div class="row between"><h3>1. Template</h3><button type="button" class="btn ghost sm" data-act="bt-refresh">Refresh list</button></div>
      <div class="field"><label for="bt-tpl">Approved template</label><select id="bt-tpl" data-chg="bt-tpl">${tpls.map(x => `<option value="${esc(x.name + '|' + x.lang)}" ${x.name === t.name && x.lang === t.lang ? 'selected' : ''}>${esc(x.name)} · ${esc(x.category)} · ${esc(x.lang)}</option>`).join('')}</select>
        <span class="small muted">${tpls.length} approved. New templates show here once Meta approves them (click Refresh).</span></div>
      <div class="tplbox">${t.preview.header ? `<b>${hlVars(t.preview.header)}</b><br>` : ''}${hlVars(t.preview.body)}${t.preview.footer ? `<div class="small muted">${esc(t.preview.footer)}</div>` : ''}${t.preview.buttons.length ? `<div class="row" style="gap:6px;margin-top:8px">${t.preview.buttons.map(x => `<span class="pill neu">${esc(x)}</span>`).join('')}</div>` : ''}</div>
      ${t.category === 'Marketing' ? '<p class="small muted">Marketing template: Meta limits how many marketing messages each person gets, so some may fail with "Meta limit on marketing messages". That is normal.</p>' : ''}</section>
    <section class="card stack"><h3>2. What goes in each blank</h3>
      ${t.slots.length ? t.slots.map(sl => btSlotRow(sl, fields)).join('') : '<p class="muted">This template has no blanks. Everyone gets the same text.</p>'}</section>
    <section class="card stack"><h3>3. Who gets it</h3><div class="f3">
      <div class="field"><label for="bt-city">City</label><select id="bt-city" data-chg="bt" data-k="city"><option value="all">All cities</option>${cs.map(c => `<option value="${esc(c.id)}" ${c.id === b.city ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="bt-who">Customers</label><select id="bt-who" data-chg="bt" data-k="who">${[['all', 'All customers'], ['due', 'Due for grooming (nothing booked)'], ['loyal', 'Repeat customers'], ['never', 'Never booked grooming (shop customers, leads)'], ['nonholders', 'No pass for an event'], ['holders', 'Have a pass for an event']].map(([k, l]) => `<option value="${k}" ${b.who === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      ${b.who === 'due' ? `<div class="field"><label for="bt-days">Last groom at least (days ago)</label><input id="bt-days" type="number" min="1" max="365" value="${esc(b.days)}" data-chg="bt" data-k="days"></div>` : ''}
      ${b.who === 'loyal' ? `<div class="field"><label for="bt-min">Booked at least (grooms)</label><input id="bt-min" type="number" min="2" max="50" value="${esc(b.min)}" data-chg="bt" data-k="min"></div>` : ''}
      ${needEvent ? view('aevents', () => api('admin/events'), ed => { const evs = ed.events.filter(e => e.status !== 'draft'); if (!b.event && evs.length) b.event = evs[0].id; return `<div class="field"><label for="bt-ev">Event</label><select id="bt-ev" data-chg="bt" data-k="event">${evs.map(e => `<option value="${esc(e.id)}" ${e.id === b.event ? 'selected' : ''}>${esc(e.title)} · ${fmtDate(e.date)}</option>`).join('') || '<option value="">No events</option>'}</select></div>`; }) : ''}
      <div class="field"><label for="bt-gap">Skip if messaged in the last (days)</label><input id="bt-gap" type="number" min="0" max="30" value="${esc(b.gap)}" data-chg="bt" data-k="gap"></div></div>
      ${view('bcprev:' + JSON.stringify(btQ()), () => api('admin/broadcast', {q: btQ()}), p => `<p class="note"><b class="num">${p.count}</b> customer${p.count === 1 ? '' : 's'} will get this message${p.sample.length ? ' (e.g. ' + p.sample.filter(Boolean).map(esc).join(', ') + ')' : ''}.</p>`)}</section>
    <section class="card stack"><h3>4. Check and send</h3>
      ${view('btprev:' + JSON.stringify(btBody()), () => api('admin/broadcast/render', {method: 'POST', body: btBody()}), r => `<p class="small muted">How it looks for ${esc(r.for)}:</p><div class="tplbox wa">${esc(r.text).replace(/\n/g, '<br>')}${r.buttons.length ? `<div class="row" style="gap:6px;margin-top:8px">${r.buttons.map(x => `<span class="pill neu">${esc(x)}</span>`).join('')}</div>` : ''}</div>`)}
      <div class="row" style="align-items:end"><div class="field"><label for="bt-test">Send a test to</label><input id="bt-test" type="tel" placeholder="10-digit mobile" style="max-width:180px"></div><button type="button" class="btn ghost" data-act="bt-test">Send test</button><span style="flex:1"></span><button class="btn" type="submit" ${S.bcRun && S.bcRun.busy ? 'disabled' : ''}>Send to everyone</button></div>
      ${S.bcRun ? `<p class="note" role="status">${esc(S.bcRun.msg)}</p>` : ''}<div class="err" id="bc-err" role="alert"></div></section></form>`;
  })}
  ${view('bclog', () => api('admin/broadcast', {q: {city: 'none', who: 'all'}}), p => p.log.length ? `<h3>Past broadcasts</h3><div class="tablewrap"><table><thead><tr><th>When</th><th>Message</th><th>City</th><th>Sent</th><th>Failed</th><th></th></tr></thead><tbody>${p.log.map(l => `<tr><td class="small">${esc(l.at)}<div class="muted">${esc(l.by)}</div></td><td>${esc(l.title)}</td><td>${esc(cityName(l.city))}</td><td class="num">${l.sent}</td><td class="num">${l.failed}</td><td><button class="btn ghost sm" data-act="bc-rep" data-v="${esc(l.job)}">Delivery report</button></td></tr>${S.bcRep && S.bcRep.job === l.job ? `<tr><td colspan="6">${S.bcRep.data ? `<p class="small"><b>${S.bcRep.data.delivered + S.bcRep.data.read}</b> delivered (${S.bcRep.data.read} read) · <b>${S.bcRep.data.failed}</b> failed · <b>${S.bcRep.data.waiting}</b> waiting. ${Object.entries(S.bcRep.data.reasons).map(([k, v]) => esc(k) + ': ' + v).join(' · ')} <button class="linkbtn" data-act="bc-csv" data-v="${esc(l.job)}">Download CSV</button></p>` : '<p class="loading">Loading…</p>'}</td></tr>` : ''}`).join('')}</tbody></table></div>` : '')}`;
};
const btDropPrev = () => Object.keys(C).filter(x => x.startsWith('btprev:') || x.startsWith('bcprev:')).forEach(x => delete C[x]);
document.addEventListener('change', e => {
  const t = e.target, k = t.dataset && t.dataset.chg; if (!k || !k.startsWith('bt')) return;
  if (k === 'bt-tpl') { const [n, l] = t.value.split('|'); S.bt.tpl = n; S.bt.lang = l; S.bt.map = {}; }
  else if (k === 'bt-f') { const m = S.bt.map[t.dataset.k] || (S.bt.map[t.dataset.k] = {text: ''}); m.field = t.value; }
  else if (k === 'bt-t') { const m = S.bt.map[t.dataset.k] || (S.bt.map[t.dataset.k] = {field: 'custom'}); m.text = t.value; }
  else if (k === 'bt') { const key = t.dataset.k; S.bt[key] = ['days', 'min', 'gap'].includes(key) ? Math.max(0, Number(t.value) || 0) : t.value; }
  rerenderKeep();
});
document.addEventListener('input', e => { const t = e.target; if (t.dataset && t.dataset.chg === 'bt-t') { const m = S.bt.map[t.dataset.k] || (S.bt.map[t.dataset.k] = {field: 'custom'}); m.text = t.value; } });
const _teamClickBt = teamClick;
teamClick = async function (a, t, id, v) {
  if (a === 'bt-refresh') { t.disabled = true; try { await api('admin/wa/approved', {q: {fresh: 1}}); toast('Template list updated'); } catch (err) { toast(err.message); } drop('btpl'); rerenderKeep(); return true; }
  if (a === 'bt-test') {
    t.disabled = true;
    try { const r = await api('admin/broadcast/test', {method: 'POST', body: Object.assign(btBody(), {phone: $('#bt-test').value})}); toast('Test sent: ' + r.result + '. Check WhatsApp.'); } catch (err) { toast(err.message); }
    t.disabled = false; return true;
  }
  return _teamClickBt(a, t, id, v);
};
const _teamSubmitBt = teamSubmit;
teamSubmit = async function (k, f, fd, send) {
  if (k !== 'bt-send') return _teamSubmitBt(k, f, fd, send);
  const err = $('#bc-err'); if (err) err.textContent = '';
  try {
    const st = await api('admin/broadcast/start', {method: 'POST', body: btBody()});
    S.bcRun = {busy: true, msg: `Sending 0 of ${st.total}… keep this page open.`}; rerenderKeep();
    let off = 0, r;
    do { r = await api('admin/broadcast/batch', {method: 'POST', body: {job: st.job, offset: off}}); off = r.offset; S.bcRun = {busy: !r.done, msg: r.done ? `Done. ${r.sent} sent${r.failed ? `, ${r.failed} failed` : ''}. Open the delivery report below in a few minutes.` : `Sending ${off} of ${r.total}… keep this page open.`}; rerenderKeep(); } while (!r.done);
    drop('bclog'); btDropPrev();
  } catch (e) { S.bcRun = {busy: false, msg: 'Stopped: ' + e.message}; const er = $('#bc-err'); if (er) er.textContent = e.message; }
  rerenderKeep(); return true;
};


/* ---------- apps and partners: groomer on the desk card, assign / change groomer, live map (includes/apps.php) ---------- */
const APPS_ON = !!(B.apps && B.apps.on);
const JOB_TEXT = {searching: 'Finding groomer', offered: 'Waiting for chosen groomer', assigned: 'assigned', on_the_way: 'on the way', arrived: 'arrived', in_progress: 'grooming now', needs_staff: 'No groomer yet', released: 'Released', completed: 'completed', cancelled: 'cancelled'};
function appsJob(b) {
  if (!APPS_ON) return '';
  const open = OPEN.includes(b.status), j = b.job || null;
  if (!j && !open) return '';
  const st = j ? j.status : 'searching', p = j && j.partner;
  const red = st === 'needs_staff' || (j && j.flag);
  const tone = red ? 'bad' : ['assigned', 'on_the_way', 'arrived', 'in_progress', 'completed'].includes(st) ? 'ok' : 'warn';
  let label = p && p.name ? `${p.name} · ${JOB_TEXT[st] || st}` : (JOB_TEXT[st] || 'Finding groomer');
  if (st === 'on_the_way' && j.etaMins != null) label += ` · ETA ${j.etaMins} min`;
  return `<div class="row" style="gap:8px;flex-wrap:wrap;margin-top:6px"><span class="pill ${tone}">${esc(label)}</span>
    ${p && p.phone ? `<a class="small num" href="tel:${esc(p.phone)}">${esc(p.phone)}</a>` : ''}${p && p.type ? `<span class="small muted">${p.type === 'team' ? 'My team' : 'Freelancer'}</span>` : ''}
    ${j && j.flag && j.flag !== label ? `<span class="small" style="color:var(--bad);font-weight:700">${esc(j.flag)}</span>` : ''}
    ${j && j.trackUrl && ['on_the_way', 'arrived'].includes(st) ? `<a class="small" href="${esc(j.trackUrl)}" target="_blank" rel="noopener">Live tracking</a>` : ''}
    ${j && j.at ? `<span class="small muted">${esc(j.at)}</span>` : ''}</div>`;
}
function appsBtn(b) {
  if (!APPS_ON || !OPEN.includes(b.status)) return '';
  const j = b.job || {}, st = j.status || 'searching';
  if (['on_the_way', 'arrived', 'in_progress'].includes(st)) return '';
  return `<button class="btn ${st === 'needs_staff' ? '' : 'ghost'} sm" data-act="apps-assign" data-id="${esc(b.id)}">${j.partner ? 'Change groomer' : 'Assign groomer'}</button>`;
}
async function appsAssignModal(ref) {
  openModal(`<div class="row between"><h3>Groomer for ${esc(ref)}</h3><button class="x" data-act="close" aria-label="Close">×</button></div><div id="apps-list" class="stack"><p class="muted">Loading groomers…</p></div>`);
  try {
    const d = await api('desk/apps/partners', {q: {ref}});
    const el = $('#apps-list'); if (!el) return;
    const rows = d.partners.map(p => `<div class="row between" style="border-bottom:1px solid var(--line);padding-block:8px;gap:12px">
      <div><b>${esc(p.name)}</b>${p.current ? ' <span class="pill ok">Current</span>' : ''} <span class="small muted">${p.type === 'team' ? 'My team' : 'Freelancer'}</span>
        <div class="small muted">${p.online ? '🟢 Online' : '⚪ Offline'} · ★ ${Number(p.rating).toFixed(1)} · ${p.jobs} jobs${p.distanceKm != null ? ` · ${p.distanceKm} km away` : ''}${p.releases ? ` · ${p.releases} released` : ''}</div>
        ${p.busyWith.length ? `<div class="small" style="color:var(--warn)">Busy around this time: ${p.busyWith.map(esc).join(', ')}</div>` : ''}${p.blocked ? `<div class="small" style="color:var(--bad)">Paused: commission dues over the limit</div>` : ''}</div>
      <div>${p.current ? `<button class="btn ghost sm" data-act="apps-unassign" data-id="${esc(ref)}">Remove</button>` : `<button class="btn sm" data-act="apps-pick" data-id="${esc(ref)}" data-v="${esc(p.id)}" ${p.blocked ? 'disabled' : ''}>Assign</button>`}</div></div>`).join('');
    el.innerHTML = rows || `<p class="muted">No approved groomers in ${esc(d.city || 'this city')} take this job. Add or approve partners in Apps &amp; partners.</p>`;
    el.insertAdjacentHTML('beforeend', '<p class="small muted">The groomer gets "Job assigned to you" in the partner app. The customer gets the groomer details on WhatsApp.</p>');
  } catch (e) { const el = $('#apps-list'); if (el) el.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}
async function appsAfterChange(ref, msg) {
  closeLayer(); toast(msg);
  try { drop('desk'); await liveRefresh(true); } catch (e) { /* the live refresh picks it up */ }
  rerenderKeep();
}
let appsMap = null, appsLayer = null, appsTimer = null;
function appsMapDraw(d) {
  const el = $('#apps-map'); if (!el || !window.L) return;
  if (!appsMap || appsMap.getContainer() !== el) {
    appsMap = L.map(el); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19, attribution: '&copy; OpenStreetMap'}).addTo(appsMap);
    appsLayer = L.layerGroup().addTo(appsMap);
  }
  appsLayer.clearLayers();
  const pts = [];
  (d.jobs || []).forEach(j => {
    if (j.lat && j.lng) { pts.push([j.lat, j.lng]); L.circleMarker([j.lat, j.lng], {radius: 7, color: j.flag || j.status === 'needs_partner' ? '#C2553A' : '#4B1D00', fillOpacity: .8}).bindPopup(`<b>${esc(j.ref || 'App job')}</b><br>${esc(j.pet)}<br>${esc(j.status.replace(/_/g, ' '))}${j.flag ? '<br><b>' + esc(j.flag.replace(/_/g, ' ')) + '</b>' : ''}`).addTo(appsLayer); }
    if (j.partner && j.partner.lat) { pts.push([j.partner.lat, j.partner.lng]); L.circleMarker([j.partner.lat, j.partner.lng], {radius: 9, color: '#E9A23B', fillOpacity: .9}).bindPopup(`<b>${esc(j.partner.name)}</b><br>${esc(j.partner.phone || '')}<br>for ${esc(j.ref || 'app job')}`).addTo(appsLayer); }
  });
  if (pts.length) appsMap.fitBounds(L.latLngBounds(pts).pad(.2)); else appsMap.setView([22.5, 79], 5);
  setTimeout(() => appsMap && appsMap.invalidateSize(), 50);
}
async function appsMapLoad() {
  try {
    const d = await api('desk/apps/live', {q: {city: S.appsCity || 'all'}});
    const list = $('#apps-jobs');
    if (list) list.innerHTML = (d.jobs || []).map(j => `<div class="row between small" style="border-bottom:1px solid var(--line);padding-block:6px"><span><b>${esc(j.ref || 'App')}</b> · ${esc(j.pet)} · ${j.scheduledAt ? new Date(j.scheduledAt).toLocaleTimeString('en-IN', {hour: 'numeric', minute: '2-digit'}) : ''}</span><span>${j.partner ? esc(j.partner.name) + ' · ' : ''}${pill(j.flag ? 'Needs desk' : j.status.replace(/_/g, ' '))}</span></div>`).join('') || '<p class="muted small">No jobs today yet.</p>';
    appsMapDraw(d);
  } catch (e) { const list = $('#apps-jobs'); if (list) list.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  clearTimeout(appsTimer);
  appsTimer = setTimeout(() => { if (S.view === 'admin' && S.adminTab === 'apps') appsMapLoad(); }, 30000);
}
ADMIN.apps = () => {
  const s = db.settings, panel = (B.apps && B.apps.panelUrl) || s.appsPanelUrl;
  setTimeout(appsMapLoad, 0);
  const num = (k, label, hint, step = 1) => `<div class="field"><label for="ap-${k}">${label}</label><input id="ap-${k}" type="number" step="${step}" min="0" value="${esc(s[k] ?? '')}" data-chg="apps-set" data-k="${k}"><span class="small muted">${hint}</span></div>`;
  return `<h2>Apps &amp; partners</h2>
  ${APPS_ON ? '' : '<div class="card"><p class="err">The apps are not connected yet. Add WT_CONNECTOR_URL and WT_CONNECTOR_SECRET to wp-config.php (see the setup guide).</p></div>'}
  <div class="card stack"><div class="row between"><h3>Live jobs today</h3><div class="row"><select data-chg="apps-city" aria-label="City" style="width:auto"><option value="all">All cities</option>${db.cities.map(c => `<option value="${esc(c.id)}" ${S.appsCity === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select><button class="btn ghost sm" data-act="apps-map-refresh">Refresh</button></div></div>
    <div id="apps-map" style="height:380px;border-radius:14px;border:1px solid var(--line)"></div>
    <p class="small muted">Brown = booking address, red = needs the desk, gold = groomer's live position. Updates every 30 seconds.</p><div id="apps-jobs"></div></div>
  <div class="card stack"><h3>Partners, KYC, commission and payouts</h3>
    <p class="muted">Partner applications and Aadhaar KYC, approving partners as <b>My team</b> or <b>Freelancer</b>, commission per partner, discounts, dues and payouts, app customers and pets, and app support tickets are in the partner panel.</p>
    <div class="field"><label for="ap-panel">Partner panel link</label><input id="ap-panel" type="url" placeholder="https://admin.wagandtails.in" value="${esc(s.appsPanelUrl || '')}" data-chg="apps-set" data-k="appsPanelUrl"></div>
    ${panel ? `<div><a class="btn" href="${esc(panel)}" target="_blank" rel="noopener">Open the partner panel</a></div>` : ''}</div>
  <div class="card stack"><h3>Rules the apps follow</h3>
    <div class="f2">
      ${num('appsOfferMins', 'Chosen groomer must answer within (minutes)', 'Then the job goes to all groomers.')}
      ${num('appsEscalateHours', 'Alert the desk if no groomer after (hours)', 'For bookings two or more days ahead.', 0.25)}
      ${num('appsSameDayMins', 'Same-day bookings: alert after (minutes)', 'Also used for next-day bookings made late in the evening.')}
      ${num('appsDayBeforeHour', 'Next-day bookings: alert by (hour, 24h)', 'For example 18 = 6 pm the day before.')}
      ${num('appsCancelHours', 'App customers can cancel or move up to (hours before)', 'After that the app asks them to call or WhatsApp the desk.', 0.5)}
      ${num('appsReconfirmHours', 'After a reschedule, groomer confirms within (hours)', 'Otherwise the job goes to all groomers again.', 0.25)}
      ${num('appsNoShowMins', 'Groomer waits at the door before "customer not available" (minutes)', '')}
      <div class="field"><label for="ap-track">Live tracking link for website customers</label><select id="ap-track" data-chg="apps-set" data-k="appsLiveTracking"><option value="1" ${s.appsLiveTracking !== false && s.appsLiveTracking !== 'false' && s.appsLiveTracking !== '0' ? 'selected' : ''}>On (sent with "groomer on the way")</option><option value="0" ${s.appsLiveTracking === false || s.appsLiveTracking === 'false' || s.appsLiveTracking === '0' ? 'selected' : ''}>Off</option></select></div>
    </div><p class="small muted">Changes reach the apps within 5 minutes.</p></div>`;
};
const _teamClickApps = teamClick;
teamClick = async function (a, t, id, v) {
  if (a === 'apps-assign') { await appsAssignModal(id); return true; }
  if (a === 'apps-pick') { t.disabled = true; try { await api('desk/apps/assign', {method: 'POST', body: {ref: id, partnerId: v}}); await appsAfterChange(id, 'Groomer assigned. They have been notified.'); } catch (err) { t.disabled = false; toast(err.message); } return true; }
  if (a === 'apps-unassign') { t.disabled = true; try { await api('desk/apps/unassign', {method: 'POST', body: {ref: id}}); await appsAfterChange(id, 'Groomer removed. The job is offered to all groomers again.'); } catch (err) { t.disabled = false; toast(err.message); } return true; }
  if (a === 'apps-map-refresh') { appsMapLoad(); return true; }
  return _teamClickApps(a, t, id, v);
};
document.addEventListener('change', e => {
  const t = e.target; if (!t.dataset) return;
  if (t.dataset.chg === 'apps-city') { S.appsCity = t.value; appsMapLoad(); }
  if (t.dataset.chg === 'apps-set') {
    const k = t.dataset.k;
    db.settings[k] = k === 'appsLiveTracking' ? t.value === '1' : k === 'appsPanelUrl' ? t.value.trim() : (t.value === '' ? '' : Number(t.value));
    saveConfig('Saved. The apps pick it up within 5 minutes.');
  }
});

/* ---------- boot ---------- */
fromHash();
render();
if (!S.city && role !== 'admin' && role !== 'staff' && S.view !== 'login') cityGate(true);
})();
