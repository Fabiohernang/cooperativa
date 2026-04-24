# Sistema de Control Administrativo — Cooperativa de Transporte

Sistema web liviano (HTML + JS puro, sin dependencias) para control de viajes, facturas, pagos a fleteros y conciliación.

## Estructura del proyecto

```
sistema-cooperativa/
├── index.html              ← Dashboard principal
├── css/
│   └── main.css            ← Estilos globales
├── js/
│   └── db.js               ← Capa de datos (localStorage)
└── pages/
    ├── viajes.html         ← Alta y control de viajes
    ├── facturas.html       ← Control de cobro a clientes
    ├── pagos.html          ← Órdenes de pago a fleteros
    ├── conciliacion.html   ← Verificación viajes vs. liquidación
    └── analisis.html       ← Análisis financiero y buscador
```

## Cómo usar

### Opción A — Abrir directamente (uso local)
Abrí `index.html` en el navegador. No necesita servidor ni instalación.

### Opción B — Subir a GitHub Pages (acceso desde cualquier lado)

1. Creá un repositorio en GitHub (público)
2. Subí todos los archivos manteniendo la estructura de carpetas
3. Andá a Settings → Pages → Source: `main branch / root`
4. Tu sistema va a quedar en: `https://TU_USUARIO.github.io/NOMBRE_REPO/`

```bash
# Desde terminal, dentro de la carpeta sistema-cooperativa:
git init
git add .
git commit -m "Sistema cooperativa v1"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/NOMBRE_REPO.git
git push -u origin main
```

### Opción C — Abrir desde celular
Una vez publicado en GitHub Pages, guardás el link como acceso directo en la pantalla del celular.

## Datos

Los datos se guardan en el **localStorage del navegador**. Esto significa:
- Si usás el mismo navegador en la misma computadora → los datos persisten
- Si abrís desde otra compu o navegador → los datos no se comparten

**Para uso compartido entre vos y Juan**: la solución más simple es usar GitHub Pages y que cada uno tenga su propia copia local. Si necesitás datos compartidos en tiempo real, el siguiente paso es agregar una base de datos (Firebase, Supabase) — eso es fácil de migrar desde este código.

## Lógica de negocio

| Concepto | Fórmula |
|---|---|
| Importe | Tarifa × KG |
| Importe + IVA | Importe × 1.21 |
| Comisión (SOCIO=SI) | Importe+IVA × 6% |
| Comisión (SOCIO=NO) | Importe+IVA × 10% |
| Comisión Matías | Importe+IVA × 1.5% (solo si tiene factura) |
| Importe a pagar fletero | Factura − Comisión − Cuota − Seguros − Adelantos − Combustible − Percepciones − Otro |

## CTG único
El sistema valida que no se cargue el mismo CTG dos veces. Si se intenta cargar un CTG duplicado, muestra un error con el número de viaje que ya lo tiene registrado.

## Conciliación (cómo funciona)
1. Ingresás el nro. de factura → el sistema carga los viajes que tenés registrados
2. Cargás los datos de la liquidación del sistema (CTG + KG + importe)
3. El sistema compara CTG por CTG y marca en rojo cualquier diferencia
4. Cuando todo coincide → "Marcar liquidados" cierra el proceso

## Próximos pasos sugeridos
- [ ] Exportar a Excel / CSV
- [ ] Base de datos compartida (Firebase)
- [ ] Migración a React
- [ ] Importar datos del Excel existente
