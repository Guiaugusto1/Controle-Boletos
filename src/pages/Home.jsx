import { Box, Button, Flex, Grid, Heading, HStack, Link, Stack, Text, useToast } from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'
import { useLoja, statusBoleto, saldoCliente } from '../contexts/LojaContext'
import { Bloco, Cabecalho, StatusBoleto } from '../components/Comum'
import { diasAte, formatarData, formatarMes, formatarMoeda, mesAtualISO, somar } from '../utils/formatters'

function Numero({ rotulo, valor, detalhe, destaque }) {
  return (
    <Box>
      <Text fontSize="sm" color="marrom.300" fontWeight={600}>
        {rotulo}
      </Text>
      <Text fontSize={destaque ? '3xl' : '2xl'} fontWeight={700} color={destaque || 'marrom.500'} lineHeight="1.2">
        {formatarMoeda(valor)}
      </Text>
      {detalhe && (
        <Text fontSize="xs" color="marrom.300">
          {detalhe}
        </Text>
      )}
    </Box>
  )
}

function quandoVence(vencimento) {
  const dias = diasAte(vencimento)
  if (dias === null) return 'sem data'
  if (dias < -1) return `venceu há ${-dias} dias`
  if (dias === -1) return 'venceu ontem'
  if (dias === 0) return 'vence hoje'
  if (dias === 1) return 'vence amanhã'
  return `vence em ${dias} dias`
}

function Home() {
  const { boletos, despesas, vendas, clientes, config, pagarBoleto } = useLoja()
  const toast = useToast()
  const mes = mesAtualISO()

  const vendasMes = somar(vendas.filter((v) => v.data?.startsWith(mes)))
  const despesasMes = somar(despesas.filter((d) => d.data?.startsWith(mes)))
  const boletosPagosMes = somar(boletos.filter((b) => b.pago && b.dataPagamento?.startsWith(mes)))
  const saidasMes = despesasMes + boletosPagosMes
  const resultado = vendasMes - saidasMes

  const abertos = boletos.filter((b) => !b.pago)
  const totalAPagar = somar(abertos)
  const proximos = abertos
    .filter((b) => {
      const d = diasAte(b.vencimento)
      return d !== null && d <= 7
    })
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))

  const devedores = clientes
    .map((c) => ({ ...c, saldo: saldoCliente(c) }))
    .filter((c) => c.saldo > 0.009)
    .sort((a, b) => b.saldo - a.saldo)
  const totalReceber = somar(devedores, 'saldo')

  const pagar = (b) => {
    pagarBoleto(b.id)
    toast({ title: `Boleto de ${b.fornecedor} marcado como pago.`, status: 'success' })
  }

  return (
    <Box>
      <Cabecalho titulo={config.nomeLoja} descricao={`Resumo de ${formatarMes(mes)}.`} />

      <Bloco mb={6}>
        <Grid templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }} gap={6}>
          <Numero rotulo="Vendas do mês" valor={vendasMes} detalhe={`${vendas.filter((v) => v.data?.startsWith(mes)).length} lançamento(s)`} />
          <Numero rotulo="Saídas do mês" valor={saidasMes} detalhe="Despesas + boletos pagos" />
          <Numero
            rotulo="Resultado do mês"
            valor={resultado}
            destaque={resultado >= 0 ? 'pago.600' : 'atraso.600'}
            detalhe={resultado >= 0 ? 'Entrou mais do que saiu' : 'Saiu mais do que entrou'}
          />
        </Grid>
      </Bloco>

      <Grid templateColumns={{ base: '1fr', lg: '3fr 2fr' }} gap={6} alignItems="start">
        <Bloco>
          <Flex justify="space-between" align="baseline" mb={1} gap={2} wrap="wrap">
            <Heading as="h2" fontSize="2xl">
              Contas para pagar
            </Heading>
            <Text fontSize="sm" color="marrom.300">
              {formatarMoeda(totalAPagar)} em aberto
            </Text>
          </Flex>
          <Text fontSize="sm" color="marrom.300" mb={4}>
            Vencidas e as que vencem nos próximos 7 dias.
          </Text>

          {proximos.length === 0 ? (
            <Text fontSize="sm" py={4}>
              Nenhum boleto vencido ou vencendo esta semana.{' '}
              <Link as={RouterLink} to="/boletos/novo" color="vinho.500" fontWeight={600}>
                Cadastrar boleto
              </Link>
            </Text>
          ) : (
            <Stack spacing={0} divider={<Box borderBottom="1px solid" borderColor="creme.300" />}>
              {proximos.map((b) => (
                <Flex key={b.id} py={3} gap={3} align="center" wrap="wrap">
                  <Box flex="1" minW="160px">
                    <Text fontWeight={600}>{b.fornecedor}</Text>
                    <HStack spacing={2} fontSize="sm" color="marrom.300">
                      <Text>{formatarData(b.vencimento)}</Text>
                      <Text>({quandoVence(b.vencimento)})</Text>
                    </HStack>
                  </Box>
                  <StatusBoleto status={statusBoleto(b, config.diasAlerta)} />
                  <Text fontWeight={700} minW="100px" textAlign="right">
                    {formatarMoeda(b.valor)}
                  </Text>
                  <Button size="sm" variant="outline" onClick={() => pagar(b)}>
                    Pagar
                  </Button>
                </Flex>
              ))}
            </Stack>
          )}
        </Bloco>

        <Bloco>
          <Flex justify="space-between" align="baseline" mb={1} gap={2} wrap="wrap">
            <Heading as="h2" fontSize="2xl">
              Fiado a receber
            </Heading>
            <Text fontWeight={700}>{formatarMoeda(totalReceber)}</Text>
          </Flex>
          <Text fontSize="sm" color="marrom.300" mb={4}>
            {devedores.length === 0 ? 'Nenhum cliente devendo.' : `${devedores.length} cliente(s) com saldo em aberto.`}
          </Text>
          <Stack spacing={2}>
            {devedores.slice(0, 5).map((c) => (
              <Flex key={c.id} justify="space-between" fontSize="sm">
                <Text>{c.nome}</Text>
                <Text fontWeight={600}>{formatarMoeda(c.saldo)}</Text>
              </Flex>
            ))}
          </Stack>
          <Button as={RouterLink} to="/fiados" size="sm" variant="link" mt={4} color="vinho.500">
            Abrir caderneta de fiado
          </Button>
        </Bloco>
      </Grid>
    </Box>
  )
}

export default Home
