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

export const CATEGORIAS_DESPESA = ['Mercadoria', 'Aluguel', 'Energia', 'Água', 'Funcionários', 'Transporte e frete', 'Embalagens', 'Manutenção', 'Impostos e taxas', 'Retirada do dono', 'Outros']

const formVazio = () => ({ descricao: '', categoria: 'Mercadoria', valor: '', data: hojeISO() })

function Despesas() {
  const { despesas, adicionarDespesa, atualizarDespesa, removerDespesa } = useLoja()
  const confirmar = useConfirmar()
  const toast = useToast()
  const [form, setForm] = useState(formVazio)
  const [editandoId, setEditandoId] = useState(null)
  const [mes, setMes] = useState(mesAtualISO())

  const alterar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e?.target ? e.target.value : e }))

  const salvar = () => {
    const valor = lerValor(form.valor)
    if (!form.descricao.trim() || !(valor > 0) || !form.data) {
      toast({ title: 'Preencha descrição, valor e data.', status: 'warning' })
      return
    }
    const despesa = { ...form, descricao: form.descricao.trim(), valor }
    if (editandoId) {
      atualizarDespesa(editandoId, despesa)
      toast({ title: 'Despesa atualizada.', status: 'success' })
    } else {
      adicionarDespesa(despesa)
      toast({ title: 'Despesa registrada.', status: 'success' })
    }
    setForm({ ...formVazio(), categoria: form.categoria, data: form.data })
    setEditandoId(null)
  }

  const editar = (d) => {
    setForm({ descricao: d.descricao, categoria: d.categoria || 'Outros', valor: String(d.valor).replace('.', ','), data: d.data })
    setEditandoId(d.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const excluir = async (d) => {
    if (await confirmar({ titulo: 'Excluir despesa?', texto: `"${d.descricao}" de ${formatarMoeda(d.valor)} será apagada.` })) {
      removerDespesa(d.id)
      if (editandoId === d.id) {
        setEditandoId(null)
        setForm(formVazio())
      }
    }
  }

  const lista = useMemo(
    () => despesas.filter((d) => !mes || d.data?.startsWith(mes)).sort((a, b) => b.data.localeCompare(a.data)),
    [despesas, mes]
  )

  const porCategoria = useMemo(() => {
    const mapa = {}
    lista.forEach((d) => {
      const c = d.categoria || 'Outros'
      mapa[c] = (mapa[c] || 0) + d.valor
    })
    return Object.entries(mapa).sort((a, b) => b[1] - a[1])
  }, [lista])

  const total = somar(lista)

  return (
    <Box>
      <Cabecalho titulo="Despesas" descricao="Gastos pagos na hora, sem boleto: compras no atacado, frete, embalagens, salários." />

      <Bloco mb={6}>
        <Heading as="h2" fontSize="xl" mb={3}>
          {editandoId ? 'Editar despesa' : 'Registrar despesa'}
        </Heading>
        <SimpleGrid columns={{ base: 1, sm: 2, md: 4 }} spacing={3}>
          <FormControl gridColumn={{ md: 'span 2' }}>
            <FormLabel>Descrição</FormLabel>
            <Input value={form.descricao} onChange={alterar('descricao')} placeholder="Ex.: queijos do sítio São José" onKeyDown={(e) => e.key === 'Enter' && salvar()} />
          </FormControl>
          <FormControl>
            <FormLabel>Categoria</FormLabel>
            <Select value={form.categoria} onChange={alterar('categoria')}>
              {CATEGORIAS_DESPESA.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </FormControl>
          <FormControl>
            <FormLabel>Valor</FormLabel>
            <CampoValor value={form.valor} onChange={alterar('valor')} onKeyDown={(e) => e.key === 'Enter' && salvar()} />
          </FormControl>
          <FormControl>
            <FormLabel>Data</FormLabel>
            <Input type="date" value={form.data} onChange={alterar('data')} />
          </FormControl>
        </SimpleGrid>
        <Flex gap={2} mt={4}>
          <Button onClick={salvar}>{editandoId ? 'Salvar alterações' : 'Registrar despesa'}</Button>
          {editandoId && (
            <Button variant="ghost" onClick={() => { setEditandoId(null); setForm(formVazio()) }}>
              Cancelar edição
            </Button>
          )}
        </Flex>
      </Bloco>

      <Flex justify="space-between" align="center" mb={3} gap={3} wrap="wrap">
        <Heading as="h2" fontSize="2xl">
          {mes ? `Despesas de ${formatarMes(mes)}` : 'Todas as despesas'}
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
        <Vazio titulo="Nenhuma despesa neste período" texto="As despesas registradas acima aparecem aqui." />
      ) : (
        <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6} alignItems="start">
          <TabelaRolavel>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Data</Th>
                  <Th>Descrição</Th>
                  <Th isNumeric>Valor</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {lista.map((d) => (
                  <Tr key={d.id} bg={editandoId === d.id ? 'creme.200' : undefined}>
                    <Td whiteSpace="nowrap">{formatarData(d.data)}</Td>
                    <Td>
                      <Text fontWeight={600}>{d.descricao}</Text>
                      <Text fontSize="xs" color="marrom.300">
                        {d.categoria || 'Outros'}
                      </Text>
                    </Td>
                    <Td isNumeric fontWeight={600} whiteSpace="nowrap">
                      {formatarMoeda(d.valor)}
                    </Td>
                    <Td>
                      <Flex gap={1} justify="flex-end">
                        <IconButton icon={<FiEdit2 />} size="xs" variant="ghost" aria-label={`Editar ${d.descricao}`} onClick={() => editar(d)} />
                        <IconButton icon={<FiTrash2 />} size="xs" variant="ghost" color="atraso.600" aria-label={`Excluir ${d.descricao}`} onClick={() => excluir(d)} />
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
            <Text fontSize="3xl" fontWeight={700} mb={4}>
              {formatarMoeda(total)}
            </Text>
            {porCategoria.map(([cat, valor]) => (
              <Box key={cat} mb={3}>
                <Flex justify="space-between" fontSize="sm" mb={1}>
                  <Text>{cat}</Text>
                  <Text fontWeight={600}>{formatarMoeda(valor)}</Text>
                </Flex>
                <Box h="6px" bg="creme.300" borderRadius="full">
                  <Box h="100%" w={`${(valor / total) * 100}%`} bg="vinho.500" borderRadius="full" />
                </Box>
              </Box>
            ))}
          </Bloco>
        </Grid>
      )}
    </Box>
  )
}

export default Despesas
