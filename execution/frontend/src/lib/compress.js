// ── Image Compression Utility ──
// Comprime imagens client-side usando Canvas API antes do upload ao Supabase Storage
// Reduz fotos de 5-10MB para ~200-500KB mantendo qualidade visual adequada

/**
 * Comprime um File de imagem para o tamanho máximo especificado
 * @param {File} file - Arquivo original da imagem
 * @param {Object} options - Opções de compressão
 * @param {number} options.maxWidth - Largura máxima (default: 1200px)
 * @param {number} options.maxHeight - Altura máxima (default: 1200px)
 * @param {number} options.quality - Qualidade JPEG 0-1 (default: 0.7)
 * @returns {Promise<File>} Arquivo comprimido
 */
export async function compressImage(file, options = {}) {
    const { maxWidth = 1200, maxHeight = 1200, quality = 0.7 } = options;

    // Se não for imagem, retorna original
    if (!file.type.startsWith('image/')) return file;

    // Se já for menor que 500KB, não comprimir
    if (file.size < 500 * 1024) return file;

    return new Promise((resolve) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        img.onload = () => {
            let { width, height } = img;

            // Calcular dimensões proporcionais
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
            if (height > maxHeight) {
                width = (width * maxHeight) / height;
                height = maxHeight;
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    const compressed = new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                    });
                    console.log(`[compress] ${file.name}: ${(file.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB`);
                    resolve(compressed);
                },
                'image/jpeg',
                quality
            );
        };

        img.onerror = () => resolve(file); // fallback: retorna original
        img.src = URL.createObjectURL(file);
    });
}

/**
 * Comprime múltiplos arquivos de imagem
 * @param {FileList|File[]} files
 * @param {Object} options
 * @returns {Promise<File[]>}
 */
export async function compressImages(files, options = {}) {
    const arr = Array.from(files);
    return Promise.all(arr.map(f => compressImage(f, options)));
}
