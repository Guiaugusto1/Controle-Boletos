import {
  Box,
  Button,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  Input,
  NumberInput,
  NumberInputField,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react'
import { FiDownload, FiUpload } from 'react-icons/fi'
import { useRef, useState } from 'react'
import { useLoja } from '../contexts/LojaContext'
import { Bloco, Cabecalho, useConfirmar } from '../components/Comum'

function Configuracoes() {
  const loja = useLoja()
  const { config, salvarConfig, exportarBackup, importarBackup, apagarTudo, boletos, despesas, vendas, clientes } = loja
  const confirmar = useConfirmar()
  const toast = useToast()
  const arquivo = useRef(null)
  const [nomeLoja, setNomeLoja] = useState(config.nomeLoja)
  const [diasAlerta, setDiasAlerta] = useState(String(config.diasAlerta))

  const salvar = () => {
    const dias = Math.max(0, Math.min(30, parseInt(diasAlerta, 10) || 0))
    salvarConfig({ nomeLoja: nomeLoja.trim() || 'Minha loja', diasAlerta: dias })
    setDiasAlerta(String(dias))
    toast({ title: 'Configurações salvas.', status: 'success' })
  }

  const baixarBackup = () => {
    const blob = new Blob([exportarBackup()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `backup-loja-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: 'Backup baixado. Guarde o arquivo em um lugar seguro (Google Drive, pen drive).', status: 'success', duration: 6000 })
  }

  const restaurar = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const ok = await confirmar({
      titulo: 'Restaurar backup?',
      texto: 'Os dados atuais serão substituídos pelos dados do arquivo. Se tiver dúvida, baixe um backup dos dados atuais antes.',
      botao: 'Restaurar',
    })
    if (!ok) return
    try {
      importarBackup(await f.text())
      toast({ title: 'Backup restaurado.', status: 'success' })
    } catch {
      toast({ title: 'Este arquivo não é um backup válido do sistema.', status: 'error' })
    }
  }

  const apagar = async () => {
    const ok = await confirmar({
      titulo: 'Apagar todos os dados?',
      texto: 'Boletos, despesas, vendas e a caderneta de fiado serão apagados deste navegador. Faça um backup antes.',
      botao: 'Apagar tudo',
    })
    if (ok) {
      apagarTudo()
      toast({ title: 'Dados apagados.', status: 'info' })
    }
  }

  return (
    <Box maxW="720px">
      <Cabecalho titulo="Configurações" />

      <Bloco mb={6}>
        <Heading as="h2" fontSize="2xl" mb={4}>
          Loja
        </Heading>
        <Stack spacing={4}>
          <FormControl>
            <FormLabel>Nome da loja</FormLabel>
            <Input value={nomeLoja} onChange={(e) => setNomeLoja(e.target.value)} />
            <FormHelperText>Aparece na tela inicial, nos relatórios e na mensagem de WhatsApp do fiado.</FormHelperText>
          </FormControl>
          <FormControl maxW="280px">
            <FormLabel>Avisar boletos com quantos dias de antecedência</FormLabel>
            <NumberInput value={diasAlerta} onChange={setDiasAlerta} min={0} max={30}>
              <NumberInputField bg="white" borderColor="creme.400" />
            </NumberInput>
            <FormHelperText>Boletos dentro desse prazo ficam destacados como “Vence logo”.</FormHelperText>
          </FormControl>
          <Box>
            <Button onClick={salvar}>Salvar configurações</Button>
          </Box>
        </Stack>
      </Bloco>

      <Bloco mb={6}>
        <Heading as="h2" fontSize="2xl" mb={1}>
          Backup
        </Heading>
        <Text fontSize="sm" color="marrom.400" mb={4}>
          Os dados ficam guardados só neste navegador. Se o navegador for limpo ou o computador trocar, eles se perdem. Baixe um backup toda semana.
        </Text>
        <Text fontSize="sm" mb={4}>
          Hoje há {boletos.length} boleto(s), {despesas.length} despesa(s), {vendas.length} venda(s) e {clientes.length} cliente(s) no fiado.
        </Text>
        <Flex gap={2} wrap="wrap">
          <Button leftIcon={<FiDownload />} onClick={baixarBackup}>
            Baixar backup
          </Button>
          <Button leftIcon={<FiUpload />} variant="outline" onClick={() => arquivo.current?.click()}>
            Restaurar backup
          </Button>
          <input ref={arquivo} type="file" accept="application/json,.json" hidden onChange={restaurar} />
        </Flex>
      </Bloco>

      <Bloco borderColor="atraso.100">
        <Heading as="h2" fontSize="xl" mb={1}>
          Apagar dados
        </Heading>
        <Text fontSize="sm" color="marrom.400" mb={3}>
          Útil para começar do zero depois de testar o sistema.
        </Text>
        <Button colorScheme="atraso" variant="outline" onClick={apagar}>
          Apagar todos os dados
        </Button>
      </Bloco>
    </Box>
  )
}

export default Configuracoes
