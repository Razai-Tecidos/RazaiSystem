import { useState, useCallback, useRef } from 'react';

interface UseBluetoothReturn {
  device: BluetoothDevice | null;
  connected: boolean;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendCommand: (data: Uint8Array | string) => Promise<void>;
  onDataReceived: (callback: (data: DataView) => void) => void;
}

/**
 * Hook para comunicação Bluetooth genérica usando Web Bluetooth API
 */
export function useBluetooth(): UseBluetoothReturn {
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dataCallbackRef = useRef<((data: DataView) => void) | null>(null);
  const notifyCharacteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const writeCharacteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);

  // Verificar suporte do navegador
  const checkBluetoothSupport = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.bluetooth) {
      throw new Error(
        'Bluetooth não é suportado neste navegador. Use Chrome ou Edge.'
      );
    }
  }, []);

  const connect = useCallback(async () => {
    try {
      checkBluetoothSupport();
      setConnecting(true);
      setError(null);

      // Solicitar dispositivo Bluetooth
      if (!navigator.bluetooth) {
        throw new Error('Bluetooth não está disponível');
      }
      const bluetoothDevice = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'LS173' },
          { services: ['0000ffe0-0000-1000-8000-00805f9b34fb'] }, // Serial Port Data Channel
        ],
        optionalServices: [
          '0000ffe5-0000-1000-8000-00805f9b34fb', // Bluetooth Data Channel
          '0000ffe0-0000-1000-8000-00805f9b34fb'  // Serial Port Data Channel
        ],
      });

      setDevice(bluetoothDevice);

      // Conectar ao GATT server
      const server = await bluetoothDevice.gatt?.connect();
      if (!server) {
        throw new Error('Não foi possível conectar ao dispositivo');
      }

      // Obter serviço Serial Port Data Channel (0xFFE0) para receber dados
      const serialService = await server.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb');
      const notifyCharacteristic = await serialService.getCharacteristic('0000ffe4-0000-1000-8000-00805f9b34fb');

      // Habilitar notificações
      await notifyCharacteristic.startNotifications();

      // Escutar dados recebidos
      notifyCharacteristic.addEventListener(
        'characteristicvaluechanged',
        (event: Event) => {
          const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
          if (characteristic.value && dataCallbackRef.current) {
            dataCallbackRef.current(characteristic.value);
          }
        }
      );

      notifyCharacteristicRef.current = notifyCharacteristic;

      // Obter serviço Bluetooth Data Channel (0xFFE5) para enviar comandos
      const dataService = await server.getPrimaryService('0000ffe5-0000-1000-8000-00805f9b34fb');
      const writeCharacteristic = await dataService.getCharacteristic('0000ffe9-0000-1000-8000-00805f9b34fb');

      writeCharacteristicRef.current = writeCharacteristic;

      // Escutar desconexão
      bluetoothDevice.addEventListener('gattserverdisconnected', () => {
        setConnected(false);
        setDevice(null);
        notifyCharacteristicRef.current = null;
        writeCharacteristicRef.current = null;
      });

      setConnected(true);
      setConnecting(false);
    } catch (err: any) {
      setConnecting(false);
      setConnected(false);
      setDevice(null);

      if (err.name === 'NotFoundError') {
        setError('Dispositivo LS173 não encontrado. Verifique se está ligado e próximo.');
      } else if (err.name === 'SecurityError') {
        setError('Permissão Bluetooth negada. Permita o acesso ao Bluetooth nas configurações do navegador.');
      } else if (err.name === 'NetworkError') {
        setError('Erro de conexão com o dispositivo. Tente novamente.');
      } else {
        setError(err.message || 'Erro ao conectar ao dispositivo Bluetooth');
      }
      throw err;
    }
  }, [checkBluetoothSupport]);

  const disconnect = useCallback(async () => {
    try {
      if (device?.gatt?.connected) {
        await device.gatt.disconnect();
      }
      setDevice(null);
      setConnected(false);
      notifyCharacteristicRef.current = null;
      writeCharacteristicRef.current = null;
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erro ao desconectar');
    }
  }, [device]);

  const sendCommand = useCallback(
    async (data: Uint8Array | string) => {
      if (!writeCharacteristicRef.current) {
        throw new Error('Dispositivo não conectado');
      }

      let buffer: Uint8Array;
      if (typeof data === 'string') {
        // Converter string para Uint8Array
        const encoder = new TextEncoder();
        buffer = encoder.encode(data);
      } else {
        // Criar cópia
        buffer = new Uint8Array(data);
      }

      try {
        // Criar novo ArrayBuffer a partir dos dados para garantir tipo correto
        const arrayBuffer = new ArrayBuffer(buffer.length);
        const view = new Uint8Array(arrayBuffer);
        view.set(buffer);
        await writeCharacteristicRef.current.writeValue(arrayBuffer);
      } catch (err: any) {
        setError(err.message || 'Erro ao enviar comando');
        throw err;
      }
    },
    []
  );

  const onDataReceived = useCallback((callback: (data: DataView) => void) => {
    dataCallbackRef.current = callback;
  }, []);

  return {
    device,
    connected,
    connecting,
    error,
    connect,
    disconnect,
    sendCommand,
    onDataReceived,
  };
}
