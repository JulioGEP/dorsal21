export async function imageFileToDataUrl(file, maxSize = 640, quality = 0.78) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Selecciona una imatge vàlida.');
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('La imatge és massa gran. Màxim 8 MB.');
  }

  const source = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const image = await new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = reject;
    element.src = source;
  });

  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/jpeg', quality);
}
