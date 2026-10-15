# 캐릭터 편집 가이드

캐릭터는 폴더 하나에 두 파일로 이루어져 있어요.

| 파일 | 하는 일 |
| --- | --- |
| `lila/lila.aseprite`, `moa/moa.pxo` | 그림. 부위마다 레이어 하나 (원본). Aseprite(.aseprite)와 Pixelorama(.pxo) 둘 다 돼요 |
| `lila/lila.pack.json` | 그리는 순서, 움직임, 표정, 의상 슬롯, 상호작용 |
| `lila/character.json`, `lila/sheet.png` | 앱이 읽는 결과물. 직접 고치지 않아요 |

## 작업 순서

1. 터미널에서 `apps/desktop`으로 들어가 두 개를 켜둬요.
   - `npm start`: 앱 실행
   - `npm run watch:character`: 저장할 때마다 자동으로 내보내기
2. Aseprite에서 `lila.aseprite`를 열고 고친 뒤 저장해요 (⌘S).
3. 내보내기 창에 `✓ … 레이어 N개`가 뜨고, 실행 중인 펫이 바로 바뀌어요.
   문제가 있으면 `✗`로 이유를 알려주고, 앱은 이전 그림을 그대로 써요.

한 번만 내보내려면 `npm run build:character`를 실행해요. 다른 캐릭터는 `node scripts/build-character.mjs moa`처럼 ID를 줘요.

### 원본 형식 (Aseprite / Pixelorama)

- 팩의 `"source"`가 원본 파일을 정해요. 없으면 `<id>.aseprite`, 그다음 `<id>.pxo`를 찾아요.
- `.aseprite`는 Aseprite 명령줄로, `.pxo`는 파일을 직접 읽어서 내보내요 (Pixelorama 설치 없이도 돼요).
- 바꾸기: `node scripts/build-character.mjs lila --to-pxo`로 `lila.pxo`를 만들고 팩에 `"source": "lila.pxo"`를 적어요.
- Pixelorama는 RGBA 색 모드로 저장해요. 레이어 이름 규칙과 그룹은 Aseprite와 같아요.
- 앱 설정의 "원본 편집"은 그 파일을 기본 앱(Aseprite 또는 Pixelorama)으로 열어요.

## 펫 미리보기 (Aseprite 스크립트)

`File > Scripts > 펫 미리보기`를 실행하면 창이 떠요. 처음 한 번은
`File > Scripts > Rescan Scripts Folder`를 눌러야 목록에 보여요.

- **앱처럼 보기**: 고른 표정·고개 방향·자세·의상 조합을 앱과 같은 규칙으로 켜요.
  "웃는 얼굴로 왼쪽을 볼 때 눈"처럼 실제 상황을 띄워놓고 고칠 수 있어요.
- **선택 레이어만**: 지금 선택한 레이어 하나만 보여요.
- **모두 보기**: 모든 레이어를 켜요.

레이어를 켜고 끄는 것은 앱 결과에 영향이 없어요. 숨긴 레이어도 모두 내보내요.

## 레이어 이름 규칙

레이어 이름이 곧 앱이 그리는 칸의 이름이에요. 그룹(폴더)은 정리용이라 이름에 넣지 않아요.

```
<부위>[.<변형>][@<고개 방향>][#<자세>]
```

| 예시 | 뜻 |
| --- | --- |
| `hair.front` | 앞머리 |
| `hair.front@turnL` | 고개를 왼쪽으로 돌렸을 때의 앞머리 |
| `outer.jacket` | 아우터 슬롯의 `jacket` 변형 |
| `outer.jacket#stretch` | 기지개 자세일 때의 재킷 |
| `eye.L.smile` | 왼쪽 눈(화면 기준)의 `smile` 표정 |
| `socket.L.open` | 홍채가 움직일 수 있는 흰자 영역 (마스크, 그려지지 않아요) |
| `pose.stretch` | 기지개 자세 전체 그림 (몸 부위 레이어 대신 그려져요) |

- 좌우 `L`/`R`은 **화면 기준**이에요. `eye.L`은 화면 왼쪽 눈이에요.
- 방향 변형이 없으면 정면 그림을 그대로 써요. 정면과 같다면 만들 필요가 없어요.
- 비어 있는 레이어도 의미가 있어요. `nose.open@turnR`를 비워두면 그 방향에서는 코를 안 그려요.
- 캔버스는 96×112, 프레임은 1개만 써요.

## 그룹과 부위

| 그룹 | 레이어 | 비고 |
| --- | --- | --- |
| `back` | `hair.back` | 뒷머리. 가장 뒤 |
| `body` | `leg.L/R`, `shoe.L/R`, `arm.L/R`, `torso.belly`, `torso.chest`, `bottom` | 몸 |
| `outfit` | `outer.<변형>` | 아우터 슬롯 |
| `head` | `neck`, `head`, `blush` | 얼굴 피부, 홍조 |
| `face` | `shade.*`, `nose.*`, `mouth.*`, `eye.L/R.*`, `iris.L/R.*` | 표정마다 바뀌는 부분 |
| `hair` | `hair.front` | 앞머리 |
| `custom` | `hairpin.<변형>`, `headwear.<변형>` | 커스텀 슬롯 |
| `pose` | `pose.stretch` | 기지개 자세 |
| `masks` | `socket.L/R.*` | 홍채 마스크 |

앞뒤 순서는 `lila.pack.json`의 `layers` 순서를 따라요. Aseprite에서의 순서는 보기용이에요.

## 새 그림 추가하기

레이어를 추가하고 저장하면, 내보내기가 팩 설정에 자동으로 등록해요 (`+ 팩에 추가했어요`).

- **새 의상**: `outer.hoodie` 레이어를 그리면 아우터 슬롯에 `hoodie`가 생겨요.
  이름표는 `lila.pack.json`의 `slots.outer.variants.hoodie.label`에서 바꿔요.
- **새 표정**: `eye.L.wink`, `eye.R.wink`(필요하면 `mouth.wink`도)를 그리면 `wink` 표정이 생겨요.
  그리지 않은 부위는 기본(open) 그림을 쓰고, 홍채는 숨겨요.
  동작에서 쓰려면 `states`의 프레임에 `"face": "wink"`를 넣어요.
- **새 고개 방향**: `head@down`, `hair.front@down`, `eye.L.open@down` …을 그리면
  커서가 아래에 있을 때 그 그림으로 고개를 숙여요 (`up`도 같아요).
  그리기 전에는 고개를 1픽셀 숙이고 눈동자만 아래로 움직여요.

## 그리면서 지킬 것

- **피부색**: 피부는 `#fef1f5`(밝은 면), `#fcc9c9`(그림자) 두 색으로 그려요.
  피부색 슬롯이 이 두 색만 바꿔요. 흰 셔츠·흰자에 이 색을 쓰면 같이 바뀌어요.
  흰자는 `#ffffff`로 그려요.
- **머리색**: 머리카락은 `#dac9e7`, `#9884b8`, `#7c639d`, `#473462` (+ 하이라이트 `#fef1f5`, `#fcc9c9`)로 그려요.
  머리색 슬롯이 이 색들을 바꿔요.
- **네온**: 헤드셋과 아우터의 `#d342f5`, `#a21fec`, `#713da0`은 네온 슬롯이 바꿔요.
- **겹치는 부분**: 숨쉴 때 윗몸이 1~2픽셀 올라가요. 목은 턱 아래로, 배는 가슴 아래로 2~3픽셀 더 그려두면 틈이 안 생겨요.
- **경계 테**: 헤드셋·아우터·하의·신발·눈 둘레에는 앱이 1픽셀 테를 자동으로 그려요
  (`layers`의 `edge`). 그림에 직접 그릴 필요는 없어요.
