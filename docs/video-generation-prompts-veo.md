# Veo Video Generation Prompts — Lofi Study Companion

## 0. Veo용 작성 원칙

Veo에는 ComfyUI/Wan식 태그 나열보다, 짧은 광고 콘티나 애니메이션 디렉션처럼 쓰는 편이 좋다.

권장 형식:

```text
Format / duration / camera
Scene description
Character action
Lighting and mood
UI / mobile framing
Motion constraints
What to avoid
```

공통 조건:

```text
vertical 9:16 mobile video
5–8 seconds
locked camera or very slow push-in
clean pixel art, 16-bit to 32-bit feel
cozy lofi study room
warm desk lamp + cool rainy window light
subtle loopable motion
no readable generated text
no modern chat app UI
```

---

## 1. Main Veo Prompt — Focus to Break Transition

```text
Create a vertical 9:16 mobile video, about 8 seconds long, in a clean 16-bit to 32-bit pixel art style.

The scene is a cozy lofi study room at night, framed like a mobile companion app. A soft warm desk lamp lights a notebook, a small desk timer, and a cup of tea. Outside the window, rain falls over a quiet neon city, casting cool blue and pink reflections into the room.

A study companion character is sitting at the desk, quietly studying beside the viewer. At the beginning, the character is writing in a notebook with very small, calm movements. The desk timer softly reaches zero. The character slowly stops writing, puts the pen down, waits for a short quiet pause, picks up the tea cup, takes one gentle sip, places the cup back on the desk, then looks up toward the viewer as if about to start a short break conversation.

As the character transitions into break mode, the room lighting becomes slightly warmer and more intimate. The rain outside becomes a little more visible. Near the end, a pixel visual-novel-style dialogue box begins to appear at the bottom with a soft pixel wipe, but do not show readable text.

The feeling should be intimate, quiet, and emotionally warm, like Coffee Talk or VA-11 Hall-A mixed with a Study With Me video. The motion should be subtle and loopable, not cinematic or dramatic. Keep the camera locked, with no fast cuts, no big zooms, and no action. The UI should feel like objects in the room, not like a modern productivity app.

Avoid realism, 3D rendering, anime splash effects, messenger chat bubbles, reward coins, achievement popups, confetti, large readable text, watermarks, distorted faces, distorted hands, excessive particles, or inconsistent pixel scale.
```

### Korean Direction Memo

```text
핵심은 “타이머 종료 → 펜 내려놓기 → 잠깐의 여백 → 차 한 모금 → 고개 들기 → 대화창 시작”이다.
대화창은 바로 뜨면 안 되고, 캐릭터의 행동이 먼저 있어야 한다.
```

---

## 2. Veo Prompt — Break Reward Dialogue Opener

```text
Create a vertical 9:16 mobile pixel art video, 6 to 8 seconds long.

A cozy rainy-night study room is shown from a fixed mobile portrait composition. The style is clean 16-bit to 32-bit pixel art with soft neon colors, warm desk lighting, and cool rain light from the window.

The companion character has just finished a focus session. They are no longer writing. They hold a warm cup of tea with both hands, glance quietly toward the rainy window, then turn back toward the viewer with a small tired smile. Their movement is tiny and natural: a blink, a small shoulder relaxation, a slow breath, and a soft head turn.

A pixel visual-novel dialogue box gently appears at the bottom of the screen with a step-like pixel wipe. The dialogue box should feel cozy and tactile, but it should not contain readable words, only abstract pixel marks or empty space.

The mood is a short reward conversation after studying, not an infinite AI chat. It should feel like a friend gently saying, “you worked hard,” without showing actual text. Keep the camera locked, the animation subtle, and the atmosphere calm.

Avoid modern chat bubbles, phone messenger UI, productivity dashboards, big reward animations, coins, stars, confetti, readable text, photorealism, 3D, fast motion, shaky camera, or exaggerated anime reactions.
```

---

## 3. Veo Prompt — Break Idle After Dialogue Ends

```text
Create a vertical 9:16 mobile video in clean cozy pixel art, around 7 seconds long.

The scene shows the same lofi study room after a short break conversation has ended. The dialogue box is gone. The companion character is resting quietly instead of talking. They sit near the desk, slowly looking out the rainy window while holding a cup of tea. Their expression is calm and a little sleepy.

On the desk, a small pixel notebook and a desk timer are visible, suggesting the user can now plan the next study session. The notebook and timer should feel like physical desk objects, not app widgets. The companion should not actively talk. They are taking their own break: blinking slowly, breathing softly, maybe leaning slightly toward the window.

Use warm amber desk light, cool blue rain light, and soft pink neon reflections. The motion should be very gentle and loopable: rain moving outside, tiny cup steam, subtle breathing, and occasional blinking.

The emotional feeling is quiet, restful, and slightly rewarding. The conversation is intentionally over, and now the user has space to organize notes, todos, and the next timer.

Avoid active dialogue, chat UI, notifications, productivity dashboards, calendar screens, reward badges, achievement popups, coins, confetti, readable text, realism, 3D rendering, camera shake, or busy animation.
```

---

## 4. Veo Prompt — Pixel Planner Note and Timer Setup

```text
Create a vertical 9:16 mobile pixel art video, about 8 seconds long.

The camera shows a cozy study desk inside a lofi pixel room. A small notebook lies on the desk like a study planner, next to a small digital desk timer and a warm cup of tea. The companion character rests quietly in the background near the rainy window, not talking.

The notebook opens with a small pixel page-flip animation. The page shows simple todo lines and check boxes, but the text should not be readable. A check mark is stamped onto one todo line with a tiny satisfying pixel stamp effect. Then the small desk timer is adjusted, its pixel LCD glow changing softly, as if the user is setting the next focus session.

The UI should feel integrated into the physical room: the notebook is the todo list, and the desk timer is the pomodoro timer. It should not look like a modern productivity app or a flat settings screen. Keep the composition mobile-first, cozy, tactile, and readable on a phone.

Use warm desk light, rainy blue window light, soft neon reflections, and subtle pixel animation. Keep the camera fixed. Motion should be calm and tactile: page flip, tiny stamp, timer glow, cup steam, rain outside.

Avoid modern app dashboards, white UI panels, keyboard close-ups, readable generated text, corporate productivity software, 3D rendering, realism, confetti, achievement popups, coins, distorted hands, or watermarks.
```

---

## 5. Veo Prompt — Lighting Test: Focus Mode to Break Mode

```text
Create a vertical 9:16 pixel art video, 6 to 8 seconds long, focused on lighting transition.

The scene is a cozy lofi study room at rainy night. The camera is locked in a mobile portrait composition. A companion character sits at a desk. At first, the room is in focus mode: steady, slightly dim, with a warm desk lamp and a quiet cool window light.

Over the video, the focus session ends and the room gently transitions into break mode. The warm desk lamp becomes a little softer and stronger. The cool rain light from the window becomes more visible. Pink neon reflections on the desk edge become slightly clearer. The character stops writing, relaxes their shoulders, and takes a slow breath.

The transition should be subtle, not magical. The viewer should feel that the room has become more open to conversation, but nothing dramatic happens. Pixel rain outside the window, tiny cup steam, and a slight lamp glow shift are enough.

Use clean 16-bit to 32-bit pixel art, controlled colors, cozy lofi atmosphere, no readable text, no camera shake, no dramatic effects.

Avoid photorealistic lighting, 3D ray tracing, heavy bloom, fantasy magic, big particles, confetti, achievement effects, modern UI panels, text, logos, or watermarks.
```

---

## 6. Veo Prompt — Story Trace Object Event

```text
Create a vertical 9:16 mobile pixel art video, about 8 seconds long.

The scene is a cozy rainy-night study room after a quiet companion story moment. A companion character sits at the desk, looking slightly shy and tired. They gently place a tiny memo on the desk near the notebook. The memo is a story trace object, not a reward badge.

The memo appears with only a few subtle pixel sparkles, very small and emotional, not celebratory. The character glances at the memo, then looks out toward the rainy window as if the moment was personal. The room remains calm and intimate, with warm desk light, cool rain light, and soft neon reflections.

The video should feel like the user learned something small about the character, not like they unlocked a game reward. Keep the camera locked, motion subtle, and composition mobile-first. No readable text is needed on the memo.

Avoid achievement unlocked popups, badges, coins, fireworks, confetti, big celebration, readable generated text, modern app UI, photorealism, 3D rendering, exaggerated anime acting, watermarks, or noisy pixel artifacts.
```

---

## 7. Super Short Veo Prompt

첫 테스트에서 긴 prompt가 과하게 해석되면 아래처럼 줄여서 사용한다.

```text
Vertical 9:16 mobile video in clean 16-bit/32-bit pixel art. A cozy rainy-night lofi study room with warm desk lamp, cool neon window light, notebook, desk timer, and tea cup. A study companion character finishes a focus session: they stop writing, put down the pen, pause, take a gentle sip of tea, then look up toward the viewer. A pixel visual-novel dialogue box softly begins to appear at the bottom, with no readable text. Locked camera, subtle loopable motion, intimate Coffee Talk / VA-11 Hall-A mood. Avoid realism, 3D, chat bubbles, productivity dashboard UI, achievement popups, coins, confetti, readable text, watermarks, distorted hands or faces.
```

---

## 8. Veo 테스트 우선순위

1차 테스트:

```text
Main Veo Prompt — Focus to Break Transition
```

2차 테스트:

```text
Break Idle After Dialogue Ends
Pixel Planner Note and Timer Setup
```

3차 테스트:

```text
Lighting Test
Story Trace Object Event
```

판정 기준:

```text
- 9:16 모바일 화면에서 캐릭터와 책상 UI가 읽히는가?
- 캐릭터가 대화 전에 먼저 행동하는가?
- 펜 내려놓기 / 차 마시기 / 고개 들기가 자연스러운가?
- 대화가 보상처럼 짧게 느껴지는가?
- Todo/Timer가 앱 위젯이 아니라 책상 오브젝트처럼 느껴지는가?
- 조명이 focus와 break의 감정 차이를 만드는가?
```
