import { useState, useEffect, useCallback, useRef } from 'react';
import { auth } from '@/config/firebase';
import {
  ShopeeShop,
  ShopeeAuthUrlResponse,
  ShopeeCallbackResponse,
  ShopeeStatusResponse,
  ShopeeDisconnectResponse,
  ShopeeCallbackParams,
} from '@/types/shopee.types';
import { useToast } from './use-toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Hook para gerenciar integração com Shopee
 */
export function useShopee() {
  const [shops, setShops] = useState<ShopeeShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const { toast } = useToast();
  const popupRef = useRef<Window | null>(null);
  const popupMonitorRef = useRef<number | null>(null);
  const callbackHandledRef = useRef(false);

  /**
   * Obtém o token de autenticação do usuário atual
   */
  const getAuthToken = async (): Promise<string | null> => {
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
  };

  /**
   * Faz requisição autenticada para a API
   */
  const apiRequest = async <T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> => {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Usuário não autenticado');
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Erro na requisição');
    }

    return data;
  };

  const clearPopupMonitor = useCallback(() => {
    if (popupMonitorRef.current) {
      window.clearInterval(popupMonitorRef.current);
      popupMonitorRef.current = null;
    }
  }, []);

  /**
   * Carrega o status de conexão das lojas
   */
  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiRequest<ShopeeStatusResponse>('/api/shopee/status');
      
      if (response.data?.shops) {
        setShops(response.data.shops);
      } else if (response.data?.shop) {
        setShops([response.data.shop]);
      } else {
        setShops([]);
      }
    } catch (error: any) {
      console.error('Erro ao carregar status Shopee:', error);
      // Não mostra toast de erro no carregamento inicial
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Inicia o fluxo de conexão com Shopee
   */
  const connect = useCallback(async () => {
    try {
      setConnecting(true);
      callbackHandledRef.current = false;

      // Obtém URL de autorização
      const response = await apiRequest<ShopeeAuthUrlResponse>('/api/shopee/auth-url');

      if (!response.data?.authUrl) {
        throw new Error('URL de autorização não recebida');
      }

      const width = 600;
      const height = 720;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        response.data.authUrl,
        'shopee-auth',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      if (!popup) {
        setConnecting(false);
        toast({
          title: 'Pop-up bloqueado',
          description: 'Permita pop-ups para concluir a conexão com a Shopee.',
          variant: 'destructive',
        });
        return;
      }

      popupRef.current = popup;
      popup.focus();

      clearPopupMonitor();
      popupMonitorRef.current = window.setInterval(() => {
        if (!popupRef.current || popupRef.current.closed) {
          clearPopupMonitor();
          popupRef.current = null;

          if (!callbackHandledRef.current) {
            setConnecting(false);
            toast({
              title: 'Conexão cancelada',
              description: 'A janela de autorização foi fechada.',
              variant: 'destructive',
            });
          }
        }
      }, 500);
    } catch (error: any) {
      console.error('Erro ao iniciar conexão:', error);
      setConnecting(false);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível iniciar a conexão',
        variant: 'destructive',
      });
    }
  }, [apiRequest, clearPopupMonitor, toast]);

  /**
   * Processa o callback da Shopee
   */
  const handleCallback = useCallback(async (params: ShopeeCallbackParams): Promise<boolean> => {
    try {
      setConnecting(true);

      const response = await apiRequest<ShopeeCallbackResponse>('/api/shopee/callback', {
        method: 'POST',
        body: JSON.stringify({
          code: params.code,
          shop_id: params.shop_id,
        }),
      });

      toast({
        title: 'Sucesso!',
        description: response.data?.message || 'Loja conectada com sucesso!',
      });

      // Recarrega status
      await loadStatus();

      return true;
    } catch (error: any) {
      console.error('Erro no callback:', error);
      
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao processar autorização',
        variant: 'destructive',
      });

      return false;
    } finally {
      setConnecting(false);
    }
  }, [toast, loadStatus]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!event.data || event.data.type !== 'shopee_auth_callback') return;

      const payload = event.data.payload as ShopeeCallbackParams | undefined;
      if (!payload?.code) return;

      callbackHandledRef.current = true;
      clearPopupMonitor();

      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }

      await handleCallback(payload);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleCallback, clearPopupMonitor]);

  /**
   * Desconecta uma loja
   */
  const disconnect = useCallback(async (shopId: number): Promise<boolean> => {
    try {
      const response = await apiRequest<ShopeeDisconnectResponse>('/api/shopee/disconnect', {
        method: 'POST',
        body: JSON.stringify({ shop_id: shopId }),
      });

      toast({
        title: 'Sucesso!',
        description: response.data?.message || 'Loja desconectada',
      });

      // Remove da lista local
      setShops(prev => prev.filter(shop => shop.shopId !== shopId));

      return true;
    } catch (error: any) {
      console.error('Erro ao desconectar:', error);
      
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao desconectar loja',
        variant: 'destructive',
      });

      return false;
    }
  }, [toast]);

  /**
   * Verifica se está no callback da Shopee
   */
  const checkForCallback = useCallback(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const shopId = urlParams.get('shop_id');

    if (code && shopId) {
      return { code, shop_id: shopId };
    }

    return null;
  }, []);

  // Carrega status inicial
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      loadStatus();
    }
  }, [loadStatus]);

  useEffect(() => {
    return () => {
      clearPopupMonitor();
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
    };
  }, [clearPopupMonitor]);

  return {
    shops,
    loading,
    connecting,
    connected: shops.length > 0,
    connect,
    disconnect,
    handleCallback,
    checkForCallback,
    refresh: loadStatus,
  };
}
