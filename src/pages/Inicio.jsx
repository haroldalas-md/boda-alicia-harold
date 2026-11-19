import { useDatos, resumenDinero } from '../lib/data'
import { FECHA_BODA, diasHasta, dinero, fechaCorta, hoyISO, mesesHasta } from '../lib/format'
import { Barra, Img } from '../components/ui'
import { supabase } from '../lib/supabase'

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
  const meta = r.falta > r.saldoAhorro ? (r.falta - r.saldoAhorro) / mesesHasta(r.proximo?.fecha_limite) : 0
  const nuevas = d.ideas.filter((i) => i.estado === 'por_evaluar').slice(0, 6)

  return (
    <div className="pagina">
      <header className="hero">
        <p className="saludo">Hola, {d.yo} 💙</p>
        <div className="cuenta">
          <span className="num">{dias}</span>
          <span>días para el sí</span>
        </div>
        <p className="sub">24 de abril de 2027 · Casa Ávila, El Boquerón</p>
      </header>

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
        {meta > 0 && <p className="detalle">Meta de ahorro: <b>{dinero(Math.ceil(meta))} al mes</b></p>}
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
