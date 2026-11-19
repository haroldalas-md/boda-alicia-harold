import { useState } from 'react'
import { useDatos } from '../lib/data'
import { Campo, Chips, Fab, Sheet, Vacio } from '../components/ui'

const IMPORTANCIAS = ['Imprescindible', 'Prescindible', 'Opcional']

export default function Invitados() {
  const d = useDatos()
  const [lado, setLado] = useState('todos')
  const [imp, setImp] = useState('todas')
  const [buscar, setBuscar] = useState('')
  const [editando, setEditando] = useState(null)

  const personas = (lista) => lista.reduce((s, i) => s + i.adultos + i.ninos, 0)
  const todos = d.invitados
  const lista = todos.filter((i) =>
    (lado === 'todos' || i.lado === lado) &&
    (imp === 'todas' || i.importancia === imp) &&
    (!buscar || i.nombre.toLowerCase().includes(buscar.toLowerCase())))

  const conf = todos.filter((i) => i.rsvp === 'Confirmado')

  return (
    <div className="pagina">
      <h1 className="titulo">Invitados</h1>
      <div className="grid-stats">
        <div className="stat azul"><span>Personas en la lista</span><b>{personas(todos)}</b></div>
        <div className="stat"><span>Grupos</span><b>{todos.length}</b></div>
        <div className="stat"><span>Confirmados</span><b>{personas(conf)}</b></div>
        <div className="stat"><span>Invitaciones enviadas</span><b>{todos.filter((i) => i.invitacion_enviada).length}</b></div>
      </div>
      <div className="tarjeta compacta">
        {IMPORTANCIAS.map((n) => {
          const g = todos.filter((i) => i.importancia === n)
          return <div key={n} className="fila-entre"><span>{n}s</span><b>{personas(g)} personas</b></div>
        })}
        <p className="ayuda">Si quitan a los prescindibles quedan {personas(todos.filter((i) => i.importancia !== 'Prescindible'))} personas.</p>
      </div>

      <input className="buscador" placeholder="Buscar por nombre…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
      <Chips valor={lado} onCambio={setLado} opciones={[
        { valor: 'todos', label: 'Todos' }, { valor: 'Alicia', label: '👰 De Alicia' }, { valor: 'Harold', label: '🤵 De Harold' }, { valor: 'Ambos', label: '💑 De ambos' },
      ]} />
      <Chips valor={imp} onCambio={setImp} opciones={[{ valor: 'todas', label: 'Toda importancia' }, ...IMPORTANCIAS.map((n) => ({ valor: n, label: n }))]} />

      <p className="ayuda">{lista.length} grupos · {personas(lista)} personas</p>
      {lista.length === 0 && <Vacio emoji="👥" texto="Nadie con esos filtros." />}
      <ul className="lista">
        {lista.map((i) => (
          <li key={i.id}>
            <button className="invitado" onClick={() => setEditando(i.id)}>
              <div>
                <b>{i.nombre}</b>
                <div className="meta">{i.lado} · {i.importancia} · {i.adultos + i.ninos} {i.adultos + i.ninos === 1 ? 'persona' : 'personas'}{i.ninos ? ` (${i.ninos} niño${i.ninos > 1 ? 's' : ''})` : ''}</div>
              </div>
              <span className={`pill ${i.rsvp === 'Confirmado' ? 'verde' : i.rsvp === 'No asiste' ? 'rojo' : ''}`}>{i.rsvp}</span>
            </button>
          </li>
        ))}
      </ul>
      <Fab onClick={() => setEditando('nuevo')} label="Nuevo invitado" />
      {editando && <EditarInvitado id={editando} onCerrar={() => setEditando(null)} />}
    </div>
  )
}

function EditarInvitado({ id, onCerrar }) {
  const d = useDatos()
  const original = id === 'nuevo' ? null : d.invitados.find((i) => i.id === id)
  const [f, setF] = useState(() => original || {
    nombre: '', lado: d.yo, importancia: 'Imprescindible', adultos: 1, ninos: 0, rsvp: 'Pendiente', restriccion: '', mesa: '', invitacion_enviada: false, notas: '',
  })
  const [error, setError] = useState(null)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))

  async function guardar() {
    if (!f.nombre.trim()) return setError('Escribe el nombre')
    const fila = {
      nombre: f.nombre.trim(), lado: f.lado, importancia: f.importancia,
      adultos: Number(f.adultos) || 0, ninos: Number(f.ninos) || 0, rsvp: f.rsvp,
      restriccion: f.restriccion || null, mesa: f.mesa || null, invitacion_enviada: f.invitacion_enviada, notas: f.notas || null,
    }
    try {
      if (original) await d.editar('invitados', original.id, fila)
      else await d.crear('invitados', fila)
      onCerrar()
    } catch (e) { setError(e.message) }
  }

  return (
    <Sheet abierto onCerrar={onCerrar} titulo={original ? original.nombre : 'Nuevo invitado'}>
      <Campo label="Nombre (persona o familia)"><input value={f.nombre} onChange={(e) => set('nombre')(e.target.value)} /></Campo>
      <Campo label="Invitado de">
        <Chips valor={f.lado} onCambio={set('lado')} opciones={['Alicia', 'Harold', 'Ambos'].map((v) => ({ valor: v, label: v }))} />
      </Campo>
      <Campo label="Importancia">
        <Chips valor={f.importancia} onCambio={set('importancia')} opciones={IMPORTANCIAS.map((v) => ({ valor: v, label: v }))} />
      </Campo>
      <div className="dos-col">
        <Campo label="Adultos"><input type="number" inputMode="numeric" min="0" value={f.adultos} onChange={(e) => set('adultos')(e.target.value)} /></Campo>
        <Campo label="Niños"><input type="number" inputMode="numeric" min="0" value={f.ninos} onChange={(e) => set('ninos')(e.target.value)} /></Campo>
      </div>
      <Campo label="Confirmación">
        <Chips valor={f.rsvp} onCambio={set('rsvp')} opciones={['Pendiente', 'Confirmado', 'No asiste'].map((v) => ({ valor: v, label: v }))} />
      </Campo>
      <label className="interruptor">
        <input type="checkbox" checked={f.invitacion_enviada} onChange={(e) => set('invitacion_enviada')(e.target.checked)} /> Invitación enviada
      </label>
      <Campo label="Restricción alimentaria"><input value={f.restriccion || ''} onChange={(e) => set('restriccion')(e.target.value)} /></Campo>
      <Campo label="Mesa"><input value={f.mesa || ''} onChange={(e) => set('mesa')(e.target.value)} /></Campo>
      <Campo label="Notas"><textarea rows={2} value={f.notas || ''} onChange={(e) => set('notas')(e.target.value)} /></Campo>
      {error && <div className="aviso error">{error}</div>}
      <button className="btn grande" onClick={guardar}>Guardar</button>
      {original && <button className="enlace rojo" onClick={async () => {
        if (!confirm('¿Quitar de la lista?')) return
        await d.borrar('invitados', original.id); onCerrar()
      }}>Quitar de la lista</button>}
    </Sheet>
  )
}
