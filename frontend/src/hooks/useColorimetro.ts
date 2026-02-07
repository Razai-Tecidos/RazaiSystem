import { useState, useCallback, useEffect, useRef } from 'react';
import { useBluetooth } from './useBluetooth';
import { LabColor } from '@/types/cor.types';
import { labToHex, compensarColorimetro } from '@/lib/colorUtils';

interface CapturedColor {
  lab: LabColor; // LAB compensado (usado para exibição e processo Reinhard)
  labOriginal: LabColor; // LAB original capturado pelo colorímetro
  hex: string;
}

interface UseColorimetroReturn {
  connected: boolean;
  connecting: boolean;
  capturedColor: CapturedColor | null;
  error: string | null;
  rawData: string | null; // Dados brutos para debug (visível na tela)
  dataHistory: string[]; // Histórico de pacotes recebidos
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  capture: () => Promise<void>; // Mantida para compatibilidade, mas não faz nada
  clearCapture: () => void;
  clearRawData: () => void; // Limpar dados de debug
}

/**
 * Hook específico para colorímetro LS173
 * Gerencia conexão, captura e parse de dados LAB
 * 
 * O LS173 usa módulo Bluetooth RF-BM-4044B que transmite dados via Serial Port Data Channel (0xFFE0)
 * Os dados são enviados automaticamente quando o botão físico é pressionado no colorímetro
 */
export function useColorimetro(): UseColorimetroReturn {
  const {
    connected,
    connecting,
    error: bluetoothError,
    connect: connectBluetooth,
    disconnect: disconnectBluetooth,
    onDataReceived,
  } = useBluetooth();

  const [capturedColor, setCapturedColor] = useState<CapturedColor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawData, setRawData] = useState<string | null>(null);
  const [dataHistory, setDataHistory] = useState<string[]>([]); // Histórico de pacotes
  const dataBufferRef = useRef<string>(''); // Buffer para acumular dados recebidos

  // Atualizar erro quando houver erro do Bluetooth
  useEffect(() => {
    setError(bluetoothError);
  }, [bluetoothError]);

  // Configurar callback de dados recebidos - captura automática quando botão físico é pressionado
  useEffect(() => {
    if (!connected) return;

    const handleData = (dataView: DataView) => {
      try {
        const bytes = new Uint8Array(dataView.buffer);
        const timestamp = new Date().toLocaleTimeString();
        
        // Formatar dados para exibição
        const hexString = Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
        const asciiString = new TextDecoder().decode(bytes);
        const decimalString = Array.from(bytes).join(', ');
        
        // Criar entrada formatada para o histórico
        const entry = [
          `[${timestamp}] ${bytes.length} bytes`,
          `HEX: ${hexString}`,
          `DEC: ${decimalString}`,
          `ASCII: ${asciiString.replace(/[\x00-\x1F\x7F-\xFF]/g, '.')}`, // Substituir caracteres não imprimíveis
        ].join('\n');
        
        // Atualizar dados brutos (último pacote)
        setRawData(entry);
        
        // Adicionar ao histórico (manter últimos 10 pacotes)
        setDataHistory(prev => [...prev.slice(-9), entry]);
        
        // Acumular dados no buffer (dados podem vir fragmentados)
        dataBufferRef.current += asciiString;
        
        // Tentar parsear os dados acumulados
        const labOriginal = parseLabData(dataBufferRef.current, bytes);
        
        if (labOriginal) {
          // Aplicar compensação do colorímetro
          const labCompensado = compensarColorimetro(labOriginal);
          const hex = labToHex(labCompensado);
          setCapturedColor({ 
            lab: labCompensado, 
            labOriginal,
            hex 
          });
          setError(null);
          dataBufferRef.current = ''; // Limpar buffer após parse bem-sucedido
        }
      } catch (err: any) {
        setError('Erro ao processar dados recebidos. Verifique se o botão foi pressionado corretamente.');
      }
    };

    onDataReceived(handleData);

    // Cleanup
    return () => {
      dataBufferRef.current = '';
    };
  }, [connected, onDataReceived]);

  /**
   * Parse de dados recebidos do colorímetro LS173
   * 
   * Formato identificado do LS173 (Linshang):
   * - Pacote de 64 bytes
   * - Header: AB 44 00 00 00 00 36 00
   * - Offset 8: L como uint16 little-endian * 100
   * - Offset 10: a como int16 little-endian * 100
   * - Offset 12: b como int16 little-endian * 100
   */
  const parseLabData = (_text: string, bytes: Uint8Array): LabColor | null => {
    // Formato LS173: Pacote de 64 bytes com header AB 44
    // L, a, b estão nos offsets 8, 10, 12 como int16 little-endian * 100
    if (bytes.length >= 14 && bytes[0] === 0xAB && bytes[1] === 0x44) {
      const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      
      // Offset 8: L (uint16, sempre positivo, 0-100)
      // Offset 10: a (int16, pode ser negativo)
      // Offset 12: b (int16, pode ser negativo)
      const L = dataView.getUint16(8, true) / 100;
      const a = dataView.getInt16(10, true) / 100;
      const b = dataView.getInt16(12, true) / 100;
      
      if (isValidLab(L, a, b)) {
        return { L: Math.round(L * 100) / 100, a: Math.round(a * 100) / 100, b: Math.round(b * 100) / 100 };
      }
    }

    // Fallback: Tentar outros formatos caso o header seja diferente
    
    // Formato alternativo: Procurar por padrão de 6 bytes válidos em qualquer posição
    if (bytes.length >= 6) {
      const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      
      // Tentar encontrar L, a, b em diferentes offsets
      for (let offset = 0; offset <= bytes.length - 6; offset++) {
        try {
          const L = dataView.getUint16(offset, true) / 100;
          const a = dataView.getInt16(offset + 2, true) / 100;
          const b = dataView.getInt16(offset + 4, true) / 100;
          
          // Validar ranges mais estritos para evitar falsos positivos
          if (L >= 0 && L <= 100 && a >= -128 && a <= 128 && b >= -128 && b <= 128) {
            // Verificar se os valores parecem realistas (não são todos zeros ou muito pequenos)
            if (L > 0.1 || Math.abs(a) > 0.1 || Math.abs(b) > 0.1) {
              return { L: Math.round(L * 100) / 100, a: Math.round(a * 100) / 100, b: Math.round(b * 100) / 100 };
            }
          }
        } catch {
          // Continuar para próximo offset
        }
      }
    }

    // Formato texto: L:XX.XX a:XX.XX b:XX.XX
    const labelPattern = /L\*?\s*[:=]\s*([\d.,]+)\s*a\*?\s*[:=]\s*([-\d.,]+)\s*b\*?\s*[:=]\s*([-\d.,]+)/i;
    const text = new TextDecoder().decode(bytes);
    const match = text.match(labelPattern);
    if (match) {
      const L = parseFloat(match[1].replace(',', '.'));
      const a = parseFloat(match[2].replace(',', '.'));
      const b = parseFloat(match[3].replace(',', '.'));
      if (isValidLab(L, a, b)) {
        return { L, a, b };
      }
    }

    return null;
  };

  /**
   * Valida se os valores LAB estão dentro dos ranges válidos
   */
  const isValidLab = (L: number, a: number, b: number): boolean => {
    return (
      !isNaN(L) && !isNaN(a) && !isNaN(b) &&
      isFinite(L) && isFinite(a) && isFinite(b) &&
      L >= 0 && L <= 100 &&
      a >= -128 && a <= 128 &&
      b >= -128 && b <= 128
    );
  };

  const connect = useCallback(async () => {
    try {
      setError(null);
      setRawData(null);
      setDataHistory([]);
      dataBufferRef.current = '';
      await connectBluetooth();
    } catch (err) {
      // Erro já é tratado no hook useBluetooth
      throw err;
    }
  }, [connectBluetooth]);

  const disconnect = useCallback(async () => {
    setCapturedColor(null);
    setRawData(null);
    setDataHistory([]);
    dataBufferRef.current = '';
    await disconnectBluetooth();
  }, [disconnectBluetooth]);

  // Função capture mantida para compatibilidade - não faz nada
  // A captura é automática quando o botão físico do colorímetro é pressionado
  const capture = useCallback(async () => {
    if (!connected) {
      setError('Dispositivo não conectado');
      return;
    }
    // Captura automática - aguardar dados do botão físico
  }, [connected]);

  const clearCapture = useCallback(() => {
    setCapturedColor(null);
    setError(null);
  }, []);

  const clearRawData = useCallback(() => {
    setRawData(null);
    setDataHistory([]);
    dataBufferRef.current = '';
  }, []);

  return {
    connected,
    connecting,
    capturedColor,
    error,
    rawData,
    dataHistory,
    connect,
    disconnect,
    capture,
    clearCapture,
    clearRawData,
  };
}
