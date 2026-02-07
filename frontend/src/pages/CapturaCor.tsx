import { useState } from 'react';
import { useColorimetro } from '@/hooks/useColorimetro';
import { useTecidos } from '@/hooks/useTecidos';
import { useCapturaLista, AcaoConflito } from '@/hooks/useCapturaLista';
import { ColorSwatch } from '@/components/Cores/ColorSwatch';
import { CapturaListaSimples } from '@/components/CapturaLista/CapturaListaSimples';
import { TecidoSelecaoModal } from '@/components/TecidoSelecaoModal';
import { Button } from '@/components/ui/button';
import { Loader2, Bluetooth, BluetoothOff, AlertCircle, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/Layout/Header';
import { BreadcrumbNav } from '@/components/Layout/BreadcrumbNav';
import { CreateCapturaData } from '@/types/captura.types';
import { Tecido } from '@/types/tecido.types';

interface CapturaCorProps {
  onNavigateHome?: () => void;
}

export function CapturaCor({ onNavigateHome }: CapturaCorProps) {
  const {
    connected,
    connecting,
    capturedColor,
    error,
    connect,
    disconnect,
    clearCapture,
  } = useColorimetro();

  const { tecidos, loading: tecidosLoading } = useTecidos();
  const {
    capturas,
    adicionarCaptura,
    removerCaptura,
    limparLista,
    enviarCores,
    temConflitos,
  } = useCapturaLista();
  const { toast } = useToast();

  const [modalTecidoAberto, setModalTecidoAberto] = useState(false);
  const [enviandoCores, setEnviandoCores] = useState(false);

  const handleConnect = async () => {
    try {
      await connect();
      toast({
        title: 'Conectado!',
        description: 'Dispositivo LS173 conectado com sucesso.',
      });
    } catch (err) {
      // Erro já é tratado no hook
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      toast({
        title: 'Desconectado',
        description: 'Dispositivo desconectado.',
      });
    } catch (err) {
      // Erro já é tratado no hook
    }
  };


  const handleAdicionarALista = () => {
    if (!capturedColor) return;
    setModalTecidoAberto(true);
  };

  const handleSelecionarTecido = (tecido: Tecido) => {
    if (!capturedColor) return;

    const data: CreateCapturaData = {
      lab: capturedColor.lab, // LAB compensado (usado no processo Reinhard)
      labOriginal: capturedColor.labOriginal, // LAB original capturado
      hex: capturedColor.hex,
      nome: `Cor capturada ${new Date().toLocaleTimeString()}`,
      tecidoId: tecido.id,
      tecidoNome: tecido.nome,
      tecidoImagemPadrao: tecido.imagemPadrao || '',
      tecidoSku: tecido.sku,
    };

    adicionarCaptura(data);
    clearCapture();

    toast({
      title: 'Adicionado à lista!',
      description: `Cor adicionada à lista de capturas para ${tecido.nome}`,
    });
  };

  const handleExcluirCaptura = (id: string) => {
    removerCaptura(id);
    toast({
      title: 'Captura removida',
      description: 'A captura foi removida da lista',
    });
  };

  const handleEnviarCores = async (acoesConflito: Map<string, AcaoConflito>) => {
    if (capturas.length === 0) return;

    setEnviandoCores(true);
    try {
      const resultado = await enviarCores(acoesConflito);
      
      if (resultado.falhas === 0) {
        toast({
          title: 'Sucesso!',
          description: `${resultado.sucesso} ${resultado.sucesso === 1 ? 'cor foi enviada' : 'cores foram enviadas'} com sucesso!`,
        });
      } else if (resultado.sucesso > 0) {
        toast({
          title: 'Envio parcial',
          description: `${resultado.sucesso} ${resultado.sucesso === 1 ? 'cor enviada' : 'cores enviadas'}, ${resultado.falhas} ${resultado.falhas === 1 ? 'falha' : 'falhas'}.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Erro',
          description: 'Não foi possível enviar as cores. Tente novamente.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao enviar cores',
        variant: 'destructive',
      });
    } finally {
      setEnviandoCores(false);
    }
  };

  // Verificar suporte do navegador
  const bluetoothSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onNavigateHome={onNavigateHome} />

      <BreadcrumbNav
        items={[
          { label: 'Home', onClick: onNavigateHome },
          { label: 'Capturar Cor' },
        ]}
      />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 safe-bottom">
        <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
          {/* Título */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-1 sm:mb-2">
              Captura de Cor
            </h2>
            <p className="text-sm sm:text-base text-gray-600">
              Conecte o colorímetro LS173 via Bluetooth
            </p>
          </div>

          {/* Verificação de suporte Bluetooth */}
          {!bluetoothSupported && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-900 mb-1">
                  Bluetooth não suportado
                </h3>
                <p className="text-sm text-yellow-800">
                  Este navegador não suporta Web Bluetooth API. Use Chrome ou Edge para
                  acessar esta funcionalidade.
                </p>
              </div>
            </div>
          )}

          {/* Status e Controles */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Status da Conexão
                </h3>
                <div className="flex items-center gap-2">
                  {connected ? (
                    <>
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-sm text-gray-600">Conectado</span>
                    </>
                  ) : connecting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      <span className="text-sm text-gray-600">Conectando...</span>
                    </>
                  ) : (
                    <>
                      <div className="w-3 h-3 bg-gray-400 rounded-full" />
                      <span className="text-sm text-gray-600">Desconectado</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                {!connected ? (
                  <Button
                    onClick={handleConnect}
                    disabled={connecting || !bluetoothSupported}
                  >
                    {connecting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Conectando...
                      </>
                    ) : (
                      <>
                        <Bluetooth className="mr-2 h-4 w-4" />
                        Conectar
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleDisconnect}
                    variant="outline"
                  >
                    <BluetoothOff className="mr-2 h-4 w-4" />
                    Desconectar
                  </Button>
                )}
              </div>
            </div>

            {/* Mensagem de erro */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-red-900 mb-1">Erro</h4>
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Swatch da Cor */}
          {capturedColor && <ColorSwatch color={capturedColor} />}

          {/* Botão Adicionar à Lista */}
          {capturedColor && (
            <div className="bg-white rounded-lg shadow p-4 sm:p-6 overflow-hidden">
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-2">
                    Cor Capturada
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Adicione à lista para associar a um tecido
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <Button
                    onClick={handleAdicionarALista}
                    variant="default"
                    className="w-full sm:flex-1"
                    disabled={tecidosLoading || tecidos.length === 0}
                  >
                    <Plus className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">Adicionar à Lista</span>
                    {capturas.length > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-white/20 rounded text-xs flex-shrink-0">
                        {capturas.length}
                      </span>
                    )}
                  </Button>
                  <Button
                    onClick={() => clearCapture()}
                    variant="outline"
                    className="w-full sm:w-auto"
                  >
                    Descartar
                  </Button>
                </div>

                {tecidos.length === 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800 text-center">
                      ⚠️ Cadastre pelo menos um tecido para adicionar cores à lista
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mensagem quando não há cor capturada */}
          {!capturedColor && connected && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <p className="text-sm text-blue-800">
                Pressione o botão físico no colorímetro para capturar uma cor
              </p>
            </div>
          )}

          {/* Lista de Capturas - versão simplificada */}
          <CapturaListaSimples
            capturas={capturas}
            onExcluir={handleExcluirCaptura}
            onLimparLista={limparLista}
            onEnviarCores={handleEnviarCores}
            temConflitos={temConflitos}
            enviando={enviandoCores}
          />
        </div>
      </main>

      {/* Modal de seleção de tecido */}
      <TecidoSelecaoModal
        open={modalTecidoAberto}
        onOpenChange={setModalTecidoAberto}
        onSelecionar={handleSelecionarTecido}
        tecidos={tecidos}
        loading={tecidosLoading}
      />
    </div>
  );
}
