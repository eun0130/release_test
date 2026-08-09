# Atlas WBS 배포 체계 사양서 (SPEC)

작성일: 2026-08-10 · 기준 버전: v0.0.7 · 상태: 긴급 알림(§7)만 미구현, 나머지 구현·검증 완료

## 1. 목표

Chrome Web Store를 사용하지 않고, 수만 명의 사내 사용자에게 Chrome extension을
배포·업데이트하는 체계. 사용자는 최초 1회만 수동 설치하고, 이후에는
"더블클릭 한 번"으로 업데이트가 끝나야 한다.

## 2. 제약 조건 (변경 불가 전제)

| 제약 | 내용 |
|---|---|
| Web Store 금지 | 보안 정책상 스토어 게시 불가. 개발자 모드 unpacked 로드만 허용 |
| 설치 위치 | 각 사용자의 Multimedia 폴더 하위. 위치는 사람마다 다르며 고정 경로(AppData 등)는 보안 정책상 차단됨 |
| SMTP 사용 불가 | 회사에서 자동 메일 발송 불가 → 알림은 extension 자체 기능으로 해결 |
| 규모 | 수만 명. 사외망 GitHub의 비인증 API 한도(IP당 시간당 60회) 때문에 실배포는 사내망 GitHub 전제 |
| 이식성 | 사외망(github.com) → 사내망(GitHub Enterprise)으로 주소가 바뀌어도 코드 수정 없이 설정 파일만으로 전환 가능해야 함 |

## 3. 구성 요소

```
repo (예: eun0130/atlasWbs)
├── manifest.json            # MV3. name, version(태그가 주입), permissions
├── app.js                   # service worker: 버전 확인·배지·자동 재시작
├── popup.html / popup.js    # 아이콘 클릭 시 버전 상태 + "지금 확인" 버튼
├── config.default.json      # 회사 기본 설정 (zip 포함, 업데이트마다 교체)
├── update.ps1               # 실제 업데이트 로직 (UTF-8 BOM 필수)
├── update.vbs               # 무창(無窓) 실행 버튼 → update.ps1 -Silent
├── install.vbs              # 최초 설치 부트스트랩 (UTF-16 LE 필수, zip 미포함)
├── README.md                # 사용자용 한국어 안내
└── .github/workflows/release.yml
```

로컬 전용(레포·zip에 없음): `config.json` — 개인 예외 설정. 업데이트가 절대 덮어쓰지 않음.

## 4. 배포 파이프라인

1. 관리자가 `git tag v1.2.3` + push
2. GitHub Actions가 태그에서 버전을 뽑아 `manifest.json`의 `version`에 주입
3. zip 생성: `atlasWbs-v1.2.3.zip` (§3의 "zip 포함" 파일들)
4. GitHub Release 자동 생성 (release notes 자동)

버전의 유일한 출처는 git tag. 소스의 manifest version은 항상 `0.0.0` 유지.

## 5. 사용자 흐름

**최초 설치 (1회)**: Multimedia 밑에 원하는 이름의 폴더 생성 → `install.vbs`를 폴더에
넣고 더블클릭 → 확인창 [확인] → 자동 다운로드·설치 → 크롬 `chrome://extensions`에서
개발자 모드 켜고 해당 폴더 로드.

**업데이트**: 아이콘에 NEW 배지 → 폴더의 `update.vbs` 더블클릭 (창 없음) →
Windows 토스트 "업데이트 완료" → 1분 내 extension이 스스로 재시작. 수동 새로고침 불필요.

## 6. 시스템 동작 상세

### 6.1 버전 확인 (polling)
- 매일 03:00 (`chrome.alarms`, periodInMinutes 1440). PC가 꺼져 있었으면 다음 크롬 시작 시 실행됨
- 보조: `onStartup`에서 마지막 확인이 20시간 이전이면 1회 확인 (하루 1회 상한 유지)
- 호출: `GET {apiBase}/repos/{repo}/releases/latest` → `tag_name` 비교
- 다르면 빨간 NEW 배지, 같으면 배지 제거. 결과는 `chrome.storage.local`에 저장

### 6.2 자동 재시작 (self-reload)
- unpacked extension은 크롬이 폴더 파일을 실시간으로 읽는 점을 이용
- 1분마다 디스크의 `manifest.json` version과 실행 중 version 비교 (`fetch(chrome.runtime.getURL(...))`, cache: no-store)
- 다르면 `chrome.runtime.reload()` → 새 버전으로 전환

### 6.3 업데이터 (update.ps1)
- 자기 폴더 기준 동작 (경로 하드코딩 없음)
- 설정 로드(§8) → 최신 버전과 로컬 manifest 비교 → 같으면 종료
- zip 다운로드 → `Expand-Archive -Force`로 제자리 덮어쓰기 → 토스트 알림
- 실패(오프라인 등) 시 실패 토스트, 다음 기회에 재시도

### 6.4 설치기 (install.vbs)
- 자기가 놓인 폴더에 설치 (하위 폴더 생성 안 함)
- 실행 시 대상 경로를 보여주는 확인창 → 잘못된 위치 실행 방지
- repo/API 주소는 파일 상단 상수로 내장 (설치 전엔 config가 없으므로 불가피)

## 7. 긴급 알림 (미구현 — 다음 구현 대상)

SMTP 없이 긴급 배포를 전파하는 기능.

- 관리자: 긴급 release의 **release 본문(설명) 첫 줄에 `[긴급]`** 표기
- extension: §6.1 확인 시 새 버전이고 본문에 `[긴급]` 마커가 있으면
  - `chrome.notifications`로 Windows 시스템 알림: "Atlas WBS 필수 업데이트 — 폴더의 update.vbs를 실행해 주세요"
  - popup 상단에 빨간 "필수 업데이트" 문구
- 일반 release는 기존대로 배지만 (알림 피로 방지)
- 필요 권한: manifest `permissions`에 `"notifications"` 추가
- 도달 시간: 최대 다음날 아침 (크롬 첫 실행 시) — 메일 없이 전사 도달
- API 응답의 `body` 필드를 사용하므로 추가 호출 없음

## 8. 설정 2층 구조

읽기 규칙 (extension·updater 공통): `config.json`(로컬)이 있으면 그 항목이
`config.default.json`(기본)을 덮어씀. 항목 단위 병합.

```json
// config.default.json (zip 포함 — 관리자가 release로 전사 배포)
{ "repo": "eun0130/atlasWbs", "apiBase": "https://api.github.com" }

// config.json (로컬 전용 — 만든 사람만 적용, 업데이트에도 보존)
{ "apiBase": "https://github.example.com/api/v3" }
```

**사내망 이전 절차**: ① 사내망에 repo 생성·release ② 사외망 repo에 마지막
"이사 안내" release — config.default.json이 사내망 주소를 가리킴 ③ 사용자가
업데이트 1회 받으면 이후 자동으로 사내망에서 수신. manifest의
`host_permissions`에 사내망 도메인 1줄 추가 필요 (이사 release에 포함).

## 9. 인코딩·호환 주의사항

| 항목 | 규칙 | 어기면 |
|---|---|---|
| update.ps1 | UTF-8 **BOM 필수** | 한글 토스트 깨짐 (Windows PowerShell 5.1) |
| install.vbs | **UTF-16 LE** 필수 | MsgBox 한글 깨짐 (WSH는 ANSI/UTF-16만) |
| manifest | MV3 필수 | V2는 크롬이 로드 거부 |
| repo rename | GitHub이 옛 주소를 자동 redirect | 기존 설치본 안 깨짐 (v0.0.7에서 검증됨) |
| gh CLI | workflow 파일 push에 `workflow` scope 필요 | push 거부 |

## 10. 검증 체크리스트 (release마다)

- [ ] Actions run 성공, Release에 zip 자산 존재
- [ ] zip 내 manifest version == 태그 버전
- [ ] 구버전 폴더에서 update.ps1 실행 → 새 버전으로 교체, exit 0
- [ ] 빈 폴더에서 install 로직 실행 → 전체 파일 + 최신 버전
- [ ] (긴급 release 시) 본문 `[긴급]` 마커 확인
