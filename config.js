// ============================================================
// CONFIGURACIÓN GLOBAL — VDR Reportes
// ⚠️ REEMPLAZÁ APPS_SCRIPT_URL con tu URL real al publicar
// ============================================================

const CONFIG = {
  // URL del Apps Script publicado como Web App
  // La obtenés en: Apps Script → Implementar → Nueva implementación
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/TU_ID_AQUI/exec',

  // Datos del municipio
  MUNICIPIO: {
    nombre:    'Municipalidad de Villa del Rosario',
    direccion: 'Hipólito Yrigoyen 870 · Córdoba 5963',
    tel:       '',
  },

  // Centro del mapa (Villa del Rosario)
  MAPA: {
    lat:  -31.5596,
    lon:  -63.5339,
    zoom: 14,
  },

  // Caché
  CACHE: {
    ttl_categorias: 24 * 60 * 60 * 1000, // 24 horas
    ttl_reportes:   5 * 60 * 1000,        // 5 minutos
    max_reportes:   100,
  },

  // Versión
  VERSION: '1.0.0',
  DEVELOPER: 'Ing. Ezequiel Felippa',
};

// ── API: llamadas al Apps Script ──────────────────────────
const API = {
  async post(accion, datos = {}) {
    try {
      const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ accion, ...datos }),
      });
      return await res.json();
    } catch {
      return { ok: false, error: 'Sin conexión. Verificá tu internet.' };
    }
  },

  async get(accion, params = {}) {
    try {
      const qs  = new URLSearchParams({ accion, ...params }).toString();
      const res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?${qs}`);
      return await res.json();
    } catch {
      return { ok: false, error: 'Sin conexión. Verificá tu internet.' };
    }
  },
};

// ── CACHÉ LOCAL ───────────────────────────────────────────
const Cache = {
  set(key, data, ttl = 0) {
    localStorage.setItem(key, JSON.stringify({
      data,
      expires: ttl ? Date.now() + ttl : 0,
    }));
  },

  get(key) {
    try {
      const item = JSON.parse(localStorage.getItem(key));
      if (!item) return null;
      if (item.expires && Date.now() > item.expires) {
        localStorage.removeItem(key);
        return null;
      }
      return item.data;
    } catch { return null; }
  },

  del(key) { localStorage.removeItem(key); },

  clear() {
    Object.keys(localStorage)
      .filter(k => k.startsWith('vdr_'))
      .forEach(k => localStorage.removeItem(k));
  },
};

// ── SESIÓN ────────────────────────────────────────────────
const Sesion = {
  guardar(datos) { Cache.set('vdr_sesion', datos); },
  obtener()      { return Cache.get('vdr_sesion'); },
  cerrar()       { Cache.del('vdr_sesion'); },
  estaLogueado() { return !!this.obtener(); },
  esAdmin()      { return this.obtener()?.rol === 'Admin'; },
  esSupervisor() { const r = this.obtener()?.rol; return r === 'Admin' || r === 'Supervisor'; },
};

// ── FORMATO ───────────────────────────────────────────────
const Fmt = {
  fecha(d) {
    if (!d) return '';
    const f = new Date(d);
    return f.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  fechaHora(d) {
    if (!d) return '';
    const f = new Date(d);
    return f.toLocaleDateString('es-AR') + ' ' + f.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  },

  tiempoRelativo(d) {
    if (!d) return '';
    const diff = Math.floor((Date.now() - new Date(d)) / 1000);
    if (diff < 60)     return 'Hace un momento';
    if (diff < 3600)   return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400)  return `Hace ${Math.floor(diff / 3600)} hs`;
    if (diff < 604800) return `Hace ${Math.floor(diff / 86400)} días`;
    return Fmt.fecha(d);
  },
};

// ── TOAST / MENSAJES ──────────────────────────────────────
const Toast = {
  mostrar(msg, tipo = 'info', duracion = 3000) {
    const colores = {
      info:    { bg: '#1A1A1A', text: '#fff' },
      exito:   { bg: '#2E7D32', text: '#fff' },
      error:   { bg: '#C62828', text: '#fff' },
      alerta:  { bg: '#F5820A', text: '#fff' },
    };
    const c = colores[tipo] || colores.info;

    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = `
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%) translateY(20px);
      background: ${c.bg}; color: ${c.text};
      padding: 10px 20px; border-radius: 24px;
      font-size: 13px; font-weight: 500; font-family: inherit;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      z-index: 9999; white-space: nowrap;
      opacity: 0; transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
      pointer-events: none; max-width: 90vw; text-align: center;
    `;
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateX(-50%) translateY(0)';
    });
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) translateY(10px)';
      setTimeout(() => el.remove(), 300);
    }, duracion);
  },
  exito(msg)  { this.mostrar(msg, 'exito'); },
  error(msg)  { this.mostrar(msg, 'error'); },
  alerta(msg) { this.mostrar(msg, 'alerta'); },
};

// ── SKELETON LOADER ───────────────────────────────────────
const Skeleton = {
  item() {
    return `<div style="padding:12px 14px;border-bottom:1px solid #f0f0f0;display:flex;gap:10px;align-items:center">
      <div style="width:10px;height:10px;border-radius:50%;background:#f0f0f0;flex-shrink:0"></div>
      <div style="flex:1">
        <div style="height:12px;background:#f0f0f0;border-radius:4px;width:70%;margin-bottom:6px;animation:shimmer 1.4s infinite"></div>
        <div style="height:10px;background:#f0f0f0;border-radius:4px;width:45%"></div>
      </div>
      <div style="height:18px;width:60px;background:#f0f0f0;border-radius:20px"></div>
    </div>`;
  },
  lista(n = 4) {
    return Array(n).fill(this.item()).join('');
  },
};
