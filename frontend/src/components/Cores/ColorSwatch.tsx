import { LabColor } from '@/types/cor.types';
import { cn } from '@/lib/utils';
import { Palette } from 'lucide-react';

interface ColorSwatchProps {
  color: {
    lab: LabColor;
    hex: string;
  } | null;
  className?: string;
}

/**
 * Componente visual de swatch para exibir cor capturada
 * Mostra a cor em formato grande com valores LAB e Hex
 */
export function ColorSwatch({ color, className }: ColorSwatchProps) {
  if (!color) {
    return (
      <div
        className={cn(
          'w-full h-48 sm:h-56 md:h-64 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 animate-fade-in',
          className
        )}
      >
        <div className="text-center text-gray-400 px-4">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-200 flex items-center justify-center">
            <Palette className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-base sm:text-lg font-medium">Nenhuma cor capturada</p>
          <p className="text-xs sm:text-sm mt-1">Conecte o colorímetro e capture uma cor</p>
        </div>
      </div>
    );
  }

  const { lab, hex } = color;

  return (
    <div
      className={cn(
        'w-full rounded-xl border border-gray-200 overflow-hidden shadow-lg animate-scale-in',
        className
      )}
    >
      {/* Área da cor - altura responsiva */}
      <div
        className="h-40 sm:h-52 md:h-64 w-full flex items-center justify-center relative transition-all duration-300"
        style={{ backgroundColor: hex }}
      >
        {/* Indicador de contraste baseado no brilho */}
        <div
          className={cn(
            'px-4 sm:px-6 py-2 sm:py-3 rounded-full backdrop-blur-sm transition-all duration-300 hover:scale-105',
            lab.L > 50 ? 'bg-black/20 text-white' : 'bg-white/80 text-gray-900'
          )}
        >
          <span className="text-xl sm:text-2xl font-bold font-mono tracking-wider">{hex}</span>
        </div>
        
        {/* Badge de sucesso */}
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-green-500/90 text-white text-xs font-medium shadow-sm animate-slide-down">
          Capturada
        </div>
      </div>

      {/* Informações da cor - layout responsivo */}
      <div className="bg-white p-4 sm:p-6 border-t border-gray-100">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {/* Valores LAB - compacto em mobile */}
          <div className="bg-gray-50 rounded-lg p-3">
            <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">Valores LAB</h3>
            <div className="space-y-1 font-mono text-xs sm:text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">L:</span>
                <span className="font-semibold text-gray-900">{lab.L.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">a:</span>
                <span className="font-semibold text-gray-900">{lab.a.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">b:</span>
                <span className="font-semibold text-gray-900">{lab.b.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Código Hexadecimal */}
          <div className="bg-gray-50 rounded-lg p-3">
            <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">Hexadecimal</h3>
            <div className="flex items-center gap-2 sm:gap-3">
              <div
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg border-2 border-gray-200 flex-shrink-0 shadow-sm transition-transform hover:scale-105"
                style={{ backgroundColor: hex }}
              />
              <div className="min-w-0">
                <p className="font-mono text-sm sm:text-base font-semibold text-gray-900 truncate">{hex}</p>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">Cor RGB</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
