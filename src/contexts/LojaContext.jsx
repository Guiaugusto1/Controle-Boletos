// Todos os dados da loja ficam aqui e são salvos no navegador (localStorage).
// Antes, cada tela guardava os dados só na memória: ao trocar de página ou
// atualizar, tudo se perdia. Agora boletos, despesas, vendas e fiados ficam
// salvos e todas as telas leem da mesma fonte.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { diasAte, hojeISO, novoId } from '../utils/formatters'

const CHAVE = 'balaio:dados:v1'
const VERSAO = 1

const configPadrao = { nomeLoja: 'Empório Balaio Mineiro', diasAlerta: 3 }

const vazio = {
  versao: VERSAO,
  config: configPadrao,
  boletos: [],
  despesas: [],
  vendas: [],
  clientes: [],
}

function carregar() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE))
    if (salvo && typeof salvo === 'object') {
      return { ...vazio, ...salvo, config: { ...configPadrao, ...salvo.config } }
    }
    // Aproveita a configuração da versão antiga, se existir
    const antiga = JSON.parse(localStorage.getItem('configuracoes'))
    if (antiga?.diasAlerta) return { ...vazio, config: { ...configPadrao, diasAlerta: antiga.diasAlerta } }
  } catch {
    // dado corrompido: começa vazio
  }
  return vazio
}

export function statusBoleto(boleto, diasAlerta = 3) {
  if (boleto.pago) return 'pago'
  const dias = diasAte(boleto.vencimento)
  if (dias === null) return 'pendente'
  if (dias < 0) return 'vencido'
  if (dias === 0) return 'hoje'
  if (dias <= diasAlerta) return 'proximo'
  return 'pendente'
}

export function saldoCliente(cliente) {
  return cliente.lancamentos.reduce(
    (acc, l) => acc + (l.tipo === 'compra' ? Number(l.valor) : -Number(l.valor)),
    0
  )
}

const LojaContext = createContext(null)

export function LojaProvider({ children }) {
  const [dados, setDados] = useState(carregar)
  const [erroSalvar, setErroSalvar] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(dados))
      setErroSalvar(false)
    } catch {
      setErroSalvar(true)
    }
  }, [dados])

  const atualizarLista = useCallback((lista, fn) => {
    setDados((d) => ({ ...d, [lista]: fn(d[lista]) }))
  }, [])

  // Ações genéricas para listas simples (boletos, despesas, vendas)
  const crud = useCallback(
    (lista) => ({
      adicionar: (item) => {
        const novo = { ...item, id: novoId(), criadoEm: new Date().toISOString() }
        atualizarLista(lista, (l) => [...l, novo])
        return novo
      },
      atualizar: (id, campos) => atualizarLista(lista, (l) => l.map((i) => (i.id === id ? { ...i, ...campos } : i))),
      remover: (id) => atualizarLista(lista, (l) => l.filter((i) => i.id !== id)),
    }),
    [atualizarLista]
  )

  const valor = useMemo(() => {
    const boletos = crud('boletos')
    const despesas = crud('despesas')
    const vendas = crud('vendas')
    const clientesCrud = crud('clientes')

    return {
      ...dados,
      erroSalvar,

      // Boletos
      adicionarBoleto: (b) => boletos.adicionar({ pago: false, ...b }),
      atualizarBoleto: boletos.atualizar,
      removerBoleto: boletos.remover,
      pagarBoleto: (id, data = hojeISO()) => boletos.atualizar(id, { pago: true, dataPagamento: data }),
      desfazerPagamento: (id) => boletos.atualizar(id, { pago: false, dataPagamento: '' }),

      // Despesas e vendas
      adicionarDespesa: despesas.adicionar,
      atualizarDespesa: despesas.atualizar,
      removerDespesa: despesas.remover,
      adicionarVenda: vendas.adicionar,
      atualizarVenda: vendas.atualizar,
      removerVenda: vendas.remover,

      // Fiado: cada cliente tem um extrato de compras e pagamentos
      adicionarCliente: (c) => clientesCrud.adicionar({ lancamentos: [], ...c }),
      atualizarCliente: clientesCrud.atualizar,
      removerCliente: clientesCrud.remover,
      lancarFiado: (clienteId, lancamento) =>
        atualizarLista('clientes', (l) =>
          l.map((c) =>
            c.id === clienteId
              ? { ...c, lancamentos: [...c.lancamentos, { id: novoId(), data: hojeISO(), ...lancamento }] }
              : c
          )
        ),
      removerLancamento: (clienteId, lancamentoId) =>
        atualizarLista('clientes', (l) =>
          l.map((c) =>
            c.id === clienteId ? { ...c, lancamentos: c.lancamentos.filter((x) => x.id !== lancamentoId) } : c
          )
        ),

      // Configurações e backup
      salvarConfig: (campos) => setDados((d) => ({ ...d, config: { ...d.config, ...campos } })),
      exportarBackup: () => JSON.stringify({ ...dados, exportadoEm: new Date().toISOString() }, null, 2),
      importarBackup: (texto) => {
        const obj = JSON.parse(texto)
        const listas = ['boletos', 'despesas', 'vendas', 'clientes']
        if (!obj || !listas.every((k) => Array.isArray(obj[k]))) {
          throw new Error('Arquivo de backup inválido.')
        }
        setDados({ ...vazio, ...obj, config: { ...configPadrao, ...obj.config } })
      },
      apagarTudo: () => setDados({ ...vazio, config: dados.config }),
    }
  }, [dados, erroSalvar, crud, atualizarLista])

  return <LojaContext.Provider value={valor}>{children}</LojaContext.Provider>
}

export function useLoja() {
  const ctx = useContext(LojaContext)
  if (!ctx) throw new Error('useLoja precisa estar dentro de <LojaProvider>')
  return ctx
}
