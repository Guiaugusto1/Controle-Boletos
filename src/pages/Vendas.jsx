import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  Heading,
  IconButton,
  Input,
  Select,
  SimpleGrid,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
} from '@chakra-ui/react'
import { FiEdit2, FiTrash2 } from 'react-icons/fi'
import { useMemo, useState } from 'react'
import { useLoja } from '../contexts/LojaContext'
import { Bloco, Cabecalho, CampoValor, TabelaRolavel, Vazio, useConfirmar } from '../components/Comum'
import { formatarData, formatarMes, formatarMoeda, hojeISO, lerValor, mesAtualISO, somar } from '../utils/formatters'

export const FORMAS = ['Dinheiro', 'Pix', 'Cartão de débito', 'Cartão de crédito', 'Fiado recebido', 'Outro']

const formVazio = () => ({ data: hojeISO(), valor: '', forma: 'Dinheiro', observacao: '' })

function Vendas() {
  const { vendas, adicionarVenda, atualizarVenda, removerVenda } = useLoja()
  const confirmar = useConfirmar()
  const toast = useToast()
  const [form, setForm] = useState(formVazio)
  const [editandoId, setEditandoId] = useState(null)
  const [mes, setMes] = useState(mesAtualISO())

  const alterar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e?.target ? e.target.value : e }))

  const salvar = () => {
    const valor = lerValor(form.valor)
    if (!(valor > 0) || !form.data) {
      toast({ title: 'Informe o valor e a data.', status: 'warning' })
      return
    }
    if (editandoId) {
      atualizarVenda(editandoId, { ...form, valor })
      toast({ title: 'Venda atualizada.', status: 'success' })
    } else {
      adicionarVenda({ ...form, valor })
      toast({ title: `${formatarMoeda(valor)} registrado em ${form.forma.toLowerCase()}.`, status: 'success' })
    }
    setForm({ ...formVazio(), data: form.data, forma: form.forma })
    setEditandoId(null)
  }

  const editar = (v) => {
    setForm({ data: v.data, valor: String(v.valor).replace('.', ','), forma: v.forma || 'Outro', observacao: v.observacao || '' })
    setEditandoId(v.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const excluir = async (v) => {
    if (await confirmar({ titulo: 'Excluir venda?', texto: `O lançamento de ${formatarMoeda(v.valor)} do dia ${formatarData(v.data)} será apagado.` })) {
      removerVenda(v.id)
    }
  }

  const lista = useMemo(
    () => vendas.filter((v) => !mes || v.data?.startsWith(mes)).sort((a, b) => b.data.localeCompare(a.data) || (b.criadoEm || '').localeCompare(a.criadoEm || '')),
    [vendas, mes]
  )

  const total = somar(lista)
  const porForma = FORMAS.map((f) => [f, somar(lista.filter((v) => (v.forma || 'Outro') === f))]).filter(([, v]) => v > 0)
  const dias = new Set(lista.map((v) => v.data)).size
  const totalHoje = somar(vendas.filter((v) => v.data === hojeISO()))

  return (
    <Box>
      <Cabecalho
        titulo="Vendas"
        descricao="Registre o que entrou no caixa: pode ser venda por venda ou o total do dia. Fiado só entra aqui quando o cliente paga."
      />

      <Bloco mb={6}>
        <Flex justify="space-between" align="baseline" mb={3} wrap="wrap" gap={2}>
          <Heading as="h2" fontSize="xl">
            {editandoId ? 'Editar lançamento' : 'Registrar entrada'}
          </Heading>
          <Text fontSize="sm" color="marrom.300">
            Hoje: <strong>{formatarMoeda(totalHoje)}</strong>
          </Text>
        </Flex>
        <SimpleGrid columns={{ base: 1, sm: 2, md: 4 }} spacing={3}>
          <FormControl>
            <FormLabel>Valor</FormLabel>
            <CampoValor value={form.valor} onChange={alterar('valor')} onKeyDown={(e) => e.key === 'Enter' && salvar()} autoFocus />
          </FormControl>
          <FormControl>
            <FormLabel>Forma de pagamento</FormLabel>
            <Select value={form.forma} onChange={alterar('forma')}>
              {FORMAS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </Select>
          </FormControl>
          <FormControl>
            <FormLabel>Data</FormLabel>
            <Input type="date" value={form.data} onChange={alterar('data')} />
          </FormControl>
          <FormControl>
            <FormLabel>Observação</FormLabel>
            <Input value={form.observacao} onChange={alterar('observacao')} placeholder="Opcional" onKeyDown={(e) => e.key === 'Enter' && salvar()} />
          </FormControl>
        </SimpleGrid>
        <Flex gap={2} mt={4}>
          <Button onClick={salvar}>{editandoId ? 'Salvar alterações' : 'Registrar'}</Button>
          {editandoId && (
            <Button variant="ghost" onClick={() => { setEditandoId(null); setForm(formVazio()) }}>
              Cancelar edição
            </Button>
          )}
        </Flex>
      </Bloco>

      <Flex justify="space-between" align="center" mb={3} gap={3} wrap="wrap">
        <Heading as="h2" fontSize="2xl">
          {mes ? `Vendas de ${formatarMes(mes)}` : 'Todas as vendas'}
        </Heading>
        <Flex gap={2}>
          <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} maxW="230px" aria-label="Mês" />
          {mes && (
            <Button variant="ghost" onClick={() => setMes('')}>
              Ver todas
            </Button>
          )}
        </Flex>
      </Flex>

      {lista.length === 0 ? (
        <Vazio titulo="Nenhuma venda neste período" texto="Os lançamentos registrados acima aparecem aqui." />
      ) : (
        <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6} alignItems="start">
          <TabelaRolavel>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Data</Th>
                  <Th>Forma</Th>
                  <Th isNumeric>Valor</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {lista.map((v) => (
                  <Tr key={v.id} bg={editandoId === v.id ? 'creme.200' : undefined}>
                    <Td whiteSpace="nowrap">{formatarData(v.data)}</Td>
                    <Td>
                      <Text>{v.forma || 'Outro'}</Text>
                      {v.observacao && (
                        <Text fontSize="xs" color="marrom.300">
                          {v.observacao}
                        </Text>
                      )}
                    </Td>
                    <Td isNumeric fontWeight={600} whiteSpace="nowrap">
                      {formatarMoeda(v.valor)}
                    </Td>
                    <Td>
                      <Flex gap={1} justify="flex-end">
                        <IconButton icon={<FiEdit2 />} size="xs" variant="ghost" aria-label="Editar lançamento" onClick={() => editar(v)} />
                        <IconButton icon={<FiTrash2 />} size="xs" variant="ghost" color="atraso.600" aria-label="Excluir lançamento" onClick={() => excluir(v)} />
                      </Flex>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TabelaRolavel>

          <Bloco>
            <Text fontSize="sm" color="marrom.300" fontWeight={600}>
              Total
            </Text>
            <Text fontSize="3xl" fontWeight={700}>
              {formatarMoeda(total)}
            </Text>
            <Text fontSize="sm" color="marrom.300" mb={4}>
              Média de {formatarMoeda(dias ? total / dias : 0)} por dia com venda
            </Text>
            {porForma.map(([forma, valor]) => (
              <Flex key={forma} justify="space-between" fontSize="sm" py={1.5} borderTop="1px solid" borderColor="creme.300">
                <Text>{forma}</Text>
                <Text fontWeight={600}>{formatarMoeda(valor)}</Text>
              </Flex>
            ))}
          </Bloco>
        </Grid>
      )}
    </Box>
  )
}

export default Vendas
