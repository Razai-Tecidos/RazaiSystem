import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2, Type, ImageIcon, GripVertical, MoveUp, MoveDown } from 'lucide-react';
import { ExtendedDescription, ExtendedDescriptionField } from '@/types/shopee-product.types';

interface ExtendedDescriptionEditorProps {
  value: ExtendedDescription | undefined;
  onChange: (value: ExtendedDescription | undefined) => void;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function ExtendedDescriptionEditor({ value, onChange, enabled, onToggle }: ExtendedDescriptionEditorProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const fields = value?.field_list || [];

  const updateFields = (newFields: ExtendedDescriptionField[]) => {
    onChange({ field_list: newFields });
  };

  const addTextField = () => {
    updateFields([...fields, { field_type: 'text', text: '' }]);
  };

  const addImageField = () => {
    updateFields([...fields, { field_type: 'image', image_info: { image_id: '', image_url: '' } }]);
  };

  const removeField = (index: number) => {
    updateFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, updates: Partial<ExtendedDescriptionField>) => {
    updateFields(fields.map((f, i) => i === index ? { ...f, ...updates } : f));
  };

  const moveField = (from: number, to: number) => {
    if (to < 0 || to >= fields.length) return;
    const newFields = [...fields];
    const [moved] = newFields.splice(from, 1);
    newFields.splice(to, 0, moved);
    updateFields(newFields);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-medium">Descricao Estendida</Label>
          <p className="text-xs text-gray-500">Disponivel apenas para vendedores whitelisted pela Shopee</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              onToggle(e.target.checked);
              if (!e.target.checked) {
                onChange(undefined);
              }
            }}
            className="w-4 h-4 rounded"
          />
          <span className="text-sm">Usar descricao estendida</span>
        </label>
      </div>

      {enabled && (
        <div className="space-y-3 border rounded-lg p-4">
          {fields.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              Adicione blocos de texto ou imagem para criar a descricao estendida
            </p>
          )}

          {fields.map((field, index) => (
            <div
              key={index}
              className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg"
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null && dragIndex !== index) {
                  moveField(dragIndex, index);
                }
                setDragIndex(null);
              }}
            >
              <div className="flex flex-col gap-1 pt-1">
                <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => moveField(index, index - 1)}
                  disabled={index === 0}
                >
                  <MoveUp className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => moveField(index, index + 1)}
                  disabled={index === fields.length - 1}
                >
                  <MoveDown className="w-3 h-3" />
                </Button>
              </div>

              <div className="flex-1">
                {field.field_type === 'text' ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Type className="w-3 h-3" />
                      Texto
                    </div>
                    <Textarea
                      value={field.text || ''}
                      onChange={(e) => updateField(index, { text: e.target.value })}
                      placeholder="Digite o texto..."
                      rows={3}
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <ImageIcon className="w-3 h-3" />
                      Imagem
                    </div>
                    <Input
                      value={field.image_info?.image_url || ''}
                      onChange={(e) =>
                        updateField(index, {
                          image_info: { image_id: '', image_url: e.target.value },
                        })
                      }
                      placeholder="URL da imagem..."
                    />
                    {field.image_info?.image_url && (
                      <img
                        src={field.image_info.image_url}
                        alt="Preview"
                        className="w-24 h-24 object-cover rounded mt-1"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    )}
                  </div>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeField(index)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addTextField}>
              <Type className="w-4 h-4 mr-1" />
              Adicionar Texto
            </Button>
            <Button variant="outline" size="sm" onClick={addImageField}>
              <ImageIcon className="w-4 h-4 mr-1" />
              Adicionar Imagem
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
