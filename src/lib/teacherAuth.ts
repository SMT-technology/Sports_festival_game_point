// 교사 로그인은 이메일 대신 "성함 + 4자리 비밀번호(PIN)"로 이뤄진다.
// Supabase Auth는 이메일 기반 로그인만 지원하므로, 이름으로부터 결정적으로
// (같은 이름이면 항상 같은 값이 나오게) 내부용 가짜 이메일을 만들어 쓴다.
// 그래서 별도의 이름→이메일 조회 없이, 로그인 화면에 입력한 이름만으로
// 바로 로그인을 시도할 수 있다. 이름이 같으면 이메일도 같아져서 Supabase가
// "이미 존재하는 이메일"이라고 자동으로 막아주기 때문에, 같은 이름의 계정이
// 중복 생성되는 것도 자연스럽게 방지된다 (관리자는 겹치는 이름이 있으면
// "김민수(2반)"처럼 구분해서 등록하면 된다).
//
// 이 파일의 함수들은 브라우저(로그인/비밀번호 변경 화면)와 서버(관리자
// API 라우트) 양쪽에서 동일하게 동작해야 하므로, Node 전용 API(Buffer 등)
// 대신 TextEncoder만 사용한다.

const TEACHER_EMAIL_DOMAIN = "teacher.sinsports.internal";

export const DEFAULT_TEACHER_PIN = "1234";

function normalizeTeacherName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function nameToTeacherEmail(name: string): string {
  const normalized = normalizeTeacherName(name);
  const bytes = new TextEncoder().encode(normalized);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `t${hex}@${TEACHER_EMAIL_DOMAIN}`;
}

// Supabase Auth의 비밀번호 최소 길이 정책(기본 6자 이상)을 만족시키기 위해,
// 교사가 실제로 입력하는 4자리 PIN을 내부적으로만 더 긴 문자열로 감싸서
// 저장한다. 교사 화면에는 항상 4자리 숫자만 보이고, 이 변환은 내부적으로만
// 쓰인다.
export function pinToTeacherPassword(pin: string): string {
  return `pin-${pin}-sinsports`;
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}
