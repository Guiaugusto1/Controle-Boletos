// Conversa com as funções da pasta /api (mesmo endereço do site na Vercel).
// Para testar no computador use "npx vercel dev" (o "npm run dev" não tem /api),
// ou defina VITE_API_URL apontando para o site publicado.
const BASE = import.meta.env.VITE_API_URL || ''

export const token = () => localStorage.getItem('token')

function erroHttp(status, mensagem) {
  const e = new Error(mensagem)
  e.status = status
  return e
}

async function chamar(caminho, opcoes = {}) {
  const r = await fetch(BASE + caminho, {
    ...opcoes,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
    body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
  })
  const corpo = await r.json().catch(() => ({}))
  if (r.status === 401) {
    localStorage.removeItem('token')
    window.location.reload()
  }
  if (!r.ok) throw erroHttp(r.status, corpo.erro || 'Erro de rede')
  return corpo
}

export async function entrar(email, senha) {
  const r = await fetch(BASE + '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  })
  const corpo = await r.json().catch(() => ({}))
  if (!r.ok) throw erroHttp(r.status, corpo.erro || 'Falha no login')
  localStorage.setItem('token', corpo.token)
}

export function sair() {
  localStorage.removeItem('token')
  window.location.reload()
}

export const carregarEstado = () => chamar('/api/estado')
export const salvarEstado = (dados, versao) => chamar('/api/estado', { method: 'PUT', body: { dados, versao } })
