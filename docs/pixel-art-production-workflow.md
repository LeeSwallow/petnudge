# Pixel Art Production Workflow

## 0. 목적

Lofi Study Companion의 픽셀아트는 단순 asset decoration이 아니라 제품 경험의 핵심이다.

이 문서는 모바일 앱 구현 전에 필요한 픽셀아트 제작/적용 워크플로우를 정의한다.

핵심 목표:

```text
1. 16~32-bit 감성의 밝고 선명한 pixel study room을 만든다.
2. 조명/날씨/네온 효과를 별도 layer로 관리한다.
3. 캐릭터 micro-animation과 focus→break 전이가 자연스럽게 보이게 한다.
4. AI/사람이 만든 rough image를 바로 쓰지 않고, pixel cleanup/QA 과정을 거친다.
5. React Native Skia에서 재사용 가능한 asset 단위로 export한다.
```

---

## 1. Visual Target

권장 룩:

```text
32-bit inspired clean pixel art
mobile portrait composition
bright neon highlights
dark navy / purple base
warm desk light + cool city/window light
pixelated glow clusters, not smooth blur
readable Korean dialogue UI
```

피해야 할 룩:

```text
strict NES 8-bit low-color look
칙칙한 저채도 화면
generic SaaS dashboard
smooth cyberpunk blur
AI image를 그대로 축소한 pseudo-pixel art
캐릭터 표정을 읽기 어려운 과도한 pixelation
```

Style keyword:

```text
bright pixel study room
lofi neon cafe
mobile visual novel dialogue
quiet companion presence
```

---

## 2. Asset Categories

MVP asset set:

```text
A. Room Background
- main night study room
- window/time variants: morning, night, late_night
- weather overlays: clear, rain, snow

B. Character Sprite
- base pose
- focus writing loop
- pen down transition
- cup sip transition
- look up pose
- break idle window
- break idle sleep/rest
- expression variants: neutral, warm, tired, smile

C. Study Tools
- pixel planner note
- page flip frames
- todo stamp/check
- desk timer object
- timer HUD mini version
- pixel music player / cassette / radio

D. Room Growth Objects
- first coffee cup
- wall plaque
- framed memory
- study stamp card
- companion note
- seat marker

E. FX / Lighting
- desk lamp warm light mask
- window cool light mask
- neon sign clusters
- rain particle sprites
- snow particle sprites
- sparkle frames
- screen dim overlay
```

---

## 3. Production Pipeline

### ComfyUI의 위치

ComfyUI는 이 프로젝트의 pixel art workflow를 제대로 만드는 데 매우 유용하다. 다만 ComfyUI가 최종 픽셀아트를 “완성”하는 도구라기보다, 다음을 안정적으로 반복하는 production pipeline 역할을 해야 한다.

```text
reference generation
→ style-consistent rough concept
→ lighting variant generation
→ pose/expression draft
→ img2img refinement
→ upscaling/downscaling guide
→ manual pixel cleanup
→ mobile asset export
```

핵심 원칙:

```text
ComfyUI = 반복 가능한 rough/lighting/variant factory
Aseprite/manual cleanup = final pixel art authority
React Native Skia = runtime composition/lighting/animation authority
```

즉, ComfyUI output을 앱에 그대로 넣지 않는다. ComfyUI는 좋은 구도, 색감, 조명, 캐릭터 포즈, mood variant를 빠르게 만들고, 최종 asset은 픽셀 그리드에 맞게 정리한다.

### Step 1. Reference / Rough Concept

Inputs:

```text
- product-definition.md
- reference image from ChatGPT / AI image generation
- style board: Coffee Talk / VA-11 Hall-A / YouTube Study With Me / pixel room
```

Output:

```text
rough concept image
composition notes
palette candidate
asset list
```

Rule:

```text
AI image is reference only. It is not final game art.
```

### Step 2. Pixel Composition Blockout

Create a low-resolution composition first.

Recommended working canvas:

```text
mobile portrait logical canvas: 360 x 640 or 390 x 844
pixel scene base: 180 x 320 or 195 x 422, scaled 2x
```

Blockout layers:

```text
background sky/window
room wall/floor
desk
character
study tools
foreground objects
UI safe zones
```

Goal:

```text
At phone size, the character, timer, note, and dialogue box must be readable.
```

### Step 3. Palette Lock

Use a controlled palette with room for neon and lighting.

Palette groups:

```text
Base darks: navy, purple-black, muted charcoal
Warm light: amber, cream, coffee brown
Cool light: blue, violet, cyan
Accent: pink, lavender, neon blue
UI: off-white, muted grey, dark border
```

Rule:

```text
Do not use random AI colors per asset.
Every asset must map into the shared palette groups.
```

### Step 4. Manual Pixel Cleanup

Every generated or rough asset must pass cleanup:

```text
- remove noisy anti-aliasing
- simplify shapes
- enforce hard pixel edges where needed
- clean character silhouette
- ensure expression readability
- reduce stray colors
- align objects to pixel grid
- check mobile-scale readability
```

Tools:

```text
Aseprite preferred
LibreSprite / Pixelorama acceptable
Krita/Photoshop only for rough paint or palette work
```

### Step 5. Animation Frame Pass

Create minimal loops first.

Required MVP loops:

```text
blink: 2-3 frames
focus writing: 4-6 frames
pen down: 3-5 frames
cup sip: 4-6 frames
cup put down: 3-4 frames
look up: 3-5 frames
sleep/rest idle: 2-4 frames subtle breathing
object sparkle: 4-8 frames
```

Animation principle:

```text
timing > frame count
small pause > constant motion
subtle > flashy
```

### Step 6. Lighting / Atmosphere Pass

Lighting must be authored as separate layers, not baked randomly into every asset.

Layer model:

```text
base_room
warm_desk_light_mask
cool_window_light_mask
neon_sign_pixels
screen_glow_pixels
weather_overlay
ambient_particles
screen_dim_overlay
```

Rules:

```text
- Use pixel clusters to imply glow.
- Avoid large smooth blur.
- Keep light masks low-resolution and pixel-aligned.
- Separate day/night/weather variants from core room geometry.
- Character should receive small rim/highlight pixels depending on scene light.
```

Lighting variants:

```text
focus: steady desk light, BGM normal
break: warmer desk light, ambience up
event: dim room + focused character/object highlight
night rain: cool window light + neon reflection
late night: fewer city lights + stronger desk lamp
```

### Step 7. Export for Mobile / Skia

Export assets as PNG/WebP with transparent backgrounds where appropriate.

Recommended export structure:

```text
assets/sprites/character/companion_focus_writing.png
assets/sprites/character/companion_pen_down.png
assets/sprites/character/companion_cup_sip.png
assets/backgrounds/room/main_room_base.png
assets/backgrounds/room/window_night.png
assets/backgrounds/room/window_late_night.png
assets/overlays/weather/rain_overlay.png
assets/overlays/light/warm_desk_light.png
assets/objects/room/coffee_cup.png
assets/objects/room/wall_plaque.png
assets/ui/planner/planner_open.png
assets/ui/timer/desk_timer.png
assets/ui/audio/pixel_player.png
```

Rules:

```text
- Keep transparent PNG for sprites/objects.
- Keep background layers separate when they animate or vary by state.
- Use nearest-neighbor scaling in-app.
- Do not rely on CSS-like blur for pixel lighting.
```

### Step 8. In-App Asset Registration

Every asset should have metadata.

Example:

```ts
export type PixelAsset = {
  key: string;
  path: string;
  width: number;
  height: number;
  scale: number;
  anchor: { x: number; y: number };
  tags: string[];
};
```

Room object example:

```ts
export type RoomObjectAsset = PixelAsset & {
  slot: 'desk' | 'wall' | 'shelf' | 'window' | 'floor';
  unlockedByEventId: string;
  defaultVisible: boolean;
};
```

---

## 4. Lighting Workflow Detail

Lighting is not a post-processing afterthought. It is an authored part of the asset pipeline.

### Light Sources

MVP light sources:

```text
1. desk lamp / laptop warm light
2. window/city cool light
3. neon sign pink/blue highlight
4. weather reflection: rain/snow/night
5. event spotlight/dim overlay
```

### Pixelated Glow Technique

Use bands of pixel clusters:

```text
core bright pixel
near color cluster
mid color cluster
sparse outer pixels
```

Example for neon pink:

```text
#ffd1f0 core
#ff6fae near
#b94c9b mid
#5a2b68 sparse outer
```

Do not use giant smooth blur as the main effect. If a subtle native blur is used, it should be secondary and low opacity.

### Scene Lighting States

```ts
export type LightingMood =
  | 'focus_steady'
  | 'break_warm'
  | 'event_dim'
  | 'rain_neon'
  | 'late_night_quiet'
  | 'morning_soft';
```

Each mood controls:

```text
- overlay opacity
- particle density
- character highlight variant
- BGM/ambience balance
- UI accent color
```

---

## 5. Pixel Art QA Checklist

Before an asset is accepted:

```text
[ ] Looks readable at actual phone size
[ ] Uses project palette groups
[ ] No uncontrolled AI noise
[ ] Pixel edges are intentional
[ ] Transparent edges are clean
[ ] Animation loops without visible jump
[ ] Lighting variant works in focus and break modes
[ ] Does not make dialogue text unreadable
[ ] Export path follows asset convention
[ ] Metadata added to asset registry
```

For character animation:

```text
[ ] Focus loop feels calm, not distracting
[ ] Break transition includes pen down / sip / look up
[ ] Sleep/window idle does not invite more dialogue
[ ] Expression change is readable on mobile
```

For lighting:

```text
[ ] Brightness is sufficient on phone screen
[ ] Neon is pixelated, not glossy blur
[ ] Warm/cool contrast supports mood
[ ] Weather overlay does not obscure character
```

---

## 6. Agent Workflow

### Art Direction Agent

Inputs:

```text
product-definition.md
frontend-mobile-technical-direction.md
this workflow
reference image
```

Outputs:

```text
style board
palette proposal
asset list
first room composition brief
```

### Pixel Asset Agent

Outputs:

```text
rough pixel asset
manual cleanup notes
exported PNG/WebP
metadata entry
```

### Lighting Agent

Outputs:

```text
lighting layer plan
Skia lighting state mapping
weather/time variant plan
```

### Frontend Agent

Outputs:

```text
Skia layer renderer
asset registry
scene state integration
mobile visual verification screenshots
```

---

## 7. First Implementation Slice

The first slice should prove the visual pipeline, not build every asset.

Required:

```text
1. One base room background placeholder
2. One character sprite placeholder
3. Focus writing loop placeholder
4. Pen down + cup sip transition placeholder
5. Warm break lighting overlay
6. Rain/neon window overlay placeholder
7. One room object unlock placeholder
```

Acceptance:

```text
On a mobile portrait screen, focus → break transition feels like a scene, not a UI toggle.
```
