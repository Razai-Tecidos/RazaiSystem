import { Input } from '@/components/ui/input';
import { FieldHint } from './FieldHint';
import { FileText, Info } from 'lucide-react';

interface FiscalInfoProps {
  ncm: string;
  onNcmChange: (value: string) => void;
  tecidoNome?: string;
  corExemplo?: string;
  tamanhoExemplo?: string;
}

/**
 * Componente de informações fiscais para anúncio Shopee.
 * - NCM: campo editável que salva como padrão nas preferências do usuário
 * - GTIN: fixo em "00" (tecido sem código de barras)
 * - item_name_in_invoice: auto-gerado a partir dos dados do produto
 */
export function FiscalInfo({
  ncm,
  onNcmChange,
  tecidoNome,
  corExemplo,
  tamanhoExemplo,
}: FiscalInfoProps) {
  const invoiceNamePreview = `Tecido ${tecidoNome || '...'} ${corExemplo || ''} ${tamanhoExemplo || ''}`.trim();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="w-5 h-5 text-orange-500" />
        <h3 className="text-lg font-medium text-gray-800">Informações Fiscais</h3>
      </div>

      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <div className="flex items-start gap-2 mb-3">
          <Info className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-orange-800">
            Essas informações são enviadas automaticamente para a Shopee junto com cada variação do produto.
            O NCM será salvo como padrão para próximos anúncios.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {/* NCM */}
          <FieldHint
            label="NCM"
            required
            hint="Nomenclatura Comum do Mercosul. Para tecidos de composição mista (ex: poliéster), use 58013600. Será salvo como padrão."
            description="Código fiscal do produto. Usado na nota fiscal da Shopee."
          >
            <Input
              value={ncm}
              onChange={(e) => onNcmChange(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="Ex: 58013600"
              maxLength={8}
              className="font-mono"
            />
          </FieldHint>

          {/* GTIN */}
          <FieldHint
            label="GTIN (Código de Barras)"
            hint="Código EAN/GTIN do produto. Para tecidos sem código de barras, utilizamos '00' como padrão aceito pela Shopee."
          >
            <div className="flex items-center gap-2 h-10 px-3 bg-gray-100 border border-gray-200 rounded-md">
              <span className="font-mono text-gray-600">00</span>
              <span className="text-xs text-gray-400">— fixo (tecido sem código de barras)</span>
            </div>
          </FieldHint>
        </div>

        {/* Nome na Nota Fiscal */}
        <div className="mt-4">
          <FieldHint
            label="Nome na Nota Fiscal"
            hint="Gerado automaticamente para cada variação: 'Tecido [nome] [cor] [tamanho]'. Máximo 120 caracteres."
            description="Cada variação terá um nome diferente baseado na cor e tamanho."
          >
            <div className="flex items-center gap-2 h-10 px-3 bg-gray-100 border border-gray-200 rounded-md">
              <span className="text-sm text-gray-600 truncate">{invoiceNamePreview}</span>
              <span className="text-xs text-gray-400 flex-shrink-0">— auto-gerado</span>
            </div>
          </FieldHint>
        </div>
      </div>
    </div>
  );
}
