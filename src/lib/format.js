export const FECHA_BODA = new Date(2027, 3, 24) // 24 de abril de 2027

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
export const dinero = (n) => fmt.format(Number(n || 0)).replace('.00', '')

export const hoyISO = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export const aFecha = (iso) => {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export const fechaCorta = (iso) => {
  const d = aFecha(iso)
  return d ? `${d.getDate()} ${MESES[d.getMonth()]}` : ''
}
export const fechaLarga = (iso) => {
  const d = aFecha(iso)
  return d ? `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}` : ''
}
export const nombreMes = (iso) => {
  const d = aFecha(iso)
  return d ? `${MESES_LARGOS[d.getMonth()]} ${d.getFullYear()}` : ''
}

export const diasHasta = (fecha) => {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  return Math.round((fecha - hoy) / 86400000)
}

export const mesesHasta = (iso) => {
  const d = iso ? aFecha(iso) : FECHA_BODA
  return Math.max(1, Math.ceil(diasHasta(d) / 30.4))
}

export const TIPOS = {
  hacer: { label: 'Hacer', emoji: '📝' },
  diy: { label: 'DIY', emoji: '🎨' },
  reservar: { label: 'Reservar', emoji: '📅' },
  comprar: { label: 'Comprar', emoji: '🛒' },
}

export const ESTADOS_IDEA = {
  por_evaluar: { label: 'Por evaluar', color: 'gris' },
  la_queremos: { label: 'La queremos', color: 'azul' },
  descartada: { label: 'Descartada', color: 'rojo' },
}
