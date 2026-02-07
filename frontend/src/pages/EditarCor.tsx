import { useState, useEffect } from 'react';
import { UpdateCorData, CorTecido } from '@/types/cor.types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, ChevronLeft, ChevronRight, Link as LinkIcon, Edit } from 'lucide-react';
import { hexToRgb, rgbToLab } from '@/lib/colorUtils';
import { useCores } from '@/hooks/useCores';
import { useCorTecido } from '@/hooks/useCorTecido';
import { Header } from '@/components/Layout/Header';
import { BreadcrumbNav } from '@/components/Layout/BreadcrumbNav';

interface EditarCorProps {
  corId: string;
  onNavigateBack: () => void;
  onNavigateToCor?: (corId: string) => void;
}

export function EditarCor({ corId, onNavigateBack, onNavigateToCor }: EditarCorProps) {
  const { cores, updateCor, loading: coresLoading } = useCores();
  const { vinculos, loading: vinculosLoading } = useCorTecido();
  
  const cor = cores.find(c => c.id === corId);
  
  // Encontrar índice da cor atual e cores adjacentes
  const currentIndex = cores.findIndex(c => c.id === corId);
  const corAnterior = currentIndex > 0 ? cores[currentIndex - 1] : null;
  const corProxima = currentIndex >= 0 && currentIndex < cores.length - 1 ? cores[currentIndex + 1] : null;
  
  // Vínculos desta cor
  const vinculosCor = vinculos.filter(v => v.corId === corId);
  
  const [nome, setNome] = useState('');
  const [codigoHex, setCodigoHex] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inicializar dados quando cor carregar ou mudar
  useEffect(() => {
    if (cor) {
      setNome(cor.nome);
      setCodigoHex(cor.codigoHex || '');
      setErrors({});
    }
  }, [cor]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!nome.trim()) {
      newErrors.nome = 'Nome é obrigatório';
    }

    if (codigoHex && !/^#[0-9A-Fa-f]{6}$/.test(codigoHex)) {
      newErrors.codigoHex = 'Formato inválido. Use #RRGGBB';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!cor || !validate()) return;
    
    setIsSubmitting(true);
    
    try {
      // Calcular LAB e RGB se tiver hex
      let lab = cor.lab;
      let rgb = cor.rgb;
      
      if (codigoHex && /^#[0-9A-Fa-f]{6}$/.test(codigoHex)) {
        const converted = hexToRgb(codigoHex);
        if (converted) {
          rgb = converted;
          lab = rgbToLab(rgb);
        }
      }
      
      const data: UpdateCorData = {
        id: cor.id,
        nome: nome.trim(),
        codigoHex: codigoHex || undefined,
        lab,
        rgb: rgb || undefined,
      };
      
      await updateCor(data);
      onNavigateBack();
    } catch (error) {
      // Erro é tratado no hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNavigateToVinculo = (vinculo: CorTecido) => {
    // TODO: Implementar navegação para editar vínculo específico
    console.log('Navegar para vínculo:', vinculo.id);
  };

  const isFormDisabled = coresLoading || isSubmitting;

  if (coresLoading && !cor) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!cor) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header onNavigateHome={onNavigateBack} />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-gray-500 mb-4">Cor não encontrada</p>
            <Button onClick={onNavigateBack}>Voltar</Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onNavigateHome={onNavigateBack} />
      
      <BreadcrumbNav
        items={[
          { label: 'Cores', onClick: onNavigateBack },
          { label: nome || 'Editar Cor' }
        ]}
      />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Header com navegação */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={onNavigateBack}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-bold text-gray-900">Editar Cor</h1>
            </div>
            
            {/* Navegação entre cores */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => corAnterior && onNavigateToCor?.(corAnterior.id)}
                disabled={!corAnterior}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <span className="text-sm text-gray-500 px-2">
                {currentIndex + 1} / {cores.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => corProxima && onNavigateToCor?.(corProxima.id)}
                disabled={!corProxima}
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Formulário */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 border-b pb-2">Dados da Cor</h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Nome */}
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Vermelho Bordô"
                    disabled={isFormDisabled}
                  />
                  {errors.nome && (
                    <p className="text-sm text-red-500">{errors.nome}</p>
                  )}
                </div>

                {/* Código HEX */}
                <div className="space-y-2">
                  <Label htmlFor="codigoHex">Código HEX</Label>
                  <div className="flex gap-2">
                    <Input
                      id="codigoHex"
                      value={codigoHex}
                      onChange={(e) => {
                        let val = e.target.value.toUpperCase();
                        if (val && !val.startsWith('#')) {
                          val = '#' + val;
                        }
                        setCodigoHex(val);
                      }}
                      placeholder="#FF0000"
                      disabled={isFormDisabled}
                      maxLength={7}
                      className="font-mono"
                    />
                    {codigoHex && /^#[0-9A-Fa-f]{6}$/.test(codigoHex) && (
                      <div
                        className="w-10 h-10 rounded-md border-2 border-gray-200 shadow-sm flex-shrink-0"
                        style={{ backgroundColor: codigoHex }}
                        title={codigoHex}
                      />
                    )}
                  </div>
                  {errors.codigoHex && (
                    <p className="text-sm text-red-500">{errors.codigoHex}</p>
                  )}
                </div>

                {/* SKU */}
                <div className="space-y-2">
                  <Label>SKU</Label>
                  <Input
                    value={cor.sku || 'Sem SKU'}
                    disabled
                    className="bg-gray-50"
                  />
                  <p className="text-xs text-gray-500">
                    SKU é gerado automaticamente quando a cor recebe um nome.
                  </p>
                </div>

                {/* Preview da Cor */}
                {codigoHex && /^#[0-9A-Fa-f]{6}$/.test(codigoHex) && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Preview</h4>
                    <div className="flex items-center gap-4">
                      <div
                        className="w-20 h-20 rounded-lg border-2 border-gray-200 shadow-md"
                        style={{ backgroundColor: codigoHex }}
                      />
                      <div className="text-sm text-gray-600 space-y-1">
                        <p><span className="font-medium">HEX:</span> {codigoHex}</p>
                        {(() => {
                          const rgb = hexToRgb(codigoHex);
                          if (rgb) {
                            const lab = rgbToLab(rgb);
                            return (
                              <>
                                <p><span className="font-medium">RGB:</span> {rgb.r}, {rgb.g}, {rgb.b}</p>
                                <p><span className="font-medium">LAB:</span> {lab.L.toFixed(1)}, {lab.a.toFixed(1)}, {lab.b.toFixed(1)}</p>
                              </>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onNavigateBack}
                    disabled={isFormDisabled}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isFormDisabled} className="flex-1">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      'Salvar'
                    )}
                  </Button>
                </div>
              </form>
            </div>

            {/* Vínculos */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 border-b pb-2 flex items-center gap-2">
                <LinkIcon className="h-5 w-5 text-blue-500" />
                Vínculos com Tecidos
              </h2>
              
              {vinculosLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : vinculosCor.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <LinkIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>Nenhum vínculo com tecido</p>
                  <p className="text-sm mt-1">
                    Acesse a página de <strong>Vínculos</strong> para associar esta cor a tecidos.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {vinculosCor.map(vinculo => (
                    <div
                      key={vinculo.id}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {/* Preview da imagem tingida */}
                      {vinculo.imagemTingida ? (
                        <img
                          src={vinculo.imagemTingida}
                          alt={`${cor.nome} em ${vinculo.tecidoNome}`}
                          className="w-14 h-14 rounded-md border border-gray-200 object-cover"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-md border border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                          <span className="text-xs text-gray-400">Sem preview</span>
                        </div>
                      )}
                      
                      {/* Info do tecido */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {vinculo.tecidoNome}
                        </div>
                        {vinculo.tecidoSku && (
                          <div className="text-xs text-gray-500">
                            SKU: {vinculo.tecidoSku}
                          </div>
                        )}
                      </div>
                      
                      {/* Ação */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleNavigateToVinculo(vinculo)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
