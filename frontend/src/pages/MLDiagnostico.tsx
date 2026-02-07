import { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useReinhardML } from '@/hooks/useReinhardML';
import { useCorTecido } from '@/hooks/useCorTecido';
import { useTecidos } from '@/hooks/useTecidos';
import { getTrainingExamples, countTrainingExamples } from '@/lib/firebase/ml-training';
import { TrainingExample } from '@/types/ml.types';
import { Header } from '@/components/Layout/Header';
import { BreadcrumbNav } from '@/components/Layout/BreadcrumbNav';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, Brain, Database, AlertTriangle, CheckCircle2, Cloud, Clock, Wrench, Sparkles } from 'lucide-react';

interface MLDiagnosticoProps {
  onNavigateHome?: () => void;
}

export function MLDiagnostico({ onNavigateHome }: MLDiagnosticoProps) {
  const { toast } = useToast();
  const { status, exampleCount, train, metadata, lastAutoCheck } = useReinhardML();
  const { vinculos } = useCorTecido();
  const { tecidos } = useTecidos();
  const [exemplos, setExemplos] = useState<TrainingExample[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [treinando, setTreinando] = useState(false);
  const [enriquecendo, setEnriquecendo] = useState(false);
  
  // Estatísticas dos dados
  const exemplosSemTecidoId = exemplos.filter(e => !e.tecidoId).length;
  const exemplosComTecidoId = exemplos.filter(e => e.tecidoId).length;

  useEffect(() => {
    carregarExemplos();
  }, []);

  const carregarExemplos = async () => {
    setCarregando(true);
    try {
      await countTrainingExamples();
      const examples = await getTrainingExamples(50); // Últimos 50
      setExemplos(examples.reverse()); // Mais recentes primeiro
    } catch (error) {
      console.error('Erro ao carregar exemplos:', error);
    } finally {
      setCarregando(false);
    }
  };

  const handleTreinar = async () => {
    setTreinando(true);
    try {
      await train();
      toast({
        title: 'Sucesso!',
        description: 'Modelo treinado e salvo no Firebase!',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao treinar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setTreinando(false);
    }
  };
  
  /**
   * Enriquece exemplos antigos com tecidoId e tecidoNome
   * Busca o vínculo correspondente pela corId e infere o tecido
   */
  const handleEnriquecerDados = async () => {
    setEnriquecendo(true);
    let atualizados = 0;
    let erros = 0;
    
    try {
      // Buscar todos os exemplos
      const todosExemplos = await getTrainingExamples(1000);
      const exemplosSemTecido = todosExemplos.filter(e => !e.tecidoId && e.corId);
      
      toast({
        title: 'Processando...',
        description: `Analisando ${exemplosSemTecido.length} exemplos sem tecidoId`,
      });
      
      for (const exemplo of exemplosSemTecido) {
        if (!exemplo.id || !exemplo.corId) continue;
        
        // Buscar vínculo que tenha essa corId
        const vinculoCorrespondente = vinculos.find(v => v.corId === exemplo.corId);
        
        if (vinculoCorrespondente) {
          // Buscar tecido
          const tecido = tecidos.find(t => t.id === vinculoCorrespondente.tecidoId);
          
          if (tecido) {
            try {
              // Atualizar documento no Firestore
              await updateDoc(doc(db, 'ml_training_examples', exemplo.id), {
                tecidoId: tecido.id,
                tecidoNome: tecido.nome,
                tecidoTipo: tecido.tipo || exemplo.tecidoTipo,
                tecidoComposicao: tecido.composicao || exemplo.tecidoComposicao,
              });
              atualizados++;
            } catch (err) {
              console.error(`Erro ao atualizar exemplo ${exemplo.id}:`, err);
              erros++;
            }
          }
        }
      }
      
      toast({
        title: 'Enriquecimento concluído!',
        description: `${atualizados} exemplos atualizados, ${erros} erros`,
      });
      
      // Recarregar exemplos
      await carregarExemplos();
      
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setEnriquecendo(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) return 'N/A';
    return timestamp.toDate().toLocaleString('pt-BR');
  };
  
  const formatDateString = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Nunca';
    return new Date(dateStr).toLocaleString('pt-BR');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onNavigateHome={onNavigateHome} />
      
      <BreadcrumbNav
        items={[
          { label: 'Home', onClick: onNavigateHome },
          { label: 'Diagnóstico ML' }
        ]}
      />

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Status Geral */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Brain className="h-6 w-6" />
            Status do Modelo ML
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Status */}
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-500 mb-1">Status</div>
              <div className={`text-lg font-semibold flex items-center gap-2 ${
                status === 'ready' ? 'text-green-600' :
                status === 'training' ? 'text-blue-600' :
                status === 'error' ? 'text-red-600' :
                'text-gray-600'
              }`}>
                {status === 'ready' && <CheckCircle2 className="h-5 w-5" />}
                {status === 'training' && <Loader2 className="h-5 w-5 animate-spin" />}
                {status === 'error' && <AlertTriangle className="h-5 w-5" />}
                {status === 'ready' ? 'Pronto' :
                 status === 'training' ? 'Treinando...' :
                 status === 'loading' ? 'Carregando...' :
                 status === 'error' ? 'Erro' : 'Aguardando exemplos'}
              </div>
            </div>
            
            {/* Exemplos */}
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-500 mb-1">Exemplos no Firebase</div>
              <div className={`text-lg font-semibold ${exampleCount < 10 ? 'text-amber-600' : 'text-green-600'}`}>
                {exampleCount} {exampleCount < 10 && <span className="text-sm font-normal">(mínimo: 10)</span>}
              </div>
            </div>
            
            {/* Último Treinamento */}
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                <Cloud className="h-3 w-3" /> Último Treinamento
              </div>
              <div className="text-lg font-semibold text-gray-700">
                {formatDateString(metadata?.trainedAt)}
              </div>
              {metadata?.exampleCount && (
                <div className="text-xs text-gray-500 mt-1">
                  com {metadata.exampleCount} exemplos
                </div>
              )}
            </div>
            
            {/* Última Verificação */}
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Última Verificação
              </div>
              <div className="text-sm font-medium text-gray-700">
                {lastAutoCheck ? lastAutoCheck.toLocaleTimeString('pt-BR') : '-'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Auto-check a cada 30s
              </div>
            </div>
          </div>
          
          {/* Indicador de treinamento automático */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
            <CheckCircle2 className="h-4 w-4 inline mr-2" />
            <strong>Treinamento automático ativo:</strong> O modelo treina sozinho quando detecta 5+ novos exemplos.
            Você não precisa fazer nada!
          </div>
          
          <div className="mt-4 flex gap-3">
            <Button
              onClick={handleTreinar}
              disabled={treinando || exampleCount < 10 || status === 'training'}
              variant="outline"
            >
              {treinando || status === 'training' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Treinando...
                </>
              ) : (
                <>
                  <Brain className="mr-2 h-4 w-4" />
                  Forçar Treinamento
                </>
              )}
            </Button>
            
            <Button variant="outline" onClick={carregarExemplos} disabled={carregando}>
              <RefreshCw className={`mr-2 h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
          
          {exampleCount < 10 && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
              <AlertTriangle className="h-4 w-4 inline mr-2" />
              O modelo precisa de pelo menos 10 exemplos de cores editadas para funcionar.
              Atualmente há {exampleCount} exemplo(s). Continue editando cores para treinar o ML automaticamente!
            </div>
          )}
        </div>

        {/* Informações do Modelo */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Database className="h-6 w-6" />
            Arquitetura do Modelo
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="border rounded p-3">
              <div className="text-gray-500">Features de Entrada</div>
              <div className="font-medium">14 (LAB + tecido + stats)</div>
            </div>
            <div className="border rounded p-3">
              <div className="text-gray-500">Camadas Ocultas</div>
              <div className="font-medium">[64, 32] neurônios</div>
            </div>
            <div className="border rounded p-3">
              <div className="text-gray-500">Saídas</div>
              <div className="font-medium">6 ajustes Reinhard</div>
            </div>
            <div className="border rounded p-3">
              <div className="text-gray-500">Armazenamento</div>
              <div className="font-medium flex items-center gap-1">
                <Cloud className="h-4 w-4 text-blue-500" />
                Firebase Storage
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg text-purple-800 text-sm">
            <Sparkles className="h-4 w-4 inline mr-2" />
            <strong>Modelo v2.0:</strong> Agora com características de tecido (brilho, absorção, textura) para aprender 
            padrões específicos por tipo de tecido. Cetim, linho, seda - cada um aprende diferente!
          </div>
          
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
            <CheckCircle2 className="h-4 w-4 inline mr-2" />
            <strong>Modelo compartilhado:</strong> O modelo treinado fica salvo no Firebase Storage. 
            Qualquer dispositivo que acessar o sistema terá acesso ao mesmo modelo treinado!
          </div>
        </div>
        
        {/* Manutenção de Dados */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Wrench className="h-6 w-6" />
            Manutenção de Dados
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-500 mb-1">Exemplos com tecidoId</div>
              <div className="text-2xl font-bold text-green-600">{exemplosComTecidoId}</div>
              <div className="text-xs text-gray-500">Dados completos para v2</div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-500 mb-1">Exemplos sem tecidoId</div>
              <div className={`text-2xl font-bold ${exemplosSemTecidoId > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {exemplosSemTecidoId}
              </div>
              <div className="text-xs text-gray-500">Dados legados (v1)</div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-500 mb-1">Vínculos disponíveis</div>
              <div className="text-2xl font-bold text-blue-600">{vinculos.length}</div>
              <div className="text-xs text-gray-500">Para inferir tecidos</div>
            </div>
          </div>
          
          {exemplosSemTecidoId > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <div className="font-medium text-amber-800">
                    {exemplosSemTecidoId} exemplo(s) sem informação de tecido
                  </div>
                  <p className="text-sm text-amber-700 mt-1">
                    Esses exemplos foram criados antes da v2 e não têm <code>tecidoId</code> e <code>tecidoNome</code>.
                    O modelo ainda funciona (usa valores médios), mas pode ser melhorado enriquecendo os dados.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex gap-3">
            <Button
              onClick={handleEnriquecerDados}
              disabled={enriquecendo || exemplosSemTecidoId === 0}
              variant={exemplosSemTecidoId > 0 ? 'default' : 'outline'}
              className={exemplosSemTecidoId > 0 ? 'bg-amber-600 hover:bg-amber-700' : ''}
            >
              {enriquecendo ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enriquecendo...
                </>
              ) : (
                <>
                  <Wrench className="mr-2 h-4 w-4" />
                  Enriquecer Dados Antigos
                </>
              )}
            </Button>
            
            {exemplosSemTecidoId === 0 && exemplosComTecidoId > 0 && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                Todos os dados estão completos!
              </span>
            )}
          </div>
          
          <p className="text-xs text-gray-500 mt-3">
            O enriquecimento busca o vínculo correspondente a cada exemplo (pela corId) e adiciona 
            o tecidoId e tecidoNome. Isso permite que o modelo v2 aprenda padrões específicos por tecido.
          </p>
        </div>

        {/* Exemplos de Treinamento */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Últimos Exemplos de Treinamento
          </h2>
          
          {carregando ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : exemplos.length === 0 ? (
            <p className="text-gray-500 py-4">Nenhum exemplo de treinamento encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Data</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">LAB Original</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Saturação</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Contraste</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Detalhe</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Escurecer</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Sombras</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Hue Shift</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Tecido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {exemplos.map((ex, i) => (
                    <tr key={ex.id || i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                        {formatDate(ex.timestamp)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        L:{ex.lab.L.toFixed(1)} a:{ex.lab.a.toFixed(1)} b:{ex.lab.b.toFixed(1)}
                      </td>
                      <td className="px-3 py-2">{ex.ajustes.saturationMultiplier?.toFixed(2) ?? '-'}</td>
                      <td className="px-3 py-2">{ex.ajustes.contrastBoost?.toFixed(2) ?? '-'}</td>
                      <td className="px-3 py-2">{ex.ajustes.detailAmount?.toFixed(2) ?? '-'}</td>
                      <td className="px-3 py-2">{ex.ajustes.darkenAmount?.toFixed(1) ?? '-'}</td>
                      <td className="px-3 py-2">{ex.ajustes.shadowDesaturation?.toFixed(2) ?? '-'}</td>
                      <td className="px-3 py-2">
                        <span className={ex.ajustes.hueShift && Math.abs(ex.ajustes.hueShift) > 30 ? 'text-amber-600 font-medium' : ''}>
                          {ex.ajustes.hueShift?.toFixed(1) ?? '0'}°
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {ex.tecidoNome ? (
                          <span className="text-green-700 font-medium">{ex.tecidoNome}</span>
                        ) : ex.tecidoTipo ? (
                          <span className="text-gray-500">{ex.tecidoTipo}</span>
                        ) : (
                          <span className="text-amber-500">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
