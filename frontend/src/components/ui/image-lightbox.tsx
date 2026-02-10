import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ImageLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
  title?: string;
  subtitle?: string;
}

export function ImageLightbox({
  open,
  onOpenChange,
  imageUrl,
  title = 'Preview da imagem',
  subtitle,
}: ImageLightboxProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[92vh] overflow-hidden p-3 sm:p-4 bg-black/95 border-gray-700">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-white text-base sm:text-lg">{title}</DialogTitle>
          {subtitle ? <p className="text-xs sm:text-sm text-gray-300">{subtitle}</p> : null}
        </DialogHeader>

        <div className="w-full h-[75vh] rounded-md border border-gray-700 bg-black/80 flex items-center justify-center overflow-hidden">
          {imageUrl ? (
            <img src={imageUrl} alt={title} className="max-w-full max-h-full w-auto h-auto object-contain" />
          ) : (
            <div className="h-52 flex items-center justify-center text-gray-400 text-sm">
              Nenhuma imagem selecionada
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
