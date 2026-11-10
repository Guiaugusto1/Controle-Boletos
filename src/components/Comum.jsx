// Componentes pequenos reaproveitados nas telas
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Box,
  Button,
  Flex,
  Heading,
  Input,
  InputGroup,
  InputLeftElement,
  Tag,
  Text,
} from '@chakra-ui/react'
import { createContext, useCallback, useContext, useRef, useState } from 'react'

export function Cabecalho({ titulo, descricao, children }) {
  return (
    <Flex justify="space-between" align={{ base: 'stretch', md: 'flex-end' }} direction={{ base: 'column', md: 'row' }} gap={4} mb={6}>
      <Box>
        <Heading as="h1" fontSize={{ base: '3xl', md: '4xl' }} lineHeight="1.1">
          {titulo}
        </Heading>
        {descricao && (
          <Text color="marrom.300" mt={1} fontSize="sm" maxW="60ch">
            {descricao}
          </Text>
        )}
      </Box>
      {children && <Flex gap={2} wrap="wrap">{children}</Flex>}
    </Flex>
  )
}

export function Bloco({ children, ...props }) {
  return (
    <Box bg="creme.50" border="1px solid" borderColor="creme.300" borderRadius="xl" p={{ base: 4, md: 5 }} {...props}>
      {children}
    </Box>
  )
}

export function TabelaRolavel({ children }) {
  return (
    <Box overflowX="auto" bg="white" border="1px solid" borderColor="creme.300" borderRadius="xl">
      {children}
    </Box>
  )
}

export function Vazio({ titulo, texto, acao }) {
  return (
    <Box textAlign="center" py={10} px={4} border="1px dashed" borderColor="creme.500" borderRadius="xl" bg="creme.50">
      <Text fontFamily="heading" fontSize="xl" fontWeight={600}>
        {titulo}
      </Text>
      {texto && (
        <Text color="marrom.300" fontSize="sm" mt={1} maxW="48ch" mx="auto">
          {texto}
        </Text>
      )}
      {acao && <Box mt={4}>{acao}</Box>}
    </Box>
  )
}

const rotulosStatus = {
  pago: ['Pago', 'pago'],
  vencido: ['Vencido', 'atraso'],
  hoje: ['Vence hoje', 'alerta'],
  proximo: ['Vence logo', 'alerta'],
  pendente: ['A pagar', 'creme'],
}

export function StatusBoleto({ status }) {
  const [texto, cor] = rotulosStatus[status] || rotulosStatus.pendente
  return (
    <Tag size="sm" bg={`${cor}.100`} color={`${cor === 'creme' ? 'marrom' : cor}.700`} borderRadius="full" whiteSpace="nowrap">
      {texto}
    </Tag>
  )
}

// Campo de valor em reais que aceita vírgula ("12,50")
export function CampoValor({ value, onChange, ...props }) {
  return (
    <InputGroup>
      <InputLeftElement pointerEvents="none" color="marrom.300" fontSize="sm">
        R$
      </InputLeftElement>
      <Input
        inputMode="decimal"
        placeholder="0,00"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
        {...props}
      />
    </InputGroup>
  )
}

// Confirmação antes de excluir (antes, excluía direto sem perguntar)
const ConfirmarContext = createContext(null)

export function ConfirmarProvider({ children }) {
  const [pedido, setPedido] = useState(null)
  const cancelRef = useRef()

  const confirmar = useCallback(
    (opcoes) =>
      new Promise((resolve) => {
        setPedido({ ...opcoes, resolve })
      }),
    []
  )

  const fechar = (resposta) => {
    pedido?.resolve(resposta)
    setPedido(null)
  }

  return (
    <ConfirmarContext.Provider value={confirmar}>
      {children}
      <AlertDialog isOpen={!!pedido} leastDestructiveRef={cancelRef} onClose={() => fechar(false)} isCentered>
        <AlertDialogOverlay>
          <AlertDialogContent bg="creme.50" mx={4}>
            <AlertDialogHeader fontFamily="heading" fontSize="2xl" pb={1}>
              {pedido?.titulo}
            </AlertDialogHeader>
            <AlertDialogBody color="marrom.400">{pedido?.texto}</AlertDialogBody>
            <AlertDialogFooter gap={2}>
              <Button ref={cancelRef} variant="ghost" onClick={() => fechar(false)}>
                Cancelar
              </Button>
              <Button colorScheme="atraso" onClick={() => fechar(true)}>
                {pedido?.botao || 'Excluir'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </ConfirmarContext.Provider>
  )
}

export function useConfirmar() {
  return useContext(ConfirmarContext)
}
