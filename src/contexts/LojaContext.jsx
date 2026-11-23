import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Button, Center, Spinner, Text } from '@chakra-ui/react'
import { carregarEstado as buscarNoServidor, salvarEstado as enviarAoServidor, sair } from '../utils/api'

const defaultConfig = {
  nomeLoja: 'Empório Balaio Mineiro',
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

function normalizarConfig(config = {}) {
  const nomeLoja = config.nomeLoja === 'Minha loja' ? defaultConfig.nomeLoja : config.nomeLoja
  return { ...defaultConfig, ...config, nomeLoja: nomeLoja || defaultConfig.nomeLoja }
}

function makeId(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`
}

// Garante que o que veio do servidor (ou de um backup) tenha o formato esperado
function normalizarEstado(dados) {
  const d = dados && typeof dados === 'object' ? dados : {}
  return {
    ...defaultState,
    ...d,
    config: normalizarConfig(d.config),
    boletos: Array.isArray(d.boletos) ? d.boletos : [],
    despesas: Array.isArray(d.despesas) ? d.despesas : [],
    vendas: Array.isArray(d.vendas) ? d.vendas : [],
    clientes: Array.isArray(d.clientes) ? d.clientes : [],
  }
}

export function LojaProvider({ children }) {
  const [estado, setEstado] = useState(defaultState)
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState('')
  const [erroSalvar, setErroSalvar] = useState(false)
  const versaoRef = useRef(0) // versão que o servidor tem de nossos dados
  const prontoRef = useRef(false) // só salva depois de carregar
  const pendenteRef = useRef(false) // há alteração ainda não enviada
  const ignorarRef = useRef(false) // mudança que veio do servidor não precisa voltar

  const aplicarDoServidor = (resposta) => {
    versaoRef.current = resposta.versao
    ignorarRef.current = true
    setEstado(normalizarEstado(resposta.dados))
  }

  // 1) ao abrir: busca os dados no banco
  const carregar = async () => {
    setErroCarga('')
    setCarregando(true)
    try {
      aplicarDoServidor(await buscarNoServidor())
      prontoRef.current = true
    } catch (e) {
      setErroCarga(e.message || 'Não foi possível carregar os dados.')
    } finally {
      setCarregando(false)
    }
  }
  const iniciouRef = useRef(false)
  useEffect(() => {
    if (iniciouRef.current) return
    iniciouRef.current = true
    carregar()
  }, [])

  // 2) a cada alteração: espera um instante e envia ao banco
  useEffect(() => {
    if (!prontoRef.current) return undefined
    if (ignorarRef.current) {
      ignorarRef.current = false
      return undefined
    }
    pendenteRef.current = true
    const espera = setTimeout(async () => {
      try {
        const r = await enviarAoServidor(estado, versaoRef.current)
        versaoRef.current = r.versao
        pendenteRef.current = false
        setErroSalvar(false)
      } catch (e) {
        if (e.status === 409) {
          // outro aparelho salvou antes: traz a versão dele
          pendenteRef.current = false
          try {
            aplicarDoServidor(await buscarNoServidor())
            window.alert('Os dados foram alterados em outro aparelho. A tela foi atualizada; refaça sua última alteração.')
          } catch {
            setErroSalvar(true)
          }
        } else {
          setErroSalvar(true)
        }
      }
    }, 700)
    return () => clearTimeout(espera)
  }, [estado])

  // 3) ao voltar para a aba/app: atualiza com o que foi feito em outro aparelho
  useEffect(() => {
    const aoVoltar = async () => {
      if (document.visibilityState !== 'visible' || !prontoRef.current || pendenteRef.current) return
      try {
        const r = await buscarNoServidor()
        if (r.versao !== versaoRef.current) aplicarDoServidor(r)
      } catch {
        /* sem internet: mantém o que está na tela */
      }
    }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => document.removeEventListener('visibilitychange', aoVoltar)
  }, [])

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
      setEstado(normalizarEstado(JSON.parse(json)))
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

  if (carregando) {
    return (
      <Center minH="100vh" bg="creme.100">
        <Spinner size="lg" color="vinho.500" />
      </Center>
    )
  }
  if (erroCarga) {
    return (
      <Center minH="100vh" bg="creme.100" px={4}>
        <Box textAlign="center">
          <Text mb={4}>{erroCarga}</Text>
          <Button onClick={carregar} mr={2}>Tentar de novo</Button>
          <Button variant="outline" onClick={sair}>Sair</Button>
        </Box>
      </Center>
    )
  }

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
