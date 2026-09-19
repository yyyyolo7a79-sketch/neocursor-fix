<div align="center">

**Language / 语言 / 語言 / 言語 / 언어**

[**English**](../../README.md) | [简体中文](../../README.zh-CN.md) | [繁體中文](../zh-TW/README.md) | [日本語](../ja-JP/README.md) | [한국어](README.md)

</div>

---

# ✨ Neocursor Fix

> Neovide 스타일의 탄성 커서 애니메이션(커뮤니티 수정판). **VS Code와 Cursor**를 지원합니다. Custom CSS Loader가 필요 없습니다 — VSIX를 설치하면 바로 사용할 수 있습니다. 에디터 업데이트 후에도 자동으로 다시 주입됩니다.

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](../../LICENSE)
[![Latest release](https://img.shields.io/github/v/release/yyyyolo7a79-sketch/neocursor-fix)](https://github.com/yyyyolo7a79-sketch/neocursor-fix/releases)

> 📄 이 문서는 간략 번역본입니다. 전체 변경 기록과 최신 내용은 [English README](../../README.md)를 참고하세요.

---

## 🩹 수정이 필요한 이유

원본 확장 프로그램([vscode-neovide-cursor](https://github.com/LengineerC/vscode-neovide-cursor))은 유지보수가 중단되었습니다. 최신 VS Code는 CSP(Content Security Policy)로 인라인 스크립트를 차단하므로(`script-src`에 `'unsafe-inline'` 없음), 기존 방식(Custom CSS Loader로 인라인 `<script>` 주입)이 동작하지 않습니다.

**수정 방법**: 동일 출처 외부 스크립트 `<script src="./neovide-cursor.js">`는 CSP `'self'`로 허용됩니다. 이 확장 프로그램은 시작 시 애니메이션 스크립트를 workbench 디렉터리로 복사하고 `workbench.html`에 script 태그 한 줄을 추가합니다 — 추가 도구가 필요 없으며 전부 자동입니다.

| 기능 | 원본 | 이 수정판 |
|---|---|---|
| Custom CSS Loader 필요 | ✅ | ❌ 불필요 |
| 최신 VS Code CSP 호환 | ❌ 동작 안 함 | ✅ |
| 설치 방식 | `vscode_custom_css.imports` 수동 설정 | VSIX 설치만 하면 됨 |
| 에디터 업데이트 후 | 수동 재주입 | ✅ 자동 재주입 |
| Cursor 지원 | ❌ | ✅ |
| "설치가 손상되었습니다" 배너 | 표시됨 | ❌ v1.2.0부터 체크섬 자동 동기화 |

---

## 🚀 빠른 시작

1. [Releases](https://github.com/yyyyolo7a79-sketch/neocursor-fix/releases)에서 최신 `neovide-cursor-injector-1.2.7.vsix` 다운로드
2. 설치:
   - VS Code / Cursor: 명령 팔레트에서 `Extensions: Install from VSIX...` 실행 후 파일 선택
   - 또는 CLI: `cursor --install-extension neovide-cursor-injector-1.2.7.vsix`
3. **에디터를 완전히 재시작** (Reload Window가 아님)
4. 완료! 타이핑할 때 탄성 커서 애니메이션이 표시됩니다

---

## ⚙️ 사용자 설정

1. 명령 팔레트(`Ctrl+Shift+P`)에서 `Neovide Cursor: 重新注入光标动画` 실행
2. 확장 프로그램 디렉터리의 `assets/neovide-cursor.js` 상단 파라미터 수정:
   - `tailColor`: 커서 색상 (기본 분홍색 `#FFC0CB`)
   - `useShadow`: 글로우(발광) 켜기/끄기
   - `animationLength`: 애니메이션 속도
   - `cursorDisappearDelay`: 커서 사라짐 지연
3. 저장 후 재주입 명령을 다시 실행하고 재시작하면 적용됩니다

테마 커서 색상 덮어쓰기 (선택):

```json
"workbench.colorCustomizations": {
  "editorCursor.foreground": "#FFC0CB"
}
```

---

## ❓ FAQ

### Q: "설치가 손상되었습니다"가 표시되나요?
A: v1.2.0부터 표시되지 않습니다 — 주입 후 제품 체크섬(`product.json`의 `checksums`)을 자동 동기화합니다. 구버전 확장 프로그램이 남긴 배너는 "다시 표시 안 함"을 클릭하면 됩니다. 기능에는 영향이 없습니다.

> ⚠️ **주의(에디터 이상 점검 시)**: 체크섬이 동기화되어 있으므로 에디터는 설치 디렉터리가 수정되었음을 **경고하지 않습니다**.
> 주입이 활성화되었는지 확인하는 두 가지 지표: 설치 디렉터리에 `neovide-cursor.js`와 `workbench.html.bak-*` 백업이 존재하는지.
> 완전히 원래대로 되돌리기 = 주입된 script 태그 삭제 + 백업 복원 + 확장 프로그램 제거.

### Q: 에디터 업데이트 후 애니메이션이 사라졌나요?
A: 그대로 두면 됩니다. 다음 시작 시 자동으로 다시 주입됩니다(업데이터 덮어쓰기 경합에 대비한 지연 재확인 포함).

### Q: 설치했는데 효과가 없나요?
A: 확인하세요:
1. 에디터를 **완전히 종료**한 후 다시 열었나요? (주입은 재시작이 필요합니다)
2. `Program Files` 같은 보호된 디렉터리에 설치했다면 **관리자 권한**으로 한 번 실행하세요
3. `injector.log`(확장 프로그램 설치 폴더의 상위 디렉터리)를 확인하세요. 각 회차의 감지/주입 기록이 있습니다

### Q: 제거 방법은?
A: 확장 프로그램을 제거하기 전에 `workbench.html`을 복원(주입된 두 줄 삭제 + `neovide-cursor.js` 삭제)한 후 제거하세요. 파일 위치(둘 중 하나; 같은 디렉터리에 주입 전 `workbench.html.bak-*` 타임스탬프 백업이 있습니다):
- Cursor / 최신 VS Code: `<설치 경로>/resources/app/out/vs/code/electron-sandbox/workbench/`
- 구버전 VS Code: `<설치 경로>/resources/app/out/vs/code/electron-browser/workbench/`

> ⚠️ 성능 안내: 애니메이션은 약간의 성능 부담과 전력 소모가 있습니다. 전원에 연결해 사용하는 것을 권장합니다.

---

## 📝 변경 기록 (최근 버전)

> v1.0.0부터의 전체 기록은 [English README](../../README.md#-changelog)를 참고하세요.

### v1.2.7
- 🐛 **앞단 즉시 스냅(트레일 지속 시간은 변경하지 않음)**: 빠른 연속 입력(`a` 또는
  방향키 길게 누르기) 시 "트레일이 커서를 따라가지 못함 / 커서가 두 개로 보임"
  문제를 수정. 앞쪽 모서리(이동 방향 쪽 코너)의 스냅 시간 0.02s가 커서 점프마다
  약 5px의 지속적인 지연을 남겼습니다. 실제 커서는 폭이 약 2px에 불과해 도형의
  앞단이 커서 본체에서 떨어져 보였습니다. 앞단 스냅 시간을 0(모든 프레임 레이트에서
  즉시 스냅)으로 변경. **트레일의 길이와 탄성은 나머지 코너의 0.05 / 0.1 시간이
  결정하며 영향받지 않습니다**.
  실측(sim 고정 시나리오, 2px 커서): 앞단 분리 P95가 모든 시나리오에서 0;
  빠른 이동 시 트레일 폭 98.6px → **103.2px**(소폭 증가). 실제 Cursor 검증:
  빠른 입력 시 앞단 분리 항상 -1.0px, 100% 프레임에서 커서 본체 커버.

### v1.2.6
- ⏪ **v1.2.4 / v1.2.5의 지속 시간 변경을 되돌리고 v1.2.0의 지속 시간 체계를 복원**
  (트레일 속도의 기준은 v1.2.0): "속도 적응" 제거(이동이 멀수록 트레일이 짧아지는
  v1.2.0과 반대 동작이었습니다). v1.2.5의 스냅 시간 0도 철회(축소 하한을 함께
  무효화해 빠른 이동 시 트레일이 순간적으로 사라졌습니다).
  현재: 단거리 0.05s / 장거리 0.1s / 스냅 코너 0.02s(v1.2.0 원래 값).
  실측(2px 커서, 도형 폭): 빠른 이동 시나리오에서 v1.2.5는 8.7px에 불과 → v1.2.6은 98.5px로 회복.

### v1.2.5
- 🐛 빠른 연속 입력(키를 길게 누름) 시 트레일과 커서가 "분리"되어 커서가 두 개로
  보이는 문제를 수정: 앞단 코너의 스냅 시간 0.02s가 커서 점프마다 약 5px의 지속적인
  지연을 남겼습니다. 즉시 스냅(스냅 시간 0, 모든 프레임 레이트에서 유효)으로 변경.
  실측(실제 VS Code + CDP 프레임 단위 픽셀 측정): 빠른 입력 시 "도형과 커서가
  겹치는 프레임" 비율 68% → 99%.

---

## 🛠️ 소스에서 빌드

```bash
npx @vscode/vsce package
```

로컬 검증(임시 디렉터리에 미니 설치 구조를 만들어 부작용 없이 검증):

```bash
node extension/test/manual-inject-test.js
```

---

## 📃 라이선스 및 크레딧

이 수정판은 **GPL-3.0**으로 배포되며, 다음 프로젝트에서 파생되었습니다. 모든 저자에게 감사드립니다:

| 역할 | 프로젝트 |
|---|---|
| 원작자 | [vscode-neovide-cursor](https://github.com/LengineerC/vscode-neovide-cursor) |
| 업스트림 유지보수 버전 | [Neovide-Cursor](https://github.com/30d98f9b2/Neovide-Cursor) |
| 애니메이션 스크립트 출처 | [vision-smash-code](https://github.com/Jenlybein/vision-smash-code) (GPL-3.0) |
| 원본 영상(Bilibili) | [BV1XtviBkEMr](https://www.bilibili.com/video/BV1XtviBkEMr/) |
| 원본 게시글(Juejin) | [稀土掘金帖子](https://juejin.cn/post/7578917474659352627) |

> 이 프로젝트는 커뮤니티 수정판이며 원본 프로젝트와 직접적인 관련이 없습니다. 문제는 [Issues](https://github.com/yyyyolo7a79-sketch/neocursor-fix/issues)에 남겨 주세요.
