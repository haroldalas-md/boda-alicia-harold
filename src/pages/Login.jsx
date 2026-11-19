import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [modo, setModo] = useState('entrar')
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [msg, setMsg] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setOcupado(true); setMsg(null)
    const datos = { email: email.trim().toLowerCase(), password: clave }
    const { data, error } = modo === 'entrar'
      ? await supabase.auth.signInWithPassword(datos)
      : await supabase.auth.signUp({ ...datos, options: { emailRedirectTo: window.location.origin } })
    setOcupado(false)
    if (error) {
      const t = error.message
      setMsg({ error: true, t: t.includes('Invalid login') ? 'Correo o contraseña incorrectos.'
        : t.includes('not confirmed') ? 'Primero confirma tu correo con el enlace que te enviamos.'
        : t.includes('acceso') || t.includes('Database error') ? 'Este correo no tiene acceso a la app de la boda.'
        : t })
    } else if (modo === 'crear' && !data?.session) {
      setMsg({ t: 'Listo. Revisa tu correo, toca el enlace de confirmación y vuelve aquí para entrar.' })
      setModo('entrar')
    }
  }

  return (
    <div className="login">
      <div className="login-anillos">💍</div>
      <h1>Alicia & Harold</h1>
      <p className="sub">24 de abril de 2027 · Casa Ávila</p>
      <form onSubmit={enviar} className="tarjeta">
        <label className="campo"><span>Correo</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="campo"><span>Contraseña</span>
          <input type="password" autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} minLength={6}
            value={clave} onChange={(e) => setClave(e.target.value)} required />
        </label>
        {msg && <div className={`aviso ${msg.error ? 'error' : ''}`}>{msg.t}</div>}
        <button className="btn grande" disabled={ocupado}>{modo === 'entrar' ? 'Entrar' : 'Crear mi cuenta'}</button>
        <button type="button" className="enlace" onClick={() => { setModo(modo === 'entrar' ? 'crear' : 'entrar'); setMsg(null) }}>
          {modo === 'entrar' ? 'Primera vez: crear cuenta' : 'Ya tengo cuenta'}
        </button>
      </form>
    </div>
  )
}
