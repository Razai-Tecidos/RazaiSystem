import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ParsedCost {
  item_sku: string;
  custo_unitario: number;
  margem_minima?: number;
  margem_target?: number;
}

interface SkuCostImportProps {
  onImport: (costs: ParsedCost[]) => Promise<{ success: number; errors: Array<{ sku: string; error: string }> }>;
  onClose: () => void;
  loading?: boolean;
}

export function SkuCostImport({ onImport, onClose, loading = false }: SkuCostImportProps) {
  const [rawText, setRawText] = useState('');
  const [parsedCosts, setParsedCosts] = useState<ParsedCost[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<{
    success: number;
    errors: Array<{ sku: string; error: string }>;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Faz parse do texto colado/importado
  const parseText = (text: string) => {
    const lines = text.trim().split('\n');
    const costs: ParsedCost[] = [];
    const errors: string[] = [];

    lines.forEach((line, index) => {
      if (!line.trim()) return;

      // Tenta separar por tab, ponto-e-vírgula ou vírgula
      let parts = line.split('\t');
      if (parts.length < 2) parts = line.split(';');
      if (parts.length < 2) parts = line.split(',');

      if (parts.length < 2) {
        errors.push(`Linha ${index + 1}: formato inválido`);
        return;
      }

      const sku = parts[0].trim();
      const custoStr = parts[1].trim().replace(',', '.');
      const custo = parseFloat(custoStr);

      if (!sku) {
        errors.push(`Linha ${index + 1}: SKU vazio`);
        return;
      }

      if (isNaN(custo) || custo <= 0) {
        errors.push(`Linha ${index + 1}: custo inválido "${parts[1]}"`);
        return;
      }

      const cost: ParsedCost = {
        item_sku: sku,
        custo_unitario: custo,
      };

      // Margem mínima (opcional, coluna 3)
      if (parts[2]) {
        const margemMin = parseFloat(parts[2].trim().replace(',', '.').replace('%', ''));
        if (!isNaN(margemMin) && margemMin > 0) {
          cost.margem_minima = margemMin;
        }
      }

      // Margem target (opcional, coluna 4)
      if (parts[3]) {
        const margemTarget = parseFloat(parts[3].trim().replace(',', '.').replace('%', ''));
        if (!isNaN(margemTarget) && margemTarget > 0) {
          cost.margem_target = margemTarget;
        }
      }

      costs.push(cost);
    });

    setParsedCosts(costs);
    setParseErrors(errors);
  };

  // Quando o texto muda
  const handleTextChange = (text: string) => {
    setRawText(text);
    setImportResult(null);
    if (text.trim()) {
      parseText(text);
    } else {
      setParsedCosts([]);
      setParseErrors([]);
    }
  };

  // Upload de arquivo
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleTextChange(text);
    };
    reader.readAsText(file);
  };

  // Importar
  const handleImport = async () => {
    if (parsedCosts.length === 0) return;

    const result = await onImport(parsedCosts);
    setImportResult(result);

    if (result.errors.length === 0) {
      // Sucesso total - limpa e fecha após delay
      setTimeout(() => {
        onClose();
      }, 1500);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Importar custos</h3>
          <p className="text-sm text-gray-500">
            Cole dados ou faça upload de arquivo CSV/TXT
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Instruções */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
        <p className="font-medium text-blue-800 mb-1">Formato esperado:</p>
        <code className="text-xs text-blue-700 block">
          SKU{'\t'}Custo{'\t'}Margem Min{'\t'}Margem Target
        </code>
        <p className="text-xs text-blue-600 mt-1">
          Separadores aceitos: Tab, ponto-e-vírgula ou vírgula
        </p>
        <p className="text-xs text-blue-600">
          Margens são opcionais (padrão: 15% e 30%)
        </p>
      </div>

      {/* Upload de arquivo */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt,.tsv"
          onChange={handleFileUpload}
          className="hidden"
        />
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="w-full"
        >
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Selecionar arquivo CSV/TXT
        </Button>
      </div>

      {/* Área de texto */}
      <div>
        <Textarea
          value={rawText}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder={`Cole os dados aqui...\n\nExemplo:\nSKU001\t10,50\t15\t30\nSKU002\t25,00\nSKU003\t8,90\t20\t40`}
          rows={8}
          className="font-mono text-sm"
        />
      </div>

      {/* Erros de parse */}
      {parseErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-800 text-sm font-medium mb-1">
            <AlertCircle className="w-4 h-4" />
            Erros encontrados
          </div>
          <ul className="text-xs text-red-700 space-y-0.5 max-h-24 overflow-y-auto">
            {parseErrors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview */}
      {parsedCosts.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-3 py-2 border-b">
            <p className="text-sm font-medium text-gray-700">
              {parsedCosts.length} SKU(s) prontos para importar
            </p>
          </div>
          <div className="max-h-48 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">SKU</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Custo</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Min</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Target</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {parsedCosts.slice(0, 10).map((cost, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{cost.item_sku}</td>
                    <td className="px-3 py-2 text-right">
                      R$ {cost.custo_unitario.toFixed(2).replace('.', ',')}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500">
                      {cost.margem_minima ?? 15}%
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500">
                      {cost.margem_target ?? 30}%
                    </td>
                  </tr>
                ))}
                {parsedCosts.length > 10 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-2 text-center text-gray-500 text-xs">
                      + {parsedCosts.length - 10} outros...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resultado da importação */}
      {importResult && (
        <div
          className={cn(
            'rounded-lg p-3',
            importResult.errors.length === 0
              ? 'bg-green-50 border border-green-200'
              : 'bg-yellow-50 border border-yellow-200'
          )}
        >
          <div className="flex items-center gap-2">
            {importResult.errors.length === 0 ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-600" />
            )}
            <span
              className={cn(
                'font-medium',
                importResult.errors.length === 0 ? 'text-green-800' : 'text-yellow-800'
              )}
            >
              {importResult.success} importados com sucesso
              {importResult.errors.length > 0 && `, ${importResult.errors.length} erros`}
            </span>
          </div>
          {importResult.errors.length > 0 && (
            <ul className="text-xs text-yellow-700 mt-2 space-y-0.5">
              {importResult.errors.slice(0, 5).map((err, i) => (
                <li key={i}>
                  {err.sku}: {err.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Botões */}
      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button
          onClick={handleImport}
          disabled={loading || parsedCosts.length === 0}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Importando...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Importar {parsedCosts.length} SKU(s)
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
