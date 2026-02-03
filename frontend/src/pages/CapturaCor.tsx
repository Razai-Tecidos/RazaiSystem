import { useState } from 'react';
import { useColorimetro } from '@/hooks/useColorimetro';
import { useTecidos } from '@/hooks/useTecidos';
import { useCapturaLista } from '@/hooks/useCapturaLista';
import { ColorSwatch } from '@/components/Cores/ColorSwatch';
import { CapturaListaSimples } from '@/components/CapturaLista/CapturaListaSimples';
import { TecidoSelecaoModal } from '@/components/TecidoSelecaoModal';
import { Button } from '@/components/ui/button';
import { Loader2, Bluetooth, BluetoothOff, AlertCircle, Plus, Trash2 } from 'lucide-react';
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
    rawData,
    dataHistory,
    connect,
    disconnect,
    clearCapture,
    clearRawData,
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
      lab: capturedColor.lab,
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

  const handleEnviarCores = async () => {
    if (capturas.length === 0) return;

    setEnviandoCores(true);
    try {
      const resultado = await enviarCores();
      
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

          {/* Instruções quando não há cor capturada */}
          {!capturedColor && connected && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Como usar:</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                <li>Posicione o colorímetro sobre a cor que deseja capturar</li>
                <li><strong>Pressione o botão físico no colorímetro</strong> para capturar</li>
                <li>Aguarde a leitura do dispositivo (a cor aparecerá automaticamente)</li>
                <li>Revise a cor capturada no swatch</li>
                <li>Clique em "Adicionar à Lista" para associar a um tecido</li>
                <li>Selecione o tecido no modal que abrir</li>
                <li>A cor será adicionada à lista com validação automática de conflitos</li>
                <li>Envie as cores para "Gerenciar Cores" onde poderá editar e ver o preview</li>
              </ol>
              <div className="mt-3 p-2 bg-blue-100 rounded text-xs text-blue-900">
                A captura é automática quando você pressiona o botão físico do colorímetro. Não é necessário clicar em nenhum botão no app.
              </div>
            </div>
          )}

          {/* Debug: Dados brutos recebidos - visível no celular */}
          {connected && (
            <div className="bg-gray-900 rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-300">
                    Debug: Dados Bluetooth
                  </h3>
                  <div className={`w-2 h-2 rounded-full ${rawData ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
                </div>
                {dataHistory.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearRawData}
                    className="text-gray-400 hover:text-white h-7 px-2"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Limpar
                  </Button>
                )}
              </div>
              
              {dataHistory.length > 0 ? (
                <div className="space-y-3">
                  {/* Histórico de pacotes */}
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {dataHistory.map((entry, index) => (
                      <pre 
                        key={index} 
                        className={`text-xs font-mono whitespace-pre-wrap break-all p-2 rounded ${
                          index === dataHistory.length - 1 
                            ? 'bg-green-900/50 text-green-300 border border-green-700' 
                            : 'bg-black/30 text-gray-400'
                        }`}
                      >
                        {entry}
                      </pre>
                    ))}
                  </div>
                  
                  <div className="text-xs text-gray-500 flex items-center justify-between">
                    <span>{dataHistory.length} pacote(s) recebido(s)</span>
                    {!capturedColor && (
                      <span className="text-yellow-500">Formato não reconhecido</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 border-2 border-dashed border-gray-700 rounded-lg">
                  <p className="text-gray-500 text-sm">
                    Aguardando dados do colorímetro...
                  </p>
                  <p className="text-gray-600 text-xs mt-1">
                    Pressione o botão físico no dispositivo
                  </p>
                </div>
              )}

              {/* Legenda dos formatos */}
              <div className="mt-3 pt-3 border-t border-gray-800">
                <p className="text-xs text-gray-600">
                  <strong className="text-gray-500">HEX:</strong> Hexadecimal | 
                  <strong className="text-gray-500 ml-1">DEC:</strong> Decimal | 
                  <strong className="text-gray-500 ml-1">ASCII:</strong> Texto
                </p>
              </div>
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
