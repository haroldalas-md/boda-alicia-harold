import { useState } from 'react'
import { useDatos } from '../lib/data'
import { supabase } from '../lib/supabase'
import { subirArchivo } from '../lib/files'
import { ESTADOS_IDEA } from '../lib/format'
import { Campo, Chips, Fab, Img, SelectCategoria, Sheet, Vacio } from '../components/ui'

export default function Ideas() {
  const d = useDatos()
  const [filtro, setFiltro] = useState('activas')
  const [cat, setCat] = useState('todas')
  const [nueva, setNueva] = useState(false)
  const [abierta, setAbierta] = useState(null)

  const lista = d.ideas.filter((i) => {
    if (filtro === 'activas' && i.estado === 'descartada') return false
    if (filtro !== 'activas' && filtro !== 'todas' && i.estado !== filtro) return false
    if (cat !== 'todas' && i.categoria_id !== cat) return false
    return true
  })
  const catsUsadas = d.categorias.filter((c) => d.ideas.some((i) => i.categoria_id === c.id))
  const idea = abierta && d.ideas.find((i) => i.id === abierta)

  return (
    <div className="pagina">
      <h1 className="titulo">Ideas</h1>
      <Chips valor={filtro} onCambio={setFiltro} opciones={[
        { valor: 'activas', label: 'Todas' },
        { valor: 'por_evaluar', label: 'Por evaluar' },
        { valor: 'la_queremos', label: '💙 La queremos' },
        { valor: 'descartada', label: 'Descartadas' },
      ]} />
      {catsUsadas.length > 0 && (
        <Chips valor={cat} onCambio={setCat} opciones={[
          { valor: 'todas', label: 'Todas las categorías' },
          ...catsUsadas.map((c) => ({ valor: c.id, label: `${c.emoji} ${c.nombre}` })),
        ]} />
      )}

      {lista.length === 0 ? (
        <Vacio emoji="📌" texto="Aún no hay ideas aquí. Toca ＋ y pega un link de Pinterest." />
      ) : (
        <div className="muro">
          {lista.map((i) => (
            <button key={i.id} className={`pin ${i.estado}`} onClick={() => setAbierta(i.id)}>
              {(i.imagen_path || i.imagen_url)
                ? <Img path={i.imagen_path} url={i.imagen_url} alt={i.titulo} />
                : <div className="pin-texto">{d.catPorId[i.categoria_id]?.emoji || '✨'}</div>}
              <div className="pin-pie">
                <span>{i.titulo}</span>
                <span className="corazones">
                  {i.gusta_alicia && <i title="Alicia">💗</i>}
                  {i.gusta_harold && <i title="Harold">💙</i>}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <Fab onClick={() => setNueva(true)} label="Nueva idea" />
      <NuevaIdea abierto={nueva} onCerrar={() => setNueva(false)} />
      {idea && <DetalleIdea idea={idea} onCerrar={() => setAbierta(null)} />}
    </div>
  )
}

function NuevaIdea({ abierto, onCerrar }) {
  const d = useDatos()
  const [enlace, setEnlace] = useState('')
  const [titulo, setTitulo] = useState('')
  const [categoria, setCategoria] = useState(null)
  const [imagen, setImagen] = useState(null) // { path } o { file, preview }
  const [estado, setEstado] = useState(null)
  const [pedir, setPedir] = useState(true)
  const otro = d.yo === 'Alicia' ? 'Harold' : 'Alicia'

  const limpiar = () => { setEnlace(''); setTitulo(''); setCategoria(null); setImagen(null); setEstado(null); setPedir(true) }
  const cerrar = () => { limpiar(); onCerrar() }

  async function traer(url) {
    if (!url) return
    setEstado({ t: 'Buscando la imagen…' })
    const { data, error } = await supabase.functions.invoke('pin-preview', { body: { url } })
    if (error || data?.error) {
      let m = data?.error
      try { m = m || (await error.context.json()).error } catch { /* */ }
      setEstado({ error: true, t: m || 'No pude leer ese link. Sube una captura de pantalla.' })
      return
    }
    setImagen({ path: data.path })
    if (data.enlace) setEnlace(data.enlace)
    if (!titulo && data.title) setTitulo(data.title.slice(0, 80))
    setEstado(null)
  }

  async function pegar() {
    try {
      const t = (await navigator.clipboard.readText()).trim()
      const url = t.match(/https?:\/\/\S+/)?.[0]
      if (!url) { setEstado({ error: true, t: 'No hay un link copiado. En Pinterest toca Compartir → Copiar enlace.' }); return }
      setEnlace(url)
      traer(url)
    } catch {
      setEstado({ error: true, t: 'Pega el link en el cuadro de abajo.' })
    }
  }

  function elegirFoto(e) {
    const file = e.target.files?.[0]
    if (file) setImagen({ file, preview: URL.createObjectURL(file) })
  }

  async function guardar() {
    try {
      setEstado({ t: 'Guardando…' })
      let imagen_path = imagen?.path || null
      if (imagen?.file) imagen_path = await subirArchivo(imagen.file, 'ideas')
      await d.crear('ideas', {
        titulo: titulo.trim() || 'Idea sin nombre',
        enlace: enlace || null,
        imagen_path,
        categoria_id: categoria,
        creada_por: d.yo,
        opinion_de: pedir ? otro : null,
        [d.yo === 'Alicia' ? 'gusta_alicia' : 'gusta_harold']: true,
      })
      cerrar()
    } catch (e) {
      setEstado({ error: true, t: e.message })
    }
  }

  return (
    <Sheet abierto={abierto} onCerrar={cerrar} titulo="Nueva idea">
      <button className="btn grande" onClick={pegar}>📋 Pegar link de Pinterest</button>
      <p className="ayuda">En Pinterest: toca <b>Compartir</b> → <b>Copiar enlace</b> y luego este botón.</p>

      <Campo label="…o escribe el link">
        <input type="url" inputMode="url" placeholder="https://pin.it/…" value={enlace}
          onChange={(e) => setEnlace(e.target.value)} onBlur={() => enlace && !imagen && traer(enlace)} />
      </Campo>

      <label className="btn secundario">
        📷 Subir foto o captura
        <input type="file" accept="image/*" hidden onChange={elegirFoto} />
      </label>

      {imagen && (
        <div className="vista-previa">
          {imagen.preview ? <img src={imagen.preview} alt="" /> : <Img path={imagen.path} />}
        </div>
      )}
      {estado && <div className={`aviso ${estado.error ? 'error' : ''}`}>{estado.t}</div>}

      <Campo label="¿Qué es?">
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. Bar de café" />
      </Campo>
      <Campo label="Categoría">
        <SelectCategoria categorias={d.categorias} valor={categoria} onCambio={setCategoria} />
      </Campo>
      <label className="interruptor">
        <input type="checkbox" checked={pedir} onChange={(e) => setPedir(e.target.checked)} /> Pedirle a {otro} que me diga si le gusta
      </label>
      <button className="btn grande" onClick={guardar} disabled={estado?.t === 'Guardando…'}>Guardar idea</button>
    </Sheet>
  )
}

function DetalleIdea({ idea, onCerrar }) {
  const d = useDatos()
  const [notas, setNotas] = useState(idea.notas || '')
  const [msg, setMsg] = useState(null)
  const miCampo = d.yo === 'Alicia' ? 'gusta_alicia' : 'gusta_harold'
  const tarea = d.tareas.find((t) => t.idea_id === idea.id)

  async function convertir() {
    await d.crear('tareas', {
      titulo: idea.titulo, categoria_id: idea.categoria_id, idea_id: idea.id,
      responsable: 'Juntos', tipo: 'hacer', notas: idea.enlace || null,
    })
    if (idea.estado !== 'la_queremos') await d.editar('ideas', idea.id, { estado: 'la_queremos' })
    setMsg('Listo, ya está en Tareas.')
  }

  async function borrar() {
    if (!confirm('¿Borrar esta idea?')) return
    if (idea.imagen_path) await supabase.storage.from('boda').remove([idea.imagen_path])
    await d.borrar('ideas', idea.id)
    onCerrar()
  }

  return (
    <Sheet abierto onCerrar={onCerrar} titulo={idea.titulo}>
      {(idea.imagen_path || idea.imagen_url) && (
        <div className="vista-previa grande"><Img path={idea.imagen_path} url={idea.imagen_url} alt={idea.titulo} /></div>
      )}
      <div className="corazones-grandes">
        <button className={idea.gusta_alicia ? 'on' : ''} disabled={d.yo !== 'Alicia'}
          onClick={() => d.editar('ideas', idea.id, { gusta_alicia: !idea.gusta_alicia })}>💗 Alicia</button>
        <button className={idea.gusta_harold ? 'on' : ''} disabled={d.yo !== 'Harold'}
          onClick={() => d.editar('ideas', idea.id, { gusta_harold: !idea.gusta_harold })}>💙 Harold</button>
      </div>
      <p className="ayuda centro-texto">Toca tu corazón si te gusta ({d.yo}).</p>
      {idea.opinion_de === d.yo && (
        <div className="acciones">
          <button className="btn" onClick={() => d.editar('ideas', idea.id, { [miCampo]: true, opinion_de: null })}>❤️ Me gusta</button>
          <button className="btn secundario" onClick={() => d.editar('ideas', idea.id, { [miCampo]: false, opinion_de: null })}>🤔 No me convence</button>
        </div>
      )}
      {idea.opinion_de && idea.opinion_de !== d.yo && <p className="aviso">Esperando la opinión de {idea.opinion_de} 💭</p>}
      {!idea.opinion_de && (
        <button className="enlace" onClick={() => d.editar('ideas', idea.id, { opinion_de: d.yo === 'Alicia' ? 'Harold' : 'Alicia' })}>
          💭 Pedirle a {d.yo === 'Alicia' ? 'Harold' : 'Alicia'} su opinión
        </button>
      )}

      <Chips valor={idea.estado} onCambio={(v) => d.editar('ideas', idea.id, { estado: v })}
        opciones={Object.entries(ESTADOS_IDEA).map(([valor, e]) => ({ valor, label: e.label }))} />

      <Campo label="Categoría">
        <SelectCategoria categorias={d.categorias} valor={idea.categoria_id}
          onCambio={(v) => d.editar('ideas', idea.id, { categoria_id: v })} />
      </Campo>
      <Campo label="Notas">
        <textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)}
          onBlur={() => notas !== (idea.notas || '') && d.editar('ideas', idea.id, { notas })} placeholder="Precio, proveedor, colores…" />
      </Campo>

      {idea.enlace && <a className="btn secundario" href={idea.enlace} target="_blank" rel="noreferrer">Abrir el original ↗</a>}
      {tarea
        ? <p className="aviso">✅ Ya es una tarea: “{tarea.titulo}”{tarea.hecha ? ' (hecha)' : ''}</p>
        : <button className="btn" onClick={convertir}>➜ Convertir en tarea</button>}
      {msg && <div className="aviso">{msg}</div>}
      <button className="enlace rojo" onClick={borrar}>Borrar idea</button>
    </Sheet>
  )
}
