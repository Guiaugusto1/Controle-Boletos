// Copie para src/utils/api.js no front. Defina VITE_API_URL no Render (Static Site).
const BASE = import.meta.env.VITE_API_URL

function token() { return localStorage.getItem('token') }

async function chamar(caminho, opcoes = {}) {
  const r = await fetch(BASE + caminho, {
    ...opcoes,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token(), ...(opcoes.headers || {}) },
    body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
  })
  if (r.status === 401) { localStorage.removeItem('token'); window.location.reload() }
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro || 'Erro de rede')
  return r.status === 204 ? null : r.json()
}

export async function login(email, senha) {
  const r = await fetch(BASE + '/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d.erro || 'Falha no login')
  localStorage.setItem('token', d.token)
}

export const api = {
  listar: (colecao) => chamar(`/api/${colecao}`),
  criar: (colecao, item) => chamar(`/api/${colecao}`, { method: 'POST', body: item }),
  atualizar: (colecao, id, item) => chamar(`/api/${colecao}/${id}`, { method: 'PUT', body: item }),
  excluir: (colecao, id) => chamar(`/api/${colecao}/${id}`, { method: 'DELETE' }),
  exportar: () => chamar('/api/exportar'),
  importar: (backup) => chamar('/api/importar', { method: 'POST', body: backup }),
}
