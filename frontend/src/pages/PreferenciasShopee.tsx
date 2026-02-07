import { useState, useEffect } from 'react';
import { Header } from '@/components/Layout/Header';
import { BreadcrumbNav } from '@/components/Layout/BreadcrumbNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useShopeePreferences } from '@/hooks/useShopeePreferences';
import { Loader2, Save, RotateCcw, Info } from 'lucide-react';

interface PreferenciasShopeeProps {
  onNavigateHome?: () => void;
  onNavigateBack?: () => void;
}

export function PreferenciasShopee({ onNavigateHome, onNavigateBack }: PreferenciasShopeeProps) {
  const { 
    preferences, 
    loading, 
    saving, 
    savePreferences, 
    resetPreferences,
  } = useShopeePreferences();

  // Estado do formulário
  const [precoBasePadrao, setPrecoBasePadrao] = useState<string>('');
  const [estoquePadraoPadrao, setEstoquePadraoPadrao] = useState<string>('');
  const [pesoPadrao, setPesoPadrao] = useState<string>('0.1');
  const [comprimentoPadrao, setComprimentoPadrao] = useState<string>('100');
  const [larguraPadrao, setLarguraPadrao] = useState<string>('');
  const [alturaPadrao, setAlturaPadrao] = useState<string>('1');
  const [usarImagensPublicasPadrao, setUsarImagensPublicasPadrao] = useState<boolean>(true);
  const [descricaoTemplate, setDescricaoTemplate] = useState<string>('');

  // Carrega preferências no formulário
  useEffect(() => {
    if (preferences) {
      if (preferences.preco_base_padrao) {
        setPrecoBasePadrao(preferences.preco_base_padrao.toString());
      }
      if (preferences.estoque_padrao_padrao) {
        setEstoquePadraoPadrao(preferences.estoque_padrao_padrao.toString());
      }
      if (preferences.peso_padrao) {
        setPesoPadrao(preferences.peso_padrao.toString());
      }
      if (preferences.dimensoes_padrao) {
        setComprimentoPadrao(preferences.dimensoes_padrao.comprimento.toString());
        if (preferences.dimensoes_padrao.largura) {
          setLarguraPadrao(preferences.dimensoes_padrao.largura.toString());
        }
        setAlturaPadrao(preferences.dimensoes_padrao.altura.toString());
      }
      if (preferences.usar_imagens_publicas_padrao !== undefined) {
        setUsarImagensPublicasPadrao(preferences.usar_imagens_publicas_padrao);
      }
      if (preferences.descricao_template) {
        setDescricaoTemplate(preferences.descricao_template);
      }
    }
  }, [preferences]);

  const handleSave = async () => {
    const data: Record<string, unknown> = {};

    if (precoBasePadrao) {
      data.preco_base_padrao = parseFloat(precoBasePadrao);
    }
    if (estoquePadraoPadrao) {
      data.estoque_padrao_padrao = parseInt(estoquePadraoPadrao, 10);
    }
    if (pesoPadrao) {
      data.peso_padrao = parseFloat(pesoPadrao);
    }
    
    const dimensoes: Record<string, number> = {};
    if (comprimentoPadrao) {
      dimensoes.comprimento = parseInt(comprimentoPadrao, 10);
    }
    if (larguraPadrao) {
      dimensoes.largura = parseInt(larguraPadrao, 10);
    }
    if (alturaPadrao) {
      dimensoes.altura = parseInt(alturaPadrao, 10);
    }
    if (Object.keys(dimensoes).length > 0) {
      data.dimensoes_padrao = dimensoes;
    }

    data.usar_imagens_publicas_padrao = usarImagensPublicasPadrao;
    
    if (descricaoTemplate) {
      data.descricao_template = descricaoTemplate;
    }

    await savePreferences(data as any);
  };

  const handleReset = async () => {
    if (!confirm('Tem certeza que deseja resetar todas as preferências para os valores padrão do sistema?')) {
      return;
    }
    
    await resetPreferences();
    
    // Limpa formulário
    setPrecoBasePadrao('');
    setEstoquePadraoPadrao('');
    setPesoPadrao('0.1');
    setComprimentoPadrao('100');
    setLarguraPadrao('');
    setAlturaPadrao('1');
    setUsarImagensPublicasPadrao(true);
    setDescricaoTemplate('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onNavigateHome={onNavigateHome} />
      
      <BreadcrumbNav
        items={[
          { label: 'Home', onClick: onNavigateHome },
          { label: 'Anúncios Shopee', onClick: onNavigateBack },
          { label: 'Preferências' }
        ]}
      />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Preferências de Anúncios</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Configure valores padrão para novos anúncios
                </p>
              </div>
            </div>

            {/* Informação */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Como funciona o pré-preenchimento:</p>
                  <ol className="list-decimal ml-4 mt-1 space-y-1">
                    <li>Dados do tecido (largura, composição)</li>
                    <li>Suas preferências configuradas aqui</li>
                    <li>Últimos valores usados</li>
                    <li>Padrões do sistema</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Preço e Estoque */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="precoBase">Preço Base Padrão (R$)</Label>
                  <Input
                    id="precoBase"
                    type="number"
                    step="0.01"
                    min="0"
                    value={precoBasePadrao}
                    onChange={(e) => setPrecoBasePadrao(e.target.value)}
                    placeholder="Ex: 29.90"
                  />
                </div>
                <div>
                  <Label htmlFor="estoquePadrao">Estoque Padrão</Label>
                  <Input
                    id="estoquePadrao"
                    type="number"
                    min="0"
                    value={estoquePadraoPadrao}
                    onChange={(e) => setEstoquePadraoPadrao(e.target.value)}
                    placeholder="Ex: 100"
                  />
                </div>
              </div>

              {/* Peso */}
              <div>
                <Label htmlFor="peso">Peso Padrão (kg)</Label>
                <Input
                  id="peso"
                  type="number"
                  step="0.01"
                  min="0"
                  value={pesoPadrao}
                  onChange={(e) => setPesoPadrao(e.target.value)}
                  placeholder="Ex: 0.1"
                />
              </div>

              {/* Dimensões */}
              <div>
                <Label>Dimensões Padrão (cm)</Label>
                <div className="grid grid-cols-3 gap-4 mt-2">
                  <div>
                    <Label className="text-xs text-gray-500">Comprimento</Label>
                    <Input
                      type="number"
                      min="0"
                      value={comprimentoPadrao}
                      onChange={(e) => setComprimentoPadrao(e.target.value)}
                      placeholder="100"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Largura</Label>
                    <Input
                      type="number"
                      min="0"
                      value={larguraPadrao}
                      onChange={(e) => setLarguraPadrao(e.target.value)}
                      placeholder="Usar do tecido"
                    />
                    <p className="text-xs text-gray-400 mt-1">Vazio = usar largura do tecido</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Altura</Label>
                    <Input
                      type="number"
                      min="0"
                      value={alturaPadrao}
                      onChange={(e) => setAlturaPadrao(e.target.value)}
                      placeholder="1"
                    />
                  </div>
                </div>
              </div>

              {/* Método de Upload */}
              <div>
                <Label>Método de Upload de Imagens</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Checkbox
                    id="usarImagensPublicas"
                    checked={usarImagensPublicasPadrao}
                    onCheckedChange={(checked) => setUsarImagensPublicasPadrao(checked as boolean)}
                  />
                  <label htmlFor="usarImagensPublicas" className="text-sm">
                    Usar URLs públicas (mais rápido, recomendado)
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Se desmarcado, as imagens serão enviadas diretamente para a Shopee
                </p>
              </div>

              {/* Template de Descrição */}
              <div>
                <Label htmlFor="descricaoTemplate">Template de Descrição</Label>
                <Textarea
                  id="descricaoTemplate"
                  value={descricaoTemplate}
                  onChange={(e) => setDescricaoTemplate(e.target.value)}
                  placeholder="Template para descrição dos anúncios. Use {nome}, {composicao}, {largura} como variáveis."
                  rows={4}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Deixe em branco para usar descrição automática baseada no tecido
                </p>
              </div>

              {/* Botões */}
              <div className="flex justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={saving}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Resetar Padrões
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Salvar Preferências
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
