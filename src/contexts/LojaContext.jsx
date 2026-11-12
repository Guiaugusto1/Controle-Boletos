import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'balaio-mineiro-state-v1'

const defaultConfig = {
  nomeLoja: 'Minha loja',
  diasAlerta: 7,
}

const defaultState = {
  boletos: [],
  despesas: [],
  vendas: [],
  clientes: [],
  config: defaultConfig,
}

const LojaContext = createContext(null)

function makeId(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`
}

function carregarEstado() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState

    const parsed = JSON.parse(raw)
    return {
      ...defaultState,
      ...parsed,
      config: { ...defaultConfig, ...(parsed.config || {}) },
      boletos: Array.isArray(parsed.boletos) ? parsed.boletos : [],
      despesas: Array.isArray(parsed.despesas) ? parsed.despesas : [],
      vendas: Array.isArray(parsed.vendas) ? parsed.vendas : [],
      clientes: Array.isArray(parsed.clientes) ? parsed.clientes : [],
    }
  } catch {
    return defaultState
  }
}

function salvarEstado(estado) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(estado))
    return true
  } catch {
    return false
  }
}

export function LojaProvider({ children }) {
  const [estado, setEstado] = useState(() => carregarEstado())
  const [erroSalvar, setErroSalvar] = useState(false)

  useEffect(() => {
    setErroSalvar(!salvarEstado(estado))
  }, [estado])

  const value = useMemo(() => ({
    ...estado,
    erroSalvar,
    salvarConfig: (config) => {
      setEstado((prev) => ({
        ...prev,
        config: { ...prev.config, ...config },
      }))
    },
    exportarBackup: () => JSON.stringify(estado, null, 2),
    importarBackup: (json) => {
      const data = JSON.parse(json)
      setEstado({
        ...defaultState,
        ...data,
        config: { ...defaultConfig, ...(data.config || {}) },
        boletos: Array.isArray(data.boletos) ? data.boletos : [],
        despesas: Array.isArray(data.despesas) ? data.despesas : [],
        vendas: Array.isArray(data.vendas) ? data.vendas : [],
        clientes: Array.isArray(data.clientes) ? data.clientes : [],
      })
    },
    apagarTudo: () => setEstado({ ...defaultState }),

    adicionarBoleto: (boleto) => {
      setEstado((prev) => ({
        ...prev,
        boletos: [{ id: makeId('boleto'), ...boleto }, ...prev.boletos],
      }))
    },
    atualizarBoleto: (id, boleto) => {
      setEstado((prev) => ({
        ...prev,
        boletos: prev.boletos.map((item) => (item.id === id ? { ...item, ...boleto } : item)),
      }))
    },
    removerBoleto: (id) => {
      setEstado((prev) => ({
        ...prev,
        boletos: prev.boletos.filter((item) => item.id !== id),
      }))
    },
    pagarBoleto: (id) => {
      setEstado((prev) => ({
        ...prev,
        boletos: prev.boletos.map((item) => (item.id === id ? { ...item, pago: true, dataPagamento: item.dataPagamento || new Date().toISOString().slice(0, 10) } : item)),
      }))
    },
    desfazerPagamento: (id) => {
      setEstado((prev) => ({
        ...prev,
        boletos: prev.boletos.map((item) => (item.id === id ? { ...item, pago: false, dataPagamento: '' } : item)),
      }))
    },

    adicionarDespesa: (despesa) => {
      setEstado((prev) => ({
        ...prev,
        despesas: [{ id: makeId('despesa'), ...despesa }, ...prev.despesas],
      }))
    },
    atualizarDespesa: (id, despesa) => {
      setEstado((prev) => ({
        ...prev,
        despesas: prev.despesas.map((item) => (item.id === id ? { ...item, ...despesa } : item)),
      }))
    },
    removerDespesa: (id) => {
      setEstado((prev) => ({
        ...prev,
        despesas: prev.despesas.filter((item) => item.id !== id),
      }))
    },

    adicionarVenda: (venda) => {
      setEstado((prev) => ({
        ...prev,
        vendas: [{ id: makeId('venda'), criadoEm: new Date().toISOString(), ...venda }, ...prev.vendas],
      }))
    },
    atualizarVenda: (id, venda) => {
      setEstado((prev) => ({
        ...prev,
        vendas: prev.vendas.map((item) => (item.id === id ? { ...item, ...venda } : item)),
      }))
    },
    removerVenda: (id) => {
      setEstado((prev) => ({
        ...prev,
        vendas: prev.vendas.filter((item) => item.id !== id),
      }))
    },

    adicionarCliente: (cliente) => {
      setEstado((prev) => ({
        ...prev,
        clientes: [{ id: makeId('cliente'), lancamentos: [], ...cliente }, ...prev.clientes],
      }))
    },
    atualizarCliente: (id, cliente) => {
      setEstado((prev) => ({
        ...prev,
        clientes: prev.clientes.map((item) => (item.id === id ? { ...item, ...cliente } : item)),
      }))
    },
    lancarFiado: (clienteId, lancamento) => {
      setEstado((prev) => ({
        ...prev,
        clientes: prev.clientes.map((cliente) => {
          if (cliente.id !== clienteId) return cliente
          return {
            ...cliente,
            lancamentos: [{ id: makeId('lancamento'), ...lancamento }, ...(cliente.lancamentos || [])],
          }
        }),
      }))
    },
    removerLancamento: (clienteId, lancamentoId) => {
      setEstado((prev) => ({
        ...prev,
        clientes: prev.clientes.map((cliente) => {
          if (cliente.id !== clienteId) return cliente
          return { ...cliente, lancamentos: (cliente.lancamentos || []).filter((item) => item.id !== lancamentoId) }
        }),
      }))
    },
    removerCliente: (id) => {
      setEstado((prev) => ({
        ...prev,
        clientes: prev.clientes.filter((item) => item.id !== id),
      }))
    },
  }), [estado, erroSalvar])

  return <LojaContext.Provider value={value}>{children}</LojaContext.Provider>
}

export function useLoja() {
  const contexto = useContext(LojaContext)
  if (!contexto) throw new Error('useLoja deve ser usado dentro de LojaProvider')
  return contexto
}

export function saldoCliente(cliente) {
  const lancamentos = Array.isArray(cliente?.lancamentos) ? cliente.lancamentos : []
  return lancamentos.reduce((total, lancamento) => {
    if (lancamento?.tipo === 'compra') return total + Number(lancamento.valor || 0)
    if (lancamento?.tipo === 'pagamento') return total - Number(lancamento.valor || 0)
    return total
  }, 0)
}

export function statusBoleto(boleto, diasAlerta = 7) {
  if (!boleto) return 'aberto'
  if (boleto.pago) return 'pago'
  if (!boleto.vencimento) return 'aberto'

  const [ano, mes, dia] = boleto.vencimento.split('-').map(Number)
  if (!ano || !mes || !dia) return 'aberto'

  const hoje = new Date()
  const limite = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const vencimento = new Date(ano, mes - 1, dia)
  const diff = Math.round((vencimento - limite) / 86400000)

  if (diff < 0) return 'vencido'
  if (diff === 0) return 'hoje'
  if (diff <= diasAlerta) return 'proximo'
  return 'aberto'
}
