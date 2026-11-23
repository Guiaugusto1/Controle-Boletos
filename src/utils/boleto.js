import { apenasDigitos } from './formatters'

// ---------------------------------------------------------------
// Leitura de boletos (bancário de 44/47 dígitos e convênio de 44/48).
//
// Código de barras bancário (44 dígitos):
//   banco(3) moeda(1) DV(1) fatorVencimento(4) valor(10) campoLivre(25)
// Linha digitável bancária (47 dígitos):
//   campo1(10) campo2(11) campo3(11) DV geral(1) fator(4) + valor(10)
// Convênio / concessionárias (começam com 8): 44 dígitos, ou 48 na linha
//   digitável (4 blocos de 11 dígitos + 1 DV cada).
// ---------------------------------------------------------------

const BANCOS = {
  '001': 'Banco do Brasil', '033': 'Santander', '041': 'Banrisul', '070': 'BRB',
  '077': 'Inter', '084': 'Uniprime', '085': 'Ailos', '104': 'Caixa', '136': 'Unicred',
  '208': 'BTG Pactual', '212': 'Original', '237': 'Bradesco', '260': 'Nubank',
  '290': 'PagBank', '323': 'Mercado Pago', '336': 'C6 Bank', '341': 'Itaú',
  '348': 'XP', '364': 'Gerencianet', '389': 'Mercantil', '422': 'Safra',
  '633': 'Rendimento', '655': 'Votorantim', '745': 'Citibank', '748': 'Sicredi',
  '756': 'Sicoob',
}

const SEGMENTOS = {
  '1': 'Prefeitura', '2': 'Saneamento', '3': 'Energia elétrica e gás',
  '4': 'Telecomunicações', '5': 'Órgão governamental', '6': 'Carnê',
  '7': 'Multa de trânsito', '9': 'Outros',
}

function dvModulo10(texto) {
  let soma = 0
  let peso = 2
  for (let i = texto.length - 1; i >= 0; i--) {
    const produto = Number(texto[i]) * peso
    soma += produto > 9 ? produto - 9 : produto
    peso = peso === 2 ? 1 : 2
  }
  return (10 - (soma % 10)) % 10
}

function dvModulo11Barras(texto43) {
  let soma = 0
  let peso = 2
  for (let i = texto43.length - 1; i >= 0; i--) {
    soma += Number(texto43[i]) * peso
    peso = peso === 9 ? 2 : peso + 1
  }
  const dv = 11 - (soma % 11)
  return dv === 0 || dv === 10 || dv === 11 ? 1 : dv
}

// Fator de vencimento -> data (AAAA-MM-DD).
// Base 07/10/1997. Em 22/02/2025 o fator voltou para 1000, então o mesmo
// número vale em dois ciclos de 9000 dias: usamos o mais próximo de hoje.
export function fatorParaData(fator) {
  const n = Number(fator)
  if (!n) return ''
  const DIA = 86400000
  const ciclo1 = Date.UTC(1997, 9, 7) + n * DIA
  const candidatas = [ciclo1, ciclo1 + 9000 * DIA]
  const agora = Date.now()
  const escolhida = candidatas.sort((a, b) => Math.abs(a - agora) - Math.abs(b - agora))[0]
  return new Date(escolhida).toISOString().slice(0, 10)
}

// Linha digitável de 47 dígitos -> código de barras de 44
function linhaBancariaParaBarras(d) {
  return d.slice(0, 4) + d.slice(32, 33) + d.slice(33, 47) + d.slice(4, 9) + d.slice(10, 20) + d.slice(21, 31)
}

// Código de barras de 44 -> linha digitável de 47 (com os DVs dos campos)
function barrasParaLinhaBancaria(b) {
  const c1 = b.slice(0, 4) + b.slice(19, 24)
  const c2 = b.slice(24, 34)
  const c3 = b.slice(34, 44)
  return c1 + dvModulo10(c1) + c2 + dvModulo10(c2) + c3 + dvModulo10(c3) + b.slice(4, 5) + b.slice(5, 19)
}

// Linha digitável de convênio (48) -> código de barras de 44
function linhaConvenioParaBarras(d) {
  return d.slice(0, 11) + d.slice(12, 23) + d.slice(24, 35) + d.slice(36, 47)
}

export function formatarLinhaDigitavel(codigo = '') {
  const d = apenasDigitos(codigo)
  if (d.length === 47) {
    return `${d.slice(0, 5)}.${d.slice(5, 10)} ${d.slice(10, 15)}.${d.slice(15, 21)} ${d.slice(21, 26)}.${d.slice(26, 32)} ${d.slice(32, 33)} ${d.slice(33, 47)}`
  }
  if (d.length === 48) {
    return [d.slice(0, 12), d.slice(12, 24), d.slice(24, 36), d.slice(36, 48)].join(' ')
  }
  if (d.length === 44) {
    if (d[0] === '8') return d.replace(/(\d{11})(?=\d)/g, '$1 ')
    return formatarLinhaDigitavel(barrasParaLinhaBancaria(d))
  }
  return d
}

export function lerCodigoBoleto(codigo) {
  const d = apenasDigitos(codigo)
  if (![44, 47, 48].includes(d.length)) {
    return { ok: false, erro: 'Código inválido: o boleto tem 44, 47 ou 48 números.', parcial: null }
  }

  const avisos = []
  const convenio = d[0] === '8'
  const barras = d.length === 44 ? d : d.length === 47 ? linhaBancariaParaBarras(d) : linhaConvenioParaBarras(d)

  let valor = 0
  let vencimento = ''
  let banco = ''
  let segmento = ''

  if (!convenio) {
    // boleto bancário
    banco = BANCOS[barras.slice(0, 3)] || `Banco ${barras.slice(0, 3)}`
    valor = Number(barras.slice(9, 19)) / 100
    vencimento = fatorParaData(barras.slice(5, 9))
    if (dvModulo11Barras(barras.slice(0, 4) + barras.slice(5)) !== Number(barras[4])) {
      avisos.push('O dígito verificador não confere. Confira o código ou o valor antes de salvar.')
    }
    if (!vencimento) avisos.push('Este boleto não informa data de vencimento.')
  } else {
    // conta de consumo (água, luz, telefone, impostos)
    segmento = SEGMENTOS[barras[1]] || 'Conta de consumo'
    banco = segmento
    const tipoValor = barras[2]
    if (tipoValor === '6' || tipoValor === '7') {
      valor = Number(barras.slice(4, 15)) / 100
    } else {
      avisos.push('Este boleto não traz o valor no código. Digite o valor.')
    }
    avisos.push('Conta de consumo: confira o vencimento, que não é lido do código.')
  }

  valor = Number(valor.toFixed(2))
  const linhaDigitavel = d.length === 44 ? formatarLinhaDigitavel(barras) : formatarLinhaDigitavel(d)

  return {
    ok: true,
    linhaDigitavel,
    codigoBarras: barras,
    valor,
    vencimento,
    banco,
    segmento,
    fornecedor: '', // o código não traz o nome de quem recebe
    cnpj: '',
    emissao: '',    // o código não traz a data de emissão
    avisos,
    parcial: { valor, vencimento, banco },
  }
}

export default { lerCodigoBoleto, formatarLinhaDigitavel, fatorParaData }
