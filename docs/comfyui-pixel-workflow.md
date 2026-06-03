# ComfyUI Pixel Art Workflow — Lofi Study Companion

## 0. 결론

ComfyUI는 Lofi Study Companion의 pixel art workflow를 만들기에 적합하다. 특히 다음 작업에 강하다.

```text
- 같은 캐릭터/방 분위기의 반복 생성
- 시간대/날씨/조명 variant 생성
- reference image 기반 img2img refinement
- ControlNet/IP-Adapter 기반 구도/캐릭터 일관성 유지
- lighting pass / mood pass 분리
- asset 후보 batch generation
```

하지만 ComfyUI output을 그대로 최종 asset으로 쓰면 안 된다.

최종 원칙:

```text
ComfyUI = rough concept + variant + lighting pass generator
Pixel cleanup tool = final pixel art authority
React Native Skia = runtime lighting/composition/animation authority
```

---

## 1. 우리가 원하는 workflow

목표는 “그럴듯한 이미지 한 장”이 아니라 반복 가능한 production workflow다.

```text
1. Character reference 고정
2. Room composition 고정
3. Palette / lighting style 고정
4. Time/weather variants 생성
5. Pose/expression variants 생성
6. Pixel cleanup
7. Sprite sheet / layer export
8. App asset registry 등록
9. Mobile screen verification
```

---

## 2. 추천 ComfyUI 파이프라인

### Workflow A. Room Concept / Background

용도:

```text
main study room
rainy night room
morning room
late night room
```

권장 노드 구성:

```text
Checkpoint / Flux or SDXL model
CLIP Text Encode positive/negative
ControlNet Depth or Lineart optional
KSampler
VAE Decode
Color correction
Pixel-art stylization pass or external pixel cleanup
Save Image
```

Prompt 방향:

```text
mobile portrait pixel art study room, 32-bit inspired, lofi neon cafe, dark navy and purple, warm desk lamp, cool city window light, pink neon highlights, cozy desk, planner notebook, small digital timer, headphones, mug, cat, clean pixel outlines, readable mobile composition
```

Negative 방향:

```text
photorealistic, smooth 3d render, glossy SaaS UI, blurry, noisy, excessive detail, unreadable text, malformed hands, low contrast, muddy colors
```

### Workflow B. Character Reference / Sprite Draft

용도:

```text
base companion design
expression variants
focus pose
break pose
cup sip pose
sleep/window idle pose
```

권장 구성:

```text
Character reference image
IP-Adapter or reference adapter
OpenPose / pose guide optional
KSampler img2img
Expression prompt variation
Save Image batch
```

중요:

```text
캐릭터는 매번 새로 생성하면 안 된다.
먼저 canonical character reference를 만든 뒤, 모든 pose/expression은 reference adapter로 고정한다.
```

### Workflow C. Lighting / Weather Variant

용도:

```text
rain overlay reference
snow overlay reference
night neon reflection
break warm lighting
event dim lighting
```

권장 구성:

```text
base room image
img2img with low denoise
lighting prompt
ControlNet line/depth to preserve composition
batch seeds for variants
```

Denoise guideline:

```text
0.20~0.35: composition 유지, lighting만 변경
0.35~0.50: mood variation 허용
0.50 이상: 구조가 흔들릴 수 있음, MVP asset에는 위험
```

### Workflow D. Object Unlock Asset Draft

용도:

```text
coffee cup
wall plaque
framed memory
study stamp card
companion note
seat marker
small lamp
```

권장 방식:

```text
transparent-background object generation
or crop from room variant
then manual cleanup to transparent PNG
```

최종 앱에서는 object가 별도 layer여야 한다.

---

## 3. Pixel Art에서 ComfyUI가 부족한 부분

ComfyUI는 pixel 느낌을 만들 수 있지만, 진짜 production pixel asset에는 다음 문제가 자주 생긴다.

```text
- 픽셀 그리드가 일정하지 않음
- anti-aliasing/noise가 많음
- 색 수가 통제되지 않음
- 작은 모바일 화면에서 표정이 뭉개짐
- sprite frame 간 형태가 흔들림
- 투명 배경 edge cleanup이 필요함
- text/UI를 이미지에 직접 생성하면 깨짐
```

그래서 final pass가 필요하다.

```text
ComfyUI output
→ palette reduction
→ grid alignment
→ manual cleanup
→ sprite sheet construction
→ mobile preview
```

---

## 4. 조명 효과 강화 방법

조명은 ComfyUI에서 완전히 bake하지 말고, 세 단계로 나눈다.

### 1. Concept Lighting

ComfyUI로 mood reference 생성.

```text
warm desk lamp
cool rainy window
pink neon sign
late night dim room
morning soft light
```

### 2. Asset Lighting Layers

수동/후처리로 분리 export.

```text
warm_desk_light_mask.png
cool_window_light_mask.png
neon_reflection_pixels.png
rain_overlay.png
event_dim_overlay.png
```

### 3. Runtime Lighting

React Native Skia에서 opacity/blend/tint를 조절.

```ts
export type LightingMood =
  | 'focus_steady'
  | 'break_warm'
  | 'event_dim'
  | 'rain_neon'
  | 'late_night_quiet'
  | 'morning_soft';
```

이렇게 해야 focus→break, break→event 전이가 자연스럽다.

핵심:

```text
ComfyUI는 lighting direction을 만든다.
앱에서는 layer opacity와 particle로 살아 움직이게 만든다.
```

---

## 5. ComfyUI Workflow 파일로 만들 것

나중에 실제 workflow JSON을 만들 때는 최소 4개로 나눈다.

```text
workflows/comfy/room_concept_sdxl_or_flux.json
workflows/comfy/character_reference_pose.json
workflows/comfy/lighting_weather_variant_img2img.json
workflows/comfy/object_unlock_asset.json
```

각 workflow는 parameter injection이 가능해야 한다.

예:

```json
{
  "prompt_subject": "night lofi study room",
  "time_of_day": "late_night",
  "weather": "rain",
  "lighting_mood": "rain_neon",
  "seed": -1,
  "denoise": 0.3
}
```

---

## 6. Batch Generation Strategy

한 번에 정답을 뽑으려 하지 말고 batch로 후보를 만든다.

```text
room concept: 8~16 variants
character base: 8 variants
expression/pose: chosen character 기준 4~8 variants each
lighting/weather: base room 기준 4 variants each
object unlock: 8 variants per object
```

선별 기준:

```text
1. 모바일 portrait에서 읽히는가
2. 캐릭터/방이 다시 보고 싶은가
3. 조명 대비가 좋은가
4. pixel cleanup 비용이 낮은가
5. 다른 asset과 palette가 맞는가
```

---

## 7. Agent가 쓸 프롬프트 템플릿

### Room prompt

```text
A mobile portrait 32-bit inspired pixel art lofi study room, cozy night cafe desk, one study companion space, dark navy and deep purple room, warm amber desk lamp, cool blue city window light, pink neon highlights, planner notebook, small digital pomodoro timer, mug with steam, small cat, readable simple composition for mobile app, clean pixel outlines, pixelated neon clusters, intimate Coffee Talk mood, Study With Me ambience
```

### Character prompt

```text
A calm pixel art study companion character, headphones, cozy casual outfit, warm but quiet expression, sitting at a desk studying, 32-bit inspired clean pixel sprite style, readable face, subtle expression, lofi cafe mood, not a tutor, not overly cheerful, gentle presence
```

### Lighting prompt

```text
same room composition, rainy late night lighting, cool blue window light, pink neon reflection, warm desk lamp, pixelated glow clusters, cozy but bright, mobile readable, no smooth blur, no photorealism
```

---

## 8. Acceptance Criteria

ComfyUI workflow is acceptable only if it produces assets that can pass this downstream process.

```text
[ ] Same character can be regenerated with recognizable identity
[ ] Same room composition can produce time/weather variants
[ ] Lighting variants preserve object placement
[ ] Output is clean enough for pixel cleanup
[ ] Mobile portrait readability is good
[ ] Assets can be separated into background/character/object/overlay layers
[ ] No generated text is required inside image assets
[ ] Final app still uses Skia layers for runtime transitions
```

---

## 9. Bottom Line

Yes, ComfyUI can create the proper workflow, but only if we treat it as a controlled asset pipeline, not a magic final renderer.

Best workflow:

```text
ComfyUI for consistent roughs, variants, lighting references
+ Aseprite/manual cleanup for final pixel assets
+ React Native Skia for runtime scene composition and lighting transitions
```
