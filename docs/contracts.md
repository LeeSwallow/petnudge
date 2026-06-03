# Study Companion Contracts Draft

This file is the first contract boundary for FE/BE/AI parallel development.

## SessionState

```json
{
  "sessionId": "sess_123",
  "status": "idle",
  "timer": {
    "mode": "focus",
    "durationSeconds": 1500,
    "remainingSeconds": 1500,
    "startedAt": null
  },
  "tasks": [
    {
      "id": "task_1",
      "title": "Read chapter 1",
      "status": "todo"
    }
  ],
  "companion": {
    "state": "idle",
    "mood": "calm",
    "message": "오늘 첫 세션만 같이 시작해보자."
  },
  "rewards": {
    "exp": 0,
    "streakDays": 0,
    "unlocks": []
  },
  "coffeeChat": {
    "enabled": false,
    "lastResponse": null
  }
}
```

Allowed `status`: `idle`, `focus`, `break`, `completed`

Allowed task status: `todo`, `doing`, `done`, `skipped`

Allowed companion state: `idle`, `focus`, `break`, `celebrate`

## API draft

| Method | Path | Owner | Purpose |
|---|---|---|---|
| POST | `/sessions` | BE | Create a study session |
| GET | `/sessions/{id}` | BE | Read session state |
| PATCH | `/sessions/{id}/tasks/{taskId}` | BE | Update a task |
| POST | `/sessions/{id}/start-focus` | BE | Enter focus state |
| POST | `/sessions/{id}/complete-focus` | BE | Complete focus, update rewards, enter break |
| POST | `/sessions/{id}/coffee-chat` | BE+AI | Generate break-only Coffee Chat |

## AI output schema

```json
{
  "reflection_question": "방금 세션에서 가장 잘 된 점 하나만 고르면 뭐야?",
  "encouragement": "좋아, 첫 세션을 끝낸 것만으로도 루틴이 시작됐어.",
  "next_action": "다음 세션은 남은 문제 3개만 목표로 잡자.",
  "risk": "none"
}
```

Rules:

- Coffee Chat can be requested only when `SessionState.status == "break"`.
- AI output must be short: max 2 user-visible sentences plus one next action.
- AI must not mutate rewards/session state directly.
- If AI fails, BE returns a degraded deterministic message and marks the response as fallback.

## Event draft

```json
{
  "type": "SESSION_UPDATED",
  "sessionId": "sess_123",
  "payload": {
    "status": "break"
  }
}
```

Allowed event types:

- `SESSION_UPDATED`
- `TASK_UPDATED`
- `REWARD_UNLOCKED`
- `COFFEE_CHAT_READY`
- `AI_FALLBACK_USED`
