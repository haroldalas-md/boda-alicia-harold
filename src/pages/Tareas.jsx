import { useState } from 'react'
import { useDatos } from '../lib/data'
import { TIPOS, fechaCorta, hoyISO, nombreMes } from '../lib/format'
import { Barra, Campo, Chips, Fab, Img, SelectCategoria, Sheet, Vacio } from '../components/ui'

function agrupar(tareas) {
  const hoy = hoyISO()
  const grupos = new Map()
  for (const t of tareas) {
    let clave, titulo
    if (t.hecha) { clave = 'z-hechas'; titulo = 'Hechas ✅' }
    else if (!t.fecha_limite) { clave = 'y-sin'; titulo = 'Sin fecha' }
    else if (t.fecha_limite < hoy) { clave = '0-atrasadas'; titulo = 'Atrasadas' }
    else { clave = t.fecha_limite.slice(0, 7); titulo = nombreMes(t.fecha_limite) }
    if (!grupos.has(clave)) grupos.set(clave, { titulo, items: [] })
    grupos.get(clave).items.push(t)
  }
  return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, g]) => g)
}

export default function Tareas() {
  const d = useDatos()
  const [quien, setQuien] = useState('todas')
  const [verHechas, setVerHechas] = useState(false)
  const [editando, setEditando] = useState(null) // id | 'nueva'

  const filtradas = d.tareas.filter((t) => {
    if (!verHechas && t.hecha) return false
    if (quien === 'todas') return true
    if (quien === 'mias') return t.responsable === d.yo || t.responsable === 'Juntos'
    return t.responsable === quien
  })
  const hechas = d.tareas.filter((t) => t.hecha).length
  const hoy = hoyISO()

  const marcar = (t) => d.editar('tareas', t.id, { hecha: !t.hecha, hecha_en: t.hecha ? null : hoy })

  return (
    <div className="pagina">
      <h1 className="titulo">Tareas</h1>
      <div className="tarjeta compacta">
        <div className="fila-entre"><span>{hechas} de {d.tareas.length} hechas</span><b>{Math.round((hechas / Math.max(1, d.tareas.length)) * 100)}%</b></div>
        <Barra valor={hechas} total={d.tareas.length} />
      </div>
      <Chips valor={quien} onCambio={setQuien} opciones={[
        { valor: 'todas', label: 'Todas' },
        { valor: 'mias', label: 'Las mías' },
        { valor: 'Alicia', label: '👰 Alicia' },
        { valor: 'Harold', label: '🤵 Harold' },
        { valor: 'Juntos', label: '💑 Juntos' },
      ]} />
      <label className="interruptor">
        <input type="checkbox" checked={verHechas} onChange={(e) => setVerHechas(e.target.checked)} /> Mostrar hechas
      </label>

      {filtradas.length === 0 && <Vacio emoji="🎉" texto="Nada pendiente aquí." />}
      {agrupar(filtradas).map((g) => (
        <section key={g.titulo} className="grupo">
          <h3 className={g.titulo === 'Atrasadas' ? 'rojo' : ''}>{g.titulo} <small>{g.items.length}</small></h3>
          <ul className="lista">
            {g.items.map((t) => {
              const cat = d.catPorId[t.categoria_id]
              return (
                <li key={t.id} className={`tarea ${t.hecha ? 'hecha' : ''}`}>
                  <button className={`check ${t.hecha ? 'on' : ''}`} onClick={() => marcar(t)} aria-label="Marcar como hecha">
                    {t.hecha ? '✓' : ''}
                  </button>
                  <button className="tarea-texto" onClick={() => setEditando(t.id)}>
                    <span className="t">{t.titulo}</span>
                    <span className="meta">
                      {TIPOS[t.tipo]?.emoji} {cat ? `${cat.emoji} ${cat.nombre}` : ''}
                      {t.responsable !== 'Juntos' && <> · {t.responsable}</>}
                    </span>
                  </button>
                  {t.fecha_limite && !t.hecha && <span className={`fecha ${t.fecha_limite < hoy ? 'rojo' : ''}`}>{fechaCorta(t.fecha_limite)}</span>}
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <Fab onClick={() => setEditando('nueva')} label="Nueva tarea" />
      {editando && <EditarTarea id={editando} onCerrar={() => setEditando(null)} />}
    </div>
  )
}

function EditarTarea({ id, onCerrar }) {
  const d = useDatos()
  const original = id === 'nueva' ? null : d.tareas.find((t) => t.id === id)
  const [f, setF] = useState(() => original || {
    titulo: '', responsable: d.yo, tipo: 'hacer', categoria_id: null, fecha_limite: null, notas: '',
  })
  const [error, setError] = useState(null)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  const idea = original?.idea_id && d.ideas.find((i) => i.id === original.idea_id)

  async function guardar() {
    if (!f.titulo.trim()) { setError('Escribe qué hay que hacer'); return }
    const fila = {
      titulo: f.titulo.trim(), responsable: f.responsable, tipo: f.tipo,
      categoria_id: f.categoria_id, fecha_limite: f.fecha_limite || null, notas: f.notas || null,
    }
    try {
      if (original) await d.editar('tareas', original.id, fila)
      else await d.crear('tareas', fila)
      onCerrar()
    } catch (e) { setError(e.message) }
  }

  async function borrar() {
    if (!confirm('¿Borrar esta tarea?')) return
    await d.borrar('tareas', original.id)
    onCerrar()
  }

  return (
    <Sheet abierto onCerrar={onCerrar} titulo={original ? 'Editar tarea' : 'Nueva tarea'}>
      {idea && (idea.imagen_path || idea.imagen_url) && (
        <div className="vista-previa"><Img path={idea.imagen_path} url={idea.imagen_url} /></div>
      )}
      <Campo label="¿Qué hay que hacer?">
        <input value={f.titulo} onChange={(e) => set('titulo')(e.target.value)} autoFocus={!original} />
      </Campo>
      <Campo label="¿Quién?">
        <Chips valor={f.responsable} onCambio={set('responsable')} opciones={[
          { valor: 'Alicia', label: '👰 Alicia' }, { valor: 'Harold', label: '🤵 Harold' }, { valor: 'Juntos', label: '💑 Juntos' },
        ]} />
      </Campo>
      <Campo label="Tipo">
        <Chips valor={f.tipo} onCambio={set('tipo')}
          opciones={Object.entries(TIPOS).map(([valor, t]) => ({ valor, label: `${t.emoji} ${t.label}` }))} />
      </Campo>
      <Campo label="Fecha límite">
        <input type="date" value={f.fecha_limite || ''} onChange={(e) => set('fecha_limite')(e.target.value)} />
      </Campo>
      <Campo label="Categoría">
        <SelectCategoria categorias={d.categorias} valor={f.categoria_id} onCambio={set('categoria_id')} />
      </Campo>
      <Campo label="Notas">
        <textarea rows={3} value={f.notas || ''} onChange={(e) => set('notas')(e.target.value)} />
      </Campo>
      {error && <div className="aviso error">{error}</div>}
      <button className="btn grande" onClick={guardar}>Guardar</button>
      {original && <button className="enlace rojo" onClick={borrar}>Borrar tarea</button>}
    </Sheet>
  )
}
