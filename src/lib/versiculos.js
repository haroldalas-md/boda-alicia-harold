// Versículos (Reina-Valera 1960) sobre el amor, el matrimonio y crecer en fe
export const VERSICULOS = [
  { cita: '1 Corintios 13:4-5', texto: 'El amor es sufrido, es benigno; el amor no tiene envidia, el amor no es jactancioso, no se envanece; no hace nada indebido, no busca lo suyo, no se irrita, no guarda rencor.' },
  { cita: '1 Corintios 13:7', texto: 'Todo lo sufre, todo lo cree, todo lo espera, todo lo soporta.' },
  { cita: '1 Corintios 13:13', texto: 'Y ahora permanecen la fe, la esperanza y el amor, estos tres; pero el mayor de ellos es el amor.' },
  { cita: 'Eclesiastés 4:9', texto: 'Mejores son dos que uno; porque tienen mejor paga de su trabajo.' },
  { cita: 'Eclesiastés 4:12', texto: 'Y si alguno prevaleciere contra uno, dos le resistirán; y cordón de tres dobleces no se rompe pronto.' },
  { cita: 'Génesis 2:24', texto: 'Por tanto, dejará el hombre a su padre y a su madre, y se unirá a su mujer, y serán una sola carne.' },
  { cita: 'Marcos 10:9', texto: 'Por tanto, lo que Dios juntó, no lo separe el hombre.' },
  { cita: 'Proverbios 18:22', texto: 'El que halla esposa halla el bien, y alcanza la benevolencia de Jehová.' },
  { cita: 'Proverbios 31:10', texto: 'Mujer virtuosa, ¿quién la hallará? Porque su estima sobrepasa largamente a la de las piedras preciosas.' },
  { cita: 'Cantares 8:7', texto: 'Las muchas aguas no podrán apagar el amor, ni lo ahogarán los ríos.' },
  { cita: 'Efesios 4:2', texto: 'Con toda humildad y mansedumbre, soportándoos con paciencia los unos a los otros en amor.' },
  { cita: 'Efesios 4:32', texto: 'Antes sed benignos unos con otros, misericordiosos, perdonándoos unos a otros, como Dios también os perdonó a vosotros en Cristo.' },
  { cita: 'Colosenses 3:14', texto: 'Y sobre todas estas cosas vestíos de amor, que es el vínculo perfecto.' },
  { cita: '1 Juan 4:19', texto: 'Nosotros le amamos a él, porque él nos amó primero.' },
  { cita: '1 Pedro 4:8', texto: 'Y ante todo, tened entre vosotros ferviente amor; porque el amor cubrirá multitud de pecados.' },
  { cita: 'Romanos 12:10', texto: 'Amaos los unos a los otros con amor fraternal; en cuanto a honra, prefiriéndoos los unos a los otros.' },
  { cita: 'Filipenses 1:6', texto: 'Estando persuadido de esto, que el que comenzó en vosotros la buena obra, la perfeccionará hasta el día de Jesucristo.' },
  { cita: 'Salmos 37:4', texto: 'Deléitate asimismo en Jehová, y él te concederá las peticiones de tu corazón.' },
  { cita: 'Proverbios 3:5-6', texto: 'Fíate de Jehová de todo tu corazón, y no te apoyes en tu propia prudencia. Reconócelo en todos tus caminos, y él enderezará tus veredas.' },
  { cita: 'Jeremías 29:11', texto: 'Porque yo sé los pensamientos que tengo acerca de vosotros, dice Jehová, pensamientos de paz, y no de mal, para daros el fin que esperáis.' },
  { cita: 'Rut 1:16', texto: 'A dondequiera que tú fueres, iré yo, y dondequiera que vivieres, viviré. Tu pueblo será mi pueblo, y tu Dios mi Dios.' },
  { cita: 'Isaías 40:31', texto: 'Pero los que esperan a Jehová tendrán nuevas fuerzas; levantarán alas como las águilas; correrán, y no se cansarán; caminarán, y no se fatigarán.' },
  { cita: 'Filipenses 4:13', texto: 'Todo lo puedo en Cristo que me fortalece.' },
  { cita: 'Salmos 118:24', texto: 'Este es el día que hizo Jehová; nos gozaremos y alegraremos en él.' },
]

// Mensajes de Harold para Alicia (siempre le dicen que la ama)
export const PARA_ALICIA = [
  'Te amo mucho, Alicita. Eres mi mayor bendición y la mejor decisión de mi vida.',
  'Te amo con todo mi corazón. Dios me sorprendió contigo y cada día le doy gracias.',
  'Te amo, mi amor. Contigo todo es más bonito, incluso planear esta boda.',
  'Te amo muchísimo. Elegirte fue, es y será la mejor decisión de mi vida.',
  'Te amo, Alicita. Eres la respuesta a muchas de mis oraciones.',
  'Te amo mucho. No hay nada en esta lista más importante que tú.',
  'Te amo con todo lo que soy. Gracias por decirme que sí; eres mi mayor bendición.',
  'Te amo, mi vida. Cada día que pasa te admiro y te quiero más.',
  'Te amo mucho. Lo que falte por hacer lo hacemos juntos; tú no estás sola en nada.',
  'Te amo, Alicita. Eres mi lugar seguro y la mujer con la que quiero crecer toda la vida.',
  'Te amo con locura. Eres el regalo más grande que Dios me ha dado.',
  'Te amo mucho, mi amor. Gracias por ser tú; eres la mejor decisión de mi vida.',
]

function siguiente(clave, total) {
  // Uno nuevo cada vez que se abre la app; se mantiene mientras siga abierta
  try {
    const sesion = sessionStorage.getItem(clave)
    if (sesion !== null) return Number(sesion) % total
    const ultimo = Number(localStorage.getItem(clave) ?? -1)
    let i = Math.floor(Math.random() * total)
    if (total > 1 && i === ultimo) i = (i + 1) % total
    localStorage.setItem(clave, String(i))
    sessionStorage.setItem(clave, String(i))
    return i
  } catch {
    return Math.floor(Math.random() * total)
  }
}

export const versiculoDeHoy = () => VERSICULOS[siguiente('boda-versiculo', VERSICULOS.length)]
export const mensajeParaAlicia = () => PARA_ALICIA[siguiente('boda-mensaje', PARA_ALICIA.length)]
