import { useState } from 'react'
import { useDatos, resumenDinero } from '../lib/data'
import { dinero, fechaCorta, fechaLarga, hoyISO, mesesHasta } from '../lib/format'
import { subirArchivo, urlFirmada } from '../lib/files'
import { Barra, Campo, Chips, SelectCategoria, Sheet, Vacio } from '../components/ui'

export default function Dinero() {
  const d = useDatos()
  const r = resumenDinero(d)
  const [vista, setVista] = useState('resumen')
  const [hoja, setHoja] = useState(null) // {tipo:'pago'|'ahorro'|'proveedor', ...}

  return (
    <div className="pagina">
      <h1 className="titulo">Dinero</h1>
      <Chips valor={vista} onCambio={setVista} opciones={[
        { valor: 'resumen', label: 'Resumen' },
        { valor: 'proveedores', label: 'Proveedores' },
        { valor: 'presupuesto', label: 'Presupuesto' },
        { valor: 'ahorro', label: 'Ahorro' },
      ]} />

      <div className="acciones">
        <button className="btn" onClick={() => setHoja({ tipo: 'pago' })}>＋ Pago</button>
        <button className="btn secundario" onClick={() => setHoja({ tipo: 'ahorro', mov: 'abono' })}>＋ Abono</button>
      </div>

      {vista === 'resumen' && <Resumen r={r} />}
      {vista === 'proveedores' && <Proveedores r={r} abrir={(p) => setHoja({ tipo: 'proveedor', id: p?.id })} />}
      {vista === 'presupuesto' && <Presupuesto r={r} />}
      {vista === 'ahorro' && <Ahorro r={r} abrir={(mov) => setHoja({ tipo: 'ahorro', mov })} />}

      {hoja?.tipo === 'pago' && <NuevoPago proveedorId={hoja.proveedorId} saldo={r.saldoAhorro} onCerrar={() => setHoja(null)} />}
      {hoja?.tipo === 'ahorro' && <MovAhorro tipo={hoja.mov} onCerrar={() => setHoja(null)} />}
      {hoja?.tipo === 'proveedor' && (
        <EditarProveedor id={hoja.id} onCerrar={() => setHoja(null)}
          onPagar={(id) => setHoja({ tipo: 'pago', proveedorId: id })} />
      )}
    </div>
  )
}

function Dona({ partes, total, centro, sub }) {
  const R = 70, C = 2 * Math.PI * R
  let acumulado = 0
  return (
    <svg viewBox="0 0 180 180" className="dona" role="img" aria-label={`${centro} ${sub}`}>
      <circle cx="90" cy="90" r={R} fill="none" stroke="#E3EBF2" strokeWidth="22" />
      {partes.filter((p) => p.valor > 0).map((p) => {
        const largo = total > 0 ? (p.valor / total) * C : 0
        const el = (
          <circle key={p.label} cx="90" cy="90" r={R} fill="none" stroke={p.color} strokeWidth="22"
            strokeDasharray={`${largo} ${C - largo}`} strokeDashoffset={-acumulado} transform="rotate(-90 90 90)" />
        )
        acumulado += largo
        return el
      })}
      <text x="90" y="88" textAnchor="middle" className="dona-num">{centro}</text>
      <text x="90" y="110" textAnchor="middle" className="dona-sub">{sub}</text>
    </svg>
  )
}

function Resumen({ r }) {
  const cubierto = Math.min(Math.max(r.saldoAhorro, 0), r.falta)
  const porJuntar = Math.max(0, r.falta - cubierto)
  const pct = r.comprometido > 0 ? Math.round((r.pagado / r.comprometido) * 100) : 0
  const partes = [
    { label: 'Ya pagado', valor: r.pagado, color: '#3E86C1' },
    { label: 'Cubierto con el ahorro', valor: cubierto, color: '#8EC5E8' },
    { label: 'Falta por juntar', valor: porJuntar, color: '#E8B4C4' },
  ]
  const totalAportes = r.porOrigen.Harold + r.porOrigen.Alicia + r.abonos
  return (
    <>
      <div className="tarjeta">
        <div className="fila-entre"><h3>Lo contratado</h3><b className="azul-txt">{dinero(r.comprometido)}</b></div>
        <div className="dona-caja">
          <Dona partes={partes} total={r.comprometido} centro={`${pct}%`} sub="pagado" />
          <ul className="leyenda">
            {partes.map((p) => (
              <li key={p.label}>
                <i style={{ background: p.color }} />
                <div><span>{p.label}</span><b>{dinero(p.valor)}</b></div>
              </li>
            ))}
          </ul>
        </div>
        <div className="barra-apilada" aria-hidden="true">
          {partes.filter((p) => p.valor > 0).map((p) => (
            <div key={p.label} style={{ width: `${(p.valor / Math.max(1, r.comprometido)) * 100}%`, background: p.color }} />
          ))}
        </div>
        <div className="fila-entre meta"><span>Pagado {dinero(r.pagado)}</span><span>Por pagar {dinero(r.falta)}</span></div>
      </div>
      <div className="grid-stats">
        <div className="stat azul"><span>En el ahorro</span><b>{dinero(r.saldoAhorro)}</b></div>
        <div className="stat"><span>Falta por juntar</span><b>{dinero(porJuntar)}</b></div>
      </div>
      {r.pendientes.length > 0 && (
        <div className="tarjeta">
          <h3>Próximos vencimientos</h3>
          <ul className="mini-lista">
            {r.pendientes.map((p) => (
              <li key={p.id}><span>{p.concepto}</span><span><b>{dinero(p.falta)}</b> · {fechaCorta(p.fecha_limite)}</span></li>
            ))}
          </ul>
        </div>
      )}
      <div className="tarjeta">
        <h3>¿Quién ha puesto qué?</h3>
        {[
          ['🤵 Harold (directo)', r.porOrigen.Harold],
          ['👰 Alicia (directo)', r.porOrigen.Alicia],
          ['🏦 Abonos al ahorro', r.abonos],
        ].map(([n, v]) => (
          <div key={n} className="aporte">
            <div className="fila-entre"><span>{n}</span><b>{dinero(v)}</b></div>
            <Barra valor={v} total={totalAportes} />
          </div>
        ))}
        <p className="ayuda">Abonos al ahorro: Harold {dinero(r.abonosPor.Harold)} · Alicia {dinero(r.abonosPor.Alicia)} · juntos {dinero(r.abonosPor.Juntos)}</p>
      </div>
    </>
  )
}

function Proveedores({ r, abrir }) {
  const d = useDatos()
  const cotizando = d.proveedores.filter((p) => p.estado === 'cotizando')
  const porCat = {}
  cotizando.forEach((p) => { (porCat[p.categoria_id ?? 0] ||= []).push(p) })
  return (
    <>
      <div className="fila-entre"><h3>Contratados</h3><button className="enlace" onClick={() => abrir(null)}>＋ Proveedor o cotización</button></div>
      {r.lista.length === 0 && <Vacio emoji="🧾" texto="Aún no hay proveedores." />}
      {r.lista.map((p) => {
        const cat = d.catPorId[p.categoria_id]
        return (
          <button key={p.id} className="tarjeta prov" onClick={() => abrir(p)}>
            <div className="fila-entre">
              <div><b>{cat?.emoji} {p.concepto}</b><div className="meta">{p.nombre}</div></div>
              <div className="derecha"><b>{dinero(p.costo_total)}</b><div className={`meta ${p.falta === 0 ? 'verde' : ''}`}>{p.falta === 0 ? 'Pagado ✓' : `Falta ${dinero(p.falta)}`}</div></div>
            </div>
            <Barra valor={p.pagado} total={Number(p.costo_total)} />
            {p.falta > 0 && p.fecha_limite && <div className="meta">Pagar antes del {fechaLarga(p.fecha_limite)}</div>}
          </button>
        )
      })}
      <h3 className="espacio">Cotizaciones para comparar</h3>
      {cotizando.length === 0 && <p className="ayuda">Agrega cotizaciones (DJ, flores, sonido…) con estado “Cotizando” para compararlas aquí.</p>}
      {Object.entries(porCat).map(([cid, items]) => {
        const cat = d.catPorId[cid]
        const min = Math.min(...items.map((x) => Number(x.costo_total)))
        return (
          <div key={cid} className="tarjeta">
            <h4>{cat ? `${cat.emoji} ${cat.nombre}` : 'Sin categoría'}</h4>
            {items.map((p) => (
              <button key={p.id} className="fila-entre fila-boton" onClick={() => abrir(p)}>
                <span>{p.nombre || p.concepto}{Number(p.costo_total) === min && items.length > 1 && <span className="pill verde">más barata</span>}</span>
                <b>{dinero(p.costo_total)}</b>
              </button>
            ))}
          </div>
        )
      })}
    </>
  )
}

function Presupuesto({ r }) {
  const [editando, setEditando] = useState(null) // id | 'nueva'
  const totalComp = r.porCategoria.reduce((s, c) => s + c.comprometido, 0)
  return (
    <>
      <div className="tarjeta">
        <div className="fila-entre"><span>Presupuesto total</span><b>{dinero(r.presupuestoTotal)}</b></div>
        <div className="fila-entre"><span>Contratado</span><b>{dinero(totalComp)}</b></div>
        <Barra valor={totalComp} total={r.presupuestoTotal} alerta={totalComp > r.presupuestoTotal} />
        <p className="ayuda">Toca una sección para cambiar su nombre, ícono o monto, moverla o borrarla.</p>
      </div>
      <ul className="lista">
        {r.porCategoria.map((c) => (
          <li key={c.id}>
            <button className="cat cat-boton" onClick={() => setEditando(c.id)}>
              <div className="fila-entre">
                <span>{c.emoji} {c.nombre}</span>
                <b className="azul-txt">{dinero(c.presupuesto)}</b>
              </div>
              <Barra valor={c.comprometido} total={Number(c.presupuesto)} alerta={c.excedido} />
              <div className="meta">
                {c.comprometido > 0 ? <>Contratado {dinero(c.comprometido)} · pagado {dinero(c.pagado)}</> : 'Sin contratar'}
                {c.excedido && <b className="rojo"> · se pasa por {dinero(c.comprometido - c.presupuesto)}</b>}
              </div>
            </button>
          </li>
        ))}
      </ul>
      <button className="btn secundario" onClick={() => setEditando('nueva')}>＋ Nueva sección</button>
      {editando && <EditarCategoria id={editando} onCerrar={() => setEditando(null)} />}
    </>
  )
}

const EMOJIS = ['✨', '🏛️', '🍽️', '🎂', '🥂', '📸', '💍', '💃', '🤵', '🌺', '🎵', '✉️', '💇', '✝️', '🪑', '🚗', '🎁', '🌙', '🏨', '🛡️', '💡', '🎉', '🧁', '☕']

function EditarCategoria({ id, onCerrar }) {
  const d = useDatos()
  const original = id === 'nueva' ? null : d.categorias.find((c) => c.id === id)
  const [f, setF] = useState(() => ({
    nombre: original?.nombre || '', emoji: original?.emoji || '✨', presupuesto: original ? String(original.presupuesto) : '',
  }))
  const [error, setError] = useState(null)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  const usos = original ? {
    proveedores: d.proveedores.filter((p) => p.categoria_id === id).length,
    tareas: d.tareas.filter((t) => t.categoria_id === id).length,
    ideas: d.ideas.filter((i) => i.categoria_id === id).length,
  } : null
  const lista = d.categorias
  const pos = original ? lista.findIndex((c) => c.id === id) : -1

  async function guardar() {
    if (!f.nombre.trim()) return setError('Escribe el nombre de la sección')
    const fila = { nombre: f.nombre.trim(), emoji: f.emoji, presupuesto: Number(f.presupuesto) || 0 }
    try {
      if (original) await d.editar('categorias', original.id, fila)
      else await d.crear('categorias', { ...fila, orden: Math.max(0, ...lista.map((c) => c.orden)) + 1 })
      onCerrar()
    } catch (e) {
      setError(e.message.includes('duplicate') ? 'Ya existe una sección con ese nombre' : e.message)
    }
  }

  async function mover(delta) {
    const otra = lista[pos + delta]
    if (!otra) return
    await Promise.all([
      d.editar('categorias', original.id, { orden: otra.orden }),
      d.editar('categorias', otra.id, { orden: original.orden === otra.orden ? otra.orden + delta : original.orden }),
    ])
    await d.recargar('categorias')
  }

  async function borrar() {
    const total = usos.proveedores + usos.tareas + usos.ideas
    const aviso = total > 0
      ? `Esta sección tiene ${usos.proveedores} proveedores, ${usos.tareas} tareas y ${usos.ideas} ideas. No se borran: quedan "sin categoría". ¿Borrar la sección?`
      : '¿Borrar esta sección?'
    if (!confirm(aviso)) return
    await d.borrar('categorias', original.id)
    await Promise.all([d.recargar('proveedores'), d.recargar('tareas'), d.recargar('ideas')])
    onCerrar()
  }

  return (
    <Sheet abierto onCerrar={onCerrar} titulo={original ? 'Editar sección' : 'Nueva sección'}>
      <Campo label="Nombre"><input value={f.nombre} onChange={(e) => set('nombre')(e.target.value)} placeholder="Ej. Pastel" autoFocus={!original} /></Campo>
      <Campo label="Ícono">
        <div className="emojis">
          {EMOJIS.map((e) => (
            <button key={e} className={f.emoji === e ? 'on' : ''} onClick={() => set('emoji')(e)}>{e}</button>
          ))}
        </div>
      </Campo>
      <Campo label="Presupuesto (US$)">
        <input type="number" inputMode="decimal" value={f.presupuesto} onChange={(e) => set('presupuesto')(e.target.value)} placeholder="0" />
      </Campo>
      {error && <div className="aviso error">{error}</div>}
      <button className="btn grande" onClick={guardar}>Guardar</button>
      {original && (
        <>
          <div className="acciones">
            <button className="btn secundario" disabled={pos <= 0} onClick={() => mover(-1)}>↑ Subir</button>
            <button className="btn secundario" disabled={pos >= lista.length - 1} onClick={() => mover(1)}>↓ Bajar</button>
          </div>
          <button className="enlace rojo" onClick={borrar}>Borrar sección</button>
        </>
      )}
    </Sheet>
  )
}

function Ahorro({ r, abrir }) {
  const d = useDatos()
  const movs = [
    ...d.ahorro_movimientos.map((m) => ({ ...m, signo: m.tipo === 'abono' ? 1 : -1, texto: m.tipo === 'abono' ? `Abono · ${m.persona}` : 'Retiro' })),
    ...d.pagos.filter((p) => p.origen === 'Ahorro').map((p) => ({
      ...p, signo: -1, texto: `Pago · ${d.proveedores.find((x) => x.id === p.proveedor_id)?.concepto || ''}`, esPago: true,
    })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha))
  return (
    <>
      <div className="stat azul grande"><span>Saldo en la cuenta de ahorro</span><b>{dinero(r.saldoAhorro)}</b></div>
      <div className="acciones">
        <button className="btn secundario" onClick={() => abrir('retiro')}>− Retiro</button>
      </div>
      <ul className="lista">
        {movs.map((m) => (
          <li key={m.id} className="mov">
            <div><b>{m.texto}</b><div className="meta">{fechaLarga(m.fecha)}{m.nota ? ` · ${m.nota}` : ''}</div></div>
            <b className={m.signo > 0 ? 'verde' : 'rojo'}>{m.signo > 0 ? '+' : '−'}{dinero(m.monto)}</b>
            {!m.esPago && (
              <button className="btn-icono" aria-label="Borrar"
                onClick={() => confirm('¿Borrar este movimiento?') && d.borrar('ahorro_movimientos', m.id)}>🗑</button>
            )}
          </li>
        ))}
      </ul>
      {movs.length === 0 && <Vacio emoji="🏦" texto="Sin movimientos todavía." />}
    </>
  )
}

function NuevoPago({ proveedorId, saldo, onCerrar }) {
  const d = useDatos()
  const contratados = d.proveedores.filter((p) => p.estado === 'contratado')
  const [f, setF] = useState({ proveedor_id: proveedorId || contratados[0]?.id || '', monto: '', fecha: hoyISO(), origen: d.yo, nota: '' })
  const [recibo, setRecibo] = useState(null)
  const [error, setError] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  const monto = Number(f.monto)

  async function guardar() {
    if (!f.proveedor_id) return setError('Elige el proveedor')
    if (!(monto > 0)) return setError('Escribe el monto')
    setOcupado(true)
    try {
      const recibo_path = recibo ? await subirArchivo(recibo, 'recibos') : null
      await d.crear('pagos', { ...f, monto, nota: f.nota || null, recibo_path })
      onCerrar()
    } catch (e) { setError(e.message); setOcupado(false) }
  }

  return (
    <Sheet abierto onCerrar={onCerrar} titulo="Registrar pago">
      <Campo label="¿A quién?">
        <select value={f.proveedor_id} onChange={(e) => set('proveedor_id')(e.target.value)}>
          {contratados.map((p) => <option key={p.id} value={p.id}>{p.concepto}{p.nombre ? ` · ${p.nombre}` : ''}</option>)}
        </select>
      </Campo>
      <Campo label="Monto (US$)">
        <input type="number" inputMode="decimal" value={f.monto} onChange={(e) => set('monto')(e.target.value)} placeholder="0" />
      </Campo>
      <Campo label="¿De dónde salió el dinero?">
        <Chips valor={f.origen} onCambio={set('origen')} opciones={[
          { valor: 'Harold', label: '🤵 Harold' }, { valor: 'Alicia', label: '👰 Alicia' }, { valor: 'Ahorro', label: '🏦 Ahorro' },
        ]} />
      </Campo>
      {f.origen === 'Ahorro' && monto > saldo && <div className="aviso error">El ahorro solo tiene {dinero(saldo)}.</div>}
      <Campo label="Fecha"><input type="date" value={f.fecha} onChange={(e) => set('fecha')(e.target.value)} /></Campo>
      <Campo label="Nota"><input value={f.nota} onChange={(e) => set('nota')(e.target.value)} placeholder="Ej. cuota 2 de 3" /></Campo>
      <label className="btn secundario">
        📎 {recibo ? recibo.name : 'Adjuntar recibo (opcional)'}
        <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => setRecibo(e.target.files?.[0] || null)} />
      </label>
      {error && <div className="aviso error">{error}</div>}
      <button className="btn grande" onClick={guardar} disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar pago'}</button>
    </Sheet>
  )
}

function MovAhorro({ tipo: tipoInicial, onCerrar }) {
  const d = useDatos()
  const [tipo, setTipo] = useState(tipoInicial)
  const [f, setF] = useState({ monto: '', fecha: hoyISO(), persona: d.yo, nota: '' })
  const [error, setError] = useState(null)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  async function guardar() {
    const monto = Number(f.monto)
    if (!(monto > 0)) return setError('Escribe el monto')
    try {
      await d.crear('ahorro_movimientos', { tipo, monto, fecha: f.fecha, persona: tipo === 'abono' ? f.persona : 'Juntos', nota: f.nota || null })
      onCerrar()
    } catch (e) { setError(e.message) }
  }
  return (
    <Sheet abierto onCerrar={onCerrar} titulo="Cuenta de ahorro">
      <Chips valor={tipo} onCambio={setTipo} opciones={[{ valor: 'abono', label: '＋ Abono' }, { valor: 'retiro', label: '− Retiro' }]} />
      <Campo label="Monto (US$)"><input type="number" inputMode="decimal" value={f.monto} onChange={(e) => set('monto')(e.target.value)} /></Campo>
      {tipo === 'abono' && (
        <Campo label="¿Quién abonó?">
          <Chips valor={f.persona} onCambio={set('persona')} opciones={[
            { valor: 'Harold', label: '🤵 Harold' }, { valor: 'Alicia', label: '👰 Alicia' }, { valor: 'Juntos', label: '💑 Juntos' },
          ]} />
        </Campo>
      )}
      <Campo label="Fecha"><input type="date" value={f.fecha} onChange={(e) => set('fecha')(e.target.value)} /></Campo>
      <Campo label="Nota"><input value={f.nota} onChange={(e) => set('nota')(e.target.value)} placeholder={tipo === 'retiro' ? 'Ej. para pagar el DJ en efectivo' : ''} /></Campo>
      <p className="ayuda">Si pagas a un proveedor con dinero del ahorro, usa “＋ Pago” con origen 🏦 Ahorro: se descuenta solo.</p>
      {error && <div className="aviso error">{error}</div>}
      <button className="btn grande" onClick={guardar}>Guardar</button>
    </Sheet>
  )
}

function EditarProveedor({ id, onCerrar, onPagar }) {
  const d = useDatos()
  const original = id ? d.proveedores.find((p) => p.id === id) : null
  const [f, setF] = useState(() => original || {
    concepto: '', nombre: '', contacto: '', categoria_id: null, costo_total: '', fecha_limite: '', estado: 'cotizando', notas: '',
  })
  const [doc, setDoc] = useState(null)
  const [error, setError] = useState(null)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  const pagos = original ? d.pagos.filter((p) => p.proveedor_id === original.id) : []
  const pagado = pagos.reduce((s, p) => s + Number(p.monto), 0)

  async function guardar() {
    if (!f.concepto.trim()) return setError('Escribe el concepto (ej. DJ)')
    try {
      const documento_path = doc ? await subirArchivo(doc, 'documentos') : f.documento_path || null
      const fila = {
        concepto: f.concepto.trim(), nombre: f.nombre || null, contacto: f.contacto || null,
        categoria_id: f.categoria_id, costo_total: Number(f.costo_total) || 0,
        fecha_limite: f.fecha_limite || null, estado: f.estado, notas: f.notas || null, documento_path,
      }
      if (original) await d.editar('proveedores', original.id, fila)
      else await d.crear('proveedores', fila)
      onCerrar()
    } catch (e) { setError(e.message) }
  }

  const abrirArchivo = async (path) => { const u = await urlFirmada(path); if (u) window.open(u, '_blank') }

  return (
    <Sheet abierto onCerrar={onCerrar} titulo={original ? original.concepto : 'Nuevo proveedor'}>
      <Campo label="Estado">
        <Chips valor={f.estado} onCambio={set('estado')} opciones={[
          { valor: 'cotizando', label: 'Cotizando' }, { valor: 'contratado', label: 'Contratado' }, { valor: 'descartado', label: 'Descartado' },
        ]} />
      </Campo>
      <Campo label="Concepto"><input value={f.concepto} onChange={(e) => set('concepto')(e.target.value)} placeholder="Ej. DJ" /></Campo>
      <Campo label="Proveedor"><input value={f.nombre || ''} onChange={(e) => set('nombre')(e.target.value)} /></Campo>
      <Campo label="Contacto"><input value={f.contacto || ''} onChange={(e) => set('contacto')(e.target.value)} placeholder="Teléfono o Instagram" /></Campo>
      <Campo label="Categoría"><SelectCategoria categorias={d.categorias} valor={f.categoria_id} onCambio={set('categoria_id')} /></Campo>
      <Campo label="Costo total (US$)"><input type="number" inputMode="decimal" value={f.costo_total} onChange={(e) => set('costo_total')(e.target.value)} /></Campo>
      <Campo label="Pagar antes del"><input type="date" value={f.fecha_limite || ''} onChange={(e) => set('fecha_limite')(e.target.value)} /></Campo>
      <Campo label="Notas"><textarea rows={2} value={f.notas || ''} onChange={(e) => set('notas')(e.target.value)} /></Campo>
      {f.documento_path && <button className="enlace" onClick={() => abrirArchivo(f.documento_path)}>📄 Ver cotización / contrato</button>}
      <label className="btn secundario">
        📎 {doc ? doc.name : 'Adjuntar cotización o contrato'}
        <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => setDoc(e.target.files?.[0] || null)} />
      </label>
      {error && <div className="aviso error">{error}</div>}
      <button className="btn grande" onClick={guardar}>Guardar</button>

      {original && (
        <>
          <div className="fila-entre espacio">
            <h3>Pagos · {dinero(pagado)} de {dinero(original.costo_total)}</h3>
            {original.estado === 'contratado' && <button className="enlace" onClick={() => onPagar(original.id)}>＋ Pago</button>}
          </div>
          <ul className="lista">
            {pagos.map((p) => (
              <li key={p.id} className="mov">
                <div><b>{dinero(p.monto)}</b><div className="meta">{fechaLarga(p.fecha)} · {p.origen}{p.nota ? ` · ${p.nota}` : ''}</div></div>
                {p.recibo_path && <button className="btn-icono" onClick={() => abrirArchivo(p.recibo_path)} aria-label="Ver recibo">📎</button>}
                <button className="btn-icono" aria-label="Borrar pago" onClick={() => confirm('¿Borrar este pago?') && d.borrar('pagos', p.id)}>🗑</button>
              </li>
            ))}
          </ul>
          <button className="enlace rojo" onClick={async () => {
            if (!confirm('¿Borrar este proveedor y sus pagos?')) return
            await d.borrar('proveedores', original.id); onCerrar()
          }}>Borrar proveedor</button>
        </>
      )}
    </Sheet>
  )
}
