/**
 * The long arena wall painting, built in the browser from the original wall texture.
 *
 * The original is a 2:1 tile of painted sky over hills. Tiled along a 150-long wall it repeats
 * every few metres. This lays it out as one long painting from different stretches of the
 * original, some mirrored, cross-faded so there are no seams. Its painted sky is recolored sky
 * blue, and the ceiling continues that color, so the arena reads as one enclosed hall with an
 * artificial sky.
 */

import * as THREE from 'three'

// Width over height of the finished painting; capped by what the GPU can hold
export const PAINTING_ASPECT = 8
// Width of each stretch taken from the original, and how far neighbours cross-fade
const SEGMENT = 0.62
const FADE = 0.2
// The painted sky is recolored sky blue: deeper at the top, paler toward the hills
export const SKY_TOP = new THREE.Color(0x3a9cff)
const SKY_HORIZON = new THREE.Color(0xa6dcff)
// Share of the painting's height down to where the hills begin
const HORIZON = 0.78
// How much of the original brush texture shows through the new color
const SKY_DETAIL = 0.8

export interface WallPainting {
  texture: THREE.CanvasTexture
  // Color at the top of the painted sky, for the ceiling to continue it
  skyTop: THREE.Color
}

function random(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return [canvas, canvas.getContext('2d')!]
}

// How sure we are a pixel is painted sky: it's bluish grey, clearly more blue than red
function skyness(r: number, g: number, b: number): number {
  return Math.min(1, Math.max(0, (b - r - 4) / 14)) * (b >= g - 8 ? 1 : 0)
}

// The original, upright (the file is stored upside down, glTF style), with its dull painted
// sky recolored sky blue. Each row keeps its brush texture as variation around the new color
function upright(image: HTMLImageElement): HTMLCanvasElement {
  const { width, height } = image
  const [canvas, ctx] = makeCanvas(width, height)
  ctx.translate(0, height)
  ctx.scale(1, -1)
  ctx.drawImage(image, 0, 0)

  const pixels = ctx.getImageData(0, 0, width, height)
  const data = pixels.data
  const top = SKY_TOP.clone().convertLinearToSRGB()
  const horizon = SKY_HORIZON.clone().convertLinearToSRGB()
  for (let y = 0; y < height; y++) {
    const row = y * width * 4
    // The row's average sky color, so only its texture, not its old tint, carries over
    let [sr, sg, sb, n] = [0, 0, 0, 0]
    for (let i = row; i < row + width * 4; i += 4) {
      if (skyness(data[i], data[i + 1], data[i + 2]) > 0.5) {
        sr += data[i]
        sg += data[i + 1]
        sb += data[i + 2]
        n++
      }
    }
    if (n === 0) continue
    ;[sr, sg, sb] = [sr / n, sg / n, sb / n]
    const target = top.clone().lerp(horizon, Math.min(1, y / (height * HORIZON)) ** 1.5)
    const [tr, tg, tb] = [target.r * 255, target.g * 255, target.b * 255]
    for (let i = row; i < row + width * 4; i += 4) {
      const w = skyness(data[i], data[i + 1], data[i + 2])
      if (w === 0) continue
      data[i] += w * (tr + (data[i] - sr) * SKY_DETAIL - data[i])
      data[i + 1] += w * (tg + (data[i + 1] - sg) * SKY_DETAIL - data[i + 1])
      data[i + 2] += w * (tb + (data[i + 2] - sb) * SKY_DETAIL - data[i + 2])
    }
  }
  ctx.putImageData(pixels, 0, 0)
  return canvas
}

/**
 * Loads the original painting and returns the long version. `maxWidth` is the largest texture
 * width the GPU accepts
 */
export async function createWallPainting(url: string, maxWidth: number): Promise<WallPainting> {
  const image = await new THREE.ImageLoader().loadAsync(url)
  const source = upright(image)

  const height = Math.min(image.height, Math.floor(maxWidth / PAINTING_ASPECT))
  const width = height * PAINTING_ASPECT
  const scale = height / image.height
  const [canvas, ctx] = makeCanvas(width, height)

  // Lay stretches of the original along the wall, some mirrored, each fading in over the end
  // of the one before
  const segmentWidth = Math.round(image.width * SEGMENT)
  const fadeWidth = Math.round(image.width * FADE)
  const rand = random(456)
  const [piece, pieceCtx] = makeCanvas(segmentWidth, image.height)
  for (let x = -fadeWidth; x < width / scale; x += segmentWidth - fadeWidth) {
    pieceCtx.globalCompositeOperation = 'copy'
    const from = Math.floor(rand() * (image.width - segmentWidth))
    pieceCtx.save()
    if (rand() < 0.5) {
      pieceCtx.translate(segmentWidth, 0)
      pieceCtx.scale(-1, 1)
    }
    pieceCtx.drawImage(source, from, 0, segmentWidth, image.height, 0, 0, segmentWidth, image.height)
    pieceCtx.restore()
    // Fade the left edge in. destination-in clears whatever it doesn't cover, so the mask spans
    // the whole piece and stays opaque after the fade
    pieceCtx.globalCompositeOperation = 'destination-in'
    const fade = pieceCtx.createLinearGradient(0, 0, fadeWidth, 0)
    fade.addColorStop(0, 'rgba(0, 0, 0, 0)')
    fade.addColorStop(1, 'rgba(0, 0, 0, 1)')
    pieceCtx.fillStyle = fade
    pieceCtx.fillRect(0, 0, segmentWidth, image.height)
    pieceCtx.globalCompositeOperation = 'source-over'

    ctx.drawImage(piece, x * scale, 0, segmentWidth * scale, height)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return { texture, skyTop: SKY_TOP.clone() }
}
