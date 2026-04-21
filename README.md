# Stock Status

VS Code에서 한국 주식 시세를 모니터링하는 확장 프로그램입니다.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%5E18.0.0-green)
![VSCode](https://img.shields.io/badge/vscode-%5E1.28.0-blue)

## 기능

- **실시간 주식 시세 모니터링**: VS Code 상태표시줄에서 한국 주식 시세를 실시간으로 확인
- **커스텀 바**: 선택한 주식들의 현재가, 등락률, 등락액을 한눈에 표시
- **주식 검색**: 빠른 선택 메뉴를 통해 주식 추가 및 관리
- **보유주식 추적**: 보유 가격과 보유수량을 설정하여 수익률 계산
- **수정주가**: Naver 데이터를 기반으로 한 정확한 주가 정보

## 설치

1. VS Code의 확장 마켓플레이스에서 "Stock status" 검색
2. 설치 버튼 클릭
3. VS Code 재시작

또는 다음 명령어로 설치:
```bash
code --install-extension 1229juwon.stock-status
```

## 사용 방법

### 기본 설정

VS Code 설정(Settings)에서 다음과 같이 구성할 수 있습니다:

```json
"stock-status.stocks": [
  "005930",  // 삼성전자
  {
    "code": "000660",      // SK하이닉스
    "alias": "SK하이닉스",
    "hold_price": 100000,  // 보유 평균가
    "hold_num": 10         // 보유수량
  }
]
```

### 주식 코드

- `005930`: 삼성전자
- `000660`: SK하이닉스
- 기타 한국 상장 주식의 6자리 코드 사용 가능

### 설정 옵션

| 옵션 | 타입 | 설명 |
|------|------|------|
| `code` | string | 주식 코드 (필수) |
| `alias` | string | 주식 별칭 (선택) |
| `hold_price` | number | 보유 평균가 (선택) |
| `hold_num` | number | 보유수량 (선택) |

## 프로젝트 구조

```
stock-status/
├── src/
│   ├── extension.ts              # 확장 프로그램 진입점
│   ├── StockStatusController.ts  # 컨트롤러
│   ├── provider.ts               # Naver API 데이터 프로바이더
│   ├── stock.ts                  # Stock 클래스 모델
│   ├── render.ts                 # UI 렌더링 로직
│   ├── timer.ts                  # 타이머 관리
│   ├── configuration.ts          # 설정 관리
│   ├── logger.ts                 # 로깅 유틸
│   └── utils.ts                  # 유틸리티 함수
├── test/                         # 테스트 파일
├── types/                        # TypeScript 타입 정의
├── webpack.config.js             # Webpack 설정
└── package.json                  # 프로젝트 설정
```

## 개발

### 요구사항

- Node.js 18.0.0 이상
- VS Code 1.28.0 이상

### 설치

```bash
npm install
```

### 개발 모드

```bash
npm run watch
```

### 빌드

```bash
npm run compile
```

### 프로덕션 빌드

```bash
npm run package
```

### 린팅

```bash
npm run lint
```

### 테스트

```bash
npm test
```

## 주요 기술

- **TypeScript**: 타입 안정성 제공
- **Webpack**: 번들링 및 최적화
- **Axios**: HTTP 클라이언트
- **Naver Finance API**: 한국 주식 데이터 소스

## 라이선스

MIT

## 원본 라이선스

원본 프로젝트는 MIT 또는 Apache 2.0 라이선스 하에 배포됩니다.

## 작가

1229juwon

## 변경 로그

### v1.0.0 (초기 릴리스)
- 커스텀 바 표시 기능
- 호버 표시 조정

## 피드백 및 기여

버그 리포트, 기능 제안, 또는 풀 리퀘스트를 환영합니다.

## 주의사항

- 이 확장 프로그램은 Naver Finance의 데이터를 기반으로 합니다
- 실시간 시세가 아닐 수 있습니다
- 투자 결정은 신중하게 하시기 바랍니다
