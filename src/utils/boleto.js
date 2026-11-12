import { apenasDigitos, formatarData } from './formatters'

function baseDate() {
  return new Date(1997, 9, 7)
}

function parseDataFromDigits(digits) {
  const numero = Number(digits.slice(0, 4))
  if (!Number.isFinite(numero) || numero <= 0) {
    return new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  }

  const start = baseDate()
  const diffDays = numero - 1
  const result = new Date(start)
  result.setDate(start.getDate() + diffDays)
  return result.toISOString().slice(0, 10)
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

export function lerCodigoBoleto(codigo) {
  const digits = apenasDigitos(codigo)
  if (!digits || digits.length < 44) {
    return { ok: false, erro: 'Código inválido.', parcial: null }
  }

  const valor = Number((Number(digits.slice(-10, -1) || '0') / 100).toFixed(2))
  const vencimento = parseDataFromDigits(digits.slice(0, 4))
  const banco = digits.startsWith('341') ? 'Itaú' : digits.startsWith('001') ? 'Banco do Brasil' : digits.startsWith('237') ? 'Bradesco' : digits.startsWith('104') ? 'Caixa' : digits.startsWith('033') ? 'Santander' : 'Banco não identificado'

  return {
    ok: true,
    linhaDigitavel: formatarLinhaDigitavel(digits),
    codigoBarras: digits,
    valor,
    vencimento,
    banco,
    segmento: banco,
    fornecedor: 'Fornecedor do boleto',
    cnpj: '',
    emissao: new Date().toISOString().slice(0, 10),
    avisos: [],
    parcial: {
      valor,
      vencimento,
      banco,
      fornecedor: 'Fornecedor do boleto',
    },
  }
}

export default { lerCodigoBoleto, formatarLinhaDigitavel }
