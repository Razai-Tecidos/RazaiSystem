import { useEffect, useMemo, useState } from 'react';
import { useShopee } from '@/hooks/useShopee';
import { Header } from '@/components/Layout/Header';
import { BreadcrumbNav } from '@/components/Layout/BreadcrumbNav';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Loader2, 
  Link2, 
  Link2Off, 
  CheckCircle2, 
  RefreshCw,
  ShoppingBag,
  ChevronDown,
  ChevronRight,
  Package,
  ClipboardList,
  ArrowLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { auth } from '@/config/firebase';
import { useToast } from '@/hooks/use-toast';

interface ShopeeProps {
  onNavigateHome?: () => void;
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

interface InventoryModel {
  model_id?: number | string;
  model_name: string;
  total_available_stock: number | null;
  color_option: string | null;
}

interface InventoryItem {
  item_id: string;
  item_status: string;
  item_name: string;
  item_sku: string;
  variation_options: string[];
  models: InventoryModel[];
}

interface SkuGroup {
  item_sku: string;
  item_ids: string[];
  items: InventoryItem[];
}

function isObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getPreview(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.length}]`;
  if (isObject(value)) return `{${Object.keys(value).length}}`;
  if (typeof value === 'string') return `"${value}"`;
  return String(value);
}

function JsonNode({
  name,
  value,
  path,
  expandedPaths,
  togglePath,
}: {
  name?: string;
  value: JsonValue;
  path: string;
  expandedPaths: Set<string>;
  togglePath: (path: string) => void;
}) {
  const isExpandable = Array.isArray(value) || isObject(value);
  const isExpanded = expandedPaths.has(path);
  const entries = useMemo(() => {
    if (Array.isArray(value)) {
      return value.map((item, index) => [String(index), item] as const);
    }
    if (isObject(value)) {
      return Object.entries(value);
    }
    return [];
  }, [value]);

  return (
    <div className="pl-2">
      <div className="flex items-center gap-2">
        {isExpandable ? (
          <button
            type="button"
            onClick={() => togglePath(path)}
            className="flex items-center text-xs text-gray-500 hover:text-gray-700"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        ) : (
          <span className="w-3.5 h-3.5" />
        )}
        {name !== undefined && (
          <span className="text-xs font-medium text-gray-600">{name}:</span>
        )}
        <span className="text-xs text-gray-800">{isExpandable ? getPreview(value) : String(value)}</span>
      </div>
      {isExpandable && isExpanded && (
        <div className="mt-1 space-y-1 border-l border-gray-200 pl-3">
          {entries.map(([key, child]) => (
            <JsonNode
              key={`${path}.${key}`}
              name={key}
              value={child}
              path={`${path}.${key}`}
              expandedPaths={expandedPaths}
              togglePath={togglePath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Componente de estado vazio / não conectado
function EmptyState({ onConnect, connecting }: { onConnect: () => void; connecting: boolean }) {
  return (
    <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-8 sm:p-12 text-center">
      <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center">
        <ShoppingBag className="w-10 h-10 text-orange-500" />
      </div>
      
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        Conecte sua loja Shopee
      </h3>
      <p className="text-gray-500 mb-6 max-w-md mx-auto">
        Integre sua loja Shopee para sincronizar produtos, gerenciar estoque e muito mais.
      </p>

      <Button
        onClick={onConnect}
        disabled={connecting}
        size="lg"
        className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/25"
      >
        {connecting ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Conectando...
          </>
        ) : (
          <>
            <Link2 className="w-5 h-5 mr-2" />
            Conectar com Shopee
          </>
        )}
      </Button>

      <p className="text-xs text-gray-400 mt-4">
        Uma janela será aberta para autorizar o acesso na Shopee
      </p>
    </div>
  );
}

type ShopeeSubPage = 'menu' | 'estoque' | 'pedidos';

interface SubPageCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  color: 'orange' | 'blue' | 'green' | 'purple';
  disabled?: boolean;
  badge?: string;
}

function SubPageCard({ title, description, icon, onClick, color, disabled, badge }: SubPageCardProps) {
  const colorClasses = {
    orange: 'from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700',
    blue: 'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
    green: 'from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700',
    purple: 'from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group w-full text-left p-5 rounded-xl bg-gradient-to-br text-white shadow-lg',
        'transition-all duration-300 ease-out',
        'hover:shadow-xl hover:-translate-y-1 hover:scale-[1.02]',
        'active:scale-[0.98] active:shadow-md',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-50',
        colorClasses[color],
        disabled && 'opacity-50 cursor-not-allowed hover:translate-y-0 hover:scale-100'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110">
            {icon}
          </div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-bold">{title}</h3>
            {badge && (
              <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">{badge}</span>
            )}
          </div>
          <p className="text-sm text-white/80">{description}</p>
        </div>
        <ChevronRight className="h-5 w-5 text-white/60 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-white" />
      </div>
    </button>
  );
}

export function Shopee({ onNavigateHome }: ShopeeProps) {
  const { 
    shops, 
    loading, 
    connecting, 
    connected,
    connect, 
    disconnect, 
    handleCallback,
    checkForCallback,
    refresh 
  } = useShopee();
  const { toast } = useToast();

  const [subPage, setSubPage] = useState<ShopeeSubPage>('menu');
  const [processingCallback, setProcessingCallback] = useState(false);
  const [endpointInput, setEndpointInput] = useState('/api/shopee/status');
  const [methodInput, setMethodInput] = useState<'GET' | 'POST'>('GET');
  const [shopIdInput, setShopIdInput] = useState<string>('');
  const [queryInput, setQueryInput] = useState<string>('');
  const [bodyInput, setBodyInput] = useState<string>('');
  const [jsonLoading, setJsonLoading] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonData, setJsonData] = useState<JsonValue | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['$']));
  const [modelLists, setModelLists] = useState<Array<{ itemId: string; data?: JsonValue; error?: string }>>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [updatingColors, setUpdatingColors] = useState<Set<string>>(new Set());
  const [expandedSkus, setExpandedSkus] = useState<Set<string>>(new Set());

  const apiBase = import.meta.env.VITE_API_URL || window.location.origin;

  useEffect(() => {
    if (!shopIdInput && shops.length > 0) {
      setShopIdInput(String(shops[0].shopId));
    }
  }, [shops, shopIdInput]);


  // Verifica se está retornando do callback da Shopee
  useEffect(() => {
    const callbackParams = checkForCallback();
    
    if (callbackParams && !processingCallback) {
      setProcessingCallback(true);
      
      handleCallback(callbackParams).then(() => {
        // Limpa a URL completamente após processar (remove query params e path /shopee)
        window.history.replaceState({}, '', '/');
        setProcessingCallback(false);
      });
    }
  }, [checkForCallback, handleCallback, processingCallback]);

  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [pendingDisconnectId, setPendingDisconnectId] = useState<number | null>(null);

  const handleDisconnect = (shopId: number) => {
    setPendingDisconnectId(shopId);
    setConfirmDisconnect(true);
  };

  const doDisconnect = async () => {
    if (pendingDisconnectId === null) return;
    setConfirmDisconnect(false);
    await disconnect(pendingDisconnectId);
    setPendingDisconnectId(null);
  };

  const isProcessing = loading || connecting || processingCallback;

  const itemListFromJson = useMemo(() => {
    const data = jsonData as any;
    const list = data?.data?.response?.item_list;
    return Array.isArray(list) ? list : [];
  }, [jsonData]);

  const handleTogglePath = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleFetchJson = async () => {
    try {
      setJsonLoading(true);
      setJsonError(null);
      setJsonData(null);

      const user = auth.currentUser;
      if (!user) {
        toast({
          title: 'Erro',
          description: 'Usuário não autenticado.',
          variant: 'destructive',
        });
        return;
      }

      const token = await user.getIdToken();
      const trimmed = endpointInput.trim();
      if (!trimmed) {
        setJsonError('Informe um endpoint válido.');
        return;
      }

      const isShopeeEndpoint = trimmed.startsWith('/api/v2/')
        || trimmed.includes('partner.shopeemobile.com/api/v2/')
        || trimmed.includes('partner.test-stable.shopeemobile.com/api/v2/');

      const parseJsonInput = (value: string): Record<string, unknown> | undefined => {
        if (!value.trim()) return undefined;
        return JSON.parse(value) as Record<string, unknown>;
      };

      let url = trimmed.startsWith('http')
        ? trimmed
        : `${apiBase}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;

      let response: Response;
      if (isShopeeEndpoint) {
        if (!shopIdInput.trim()) {
          setJsonError('Informe o shop_id para chamadas Shopee.');
          return;
        }

        let queryJson: Record<string, unknown> | undefined;
        let bodyJson: Record<string, unknown> | undefined;
        try {
          queryJson = parseJsonInput(queryInput);
          bodyJson = parseJsonInput(bodyInput);
        } catch (error: any) {
          setJsonError('JSON inválido em Query ou Body.');
          return;
        }

        response = await fetch(`${apiBase}/api/shopee/proxy`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path: trimmed,
            method: methodInput,
            shop_id: shopIdInput,
            query: queryJson,
            body: bodyJson,
          }),
        });
      } else {
        response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }

      const text = await response.text();
      try {
        const parsed = JSON.parse(text) as JsonValue;
        setJsonData(parsed);
        setExpandedPaths(new Set(['$']));
      } catch (error) {
        setJsonError(`Resposta não é JSON: ${text.slice(0, 300)}`);
      }

      if (!response.ok) {
        setJsonError(prev => prev || `Erro ${response.status} ao buscar endpoint.`);
      }
    } catch (error: any) {
      setJsonError(error?.message || 'Erro ao buscar endpoint.');
    } finally {
      setJsonLoading(false);
    }
  };

  const handleLoadInventory = async () => {
    try {
      setInventoryLoading(true);
      setInventoryError(null);

      const user = auth.currentUser;
      if (!user) {
        setInventoryError('Usuário não autenticado.');
        return;
      }

      if (!shopIdInput.trim()) {
        setInventoryError('shop_id não definido.');
        return;
      }

      const token = await user.getIdToken();
      const response = await fetch(`${apiBase}/api/shopee/inventory`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shop_id: shopIdInput,
          page_size: 50,
          offset: 0,
        }),
      });

      const data = await response.json();
      
      // Log detalhado do inventário carregado
      console.log('[Inventory] Resposta completa:', {
        success: data?.success,
        itemsCount: data?.data?.items?.length,
        sampleItem: data?.data?.items?.[0] ? {
          item_id: data.data.items[0].item_id,
          item_sku: data.data.items[0].item_sku,
          models: data.data.items[0].models?.map((m: any) => ({
            model_id: m.model_id,
            model_status: m.model_status,
            color_option: m.color_option,
          })),
        } : null,
      });
      
      if (!response.ok || !data?.success) {
        setInventoryError(data?.error || 'Erro ao carregar inventário.');
        return;
      }

      setInventoryItems(data?.data?.items || []);
    } catch (error: any) {
      setInventoryError(error?.message || 'Erro ao carregar inventário.');
    } finally {
      setInventoryLoading(false);
    }
  };

  const skuGroups = useMemo<SkuGroup[]>(() => {
    const map = new Map<string, InventoryItem[]>();
    inventoryItems.forEach(item => {
      const key = item.item_sku || 'Sem SKU';
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    });

    return Array.from(map.entries()).map(([item_sku, items]) => ({
      item_sku,
      item_ids: items.map(item => item.item_id),
      items,
    }));
  }, [inventoryItems]);

  const buildColorGroups = (items: InventoryItem[]) => {
    const groups = Object.entries(
      items.flatMap(item => item.models.map(model => ({ item, model }))).reduce<Record<string, Array<{ item: InventoryItem; model: InventoryModel }>>>(
        (acc, pair) => {
          const key = pair.model.color_option || 'Sem cor';
          if (!acc[key]) acc[key] = [];
          acc[key].push(pair);
          return acc;
        },
        {}
      )
    );
    // Ordena alfabeticamente pelo nome da cor
    return groups.sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  };

  const toggleSkuExpanded = (sku: string) => {
    setExpandedSkus(prev => {
      const next = new Set(prev);
      if (next.has(sku)) {
        next.delete(sku);
      } else {
        next.add(sku);
      }
      return next;
    });
  };

  const expandAllSkus = () => {
    setExpandedSkus(new Set(skuGroups.map(g => g.item_sku)));
  };

  const collapseAllSkus = () => {
    setExpandedSkus(new Set());
  };

  // Toggle simplificado: zera estoque (desativar) ou restaura para 500 (ativar)
  const handleToggleColorStatus = async (
    colorOption: string,
    isCurrentlyAvailable: boolean,
    targets: Array<{ item_id: string; model_ids: Array<string | number> }>,
    skuGroup: SkuGroup
  ) => {
    const shouldZeroStock = isCurrentlyAvailable; // Se está disponível, vamos zerar
    const colorKey = `${skuGroup.item_sku}:${colorOption}`;

    console.log('[Toggle] Iniciando:', {
      colorOption,
      acao: shouldZeroStock ? 'ZERAR estoque' : 'RESTAURAR estoque para 500',
      skuGroup: skuGroup.item_sku,
      targets,
    });

    if (!targets.length || targets.every(target => !target.model_ids.length)) {
      toast({
        title: 'Erro',
        description: 'Não foi possível identificar os modelos dessa cor.',
        variant: 'destructive',
      });
      return;
    }

    setUpdatingColors(prev => new Set(prev).add(colorKey));

    // Atualização otimista do estoque na UI
    const newStock = shouldZeroStock ? 0 : 500;
    setInventoryItems(prev =>
      prev.map(item => {
        if (!skuGroup.item_ids.includes(item.item_id)) {
          return item;
        }
        return {
          ...item,
          models: item.models.map(model =>
            model.color_option === colorOption
              ? { ...model, total_available_stock: newStock }
              : model
          ),
        };
      })
    );

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Usuário não autenticado.');
      }

      const token = await user.getIdToken();
      
      const requestBody = {
        shop_id: shopIdInput,
        targets,
        action: shouldZeroStock ? 'zero' : 'restore',
        stock: shouldZeroStock ? 0 : 500,
        item_sku: skuGroup.item_sku,
        color_option: colorOption,
      };
      
      console.log('[Toggle] Enviando para API:', requestBody);
      
      const response = await fetch(`${apiBase}/api/shopee/update-stock`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      console.log('[Toggle] Resposta:', data);
      
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Erro ao atualizar estoque.');
      }

      // Aguarda a Shopee processar
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Recarrega o inventário
      await handleLoadInventory();

      // Monta mensagem baseada no resultado
      const summary = data.data?.summary;
      let description = shouldZeroStock
        ? 'Estoque zerado. O webhook manterá zerado automaticamente.'
        : 'Estoque restaurado para 500 unidades.';
      
      if (data.warning) {
        description += ` (${data.warning})`;
      }

      toast({
        title: summary?.failed > 0 ? 'Parcialmente concluído' : 'Sucesso',
        description,
        variant: summary?.failed > 0 ? 'default' : undefined,
      });
    } catch (error: any) {
      // Reverte o estado otimista
      const revertStock = shouldZeroStock ? 500 : 0; // Reverte para o oposto
      setInventoryItems(prev =>
        prev.map(item => {
          if (!skuGroup.item_ids.includes(item.item_id)) {
            return item;
          }
          return {
            ...item,
            models: item.models.map(model =>
              model.color_option === colorOption
                ? { ...model, total_available_stock: revertStock }
                : model
            ),
          };
        })
      );

      console.error('Erro ao atualizar estoque:', error);
      
      toast({
        title: 'Erro',
        description: error?.message || 'Falha ao atualizar estoque. Tente novamente.',
        variant: 'destructive',
      });
      
      // Recarrega para sincronizar
      try {
        await handleLoadInventory();
      } catch (reloadError) {
        console.error('Erro ao recarregar inventário:', reloadError);
      }
    } finally {
      setUpdatingColors(prev => {
        const next = new Set(prev);
        next.delete(colorKey);
        return next;
      });
    }
  };

  useEffect(() => {
    if (connected && shopIdInput) {
      handleLoadInventory();
    }
  }, [connected, shopIdInput]);

  const chunkArray = <T,>(items: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }
    return chunks;
  };

  const handleFetchItemBaseInfo = async () => {
    try {
      setJsonLoading(true);
      setJsonError(null);
      setJsonData(null);

      const user = auth.currentUser;
      if (!user) {
        toast({
          title: 'Erro',
          description: 'Usuário não autenticado.',
          variant: 'destructive',
        });
        return;
      }

      if (!shopIdInput.trim()) {
        setJsonError('Informe o shop_id para chamadas Shopee.');
        return;
      }

      let queryJson: Record<string, unknown> | undefined;
      try {
        queryJson = queryInput.trim()
          ? (JSON.parse(queryInput) as Record<string, unknown>)
          : { item_status: 'NORMAL', offset: 0, page_size: 20 };
      } catch (error: any) {
        setJsonError('JSON inválido em Query.');
        return;
      }

      const token = await user.getIdToken();
      const listResponse = await fetch(`${apiBase}/api/shopee/proxy`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: '/api/v2/product/get_item_list',
          method: 'GET',
          shop_id: shopIdInput,
          query: queryJson,
        }),
      });

      const listText = await listResponse.text();
      const listParsed = JSON.parse(listText) as any;

      if (!listResponse.ok || !listParsed?.success) {
        setJsonError(listParsed?.error || `Erro ${listResponse.status} ao buscar item_list.`);
        return;
      }

      const listItems = listParsed?.data?.response?.item || listParsed?.data?.response?.item_list || [];
      const itemIds = listItems
        .map((item: any) => item?.item_id)
        .filter((id: any) => typeof id === 'number' || typeof id === 'string')
        .map((id: any) => String(id));

      if (itemIds.length === 0) {
        setJsonError('Nenhum item_id encontrado no retorno do get_item_list.');
        return;
      }

      const chunks = chunkArray(itemIds, 20);
      const collected: any[] = [];

      for (const chunk of chunks) {
        const baseInfoResponse = await fetch(`${apiBase}/api/shopee/proxy`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path: '/api/v2/product/get_item_base_info',
            method: 'GET',
            shop_id: shopIdInput,
            query: {
              item_id_list: chunk.join(','),
            },
          }),
        });

        const baseText = await baseInfoResponse.text();
        const baseParsed = JSON.parse(baseText) as any;

        if (!baseInfoResponse.ok || !baseParsed?.success) {
          setJsonError(baseParsed?.error || `Erro ${baseInfoResponse.status} ao buscar base_info.`);
          return;
        }

        const itemList = baseParsed?.data?.response?.item_list || [];
        collected.push(...itemList);
      }

      setJsonData({
        success: true,
        data: {
          response: {
            item_list: collected,
          },
        },
      });
      setExpandedPaths(new Set(['$']));
    } catch (error: any) {
      setJsonError(error?.message || 'Erro ao buscar base_info.');
    } finally {
      setJsonLoading(false);
    }
  };

  const handleFetchModelLists = async () => {
    try {
      setJsonLoading(true);
      setJsonError(null);
      setModelLists([]);

      const user = auth.currentUser;
      if (!user) {
        toast({
          title: 'Erro',
          description: 'Usuário não autenticado.',
          variant: 'destructive',
        });
        return;
      }

      if (!shopIdInput.trim()) {
        setJsonError('Informe o shop_id para chamadas Shopee.');
        return;
      }

      let queryJson: Record<string, unknown> | undefined;
      try {
        queryJson = queryInput.trim()
          ? (JSON.parse(queryInput) as Record<string, unknown>)
          : { item_status: 'NORMAL', offset: 0, page_size: 20 };
      } catch (error: any) {
        setJsonError('JSON inválido em Query.');
        return;
      }

      const token = await user.getIdToken();
      const listResponse = await fetch(`${apiBase}/api/shopee/proxy`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: '/api/v2/product/get_item_list',
          method: 'GET',
          shop_id: shopIdInput,
          query: queryJson,
        }),
      });

      const listText = await listResponse.text();
      const listParsed = JSON.parse(listText) as any;

      if (!listResponse.ok || !listParsed?.success) {
        setJsonError(listParsed?.error || `Erro ${listResponse.status} ao buscar item_list.`);
        return;
      }

      const listItems = listParsed?.data?.response?.item || listParsed?.data?.response?.item_list || [];
      const itemIds = listItems
        .map((item: any) => item?.item_id)
        .filter((id: any) => typeof id === 'number' || typeof id === 'string')
        .map((id: any) => String(id));

      if (itemIds.length === 0) {
        setJsonError('Nenhum item_id encontrado no retorno do get_item_list.');
        return;
      }

      const results: Array<{ itemId: string; data?: JsonValue; error?: string }> = [];

      for (const itemId of itemIds) {
        const modelResponse = await fetch(`${apiBase}/api/shopee/proxy`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path: '/api/v2/product/get_model_list',
            method: 'GET',
            shop_id: shopIdInput,
            query: {
              item_id: itemId,
            },
          }),
        });

        const modelText = await modelResponse.text();
        try {
          const parsed = JSON.parse(modelText) as JsonValue;
          if (!modelResponse.ok) {
            results.push({
              itemId,
              error: `Erro ${modelResponse.status}`,
              data: parsed,
            });
          } else {
            results.push({ itemId, data: parsed });
          }
        } catch (error) {
          results.push({
            itemId,
            error: 'Resposta não é JSON',
          });
        }
      }

      setModelLists(results);
    } catch (error: any) {
      setJsonError(error?.message || 'Erro ao buscar modelos.');
    } finally {
      setJsonLoading(false);
    }
  };

  const handleBackToMenu = () => {
    setSubPage('menu');
  };

  // Se não está conectado, mostra a tela de conexão
  if (!connected && !isProcessing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-orange-50/30">
        <Header onNavigateHome={onNavigateHome} />
        
        <BreadcrumbNav
          items={[
            { label: 'Home', onClick: onNavigateHome },
            { label: 'Shopee' }
          ]}
        />

        <main className="container mx-auto px-4 py-8">
          <EmptyState onConnect={connect} connecting={connecting} />
        </main>
      </div>
    );
  }

  // Se está carregando
  if (isProcessing && shops.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-orange-50/30">
        <Header onNavigateHome={onNavigateHome} />
        
        <BreadcrumbNav
          items={[
            { label: 'Home', onClick: onNavigateHome },
            { label: 'Shopee' }
          ]}
        />

        <main className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
            <p className="text-gray-500">
              {processingCallback ? 'Processando autorização...' : 'Carregando...'}
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Menu principal com cards
  if (subPage === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-orange-50/30">
        <Header onNavigateHome={onNavigateHome} />
        
        <BreadcrumbNav
          items={[
            { label: 'Home', onClick: onNavigateHome },
            { label: 'Shopee' }
          ]}
        />

        <main className="container mx-auto px-4 py-8">
          {/* Header da página */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Shopee</h1>
              </div>
              <p className="text-gray-500">
                Gerencie sua loja Shopee
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                disabled={isProcessing}
              >
                <RefreshCw className={cn("w-4 h-4 mr-1.5", isProcessing && "animate-spin")} />
                Atualizar
              </Button>
            </div>
          </div>

          {/* Info da loja conectada */}
          <div className="mb-6 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Loja conectada</p>
                <p className="text-sm text-gray-500">Shop ID: {shops[0]?.shopId}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDisconnect(shops[0]?.shopId)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Link2Off className="w-4 h-4 mr-1" />
                Desconectar
              </Button>
            </div>
          </div>

          {/* Cards de funcionalidades */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <SubPageCard
              title="Estoque"
              description="Controle a disponibilidade das cores"
              icon={<Package className="w-5 h-5 text-white" />}
              onClick={() => setSubPage('estoque')}
              color="orange"
            />
            <SubPageCard
              title="Pedidos"
              description="Visualize e gerencie pedidos"
              icon={<ClipboardList className="w-5 h-5 text-white" />}
              onClick={() => {}}
              color="blue"
              disabled
              badge="Em breve"
            />
          </div>
        </main>
      </div>
    );
  }


  // Subpágina de Estoque
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-orange-50/30">
      <Header onNavigateHome={onNavigateHome} />
      
      <BreadcrumbNav
        items={[
          { label: 'Home', onClick: onNavigateHome },
          { label: 'Shopee', onClick: handleBackToMenu },
          { label: 'Estoque' }
        ]}
      />

      <main className="container mx-auto px-4 py-8">
        {/* Header da página */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <button
              onClick={handleBackToMenu}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </button>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Controle de Estoque</h1>
            </div>
            <p className="text-gray-500">
              Ative ou desative cores para controlar a disponibilidade
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={isProcessing}
            >
              <RefreshCw className={cn("w-4 h-4 mr-1.5", isProcessing && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Conteúdo antigo de listagem - agora dentro da subpágina */}
        {/* Listagem oficial */}
        <div className="mt-8 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Itens da Shopee</h2>
              <p className="text-sm text-gray-500">
                Lista oficial de anúncios e variações carregada ao entrar na página.
              </p>
            </div>
            <Button variant="outline" onClick={handleLoadInventory} disabled={inventoryLoading}>
              {inventoryLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Atualizando...
                </>
              ) : (
                'Atualizar lista'
              )}
            </Button>
          </div>

          {inventoryError && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md p-3">
              {inventoryError}
            </div>
          )}

          {inventoryLoading && inventoryItems.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando inventário...
            </div>
          )}

          {!inventoryLoading && inventoryItems.length === 0 && !inventoryError && (
            <p className="text-sm text-gray-500">Nenhum item encontrado.</p>
          )}

          {inventoryItems.length > 0 && (
            <div className="space-y-4">
              {/* Botões para expandir/recolher todos */}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={expandAllSkus}
                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                >
                  Expandir todos
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={collapseAllSkus}
                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                >
                  Recolher todos
                </button>
              </div>

              {skuGroups.map((group) => {
                const colorGroups = buildColorGroups(group.items);
                const isExpanded = expandedSkus.has(group.item_sku);
                const totalColors = colorGroups.length;
                const unavailableColors = colorGroups.filter(([, pairs]) => {
                  const totalStock = pairs.reduce((sum, p) => sum + (p.model.total_available_stock ?? 0), 0);
                  return totalStock === 0;
                }).length;

                return (
                  <div
                    key={`sku-${group.item_sku}`}
                    className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden"
                  >
                    {/* Header clicável */}
                    <button
                      type="button"
                      onClick={() => toggleSkuExpanded(group.item_sku)}
                      className="w-full p-4 flex items-center justify-between hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'transition-transform',
                          isExpanded ? 'rotate-90' : ''
                        )}>
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        </div>
                        <div className="text-left">
                          <h3 className="text-base font-semibold text-gray-900">{group.item_sku || 'Sem SKU'}</h3>
                          <p className="text-sm text-gray-500">
                            {group.item_ids.length} anúncio{group.item_ids.length !== 1 ? 's' : ''} · {totalColors} cor{totalColors !== 1 ? 'es' : ''}
                            {unavailableColors > 0 && (
                              <span className="text-red-500 ml-1">
                                ({unavailableColors} indisponível{unavailableColors !== 1 ? 'eis' : ''})
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 text-xs text-gray-500">
                        {group.item_ids.slice(0, 3).map((id) => (
                          <span key={id} className="rounded bg-white px-1.5 py-0.5 border text-[10px]">
                            {id}
                          </span>
                        ))}
                        {group.item_ids.length > 3 && (
                          <span className="text-[10px] text-gray-400">+{group.item_ids.length - 3}</span>
                        )}
                      </div>
                    </button>

                    {/* Conteúdo colapsável */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3 border-t border-gray-200 pt-3">
                        {colorGroups.length > 0 ? (
                          colorGroups.map(([colorOption, pairs]) => {
                                  const models = pairs.map(pair => pair.model);
                                  const colorKey = `${group.item_sku}:${colorOption}`;

                                  // Calcula estoque total
                                  const totalStock = models.reduce((sum, model) => (
                                    sum + (typeof model.total_available_stock === 'number' ? model.total_available_stock : 0)
                                  ), 0);
                                  
                                  // Disponível = tem estoque > 0
                                  const isAvailable = totalStock > 0;

                                  // Monta targets para a API
                                  const targets = Object.values(
                                    pairs.reduce<Record<string, { item_id: string; model_ids: Array<string | number> }>>((acc, pair) => {
                                      if (!acc[pair.item.item_id]) {
                                        acc[pair.item.item_id] = { item_id: pair.item.item_id, model_ids: [] };
                                      }
                                      if (pair.model.model_id) {
                                        acc[pair.item.item_id].model_ids.push(pair.model.model_id);
                                      }
                                      return acc;
                                    }, {})
                                  );

                                  return (
                                    <div
                                      key={`sku-${group.item_sku}-${colorOption}`}
                                      className="rounded-lg border border-gray-200 bg-white p-3"
                                    >
                                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                        <div>
                                          <p className="text-xs text-gray-500">Cor</p>
                                          <p className="text-sm font-semibold text-gray-900">{colorOption}</p>
                                          <p className="text-xs text-gray-500 mt-1">
                                            Estoque: <span className={cn(
                                              'font-semibold',
                                              totalStock === 0 ? 'text-red-600' : 'text-green-600'
                                            )}>{totalStock}</span>
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-gray-500">
                                            {isAvailable ? 'Disponível' : 'Indisponível'}
                                          </span>
                                          <button
                                            type="button"
                                            role="switch"
                                            aria-checked={isAvailable}
                                            disabled={updatingColors.has(colorKey)}
                                            onClick={() => handleToggleColorStatus(
                                              colorOption,
                                              isAvailable,
                                              targets,
                                              group
                                            )}
                                            className={cn(
                                              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                                              isAvailable ? 'bg-green-500' : 'bg-gray-300',
                                              updatingColors.has(colorKey) && 'opacity-60 cursor-not-allowed'
                                            )}
                                          >
                                            <span
                                              className={cn(
                                                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                                                isAvailable ? 'translate-x-6' : 'translate-x-1'
                                              )}
                                            />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                          })
                                        ) : (
                                          <p className="text-xs text-gray-500">Sem modelos</p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
            </div>
          )}
        </div>

        {/* Teste de JSON */}
        <div className="mt-8 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Testar retorno JSON</h2>
              <p className="text-sm text-gray-500">
                Cole um endpoint para visualizar o JSON com níveis expandíveis.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={handleFetchItemBaseInfo} disabled={jsonLoading}>
                {jsonLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  'Buscar detalhes'
                )}
              </Button>
              <Button onClick={handleFetchModelLists} disabled={jsonLoading} variant="secondary">
                Buscar modelos
              </Button>
              <Button variant="outline" onClick={handleFetchJson} disabled={jsonLoading}>
                Buscar JSON
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <Input
              value={endpointInput}
              onChange={(event) => setEndpointInput(event.target.value)}
              placeholder="/api/shopee/status"
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Método</label>
                <select
                  value={methodInput}
                  onChange={(event) => setMethodInput(event.target.value as 'GET' | 'POST')}
                  className="mt-1 h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-gray-600">shop_id (Shopee)</label>
                <Input
                  value={shopIdInput}
                  onChange={(event) => setShopIdInput(event.target.value)}
                  placeholder="Ex: 803215808"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Query (JSON)</label>
                <Textarea
                  value={queryInput}
                  onChange={(event) => setQueryInput(event.target.value)}
                  placeholder='{"page_size": 20}'
                  className="mt-1 text-sm"
                  rows={3}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Body (JSON)</label>
                <Textarea
                  value={bodyInput}
                  onChange={(event) => setBodyInput(event.target.value)}
                  placeholder='{"item_status": "NORMAL"}'
                  className="mt-1 text-sm"
                  rows={3}
                />
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Buscar detalhes usa: get_item_list → get_item_base_info. Buscar modelos usa: get_item_list → get_model_list.
            </p>

            {jsonError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md p-3">
                {jsonError}
              </div>
            )}

            {jsonData ? (
              <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                  <JsonNode
                    value={jsonData}
                    path="$"
                    expandedPaths={expandedPaths}
                    togglePath={handleTogglePath}
                  />
                </div>

                {modelLists.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-800">Modelos por item</h3>
                    <div className="space-y-3">
                      {modelLists.map((entry) => (
                        <div
                          key={`model-${entry.itemId}`}
                          className="rounded-xl border border-gray-200 bg-white p-4"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold text-gray-900">
                              Item ID: {entry.itemId}
                            </p>
                            {entry.error && (
                              <span className="text-xs text-red-600">{entry.error}</span>
                            )}
                          </div>
                          {entry.data ? (
                            <JsonNode
                              value={entry.data}
                              path={`model-${entry.itemId}`}
                              expandedPaths={expandedPaths}
                              togglePath={handleTogglePath}
                            />
                          ) : (
                            <p className="text-xs text-gray-500">Sem dados.</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {itemListFromJson.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-800">
                        Itens encontrados ({itemListFromJson.length})
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {itemListFromJson.map((item: any, index: number) => (
                        <div
                          key={`${item?.item_id || 'item'}-${index}`}
                          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs text-gray-500">Item ID</p>
                              <p className="text-sm font-semibold text-gray-900">
                                {item?.item_id || '—'}
                              </p>
                            </div>
                            <span className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
                              {item?.item_status || 'STATUS'}
                            </span>
                          </div>

                          <div className="mt-3">
                            <p className="text-xs text-gray-500">Nome</p>
                            <p className="text-sm text-gray-900 line-clamp-2">
                              {item?.item_name || 'Sem nome'}
                            </p>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-500">
                            <div>
                              <p className="text-[11px] uppercase tracking-wide text-gray-400">Categoria</p>
                              <p className="text-sm text-gray-800">{item?.category_id || '—'}</p>
                            </div>
                            <div>
                              <p className="text-[11px] uppercase tracking-wide text-gray-400">Atualizado</p>
                              <p className="text-sm text-gray-800">{item?.update_time || '—'}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              !jsonLoading && (
                <Textarea
                  readOnly
                  value="Nenhum JSON carregado ainda."
                  className="text-sm text-gray-500"
                />
              )
            )}
          </div>
        </div>
      </main>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        title="Desconectar loja"
        description="Tem certeza que deseja desconectar esta loja Shopee?"
        confirmLabel="Desconectar"
        variant="destructive"
        onConfirm={doDisconnect}
      />
    </div>
  );
}
