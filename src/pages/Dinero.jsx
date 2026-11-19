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

function Resumen({ r }) {
  const falta = Math.max(0, r.falta - r.saldoAhorro)
  const meses = mesesHasta(r.proximo?.fecha_limite)
  const totalAportes = r.porOrigen.Harold + r.porOrigen.Alicia + r.abonos
  return (
    <>
      <div className="grid-stats">
        <div className="stat azul"><span>En el ahorro</span><b>{dinero(r.saldoAhorro)}</b></div>
        <div className="stat"><span>Comprometido</span><b>{dinero(r.comprometido)}</b></div>
        <div className="stat"><span>Ya pagado</span><b>{dinero(r.pagado)}</b></div>
        <div className="stat"><span>Falta pagar</span><b>{dinero(r.falta)}</b></div>
      </div>
      <div className="tarjeta">
        <h3>Meta de ahorro</h3>
        {falta > 0 ? (
          <p>Para cubrir lo que falta ({dinero(r.falta)} − {dinero(r.saldoAhorro)} ya ahorrados) necesitan
            juntar <b>{dinero(Math.ceil(falta / meses))} al mes</b> durante {meses} {meses === 1 ? 'mes' : 'meses'}
            {' '}(≈ {dinero(Math.ceil(falta / meses / 2))} cada uno).</p>
        ) : <p>🎉 Con el ahorro actual ya cubren todo lo contratado.</p>}
        <p className="ayuda">Solo cuenta proveedores contratados. Al agregar más, la meta se recalcula sola.</p>
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
  const d = useDatos()
  const [editando, setEditando] = useState(null)
  const [valor, setValor] = useState('')
  const totalComp = r.porCategoria.reduce((s, c) => s + c.comprometido, 0)
  return (
    <>
      <div className="tarjeta">
        <div className="fila-entre"><span>Presupuesto total</span><b>{dinero(r.presupuestoTotal)}</b></div>
        <div className="fila-entre"><span>Contratado</span><b>{dinero(totalComp)}</b></div>
        <Barra valor={totalComp} total={r.presupuestoTotal} alerta={totalComp > r.presupuestoTotal} />
        <p className="ayuda">Es una propuesta inicial: toca cualquier monto para cambiarlo.</p>
      </div>
      <ul className="lista">
        {r.porCategoria.map((c) => (
          <li key={c.id} className="cat">
            <div className="fila-entre">
              <span>{c.emoji} {c.nombre}</span>
              {editando === c.id ? (
                <input className="monto-input" type="number" inputMode="decimal" autoFocus value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  onBlur={async () => { await d.editar('categorias', c.id, { presupuesto: Number(valor) || 0 }); setEditando(null) }} />
              ) : (
                <button className="enlace" onClick={() => { setEditando(c.id); setValor(String(c.presupuesto)) }}>{dinero(c.presupuesto)}</button>
              )}
            </div>
            <Barra valor={c.comprometido} total={Number(c.presupuesto)} alerta={c.excedido} />
            <div className="meta">
              {c.comprometido > 0 ? <>Contratado {dinero(c.comprometido)} · pagado {dinero(c.pagado)}</> : 'Sin contratar'}
              {c.excedido && <b className="rojo"> · se pasa por {dinero(c.comprometido - c.presupuesto)}</b>}
            </div>
          </li>
        ))}
      </ul>
    </>
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
