import {
  Box,
  Button,
  Checkbox,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Table,
  Tabs,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { FiPlus, FiSearch, FiTrash2 } from 'react-icons/fi'
import { FaWhatsapp } from 'react-icons/fa'
import { useMemo, useState } from 'react'
import { useLoja, saldoCliente } from '../contexts/LojaContext'
import { Bloco, Cabecalho, CampoValor, TabelaRolavel, Vazio, useConfirmar } from '../components/Comum'
import { apenasDigitos, formatarData, formatarMoeda, formatarTelefone, hojeISO, lerValor, somar } from '../utils/formatters'

function ModalCliente({ cliente, onClose }) {
  const { adicionarCliente, atualizarCliente, clientes } = useLoja()
  const toast = useToast()
  const [nome, setNome] = useState(cliente?.nome || '')
  const [telefone, setTelefone] = useState(cliente?.telefone || '')

  const salvar = () => {
    const n = nome.trim()
    if (!n) {
      toast({ title: 'Informe o nome do cliente.', status: 'warning' })
      return
    }
    if (!cliente && clientes.some((c) => c.nome.toLowerCase() === n.toLowerCase())) {
      toast({ title: `Já existe um cliente chamado ${n}.`, status: 'warning' })
      return
    }
    if (cliente) atualizarCliente(cliente.id, { nome: n, telefone })
    else adicionarCliente({ nome: n, telefone })
    toast({ title: cliente ? 'Cliente atualizado.' : 'Cliente cadastrado.', status: 'success' })
    onClose()
  }

  return (
    <Modal isOpen onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent mx={3}>
        <ModalHeader fontFamily="heading" fontSize="2xl">
          {cliente ? 'Editar cliente' : 'Novo cliente'}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <FormControl isRequired>
              <FormLabel>Nome</FormLabel>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && salvar()} />
            </FormControl>
            <FormControl>
              <FormLabel>Celular (WhatsApp)</FormLabel>
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="tel" placeholder="(11) 90000-0000" onKeyDown={(e) => e.key === 'Enter' && salvar()} />
            </FormControl>
          </Stack>
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar}>{cliente ? 'Salvar' : 'Cadastrar cliente'}</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

function linkWhatsApp(cliente, saldo, nomeLoja) {
  let tel = apenasDigitos(cliente.telefone)
  if (tel.length === 10 || tel.length === 11) tel = '55' + tel
  const msg = `Olá, ${cliente.nome}! Aqui é do ${nomeLoja}. Passando para lembrar que o seu saldo na caderneta está em ${formatarMoeda(saldo)}. Qualquer dúvida, é só chamar. Obrigado!`
  return `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`
}

function Caderneta({ clienteId, onClose, onEditar }) {
  const { clientes, config, lancarFiado, removerLancamento, removerCliente, adicionarVenda } = useLoja()
  const confirmar = useConfirmar()
  const toast = useToast()
  const cliente = clientes.find((c) => c.id === clienteId)
  const [compra, setCompra] = useState({ valor: '', descricao: '', data: hojeISO() })
  const [pagamento, setPagamento] = useState({ valor: '', forma: 'Dinheiro', data: hojeISO(), lancarVenda: true })

  if (!cliente) return null
  const saldo = saldoCliente(cliente)

  // Extrato com saldo acumulado, do mais antigo para o mais novo
  let acumulado = 0
  const extrato = [...cliente.lancamentos]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((l) => {
      acumulado += l.tipo === 'compra' ? l.valor : -l.valor
      return { ...l, saldo: acumulado }
    })
    .reverse()

  const anotarCompra = () => {
    const valor = lerValor(compra.valor)
    if (!(valor > 0)) return toast({ title: 'Informe o valor da compra.', status: 'warning' })
    lancarFiado(cliente.id, { tipo: 'compra', valor, descricao: compra.descricao.trim(), data: compra.data })
    toast({ title: `Compra de ${formatarMoeda(valor)} anotada.`, status: 'success' })
    setCompra({ valor: '', descricao: '', data: hojeISO() })
  }

  const receber = () => {
    const valor = lerValor(pagamento.valor)
    if (!(valor > 0)) return toast({ title: 'Informe o valor recebido.', status: 'warning' })
    lancarFiado(cliente.id, { tipo: 'pagamento', valor, descricao: pagamento.forma, data: pagamento.data })
    if (pagamento.lancarVenda) {
      adicionarVenda({ data: pagamento.data, valor, forma: 'Fiado recebido', observacao: `${cliente.nome} (${pagamento.forma.toLowerCase()})` })
    }
    toast({ title: `Pagamento de ${formatarMoeda(valor)} recebido.`, status: 'success' })
    setPagamento({ valor: '', forma: pagamento.forma, data: hojeISO(), lancarVenda: true })
  }

  const excluirLancamento = async (l) => {
    if (await confirmar({ titulo: 'Excluir lançamento?', texto: `${l.tipo === 'compra' ? 'Compra' : 'Pagamento'} de ${formatarMoeda(l.valor)} em ${formatarData(l.data)}. Se ele também foi lançado em Vendas, exclua lá também.` })) {
      removerLancamento(cliente.id, l.id)
    }
  }

  const excluirCliente = async () => {
    const aviso = saldo > 0.009 ? ` Ele ainda deve ${formatarMoeda(saldo)}.` : ''
    if (await confirmar({ titulo: `Excluir ${cliente.nome}?`, texto: `A caderneta inteira deste cliente será apagada.${aviso}` })) {
      removerCliente(cliente.id)
      onClose()
    }
  }

  return (
    <Drawer isOpen onClose={onClose} placement="right" size="md">
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader pb={2}>
          <Text fontFamily="heading" fontSize="3xl" lineHeight="1.1">
            {cliente.nome}
          </Text>
          <Text fontSize="sm" fontWeight={400} color="marrom.300">
            {cliente.telefone ? formatarTelefone(cliente.telefone) : 'Sem telefone'}
          </Text>
        </DrawerHeader>
        <DrawerBody>
          <Bloco mb={4} bg={saldo > 0.009 ? 'atraso.50' : 'pago.50'} borderColor={saldo > 0.009 ? 'atraso.100' : 'pago.100'}>
            <Text fontSize="sm" fontWeight={600} color="marrom.400">
              {saldo > 0.009 ? 'Deve' : saldo < -0.009 ? 'Tem crédito de' : 'Sem dívidas'}
            </Text>
            <Text fontSize="3xl" fontWeight={700} color={saldo > 0.009 ? 'atraso.600' : 'pago.600'}>
              {formatarMoeda(Math.abs(saldo))}
            </Text>
            <Flex gap={2} mt={2} wrap="wrap">
              {cliente.telefone && saldo > 0.009 && (
                <Button as="a" href={linkWhatsApp(cliente, saldo, config.nomeLoja)} target="_blank" rel="noopener" size="sm" leftIcon={<FaWhatsapp />} colorScheme="pago">
                  Lembrar pelo WhatsApp
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={onEditar}>
                Editar cliente
              </Button>
            </Flex>
          </Bloco>

          <Tabs colorScheme="vinho" variant="soft-rounded" size="sm" mb={6}>
            <TabList gap={2}>
              <Tab>Anotar compra</Tab>
              <Tab>Receber pagamento</Tab>
            </TabList>
            <TabPanels>
              <TabPanel px={0}>
                <SimpleGrid columns={2} spacing={3}>
                  <FormControl>
                    <FormLabel>Valor</FormLabel>
                    <CampoValor value={compra.valor} onChange={(v) => setCompra((c) => ({ ...c, valor: v }))} onKeyDown={(e) => e.key === 'Enter' && anotarCompra()} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Data</FormLabel>
                    <Input type="date" value={compra.data} onChange={(e) => setCompra((c) => ({ ...c, data: e.target.value }))} />
                  </FormControl>
                  <FormControl gridColumn="span 2">
                    <FormLabel>O que levou</FormLabel>
                    <Input value={compra.descricao} onChange={(e) => setCompra((c) => ({ ...c, descricao: e.target.value }))} placeholder="Ex.: 1 kg de queijo canastra" onKeyDown={(e) => e.key === 'Enter' && anotarCompra()} />
                  </FormControl>
                </SimpleGrid>
                <Button mt={3} onClick={anotarCompra}>
                  Anotar compra
                </Button>
              </TabPanel>
              <TabPanel px={0}>
                <SimpleGrid columns={2} spacing={3}>
                  <FormControl>
                    <FormLabel>Valor recebido</FormLabel>
                    <CampoValor value={pagamento.valor} onChange={(v) => setPagamento((p) => ({ ...p, valor: v }))} onKeyDown={(e) => e.key === 'Enter' && receber()} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Data</FormLabel>
                    <Input type="date" value={pagamento.data} onChange={(e) => setPagamento((p) => ({ ...p, data: e.target.value }))} />
                  </FormControl>
                  <FormControl gridColumn="span 2">
                    <FormLabel>Como pagou</FormLabel>
                    <Select value={pagamento.forma} onChange={(e) => setPagamento((p) => ({ ...p, forma: e.target.value }))}>
                      <option>Dinheiro</option>
                      <option>Pix</option>
                      <option>Cartão de débito</option>
                      <option>Cartão de crédito</option>
                    </Select>
                  </FormControl>
                </SimpleGrid>
                {saldo > 0.009 && (
                  <Button size="xs" variant="link" color="vinho.500" mt={2} onClick={() => setPagamento((p) => ({ ...p, valor: saldo.toFixed(2).replace('.', ',') }))}>
                    Preencher com o total devido ({formatarMoeda(saldo)})
                  </Button>
                )}
                <Checkbox mt={3} display="flex" isChecked={pagamento.lancarVenda} onChange={(e) => setPagamento((p) => ({ ...p, lancarVenda: e.target.checked }))} colorScheme="vinho" size="sm">
                  Lançar também em Vendas (entrada no caixa)
                </Checkbox>
                <Button mt={3} colorScheme="pago" onClick={receber}>
                  Receber pagamento
                </Button>
              </TabPanel>
            </TabPanels>
          </Tabs>

          <Heading as="h3" fontSize="xl" mb={2}>
            Extrato
          </Heading>
          {extrato.length === 0 ? (
            <Text fontSize="sm" color="marrom.300">
              Nenhuma compra anotada ainda.
            </Text>
          ) : (
            <TabelaRolavel>
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>Data</Th>
                    <Th>Lançamento</Th>
                    <Th isNumeric>Valor</Th>
                    <Th isNumeric>Saldo</Th>
                    <Th />
                  </Tr>
                </Thead>
                <Tbody>
                  {extrato.map((l) => (
                    <Tr key={l.id}>
                      <Td whiteSpace="nowrap">{formatarData(l.data)}</Td>
                      <Td>
                        <Text fontWeight={600}>{l.tipo === 'compra' ? 'Compra' : 'Pagamento'}</Text>
                        {l.descricao && (
                          <Text fontSize="xs" color="marrom.300">
                            {l.descricao}
                          </Text>
                        )}
                      </Td>
                      <Td isNumeric whiteSpace="nowrap" color={l.tipo === 'compra' ? 'atraso.600' : 'pago.600'} fontWeight={600}>
                        {l.tipo === 'compra' ? '+' : '−'} {formatarMoeda(l.valor)}
                      </Td>
                      <Td isNumeric whiteSpace="nowrap">
                        {formatarMoeda(l.saldo)}
                      </Td>
                      <Td>
                        <IconButton icon={<FiTrash2 />} size="xs" variant="ghost" color="atraso.600" aria-label="Excluir lançamento" onClick={() => excluirLancamento(l)} />
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TabelaRolavel>
          )}

          <Button variant="ghost" color="atraso.600" size="sm" mt={8} mb={4} onClick={excluirCliente}>
            Excluir cliente
          </Button>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}

function Fiados() {
  const { clientes } = useLoja()
  const [busca, setBusca] = useState('')
  const [soDevendo, setSoDevendo] = useState(false)
  const [abertoId, setAbertoId] = useState(null)
  const [editarCliente, setEditarCliente] = useState(null) // null | 'novo' | cliente
  const novo = useDisclosure()

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return clientes
      .map((c) => ({
        ...c,
        saldo: saldoCliente(c),
        ultima: c.lancamentos.reduce((m, l) => (l.data > m ? l.data : m), ''),
      }))
      .filter((c) => !termo || c.nome.toLowerCase().includes(termo) || apenasDigitos(c.telefone).includes(apenasDigitos(termo) || '§'))
      .filter((c) => !soDevendo || c.saldo > 0.009)
      .sort((a, b) => b.saldo - a.saldo || a.nome.localeCompare(b.nome))
  }, [clientes, busca, soDevendo])

  const totalGeral = somar(clientes.map((c) => ({ valor: Math.max(0, saldoCliente(c)) })))

  return (
    <Box>
      <Cabecalho titulo="Caderneta de fiado" descricao="Anote as compras fiado e os pagamentos de cada cliente. O saldo é calculado sozinho.">
        <Button leftIcon={<FiPlus />} onClick={() => { setEditarCliente('novo'); novo.onOpen() }}>
          Novo cliente
        </Button>
      </Cabecalho>

      <Flex gap={3} mb={4} wrap="wrap" align="center">
        <InputGroup maxW={{ base: '100%', md: '280px' }}>
          <InputLeftElement pointerEvents="none" color="marrom.300">
            <FiSearch />
          </InputLeftElement>
          <Input placeholder="Buscar por nome ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar cliente" />
        </InputGroup>
        <Checkbox isChecked={soDevendo} onChange={(e) => setSoDevendo(e.target.checked)} colorScheme="vinho">
          Só quem está devendo
        </Checkbox>
        <Text ml={{ md: 'auto' }} fontSize="sm">
          Total a receber: <strong>{formatarMoeda(totalGeral)}</strong>
        </Text>
      </Flex>

      {clientes.length === 0 ? (
        <Vazio
          titulo="Nenhum cliente na caderneta"
          texto="Cadastre o cliente uma vez e depois é só anotar as compras e os pagamentos."
          acao={<Button onClick={() => { setEditarCliente('novo'); novo.onOpen() }}>Cadastrar o primeiro cliente</Button>}
        />
      ) : lista.length === 0 ? (
        <Vazio titulo="Nenhum cliente encontrado" />
      ) : (
        <TabelaRolavel>
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Cliente</Th>
                <Th>Última movimentação</Th>
                <Th isNumeric>Saldo</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {lista.map((c) => (
                <Tr key={c.id} cursor="pointer" _hover={{ bg: 'creme.100' }} onClick={() => setAbertoId(c.id)}>
                  <Td>
                    <Text fontWeight={600}>{c.nome}</Text>
                    <Text fontSize="xs" color="marrom.300">
                      {formatarTelefone(c.telefone) || 'Sem telefone'}
                    </Text>
                  </Td>
                  <Td whiteSpace="nowrap">{c.ultima ? formatarData(c.ultima) : '—'}</Td>
                  <Td isNumeric fontWeight={700} whiteSpace="nowrap" color={c.saldo > 0.009 ? 'atraso.600' : 'pago.600'}>
                    {c.saldo > 0.009 ? formatarMoeda(c.saldo) : 'Em dia'}
                  </Td>
                  <Td textAlign="right">
                    <Button size="xs" variant="outline" onClick={(e) => { e.stopPropagation(); setAbertoId(c.id) }}>
                      Abrir
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TabelaRolavel>
      )}

      {abertoId && (
        <Caderneta
          clienteId={abertoId}
          onClose={() => setAbertoId(null)}
          onEditar={() => { setEditarCliente(clientes.find((c) => c.id === abertoId)); novo.onOpen() }}
        />
      )}
      {novo.isOpen && editarCliente && (
        <ModalCliente cliente={editarCliente === 'novo' ? null : editarCliente} onClose={() => { novo.onClose(); setEditarCliente(null) }} />
      )}
    </Box>
  )
}

export default Fiados
