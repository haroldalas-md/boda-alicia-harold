import { useEffect, useRef, useState } from 'react'
import { useDatos } from '../lib/data'
import { supabase } from '../lib/supabase'
import { dinero } from '../lib/format'
import { Img, Vacio } from '../components/ui'

const otro = (yo) => (yo === 'Alicia' ? 'Harold' : 'Alicia')

// Cuántos avisos nuevos tiene la persona (para el número rojo del menú)
export function contarAvisos(d) {
  const visto = d.actividad_vista.find((v) => v.nombre === d.yo)?.visto_hasta || '1970-01-01'
  const nuevos = d.actividad.filter((a) => a.actor !== d.yo && a.updated_at > visto).length
  const opiniones = d.ideas.filter((i) => i.opinion_de === d.yo).length
  return nuevos + opiniones
}

const NOMBRES = {
  tarea: ['una tarea', 'tareas'],
  idea: ['una idea', 'ideas'],
  pago: ['un pago', 'pagos'],
  proveedor: ['un proveedor', 'proveedores'],
  invitado: ['un invitado', 'invitados'],
}
const ICONOS = { tarea: '✅', idea: '💡', pago: '💸', ahorro: '🏦', proveedor: '🧾', presupuesto: '📊', invitado: '👥', ajustes: '⚙️' }

function frase(a, yo) {
  const n = a.items.length || a.veces
  const quien = a.actor === 'Invitado' ? (n > 1 ? `${n} invitados` : a.items[0]?.replace(/ \(\d+\)$/, '')) : a.actor
  if (a.tipo === 'ahorro') return `${quien} ${a.verbo} ${dinero(a.monto)} ${a.verbo === 'abonó' ? 'al ahorro' : 'del ahorro'}${a.veces > 1 ? ` (${a.veces} movimientos)` : ''}`
  if (a.tipo === 'pago') return `${quien} ${a.verbo} ${a.veces > 1 ? `${a.veces} pagos` : 'un pago'} de ${dinero(a.monto)}`
  if (a.tipo === 'presupuesto') return `${quien} editó el presupuesto`
  if (a.tipo === 'ajustes') return `${quien} cambió ${a.items.join(' y ')}`
  if (a.actor === 'Invitado') {
    const personas = a.items.reduce((s, x) => s + Number((x.match(/\((\d+)\)$/) || [])[1] || 0), 0)
    if (a.verbo === 'confirmó') return n > 1 ? `${quien} confirmaron (${personas} personas) 🎉` : `${quien} confirmó su asistencia (${personas} ${personas === 1 ? 'persona' : 'personas'}) 🎉`
    return n > 1 ? `${quien} no podrán asistir` : `${quien} no podrá asistir`
  }
  const cuantas = n > 1 ? `${n} ideas` : 'una idea'
  if (a.verbo === 'pide tu opinión sobre') return a.actor === yo ? `Le pediste a ${otro(yo)} su opinión sobre ${cuantas}` : `${quien} quiere saber si te gusta ${cuantas}`
  if (a.verbo === 'opinó sobre') return a.actor === yo ? `Diste tu opinión sobre ${cuantas}` : `${quien} te dio su opinión sobre ${cuantas}`
  const [uno, varios] = NOMBRES[a.tipo] || ['algo', 'cosas']
  return `${quien} ${a.verbo} ${n > 1 ? `${n} ${varios}` : uno}`
}

function cuando(iso) {
  const d = new Date(iso)
  const min = Math.round((Date.now() - d) / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const hora = d.toLocaleTimeString('es-SV', { hour: 'numeric', minute: '2-digit' })
  if (d >= hoy) return `hoy ${hora}`
  if (d >= new Date(hoy.getTime() - 86400000)) return `ayer ${hora}`
  return d.toLocaleDateString('es-SV', { day: 'numeric', month: 'short' }) + ` ${hora}`
}

export default function Avisos({ ir }) {
  const d = useDatos()
  // Guardamos lo que ya había visto para resaltar lo nuevo mientras está en esta pantalla
  const vistoAntes = useRef(d.actividad_vista.find((v) => v.nombre === d.yo)?.visto_hasta || '1970-01-01')
  const [verMas, setVerMas] = useState(25)

  useEffect(() => {
    const marcar = () => supabase.from('actividad_vista')
      .upsert({ nombre: d.yo, visto_hasta: new Date().toISOString() })
      .then(() => d.recargar('actividad_vista'))
    marcar()
    return () => { marcar() }
  }, []) // eslint-disable-line

  const pendientes = d.ideas.filter((i) => i.opinion_de === d.yo)
  const lista = d.actividad

  const responder = (idea, gusta) => d.editar('ideas', idea.id, {
    [d.yo === 'Alicia' ? 'gusta_alicia' : 'gusta_harold']: gusta, opinion_de: null,
  })

  return (
    <div className="pagina">
      <h1 className="titulo">Avisos</h1>

      {pendientes.length > 0 && (
        <section className="tarjeta opinion">
          <h3>{otro(d.yo)} quiere saber si te gusta 💭</h3>
          {pendientes.map((i) => (
            <div key={i.id} className="opinion-item">
              {(i.imagen_path || i.imagen_url) && <Img path={i.imagen_path} url={i.imagen_url} alt={i.titulo} className="opinion-img" />}
              <div className="opinion-cuerpo">
                <b>{i.titulo}</b>
                {i.notas && <span className="meta">{i.notas}</span>}
                <div className="acciones">
                  <button className="btn" onClick={() => responder(i, true)}>❤️ Me gusta</button>
                  <button className="btn secundario" onClick={() => responder(i, false)}>🤔 No me convence</button>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {lista.length === 0 && pendientes.length === 0 && (
        <Vacio emoji="🔔" texto="Aquí verán lo que cada uno va haciendo: ideas, pagos, tareas, invitados y respuestas a la invitación." />
      )}

      <ul className="avisos">
        {lista.slice(0, verMas).map((a) => {
          const nuevo = a.actor !== d.yo && a.updated_at > vistoAntes.current
          const destino = { tarea: 'tareas', idea: 'ideas', pago: 'dinero', ahorro: 'dinero', proveedor: 'dinero', presupuesto: 'dinero', invitado: 'invitados', ajustes: a.items.includes('la foto de portada') ? 'inicio' : 'invitados' }[a.tipo]
          return (
            <li key={a.id}>
              <button className={`aviso-item ${nuevo ? 'nuevo' : ''} ${a.actor === d.yo ? 'mio' : ''}`} onClick={() => destino && ir(destino)}>
                <span className="aviso-icono">{ICONOS[a.tipo] || '✨'}</span>
                <div>
                  <p>{frase(a, d.yo)}</p>
                  {a.items.length > 0 && a.actor !== 'Invitado' && a.tipo !== 'ajustes' && (
                    <span className="meta">{a.items.slice(0, 6).join(' · ')}{a.items.length > 6 ? ` y ${a.items.length - 6} más` : ''}</span>
                  )}
                  {a.actor === 'Invitado' && a.items.length > 1 && (
                    <span className="meta">{a.items.slice(0, 6).join(' · ')}{a.items.length > 6 ? ` y ${a.items.length - 6} más` : ''}</span>
                  )}
                  <small>{cuando(a.updated_at)}</small>
                </div>
                {nuevo && <span className="punto-nuevo" />}
              </button>
            </li>
          )
        })}
      </ul>
      {lista.length > verMas && <button className="btn secundario" onClick={() => setVerMas(verMas + 25)}>Ver anteriores</button>}
      <p className="ayuda centro-texto">Las acciones parecidas de la misma persona se juntan en un solo aviso (hasta 30 minutos).</p>
    </div>
  )
}
