import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import * as AutoTable from 'jspdf-autotable'

// Nas versões novas do jspdf-autotable a tabela é uma função: autoTable(doc, opções).
// (doc.autoTable não existe mais, e foi isso que quebrava o PDF.)
const autoTable = AutoTable.default || AutoTable.autoTable

const NOMES_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const num = (v) => Number(v) || 0
const dinheiro = (v) => num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\u00a0/g, ' ')
const dataBR = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}
const dataLocal = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}
const nomeMes = (aaaamm) => {
  const [ano, mes] = String(aaaamm).split('-').map(Number)
  return mes ? `${NOMES_MESES[mes - 1]} de ${ano}` : String(aaaamm)
}

// periodo = { tipo: 'mes' | 'ano' | 'tudo', mes: 'AAAA-MM' }
export function descreverPeriodo({ tipo, mes }) {
  if (tipo === 'mes') return nomeMes(mes)
  if (tipo === 'ano') return `ano de ${String(mes).slice(0, 4)}`
  return 'todos os meses'
}
const prefixoDe = ({ tipo, mes }) => (tipo === 'mes' ? mes : tipo === 'ano' ? String(mes).slice(0, 4) : '')
const ordenar = (lista, campo) => [...lista].sort((a, b) => String(a[campo] || '').localeCompare(String(b[campo] || '')))
const arred = (v) => Math.round((Number(v) || 0) * 100) / 100
const soma = (lista, campo = 'valor') => arred(lista.reduce((t, i) => t + num(i[campo]), 0))

const SITUACAO = { pago: 'Pago', vencido: 'Vencido', hoje: 'Vence hoje', proximo: 'Em aberto', aberto: 'Em aberto' }

// Monta o conteúdo de cada aba (sem mexer em arquivo). Separado para ficar fácil de testar.
export function prepararPlanilhas({ boletos = [], despesas = [], vendas = [], clientes = [], saldoCliente, statusBoleto, diasAlerta = 7, nomeLoja = '', periodo }) {
  const pref = prefixoDe(periodo)
  const no = (data) => !pref || (typeof data === 'string' && data.startsWith(pref))

  const boletosPeriodo = ordenar(boletos.filter((b) => no(b.vencimento) || (b.pago && no(b.dataPagamento))), 'vencimento')
  const pagos = boletos.filter((b) => b.pago && no(b.dataPagamento))
  const abertos = boletos.filter((b) => !b.pago && no(b.vencimento))
  const despesasPeriodo = ordenar(despesas.filter((d) => no(d.data)), 'data')
  const vendasPeriodo = ordenar(vendas.filter((v) => no(v.data)), 'data')

  const abaBoletos = {
    nome: 'Boletos',
    colunas: [
      { titulo: 'Fornecedor', chave: 'fornecedor', tipo: 'texto', largura: 30 },
      { titulo: 'Vencimento', chave: 'vencimento', tipo: 'data', largura: 13 },
      { titulo: 'Situação', chave: 'situacao', tipo: 'texto', largura: 12 },
      { titulo: 'Valor', chave: 'valor', tipo: 'moeda', largura: 14 },
      { titulo: 'Data do pagamento', chave: 'dataPagamento', tipo: 'data', largura: 17 },
      { titulo: 'Categoria', chave: 'categoria', tipo: 'texto', largura: 18 },
      { titulo: 'Banco', chave: 'banco', tipo: 'texto', largura: 16 },
      { titulo: 'CNPJ', chave: 'cnpj', tipo: 'texto', largura: 20 },
      { titulo: 'Emissão', chave: 'emissao', tipo: 'data', largura: 12 },
      { titulo: 'Observação', chave: 'observacao', tipo: 'texto', largura: 34 },
      { titulo: 'Linha digitável', chave: 'codigo', tipo: 'texto', largura: 56 },
    ],
    linhas: boletosPeriodo.map((b) => ({
      ...b,
      fornecedor: b.fornecedor || 'Sem nome',
      situacao: SITUACAO[statusBoleto ? statusBoleto(b, diasAlerta) : b.pago ? 'pago' : 'aberto'] || 'Em aberto',
      dataPagamento: b.pago ? b.dataPagamento : '',
    })),
  }

  const abaDespesas = {
    nome: 'Despesas',
    colunas: [
      { titulo: 'Data', chave: 'data', tipo: 'data', largura: 12 },
      { titulo: 'Descrição', chave: 'descricao', tipo: 'texto', largura: 38 },
      { titulo: 'Categoria', chave: 'categoria', tipo: 'texto', largura: 22 },
      { titulo: 'Valor', chave: 'valor', tipo: 'moeda', largura: 14 },
    ],
    linhas: despesasPeriodo,
  }

  const abaVendas = {
    nome: 'Vendas',
    colunas: [
      { titulo: 'Data', chave: 'data', tipo: 'data', largura: 12 },
      { titulo: 'Forma de pagamento', chave: 'forma', tipo: 'texto', largura: 22 },
      { titulo: 'Valor', chave: 'valor', tipo: 'moeda', largura: 14 },
      { titulo: 'Observação', chave: 'observacao', tipo: 'texto', largura: 40 },
    ],
    linhas: vendasPeriodo,
  }

  const movimentos = []
  clientes.forEach((c) =>
    (c.lancamentos || []).filter((l) => no(l.data)).forEach((l) => {
      const compra = l.tipo === 'compra'
      movimentos.push({
        data: l.data,
        cliente: c.nome,
        telefone: c.telefone || '',
        tipo: compra ? 'Compra' : 'Pagamento',
        descricao: l.descricao || '',
        compra: compra ? num(l.valor) : '',
        pagamento: compra ? '' : num(l.valor),
      })
    })
  )
  movimentos.sort((a, b) => String(a.data).localeCompare(String(b.data)) || String(a.cliente).localeCompare(String(b.cliente)))

  const abaFiado = {
    nome: 'Fiado',
    colunas: [
      { titulo: 'Data', chave: 'data', tipo: 'data', largura: 12 },
      { titulo: 'Cliente', chave: 'cliente', tipo: 'texto', largura: 28 },
      { titulo: 'Telefone', chave: 'telefone', tipo: 'texto', largura: 16 },
      { titulo: 'Tipo', chave: 'tipo', tipo: 'texto', largura: 12 },
      { titulo: 'Descrição / forma', chave: 'descricao', tipo: 'texto', largura: 34 },
      { titulo: 'Compras (fiado)', chave: 'compra', tipo: 'moeda', largura: 16 },
      { titulo: 'Pagamentos recebidos', chave: 'pagamento', tipo: 'moeda', largura: 20 },
    ],
    linhas: movimentos,
  }

  const abaSaldos = {
    nome: 'Saldo do fiado',
    colunas: [
      { titulo: 'Cliente', chave: 'cliente', tipo: 'texto', largura: 28 },
      { titulo: 'Telefone', chave: 'telefone', tipo: 'texto', largura: 16 },
      { titulo: 'Compras no período', chave: 'compras', tipo: 'moeda', largura: 20 },
      { titulo: 'Pagamentos no período', chave: 'pagamentos', tipo: 'moeda', largura: 22 },
      { titulo: 'Saldo devedor hoje', chave: 'saldo', tipo: 'moeda', largura: 20 },
    ],
    linhas: clientes
      .map((c) => ({
        cliente: c.nome,
        telefone: c.telefone || '',
        compras: soma(movimentos.filter((m) => m.cliente === c.nome && m.tipo === 'Compra'), 'compra'),
        pagamentos: soma(movimentos.filter((m) => m.cliente === c.nome && m.tipo === 'Pagamento'), 'pagamento'),
        saldo: saldoCliente ? saldoCliente(c) : 0,
      }))
      .sort((a, b) => b.saldo - a.saldo),
  }

  // ----- aba Resumo -----
  const totalVendas = soma(vendasPeriodo)
  const totalDespesas = soma(despesasPeriodo)
  const totalPagos = soma(pagos)
  const resultado = arred(totalVendas - totalDespesas - totalPagos)

  const porCategoria = {}
  despesasPeriodo.forEach((d) => {
    const c = d.categoria || 'Outros'
    porCategoria[c] = (porCategoria[c] || 0) + num(d.valor)
  })
  pagos.forEach((b) => {
    const c = `Boleto: ${b.categoria || 'sem categoria'}`
    porCategoria[c] = (porCategoria[c] || 0) + num(b.valor)
  })

  const resumo = {
    nome: 'Resumo',
    titulo: nomeLoja || 'Relatório',
    subtitulo: `Período: ${descreverPeriodo(periodo)}`,
    totais: [
      ['Vendas (entradas)', totalVendas],
      ['Despesas', totalDespesas],
      ['Boletos pagos', totalPagos],
      ['Sobrou no período (vendas − despesas − boletos pagos)', resultado],
      ['Boletos em aberto com vencimento no período', soma(abertos)],
      ['Quantidade de boletos em aberto', abertos.length, 'inteiro'],
      ['Fiado a receber hoje (todos os clientes)', arred(clientes.reduce((t, c) => t + Math.max(0, saldoCliente ? saldoCliente(c) : 0), 0))],
    ],
    categorias: Object.entries(porCategoria).sort((a, b) => b[1] - a[1]),
    meses: [],
  }

  if (periodo.tipo !== 'mes') {
    const chaves = new Set()
    ;[...vendas.map((v) => v.data), ...despesas.map((d) => d.data), ...boletos.filter((b) => b.pago).map((b) => b.dataPagamento)]
      .filter((d) => no(d) && /^\d{4}-\d{2}/.test(d || ''))
      .forEach((d) => chaves.add(d.slice(0, 7)))
    resumo.meses = [...chaves].sort().map((m) => {
      const v = soma(vendas.filter((x) => (x.data || '').startsWith(m)))
      const d = soma(despesas.filter((x) => (x.data || '').startsWith(m)))
      const p = soma(boletos.filter((b) => b.pago && (b.dataPagamento || '').startsWith(m)))
      return [nomeMes(m), v, d, p, arred(v - d - p)]
    })
  }

  return { resumo, abas: [abaBoletos, abaDespesas, abaFiado, abaVendas, abaSaldos] }
}

const FORMATO_DINHEIRO = '"R$" #,##0.00'

function criarAbaTabela({ colunas, linhas }) {
  const cabecalho = colunas.map((c) => c.titulo)
  const corpo = linhas.map((l) =>
    colunas.map((c) => {
      const v = l[c.chave]
      if (c.tipo === 'moeda') return v === '' || v == null ? '' : num(v)
      if (c.tipo === 'data') return dataLocal(v) || ''
      return v == null ? '' : String(v)
    })
  )
  const colunasMoeda = colunas.map((c, i) => (c.tipo === 'moeda' ? i : -1)).filter((i) => i >= 0)
  const aoa = [cabecalho, ...corpo]
  const ultima = corpo.length // índice (base 0) da última linha de dados
  if (corpo.length && colunasMoeda.length) {
    const total = colunas.map(() => '')
    total[0] = 'TOTAL'
    colunasMoeda.forEach((i) => {
      total[i] = arred(linhas.reduce((t, l) => t + num(l[colunas[i].chave]), 0))
    })
    aoa.push(total)
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true })
  colunas.forEach((c, i) => {
    for (let r = 1; r <= ultima; r++) {
      const cel = ws[XLSX.utils.encode_cell({ r, c: i })]
      if (!cel) continue
      if (c.tipo === 'moeda' && cel.t === 'n') cel.z = FORMATO_DINHEIRO
      if (c.tipo === 'data' && (cel.t === 'd' || cel.t === 'n')) cel.z = 'dd/mm/yyyy'
    }
  })
  if (corpo.length && colunasMoeda.length) {
    colunasMoeda.forEach((i) => {
      const letra = XLSX.utils.encode_col(i)
      const endereco = XLSX.utils.encode_cell({ r: ultima + 1, c: i })
      const valor = aoa[ultima + 1][i]
      ws[endereco] = { t: 'n', v: valor, f: `SUM(${letra}2:${letra}${ultima + 1})`, z: FORMATO_DINHEIRO }
    })
  }
  ws['!cols'] = colunas.map((c) => ({ wch: c.largura || 14 }))
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(ultima, 1), c: colunas.length - 1 } }) }
  return ws
}

function criarAbaResumo(resumo) {
  const aoa = [[resumo.titulo], [resumo.subtitulo], []]
  const formatos = [] // [linha, coluna, formato]
  const guardar = (valor, r, c, z) => {
    if (z) formatos.push([r, c, z])
    return valor
  }

  aoa.push(['Totais', 'Valor'])
  resumo.totais.forEach(([rotulo, valor, tipo]) => {
    aoa.push([rotulo, guardar(valor, aoa.length, 1, tipo === 'inteiro' ? '0' : FORMATO_DINHEIRO)])
  })

  if (resumo.categorias.length) {
    aoa.push([], ['Para onde foi o dinheiro (despesas e boletos pagos)', 'Valor'])
    resumo.categorias.forEach(([cat, valor]) => aoa.push([cat, guardar(valor, aoa.length, 1, FORMATO_DINHEIRO)]))
  }

  if (resumo.meses.length) {
    aoa.push([], ['Mês a mês', 'Vendas', 'Despesas', 'Boletos pagos', 'Sobrou'])
    resumo.meses.forEach(([mes, v, d, p, r]) => {
      const linha = aoa.length
      aoa.push([mes, guardar(v, linha, 1, FORMATO_DINHEIRO), guardar(d, linha, 2, FORMATO_DINHEIRO), guardar(p, linha, 3, FORMATO_DINHEIRO), guardar(r, linha, 4, FORMATO_DINHEIRO)])
    })
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  formatos.forEach(([r, c, z]) => {
    const cel = ws[XLSX.utils.encode_cell({ r, c })]
    if (cel && cel.t === 'n') cel.z = z
  })
  ws['!cols'] = [{ wch: 58 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }]
  return ws
}

export async function exportarExcel({ periodo, ...dados }) {
  const { resumo, abas } = prepararPlanilhas({ ...dados, periodo })
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, criarAbaResumo(resumo), resumo.nome)
  abas.forEach((aba) => XLSX.utils.book_append_sheet(workbook, criarAbaTabela(aba), aba.nome.slice(0, 31)))

  const sufixo = periodo.tipo === 'mes' ? periodo.mes : periodo.tipo === 'ano' ? String(periodo.mes).slice(0, 4) : 'completo'
  XLSX.writeFile(workbook, `relatorio-${sufixo}.xlsx`)
}

// ---------------------------------------------------------------- PDF
export async function exportarRelatorioPDF({ mes, nomeLoja, resumo, despesasPorCategoria, despesasLista = [], boletosPagos, boletosAbertos }) {
  if (typeof autoTable !== 'function') throw new Error('A biblioteca de tabelas do PDF não foi carregada.')
  const doc = new jsPDF()
  const margem = { left: 14, right: 14 }
  let y = 18

  doc.setFontSize(16)
  doc.text(`${nomeLoja || 'Relatório'} - ${nomeMes(mes)}`, 14, y)
  doc.setFontSize(11)
  y += 14
  ;[
    `Vendas: ${dinheiro(resumo.vendas)}`,
    `Despesas: ${dinheiro(resumo.despesas)}`,
    `Boletos pagos: ${dinheiro(resumo.boletosPagos)}`,
    `Resultado: ${dinheiro(resumo.resultado)}`,
  ].forEach((linha) => {
    doc.text(linha, 14, y)
    y += 8
  })
  y += 6

  const tabela = (titulo, cabecalho, corpo) => {
    if (!corpo.length) return
    if (y > 250) {
      doc.addPage()
      y = 20
    }
    doc.setFontSize(12)
    doc.text(titulo, 14, y)
    autoTable(doc, { startY: y + 4, head: [cabecalho], body: corpo, styles: { fontSize: 9 }, headStyles: { fillColor: [92, 27, 23] }, margin: margem })
    y = (doc.lastAutoTable?.finalY ?? y + 30) + 12
  }

  tabela('Despesas por categoria', ['Categoria', 'Valor'], (despesasPorCategoria || []).map(([c, v]) => [c, dinheiro(v)]))
  tabela('Boletos pagos', ['Fornecedor', 'Valor', 'Vencimento', 'Pago em'], (boletosPagos || []).map((b) => [b.fornecedor || 'Sem nome', dinheiro(b.valor), dataBR(b.vencimento) || '-', dataBR(b.dataPagamento) || '-']))
  tabela('Boletos em aberto', ['Fornecedor', 'Valor', 'Vencimento'], (boletosAbertos || []).map((b) => [b.fornecedor || 'Sem nome', dinheiro(b.valor), dataBR(b.vencimento) || '-']))
  tabela('Despesas do mês', ['Data', 'Descrição', 'Categoria', 'Valor'], despesasLista.map((d) => [dataBR(d.data), d.descricao || '-', d.categoria || 'Outros', dinheiro(d.valor)]))

  doc.save(`relatorio-${mes}.pdf`)
}

export default { exportarExcel, exportarRelatorioPDF, prepararPlanilhas, descreverPeriodo }
