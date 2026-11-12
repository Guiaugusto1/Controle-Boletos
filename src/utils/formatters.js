export function apenasDigitos(valor = '') {
  return String(valor ?? '').replace(/\D/g, '')
}

export function lerValor(valor) {
  if (valor === null || valor === undefined || valor === '') return 0
  const texto = String(valor).trim().replace('.', '').replace(',', '.')
  const numero = Number(texto)
  return Number.isFinite(numero) ? numero : 0
}

export function formatarMoeda(valor = 0) {
  const numero = Number(valor) || 0
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numero)
}

export function formatarData(valor) {
  if (!valor) return '—'
  const data = typeof valor === 'string' ? new Date(`${valor}T00:00:00`) : new Date(valor)
  if (Number.isNaN(data.getTime())) return valor

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(data)
}

export function paraData(valor) {
  if (!valor) return null
  const [ano, mes, dia] = String(valor).split('-').map(Number)
  if (!ano || !mes || !dia) return null
  return new Date(ano, mes - 1, dia)
}

export function paraISO(data) {
  const d = data instanceof Date ? data : new Date(data)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

export function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

export function mesAtualISO() {
  const hoje = new Date()
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
}

export function formatarMes(mes) {
  if (!mes) return '—'
  const [ano, mesNum] = String(mes).split('-')
  if (!ano || !mesNum) return mes
  const data = new Date(Number(ano), Number(mesNum) - 1, 1)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(data)
}

export function diasAte(valor) {
  if (!valor) return null
  const hoje = new Date()
  const alvo = new Date(`${valor}T00:00:00`)
  if (Number.isNaN(alvo.getTime())) return null
  const diff = Math.round((alvo - new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) / 86400000)
  return diff
}

export function somar(lista = [], campo = 'valor') {
  return lista.reduce((total, item) => {
    const valor = fieldValue(item, campo)
    return total + Number(valor || 0)
  }, 0)
}

export function fieldValue(item, campo) {
  if (campo === 'valor' && item && typeof item.valor === 'number') return item.valor
  if (campo && item && item[campo] !== undefined) return item[campo]
  if (typeof item === 'number') return item
  return 0
}

export function formatarTelefone(valor) {
  const digits = apenasDigitos(valor)
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return valor || '—'
}

export function formatarLinhaDigitavel(codigo = '') {
  const digits = apenasDigitos(codigo)
  if (digits.length === 44) {
    return `${digits.slice(0, 5)}.${digits.slice(5, 10)} ${digits.slice(10, 15)}.${digits.slice(15, 21)} ${digits.slice(21, 26)}.${digits.slice(26, 32)} ${digits.slice(32, 33)} ${digits.slice(33, 44)}`
  }
  if (digits.length === 47 || digits.length === 48) {
    return `${digits.slice(0, 5)} ${digits.slice(5, 10)} ${digits.slice(10, 15)} ${digits.slice(15, 21)} ${digits.slice(21, 26)} ${digits.slice(26, 32)} ${digits.slice(32, 38)} ${digits.slice(38, 47)}`
  }
  return digits
}
