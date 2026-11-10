import { Box, Button, Flex, Grid, Heading, Input, Stack, Text, Tooltip, useToast } from '@chakra-ui/react'
import { FiDownload, FiPrinter } from 'react-icons/fi'
import { useMemo, useState } from 'react'
import { useLoja, saldoCliente } from '../contexts/LojaContext'
import { Bloco, Cabecalho } from '../components/Comum'
import { formatarMes, formatarMoeda, mesAtualISO, paraData, paraISO, somar } from '../utils/formatters'
import { exportarExcel, exportarRelatorioPDF } from '../utils/exportar'

function Linha({ rotulo, valor, forte, cor }) {
  return (
    <Flex justify="space-between" py={2} borderTop="1px solid" borderColor="creme.300" fontWeight={forte ? 700 : 400} fontSize={forte ? 'lg' : 'md'}>
      <Text>{rotulo}</Text>
      <Text color={cor}>{valor}</Text>
    </Flex>
  )
}

function mesesAnteriores(mes, quantidade) {
  const base = paraData(`${mes}-01`)
  return Array.from({ length: quantidade }, (_, i) => paraISO(new Date(base.getFullYear(), base.getMonth() - (quantidade - 1 - i), 1)).slice(0, 7))
}

function Relatorios() {
  const loja = useLoja()
  const { boletos, despesas, vendas, clientes, config } = loja
  const toast = useToast()
  const [mes, setMes] = useState(mesAtualISO())
  const [gerando, setGerando] = useState('')

  const calc = useMemo(() => {
    const doMes = (lista, campo) => lista.filter((i) => i[campo]?.startsWith(mes))
    const vendasMes = somar(doMes(vendas, 'data'))
    const despesasMesLista = doMes(despesas, 'data')
    const despesasMes = somar(despesasMesLista)
    const pagos = doMes(boletos.filter((b) => b.pago), 'dataPagamento').sort((a, b) => a.dataPagamento.localeCompare(b.dataPagamento))
    const abertos = doMes(boletos.filter((b) => !b.pago), 'vencimento').sort((a, b) => a.vencimento.localeCompare(b.vencimento))
    const porCategoria = {}
    despesasMesLista.forEach((d) => (porCategoria[d.categoria || 'Outros'] = (porCategoria[d.categoria || 'Outros'] || 0) + d.valor))
    pagos.forEach((b) => {
      const c = `Boleto: ${b.categoria || 'sem categoria'}`
      porCategoria[c] = (porCategoria[c] || 0) + b.valor
    })
    return {
      vendas: vendasMes,
      despesas: despesasMes,
      boletosPagos: somar(pagos),
      resultado: vendasMes - despesasMes - somar(pagos),
      fiadoReceber: somar(clientes.map((c) => ({ valor: Math.max(0, saldoCliente(c)) }))),
      boletosAbertos: somar(abertos),
      pagos,
      abertos,
      porCategoria: Object.entries(porCategoria).sort((a, b) => b[1] - a[1]),
    }
  }, [mes, vendas, despesas, boletos, clientes])

  const historico = useMemo(() => {
    return mesesAnteriores(mes, 6).map((m) => {
      const entrada = somar(vendas.filter((v) => v.data?.startsWith(m)))
      const saida = somar(despesas.filter((d) => d.data?.startsWith(m))) + somar(boletos.filter((b) => b.pago && b.dataPagamento?.startsWith(m)))
      return { mes: m, entrada, saida }
    })
  }, [mes, vendas, despesas, boletos])
  const maior = Math.max(1, ...historico.flatMap((h) => [h.entrada, h.saida]))

  const gerarPDF = async () => {
    setGerando('pdf')
    try {
      await exportarRelatorioPDF({
        mes,
        nomeLoja: config.nomeLoja,
        resumo: calc,
        despesasPorCategoria: calc.porCategoria,
        boletosPagos: calc.pagos,
        boletosAbertos: calc.abertos,
      })
    } catch (e) {
      console.error(e)
      toast({ title: 'Não foi possível gerar o PDF.', status: 'error' })
    } finally {
      setGerando('')
    }
  }

  const gerarExcel = async () => {
    setGerando('excel')
    try {
      await exportarExcel({ boletos, despesas, vendas, clientes, saldoCliente })
    } catch (e) {
      console.error(e)
      toast({ title: 'Não foi possível gerar a planilha.', status: 'error' })
    } finally {
      setGerando('')
    }
  }

  return (
    <Box>
      <Cabecalho titulo="Relatórios" descricao="Quanto entrou, quanto saiu e o que sobrou em cada mês.">
        <Button leftIcon={<FiPrinter />} onClick={gerarPDF} isLoading={gerando === 'pdf'} loadingText="Gerando">
          Baixar PDF do mês
        </Button>
        <Button leftIcon={<FiDownload />} variant="outline" onClick={gerarExcel} isLoading={gerando === 'excel'} loadingText="Gerando">
          Planilha Excel
        </Button>
      </Cabecalho>

      <Flex align="center" gap={3} mb={6}>
        <Input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} maxW="230px" aria-label="Mês do relatório" />
        <Text color="marrom.300" fontSize="sm">
          {formatarMes(mes)}
        </Text>
      </Flex>

      <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={6} alignItems="start">
        <Bloco>
          <Heading as="h2" fontSize="2xl" mb={3}>
            Resultado
          </Heading>
          <Linha rotulo="Vendas (entradas)" valor={formatarMoeda(calc.vendas)} />
          <Linha rotulo="Despesas" valor={`− ${formatarMoeda(calc.despesas)}`} />
          <Linha rotulo="Boletos pagos" valor={`− ${formatarMoeda(calc.boletosPagos)}`} />
          <Linha rotulo="Sobrou no mês" valor={formatarMoeda(calc.resultado)} forte cor={calc.resultado >= 0 ? 'pago.600' : 'atraso.600'} />
          <Stack mt={5} spacing={1} fontSize="sm" color="marrom.400">
            <Text>
              Fiado a receber hoje: <strong>{formatarMoeda(calc.fiadoReceber)}</strong>
            </Text>
            <Text>
              Boletos em aberto vencendo neste mês: <strong>{formatarMoeda(calc.boletosAbertos)}</strong> ({calc.abertos.length})
            </Text>
          </Stack>
        </Bloco>

        <Bloco>
          <Heading as="h2" fontSize="2xl" mb={1}>
            Últimos 6 meses
          </Heading>
          <Flex gap={4} fontSize="xs" color="marrom.300" mb={4}>
            <Flex align="center" gap={1}>
              <Box w="10px" h="10px" bg="pago.500" borderRadius="sm" /> Entradas
            </Flex>
            <Flex align="center" gap={1}>
              <Box w="10px" h="10px" bg="vinho.500" borderRadius="sm" /> Saídas
            </Flex>
          </Flex>
          <Flex align="flex-end" justify="space-between" h="180px" gap={2} role="img" aria-label="Gráfico de entradas e saídas dos últimos seis meses">
            {historico.map((h) => (
              <Flex key={h.mes} direction="column" align="center" flex="1" h="100%" justify="flex-end">
                <Flex align="flex-end" gap="3px" h="100%" w="100%" justify="center">
                  <Tooltip label={`Entradas: ${formatarMoeda(h.entrada)}`}>
                    <Box w="40%" maxW="22px" h={`${(h.entrada / maior) * 100}%`} minH={h.entrada ? '2px' : 0} bg="pago.500" borderTopRadius="sm" />
                  </Tooltip>
                  <Tooltip label={`Saídas: ${formatarMoeda(h.saida)}`}>
                    <Box w="40%" maxW="22px" h={`${(h.saida / maior) * 100}%`} minH={h.saida ? '2px' : 0} bg="vinho.500" borderTopRadius="sm" />
                  </Tooltip>
                </Flex>
                <Text fontSize="xs" mt={1} color={h.mes === mes ? 'marrom.500' : 'marrom.300'} fontWeight={h.mes === mes ? 700 : 400}>
                  {formatarMes(h.mes).slice(0, 3)}
                </Text>
              </Flex>
            ))}
          </Flex>
        </Bloco>

        <Bloco gridColumn={{ lg: 'span 2' }}>
          <Heading as="h2" fontSize="2xl" mb={3}>
            Para onde foi o dinheiro
          </Heading>
          {calc.porCategoria.length === 0 ? (
            <Text fontSize="sm" color="marrom.300">
              Nenhuma despesa ou boleto pago neste mês.
            </Text>
          ) : (
            <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} columnGap={8}>
              {calc.porCategoria.map(([cat, valor]) => (
                <Box key={cat} mb={3}>
                  <Flex justify="space-between" fontSize="sm" mb={1}>
                    <Text>{cat}</Text>
                    <Text fontWeight={600}>{formatarMoeda(valor)}</Text>
                  </Flex>
                  <Box h="6px" bg="creme.300" borderRadius="full">
                    <Box h="100%" w={`${(valor / (calc.despesas + calc.boletosPagos)) * 100}%`} bg="vinho.500" borderRadius="full" />
                  </Box>
                </Box>
              ))}
            </Grid>
          )}
        </Bloco>
      </Grid>
    </Box>
  )
}

export default Relatorios
