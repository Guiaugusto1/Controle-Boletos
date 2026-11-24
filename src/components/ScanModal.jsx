// Leitura ao vivo pela câmera do celular: código de barras do boleto (ITF) e QR Code Pix.
// Funciona com o boleto na vertical ou na horizontal: cada quadro é analisado em duas
// orientações e em recortes diferentes. Usa o leitor nativo do Chrome quando existe e,
// junto, o ZXing. Mostra embaixo qual leitor está ativo e quantos quadros foram analisados.
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  Text,
  Box,
  Button,
  Alert,
  AlertIcon,
} from '@chakra-ui/react'
import { useEffect, useRef, useState } from 'react'
import { aceitarCodigo, criarDetectorNativo, criarLeitor, criarLeitorOutros, decodificar, desenhar } from '../utils/lerImagem'

const CAMERA = {
  video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
}

// [rotação em graus, parte central da altura analisada]
const PLANOS = [
  [0, 0.45],
  [90, 0.45],
  [0, 1],
  [90, 1],
]

function ScanModal({ isOpen, onClose, onResult }) {
  const videoRef = useRef(null)
  const lanternaRef = useRef(null)
  const retornoRef = useRef({ onResult, onClose })
  retornoRef.current = { onResult, onClose }
  const [erro, setErro] = useState('')
  const [info, setInfo] = useState('')
  const [outro, setOutro] = useState('')
  const [temLanterna, setTemLanterna] = useState(false)
  const [lanternaLigada, setLanternaLigada] = useState(false)

  useEffect(() => {
    if (!isOpen) return undefined
    let cancelado = false
    let fluxo = null
    let timer = null
    setErro('')
    setInfo('')
    setOutro('')
    setTemLanterna(false)
    setLanternaLigada(false)
    lanternaRef.current = null

    const concluir = (texto) => {
      if (cancelado) return
      cancelado = true
      retornoRef.current.onResult(texto)
      retornoRef.current.onClose()
    }

    async function iniciar() {
      try {
        fluxo = await navigator.mediaDevices.getUserMedia(CAMERA)
        if (cancelado) {
          fluxo.getTracks().forEach((t) => t.stop())
          return
        }
        const video = videoRef.current
        video.srcObject = fluxo
        await video.play()

        const trilha = fluxo.getVideoTracks()[0]
        try {
          await trilha.applyConstraints({ advanced: [{ focusMode: 'continuous' }] })
        } catch {
          /* aparelho sem controle de foco */
        }
        if (trilha.getCapabilities?.().torch) {
          setTemLanterna(true)
          lanternaRef.current = (ligar) => trilha.applyConstraints({ advanced: [{ torch: ligar }] })
        }

        const detector = await criarDetectorNativo(true)
        let leitor = null
        try {
          leitor = await criarLeitor()
        } catch (e) {
          console.error(e)
        }
        let leitorOutros = null
        criarLeitorOutros().then((l) => { leitorOutros = l }).catch(() => {})
        const canvas = document.createElement('canvas')
        let quadros = 0

        const procurar = async () => {
          if (cancelado) return
          const w = video.videoWidth
          const h = video.videoHeight
          if (w && video.readyState >= 2) {
            quadros += 1
            if (quadros % 8 === 1) {
              setInfo(`${detector ? 'Leitor nativo + ZXing' : 'Leitor ZXing'} · câmera ${w}x${h} · ${quadros} quadros analisados`)
            }
            try {
              if (detector) {
                const achados = await detector.detect(video)
                const bom = achados.find((a) => aceitarCodigo(a.rawValue))
                if (bom) return concluir(bom.rawValue)
                if (achados[0]?.rawValue) setOutro(achados[0].rawValue)
              }
              if (leitor) {
                const [graus, faixa] = PLANOS[quadros % PLANOS.length]
                desenhar(canvas, video, w, h, graus, 1920, faixa)
                const texto = decodificar(leitor, canvas)
                if (texto && aceitarCodigo(texto)) return concluir(texto)
                if (texto) setOutro(texto)
                if (leitorOutros && quadros % 12 === 0) {
                  const t2 = decodificar(leitorOutros, canvas)
                  if (t2) setOutro(t2)
                }
              }
            } catch {
              /* quadro sem imagem ainda: tenta o próximo */
            }
          }
          timer = setTimeout(procurar, 60)
        }
        procurar()
      } catch (e) {
        console.error(e)
        setErro(
          e?.name === 'NotAllowedError'
            ? 'A câmera foi bloqueada. Libere o acesso à câmera nas permissões do navegador.'
            : 'Não foi possível abrir a câmera. A câmera só funciona em endereço seguro (https) ou no próprio computador (localhost).'
        )
      }
    }
    iniciar()

    return () => {
      cancelado = true
      clearTimeout(timer)
      fluxo?.getTracks().forEach((t) => t.stop())
      if (videoRef.current) videoRef.current.srcObject = null
    }
  }, [isOpen])

  const alternarLanterna = async () => {
    const proximo = !lanternaLigada
    try {
      await lanternaRef.current?.(proximo)
      setLanternaLigada(proximo)
    } catch {
      /* lanterna indisponível */
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered>
      <ModalOverlay />
      <ModalContent mx={3}>
        <ModalHeader fontFamily="heading" fontSize="2xl">
          Ler boleto
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {erro ? (
            <Alert status="warning" borderRadius="lg">
              <AlertIcon />
              {erro}
            </Alert>
          ) : (
            <Box textAlign="center">
              <Box position="relative" borderRadius="lg" overflow="hidden" bg="marrom.500">
                <video ref={videoRef} style={{ width: '100%', display: 'block' }} muted playsInline />
                <Box position="absolute" left="6%" right="6%" top="50%" h="2px" bg="atraso.500" opacity={0.8} />
              </Box>
              <Text fontSize="sm" mt={3} color="marrom.300">
                Aponte para o código de barras ou para o QR Code, de pé ou deitado. Deixe as barras na linha vermelha, a uns
                15 a 20 cm, com boa luz. Se não ler, use "Foto ou imagem do boleto" na tela anterior.
              </Text>
              {outro && (
                <Text fontSize="sm" mt={2} color="atraso.600">
                  Vi um código de barras ({outro.slice(0, 30)}), mas ele não é de boleto. O do boleto tem 44 números.
                </Text>
              )}
              {info && (
                <Text fontSize="xs" mt={2} color="marrom.200">
                  {info}
                </Text>
              )}
              {temLanterna && (
                <Button mt={3} size="sm" variant="outline" onClick={alternarLanterna}>
                  {lanternaLigada ? 'Desligar lanterna' : 'Ligar lanterna'}
                </Button>
              )}
            </Box>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default ScanModal
