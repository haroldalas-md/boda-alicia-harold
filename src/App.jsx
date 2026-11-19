import { useEffect, useState } from 'react'
import { supabase, configurado } from './lib/supabase'
import { DataProvider, useDatos } from './lib/data'
import { Icono } from './components/ui'
import Login from './pages/Login'
import Inicio from './pages/Inicio'
import Ideas from './pages/Ideas'
import Tareas from './pages/Tareas'
import Dinero from './pages/Dinero'
import Invitados from './pages/Invitados'
import Invitacion from './pages/Invitacion'
import Avisos, { contarAvisos } from './pages/Avisos'

const PESTANAS = [
  { id: 'inicio', label: 'Inicio', C: Inicio },
  { id: 'ideas', label: 'Ideas', C: Ideas },
  { id: 'tareas', label: 'Tareas', C: Tareas },
  { id: 'dinero', label: 'Dinero', C: Dinero },
  { id: 'invitados', label: 'Invitados', C: Invitados },
  { id: 'avisos', label: 'Avisos', C: Avisos },
]

function usePestana() {
  const leer = () => (location.hash.slice(1) || 'inicio')
  const [p, setP] = useState(leer)
  useEffect(() => {
    const f = () => setP(leer())
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  const ir = (id) => { location.hash = id; window.scrollTo(0, 0) }
  return [p, ir]
}

function Contenido() {
  const [pestana, ir] = usePestana()
  const datos = useDatos()
  const { cargando, error } = datos
  const avisos = cargando ? 0 : contarAvisos(datos)
  const Actual = (PESTANAS.find((x) => x.id === pestana) || PESTANAS[0]).C
  return (
    <>
      <main className="contenido">
        {error && <div className="aviso error">{error}</div>}
        {cargando ? <div className="cargando">Cargando…</div> : <Actual ir={ir} />}
      </main>
      <nav className="nav">
        {PESTANAS.map((x) => (
          <button key={x.id} className={pestana === x.id ? 'activo' : ''} onClick={() => ir(x.id)}>
            <span className="nav-icono">
              <Icono nombre={x.id} />
              {x.id === 'avisos' && avisos > 0 && pestana !== 'avisos' && <b className="contador-rojo">{avisos > 9 ? '9+' : avisos}</b>}
            </span>
            <span>{x.label}</span>
          </button>
        ))}
      </nav>
    </>
  )
}

export default function App() {
  const ruta = window.location.pathname.match(/^\/i\/([0-9a-f-]{36})\/?$/i)
  if (ruta) return configurado ? <Invitacion token={ruta[1]} /> : null
  return <AppPrivada />
}

function AppPrivada() {
  const [sesion, setSesion] = useState(undefined)
  const [yo, setYo] = useState(null)
  const [sinAcceso, setSinAcceso] = useState(false)

  useEffect(() => {
    if (!configurado) return
    supabase.auth.getSession().then(({ data }) => setSesion(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!sesion) { setYo(null); return }
    supabase.from('miembros').select('nombre').eq('email', sesion.user.email.toLowerCase()).maybeSingle()
      .then(({ data }) => { if (data) { setYo(data.nombre); setSinAcceso(false) } else setSinAcceso(true) })
  }, [sesion])

  if (!configurado) return <div className="centro"><p>Falta configurar Supabase (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY).</p></div>
  if (sesion === undefined) return <div className="centro cargando">Cargando…</div>
  if (!sesion) return <Login />
  if (sinAcceso) return (
    <div className="centro">
      <p>Este correo no tiene acceso a la app de la boda.</p>
      <button className="btn" onClick={() => supabase.auth.signOut()}>Salir</button>
    </div>
  )
  if (!yo) return <div className="centro cargando">Cargando…</div>
  return <DataProvider yo={yo}><Contenido /></DataProvider>
}
