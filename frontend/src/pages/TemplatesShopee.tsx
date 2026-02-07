import { useState } from 'react';
import { Header } from '@/components/Layout/Header';
import { BreadcrumbNav } from '@/components/Layout/BreadcrumbNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useShopeeTemplates } from '@/hooks/useShopeeTemplates';
import { ShopeeProductTemplate } from '@/types/shopee-product.types';
import { 
  Plus, 
  Loader2, 
  Edit, 
  Trash2, 
  FileText,
  Copy,
} from 'lucide-react';

interface TemplatesShopeeProps {
  onNavigateHome?: () => void;
  onNavigateBack?: () => void;
}

interface TemplateFormData {
  nome: string;
  descricao: string;
  preco_base: string;
  estoque_padrao: string;
  peso: string;
  comprimento: string;
  largura: string;
  altura: string;
  descricao_template: string;
  usar_imagens_publicas: boolean;
  incluir_tamanhos: boolean;
}

const initialFormData: TemplateFormData = {
  nome: '',
  descricao: '',
  preco_base: '',
  estoque_padrao: '',
  peso: '',
  comprimento: '',
  largura: '',
  altura: '',
  descricao_template: '',
  usar_imagens_publicas: true,
  incluir_tamanhos: false,
};

export function TemplatesShopee({ onNavigateHome, onNavigateBack }: TemplatesShopeeProps) {
  const { 
    templates, 
    loading, 
    saving, 
    createTemplate, 
    updateTemplate, 
    deleteTemplate,
  } = useShopeeTemplates();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ShopeeProductTemplate | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>(initialFormData);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleOpenModal = (template?: ShopeeProductTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        nome: template.nome,
        descricao: template.descricao || '',
        preco_base: template.preco_base?.toString() || '',
        estoque_padrao: template.estoque_padrao?.toString() || '',
        peso: template.peso?.toString() || '',
        comprimento: template.dimensoes?.comprimento?.toString() || '',
        largura: template.dimensoes?.largura?.toString() || '',
        altura: template.dimensoes?.altura?.toString() || '',
        descricao_template: template.descricao_template || '',
        usar_imagens_publicas: template.usar_imagens_publicas ?? true,
        incluir_tamanhos: template.incluir_tamanhos ?? false,
      });
    } else {
      setEditingTemplate(null);
      setFormData(initialFormData);
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingTemplate(null);
    setFormData(initialFormData);
  };

  const handleSubmit = async () => {
    if (!formData.nome.trim()) return;

    const data: Record<string, unknown> = {
      nome: formData.nome.trim(),
      descricao: formData.descricao.trim() || undefined,
      usar_imagens_publicas: formData.usar_imagens_publicas,
      incluir_tamanhos: formData.incluir_tamanhos,
    };

    if (formData.preco_base) {
      data.preco_base = parseFloat(formData.preco_base);
    }
    if (formData.estoque_padrao) {
      data.estoque_padrao = parseInt(formData.estoque_padrao, 10);
    }
    if (formData.peso) {
      data.peso = parseFloat(formData.peso);
    }
    if (formData.comprimento || formData.altura) {
      data.dimensoes = {
        comprimento: parseInt(formData.comprimento, 10) || 100,
        largura: formData.largura ? parseInt(formData.largura, 10) : undefined,
        altura: parseInt(formData.altura, 10) || 1,
      };
    }
    if (formData.descricao_template) {
      data.descricao_template = formData.descricao_template;
    }

    if (editingTemplate) {
      await updateTemplate(editingTemplate.id, data);
    } else {
      await createTemplate(data as any);
    }
    
    handleCloseModal();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este template?')) {
      return;
    }

    setDeleting(id);
    await deleteTemplate(id);
    setDeleting(null);
  };

  const handleDuplicate = async (template: ShopeeProductTemplate) => {
    await createTemplate({
      nome: `${template.nome} (cópia)`,
      descricao: template.descricao,
      categoria_id: template.categoria_id,
      categoria_nome: template.categoria_nome,
      preco_base: template.preco_base,
      estoque_padrao: template.estoque_padrao,
      peso: template.peso,
      dimensoes: template.dimensoes,
      descricao_template: template.descricao_template,
      usar_imagens_publicas: template.usar_imagens_publicas,
      incluir_tamanhos: template.incluir_tamanhos,
      tamanhos_padrao: template.tamanhos_padrao,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onNavigateHome={onNavigateHome} />
      
      <BreadcrumbNav
        items={[
          { label: 'Home', onClick: onNavigateHome },
          { label: 'Anúncios Shopee', onClick: onNavigateBack },
          { label: 'Templates' }
        ]}
      />

      <main className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          {/* Cabeçalho */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Templates de Anúncio</h2>
              <p className="text-sm text-gray-500 mt-1">
                Salve configurações como templates reutilizáveis
              </p>
            </div>
            <Button onClick={() => handleOpenModal()}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Template
            </Button>
          </div>

          {/* Lista de Templates */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum template criado
              </h3>
              <p className="text-gray-500 mb-4">
                Crie templates para agilizar a criação de novos anúncios
              </p>
              <Button onClick={() => handleOpenModal()}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeiro Template
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map(template => (
                <div
                  key={template.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-gray-900">{template.nome}</h3>
                    <span className="text-xs text-gray-500">
                      {template.uso_count} uso{template.uso_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  
                  {template.descricao && (
                    <p className="text-sm text-gray-500 mb-3">{template.descricao}</p>
                  )}
                  
                  <div className="space-y-1 text-sm text-gray-600 mb-4">
                    {template.preco_base && (
                      <p>Preço: R$ {template.preco_base.toFixed(2)}</p>
                    )}
                    {template.estoque_padrao && (
                      <p>Estoque: {template.estoque_padrao}</p>
                    )}
                    {template.peso && (
                      <p>Peso: {template.peso}kg</p>
                    )}
                    {template.categoria_nome && (
                      <p>Categoria: {template.categoria_nome}</p>
                    )}
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDuplicate(template)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenModal(template)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(template.id)}
                      disabled={deleting === template.id}
                    >
                      {deleting === template.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4 text-red-500" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal de Criação/Edição */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Editar Template' : 'Novo Template'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div>
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: Tecido Algodão Padrão"
              />
            </div>

            <div>
              <Label htmlFor="descricao">Descrição</Label>
              <Input
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Descrição do template"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="preco_base">Preço Base (R$)</Label>
                <Input
                  id="preco_base"
                  type="number"
                  step="0.01"
                  value={formData.preco_base}
                  onChange={(e) => setFormData(prev => ({ ...prev, preco_base: e.target.value }))}
                  placeholder="29.90"
                />
              </div>
              <div>
                <Label htmlFor="estoque_padrao">Estoque Padrão</Label>
                <Input
                  id="estoque_padrao"
                  type="number"
                  value={formData.estoque_padrao}
                  onChange={(e) => setFormData(prev => ({ ...prev, estoque_padrao: e.target.value }))}
                  placeholder="100"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="peso">Peso (kg)</Label>
              <Input
                id="peso"
                type="number"
                step="0.01"
                value={formData.peso}
                onChange={(e) => setFormData(prev => ({ ...prev, peso: e.target.value }))}
                placeholder="0.1"
              />
            </div>

            <div>
              <Label>Dimensões (cm)</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <Input
                  type="number"
                  value={formData.comprimento}
                  onChange={(e) => setFormData(prev => ({ ...prev, comprimento: e.target.value }))}
                  placeholder="Comp."
                />
                <Input
                  type="number"
                  value={formData.largura}
                  onChange={(e) => setFormData(prev => ({ ...prev, largura: e.target.value }))}
                  placeholder="Larg."
                />
                <Input
                  type="number"
                  value={formData.altura}
                  onChange={(e) => setFormData(prev => ({ ...prev, altura: e.target.value }))}
                  placeholder="Alt."
                />
              </div>
            </div>

            <div>
              <Label htmlFor="descricao_template">Template de Descrição</Label>
              <Textarea
                id="descricao_template"
                value={formData.descricao_template}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao_template: e.target.value }))}
                placeholder="Descrição padrão para os anúncios"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="usar_imagens_publicas"
                  checked={formData.usar_imagens_publicas}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, usar_imagens_publicas: checked as boolean }))}
                />
                <label htmlFor="usar_imagens_publicas" className="text-sm">
                  Usar URLs públicas para imagens
                </label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="incluir_tamanhos"
                  checked={formData.incluir_tamanhos}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, incluir_tamanhos: checked as boolean }))}
                />
                <label htmlFor="incluir_tamanhos" className="text-sm">
                  Incluir variações de tamanho
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={saving || !formData.nome.trim()}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {editingTemplate ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
