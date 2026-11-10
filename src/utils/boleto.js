// Leitura da linha digitável e do código de barras de boletos (padrão FEBRABAN).
// Do código dá para tirar: banco, valor e vencimento.
// Fornecedor e CNPJ não ficam no código — esses o usuário preenche
// (ou vêm do PDF, quando o boleto é importado).

import { apenasDigitos, paraISO } from './formatters'

export const BANCOS = {
  '001': 'Banco do Brasil',
  '004': 'Banco do Nordeste',
  '033': 'Santander',
  '041': 'Banrisul',
  '070': 'BRB',
  '077': 'Inter',
  '104': 'Caixa Econômica Federal',
  '136': 'Unicred',
  '208': 'BTG Pactual',
  '212': 'Banco Original',
  '237': 'Bradesco',
  '260': 'Nubank',
  '290': 'PagBank',
  '318': 'Banco BMG',
  '323': 'Mercado Pago',
  '336': 'C6 Bank',
  '341': 'Itaú',
  '380': 'PicPay',
  '389': 'Mercantil do Brasil',
  '422': 'Safra',
  '623': 'Banco Pan',
  '633': 'Rendimento',
  '655': 'Votorantim',
  '707': 'Daycoval',
  '745': 'Citibank',
  '748': 'Sicredi',
  '756': 'Sicoob',
}

function modulo10(numero) {
  let soma = 0
  let peso = 2
  for (let i = numero.length - 1; i >= 0; i--) {
    let produto = Number(numero[i]) * peso
    if (produto > 9) produto = Math.floor(produto / 10) + (produto % 10)
    soma += produto
    peso = peso === 2 ? 1 : 2
  }
  return (10 - (soma % 10)) % 10
}

function modulo11Bancario(numero) {
  let soma = 0
  let peso = 2
  for (let i = numero.length - 1; i >= 0; i--) {
    soma += Number(numero[i]) * peso
    peso = peso === 9 ? 2 : peso + 1
  }
  const dv = 11 - (soma % 11)
  return dv === 0 || dv === 10 || dv === 11 ? 1 : dv
}

function modulo11Arrecadacao(numero) {
  let soma = 0
  let peso = 2
  for (let i = numero.length - 1; i >= 0; i--) {
    soma += Number(numero[i]) * peso
    peso = peso === 9 ? 2 : peso + 1
  }
  const resto = soma % 11
  if (resto === 0 || resto === 1) return 0
  if (resto === 10) return 1
  return 11 - resto
}

const DIA = 86400000

// Desde 22/02/2025 o fator de vencimento recomeçou em 1000 (regra FEBRABAN).
// O mesmo fator pode valer duas datas; fica a mais próxima de hoje.
export function fatorParaData(fator, hoje = new Date()) {
  const f = Number(fator)
  if (!f) return null
  const antiga = Date.UTC(1997, 9, 7) + f * DIA
  const candidatas = [antiga]
  if (f >= 1000) candidatas.push(Date.UTC(2025, 1, 22) + (f - 1000) * DIA)
  const ref = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const escolhida = candidatas.reduce((a, b) => (Math.abs(b - ref) < Math.abs(a - ref) ? b : a))
  const d = new Date(escolhida)
  return paraISO(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function linhaParaBarrasBancario(l) {
  return l.slice(0, 4) + l[32] + l.slice(33, 47) + l.slice(4, 9) + l.slice(10, 20) + l.slice(21, 31)
}

function linhaParaBarrasArrecadacao(l) {
  return l.slice(0, 11) + l.slice(12, 23) + l.slice(24, 35) + l.slice(36, 47)
}

function dataValida(texto) {
  const a = Number(texto.slice(0, 4))
  const m = Number(texto.slice(4, 6))
  const d = Number(texto.slice(6, 8))
  const data = new Date(a, m - 1, d)
  if (data.getFullYear() !== a || data.getMonth() !== m - 1 || data.getDate() !== d) return null
  return data
}

/**
 * Lê uma linha digitável (47 ou 48 dígitos) ou código de barras (44 dígitos).
 * Devolve { ok, tipo, banco, bancoCodigo, valor, vencimento, codigoBarras, avisos }
 * ou { ok: false, erro }.
 */
export function lerCodigoBoleto(entrada, hoje = new Date()) {
  const n = apenasDigitos(entrada)
  const avisos = []

  if (![44, 47, 48].includes(n.length)) {
    return {
      ok: false,
      erro: `O código tem ${n.length} números. A linha digitável tem 47 (ou 48, em contas de consumo) e o código de barras tem 44.`,
    }
  }

  const ehArrecadacao = n[0] === '8'

  if (ehArrecadacao) {
    let barras = n
    if (n.length === 48) {
      for (let b = 0; b < 4; b++) {
        const bloco = n.slice(b * 12, b * 12 + 11)
        const dv = Number(n[b * 12 + 11])
        const usaMod10 = n[2] === '6' || n[2] === '7'
        const calc = usaMod10 ? modulo10(bloco) : modulo11Arrecadacao(bloco)
        if (calc !== dv) {
          avisos.push(`O bloco ${b + 1} da linha digitável não confere. Verifique se foi digitado certo.`)
          break
        }
      }
      barras = linhaParaBarrasArrecadacao(n)
    } else if (n.length !== 44) {
      return { ok: false, erro: 'Contas de consumo têm 48 números na linha digitável ou 44 no código de barras.' }
    }

    const valorReal = barras[2] === '6' || barras[2] === '8'
    const valor = valorReal ? Number(barras.slice(4, 15)) / 100 : 0
    if (!valorReal) avisos.push('Este código não traz o valor em reais. Preencha o valor manualmente.')

    // Muitas concessionárias colocam o vencimento como AAAAMMDD logo após o código da empresa.
    let vencimento = ''
    const possivelData = dataValida(barras.slice(19, 27))
    if (possivelData) {
      const dias = (possivelData - hoje) / DIA
      if (dias > -90 && dias < 180) vencimento = paraISO(possivelData)
    }
    if (!vencimento) avisos.push('Contas de consumo nem sempre trazem o vencimento no código. Confira a data na conta.')

    const segmentos = { 1: 'Prefeitura', 2: 'Saneamento (água/esgoto)', 3: 'Energia elétrica e gás', 4: 'Telecomunicações', 5: 'Órgão público', 6: 'Carnê/convênio', 7: 'Multa de trânsito', 9: 'Uso exclusivo do banco' }

    return {
      ok: true,
      tipo: 'consumo',
      banco: '',
      bancoCodigo: '',
      segmento: segmentos[barras[1]] || '',
      valor,
      vencimento,
      codigoBarras: barras,
      linhaDigitavel: barrasParaLinha(barras),
      avisos,
    }
  }

  // Boleto bancário
  if (n.length === 48) {
    return { ok: false, erro: 'Linha com 48 números só existe em contas de consumo (começam com 8). Confira o código.' }
  }

  let barras = n
  if (n.length === 47) {
    const campos = [
      [n.slice(0, 9), n[9]],
      [n.slice(10, 20), n[20]],
      [n.slice(21, 31), n[31]],
    ]
    campos.forEach(([campo, dv], i) => {
      if (modulo10(campo) !== Number(dv)) {
        avisos.push(`O campo ${i + 1} da linha digitável não confere. Verifique se foi digitado certo.`)
      }
    })
    barras = linhaParaBarrasBancario(n)
  }

  const dvGeral = Number(barras[4])
  if (modulo11Bancario(barras.slice(0, 4) + barras.slice(5)) !== dvGeral) {
    avisos.push('O dígito verificador do código não confere. Pode haver um número errado.')
  }

  const bancoCodigo = barras.slice(0, 3)
  const fator = barras.slice(5, 9)
  const valor = Number(barras.slice(9, 19)) / 100
  const vencimento = fatorParaData(fator, hoje) || ''
  if (!vencimento) avisos.push('Este boleto não tem vencimento no código. Preencha a data.')
  if (!valor) avisos.push('Este boleto não tem valor no código. Preencha o valor.')

  return {
    ok: true,
    tipo: 'bancario',
    banco: BANCOS[bancoCodigo] ? `${bancoCodigo} – ${BANCOS[bancoCodigo]}` : `Banco ${bancoCodigo}`,
    bancoCodigo,
    valor,
    vencimento,
    codigoBarras: barras,
    linhaDigitavel: barrasParaLinha(barras),
    avisos,
  }
}

// Converte o código de barras (44) na linha digitável (47 ou 48), que é o
// que os aplicativos de banco pedem para pagar.
export function barrasParaLinha(barras) {
  const b = apenasDigitos(barras)
  if (b.length !== 44) return b
  if (b[0] === '8') {
    const usaMod10 = b[2] === '6' || b[2] === '7'
    return b.match(/.{11}/g).map((bloco) => bloco + (usaMod10 ? modulo10(bloco) : modulo11Arrecadacao(bloco))).join('')
  }
  const c1 = b.slice(0, 4) + b.slice(19, 24)
  const c2 = b.slice(24, 34)
  const c3 = b.slice(34, 44)
  return c1 + modulo10(c1) + c2 + modulo10(c2) + c3 + modulo10(c3) + b[4] + b.slice(5, 19)
}

// Formata a linha digitável de boleto bancário para exibição
export function formatarLinhaDigitavel(codigo) {
  const n = apenasDigitos(codigo)
  if (n.length === 47) {
    return `${n.slice(0, 5)}.${n.slice(5, 10)} ${n.slice(10, 15)}.${n.slice(15, 21)} ${n.slice(21, 26)}.${n.slice(26, 32)} ${n[32]} ${n.slice(33)}`
  }
  if (n.length === 48) {
    return n.match(/.{12}/g).map((b) => `${b.slice(0, 11)}-${b[11]}`).join(' ')
  }
  return n
}

// Usado nos testes e para gerar exemplos
export const _interno = { modulo10, modulo11Bancario, modulo11Arrecadacao, linhaParaBarrasBancario }
