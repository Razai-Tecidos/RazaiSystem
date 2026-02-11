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
  const [comissaoPercentualPadrao, setComissaoPercentualPadrao] = useState<string>('20');
  const [taxaFixaItemPadrao, setTaxaFixaItemPadrao] = useState<string>('4');
  const [margemLiquidaPercentualPadrao, setMargemLiquidaPercentualPadrao] = useState<string>('20');
  const [modoMargemLucroPadrao, setModoMargemLucroPadrao] = useState<'percentual' | 'valor_fixo'>('percentual');
  const [margemLucroFixaPadrao, setMargemLucroFixaPadrao] = useState<string>('0');
  const [valorMinimoBaixoValorPadrao, setValorMinimoBaixoValorPadrao] = useState<string>('8');
  const [adicionalBaixoValorPadrao, setAdicionalBaixoValorPadrao] = useState<string>('1');
  const [tetoComissaoPadrao, setTetoComissaoPadrao] = useState<string>('100');
  const [aplicarTetoPadrao, setAplicarTetoPadrao] = useState<boolean>(true);
  const [aplicarBaixoValorPadrao, setAplicarBaixoValorPadrao] = useState<boolean>(true);
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
      if (preferences.comissao_percentual_padrao !== undefined) {
        setComissaoPercentualPadrao(preferences.comissao_percentual_padrao.toString());
      }
      if (preferences.taxa_fixa_item_padrao !== undefined) {
        setTaxaFixaItemPadrao(preferences.taxa_fixa_item_padrao.toString());
      }
      if (preferences.margem_liquida_percentual_padrao !== undefined) {
        setMargemLiquidaPercentualPadrao(preferences.margem_liquida_percentual_padrao.toString());
      }
      if (preferences.modo_margem_lucro_padrao !== undefined) {
        setModoMargemLucroPadrao(preferences.modo_margem_lucro_padrao);
      }
      if (preferences.margem_lucro_fixa_padrao !== undefined) {
        setMargemLucroFixaPadrao(preferences.margem_lucro_fixa_padrao.toString());
      }
      if (preferences.valor_minimo_baixo_valor_padrao !== undefined) {
        setValorMinimoBaixoValorPadrao(preferences.valor_minimo_baixo_valor_padrao.toString());
      }
      if (preferences.adicional_baixo_valor_padrao !== undefined) {
        setAdicionalBaixoValorPadrao(preferences.adicional_baixo_valor_padrao.toString());
      }
      if (preferences.teto_comissao_padrao !== undefined) {
        setTetoComissaoPadrao(preferences.teto_comissao_padrao.toString());
      }
      if (preferences.aplicar_teto_padrao !== undefined) {
        setAplicarTetoPadrao(preferences.aplicar_teto_padrao);
      }
      if (preferences.aplicar_baixo_valor_padrao !== undefined) {
        setAplicarBaixoValorPadrao(preferences.aplicar_baixo_valor_padrao);
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
    if (comissaoPercentualPadrao) {
      data.comissao_percentual_padrao = parseFloat(comissaoPercentualPadrao);
    }
    if (taxaFixaItemPadrao) {
      data.taxa_fixa_item_padrao = parseFloat(taxaFixaItemPadrao);
    }
    if (margemLiquidaPercentualPadrao) {
      data.margem_liquida_percentual_padrao = parseFloat(margemLiquidaPercentualPadrao);
    }
    data.modo_margem_lucro_padrao = modoMargemLucroPadrao;
    if (margemLucroFixaPadrao) {
      data.margem_lucro_fixa_padrao = parseFloat(margemLucroFixaPadrao);
    }
    if (valorMinimoBaixoValorPadrao) {
      data.valor_minimo_baixo_valor_padrao = parseFloat(valorMinimoBaixoValorPadrao);
    }
    if (adicionalBaixoValorPadrao) {
      data.adicional_baixo_valor_padrao = parseFloat(adicionalBaixoValorPadrao);
    }
    if (tetoComissaoPadrao) {
      data.teto_comissao_padrao = parseFloat(tetoComissaoPadrao);
    }
    data.aplicar_teto_padrao = aplicarTetoPadrao;
    data.aplicar_baixo_valor_padrao = aplicarBaixoValorPadrao;
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
    setComissaoPercentualPadrao('20');
    setTaxaFixaItemPadrao('4');
    setMargemLiquidaPercentualPadrao('20');
    setModoMargemLucroPadrao('percentual');
    setMargemLucroFixaPadrao('0');
    setValorMinimoBaixoValorPadrao('8');
    setAdicionalBaixoValorPadrao('1');
    setTetoComissaoPadrao('100');
    setAplicarTetoPadrao(true);
    setAplicarBaixoValorPadrao(true);
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

              {/* Precificacao CNPJ */}
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="font-medium text-gray-900 mb-1">Precificacao Shopee (CNPJ)</h3>
                <p className="text-xs text-gray-500 mb-4">
                  Esses valores preenchem automaticamente o step de Tamanhos e Precificacao.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="comissaoPadrao">Comissao (%)</Label>
                    <Input
                      id="comissaoPadrao"
                      type="number"
                      step="0.01"
                      min="0"
                      value={comissaoPercentualPadrao}
                      onChange={(e) => setComissaoPercentualPadrao(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="taxaFixaPadrao">Taxa fixa por item (R$)</Label>
                    <Input
                      id="taxaFixaPadrao"
                      type="number"
                      step="0.01"
                      min="0"
                      value={taxaFixaItemPadrao}
                      onChange={(e) => setTaxaFixaItemPadrao(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="margemPadrao">Margem liquida (%)</Label>
                    <Input
                      id="margemPadrao"
                      type="number"
                      step="0.01"
                      min="0"
                      value={margemLiquidaPercentualPadrao}
                      onChange={(e) => setMargemLiquidaPercentualPadrao(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="modoMargemPadrao">Modo da margem</Label>
                    <select
                      id="modoMargemPadrao"
                      value={modoMargemLucroPadrao}
                      onChange={(e) => setModoMargemLucroPadrao(e.target.value as 'percentual' | 'valor_fixo')}
                      className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="percentual">Percentual (%)</option>
                      <option value="valor_fixo">Valor fixo (R$)</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="margemFixaPadrao">Margem fixa (R$)</Label>
                    <Input
                      id="margemFixaPadrao"
                      type="number"
                      step="0.01"
                      min="0"
                      value={margemLucroFixaPadrao}
                      onChange={(e) => setMargemLucroFixaPadrao(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="tetoPadrao">Teto de comissao (R$)</Label>
                    <Input
                      id="tetoPadrao"
                      type="number"
                      step="0.01"
                      min="0"
                      value={tetoComissaoPadrao}
                      onChange={(e) => setTetoComissaoPadrao(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="minBaixoPadrao">Minimo baixo valor (R$)</Label>
                    <Input
                      id="minBaixoPadrao"
                      type="number"
                      step="0.01"
                      min="0"
                      value={valorMinimoBaixoValorPadrao}
                      onChange={(e) => setValorMinimoBaixoValorPadrao(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="adicionalBaixoPadrao">Adicional baixo valor (R$)</Label>
                    <Input
                      id="adicionalBaixoPadrao"
                      type="number"
                      step="0.01"
                      min="0"
                      value={adicionalBaixoValorPadrao}
                      onChange={(e) => setAdicionalBaixoValorPadrao(e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={aplicarTetoPadrao}
                      onCheckedChange={(checked) => setAplicarTetoPadrao(checked as boolean)}
                    />
                    Aplicar teto de comissao por item
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={aplicarBaixoValorPadrao}
                      onCheckedChange={(checked) => setAplicarBaixoValorPadrao(checked as boolean)}
                    />
                    Aplicar adicional de baixo valor
                  </label>
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
