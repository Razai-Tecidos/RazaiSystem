import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Trash2,
  Pencil,
  Save,
  X,
  Zap,
  ZapOff,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Minus,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PricingRule } from '@/types/shopee-pricing.types';
import {
  getPricingRules,
  createPricingRule,
  updatePricingRule,
  deletePricingRule,
} from '@/lib/firebase/shopee-pricing';
import { useToast } from '@/hooks/use-toast';

interface PricingRulesConfigProps {
  shopId: number;
}

type DemandaOption = 'alta' | 'baixa' | 'qualquer';
type ConversaoOption = 'alta' | 'baixa' | 'qualquer';
type AcaoTipo = 'aumentar' | 'diminuir' | 'manter';
type LimiteOption = 'margem_minima' | 'margem_target' | 'preco_minimo' | 'preco_maximo';

interface RuleFormData {
  nome: string;
  ativa: boolean;
  demanda: DemandaOption;
  conversao: ConversaoOption;
  margem_abaixo_minima: boolean;
  acao_tipo: AcaoTipo;
  acao_percentual: string;
  acao_limite: LimiteOption;
  prioridade: string;
}

const defaultFormData: RuleFormData = {
  nome: '',
  ativa: true,
  demanda: 'qualquer',
  conversao: 'qualquer',
  margem_abaixo_minima: false,
  acao_tipo: 'manter',
  acao_percentual: '5',
  acao_limite: 'margem_minima',
  prioridade: '10',
};

export function PricingRulesConfig({ shopId }: PricingRulesConfigProps) {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<RuleFormData>(defaultFormData);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const { toast } = useToast();

  // Carregar regras
  const loadRules = async () => {
    try {
      setLoading(true);
      const data = await getPricingRules(shopId);
      setRules(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar regras';
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (shopId) {
      loadRules();
    }
  }, [shopId]);

  // Abrir formulário para edição
  const handleEdit = (rule: PricingRule) => {
    setFormData({
      nome: rule.nome,
      ativa: rule.ativa,
      demanda: rule.condicoes.demanda || 'qualquer',
      conversao: rule.condicoes.conversao || 'qualquer',
      margem_abaixo_minima: rule.condicoes.margem_abaixo_minima || false,
      acao_tipo: rule.acao.tipo,
      acao_percentual: rule.acao.percentual?.toString() || '5',
      acao_limite: rule.acao.limite || 'margem_minima',
      prioridade: rule.prioridade.toString(),
    });
    setEditingRule(rule.id);
    setShowForm(true);
  };

  // Abrir formulário para nova regra
  const handleAdd = () => {
    setFormData(defaultFormData);
    setEditingRule(null);
    setShowForm(true);
  };

  // Cancelar formulário
  const handleCancel = () => {
    setFormData(defaultFormData);
    setEditingRule(null);
    setShowForm(false);
  };

  // Salvar regra
  const handleSave = async () => {
    if (!formData.nome.trim()) {
      toast({
        title: 'Erro',
        description: 'Nome da regra é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);

      const ruleData = {
        shop_id: shopId,
        nome: formData.nome.trim(),
        ativa: formData.ativa,
        condicoes: {
          demanda: formData.demanda,
          conversao: formData.conversao,
          margem_abaixo_minima: formData.margem_abaixo_minima,
        },
        acao: {
          tipo: formData.acao_tipo,
          percentual: formData.acao_tipo !== 'manter' ? parseFloat(formData.acao_percentual) : undefined,
          limite: formData.acao_limite,
        },
        prioridade: parseInt(formData.prioridade, 10) || 10,
      };

      if (editingRule) {
        await updatePricingRule(editingRule, ruleData);
        toast({ title: 'Sucesso', description: 'Regra atualizada' });
      } else {
        await createPricingRule(ruleData);
        toast({ title: 'Sucesso', description: 'Regra criada' });
      }

      handleCancel();
      await loadRules();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao salvar regra';
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Excluir regra
  const handleDelete = async (ruleId: string) => {
    try {
      setLoading(true);
      await deletePricingRule(ruleId);
      toast({ title: 'Sucesso', description: 'Regra excluída' });
      setConfirmDelete(null);
      await loadRules();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao excluir regra';
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Toggle ativa/inativa
  const handleToggleActive = async (rule: PricingRule) => {
    try {
      await updatePricingRule(rule.id, { ativa: !rule.ativa });
      await loadRules();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar regra';
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  // Descrição da regra em texto
  const getRuleDescription = (rule: PricingRule): string => {
    const conditions: string[] = [];
    
    if (rule.condicoes.demanda && rule.condicoes.demanda !== 'qualquer') {
      conditions.push(`demanda ${rule.condicoes.demanda}`);
    }
    if (rule.condicoes.conversao && rule.condicoes.conversao !== 'qualquer') {
      conditions.push(`conversão ${rule.condicoes.conversao}`);
    }
    if (rule.condicoes.margem_abaixo_minima) {
      conditions.push('margem < mínima');
    }

    const condText = conditions.length > 0 
      ? `Se ${conditions.join(' E ')}` 
      : 'Sempre';

    let actionText = '';
    if (rule.acao.tipo === 'aumentar') {
      actionText = `aumentar +${rule.acao.percentual}%`;
    } else if (rule.acao.tipo === 'diminuir') {
      actionText = `diminuir -${rule.acao.percentual}%`;
    } else {
      actionText = 'manter preço';
    }

    return `${condText} → ${actionText}`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Regras de Automação</h3>
          <p className="text-sm text-gray-500">
            Configure regras para ajuste automático de preços
          </p>
        </div>
        {!showForm && (
          <Button size="sm" onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-1" />
            Nova Regra
          </Button>
        )}
      </div>

      {/* Aviso */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800">Automação requer aprovação</p>
            <p className="text-yellow-700 text-xs mt-0.5">
              As regras geram sugestões que precisam ser aprovadas manualmente antes de aplicar.
            </p>
          </div>
        </div>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="bg-gray-50 border rounded-lg p-4 space-y-4">
          <div>
            <Label>Nome da regra *</Label>
            <Input
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Aumentar preço em alta demanda"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Condição: Demanda</Label>
              <select
                value={formData.demanda}
                onChange={(e) => setFormData({ ...formData, demanda: e.target.value as DemandaOption })}
                className="mt-1 w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm"
              >
                <option value="qualquer">Qualquer</option>
                <option value="alta">Alta (vendas acima da média)</option>
                <option value="baixa">Baixa (vendas abaixo da média)</option>
              </select>
            </div>
            <div>
              <Label>Condição: Conversão</Label>
              <select
                value={formData.conversao}
                onChange={(e) => setFormData({ ...formData, conversao: e.target.value as ConversaoOption })}
                className="mt-1 w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm"
              >
                <option value="qualquer">Qualquer</option>
                <option value="alta">Alta (acima da média)</option>
                <option value="baixa">Baixa (abaixo da média)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="margem_abaixo"
              checked={formData.margem_abaixo_minima}
              onChange={(e) => setFormData({ ...formData, margem_abaixo_minima: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="margem_abaixo" className="text-sm font-normal cursor-pointer">
              Apenas quando margem estiver abaixo do mínimo
            </Label>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Ação</Label>
              <select
                value={formData.acao_tipo}
                onChange={(e) => setFormData({ ...formData, acao_tipo: e.target.value as AcaoTipo })}
                className="mt-1 w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm"
              >
                <option value="aumentar">Aumentar preço</option>
                <option value="diminuir">Diminuir preço</option>
                <option value="manter">Manter preço</option>
              </select>
            </div>
            {formData.acao_tipo !== 'manter' && (
              <>
                <div>
                  <Label>Percentual (%)</Label>
                  <Input
                    type="number"
                    value={formData.acao_percentual}
                    onChange={(e) => setFormData({ ...formData, acao_percentual: e.target.value })}
                    min="1"
                    max="50"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Limite</Label>
                  <select
                    value={formData.acao_limite}
                    onChange={(e) => setFormData({ ...formData, acao_limite: e.target.value as LimiteOption })}
                    className="mt-1 w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm"
                  >
                    <option value="margem_minima">Até margem mínima</option>
                    <option value="margem_target">Até margem target</option>
                    <option value="preco_minimo">Até preço mínimo</option>
                    <option value="preco_maximo">Até preço máximo</option>
                  </select>
                </div>
              </>
            )}
          </div>

          <div className="w-32">
            <Label>Prioridade</Label>
            <Input
              type="number"
              value={formData.prioridade}
              onChange={(e) => setFormData({ ...formData, prioridade: e.target.value })}
              min="1"
              max="100"
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">Menor = executa primeiro</p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ativa"
              checked={formData.ativa}
              onChange={(e) => setFormData({ ...formData, ativa: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="ativa" className="text-sm font-normal cursor-pointer">
              Regra ativa
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={handleCancel} disabled={loading}>
              <X className="w-4 h-4 mr-1" />
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              Salvar
            </Button>
          </div>
        </div>
      )}

      {/* Lista de regras */}
      {loading && rules.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Zap className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p>Nenhuma regra configurada</p>
          <p className="text-sm">Crie regras para automatizar ajustes de preço</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={cn(
                'border rounded-lg p-3 transition-colors',
                rule.ativa ? 'bg-white' : 'bg-gray-50 opacity-60'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Toggle */}
                  <button
                    onClick={() => handleToggleActive(rule)}
                    className={cn(
                      'p-1.5 rounded-md transition-colors',
                      rule.ativa
                        ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    )}
                    title={rule.ativa ? 'Desativar regra' : 'Ativar regra'}
                  >
                    {rule.ativa ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
                  </button>

                  {/* Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{rule.nome}</span>
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                        P{rule.prioridade}
                      </span>
                      {rule.acao.tipo === 'aumentar' && (
                        <ArrowUp className="w-4 h-4 text-green-500" />
                      )}
                      {rule.acao.tipo === 'diminuir' && (
                        <ArrowDown className="w-4 h-4 text-red-500" />
                      )}
                      {rule.acao.tipo === 'manter' && (
                        <Minus className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {getRuleDescription(rule)}
                    </p>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-1">
                  {confirmDelete === rule.id ? (
                    <>
                      <span className="text-xs text-red-600 mr-2">Confirmar?</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() => setConfirmDelete(null)}
                      >
                        Não
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7"
                        onClick={() => handleDelete(rule.id)}
                      >
                        Sim
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => handleEdit(rule)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                        onClick={() => setConfirmDelete(rule.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
