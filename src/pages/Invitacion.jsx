import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { FECHA_BODA, diasHasta, fechaLarga, hoyISO } from '../lib/format'

const personas = (n) => `${n} ${n === 1 ? 'persona' : 'personas'}`

function linksMapa(cfg) {
  const q = encodeURIComponent(cfg.inv_lugar || 'Casa Ávila, El Boquerón, El Salvador')
  return {
    maps: cfg.inv_maps_url || `https://www.google.com/maps/search/?api=1&query=${q}`,
    waze: cfg.inv_waze_url || `https://waze.com/ul?q=${q}&navigate=yes`,
  }
}

// "10:30" o "10:30 am" → [10, 30]
function leerHora(texto) {
  const m = (texto || '').trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/)
  if (!m) return null
  let h = Number(m[1]); const min = Number(m[2] || 0)
  if (m[3]?.startsWith('p') && h < 12) h += 12
  if (m[3]?.startsWith('a') && h === 12) h = 0
  return h < 24 && min < 60 ? [h, min] : null
}

function archivoCalendario(cfg) {
  const lugar = cfg.inv_lugar || 'Casa Ávila, El Boquerón'
  const hora = leerHora(cfg.inv_hora)
  const pad = (n) => String(n).padStart(2, '0')
  let inicio, fin
  if (hora) {
    // El Salvador = UTC−6, sin horario de verano
    const ini = new Date(Date.UTC(2027, 3, 24, hora[0] + 6, hora[1]))
    const f = new Date(ini.getTime() + 5 * 3600 * 1000)
    const z = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
    inicio = `DTSTART:${z(ini)}`; fin = `DTEND:${z(f)}`
  } else {
    inicio = 'DTSTART;VALUE=DATE:20270424'; fin = 'DTEND;VALUE=DATE:20270425'
  }
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Boda Alicia y Harold//ES', 'BEGIN:VEVENT',
    'UID:boda-alicia-harold-20270424', `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    inicio, fin, 'SUMMARY:Boda de Alicia & Harold 💍', `LOCATION:${lugar}`,
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Mañana es la boda de Alicia & Harold', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
  return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics)
}

export default function Invitacion({ token }) {
  const [inv, setInv] = useState(undefined)
  const [editando, setEditando] = useState(false)

  useEffect(() => {
    supabase.rpc('invitacion_obtener', { p_token: token }).then(({ data, error }) => {
      setInv(error ? null : data)
      if (data && !data.respondida_en) setEditando(true)
    })
  }, [token])

  if (inv === undefined) return <div className="inv centro cargando">Abriendo tu invitación…</div>
  if (inv === null) return (
    <div className="inv centro">
      <div className="login-anillos">💍</div>
      <p>No encontramos esta invitación. Revisa que el link esté completo o escríbenos.</p>
    </div>
  )

  const cfg = inv.config || {}
  const mapa = linksMapa(cfg)
  const limite = cfg.inv_fecha_limite
  const cerrado = limite && hoyISO() > limite
  const dias = diasHasta(FECHA_BODA)

  return (
    <div className="inv">
      <header className="inv-hero">
        <div className="inv-hero-texto">
          <p className="inv-caps aparece d1">Nos casamos</p>
          <p className="inv-lugar aparece d2">Casa Ávila, El Boquerón · San Salvador, El Salvador</p>
          <h1 className="aparece d3">Alicia &amp; Harold</h1>
          <div className="inv-linea aparece d4" />
          <p className="inv-fecha-num aparece d4">24 · 04 · 2027</p>
        </div>
        <div className="inv-hero-pie aparece d5">
          <p className="inv-para">{inv.nombre}</p>
          <p>Reservamos <b>{personas(inv.cupos)}</b> para ustedes</p>
          <a className="inv-bajar" href="#detalles">Ver invitación ↓</a>
        </div>
      </header>

      <div className="inv-cuerpo" id="detalles">
      <section className="inv-tarjeta inv-saludo">
        <p className="inv-caps oscuro">Con mucho cariño</p>
        <p className="inv-cita">Queremos compartir con ustedes el día más especial de nuestras vidas. Nos encantaría que nos acompañen.</p>
        {dias > 0 && (
          <div className="inv-cuenta-boxes">
            <div><b>{dias}</b><span>días</span></div>
            <div><b>{Math.floor(dias / 7)}</b><span>semanas</span></div>
          </div>
        )}
      </section>

      <section className="inv-tarjeta">
        <h2>Cuándo y dónde</h2>
        <div className="inv-dato"><span>📅</span><div><b>Sábado 24 de abril de 2027</b>{cfg.inv_formato && cfg.inv_formato !== 'Por definir' && <div>{cfg.inv_formato}</div>}</div></div>
        <div className="inv-dato"><span>🕰️</span><div><b>{cfg.inv_hora || 'Hora por confirmar'}</b></div></div>
        <div className="inv-dato"><span>📍</span><div><b>{cfg.inv_lugar || 'Casa Ávila, El Boquerón'}</b></div></div>
        <div className="acciones">
          <a className="btn" href={mapa.maps} target="_blank" rel="noreferrer">Google Maps</a>
          <a className="btn" href={mapa.waze} target="_blank" rel="noreferrer">Waze</a>
        </div>
        <a className="btn secundario" href={archivoCalendario(cfg)} download="boda-alicia-harold.ics">📆 Agregar a mi calendario</a>
      </section>

      {cfg.inv_itinerario && (
        <section className="inv-tarjeta">
          <h2>Itinerario</h2>
          <ul className="inv-itinerario">
            {cfg.inv_itinerario.split('\n').filter((l) => l.trim()).map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </section>
      )}

      {cfg.inv_vestimenta && (
        <section className="inv-tarjeta">
          <h2>Vestimenta</h2>
          <p>{cfg.inv_vestimenta}</p>
        </section>
      )}

      <section className="inv-tarjeta" id="confirmar">
        <h2>Confirma tu asistencia</h2>
        {cerrado && !inv.respondida_en ? (
          <p>La fecha para confirmar ({fechaLarga(limite)}) ya pasó. Por favor escríbenos directamente.</p>
        ) : editando && !cerrado ? (
          <Formulario inv={inv} token={token} onListo={(d) => { setInv(d); setEditando(false) }} limite={limite} />
        ) : (
          <Respuesta inv={inv} cerrado={cerrado} onCambiar={() => setEditando(true)} />
        )}
      </section>

      <p className="inv-pie">Con amor,<br /><span>Alicia &amp; Harold</span></p>
      </div>
    </div>
  )
}

function Respuesta({ inv, cerrado, onCambiar }) {
  const va = inv.rsvp === 'Confirmado'
  return (
    <div className="inv-respuesta">
      <div className="inv-grande">{va ? '🎉' : '💙'}</div>
      {va ? (
        <p><b>¡Gracias por confirmar!</b> Los esperamos: {personas(inv.confirmados)}.</p>
      ) : (
        <p><b>Gracias por avisarnos.</b> Los vamos a extrañar.</p>
      )}
      {va && inv.asistentes?.length > 0 && <p className="ayuda">{inv.asistentes.join(' · ')}</p>}
      {!cerrado && <button className="enlace" onClick={onCambiar}>Cambiar mi respuesta</button>}
    </div>
  )
}

function Formulario({ inv, token, onListo, limite }) {
  const [asiste, setAsiste] = useState(inv.rsvp === 'No asiste' ? false : inv.respondida_en ? true : null)
  const [cantidad, setCantidad] = useState(inv.confirmados || inv.cupos)
  const [nombres, setNombres] = useState(() => {
    const n = [...(inv.asistentes || [])]
    while (n.length < inv.cupos) n.push('')
    return n
  })
  const [restriccion, setRestriccion] = useState(inv.restriccion || '')
  const [mensaje, setMensaje] = useState(inv.mensaje || '')
  const [estado, setEstado] = useState(null)

  async function enviar() {
    if (asiste === null) return setEstado({ error: true, t: 'Elige si podrán asistir.' })
    setEstado({ t: 'Enviando…' })
    const { data, error } = await supabase.rpc('invitacion_responder', {
      p_token: token, p_asiste: asiste, p_cantidad: asiste ? cantidad : 0,
      p_asistentes: asiste ? nombres.slice(0, cantidad) : [], p_restriccion: restriccion, p_mensaje: mensaje,
    })
    if (error) return setEstado({ error: true, t: error.message.includes('pasó') ? 'La fecha para confirmar ya pasó.' : 'No se pudo enviar. Intenta de nuevo.' })
    onListo(data)
  }

  return (
    <div className="inv-form">
      <div className="acciones">
        <button className={`opcion ${asiste === true ? 'on' : ''}`} onClick={() => setAsiste(true)}>¡Sí, ahí estaremos!</button>
        <button className={`opcion ${asiste === false ? 'on' : ''}`} onClick={() => setAsiste(false)}>No podremos ir</button>
      </div>

      {asiste && (
        <>
          <div className="campo">
            <span>¿Cuántas personas asistirán? (máximo {inv.cupos})</span>
            <div className="contador">
              <button onClick={() => setCantidad(Math.max(1, cantidad - 1))} disabled={cantidad <= 1}>−</button>
              <b>{cantidad}</b>
              <button onClick={() => setCantidad(Math.min(inv.cupos, cantidad + 1))} disabled={cantidad >= inv.cupos}>＋</button>
            </div>
          </div>
          <div className="campo">
            <span>Nombres de quienes asistirán</span>
            {nombres.slice(0, cantidad).map((n, i) => (
              <input key={i} value={n} placeholder={`Persona ${i + 1}`}
                onChange={(e) => setNombres(nombres.map((x, j) => (j === i ? e.target.value : x)))} />
            ))}
          </div>
          <label className="campo"><span>¿Alguna alergia o restricción alimentaria?</span>
            <input value={restriccion} onChange={(e) => setRestriccion(e.target.value)} placeholder="Opcional" />
          </label>
        </>
      )}

      <label className="campo"><span>Un mensaje para los novios</span>
        <textarea rows={3} value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder="Opcional" maxLength={1000} />
      </label>
      {estado && <div className={`aviso ${estado.error ? 'error' : ''}`}>{estado.t}</div>}
      <button className="btn grande" onClick={enviar} disabled={estado?.t === 'Enviando…'}>Enviar respuesta</button>
      {limite && <p className="ayuda centro-texto">Puedes cambiar tu respuesta hasta el {fechaLarga(limite)}.</p>}
    </div>
  )
}
