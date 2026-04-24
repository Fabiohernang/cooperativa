// nav.js — Auth con usuario/contraseña + Firestore
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc,
  doc, getDocs, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDeQfS11TFpuS0eQw_wTPcRFD4ZJ6dbRSE",
  authDomain: "cooperativa-transport.firebaseapp.com",
  projectId: "cooperativa-transport",
  storageBucket: "cooperativa-transport.firebasestorage.app",
  messagingSenderId: "809291027400",
  appId: "1:809291027400:web:cce398fd9d100e5287e6fd"
};

// Mapa email interno → nombre de usuario visible
const NOMBRE_USUARIO = {
  "fabio@cooptrans.local": "Fabio",
  "juan@cooptrans.local":  "Juan",
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const isPages = window.location.pathname.includes('/pages/');
const ROOT    = isPages ? '../' : './';

// ── Helpers globales ───────────────────────────────────
window.fmt = n => {
  if (n === undefined || n === null || n === '') return '—';
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
window.fmtFecha = str => {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
};
window.hoy = () => new Date().toISOString().slice(0, 10);

// ── Guard + inyectar usuario en nav ───────────────────
onAuthStateChanged(auth, user => {
  if (!user) { window.location.href = ROOT + 'login.html'; return; }

  const navUser = document.getElementById('nav-user');
  if (navUser) navUser.textContent = NOMBRE_USUARIO[user.email] || user.email;

  const navFecha = document.getElementById('nav-fecha');
  if (navFecha) navFecha.textContent = new Date().toLocaleDateString('es-AR', {weekday:'short', day:'numeric', month:'short'});

  window.dispatchEvent(new CustomEvent('auth-ready', { detail: { user } }));
});

window.doLogout = async () => {
  await signOut(auth);
  window.location.href = ROOT + 'login.html';
};

// ── DB API ─────────────────────────────────────────────
window.DB = {
  Viajes: {
    async getAll() {
      const snap = await getDocs(collection(db,'viajes'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.fecha||'') > (a.fecha||'') ? 1 : -1);
    },
    async getByFactura(nro) {
      const snap = await getDocs(query(collection(db,'viajes'), where('factura','==',String(nro))));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    async getByFletero(nombre) {
      const all = await this.getAll();
      return all.filter(v => v.fletero.toLowerCase().includes(nombre.toLowerCase()));
    },
    _calc(data) {
      const cfg = (() => { try { return JSON.parse(localStorage.getItem('coop_config_v1')) || {}; } catch { return {}; } })();
      const pctSocio   = (cfg.pctSocio   ?? 6)   / 100;
      const pctNoSocio = (cfg.pctNoSocio ?? 10)  / 100;
      const pctMatias  = (cfg.pctMatias  ?? 1.5) / 100;
      const imp = (parseFloat(data.tarifa)||0)*(parseFloat(data.kg)||0);
      const iva = +(imp*1.21).toFixed(6);
      const com = +(iva*(data.socio==='SI'?pctSocio:pctNoSocio)).toFixed(6);
      const mat = data.factura ? +(imp*pctMatias).toFixed(6) : 0;
      return { importe:+imp.toFixed(6), importeIVA:iva, comision:com, comisionMat:mat };
    },
    async add(data) {
      if (data.ctg) {
        const ex = await getDocs(query(collection(db,'viajes'), where('ctg','==',String(data.ctg))));
        if (!ex.empty) throw new Error(`CTG ${data.ctg} ya existe en otro viaje.`);
      }
      const v = { fecha:data.fecha, cliente:data.cliente, factura:data.factura||'',
        fletero:data.fletero, socio:data.socio==='SI'?'SI':'NO', ctg:data.ctg||'',
        origen:data.origen||'', destino:data.destino||'', km:parseFloat(data.km)||0,
        tarifa:parseFloat(data.tarifa)||0, kg:parseFloat(data.kg)||0, liquidado:false,
        observaciones:data.observaciones||'', ...this._calc(data), creado:serverTimestamp() };
      const ref = await addDoc(collection(db,'viajes'), v);
      return { id:ref.id, ...v };
    },
    async update(id, data) {
      const u = { fecha:data.fecha, cliente:data.cliente, factura:data.factura||'',
        fletero:data.fletero, socio:data.socio==='SI'?'SI':'NO', ctg:data.ctg||'',
        origen:data.origen||'', destino:data.destino||'', km:parseFloat(data.km)||0,
        tarifa:parseFloat(data.tarifa)||0, kg:parseFloat(data.kg)||0,
        observaciones:data.observaciones||'', ...this._calc(data) };
      await updateDoc(doc(db,'viajes',id), u); return { id, ...u };
    },
    async marcarLiquidado(id, val=true) { await updateDoc(doc(db,'viajes',id), {liquidado:val}); },
    async delete(id) { await deleteDoc(doc(db,'viajes',id)); }
  },

  Facturas: {
    async getAll() {
      const snap = await getDocs(collection(db,'facturas'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.fechaEmis||'') > (a.fechaEmis||'') ? 1 : -1);
    },
    _calc(data) {
      const s=parseFloat(data.saldo)||0, p=parseFloat(data.pago)||0, r=parseFloat(data.retenciones)||0;
      return { restante:+(s-p-r).toFixed(2), vencida:!!((!data.pagada&&!data.anulada&&data.fechaVenc&&data.fechaVenc<window.hoy())) };
    },
    async add(data) {
      const ex = await getDocs(query(collection(db,'facturas'), where('nro','==',String(data.nro))));
      if (!ex.empty) throw new Error(`Factura ${data.nro} ya existe.`);
      const f = { nro:String(data.nro), cliente:data.cliente, fechaEmis:data.fechaEmis,
        fechaVenc:data.fechaVenc||'', saldo:parseFloat(data.saldo)||0, pago:parseFloat(data.pago)||0,
        retenciones:parseFloat(data.retenciones)||0, fechaPago:data.fechaPago||'',
        observaciones:data.observaciones||'', pagada:!!data.pagada, anulada:!!data.anulada,
        ...this._calc(data), creado:serverTimestamp() };
      const ref = await addDoc(collection(db,'facturas'), f); return { id:ref.id, ...f };
    },
    async update(id, data) {
      const u = { nro:String(data.nro), cliente:data.cliente, fechaEmis:data.fechaEmis,
        fechaVenc:data.fechaVenc||'', saldo:parseFloat(data.saldo)||0, pago:parseFloat(data.pago)||0,
        retenciones:parseFloat(data.retenciones)||0, fechaPago:data.fechaPago||'',
        observaciones:data.observaciones||'', pagada:!!data.pagada, anulada:!!data.anulada,
        ...this._calc(data) };
      await updateDoc(doc(db,'facturas',id), u); return { id, ...u };
    },
    async delete(id) { await deleteDoc(doc(db,'facturas',id)); }
  },

  Pagos: {
    async getAll() {
      const snap = await getDocs(collection(db,'pagos'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.fechaOP||'') > (a.fechaOP||'') ? 1 : -1);
    },
    async getByFletero(nombre) {
      const all = await this.getAll();
      return all.filter(p => p.fletero.toLowerCase().includes(nombre.toLowerCase()));
    },
    _calc(data) {
      const imp=parseFloat(data.impFactura)||0;
      return { impAPagar:+(imp-(parseFloat(data.comision)||0)-(parseFloat(data.cuota)||0)-(parseFloat(data.seguros)||0)-(parseFloat(data.adelantos)||0)-(parseFloat(data.combustible)||0)-(parseFloat(data.percepciones)||0)-(parseFloat(data.otro)||0)).toFixed(2) };
    },
    async add(data) {
      const p = { nroOrden:data.nroOrden, fechaOP:data.fechaOP, fletero:data.fletero,
        factura:data.factura||'', fechaFact:data.fechaFact||'', impFactura:parseFloat(data.impFactura)||0,
        comision:parseFloat(data.comision)||0, cuota:parseFloat(data.cuota)||0,
        seguros:parseFloat(data.seguros)||0, adelantos:parseFloat(data.adelantos)||0,
        combustible:parseFloat(data.combustible)||0, percepciones:parseFloat(data.percepciones)||0,
        otro:parseFloat(data.otro)||0, detalleOtro:data.detalleOtro||'',
        retenciones:parseFloat(data.retenciones)||0, medioPago:data.medioPago||'',
        fechaCobro:data.fechaCobro||'', nroCheq:data.nroCheq||'',
        impPagado:parseFloat(data.impPagado)||0, observaciones:data.observaciones||'',
        ...this._calc(data), creado:serverTimestamp() };
      const ref = await addDoc(collection(db,'pagos'), p); return { id:ref.id, ...p };
    },
    async update(id, data) {
      const u = { nroOrden:data.nroOrden, fechaOP:data.fechaOP, fletero:data.fletero,
        factura:data.factura||'', fechaFact:data.fechaFact||'', impFactura:parseFloat(data.impFactura)||0,
        comision:parseFloat(data.comision)||0, cuota:parseFloat(data.cuota)||0,
        seguros:parseFloat(data.seguros)||0, adelantos:parseFloat(data.adelantos)||0,
        combustible:parseFloat(data.combustible)||0, percepciones:parseFloat(data.percepciones)||0,
        otro:parseFloat(data.otro)||0, detalleOtro:data.detalleOtro||'',
        retenciones:parseFloat(data.retenciones)||0, medioPago:data.medioPago||'',
        fechaCobro:data.fechaCobro||'', nroCheq:data.nroCheq||'',
        impPagado:parseFloat(data.impPagado)||0, observaciones:data.observaciones||'',
        ...this._calc(data) };
      await updateDoc(doc(db,'pagos',id), u); return { id, ...u };
    },
    async delete(id) { await deleteDoc(doc(db,'pagos',id)); }
  }
};
