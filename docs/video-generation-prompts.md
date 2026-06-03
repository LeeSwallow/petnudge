# Video Generation Prompts — Lofi Study Companion

## 0. 목적

이 문서는 Lofi Study Companion의 모바일 vertical slice 감성을 검증하기 위한 영상 생성 프롬프트 모음이다.

목표는 실제 최종 asset이 아니라 다음 감각을 확인하는 것이다.

```text
- 모바일 portrait 화면에서 읽히는 pixel study room
- focus → break → reward dialogue로 이어지는 자연스러운 장면 전이
- 캐릭터의 사소한 움직임: 펜 내려놓기, 차 마시기, 고개 들기, 창밖 보기
- warm desk light / rain neon / quiet night lighting
- UI가 앱 위젯이 아니라 노트/타이머/대화창으로 느껴지는지
```

권장 생성 조건:

```text
aspect ratio: 9:16 vertical
length: 5–8 seconds per shot
style: clean 16-bit / 32-bit pixel art, bright neon, cozy lofi study room
camera: locked-off or very slow push-in
motion: subtle, loopable, not cinematic action
```

---

## 1. Core Prompt — Focus to Break Transition

### Positive Prompt

```text
A cozy mobile vertical pixel art study room, 16-bit to 32-bit clean pixel style, bright but soft neon colors, warm desk lamp, rainy night window, lofi cafe atmosphere. A young study companion character sits at a desk quietly studying beside the user, writing in a notebook. The focus timer reaches zero. The character slowly puts down the pen, pauses for a moment, picks up a small cup of tea, takes one quiet sip, then gently looks up toward the viewer as if about to start a short break conversation. Warm desk light becomes slightly stronger, rain ambience visible outside the window, subtle pixel particles, tiny steam from the cup, soft neon reflections on the desk. Mobile game UI feeling, not a productivity app. Natural transition from study focus to cozy break dialogue. Locked camera, very subtle animation, loopable, emotional and intimate, Coffee Talk and VA-11 Hall-A inspired mood, pixel visual novel atmosphere.
```

### Negative Prompt

```text
realistic, 3d render, anime high detail, cinematic camera shake, fast motion, action scene, dramatic zoom, modern flat productivity app UI, chat bubble messenger interface, cluttered screen, unreadable text, large popups, achievement badge, reward coins, gamified fireworks, excessive particles, ugly UI, blurry pixels, inconsistent pixel grid, noisy artifacts, deformed hands, distorted face, extra limbs, text gibberish, watermark, logo
```

### Motion Notes

```text
0.0s–1.0s: character still writing, timer glow softens
1.0s–2.0s: pen goes down
2.0s–3.0s: quiet pause, BGM implied to duck
3.0s–4.5s: character raises cup and drinks tea
4.5s–5.5s: cup returns to desk
5.5s–6.5s: character looks up toward viewer
6.5s–8.0s: bottom dialogue box begins appearing with pixel wipe, no readable text required
```

---

## 2. Break Reward Dialogue Opener

### Positive Prompt

```text
Vertical mobile pixel art visual novel scene inside a cozy lofi study room at night. The companion character has just finished studying and is now in break mode. They hold a warm cup of tea with both hands, briefly look out the rainy window, then turn softly toward the viewer with a small tired smile. A pixel-style dialogue box gently wipes in from the bottom of the screen, but the text is abstract pixel marks, not readable words. Warm amber desk light, cool blue rain light from the window, soft neon city reflection, tiny cup steam animation. The mood is quiet, intimate, low-stakes, like a friend starting a short reward conversation after a focus session. Clean pixel art, mobile portrait composition, locked camera, subtle loopable motion.
```

### Negative Prompt

```text
speech bubbles, smartphone messenger UI, realistic human, 3d, loud emotion, exaggerated anime reaction, fast mouth flapping, big reward animation, coins, stars explosion, achievement unlocked text, clutter, hard to read layout, camera spin, shaky camera, bad pixel grid, artifacts, watermark
```

---

## 3. Break Idle After Dialogue Ends

### Positive Prompt

```text
A cozy vertical pixel art lofi study room after a short break conversation has ended. The companion character is no longer talking. They quietly rest near the desk, looking out the rainy window while holding a cup of tea. The bottom area shows a small pixel notebook and desk timer ready for the user to plan the next study session, but there is no active dialogue. The atmosphere feels calm and slightly rewarding, but conversation is intentionally over. Warm desk lamp, cool rainy window light, soft neon, subtle breathing animation, steam from cup, rain droplets on window, very gentle idle motion. Mobile portrait layout, clean 16-bit / 32-bit pixel art, intimate Study With Me companion mood.
```

### Negative Prompt

```text
active chat conversation, infinite dialogue, notification spam, productivity dashboard, calendar app, spreadsheet, reward coins, badge page, loud celebration, excessive UI, realistic rendering, 3d render, busy animation, camera movement, blurry, distorted, watermark
```

---

## 4. Pixel Planner Note + Desk Timer Setup

### Positive Prompt

```text
Vertical mobile pixel art scene of a cozy study desk. A small pixel notebook opens like a study planner, pages gently flip, showing simple todo lines and check boxes as abstract pixel marks, not readable text. Beside it is a small digital desk timer with pixel LCD numbers glowing softly. A companion character rests quietly in the background, looking out the window and not talking. The user is preparing the next focus session: checking a todo with a stamp-like pixel mark, adjusting the timer dial, then the timer glows ready to start. Warm desk light, rain outside, soft neon highlights, mobile game UI integrated into the physical desk objects. Subtle, tactile, cozy, not a generic productivity app.
```

### Negative Prompt

```text
modern todo app, flat material design, white dashboard, readable generated text, keyboard typing close-up, cluttered UI, corporate productivity software, 3d render, realism, fast cuts, dramatic motion, achievement popups, coins, confetti, bad hands, deformed fingers, watermark
```

---

## 5. Lighting Variant — Rain Neon Break

### Positive Prompt

```text
A vertical 9:16 pixel art lofi study room with a rainy night window and soft neon city lights. The room has layered lighting: warm amber desk lamp on the notebook and tea cup, cool blue rain light from the window, faint pink neon reflection on the desk edge. A study companion character sits quietly at the desk in break idle, slowly blinking and breathing, occasionally glancing toward the window. The lighting gently shifts from focus mode to break mode, making the desk warmer and the window rain more visible. Clean pixel art, controlled palette, cozy mobile companion app mood, subtle loopable animation.
```

### Negative Prompt

```text
realistic lighting, 3d raytracing, photoreal, overexposed bloom, harsh contrast, muddy colors, noisy pixels, inconsistent pixel scale, dramatic fantasy magic, camera shake, text, logo, watermark, UI clutter
```

---

## 6. Event Teaser — Story Trace Object Appears

### Positive Prompt

```text
Vertical mobile pixel art study room during a small companion story event. The companion character leaves a tiny handwritten memo on the desk after a quiet night study session. The memo appears as a small story trace object, not a reward badge. The character looks slightly shy and tired, then turns back toward the rain outside. A gentle sparkle of only a few pixels appears around the memo, very subtle and emotional. Warm desk light, rainy neon window, Coffee Talk inspired intimate visual novel mood, no large celebration, no achievement UI. Clean 16-bit / 32-bit pixel art, locked camera, slow subtle animation.
```

### Negative Prompt

```text
achievement unlocked, reward badge, coins, fireworks, big popup, game loot, loud celebration, readable fake text, realistic, 3d, anime action, exaggerated expression, cluttered UI, bad pixel art, noisy, watermark
```

---

## 7. Short Model-Specific Prompt Format

### Wan / Hunyuan style compact prompt

```text
9:16 vertical mobile pixel art video, cozy lofi study room at rainy night, warm desk lamp and cool neon window light, study companion at desk. Focus timer ends, character puts down pen, pauses, drinks tea, looks up gently, bottom pixel dialogue box starts to appear. Clean 16-bit/32-bit pixel art, subtle loopable animation, locked camera, intimate Coffee Talk / VA-11 Hall-A mood, no readable text, no chat app UI.
```

### Compact negative

```text
realistic, 3d, fast motion, camera shake, productivity dashboard, messenger bubbles, achievement popup, coins, confetti, unreadable text, watermark, noisy pixels, inconsistent pixel grid, distorted face, bad hands
```

---

## 8. 프롬프트 선택 기준

첫 영상 테스트는 `1. Core Prompt — Focus to Break Transition`을 추천한다.

이유:

```text
- 제품의 핵심 감성인 focus → break 전이를 검증할 수 있다.
- 펜 내려놓기 / 차 마시기 / 고개 들기 / dialogue box 등장까지 포함한다.
- 실제 앱 구현의 ScenePhase와 가장 직접적으로 연결된다.
```

만약 모델이 움직임을 잘 못 잡으면 짧게 쪼갠다.

```text
Shot A: writing → pen down
Shot B: cup sip → look up
Shot C: dialogue box appears
```

ComfyUI/영상 모델에서 중요한 것은 한 번에 완벽한 긴 영상을 만들려는 것이 아니라, 앱에서 필요한 micro-animation reference를 shot 단위로 뽑는 것이다.
