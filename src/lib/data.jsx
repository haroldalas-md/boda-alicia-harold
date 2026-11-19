import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

const TABLAS = {
  categorias: { order: 'orden', ascending: true },
  ideas: { order: 'created_at', ascending: false },
  tareas: { order: 'fecha_limite', ascending: true },
  proveedores: { order: 'created_at', ascending: true },
  pagos: { order: 'fecha', ascending: false },
  ahorro_movimientos: { order: 'fecha', ascending: false },
  invitados: { order: 'nombre', ascending: true },
  ajustes: { order: 'clave', ascending: true },
}

const Ctx = createContext(null)

export function DataProvider({ yo, children }) {
  const [datos, setDatos] = useState(() => Object.fromEntries(Object.keys(TABLAS).map((t) => [t, []])))
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const cargar = useCallback(async (tabla) => {
    const { order, ascending } = TABLAS[tabla]
    const { data, error } = await supabase.from(tabla).select('*').order(order, { ascending, nullsFirst: false })
    if (error) { setError(error.message); return }
    setDatos((d) => ({ ...d, [tabla]: data }))
  }, [])

  const cargarTodo = useCallback(async () => {
    await Promise.all(Object.keys(TABLAS).map(cargar))
    setCargando(false)
  }, [cargar])

  useEffect(() => {
    cargarTodo()
    const canal = supabase
      .channel('boda-cambios')
      .on('postgres_changes', { event: '*', schema: 'public' }, (p) => {
        if (TABLAS[p.table]) cargar(p.table)
      })
      .subscribe()
    const alVolver = () => document.visibilityState === 'visible' && cargarTodo()
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      supabase.removeChannel(canal)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [cargar, cargarTodo])

  const acciones = useMemo(() => ({
    async crear(tabla, fila) {
      const { data, error } = await supabase.from(tabla).insert(fila).select().single()
      if (error) throw error
      await cargar(tabla)
      return data
    },
    async editar(tabla, id, cambios) {
      // Actualiza en pantalla al instante y luego guarda
      setDatos((d) => ({ ...d, [tabla]: d[tabla].map((f) => (f.id === id ? { ...f, ...cambios } : f)) }))
      const { error } = await supabase.from(tabla).update(cambios).eq('id', id)
      if (error) { await cargar(tabla); throw error }
    },
    async borrar(tabla, id) {
      setDatos((d) => ({ ...d, [tabla]: d[tabla].filter((f) => f.id !== id) }))
      const { error } = await supabase.from(tabla).delete().eq('id', id)
      if (error) { await cargar(tabla); throw error }
    },
    recargar: cargar,
  }), [cargar])

  const catPorId = useMemo(() => Object.fromEntries(datos.categorias.map((c) => [c.id, c])), [datos.categorias])

  return (
    <Ctx.Provider value={{ ...datos, catPorId, cargando, error, yo, ...acciones }}>
      {children}
    </Ctx.Provider>
  )
}

export const useDatos = () => useContext(Ctx)

// ---------- Cálculos de dinero ----------
export function resumenDinero({ proveedores, pagos, ahorro_movimientos, categorias }) {
  const contratados = proveedores.filter((p) => p.estado === 'contratado')
  const pagadoPor = (id) => pagos.filter((x) => x.proveedor_id === id).reduce((s, x) => s + Number(x.monto), 0)

  const lista = contratados.map((p) => {
    const pagado = pagadoPor(p.id)
    return { ...p, pagado, falta: Math.max(0, Number(p.costo_total) - pagado) }
  })
  const comprometido = lista.reduce((s, p) => s + Number(p.costo_total), 0)
  const pagado = lista.reduce((s, p) => s + p.pagado, 0)
  const falta = lista.reduce((s, p) => s + p.falta, 0)

  const abonos = ahorro_movimientos.filter((m) => m.tipo === 'abono').reduce((s, m) => s + Number(m.monto), 0)
  const retiros = ahorro_movimientos.filter((m) => m.tipo === 'retiro').reduce((s, m) => s + Number(m.monto), 0)
  const desdeAhorro = pagos.filter((p) => p.origen === 'Ahorro').reduce((s, p) => s + Number(p.monto), 0)
  const saldoAhorro = abonos - retiros - desdeAhorro

  const porOrigen = { Harold: 0, Alicia: 0, Ahorro: 0 }
  pagos.forEach((p) => { porOrigen[p.origen] += Number(p.monto) })
  const abonosPor = { Harold: 0, Alicia: 0, Juntos: 0 }
  ahorro_movimientos.filter((m) => m.tipo === 'abono').forEach((m) => { abonosPor[m.persona] += Number(m.monto) })

  const pendientes = lista.filter((p) => p.falta > 0 && p.fecha_limite).sort((a, b) => a.fecha_limite.localeCompare(b.fecha_limite))

  const presupuestoTotal = categorias.reduce((s, c) => s + Number(c.presupuesto), 0)
  const porCategoria = categorias.map((c) => {
    const items = lista.filter((p) => p.categoria_id === c.id)
    const comp = items.reduce((s, p) => s + Number(p.costo_total), 0)
    const pag = items.reduce((s, p) => s + p.pagado, 0)
    return { ...c, comprometido: comp, pagado: pag, excedido: comp > Number(c.presupuesto) && Number(c.presupuesto) > 0 }
  })

  // Lo que le toca pagar a Harold: lo suyo completo + la mitad de lo compartido
  const deHarold = lista
    .filter((p) => p.falta > 0 && (p.responsable === 'Harold' || p.responsable === 'Ambos'))
    .map((p) => ({ ...p, miParte: p.responsable === 'Ambos' ? p.falta / 2 : p.falta }))
  const faltaHarold = deHarold.reduce((s, p) => s + p.miParte, 0)

  return {
    deHarold, faltaHarold,
    lista, comprometido, pagado, falta, saldoAhorro, abonos, porOrigen, abonosPor,
    pendientes, proximo: pendientes[0] ?? null, presupuestoTotal, porCategoria,
  }
}
