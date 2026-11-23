// Leitura pela câmera do código de barras do boleto (ITF) e do QR Code Pix.
// 1) Usa o leitor nativo do Chrome (BarcodeDetector) quando existe: é mais rápido e preciso.
// 2) Se não existir, usa o ZXing. Nos dois casos pede câmera em alta resolução e foco contínuo,
//    porque as barras do boleto são finas e a imagem padrão (640x480) costuma não bastar.
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
import { ehPix } from '../utils/pix'

// Aceita código de barras com 44 números ou QR Code Pix
function aceitar(texto) {
  const t = String(texto || '').trim()
  if (ehPix(t)) return true
  return /^\d{44}$/.test(t.replace(/\s/g, ''))
}

const CAMERA = {
  video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
}

function ScanModal({ isOpen, onClose, onResult }) {
  const videoRef = useRef(null)
  const lanternaRef = useRef(null) // função que liga/desliga a lanterna, se o aparelho tiver
  const [erro, setErro] = useState('')
  const [temLanterna, setTemLanterna] = useState(false)
  const [lanternaLigada, setLanternaLigada] = useState(false)

  useEffect(() => {
    if (!isOpen) return undefined
    let cancelado = false
    let fluxo = null
    let controles = null
    let timer = null
    setErro('')
    setTemLanterna(false)
    setLanternaLigada(false)
    lanternaRef.current = null

    const concluir = (texto) => {
      if (cancelado) return
      cancelado = true
      onResult(texto)
      onClose()
    }

    async function comLeitorNativo() {
      if (!('BarcodeDetector' in window)) return false
      const suportados = await window.BarcodeDetector.getSupportedFormats()
      const formatos = ['itf', 'qr_code'].filter((f) => suportados.includes(f))
      if (!formatos.includes('itf')) return false

      fluxo = await navigator.mediaDevices.getUserMedia(CAMERA)
      if (cancelado) return true
      const video = videoRef.current
      video.srcObject = fluxo
      await video.play()

      const trilha = fluxo.getVideoTracks()[0]
      try {
        await trilha.applyConstraints({ advanced: [{ focusMode: 'continuous' }] })
      } catch {
        /* aparelho sem controle de foco: segue assim mesmo */
      }
      if (trilha.getCapabilities?.().torch) {
        setTemLanterna(true)
        lanternaRef.current = (ligar) => trilha.applyConstraints({ advanced: [{ torch: ligar }] })
      }

      const detector = new window.BarcodeDetector({ formats: formatos })
      const procurar = async () => {
        if (cancelado) return
        try {
          const achados = await detector.detect(video)
          const bom = achados.find((a) => aceitar(a.rawValue))
          if (bom) return concluir(bom.rawValue)
        } catch {
          /* quadro ainda sem imagem: tenta de novo */
        }
        timer = setTimeout(procurar, 120)
      }
      procurar()
      return true
    }

    async function comZXing() {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const { BarcodeFormat, DecodeHintType } = await import('@zxing/library')
      const dicas = new Map()
      dicas.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.ITF, BarcodeFormat.QR_CODE])
      dicas.set(DecodeHintType.TRY_HARDER, true)
      const leitor = new BrowserMultiFormatReader(dicas, { delayBetweenScanAttempts: 80 })
      if (cancelado) return
      controles = await leitor.decodeFromConstraints(
        { video: { ...CAMERA.video, advanced: [{ focusMode: 'continuous' }] } },
        videoRef.current,
        (resultado, _err, ctrl) => {
          const texto = resultado?.getText()
          if (texto && aceitar(texto)) {
            ctrl.stop()
            concluir(texto)
          }
        }
      )
      if (controles?.switchTorch) {
        setTemLanterna(true)
        lanternaRef.current = (ligar) => controles.switchTorch(ligar)
      }
    }

    async function iniciar() {
      try {
        const nativo = await comLeitorNativo().catch(() => false)
        if (!nativo && !cancelado) await comZXing()
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
      controles?.stop()
      fluxo?.getTracks().forEach((t) => t.stop())
    }
  }, [isOpen, onClose, onResult])

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
                Deite o boleto numa superfície plana, com boa luz, e deixe as barras sobre a linha vermelha, a uns 15 a 20 cm.
                Se não ler, afaste ou aproxime um pouco, ou cole a linha digitável no campo.
              </Text>
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