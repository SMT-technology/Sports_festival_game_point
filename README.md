# 체육대회 점수 관리 시스템

반대항전 6종목과 단합 미니게임(6~7개), 응원·질서 점수를 입력하고 학년별 반 순위를
실시간으로 집계·시상하는 교사 전용 웹앱입니다.

- **입력**: 담당 종목을 배정받은 교사가 반별 결과를 입력 → 임시저장 → "최종 제출"
  확인 후 제출. 제출 후에도 "수정하기"로 다시 고칠 수 있습니다.
- **결과**: 최종 제출된 점수만 집계되며, 제출되는 순간 학년별 순위표에 실시간으로 반영됩니다.
- **관리자**: 종목/배점표 관리, 교사 계정 생성·권한·종목 배정, 모든 점수 직접 수정/잠금해제,
  변경 이력 조회.

## 배점 규칙 (기본값, 관리자 화면에서 수정 가능)

| 구분 | 방식 | 점수 |
| --- | --- | --- |
| 반대항전 (6종목) | 순위 입력 | 1위 100 / 2위 80 / 3위 60 / 4위 40 / 5위 20 / 6위 이하 0점 |
| 단합 미니게임 (7종목) | 통과/실패 | 통과 20점 / 실패 0점 |
| 응원·질서 | 직접 입력 | 0~10점 |

반 구성: 1학년 1~12반, 2학년 1~12반, 3학년 1~14반 (총 38개 반). 시상은 **학년별 반 순위**로 산정됩니다.

## 기술 스택

Next.js (App Router) + Supabase (Postgres, Auth, Realtime). 배포는 Vercel을 권장합니다.

## 시작하기

### 1. Supabase 프로젝트 생성

1. [supabase.com](https://supabase.com)에서 새 프로젝트를 생성합니다.
2. `supabase/migrations/0001_schema.sql` → `supabase/migrations/0002_seed.sql` 순서로
   Supabase 대시보드의 SQL Editor에서 실행합니다. (또는 Supabase CLI로 `supabase db push`)
3. Project Settings → API 에서 `Project URL`, `anon public key`, `service_role key`를 확인합니다.

### 2. 환경 변수 설정

`.env.local.example`을 `.env.local`로 복사하고 값을 채웁니다.

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # 서버 전용, 절대 클라이언트에 노출 금지
```

### 3. 최초 관리자 계정 만들기

앱에는 회원가입 화면이 없습니다 (교사만 접근하는 폐쇄형 시스템). 최초 관리자는 아래 순서로 만듭니다.

1. Supabase 대시보드 → Authentication → Users → "Add user"로 관리자 이메일/비밀번호 계정을 생성합니다.
   (가입 즉시 `profiles` 테이블에 `role='teacher'` 행이 자동 생성됩니다.)
2. SQL Editor에서 아래 쿼리로 해당 계정을 관리자로 승격합니다.

   ```sql
   update public.profiles set role = 'admin' where email = '관리자이메일@school.kr';
   ```

3. 이후 추가 교사 계정은 관리자 화면(`/admin/teachers`)에서 생성할 수 있습니다.

### 4. 로컬 실행

```bash
npm install
npm run dev
```

`http://localhost:3000` 접속 → 로그인 → 역할에 따라 입력/결과/관리자 화면 이용.

### 5. 배포

Vercel 등에 배포 시 위 3개 환경 변수를 프로젝트 설정에 동일하게 등록하세요.

## 데이터 모델 요약

- `profiles`: 로그인 계정 (teacher / admin)
- `classes`: 38개 반 목록
- `events`: 종목 (반대항전 / 단합 미니게임 / 응원·질서), 배점표 포함
- `event_assignments`: 교사 ↔ 종목 배정
- `scores`: 종목×반 점수 (draft/final 상태, 자동 배점 계산 트리거 포함)
- `score_audit_log`: 모든 점수 변경 이력 (관리자만 조회 가능)

점수 계산과 권한(RLS)은 모두 데이터베이스 레벨에서 강제되므로, 클라이언트 코드가 우회할 수 없습니다.
