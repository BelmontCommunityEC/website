/**
 * Prepares photos in the browser for the website before upload.
 *
 * Quality first: photos are kept at up to 2560px on the long edge (sharper
 * than the existing 2048px site photos, and over 3x the width the event cover
 * is displayed at), downscaled in high-quality steps and saved as JPEG at 90%
 * quality. Quality is only lowered slightly if a photo would exceed the upload
 * limit. Re-encoding also removes camera metadata such as GPS location.
 */
import { MAX_PHOTO_BYTES } from '../lib/event-draft.ts';

export const TARGET_LONG_EDGE = 2560;
const FALLBACK_LONG_EDGE = 2048;
const MIN_LONG_EDGE = 800;
const SOFT_LONG_EDGE = 1600;
const QUALITIES = [0.9, 0.86, 0.82];
const MAX_INPUT_BYTES = 60_000_000;

export interface PreparedPhoto {
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  quality: number;
  warning?: string;
}

export class PhotoError extends Error {}

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

async function decode(file: File): Promise<Decoded> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  } catch {
    // Fall back to <img>, which also applies the camera's rotation.
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new PhotoError('This photo can’t be opened in this browser. Save or export it as a JPEG and try again.');
  }
  return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new PhotoError('This browser can’t prepare photos. Try a recent version of Chrome, Safari, Edge or Firefox.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  return { canvas, context };
}

/** Halves the image until close to the target, then does a final high-quality resize, which avoids jagged or soft results. */
function resize(decoded: Decoded, targetWidth: number, targetHeight: number) {
  let source: CanvasImageSource = decoded.source;
  let width = decoded.width;
  let height = decoded.height;
  while (width / 2 >= targetWidth * 1.5) {
    width = Math.round(width / 2);
    height = Math.round(height / 2);
    const step = makeCanvas(width, height);
    step.context.drawImage(source, 0, 0, width, height);
    source = step.canvas;
  }
  const final = makeCanvas(targetWidth, targetHeight);
  // JPEG has no transparency, so transparent areas become white instead of black.
  final.context.fillStyle = '#ffffff';
  final.context.fillRect(0, 0, targetWidth, targetHeight);
  final.context.drawImage(source, 0, 0, targetWidth, targetHeight);
  return final.canvas;
}

const toJpeg = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new PhotoError('The photo couldn’t be prepared.'))), 'image/jpeg', quality);
  });

function fit(width: number, height: number, longEdge: number) {
  const scale = Math.min(1, longEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
    throw new PhotoError('Choose a photo file (JPEG, PNG, WebP or HEIC).');
  }
  if (file.size > MAX_INPUT_BYTES) throw new PhotoError('This file is very large. Export a smaller copy (under 60 MB) and try again.');

  const decoded = await decode(file);
  try {
    const longEdge = Math.max(decoded.width, decoded.height);
    if (longEdge < MIN_LONG_EDGE) {
      throw new PhotoError(
        `This photo is too small (${decoded.width} × ${decoded.height}) to look good on the website. Use the original photo from the camera or phone.`,
      );
    }
    const warning =
      longEdge < SOFT_LONG_EDGE
        ? `This photo is a bit small (${decoded.width} × ${decoded.height}) and may look soft on large screens. Use the original if you have it.`
        : undefined;

    for (const edge of [TARGET_LONG_EDGE, FALLBACK_LONG_EDGE]) {
      const size = fit(decoded.width, decoded.height, edge);
      const canvas = resize(decoded, size.width, size.height);
      for (const quality of QUALITIES) {
        const blob = await toJpeg(canvas, quality);
        if (blob.size <= MAX_PHOTO_BYTES) {
          return {
            blob,
            previewUrl: URL.createObjectURL(blob),
            width: size.width,
            height: size.height,
            originalWidth: decoded.width,
            originalHeight: decoded.height,
            quality,
            warning,
          };
        }
      }
    }
    throw new PhotoError('This photo couldn’t be made small enough to upload. Try a different photo.');
  } finally {
    decoded.release();
  }
}

export const formatBytes = (bytes: number) =>
  bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
