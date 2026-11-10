// Funções de formatação e datas usadas no sistema inteiro.
// Datas são guardadas como texto 'AAAA-MM-DD' (sem hora) para evitar
// o erro de fuso horário de new Date('2025-08-20'), que no Brasil
// vira o dia anterior às 21h.

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatarMoeda(valor) {
  return moeda.format(Number(valor) || 0)
}

// Aceita "1.234,56", "1234,56" ou "1234.56" e devolve número
export function lerValor(texto) {
  if (typeof texto === 'number') return texto
  if (!texto) return 0
  let t = String(texto).trim().replace(/[R$\s]/g, '')
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(t)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

// Converte 'AAAA-MM-DD' em Date local (meia-noite no horário do Brasil)
export function paraData(iso) {
  if (!iso) return null
  const [a, m, d] = iso.split('-').map(Number)
  if (!a || !m) return null
  return new Date(a, m - 1, d || 1)
}

export function paraISO(data) {
  const a = data.getFullYear()
  const m = String(data.getMonth() + 1).padStart(2, '0')
  const d = String(data.getDate()).padStart(2, '0')
  return `${a}-${m}-${d}`
}

export function hojeISO() {
  return paraISO(new Date())
}

export function mesAtualISO() {
  return hojeISO().slice(0, 7)
}

export function formatarData(iso) {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  return d ? `${d}/${m}/${a}` : `${m}/${a}`
}

const nomesMeses = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

export function formatarMes(isoMes) {
  if (!isoMes) return ''
  const [a, m] = isoMes.split('-').map(Number)
  return `${nomesMeses[m - 1]} de ${a}`
}

// Diferença em dias entre hoje e a data (positivo = no futuro)
export function diasAte(iso) {
  const alvo = paraData(iso)
  if (!alvo) return null
  const hoje = paraData(hojeISO())
  return Math.round((alvo - hoje) / 86400000)
}

export function somar(lista, campo = 'valor') {
  return lista.reduce((acc, item) => acc + (Number(item[campo]) || 0), 0)
}

export function apenasDigitos(texto) {
  return String(texto || '').replace(/\D/g, '')
}

export function formatarTelefone(tel) {
  const d = apenasDigitos(tel)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return tel || ''
}

export function formatarCNPJ(texto) {
  const d = apenasDigitos(texto).slice(0, 14)
  if (d.length !== 14) return texto
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

export function novoId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())
}
