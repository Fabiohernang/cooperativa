// ═══════════════════════════════════════════════════════
//  db.js — Capa de datos (localStorage)
//  Estructura: viajes, facturas, pagos
// ═══════════════════════════════════════════════════════

const DB_KEY = 'coop_db_v1';

const DB_DEFAULT = {
  viajes: [],
  facturas: [],
  pagos: []
};

// ── Helpers ────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DB_DEFAULT));
    return JSON.parse(raw);
  } catch { return JSON.parse(JSON.stringify(DB_DEFAULT)); }
}

function saveDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

// ── API Viajes ─────────────────────────────────────────
const Viajes = {
  getAll() { return loadDB().viajes; },

  getByFactura(nroFactura) {
    return this.getAll().filter(v => String(v.factura) === String(nroFactura));
  },

  getByFletero(nombre) {
    const q = nombre.toLowerCase();
    return this.getAll().filter(v => v.fletero.toLowerCase().includes(q));
  },

  add(data) {
    const db = loadDB();
    // Validar CTG único
    const existe = db.viajes.find(v => v.ctg && String(v.ctg) === String(data.ctg));
    if (existe && data.ctg) throw new Error(`CTG ${data.ctg} ya existe (viaje #${existe.id_viaje})`);
    const viaje = {
      id: uid(),
      id_viaje: db.viajes.length + 1,
      fecha: data.fecha,
      cliente: data.cliente,
      factura: data.factura || '',
      fletero: data.fletero,
      socio: data.socio === 'SI' ? 'SI' : 'NO',
      ctg: data.ctg || '',
      origen: data.origen,
      destino: data.destino,
      km: parseFloat(data.km) || 0,
      tarifa: parseFloat(data.tarifa) || 0,
      kg: parseFloat(data.kg) || 0,
      liquidado: false,
      observaciones: data.observaciones || '',
      creado: new Date().toISOString()
    };
    // Calcular automáticos
    viaje.importe     = +(viaje.tarifa * viaje.kg).toFixed(2);
    viaje.importeIVA  = +(viaje.importe * 1.21).toFixed(6);
    viaje.comision    = +(viaje.importeIVA * (viaje.socio === 'SI' ? 0.06 : 0.10)).toFixed(6);
    viaje.comisionMat = viaje.factura ? +(viaje.importeIVA * 0.015).toFixed(6) : 0;
    db.viajes.push(viaje);
    saveDB(db);
    return viaje;
  },

  update(id, data) {
    const db = loadDB();
    const idx = db.viajes.findIndex(v => v.id === id);
    if (idx === -1) throw new Error('Viaje no encontrado');
    const v = { ...db.viajes[idx], ...data };
    v.importe     = +(v.tarifa * v.kg).toFixed(2);
    v.importeIVA  = +(v.importe * 1.21).toFixed(6);
    v.comision    = +(v.importeIVA * (v.socio === 'SI' ? 0.06 : 0.10)).toFixed(6);
    v.comisionMat = v.factura ? +(v.importeIVA * 0.015).toFixed(6) : 0;
    db.viajes[idx] = v;
    saveDB(db);
    return v;
  },

  marcarLiquidado(id, val = true) {
    const db = loadDB();
    const v = db.viajes.find(v => v.id === id);
    if (v) { v.liquidado = val; saveDB(db); }
  },

  delete(id) {
    const db = loadDB();
    db.viajes = db.viajes.filter(v => v.id !== id);
    saveDB(db);
  }
};

// ── API Facturas ───────────────────────────────────────
const Facturas = {
  getAll() { return loadDB().facturas; },

  getVencidas() {
    const hoy = new Date().toISOString().slice(0, 10);
    return this.getAll().filter(f =>
      !f.pagada && !f.anulada && f.fechaVenc && f.fechaVenc < hoy
    );
  },

  getPendientes() {
    return this.getAll().filter(f => !f.pagada && !f.anulada);
  },

  add(data) {
    const db = loadDB();
    const ya = db.facturas.find(f => String(f.nro) === String(data.nro));
    if (ya) throw new Error(`Factura ${data.nro} ya existe`);
    const hoy = new Date().toISOString().slice(0, 10);
    const f = {
      id: uid(),
      nro: data.nro,
      cliente: data.cliente,
      fechaEmis: data.fechaEmis,
      fechaVenc: data.fechaVenc,
      saldo: parseFloat(data.saldo) || 0,
      pago: parseFloat(data.pago) || 0,
      retenciones: parseFloat(data.retenciones) || 0,
      fechaPago: data.fechaPago || '',
      observaciones: data.observaciones || '',
      pagada: !!data.pagada,
      anulada: !!data.anulada,
      creado: new Date().toISOString()
    };
    f.restante = +(f.saldo - f.pago - f.retenciones).toFixed(2);
    f.vencida  = !f.pagada && !f.anulada && f.fechaVenc < hoy;
    db.facturas.push(f);
    saveDB(db);
    return f;
  },

  update(id, data) {
    const db = loadDB();
    const idx = db.facturas.findIndex(f => f.id === id);
    if (idx === -1) throw new Error('Factura no encontrada');
    const hoy = new Date().toISOString().slice(0, 10);
    const f = { ...db.facturas[idx], ...data };
    f.restante = +(f.saldo - f.pago - f.retenciones).toFixed(2);
    f.vencida  = !f.pagada && !f.anulada && f.fechaVenc && f.fechaVenc < hoy;
    db.facturas[idx] = f;
    saveDB(db);
    return f;
  },

  delete(id) {
    const db = loadDB();
    db.facturas = db.facturas.filter(f => f.id !== id);
    saveDB(db);
  }
};

// ── API Pagos ──────────────────────────────────────────
const Pagos = {
  getAll() { return loadDB().pagos; },

  getByFletero(nombre) {
    const q = nombre.toLowerCase();
    return this.getAll().filter(p => p.fletero.toLowerCase().includes(q));
  },

  add(data) {
    const db = loadDB();
    const p = {
      id: uid(),
      nroOrden: data.nroOrden,
      fechaOP: data.fechaOP,
      fletero: data.fletero,
      factura: data.factura,
      fechaFact: data.fechaFact,
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
      creado: new Date().toISOString()
    };
    p.impAPagar = +(
      p.impFactura - p.comision - p.cuota - p.seguros -
      p.adelantos - p.combustible - p.percepciones - p.otro
    ).toFixed(2);
    db.pagos.push(p);
    saveDB(db);
    return p;
  },

  update(id, data) {
    const db = loadDB();
    const idx = db.pagos.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('Pago no encontrado');
    const p = { ...db.pagos[idx], ...data };
    p.impAPagar = +(
      p.impFactura - p.comision - p.cuota - p.seguros -
      p.adelantos - p.combustible - p.percepciones - p.otro
    ).toFixed(2);
    db.pagos[idx] = p;
    saveDB(db);
    return p;
  },

  delete(id) {
    const db = loadDB();
    db.pagos = db.pagos.filter(p => p.id !== id);
    saveDB(db);
  }
};

// ── Utilidades globales ────────────────────────────────
function fmt(n) {
  if (n === undefined || n === null || n === '') return '—';
  return Number(n).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function fmtFecha(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

// Exportar para uso global
window.DB  = { Viajes, Facturas, Pagos };
window.fmt = fmt;
window.fmtFecha = fmtFecha;
window.hoy = hoy;
