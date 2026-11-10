// Leitura do código de barras pela câmera (celular ou webcam).
// Correção: a versão antiga chamava codeReader.reset(), que não existe no
// @zxing/browser — o certo é parar pelos "controls" devolvidos na leitura.
// Boletos usam o formato ITF (Interleaved 2 of 5).
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  Text,
  Box,
  Alert,
  AlertIcon,
} from '@chakra-ui/react'
import { useEffect, useRef, useState } from 'react'

function ScanModal({ isOpen, onClose, onResult }) {
  const videoRef = useRef(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!isOpen) return
    let controles = null
    let cancelado = false
    setErro('')

    async function iniciar() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const { BarcodeFormat, DecodeHintType } = await import('@zxing/library')
        const dicas = new Map()
        dicas.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.ITF])
        dicas.set(DecodeHintType.TRY_HARDER, true)
        const leitor = new BrowserMultiFormatReader(dicas)
        if (cancelado) return
        controles = await leitor.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          videoRef.current,
          (resultado, _err, ctrl) => {
            const texto = resultado?.getText()
            if (texto && texto.replace(/\D/g, '').length === 44) {
              ctrl.stop()
              onResult(texto)
              onClose()
            }
          }
        )
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
      controles?.stop()
    }
  }, [isOpen, onClose, onResult])

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered>
      <ModalOverlay />
      <ModalContent mx={3}>
        <ModalHeader fontFamily="heading" fontSize="2xl">
          Ler código de barras
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
                Deite o boleto e aponte para as barras, com o celular na horizontal. Com pouca luz pode demorar.
              </Text>
            </Box>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default ScanModal
