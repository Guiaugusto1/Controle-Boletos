// Exportação do relatório em PDF (para imprimir ou mandar ao contador)
// e da base completa em Excel. As bibliotecas só carregam quando usadas.
import { formatarData, formatarMes, formatarMoeda } from './formatters'

async function logoComoDataURL() {
  try {
    const resp = await fetch('/logo.png')
    const blob = await resp.blob()
    return await new Promise((resolve) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result)
      r.onerror = () => resolve(null)
      r.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

const VINHO = [92, 27, 23]
const MARROM = [43, 21, 7]
const CREME = [255, 241, 211]

export async function exportarRelatorioPDF({ mes, nomeLoja, resumo, despesasPorCategoria, boletosPagos, boletosAbertos }) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const largura = doc.internal.pageSize.getWidth()

  doc.setFillColor(...MARROM)
  doc.rect(0, 0, largura, 34, 'F')
  const logo = await logoComoDataURL()
  if (logo) doc.addImage(logo, 'PNG', 12, 4, 26, 26)
  doc.setTextColor(...CREME)
  doc.setFont('times', 'bold')
  doc.setFontSize(20)
  doc.text('Relatório mensal', 44, 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(`${nomeLoja}, ${formatarMes(mes)}`, 44, 24)

  const tabela = (titulo, cabecalho, linhas, inicio) => {
    doc.setTextColor(...MARROM)
    doc.setFont('times', 'bold')
    doc.setFontSize(14)
    doc.text(titulo, 14, inicio)
    autoTable(doc, {
      startY: inicio + 3,
      head: [cabecalho],
      body: linhas.length ? linhas : [[{ content: 'Nada neste mês.', colSpan: cabecalho.length }]],
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, textColor: MARROM, lineColor: [230, 208, 163] },
      headStyles: { fillColor: VINHO, textColor: CREME },
      alternateRowStyles: { fillColor: [255, 248, 234] },
      didParseCell: (d) => {
        if (d.column.index === cabecalho.length - 1) d.cell.styles.halign = 'right'
      },
      margin: { left: 14, right: 14 },
    })
    return doc.lastAutoTable.finalY + 10
  }

  let y = 46
  y = tabela('Resumo', ['Item', 'Valor'], [
    ['Vendas (entradas no caixa)', formatarMoeda(resumo.vendas)],
    ['Despesas', formatarMoeda(resumo.despesas)],
    ['Boletos pagos', formatarMoeda(resumo.boletosPagos)],
    [{ content: 'Resultado do mês', styles: { fontStyle: 'bold' } }, { content: formatarMoeda(resumo.resultado), styles: { fontStyle: 'bold' } }],
    ['Fiado a receber (hoje)', formatarMoeda(resumo.fiadoReceber)],
    ['Boletos em aberto vencendo no mês', formatarMoeda(resumo.boletosAbertos)],
  ], y)
  y = tabela('Despesas por categoria', ['Categoria', 'Valor'], despesasPorCategoria.map(([c, v]) => [c, formatarMoeda(v)]), y)
  y = tabela('Boletos pagos', ['Pago em', 'Fornecedor', 'Vencimento', 'Valor'], boletosPagos.map((b) => [formatarData(b.dataPagamento), b.fornecedor, formatarData(b.vencimento), formatarMoeda(b.valor)]), y)
  tabela('Boletos em aberto', ['Vencimento', 'Fornecedor', 'Categoria', 'Valor'], boletosAbertos.map((b) => [formatarData(b.vencimento), b.fornecedor, b.categoria || '', formatarMoeda(b.valor)]), y)

  const paginas = doc.getNumberOfPages()
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(140, 114, 70)
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}  |  página ${i} de ${paginas}`, 14, doc.internal.pageSize.getHeight() - 8)
  }
  doc.save(`relatorio-${mes}.pdf`)
}

export async function exportarExcel({ boletos, despesas, vendas, clientes, saldoCliente }) {
  const XLSX = await import('xlsx')
  const livro = XLSX.utils.book_new()
  const aba = (nome, linhas) => {
    const planilha = XLSX.utils.json_to_sheet(linhas.length ? linhas : [{ Aviso: 'Sem registros' }])
    XLSX.utils.book_append_sheet(livro, planilha, nome)
  }
  aba('Boletos', boletos.map((b) => ({
    Fornecedor: b.fornecedor,
    Categoria: b.categoria || '',
    Valor: b.valor,
    Vencimento: formatarData(b.vencimento),
    Pago: b.pago ? 'Sim' : 'Não',
    'Pago em': b.pago ? formatarData(b.dataPagamento) : '',
    Banco: b.banco || '',
    CNPJ: b.cnpj || '',
    'Linha digitável': b.codigo || '',
  })))
  aba('Despesas', despesas.map((d) => ({ Data: formatarData(d.data), Descrição: d.descricao, Categoria: d.categoria || '', Valor: d.valor })))
  aba('Vendas', vendas.map((v) => ({ Data: formatarData(v.data), Forma: v.forma || '', Valor: v.valor, Observação: v.observacao || '' })))
  aba('Fiado - clientes', clientes.map((c) => ({ Cliente: c.nome, Telefone: c.telefone || '', Saldo: saldoCliente(c) })))
  aba('Fiado - extrato', clientes.flatMap((c) => c.lancamentos.map((l) => ({
    Cliente: c.nome,
    Data: formatarData(l.data),
    Tipo: l.tipo === 'compra' ? 'Compra' : 'Pagamento',
    Valor: l.valor,
    Descrição: l.descricao || '',
  }))))
  XLSX.writeFile(livro, `controle-loja-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
