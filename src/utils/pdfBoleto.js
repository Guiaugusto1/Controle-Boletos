// Importação de boleto em PDF: lê o texto do PDF e procura a linha digitável,
// o beneficiário (fornecedor), o CNPJ e a data do documento.
// Funciona com boletos gerados por banco/sistema (PDF com texto).
// Boleto escaneado (foto) não tem texto — aí o usuário digita ou usa a câmera.

import { lerCodigoBoleto } from './boleto'
import { formatarCNPJ } from './formatters'

async function extrairTexto(arquivo) {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default

  const dados = new Uint8Array(await arquivo.arrayBuffer())
  const pdf = await pdfjs.getDocument({ data: dados }).promise
  let texto = ''
  for (let p = 1; p <= Math.min(pdf.numPages, 5); p++) {
    const pagina = await pdf.getPage(p)
    const conteudo = await pagina.getTextContent()
    for (const item of conteudo.items) {
      texto += item.str + (item.hasEOL ? '\n' : ' ')
    }
    texto += '\n'
  }
  return texto
}

const PADROES_LINHA = [
  // boleto bancário: 00000.00000 00000.000000 00000.000000 0 00000000000000
  /\d{5}[.\s]?\d{5}\s*\d{5}[.\s]?\d{6}\s*\d{5}[.\s]?\d{6}\s*\d\s*\d{14}/,
  // conta de consumo: 4 blocos de 11 + dígito
  /8\d{10}[-\s]?\d\s*\d{11}[-\s]?\d\s*\d{11}[-\s]?\d\s*\d{11}[-\s]?\d/,
]

function acharLinhaDigitavel(texto) {
  for (const padrao of PADROES_LINHA) {
    const achado = texto.match(padrao)
    if (achado) return achado[0]
  }
  // Último recurso: alguma linha do texto com 47 ou 48 dígitos seguidos
  for (const linha of texto.split('\n')) {
    const digitos = linha.replace(/[^\d]/g, '')
    if (digitos.length === 47 || digitos.length === 48) return digitos
  }
  return ''
}

function acharBeneficiario(texto) {
  const m = texto.match(/(?:Benefici[aá]rio|Cedente)(?:\s*final)?\s*[:\-]?\s*\n?\s*([^\n]{3,80})/i)
  if (!m) return ''
  return m[1]
    .replace(/(CNPJ|CPF)[\s\S]*$/i, '')
    .replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}.*/, '')
    .replace(/Ag[eê]ncia.*$/i, '')
    .replace(/[-–|]+\s*$/, '')
    .trim()
}

function acharDataDocumento(texto) {
  const m = texto.match(/Data\s+(?:do\s+)?documento[^\d]{0,40}(\d{2})\/(\d{2})\/(\d{4})/i)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

export async function importarBoletoPDF(arquivo) {
  const texto = await extrairTexto(arquivo)
  if (!texto.trim()) {
    return { ok: false, erro: 'Este PDF não tem texto (parece ser uma imagem escaneada). Digite a linha digitável ou use a câmera.' }
  }

  const linha = acharLinhaDigitavel(texto)
  const cnpj = texto.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/)?.[0] || ''
  const fornecedor = acharBeneficiario(texto)
  const emissao = acharDataDocumento(texto)

  if (!linha) {
    return {
      ok: false,
      erro: 'Não encontrei a linha digitável neste PDF. Copie a linha do boleto e cole no campo acima.',
      parcial: { fornecedor, cnpj: formatarCNPJ(cnpj), emissao },
    }
  }

  const lido = lerCodigoBoleto(linha)
  if (!lido.ok) return { ok: false, erro: lido.erro, parcial: { fornecedor, cnpj, emissao } }

  return {
    ...lido,
    fornecedor,
    cnpj: formatarCNPJ(cnpj),
    emissao,
  }
}
