import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { useDatos } from '../lib/data'
import { supabase } from '../lib/supabase'
import { fechaLarga } from '../lib/format'
import { Barra, Campo, Chips, Fab, Sheet, Vacio } from '../components/ui'

const IMPORTANCIAS = ['Imprescindible', 'Prescindible', 'Opcional']
const OLAS = { 1: 'Ola 1', 2: 'Ola 2', 3: 'Ola 3' }

export const ESTADOS = {
  sin_enviar: { label: 'Sin enviar', clase: '' },
  enviada: { label: 'Enviada', clase: 'amarillo' },
  vista: { label: 'Vista', clase: 'azul' },
  confirmo: { label: 'Confirmó', clase: 'verde' },
  no: { label: 'No asiste', clase: 'rojo' },
}

export function estadoDe(i) {
  if (i.rsvp === 'Confirmado') return 'confirmo'
  if (i.rsvp === 'No asiste') return 'no'
  if (i.vista_en) return 'vista'
  if (i.enviada_en || i.invitacion_enviada) return 'enviada'
  return 'sin_enviar'
}

const cupos = (i) => i.adultos + i.ninos
const suma = (lista, f) => lista.reduce((s, x) => s + f(x), 0)
const lugares = (n) => `${n} ${n === 1 ? 'lugar' : 'lugares'}`

function useAjustes() {
  const d = useDatos()
  const mapa = useMemo(() => Object.fromEntries(d.ajustes.map((a) => [a.clave, a.valor])), [d.ajustes])
  async function guardar(cambios) {
    const filas = Object.entries(cambios).map(([clave, valor]) => ({ clave, valor: String(valor ?? ''), updated_at: new Date().toISOString() }))
    const { error } = await supabase.from('ajustes').upsert(filas)
    if (error) throw error
    await d.recargar('ajustes')
  }
  return [mapa, guardar]
}

const linkDe = (i) => `${window.location.origin}/i/${i.token}`

function numeroWhatsApp(tel) {
  const n = (tel || '').replace(/\D/g, '')
  if (!n) return ''
  return n.length === 8 ? `503${n}` : n
}

function enlaceWhatsApp(i, texto) {
  const num = numeroWhatsApp(i.telefono)
  return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`
}

function textoInvitacion(i, plantilla) {
  return (plantilla || 'Hola {nombre}, aquí está tu invitación a nuestra boda: {link}')
    .replaceAll('{nombre}', i.nombre)
    .replaceAll('{cupos}', lugares(cupos(i)))
    .replaceAll('{link}', linkDe(i))
}

function textoRecordatorio(i, limite) {
  return `Hola ${i.nombre} 💙 Te recordamos confirmar tu asistencia a nuestra boda${limite ? ` antes del ${fechaLarga(limite)}` : ''}. Es muy fácil, solo entra aquí:\n${linkDe(i)}\n\n¡Gracias! Alicia & Harold`
}

export default function Invitados() {
  const d = useDatos()
  const [cfg] = useAjustes()
  const [vista, setVista] = useState('resumen')
  const [editando, setEditando] = useState(null)
  const [ajustes, setAjustes] = useState(false)

  return (
    <div className="pagina">
      <div className="fila-entre">
        <h1 className="titulo">Invitados</h1>
        <button className="btn-icono grande" onClick={() => setAjustes(true)} aria-label="Ajustes de la invitación">⚙️</button>
      </div>
      <Chips valor={vista} onCambio={setVista} opciones={[
        { valor: 'resumen', label: 'Resumen' },
        { valor: 'lista', label: 'Lista' },
        { valor: 'mensajes', label: `💌 Mensajes (${d.invitados.filter((i) => i.mensaje).length})` },
      ]} />
      {vista === 'resumen' && <Resumen cfg={cfg} abrir={setEditando} />}
      {vista === 'lista' && <Lista abrir={setEditando} />}
      {vista === 'mensajes' && <Mensajes />}
      <Fab onClick={() => setEditando('nuevo')} label="Nuevo invitado" />
      {editando && <EditarInvitado id={editando} onCerrar={() => setEditando(null)} />}
      {ajustes && <AjustesInvitacion onCerrar={() => setAjustes(false)} />}
    </div>
  )
}

function Resumen({ cfg, abrir }) {
  const d = useDatos()
  const todos = d.invitados
  const capacidad = Number(cfg.inv_capacidad) || 100
  const porEstado = (e) => todos.filter((i) => estadoDe(i) === e)
  const confirmadas = suma(porEstado('confirmo'), (i) => i.confirmados)
  const esperando = suma([...porEstado('enviada'), ...porEstado('vista')], cupos)
  const libres = capacidad - confirmadas - esperando

  // Siguiente ola: grupos sin enviar, en orden de ola, que caben en los lugares libres
  const sinEnviar = porEstado('sin_enviar').sort((a, b) => a.ola - b.ola || a.nombre.localeCompare(b.nombre))
  const olaActual = sinEnviar[0]?.ola
  const sugeridos = []
  let resto = libres
  for (const i of sinEnviar.filter((x) => x.ola === olaActual)) {
    if (cupos(i) <= resto) { sugeridos.push(i); resto -= cupos(i) }
  }

  return (
    <>
      <div className="tarjeta">
        <div className="fila-entre"><h3>Lugares</h3><span className="pill">Capacidad {capacidad}</span></div>
        <Barra valor={confirmadas + esperando} total={capacidad} alerta={libres < 0} />
        <div className="stats">
          <div><span className="et">Confirmadas</span><b className="verde">{confirmadas}</b></div>
          <div><span className="et">Esperando respuesta</span><b>{esperando}</b></div>
          <div><span className="et">Libres</span><b className={libres < 0 ? 'rojo' : ''}>{libres}</b></div>
        </div>
        {libres < 0 && <p className="aviso error">Hay más lugares comprometidos que la capacidad. Esperen respuestas antes de invitar a más.</p>}
      </div>

      <div className="grid-stats cinco">
        {Object.entries(ESTADOS).map(([k, e]) => {
          const g = porEstado(k)
          return (
            <div key={k} className="stat">
              <span>{e.label}</span>
              <b>{g.length}</b>
              <small className="meta">{k === 'confirmo' ? `${suma(g, (i) => i.confirmados)} personas` : `${suma(g, cupos)} lugares`}</small>
            </div>
          )
        })}
      </div>

      <div className="tarjeta">
        <h3>Siguiente envío {olaActual ? `· ${OLAS[olaActual]}` : ''}</h3>
        {sinEnviar.length === 0 ? (
          <p className="detalle">Ya enviaron todas las invitaciones 🎉</p>
        ) : sugeridos.length === 0 ? (
          <p className="detalle">No hay lugares libres por ahora. Cuando alguien diga que no asiste, aquí aparecerán los siguientes grupos.</p>
        ) : (
          <>
            <p className="detalle">Caben {sugeridos.length} grupos ({suma(sugeridos, cupos)} lugares). Toca uno para enviarle su invitación.</p>
            <ul className="mini-lista">
              {sugeridos.slice(0, 15).map((i) => (
                <li key={i.id}>
                  <button className="enlace izq" onClick={() => abrir(i.id)}>{i.nombre}</button>
                  <span className="fecha">{OLAS[i.ola]} · {lugares(cupos(i))}</span>
                </li>
              ))}
            </ul>
            {sugeridos.length > 15 && <p className="ayuda">…y {sugeridos.length - 15} más en la Lista.</p>}
          </>
        )}
        <p className="ayuda">Ola 1 = imprescindibles, 2 = prescindibles, 3 = opcionales. Pueden cambiar la ola de cada grupo.</p>
      </div>

      <div className="tarjeta compacta">
        <h3>Por ola</h3>
        {[1, 2, 3].map((o) => {
          const g = todos.filter((i) => i.ola === o)
          return <div key={o} className="fila-entre"><span>{OLAS[o]} ({['', 'imprescindibles', 'prescindibles', 'opcionales'][o]})</span><b>{suma(g, cupos)} lugares</b></div>
        })}
      </div>
    </>
  )
}

function Lista({ abrir }) {
  const d = useDatos()
  const [estado, setEstado] = useState('todos')
  const [lado, setLado] = useState('todos')
  const [buscar, setBuscar] = useState('')
  const lista = d.invitados.filter((i) =>
    (estado === 'todos' || estadoDe(i) === estado) &&
    (lado === 'todos' || i.lado === lado) &&
    (!buscar || i.nombre.toLowerCase().includes(buscar.toLowerCase())))
  return (
    <>
      <input className="buscador" placeholder="Buscar por nombre…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
      <Chips valor={estado} onCambio={setEstado} opciones={[
        { valor: 'todos', label: 'Todos' }, ...Object.entries(ESTADOS).map(([valor, e]) => ({ valor, label: e.label })),
      ]} />
      <Chips valor={lado} onCambio={setLado} opciones={[
        { valor: 'todos', label: 'Ambos lados' }, { valor: 'Alicia', label: '👰 De Alicia' }, { valor: 'Harold', label: '🤵 De Harold' }, { valor: 'Ambos', label: '💑 De los dos' },
      ]} />
      <p className="ayuda">{lista.length} grupos · {suma(lista, cupos)} lugares</p>
      {lista.length === 0 && <Vacio emoji="👥" texto="Nadie con esos filtros." />}
      <ul className="lista">
        {lista.map((i) => {
          const e = ESTADOS[estadoDe(i)]
          return (
            <li key={i.id}>
              <button className="invitado" onClick={() => abrir(i.id)}>
                <div>
                  <b>{i.nombre}</b>
                  <div className="meta">{i.lado} · {OLAS[i.ola]} · {lugares(cupos(i))}{estadoDe(i) === 'confirmo' ? ` · van ${i.confirmados}` : ''}</div>
                </div>
                <span className={`pill ${e.clase}`}>{e.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function Mensajes() {
  const d = useDatos()
  const msgs = d.invitados.filter((i) => i.mensaje).sort((a, b) => (b.respondida_en || '').localeCompare(a.respondida_en || ''))
  if (!msgs.length) return <Vacio emoji="💌" texto="Aquí aparecerán los mensajes que les dejen sus invitados al confirmar." />
  return (
    <ul className="lista">
      {msgs.map((i) => (
        <li key={i.id} className="tarjeta mensaje">
          <p>“{i.mensaje}”</p>
          <span className="meta">— {i.nombre}{i.respondida_en ? ` · ${fechaLarga(i.respondida_en.slice(0, 10))}` : ''}</span>
        </li>
      ))}
    </ul>
  )
}

function EditarInvitado({ id, onCerrar }) {
  const d = useDatos()
  const [cfg] = useAjustes()
  const original = id === 'nuevo' ? null : d.invitados.find((i) => i.id === id)
  const [f, setF] = useState(() => original || {
    nombre: '', lado: d.yo, importancia: 'Imprescindible', ola: 1, adultos: 1, ninos: 0, rsvp: 'Pendiente',
    confirmados: 0, telefono: '', restriccion: '', mesa: '', notas: '',
  })
  const [error, setError] = useState(null)
  const [qr, setQr] = useState(null)
  const [copiado, setCopiado] = useState(false)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  const estado = original ? estadoDe(original) : null

  async function guardar() {
    if (!f.nombre.trim()) return setError('Escribe el nombre')
    const total = (Number(f.adultos) || 0) + (Number(f.ninos) || 0)
    const fila = {
      nombre: f.nombre.trim(), lado: f.lado, importancia: f.importancia, ola: Number(f.ola) || 1,
      adultos: Number(f.adultos) || 0, ninos: Number(f.ninos) || 0, rsvp: f.rsvp,
      confirmados: f.rsvp === 'Confirmado' ? Math.min(total, Number(f.confirmados) || total) : 0,
      telefono: f.telefono || null, restriccion: f.restriccion || null, mesa: f.mesa || null, notas: f.notas || null,
    }
    try {
      if (original) await d.editar('invitados', original.id, fila)
      else await d.crear('invitados', fila)
      onCerrar()
    } catch (e) { setError(e.message) }
  }

  const marcarEnviada = () => {
    if (!original.enviada_en) d.editar('invitados', original.id, { enviada_en: new Date().toISOString(), invitacion_enviada: true })
  }

  async function copiar() {
    try { await navigator.clipboard.writeText(linkDe(original)); setCopiado(true); setTimeout(() => setCopiado(false), 2000) } catch { /* */ }
  }

  async function verQr() {
    setQr(await QRCode.toDataURL(linkDe(original), { width: 600, margin: 2, color: { dark: '#1F4E79', light: '#FFFFFF' } }))
  }

  return (
    <Sheet abierto onCerrar={onCerrar} titulo={original ? original.nombre : 'Nuevo invitado'}>
      {original && (
        <div className="tarjeta invitacion-box">
          <div className="fila-entre">
            <h3>Invitación</h3>
            <span className={`pill ${ESTADOS[estado].clase}`}>{ESTADOS[estado].label}</span>
          </div>
          {!original.telefono && <p className="ayuda">Agrega su teléfono abajo para abrir WhatsApp directo en su chat.</p>}
          <a className="btn" href={enlaceWhatsApp(original, textoInvitacion(original, cfg.inv_mensaje_whatsapp))}
            target="_blank" rel="noreferrer" onClick={marcarEnviada}>💬 Enviar invitación por WhatsApp</a>
          {(estado === 'enviada' || estado === 'vista') && (
            <a className="btn secundario" href={enlaceWhatsApp(original, textoRecordatorio(original, cfg.inv_fecha_limite))}
              target="_blank" rel="noreferrer">🔔 Enviar recordatorio</a>
          )}
          <div className="acciones">
            <button className="btn secundario" onClick={copiar}>{copiado ? '✓ Copiado' : '🔗 Copiar link'}</button>
            <button className="btn secundario" onClick={verQr}>▦ Código QR</button>
          </div>
          {qr && (
            <div className="qr">
              <img src={qr} alt="Código QR de la invitación" />
              <a className="enlace" href={qr} download={`QR-${original.nombre}.png`}>Descargar QR</a>
            </div>
          )}
          <a className="enlace" href={linkDe(original)} target="_blank" rel="noreferrer">Ver su invitación ↗</a>
          <div className="meta">
            {original.enviada_en && <>Enviada {fechaLarga(original.enviada_en.slice(0, 10))}. </>}
            {original.vista_en && <>Vista {fechaLarga(original.vista_en.slice(0, 10))}. </>}
            {original.respondida_en && <>Respondió {fechaLarga(original.respondida_en.slice(0, 10))}.</>}
          </div>
          {estado === 'confirmo' && original.asistentes?.length > 0 && <p className="detalle">Asisten: {original.asistentes.join(', ')}</p>}
          {original.mensaje && <p className="detalle">💌 “{original.mensaje}”</p>}
        </div>
      )}

      <Campo label="Nombre (persona o familia)"><input value={f.nombre} onChange={(e) => set('nombre')(e.target.value)} /></Campo>
      <Campo label="Teléfono (WhatsApp)"><input type="tel" inputMode="tel" value={f.telefono || ''} onChange={(e) => set('telefono')(e.target.value)} placeholder="7777 7777" /></Campo>
      <div className="dos-col">
        <Campo label="Adultos"><input type="number" inputMode="numeric" min="0" value={f.adultos} onChange={(e) => set('adultos')(e.target.value)} /></Campo>
        <Campo label="Niños"><input type="number" inputMode="numeric" min="0" value={f.ninos} onChange={(e) => set('ninos')(e.target.value)} /></Campo>
      </div>
      <p className="ayuda">La invitación permite confirmar hasta {lugares((Number(f.adultos) || 0) + (Number(f.ninos) || 0))}.</p>
      <Campo label="Invitado de">
        <Chips valor={f.lado} onCambio={set('lado')} opciones={['Alicia', 'Harold', 'Ambos'].map((v) => ({ valor: v, label: v }))} />
      </Campo>
      <Campo label="Importancia">
        <Chips valor={f.importancia} onCambio={(v) => setF((x) => ({ ...x, importancia: v, ola: IMPORTANCIAS.indexOf(v) + 1 }))}
          opciones={IMPORTANCIAS.map((v) => ({ valor: v, label: v }))} />
      </Campo>
      <Campo label="Ola de envío">
        <Chips valor={Number(f.ola)} onCambio={set('ola')} opciones={[1, 2, 3].map((v) => ({ valor: v, label: OLAS[v] }))} />
      </Campo>
      <Campo label="Respuesta (se llena sola cuando confirman)">
        <Chips valor={f.rsvp} onCambio={set('rsvp')} opciones={['Pendiente', 'Confirmado', 'No asiste'].map((v) => ({ valor: v, label: v }))} />
      </Campo>
      {f.rsvp === 'Confirmado' && (
        <Campo label="¿Cuántos asisten?"><input type="number" inputMode="numeric" min="1" value={f.confirmados} onChange={(e) => set('confirmados')(e.target.value)} /></Campo>
      )}
      <Campo label="Restricción alimentaria"><input value={f.restriccion || ''} onChange={(e) => set('restriccion')(e.target.value)} /></Campo>
      <Campo label="Mesa"><input value={f.mesa || ''} onChange={(e) => set('mesa')(e.target.value)} /></Campo>
      <Campo label="Notas"><textarea rows={2} value={f.notas || ''} onChange={(e) => set('notas')(e.target.value)} /></Campo>
      {error && <div className="aviso error">{error}</div>}
      <button className="btn grande" onClick={guardar}>Guardar</button>
      {original && <button className="enlace rojo" onClick={async () => {
        if (!confirm('¿Quitar de la lista? Su link de invitación dejará de funcionar.')) return
        await d.borrar('invitados', original.id); onCerrar()
      }}>Quitar de la lista</button>}
    </Sheet>
  )
}

function AjustesInvitacion({ onCerrar }) {
  const [cfg, guardar] = useAjustes()
  const claves = ['inv_formato', 'inv_hora', 'inv_itinerario', 'inv_vestimenta', 'inv_fecha_limite', 'inv_capacidad', 'inv_lugar', 'inv_maps_url', 'inv_waze_url', 'inv_mensaje_whatsapp']
  const [f, setF] = useState(() => Object.fromEntries(claves.map((k) => [k, cfg[k] ?? ''])))
  const [msg, setMsg] = useState(null)
  useEffect(() => { setF(Object.fromEntries(claves.map((k) => [k, cfg[k] ?? '']))) }, [cfg]) // eslint-disable-line
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  async function enviar() {
    try { await guardar(f); onCerrar() } catch (e) { setMsg(e.message) }
  }

  return (
    <Sheet abierto onCerrar={onCerrar} titulo="Ajustes de la invitación">
      <p className="ayuda">Lo que escriban aquí aparece en la invitación de todos al instante. Si un campo queda vacío, no se muestra.</p>
      <Campo label="Tipo de evento">
        <Chips valor={f.inv_formato} onCambio={(v) => setF((x) => ({ ...x, inv_formato: v }))}
          opciones={['Por definir', 'Brunch', 'Cena'].map((v) => ({ valor: v, label: v }))} />
      </Campo>
      <Campo label="Hora"><input value={f.inv_hora} onChange={set('inv_hora')} placeholder="Ej. 10:30 am" /></Campo>
      <Campo label="Itinerario (una línea por actividad)">
        <textarea rows={4} value={f.inv_itinerario} onChange={set('inv_itinerario')} placeholder={'10:30 am · Ceremonia\n11:30 am · Brunch\n1:00 pm · Baile'} />
      </Campo>
      <Campo label="Vestimenta"><textarea rows={2} value={f.inv_vestimenta} onChange={set('inv_vestimenta')} placeholder="Ej. Formal de día. Les pedimos evitar el blanco y el celeste." /></Campo>
      <div className="dos-col">
        <Campo label="Confirmar antes del"><input type="date" value={f.inv_fecha_limite} onChange={set('inv_fecha_limite')} /></Campo>
        <Campo label="Capacidad (personas)"><input type="number" inputMode="numeric" value={f.inv_capacidad} onChange={set('inv_capacidad')} /></Campo>
      </div>
      <Campo label="Lugar"><input value={f.inv_lugar} onChange={set('inv_lugar')} /></Campo>
      <Campo label="Link de Google Maps del lugar"><input type="url" value={f.inv_maps_url} onChange={set('inv_maps_url')} placeholder="Pega aquí el link de 'Compartir' en Google Maps" /></Campo>
      <Campo label="Link de Waze del lugar"><input type="url" value={f.inv_waze_url} onChange={set('inv_waze_url')} placeholder="Opcional" /></Campo>
      <Campo label="Mensaje de WhatsApp">
        <textarea rows={7} value={f.inv_mensaje_whatsapp} onChange={set('inv_mensaje_whatsapp')} />
      </Campo>
      <p className="ayuda">En el mensaje, {'{nombre}'}, {'{cupos}'} y {'{link}'} se reemplazan solos con los datos de cada invitado.</p>
      {msg && <div className="aviso error">{msg}</div>}
      <button className="btn grande" onClick={enviar}>Guardar</button>
    </Sheet>
  )
}
