import { Box, Button, FormControl, FormLabel, Heading, Input, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { entrar } from '../utils/api'

function Login({ onEntrar }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e) => {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      await entrar(email, senha)
      onEntrar()
    } catch (err) {
      setErro(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Box minH="100vh" bg="creme.100" display="flex" alignItems="center" justifyContent="center" px={4}>
      <Box as="form" onSubmit={enviar} bg="white" p={8} borderRadius="xl" boxShadow="md" w="100%" maxW="380px">
        <Heading as="h1" fontSize="3xl" mb={1}>Balaio Mineiro</Heading>
        <Text color="marrom.300" mb={6}>Entre para ver os dados da loja.</Text>
        <Stack spacing={4}>
          <FormControl>
            <FormLabel>E-mail</FormLabel>
            <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormControl>
          <FormControl>
            <FormLabel>Senha</FormLabel>
            <Input type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </FormControl>
          {erro && <Text color="atraso.600" fontSize="sm">{erro}</Text>}
          <Button type="submit" isLoading={enviando} isDisabled={!email || !senha}>Entrar</Button>
        </Stack>
      </Box>
    </Box>
  )
}

export default Login
