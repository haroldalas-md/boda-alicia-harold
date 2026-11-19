import { useDatos, resumenDinero } from '../lib/data'
import { FECHA_BODA, diasHasta, dinero, fechaCorta, hoyISO } from '../lib/format'
import { versiculoDeHoy, mensajeParaAlicia } from '../lib/versiculos'
import { useEffect, useState } from 'react'
import { Barra, Img } from '../components/ui'
import { supabase } from '../lib/supabase'
import { subirArchivo } from '../lib/files'

function Portada() {
  const [path, setPath] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  useEffect(() => {
    supabase.from('ajustes').select('valor').eq('clave', 'portada').maybeSingle()
      .then(({ data }) => { setPath(data?.valor || null); setCargando(false) })
  }, [])
  async function cambiar(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendo(true)
    try {
      const nuevo = await subirArchivo(file, 'portada')
      await supabase.from('ajustes').upsert({ clave: 'portada', valor: nuevo, updated_at: new Date().toISOString() })
      if (path) await supabase.storage.from('boda').remove([path])
      setPath(nuevo)
    } catch (err) { alert('No se pudo subir la foto: ' + err.message) }
    setSubiendo(false)
  }
  if (cargando) return <div className="portada vacia" />
  return (
    <div className={`portada ${path ? '' : 'vacia'}`}>
      {path && <Img path={path} alt="Alicia y Harold" />}
      <label className="portada-boton">
        {subiendo ? 'Subiendo…' : path ? '📷' : '📷 Agregar foto de portada'}
        <input type="file" accept="image/*" hidden onChange={cambiar} />
      </label>
    </div>
  )
}

function Versiculo({ yo }) {
  const [v] = useState(versiculoDeHoy)
  const [amor] = useState(mensajeParaAlicia)
  return (
    <section className="tarjeta versiculo">
      <p className="v-texto">“{v.texto}”</p>
      <p className="v-cita">{v.cita}</p>
      {yo === 'Alicia' && (
        <div className="v-amor">
          <p>{amor}</p>
          <span>— Harold 💙</span>
        </div>
      )}
    </section>
  )
}

function ParaAlicia({ d, ir }) {
  const hoy = hoyISO()
  const suyas = d.tareas.filter((t) => !t.hecha && (t.responsable === 'Alicia' || t.responsable === 'Juntos'))
  const proximas = suyas.slice(0, 3)
  const listas = d.tareas.filter((t) => t.hecha).length
  return (
    <section className="tarjeta suave" onClick={() => ir('tareas')}>
      <h3>Pasitos hacia el 24 de abril 🌸</h3>
      <p className="detalle">No tienes que acordarte de todo: aquí te lo guardo yo. Esto es lo que viene, y lo hacemos juntos.</p>
      <ul className="pasitos">
        {proximas.map((t) => (
          <li key={t.id}>
            <span className="punto" />
            <div>
              <span>{t.titulo}</span>
              <small>{t.responsable === 'Juntos' ? 'con Harold' : 'para ti'}{t.fecha_limite ? ` · ${t.fecha_limite < hoy ? 'cuando puedas' : `antes del ${fechaCorta(t.fecha_limite)}`}` : ''}</small>
            </div>
          </li>
        ))}
      </ul>
      {listas > 0 && <p className="detalle">Ya llevamos <b>{listas} {listas === 1 ? "cosa lista" : "cosas listas"}</b> ✨ Vamos muy bien.</p>}
      <span className="enlace">Ver todo con calma →</span>
    </section>
  )
}

export default function Inicio({ ir }) {
  const d = useDatos()
  const dias = diasHasta(FECHA_BODA)
  const hechas = d.tareas.filter((t) => t.hecha).length
  const total = d.tareas.length
  const hoy = hoyISO()
  const proximas = d.tareas.filter((t) => !t.hecha).slice(0, 5)
  const atrasadas = d.tareas.filter((t) => !t.hecha && t.fecha_limite && t.fecha_limite < hoy).length
  const mias = d.tareas.filter((t) => !t.hecha && (t.responsable === d.yo || t.responsable === 'Juntos')).length
  const r = resumenDinero(d)
  const nuevas = d.ideas.filter((i) => i.estado === 'por_evaluar').slice(0, 6)

  return (
    <div className="pagina">
      <header className="hero">
        <Portada />
        <p className="saludo">Hola, {d.yo} 💙</p>
        <div className="cuenta">
          <span className="num">{dias}</span>
          <span>días para el sí</span>
        </div>
        <p className="sub">24 de abril de 2027 · Casa Ávila, El Boquerón</p>
      </header>

      <Versiculo yo={d.yo} />

      {d.yo === 'Alicia' ? <ParaAlicia d={d} ir={ir} /> : (
        <section className="tarjeta" onClick={() => ir('tareas')}>
          <div className="fila-entre">
            <h3>Tareas</h3>
            <span className="pill">{hechas}/{total}</span>
          </div>
          <Barra valor={hechas} total={total} />
          <p className="detalle">
            Te tocan {mias} pendientes{atrasadas > 0 && <> · <b className="rojo">{atrasadas} atrasadas</b></>}
          </p>
          <ul className="mini-lista">
            {proximas.map((t) => (
              <li key={t.id}>
                <span>{t.titulo}</span>
                <span className={`fecha ${t.fecha_limite && t.fecha_limite < hoy ? 'rojo' : ''}`}>{fechaCorta(t.fecha_limite)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="tarjeta" onClick={() => ir('dinero')}>
        <h3>Dinero</h3>
        <div className="stats">
          <div><span className="et">Ahorro</span><b>{dinero(r.saldoAhorro)}</b></div>
          <div><span className="et">Pagado</span><b>{dinero(r.pagado)}</b></div>
          <div><span className="et">Falta</span><b>{dinero(r.falta)}</b></div>
        </div>
        <Barra valor={r.pagado} total={r.comprometido} />
        {r.proximo && (
          <p className="detalle">Próximo: <b>{r.proximo.concepto}</b> · {dinero(r.proximo.falta)} antes del {fechaCorta(r.proximo.fecha_limite)}</p>
        )}
      </section>

      <section className="tarjeta" onClick={() => ir('ideas')}>
        <div className="fila-entre">
          <h3>Ideas por evaluar</h3>
          <span className="pill">{d.ideas.filter((i) => i.estado === 'por_evaluar').length}</span>
        </div>
        {nuevas.length ? (
          <div className="tira">
            {nuevas.map((i) => <Img key={i.id} path={i.imagen_path} url={i.imagen_url} alt={i.titulo} className="tira-img" />)}
          </div>
        ) : <p className="detalle">No hay ideas nuevas. ¡Agreguen una desde Pinterest!</p>}
      </section>

      <button className="enlace salir" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
    </div>
  )
}
