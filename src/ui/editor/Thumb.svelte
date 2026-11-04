<script lang="ts">
  import { bounds, crop, type Pixels } from '../../domain/character/pixels';

  // A part's thumbnail in the layer panel: the picture cropped to what is
  // drawn, scaled to fit `size` px (whole-number zoom when it fits), pixelated.
  let { pixels, size = 32 }: { pixels: Pixels; size?: number } = $props();

  let canvas = $state<HTMLCanvasElement>();
  const box = $derived(bounds(pixels) ?? [0, 0, 1, 1]);
  const w = $derived(box[2] - box[0]);
  const h = $derived(box[3] - box[1]);
  const scale = $derived(Math.min(size / w, size / h) >= 1 ? Math.floor(Math.min(size / w, size / h)) : Math.min(size / w, size / h));

  $effect(() => {
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const part = crop(pixels, box[0], box[1], w, h);
    ctx.putImageData(new ImageData(new Uint8ClampedArray(part.data.buffer), w, h), 0, 0);
  });
</script>

<span class="thumb" style:width="{size}px" style:height="{size}px">
  <canvas bind:this={canvas} data-thumb width={w} height={h} style:width="{w * scale}px" style:height="{h * scale}px"></canvas>
</span>

<style>
  .thumb {
    display: inline-grid;
    place-items: center;
    flex: none;
    background: repeating-conic-gradient(#3a2f4f 0% 25%, #2f2642 0% 50%) 0 0 / 8px 8px;
    border: 1px solid var(--color-shadow);
  }
  canvas { display: block; image-rendering: pixelated; }
</style>
