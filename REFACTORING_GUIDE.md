# 주식 상태 모니터 리팩토링 가이드

## 📋 리팩토링 개요

관심사의 분리(Separation of Concerns) 원칙에 따라 **StockStatusController**의 책임을 여러 서비스로 분산했습니다.

---

## 🏗️ 아키텍처

### 이전 구조
```
StockStatusController
├── 명령어 등록
├── QuickPick 관리
├── 주식 데이터 관리
├── 타이머 관리
├── 렌더링
└── API 호출
```

### 이후 구조 (관심사 분리)
```
StockStatusController (지휘자 역할)
├── CommandManager (명령어 등록 & 처리)
├── StockService (주식 데이터 관리)
├── QuickPickManager (QuickPick UI)
├── UIRenderer (렌더링)
└── TickerService (데이터 페칭 & 타이머)
```

---

## 📁 새로운 서비스 구조

### 1. **CommandManager** (`src/services/CommandManager.ts`)
**책임**: VSCode 명령어 등록 및 관리
- 명령어 등록 추상화
- 명령어 핸들러 인터페이스 제공

```typescript
public registerCommands(context: vscode.ExtensionContext): void
```

---

### 2. **StockService** (`src/services/StockService.ts`)
**책임**: 주식 데이터 관리
- 주식 목록 로드/새로고침
- 주식 유효성 검증
- 주식 중복 확인
- 주식 추가/업데이트

```typescript
public getStocks(): Stock[]
public isValidStock(stock: Stock): boolean
public stockExists(code: string): boolean
public addStock(stock: Stock): Promise<void>
```

---

### 3. **QuickPickManager** (`src/services/QuickPickManager.ts`)
**책임**: QuickPick UI 관리
- QuickPick 생성 및 설정
- 아이템 표시
- 상태 관리 (busy, hide, show)

```typescript
public show(items: StockQuickPickItem[], placeholder?: string): void
public hide(): void
public setBusy(busy: boolean): void
```

---

### 4. **UIRenderer** (`src/services/UIRenderer.ts`)
**책임**: 렌더링 로직 (상태 바 업데이트)

#### 하위 클래스들:
- **TextFormatter**: 텍스트 포맷팅
  - `formatItemText()`: 상태 바 텍스트 생성
  - `formatTooltipText()`: 툴팁 생성

- **ColorManager**: 색상 관리
  - `getItemColor()`: 등락 상태에 따른 색상

- **StatusBarItemManager**: 상태 바 아이템 관리
  - `addItem()`, `updateItem()`, `removeItem()`

```typescript
public render(stocks: Stock[]): void
public dispose(): void
```

---

### 5. **TickerService** (`src/services/TickerService.ts`)
**책임**: 주기적 데이터 조회 및 업데이트
- 타이머 관리
- 데이터 페칭
- 리스너 패턴으로 변경 알림

```typescript
public start(stocks: Stock[]): void
public stop(): void
public addListener(listener: ITickerListener): void
public removeListener(listener: ITickerListener): void
```

#### 이벤트 인터페이스:
```typescript
export interface ITickerListener {
	onTick(stocks: Stock[]): void;
	onError(error: Error): void;
}
```

---

## 🔄 실행 흐름

### 1. 초기화
```typescript
new StockStatusController()
  → new StockService()
  → new QuickPickManager()
  → new UIRenderer()
  → new TickerService()
  → commandManager.registerCommands()
```

### 2. 모니터링 시작
```
start()
  → stockService.refresh()
  → tickerService.start()
    → 주기적 fetch
    → onTick() 호출
      → uiRenderer.render()
```

### 3. 주식 추가
```
openSearch()
  → showInputBox()
  → searchStocks()
  → handleStockSelection()
  → stockService.addStock()
  → restart()
```

---

## ✅ 개선 효과

### 1. **유지보수성 증대**
- 각 서비스가 단일 책임을 가짐
- 코드 이해 및 수정이 용이
- 테스트가 용이함

### 2. **확장성 개선**
- 새로운 기능 추가 시 기존 코드 영향 최소화
- 예: 렌더링 UI 변경 시 UIRenderer만 수정

### 3. **재사용성**
- 서비스들이 독립적으로 재사용 가능
- 다른 프로젝트에 적용 가능

### 4. **테스트 가능성**
```typescript
// Mock 서비스로 쉽게 테스트 가능
const mockStockService = new MockStockService();
const controller = new StockStatusController(mockStockService, ...);
```

---

## 🔌 주의사항

### render.ts 제거 또는 보관
현재 `src/render.ts`는 더 이상 사용되지 않습니다.
- **보관**: 레거시 코드로 보관
- **제거**: 불필요한 경우 삭제

### 기존 코드와의 호환성
- 공개 API는 동일하게 유지됨
- 내부 구현만 변경됨

---

## 📚 참고 사항

### 리스너 패턴 활용
TickerService는 옵저버 패턴을 사용하여 다중 리스너를 지원합니다:

```typescript
tickerService.addListener(new CustomListener());
tickerService.addListener(new AnotherListener());

// 모든 리스너에게 알림
tickerService.start(stocks);
```

### 에러 처리
모든 서비스는 에러 처리 및 로깅을 포함합니다:

```typescript
public async addStock(stock: Stock): Promise<void> {
	if (!this.isValidStock(stock)) {
		throw new Error('Invalid stock');
	}
	// ...
}
```

---

## 🚀 향후 개선 사항

1. **의존성 주입 (Dependency Injection)**
   ```typescript
   new StockStatusController(stockService, uiRenderer, tickerService)
   ```

2. **상태 관리 라이브러리**
   - Redux 또는 유사 패턴 도입

3. **이벤트 버스**
   - 중앙 이벤트 관리 시스템

4. **설정 마이그레이션**
   - Configuration 서비스 별도 분리

5. **단위 테스트**
   - Jest를 활용한 테스트 스위트 구성
