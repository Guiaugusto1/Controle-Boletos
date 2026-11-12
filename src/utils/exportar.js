import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

export async function exportarExcel({ boletos = [], despesas = [], vendas = [], clientes = [], saldoCliente }) {
  const planilhas = {
    boletos: boletos.map(({ id, fornecedor, valor, vencimento, categoria, pago, dataPagamento, banco, cnpj, observacao, codigo }) => ({ id, fornecedor, valor, vencimento, categoria, pago, dataPagamento, banco, cnpj, observacao, codigo })),
    despesas: despesas.map(({ id, descricao, categoria, valor, data }) => ({ id, descricao, categoria, valor, data })),
    vendas: vendas.map(({ id, data, valor, forma, observacao }) => ({ id, data, valor, forma, observacao })),
    clientes: clientes.map((cliente) => ({ id: cliente.id, nome: cliente.nome, telefone: cliente.telefone || '', saldo: saldoCliente ? saldoCliente(cliente) : 0, lancamentos: (cliente.lancamentos || []).length })),
  }

  const workbook = XLSX.utils.book_new()
  Object.entries(planilhas).forEach(([nome, dados]) => {
    const sheet = XLSX.utils.json_to_sheet(dados)
    XLSX.utils.book_append_sheet(workbook, sheet, nome.slice(0, 31))
  })

  XLSX.writeFile(workbook, 'backup-loja.xlsx')
}

export async function exportarRelatorioPDF({ mes, nomeLoja, resumo, despesasPorCategoria, boletosPagos, boletosAbertos }) {
  const doc = new jsPDF()
  doc.setFontSize(16)
  doc.text(`${nomeLoja} - Relatório ${mes}`, 14, 18)
  doc.setFontSize(11)
  doc.text(`Vendas: ${resumo.vendas.toFixed(2)}`, 14, 32)
  doc.text(`Despesas: ${resumo.despesas.toFixed(2)}`, 14, 40)
  doc.text(`Boletos pagos: ${resumo.boletosPagos.toFixed(2)}`, 14, 48)
  doc.text(`Resultado: ${resumo.resultado.toFixed(2)}`, 14, 56)

  if (despesasPorCategoria?.length) {
    doc.text('Despesas por categoria', 14, 72)
    doc.autoTable({
      startY: 78,
      head: [['Categoria', 'Valor']],
      body: despesasPorCategoria.map(([categoria, valor]) => [categoria, `R$ ${valor.toFixed(2)}`]),
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    })
  }

  if (boletosPagos?.length) {
    const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 12 : 110
    doc.text('Boletos pagos', 14, finalY)
    doc.autoTable({
      startY: finalY + 6,
      head: [['Fornecedor', 'Valor', 'Vencimento']],
      body: boletosPagos.map((item) => [item.fornecedor || 'Sem nome', `R$ ${Number(item.valor || 0).toFixed(2)}`, item.vencimento || '—']),
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    })
  }

  if (boletosAbertos?.length) {
    const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 12 : 110
    doc.text('Boletos abertos', 14, finalY)
    doc.autoTable({
      startY: finalY + 6,
      head: [['Fornecedor', 'Valor', 'Vencimento']],
      body: boletosAbertos.map((item) => [item.fornecedor || 'Sem nome', `R$ ${Number(item.valor || 0).toFixed(2)}`, item.vencimento || '—']),
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    })
  }

  doc.save(`relatorio-${mes}.pdf`)
}

export default { exportarExcel, exportarRelatorioPDF }
