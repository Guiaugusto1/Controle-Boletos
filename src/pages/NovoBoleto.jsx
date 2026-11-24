import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Heading,
  Input,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { FiCamera, FiFileText, FiImage } from 'react-icons/fi'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLoja } from '../contexts/LojaContext'
import { Bloco, Cabecalho, CampoValor } from '../components/Comum'
import ScanModal from '../components/ScanModal'
import { lerCodigoBoleto, formatarLinhaDigitavel } from '../utils/boleto'
import { importarBoletoPDF } from '../utils/pdfBoleto'
import { ehPix, lerPix, pixCompleto } from '../utils/pix'
import { lerCodigoDeImagem } from '../utils/lerImagem'
import { apenasDigitos, formatarMoeda, formatarData, hojeISO, lerValor } from '../utils/formatters'

export const CATEGORIAS_BOLETO = ['Mercadoria / fornecedor', 'Energia', 'Água', 'Aluguel', 'Internet e telefone', 'Impostos', 'Empréstimo', 'Outros']

const vazio = {
  fornecedor: '',
  valor: '',
  vencimento: '',
  emissao: '',
  banco: '',
  cnpj: '',
  categoria: '',
  observacao: '',
  codigo: '',
  pago: false,
  dataPagamento: '',
}

function NovoBoleto() {
  const { id } = useParams()
  const { boletos, adicionarBoleto, atualizarBoleto } = useLoja()
  const navigate = useNavigate()
  const toast = useToast()
  const scanner = useDisclosure()
  const inputPDF = useRef(null)
  const inputFoto = useRef(null)

  const editando = id ? boletos.find((b) => b.id === id) : null
  const [dados, setDados] = useState(() =>
    editando ? { ...vazio, ...editando, valor: String(editando.valor).replace('.', ',') } : vazio
  )
  const [codigoDigitado, setCodigoDigitado] = useState(editando?.codigo ? formatarLinhaDigitavel(editando.codigo) : '')
  const [leitura, setLeitura] = useState(null) // resultado da leitura automática
  const [lendoPDF, setLendoPDF] = useState(false)
  const [lendoFoto, setLendoFoto] = useState(false)
  const [tentouSalvar, setTentouSalvar] = useState(false)
  const dadosRef = useRef(dados)
  dadosRef.current = dados

  useEffect(() => {
    if (id && !editando) navigate('/boletos', { replace: true })
  }, [id, editando, navigate])

  const fornecedoresConhecidos = useMemo(() => {
    const mapa = new Map()
    boletos.forEach((b) => b.fornecedor && mapa.set(b.fornecedor, b))
    return mapa
  }, [boletos])

  const alterar = (campo) => (e) => {
    const valor = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e
    setDados((d) => {
      const novo = { ...d, [campo]: valor }
      // Fornecedor já usado antes: aproveita CNPJ e categoria
      if (campo === 'fornecedor' && fornecedoresConhecidos.has(valor)) {
        const anterior = fornecedoresConhecidos.get(valor)
        novo.cnpj = d.cnpj || anterior.cnpj || ''
        novo.categoria = d.categoria || anterior.categoria || ''
      }
      if (campo === 'pago' && valor && !d.dataPagamento) novo.dataPagamento = hojeISO()
      return novo
    })
  }

  const aplicarLeitura = useCallback(
    (r, origem) => {
      if (!r.ok) {
        setLeitura({ erro: r.erro })
        if (r.parcial) setDados((d) => ({ ...d, ...Object.fromEntries(Object.entries(r.parcial).filter(([, v]) => v)) }))
        return
      }
      const codigo = r.linhaDigitavel
      const duplicado = boletos.find((b) => b.id !== id && b.codigo && (b.codigo === codigo || b.codigoBarras === r.codigoBarras))
      setDados((d) => ({
        ...d,
        valor: r.valor ? String(r.valor.toFixed(2)).replace('.', ',') : d.valor,
        vencimento: r.vencimento || d.vencimento,
        banco: r.banco || r.segmento || d.banco,
        codigo,
        codigoBarras: r.codigoBarras,
        fornecedor: r.fornecedor || d.fornecedor,
        cnpj: r.cnpj || d.cnpj,
        emissao: r.emissao || d.emissao,
        categoria: d.categoria || (r.segmento?.startsWith('Energia') ? 'Energia' : r.segmento?.startsWith('Saneamento') ? 'Água' : r.segmento?.startsWith('Telecom') ? 'Internet e telefone' : ''),
      }))
      if (origem !== 'digitado') setCodigoDigitado(formatarLinhaDigitavel(codigo))
      setLeitura({
        ok: true,
        resumo: [r.banco || r.segmento || 'Conta de consumo', r.valor ? formatarMoeda(r.valor) : '', r.vencimento ? `vence ${formatarData(r.vencimento)}` : ''].filter(Boolean).join(', '),
        avisos: [...r.avisos, ...(duplicado ? [`Este boleto parece já estar cadastrado (${duplicado.fornecedor}, ${formatarData(duplicado.vencimento)}).`] : [])],
      })
    },
    [boletos, id]
  )

  // QR Code Pix (do próprio boleto): traz valor, quem recebe e a chave; não traz vencimento
  const aplicarPix = useCallback((r) => {
    if (!r.ok) {
      setLeitura({ erro: r.erro })
      return
    }
    setDados((d) => ({
      ...d,
      valor: d.valor || (r.valor ? r.valor.toFixed(2).replace('.', ',') : ''),
      fornecedor: d.fornecedor || r.nome,
      cnpj: d.cnpj || r.cnpj,
    }))
    setCodigoDigitado('')
    const avisos = []
    if (!r.valor) avisos.push('Este QR Code não traz o valor (o banco guarda esse dado). Digite o valor ou leia o código de barras.')
    if (!dadosRef.current.vencimento) avisos.push('O QR Code Pix não traz o vencimento. Leia o código de barras ou digite a data.')
    setLeitura({
      ok: true,
      resumo: ['QR Pix', r.nome, r.valor ? formatarMoeda(r.valor) : ''].filter(Boolean).join(', '),
      avisos,
    })
  }, [])

  // Recebe qualquer texto lido (digitado, colado, câmera ou leitor USB) e decide o que é
  const processarTexto = (texto, origem = 'digitado') => {
    const t = String(texto || '').trim()
    if (ehPix(t)) {
      aplicarPix(lerPix(t))
    } else if (apenasDigitos(t)) {
      aplicarLeitura(lerCodigoBoleto(t), origem)
    } else {
      return
    }
    if (origem === 'camera') toast({ title: 'Código lido pela câmera.', status: 'success' })
    if (origem === 'leitor') toast({ title: 'Código lido pelo leitor.', status: 'success' })
    if (origem === 'foto') toast({ title: 'Código lido pela foto.', status: 'success' })
  }
  const processarRef = useRef(processarTexto)
  processarRef.current = processarTexto

  const lerCodigoDigitado = (texto = codigoDigitado) => processarTexto(texto, 'digitado')

  const aoLerCamera = useCallback((codigo) => processarRef.current(codigo, 'camera'), [])

  // Leitor USB / Bluetooth: ele "digita" o código bem rápido e aperta Enter.
  // Funciona em qualquer lugar da tela (basta não estar com outro campo selecionado).
  useEffect(() => {
    let buffer = ''
    let ultimo = 0
    const aoTecla = (e) => {
      const alvo = e.target
      const emCampo = alvo && (['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName) || alvo.isContentEditable)
      if (emCampo) return
      const agora = Date.now()
      if (agora - ultimo > 80) buffer = ''
      ultimo = agora
      if (e.key === 'Enter') {
        if (buffer.length >= 40) {
          e.preventDefault()
          processarRef.current(buffer, 'leitor')
        }
        buffer = ''
        return
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) buffer += e.key
    }
    window.addEventListener('keydown', aoTecla)
    return () => window.removeEventListener('keydown', aoTecla)
  }, [])

  // Foto tirada na hora (abre a câmera do celular) ou imagem da galeria
  const aoEscolherFoto = async (e) => {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return
    setLendoFoto(true)
    setLeitura(null)
    try {
      const r = await lerCodigoDeImagem(arquivo)
      if (r.texto) {
        processarRef.current(r.texto, 'foto')
      } else if (r.outro) {
        setLeitura({ erro: `Li um código de barras (${r.outro.slice(0, 30)}), mas ele não é de boleto. O código do boleto tem 44 números e começa com o código do banco.` })
      } else {
        const pequena = Math.max(r.largura, r.altura) < 900
        setLeitura({
          erro: `Não achei o código de barras nem o QR Code nesta imagem.${pequena ? ` A imagem é pequena (${r.largura}x${r.altura}): o código de barras do boleto precisa de pelo menos uns 700 pixels de largura para ser lido.` : ''} Tire a foto de perto, só da parte das barras, com boa luz e sem reflexo, ou cole a linha digitável.`,
        })
      }
    } catch (err) {
      console.error(err)
      setLeitura({ erro: 'Não foi possível ler esta imagem.' })
    } finally {
      setLendoFoto(false)
    }
  }

  const aoEscolherPDF = async (e) => {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return
    if (arquivo.type !== 'application/pdf' && !arquivo.name.toLowerCase().endsWith('.pdf')) {
      setLeitura({ erro: 'Escolha um arquivo PDF.' })
      return
    }
    setLendoPDF(true)
    try {
      aplicarLeitura(await importarBoletoPDF(arquivo), 'pdf')
    } catch (err) {
      console.error(err)
      setLeitura({ erro: 'Não foi possível abrir este PDF. Ele pode estar protegido por senha ou danificado.' })
    } finally {
      setLendoPDF(false)
    }
  }

  const valorNumero = lerValor(dados.valor)
  const erros = {
    fornecedor: !dados.fornecedor.trim() && 'Informe quem vai receber o pagamento.',
    valor: !(valorNumero > 0) && 'Informe um valor maior que zero.',
    vencimento: !dados.vencimento && 'Informe a data de vencimento.',
  }
  const temErro = Object.values(erros).some(Boolean)

  const salvar = () => {
    setTentouSalvar(true)
    if (temErro) {
      toast({ title: 'Faltam informações obrigatórias.', status: 'warning' })
      return
    }
    const boleto = {
      ...dados,
      fornecedor: dados.fornecedor.trim(),
      valor: valorNumero,
      dataPagamento: dados.pago ? dados.dataPagamento || hojeISO() : '',
    }
    if (editando) {
      atualizarBoleto(editando.id, boleto)
      toast({ title: 'Boleto atualizado.', status: 'success' })
    } else {
      adicionarBoleto(boleto)
      toast({ title: 'Boleto cadastrado.', status: 'success' })
    }
    navigate('/boletos')
  }

  return (
    <Box maxW="760px">
      <Cabecalho titulo={editando ? 'Editar boleto' : 'Novo boleto'} />

      <Bloco mb={6} bg="creme.200" borderColor="creme.400">
        <Heading as="h2" fontSize="xl" mb={1}>
          Preencher pelo código do boleto
        </Heading>
        <Text fontSize="sm" color="marrom.400" mb={3}>
          Digite ou cole a linha digitável (ou o Pix copia e cola). O banco, o valor e o vencimento são preenchidos sozinhos. Leitor de código de barras USB também funciona: basta apontar para o boleto, sem clicar em nada.
        </Text>
        <Flex gap={2} direction={{ base: 'column', sm: 'row' }}>
          <Input
            value={codigoDigitado}
            onChange={(e) => {
              setCodigoDigitado(e.target.value)
              const v = e.target.value
              if (ehPix(v)) {
                if (pixCompleto(v)) lerCodigoDigitado(v)
                return
              }
              const n = apenasDigitos(v).length
              if (n === 44 || n === 47 || n === 48) lerCodigoDigitado(v)
            }}
            onKeyDown={(e) => e.key === 'Enter' && lerCodigoDigitado()}
            onPaste={(e) => {
              const t = e.clipboardData.getData('text')
              setTimeout(() => lerCodigoDigitado(t), 0)
            }}
            placeholder="Linha digitável (47 números) ou Pix copia e cola"
                        aria-label="Linha digitável ou código de barras"
            fontSize="sm"
          />
          <Button variant="outline" onClick={() => lerCodigoDigitado()} flexShrink={0}>
            Ler código
          </Button>
        </Flex>
        <Flex gap={2} mt={3} wrap="wrap">
          <Button size="sm" variant="ghost" leftIcon={<FiFileText />} onClick={() => inputPDF.current?.click()} isLoading={lendoPDF} loadingText="Lendo PDF">
            Importar PDF do boleto
          </Button>
          <input ref={inputPDF} type="file" accept="application/pdf,.pdf" hidden onChange={aoEscolherPDF} />
          <Button size="sm" variant="ghost" leftIcon={<FiCamera />} onClick={scanner.onOpen}>
            Ler com a câmera
          </Button>
          <Button size="sm" variant="ghost" leftIcon={<FiImage />} onClick={() => inputFoto.current?.click()} isLoading={lendoFoto} loadingText="Lendo foto">
            Foto ou imagem do boleto
          </Button>
          <input ref={inputFoto} type="file" accept="image/*" hidden onChange={aoEscolherFoto} />
        </Flex>

        {leitura?.erro && (
          <Alert status="warning" mt={3} borderRadius="lg" fontSize="sm">
            <AlertIcon />
            <AlertDescription>{leitura.erro}</AlertDescription>
          </Alert>
        )}
        {leitura?.ok && (
          <Alert status={leitura.avisos.length ? 'warning' : 'success'} mt={3} borderRadius="lg" fontSize="sm" alignItems="flex-start">
            <AlertIcon />
            <Box>
              <AlertDescription display="block" fontWeight={600}>
                Lido: {leitura.resumo}
              </AlertDescription>
              {leitura.avisos.map((a) => (
                <AlertDescription key={a} display="block">
                  {a}
                </AlertDescription>
              ))}
            </Box>
          </Alert>
        )}
      </Bloco>

      <Stack spacing={4}>
        <FormControl isRequired isInvalid={tentouSalvar && !!erros.fornecedor}>
          <FormLabel>Fornecedor (beneficiário)</FormLabel>
          <Input value={dados.fornecedor} onChange={alterar('fornecedor')} list="fornecedores" autoComplete="off" />
          <datalist id="fornecedores">
            {[...fornecedoresConhecidos.keys()].map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          <FormErrorMessage>{erros.fornecedor}</FormErrorMessage>
        </FormControl>

        <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
          <FormControl isRequired isInvalid={tentouSalvar && !!erros.valor}>
            <FormLabel>Valor</FormLabel>
            <CampoValor value={dados.valor} onChange={alterar('valor')} />
            <FormErrorMessage>{erros.valor}</FormErrorMessage>
          </FormControl>
          <FormControl isRequired isInvalid={tentouSalvar && !!erros.vencimento}>
            <FormLabel>Vencimento</FormLabel>
            <Input type="date" value={dados.vencimento} onChange={alterar('vencimento')} />
            <FormErrorMessage>{erros.vencimento}</FormErrorMessage>
          </FormControl>
          <FormControl>
            <FormLabel>Categoria</FormLabel>
            <Input value={dados.categoria} onChange={alterar('categoria')} list="categorias-boleto" autoComplete="off" placeholder="Ex.: Energia" />
            <datalist id="categorias-boleto">
              {CATEGORIAS_BOLETO.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </FormControl>
          <FormControl>
            <FormLabel>Emissão</FormLabel>
            <Input type="date" value={dados.emissao} onChange={alterar('emissao')} />
          </FormControl>
          <FormControl>
            <FormLabel>Banco</FormLabel>
            <Input value={dados.banco} onChange={alterar('banco')} />
          </FormControl>
          <FormControl>
            <FormLabel>CNPJ do fornecedor</FormLabel>
            <Input value={dados.cnpj} onChange={alterar('cnpj')} inputMode="numeric" />
          </FormControl>
        </SimpleGrid>

        <FormControl>
          <FormLabel>Observação</FormLabel>
          <Textarea value={dados.observacao} onChange={alterar('observacao')} rows={2} placeholder="Ex.: pedido de queijos de outubro" />
        </FormControl>

        <Flex gap={4} align={{ base: 'flex-start', sm: 'center' }} direction={{ base: 'column', sm: 'row' }}>
          <Checkbox isChecked={dados.pago} onChange={alterar('pago')} colorScheme="vinho">
            Este boleto já foi pago
          </Checkbox>
          {dados.pago && (
            <FormControl maxW="220px">
              <Input type="date" value={dados.dataPagamento} onChange={alterar('dataPagamento')} aria-label="Data do pagamento" />
              <FormHelperText>Data do pagamento</FormHelperText>
            </FormControl>
          )}
        </Flex>

        <Flex gap={3} pt={2}>
          <Button onClick={salvar}>{editando ? 'Salvar alterações' : 'Cadastrar boleto'}</Button>
          <Button variant="ghost" onClick={() => navigate('/boletos')}>
            Cancelar
          </Button>
        </Flex>
      </Stack>

      <ScanModal isOpen={scanner.isOpen} onClose={scanner.onClose} onResult={aoLerCamera} />
    </Box>
  )
}

export default NovoBoleto
