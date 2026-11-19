import { useEffect } from 'react'
import { useImagen } from '../lib/files'

export function Sheet({ abierto, onCerrar, titulo, children }) {
  useEffect(() => {
    if (!abierto) return
    const y = window.scrollY
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = ''; window.scrollTo(0, y) }
  }, [abierto])
  if (!abierto) return null
  return (
    <div className="sheet-fondo" onClick={onCerrar}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={titulo}>
        <div className="sheet-barra" />
        <div className="sheet-cabecera">
          <h2>{titulo}</h2>
          <button className="btn-icono" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>
        <div className="sheet-cuerpo">{children}</div>
      </div>
    </div>
  )
}

export function Img({ path, url, alt = '', className }) {
  const src = useImagen(path, url)
  if (!src) return <div className={`img-vacia ${className || ''}`}>🖼️</div>
  return <img src={src} alt={alt} className={className} loading="lazy" />
}

export function Chips({ opciones, valor, onCambio }) {
  return (
    <div className="chips">
      {opciones.map((o) => (
        <button key={o.valor} className={`chip ${valor === o.valor ? 'activo' : ''}`} onClick={() => onCambio(o.valor)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Barra({ valor, total, alerta }) {
  const pct = total > 0 ? Math.min(100, (valor / total) * 100) : 0
  return (
    <div className="barra">
      <div className={`barra-llena ${alerta ? 'alerta' : ''}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Campo({ label, children }) {
  return (
    <label className="campo">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function SelectCategoria({ categorias, valor, onCambio }) {
  return (
    <select value={valor ?? ''} onChange={(e) => onCambio(e.target.value ? Number(e.target.value) : null)}>
      <option value="">Sin categoría</option>
      {categorias.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.nombre}</option>)}
    </select>
  )
}

export function Fab({ onClick, label = 'Agregar' }) {
  return <button className="fab" onClick={onClick} aria-label={label}>＋</button>
}

export function Vacio({ emoji, texto }) {
  return <div className="vacio"><div>{emoji}</div><p>{texto}</p></div>
}

const ICONOS = {
  inicio: 'M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  ideas: 'M4 4h7v9H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 15h7v5H4z',
  tareas: 'M9 11l3 3 8-8M4 12a8 8 0 1 0 8-8',
  dinero: 'M3 7h18v12H3zM3 11h18M7 15h3',
  invitados: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 21a6 6 0 0 0-4-5.6',
  avisos: 'M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9zM10 20a2 2 0 0 0 4 0',
}
export function Icono({ nombre }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONOS[nombre]} />
    </svg>
  )
}

// Barra de dos tramos: pagado (fuerte) + contratado sin pagar (suave), sobre el total
export function BarraDoble({ pagado, contratado, total, alerta }) {
  const base = Math.max(total, contratado, 1)
  const pctPag = Math.min(100, (pagado / base) * 100)
  const pctCon = Math.min(100 - pctPag, (Math.max(0, contratado - pagado) / base) * 100)
  return (
    <div className="barra">
      <div className="barra-doble">
        <div className="tramo pagado" style={{ width: `${pctPag}%` }} />
        <div className={`tramo contratado ${alerta ? 'alerta' : ''}`} style={{ width: `${pctCon}%` }} />
      </div>
    </div>
  )
}
