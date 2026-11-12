import { createContext, useContext, useMemo, useState } from 'react'
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  CloseButton,
  Flex,
  Heading,
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
  Tag,
  Text,
  useDisclosure,
} from '@chakra-ui/react'

const ConfirmarContext = createContext(null)

export function ConfirmarProvider({ children }) {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [config, setConfig] = useState({ titulo: 'Confirmar', texto: '', botao: 'Confirmar' })
  const [resolver, setResolver] = useState(null)

  const confirmar = (dados) =>
    new Promise((resolve) => {
      setConfig({ titulo: 'Confirmar', botao: 'Confirmar', ...dados })
      setResolver(() => resolve)
      onOpen()
    })

  const confirmarSim = () => {
    resolver?.(true)
    onClose()
  }

  const confirmarNao = () => {
    resolver?.(false)
    onClose()
  }

  const value = useMemo(() => ({ confirmar }), [])

  return (
    <ConfirmarContext.Provider value={value}>
      {children}
      <Modal isOpen={isOpen} onClose={confirmarNao} isCentered>
        <ModalOverlay />
        <ModalContent mx={3}>
          <ModalHeader fontFamily="heading" fontSize="2xl" pr={12}>
            {config.titulo}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>{config.texto}</Text>
          </ModalBody>
          <ModalFooter gap={2}>
            <Button variant="ghost" onClick={confirmarNao}>
              Cancelar
            </Button>
            <Button onClick={confirmarSim}>{config.botao}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </ConfirmarContext.Provider>
  )
}

export function useConfirmar() {
  const contexto = useContext(ConfirmarContext)
  if (!contexto) return async () => true
  return contexto.confirmar
}

export function Bloco({ children, ...props }) {
  return (
    <Box border="1px solid" borderColor="creme.300" borderRadius="2xl" bg="white" p={5} shadow="sm" {...props}>
      {children}
    </Box>
  )
}

export function Cabecalho({ titulo, descricao, children }) {
  return (
    <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={3} mb={6} wrap="wrap">
      <Box>
        <Heading as="h1" fontSize={{ base: '3xl', md: '4xl' }}>
          {titulo}
        </Heading>
        {descricao && (
          <Text mt={2} color="marrom.400" fontSize="sm">
            {descricao}
          </Text>
        )}
      </Box>
      {children}
    </Flex>
  )
}

export function StatusBoleto({ status }) {
  const mapa = {
    pago: { label: 'Pago', color: 'pago.500', bg: 'pago.50' },
    vencido: { label: 'Vencido', color: 'atraso.600', bg: 'atraso.50' },
    hoje: { label: 'Vence hoje', color: 'alerta.600', bg: 'alerta.50' },
    proximo: { label: 'Vence logo', color: 'alerta.600', bg: 'alerta.50' },
    aberto: { label: 'Em aberto', color: 'marrom.400', bg: 'creme.100' },
  }
  const atual = mapa[status] || mapa.aberto

  return (
    <Tag size="sm" bg={atual.bg} color={atual.color} borderRadius="full" px={2} py={1} fontWeight={700}>
      {atual.label}
    </Tag>
  )
}

export function CampoValor({ value, onChange, onKeyDown, autoFocus }) {
  return (
    <InputGroup>
      <InputLeftElement pointerEvents="none" color="marrom.300" fontWeight={600}>
        R$
      </InputLeftElement>
      <Input
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        placeholder="0,00"
        inputMode="decimal"
      />
    </InputGroup>
  )
}

export function TabelaRolavel({ children }) {
  return <Box overflowX="auto">{children}</Box>
}

export function Vazio({ titulo, texto, acao }) {
  return (
    <Box border="1px dashed" borderColor="creme.400" borderRadius="2xl" bg="white" p={8} textAlign="center">
      <Text fontWeight={700} fontSize="lg" mb={2}>
        {titulo}
      </Text>
      {texto && (
        <Text color="marrom.400" mb={4}>
          {texto}
        </Text>
      )}
      {acao}
    </Box>
  )
}

export function Alerta({ status = 'info', titulo, children }) {
  return (
    <Alert status={status} borderRadius="lg" mb={4}>
      <AlertIcon />
      <Box>
        {titulo && <Text fontWeight={700}>{titulo}</Text>}
        {children}
      </Box>
    </Alert>
  )
}

export default {
  Bloco,
  Cabecalho,
  StatusBoleto,
  CampoValor,
  TabelaRolavel,
  Vazio,
  Alerta,
  ConfirmarProvider,
  useConfirmar,
}
