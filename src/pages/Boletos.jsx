import {
  Box,
  Button,
  Flex,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useClipboard,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { FiMoreVertical, FiPlus, FiSearch } from 'react-icons/fi'
import { useMemo, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useLoja, statusBoleto } from '../contexts/LojaContext'
import { Cabecalho, StatusBoleto, TabelaRolavel, Vazio, useConfirmar } from '../components/Comum'
import { formatarData, formatarMoeda, somar } from '../utils/formatters'
import { formatarLinhaDigitavel } from '../utils/boleto'

const filtrosStatus = {
  abertos: (s) => s !== 'pago',
  vencidos: (s) => s === 'vencido',
  logo: (s) => s === 'hoje' || s === 'proximo',
  pagos: (s) => s === 'pago',
  todos: () => true,
}

function Detalhe({ rotulo, children }) {
  return (
    <Box>
      <Text fontSize="xs" color="marrom.300" fontWeight={600}>
        {rotulo}
      </Text>
      <Text>{children || '—'}</Text>
    </Box>
  )
}

function ModalDetalhes({ boleto, onClose }) {
  const linha = formatarLinhaDigitavel(boleto?.codigo || '')
  const { onCopy, hasCopied } = useClipboard(boleto?.codigo || '')
  const { config } = useLoja()
  if (!boleto) return null
  return (
    <Modal isOpen onClose={onClose} isCentered size="lg">
      <ModalOverlay />
      <ModalContent mx={3}>
        <ModalHeader fontFamily="heading" fontSize="2xl" pr={12}>
          {boleto.fornecedor}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <SimpleGrid columns={2} spacing={4}>
            <Detalhe rotulo="Valor">{formatarMoeda(boleto.valor)}</Detalhe>
            <Detalhe rotulo="Situação">
              <StatusBoleto status={statusBoleto(boleto, config.diasAlerta)} />
            </Detalhe>
            <Detalhe rotulo="Vencimento">{formatarData(boleto.vencimento)}</Detalhe>
            <Detalhe rotulo="Pago em">{boleto.pago ? formatarData(boleto.dataPagamento) : ''}</Detalhe>
            <Detalhe rotulo="Emissão">{boleto.emissao ? formatarData(boleto.emissao) : ''}</Detalhe>
            <Detalhe rotulo="Banco">{boleto.banco}</Detalhe>
            <Detalhe rotulo="CNPJ">{boleto.cnpj}</Detalhe>
            <Detalhe rotulo="Categoria">{boleto.categoria}</Detalhe>
          </SimpleGrid>
          {boleto.observacao && (
            <Box mt={4}>
              <Detalhe rotulo="Observação">{boleto.observacao}</Detalhe>
            </Box>
          )}
          {boleto.codigo && (
            <Box mt={4} p={3} bg="creme.200" borderRadius="lg">
              <Text fontSize="xs" color="marrom.300" fontWeight={600}>
                Linha digitável
              </Text>
              <Text fontSize="sm" wordBreak="break-all" mb={2}>
                {linha}
              </Text>
              <Button size="sm" variant="outline" onClick={onCopy}>
                {hasCopied ? 'Copiado' : 'Copiar para pagar no app do banco'}
              </Button>
            </Box>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

function Boletos() {
  const { boletos, config, pagarBoleto, desfazerPagamento, removerBoleto } = useLoja()
  const confirmar = useConfirmar()
  const navigate = useNavigate()
  const toast = useToast()
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('abertos')
  const [mes, setMes] = useState('')
  const [selecionado, setSelecionado] = useState(null)

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return boletos
      .map((b) => ({ ...b, status: statusBoleto(b, config.diasAlerta) }))
      .filter((b) => filtrosStatus[filtro](b.status))
      .filter((b) => !mes || b.vencimento?.startsWith(mes))
      .filter((b) => !termo || b.fornecedor?.toLowerCase().includes(termo) || b.categoria?.toLowerCase().includes(termo))
      .sort((a, b) =>
        filtro === 'pagos'
          ? (b.dataPagamento || '').localeCompare(a.dataPagamento || '')
          : (a.vencimento || '').localeCompare(b.vencimento || '')
      )
  }, [boletos, busca, filtro, mes, config.diasAlerta])

  const excluir = async (b) => {
    const ok = await confirmar({
      titulo: 'Excluir boleto?',
      texto: `O boleto de ${b.fornecedor} (${formatarMoeda(b.valor)}) será apagado. Isso não pode ser desfeito.`,
    })
    if (ok) {
      removerBoleto(b.id)
      toast({ title: 'Boleto excluído.', status: 'info' })
    }
  }

  const pagar = (b) => {
    pagarBoleto(b.id)
    toast({ title: 'Boleto marcado como pago.', status: 'success' })
  }

  return (
    <Box>
      <Cabecalho titulo="Boletos" descricao="Contas de fornecedores, luz, água e outras. Os boletos vencidos ou vencendo aparecem destacados.">
        <Button as={RouterLink} to="/boletos/novo" leftIcon={<FiPlus />}>
          Novo boleto
        </Button>
      </Cabecalho>

      <Flex gap={3} mb={4} wrap="wrap">
        <InputGroup maxW={{ base: '100%', md: '260px' }}>
          <InputLeftElement pointerEvents="none" color="marrom.300">
            <FiSearch />
          </InputLeftElement>
          <Input placeholder="Buscar fornecedor" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar fornecedor" />
        </InputGroup>
        <Select value={filtro} onChange={(e) => setFiltro(e.target.value)} maxW={{ base: '100%', sm: '200px' }} aria-label="Situação">
          <option value="abertos">Em aberto</option>
          <option value="vencidos">Vencidos</option>
          <option value="logo">Vencendo logo</option>
          <option value="pagos">Pagos</option>
          <option value="todos">Todos</option>
        </Select>
        <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} maxW={{ base: '100%', sm: '230px' }} aria-label="Mês de vencimento" />
        {(mes || busca) && (
          <Button variant="ghost" onClick={() => { setMes(''); setBusca('') }}>
            Limpar filtros
          </Button>
        )}
      </Flex>

      {boletos.length === 0 ? (
        <Vazio
          titulo="Nenhum boleto cadastrado"
          texto="Cadastre digitando a linha digitável, importando o PDF ou lendo o código de barras com a câmera."
          acao={<Button as={RouterLink} to="/boletos/novo">Cadastrar o primeiro boleto</Button>}
        />
      ) : lista.length === 0 ? (
        <Vazio titulo="Nenhum boleto com esses filtros" texto="Mude a situação ou o mês para ver outros boletos." />
      ) : (
        <>
          <Text fontSize="sm" mb={2} color="marrom.400">
            {lista.length} boleto(s), total de <strong>{formatarMoeda(somar(lista))}</strong>
          </Text>
          <TabelaRolavel>
            <Table variant="simple" size="sm">
              <Thead>
                <Tr>
                  <Th>Fornecedor</Th>
                  <Th>Vencimento</Th>
                  <Th isNumeric>Valor</Th>
                  <Th>Situação</Th>
                  <Th textAlign="right">Ações</Th>
                </Tr>
              </Thead>
              <Tbody>
                {lista.map((b) => (
                  <Tr key={b.id} bg={b.status === 'vencido' ? 'atraso.50' : b.status === 'hoje' || b.status === 'proximo' ? 'alerta.50' : undefined}>
                    <Td>
                      <Button variant="link" color="marrom.500" fontWeight={600} onClick={() => setSelecionado(b)} whiteSpace="normal" textAlign="left">
                        {b.fornecedor}
                      </Button>
                      {b.categoria && (
                        <Text fontSize="xs" color="marrom.300">
                          {b.categoria}
                        </Text>
                      )}
                    </Td>
                    <Td whiteSpace="nowrap">{formatarData(b.vencimento)}</Td>
                    <Td isNumeric fontWeight={600} whiteSpace="nowrap">
                      {formatarMoeda(b.valor)}
                    </Td>
                    <Td>
                      <StatusBoleto status={b.status} />
                    </Td>
                    <Td>
                      <Flex justify="flex-end" gap={1}>
                        {!b.pago && (
                          <Button size="xs" colorScheme="pago" onClick={() => pagar(b)}>
                            Pagar
                          </Button>
                        )}
                        <Menu placement="bottom-end">
                          <MenuButton as={IconButton} icon={<FiMoreVertical />} size="xs" variant="ghost" aria-label={`Mais ações para ${b.fornecedor}`} />
                          <MenuList fontSize="sm">
                            <MenuItem onClick={() => setSelecionado(b)}>Ver detalhes</MenuItem>
                            <MenuItem onClick={() => navigate(`/boletos/${b.id}/editar`)}>Editar</MenuItem>
                            {b.pago && <MenuItem onClick={() => desfazerPagamento(b.id)}>Desfazer pagamento</MenuItem>}
                            <MenuItem color="atraso.600" onClick={() => excluir(b)}>
                              Excluir
                            </MenuItem>
                          </MenuList>
                        </Menu>
                      </Flex>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TabelaRolavel>
        </>
      )}

      {selecionado && <ModalDetalhes boleto={selecionado} onClose={() => setSelecionado(null)} />}
    </Box>
  )
}

export default Boletos
