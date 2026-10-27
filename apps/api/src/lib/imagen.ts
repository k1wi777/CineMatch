import sharp from "sharp";

export type FormatoImagen = "jpeg" | "png" | "webp";

// Tamaño de avatar en píxeles y calidad del WebP resultante.
const LADO_AVATAR = 256;
const CALIDAD_WEBP = 85;
// Límite de píxeles de entrada (unos 40 MP): evita que una imagen pequeña en bytes se expanda en memoria.
const PIXELES_MAXIMOS = 40_000_000;

const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Detecta el formato por su firma (magic bytes). Ni la extensión ni el Content-Type del cliente cuentan.
export function detectarFormatoImagen(buffer: Buffer): FormatoImagen | undefined {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(FIRMA_PNG)) {
    return "png";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return undefined;
}

// Recorte cuadrado centrado a 256×256 en WebP. Sharp descarta los metadatos (EXIF, GPS, etc.)
// salvo que se pidan; rotate() aplica antes la orientación del EXIF para no girar la foto.
export function procesarAvatar(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer, { limitInputPixels: PIXELES_MAXIMOS })
    .rotate()
    .resize(LADO_AVATAR, LADO_AVATAR, { fit: "cover", position: "centre" })
    .webp({ quality: CALIDAD_WEBP })
    .toBuffer();
}
