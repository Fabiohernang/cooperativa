// ═══════════════════════════════════════════════════════
//  firebase-config.js — Conexión a Firebase
// ═══════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ── Tu configuración de Firebase ──────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDeQfS11TFpuS0eQw_wTPcRFD4ZJ6dbRSE",
  authDomain: "cooperativa-transport.firebaseapp.com",
  projectId: "cooperativa-transport",
  storageBucket: "cooperativa-transport.firebasestorage.app",
  messagingSenderId: "809291027400",
  appId: "1:809291027400:web:cce398fd9d100e5287e6fd"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// ── Usuarios autorizados ───────────────────────────────
// Agregá acá los mails de quienes pueden usar el sistema
const USUARIOS_AUTORIZADOS = [
  "fabiohernang@gmail.com",
  // agregá el mail de Juan acá cuando lo tengas
];

// ── Auth ───────────────────────────────────────────────
async function loginGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    const email = result.user.email;
    if (!USUARIOS_AUTORIZADOS.includes(email)) {
      await signOut(auth);
      throw new Error(`El usuario ${email} no tiene acceso al sistema.`);
    }
    return result.user;
  } catch (e) {
    throw e;
  }
}

async function logout() {
  await signOut(auth);
  window.location.href = getRootPath() + 'login.html';
}

function onAuth(callback) {
  onAuthStateChanged(auth, callback);
}

function getRootPath() {
  // Detecta si estamos en /pages/ o en la raíz
  return window.location.pathname.includes('/pages/') ? '../' : './';
}

// ── Helpers Firestore ──────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fmt(n) {
  if (n === undefined || n === null || n === '') return '—';
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtFecha(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

// ── Guard de autenticación ─────────────────────────────
// Llamá esto al inicio de cada página protegida
function requireAuth(onReady) {
  onAuthStateChanged(auth, user => {
    if (!user) {
      window.location.href = getRootPath() + 'login.html';
      return;
    }
    if (!USUARIOS_AUTORIZADOS.includes(user.email)) {
      window.location.href = getRootPath() + 'login.html';
      return;
    }
    onReady(user);
  });
}

// ── API Viajes ─────────────────────────────────────────
const Viajes = {
  async getAll() {
    const q = query(collection(db, 'viajes'), orderBy('fecha', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async getByFactura(nroFactura) {
    const q = query(collection(db, 'viajes'), where('factura', '==', String(nroFactura)));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async getByFletero(nombre) {
    const all = await this.getAll();
    const q = nombre.toLowerCase();
    return all.filter(v => v.fletero.toLowerCase().includes(q));
  },

  _calcular(data) {
    const tarifa = parseFloat(data.tarifa) || 0;
    const kg     = parseFloat(data.kg) || 0;
    const socio  = data.socio === 'SI' ? 'SI' : 'NO';
    const importe    = +(tarifa * kg).toFixed(6);
    const importeIVA = +(importe * 1.21).toFixed(6);
    const comision   = +(importeIVA * (socio === 'SI' ? 0.06 : 0.10)).toFixed(6);
    const comisionMat = data.factura ? +(importeIVA * 0.015).toFixed(6) : 0;
    return { importe, importeIVA, comision, comisionMat };
  },

  async add(data) {
    // Validar CTG único
    if (data.ctg) {
      const q = query(collection(db, 'viajes'), where('ctg', '==', String(data.ctg)));
      const snap = await getDocs(q);
      if (!snap.empty) throw new Error(`CTG ${data.ctg} ya existe en otro viaje.`);
    }
    const calc = this._calcular(data);
    const viaje = {
      fecha: data.fecha,
      cliente: data.cliente,
      factura: data.factura || '',
      fletero: data.fletero,
      socio: data.socio === 'SI' ? 'SI' : 'NO',
      ctg: data.ctg || '',
      origen: data.origen || '',
      destino: data.destino || '',
      km: parseFloat(data.km) || 0,
      tarifa: parseFloat(data.tarifa) || 0,
      kg: parseFloat(data.kg) || 0,
      liquidado: false,
      observaciones: data.observaciones || '',
      ...calc,
      creado: serverTimestamp()
    };
    const ref = await addDoc(collection(db, 'viajes'), viaje);
    return { id: ref.id, ...viaje };
  },

  async update(id, data) {
    const calc = this._calcular(data);
    const upd = {
      fecha: data.fecha,
      cliente: data.cliente,
      factura: data.factura || '',
      fletero: data.fletero,
      socio: data.socio === 'SI' ? 'SI' : 'NO',
      ctg: data.ctg || '',
      origen: data.origen || '',
      destino: data.destino || '',
      km: parseFloat(data.km) || 0,
      tarifa: parseFloat(data.tarifa) || 0,
      kg: parseFloat(data.kg) || 0,
      observaciones: data.observaciones || '',
      ...calc
    };
    await updateDoc(doc(db, 'viajes', id), upd);
    return { id, ...upd };
  },

  async marcarLiquidado(id, val = true) {
    await updateDoc(doc(db, 'viajes', id), { liquidado: val });
  },

  async delete(id) {
    await deleteDoc(doc(db, 'viajes', id));
  }
};

// ── API Facturas ───────────────────────────────────────
const Facturas = {
  async getAll() {
    const q = query(collection(db, 'facturas'), orderBy('fechaEmis', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  _calcular(data) {
    const saldo      = parseFloat(data.saldo) || 0;
    const pago       = parseFloat(data.pago) || 0;
    const retenciones= parseFloat(data.retenciones) || 0;
    const restante   = +(saldo - pago - retenciones).toFixed(2);
    const hoyStr     = hoy();
    const vencida    = !data.pagada && !data.anulada && data.fechaVenc && data.fechaVenc < hoyStr;
    return { restante, vencida: !!vencida };
  },

  async add(data) {
    const ya = await getDocs(query(collection(db, 'facturas'), where('nro', '==', String(data.nro))));
    if (!ya.empty) throw new Error(`Factura ${data.nro} ya existe.`);
    const calc = this._calcular(data);
    const f = {
      nro: String(data.nro),
      cliente: data.cliente,
      fechaEmis: data.fechaEmis,
      fechaVenc: data.fechaVenc || '',
      saldo: parseFloat(data.saldo) || 0,
      pago: parseFloat(data.pago) || 0,
      retenciones: parseFloat(data.retenciones) || 0,
      fechaPago: data.fechaPago || '',
      observaciones: data.observaciones || '',
      pagada: !!data.pagada,
      anulada: !!data.anulada,
      ...calc,
      creado: serverTimestamp()
    };
    const ref = await addDoc(collection(db, 'facturas'), f);
    return { id: ref.id, ...f };
  },

  async update(id, data) {
    const calc = this._calcular(data);
    const upd = {
      nro: String(data.nro),
      cliente: data.cliente,
      fechaEmis: data.fechaEmis,
      fechaVenc: data.fechaVenc || '',
      saldo: parseFloat(data.saldo) || 0,
      pago: parseFloat(data.pago) || 0,
      retenciones: parseFloat(data.retenciones) || 0,
      fechaPago: data.fechaPago || '',
      observaciones: data.observaciones || '',
      pagada: !!data.pagada,
      anulada: !!data.anulada,
      ...calc
    };
    await updateDoc(doc(db, 'facturas', id), upd);
    return { id, ...upd };
  },

  async delete(id) {
    await deleteDoc(doc(db, 'facturas', id));
  }
};

// ── API Pagos ──────────────────────────────────────────
const Pagos = {
  async getAll() {
    const q = query(collection(db, 'pagos'), orderBy('fechaOP', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async getByFletero(nombre) {
    const all = await this.getAll();
    const q = nombre.toLowerCase();
    return all.filter(p => p.fletero.toLowerCase().includes(q));
  },

  _calcular(data) {
    const impFactura   = parseFloat(data.impFactura) || 0;
    const comision     = parseFloat(data.comision) || 0;
    const cuota        = parseFloat(data.cuota) || 0;
    const seguros      = parseFloat(data.seguros) || 0;
    const adelantos    = parseFloat(data.adelantos) || 0;
    const combustible  = parseFloat(data.combustible) || 0;
    const percepciones = parseFloat(data.percepciones) || 0;
    const otro         = parseFloat(data.otro) || 0;
    const impAPagar = +(impFactura - comision - cuota - seguros - adelantos - combustible - percepciones - otro).toFixed(2);
    return { impAPagar };
  },

  async add(data) {
    const calc = this._calcular(data);
    const p = {
      nroOrden: data.nroOrden,
      fechaOP: data.fechaOP,
      fletero: data.fletero,
      factura: data.factura || '',
      fechaFact: data.fechaFact || '',
      impFactura: parseFloat(data.impFactura) || 0,
      comision: parseFloat(data.comision) || 0,
      cuota: parseFloat(data.cuota) || 0,
      seguros: parseFloat(data.seguros) || 0,
      adelantos: parseFloat(data.adelantos) || 0,
      combustible: parseFloat(data.combustible) || 0,
      percepciones: parseFloat(data.percepciones) || 0,
      otro: parseFloat(data.otro) || 0,
      detalleOtro: data.detalleOtro || '',
      retenciones: parseFloat(data.retenciones) || 0,
      medioPago: data.medioPago || '',
      fechaCobro: data.fechaCobro || '',
      nroCheq: data.nroCheq || '',
      impPagado: parseFloat(data.impPagado) || 0,
      observaciones: data.observaciones || '',
      ...calc,
      creado: serverTimestamp()
    };
    const ref = await addDoc(collection(db, 'pagos'), p);
    return { id: ref.id, ...p };
  },

  async update(id, data) {
    const calc = this._calcular(data);
    const upd = {
      nroOrden: data.nroOrden,
      fechaOP: data.fechaOP,
      fletero: data.fletero,
      factura: data.factura || '',
      fechaFact: data.fechaFact || '',
      impFactura: parseFloat(data.impFactura) || 0,
      comision: parseFloat(data.comision) || 0,
      cuota: parseFloat(data.cuota) || 0,
      seguros: parseFloat(data.seguros) || 0,
      adelantos: parseFloat(data.adelantos) || 0,
      combustible: parseFloat(data.combustible) || 0,
      percepciones: parseFloat(data.percepciones) || 0,
      otro: parseFloat(data.otro) || 0,
      detalleOtro: data.detalleOtro || '',
      retenciones: parseFloat(data.retenciones) || 0,
      medioPago: data.medioPago || '',
      fechaCobro: data.fechaCobro || '',
      nroCheq: data.nroCheq || '',
      impPagado: parseFloat(data.impPagado) || 0,
      observaciones: data.observaciones || '',
      ...calc
    };
    await updateDoc(doc(db, 'pagos', id), upd);
    return { id, ...upd };
  },

  async delete(id) {
    await deleteDoc(doc(db, 'pagos', id));
  }
};

// ── Exportar todo globalmente ──────────────────────────
window.DB        = { Viajes, Facturas, Pagos };
window.Auth      = { loginGoogle, logout, onAuth, requireAuth };
window.fmt       = fmt;
window.fmtFecha  = fmtFecha;
window.hoy       = hoy;
