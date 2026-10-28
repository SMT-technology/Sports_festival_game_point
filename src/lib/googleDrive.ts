// 구글 드라이브의 "공유 링크"(예: https://drive.google.com/file/d/XXXX/view?usp=sharing)는
// 사람이 보는 뷰어 페이지 주소라서, <img src="..."> 에 그대로 넣으면 이미지가 아니라
// 구글 드라이브 화면 전체가 나타나 버린다. 실제 이미지를 직접 가리키는 형태로 바꿔줘야
// <img> 태그에서 정상적으로 보인다.
//
// 예전엔 drive.google.com/uc?export=view&id=XXXX 형태를 썼는데, 구글이 이 방식의
// 핫링크(다른 사이트에 직접 이미지로 박아넣기)를 점점 더 엄격하게 막고 있어서
// 권한이 맞아도 안 뜨는 경우가 늘고 있다. 대신 구글이 공식 문서화해서 계속
// 지원하는 썸네일 API(drive.google.com/thumbnail?id=...&sz=...)가 더 안정적이라
// 이걸로 바꿨다.
export function driveShareLinkToDirectUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // https://drive.google.com/file/d/<ID>/view?usp=sharing
  let match = trimmed.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (!match) {
    // https://drive.google.com/open?id=<ID> 또는 이미 변환된 .../uc?id=<ID> 등
    match = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  }
  if (!match) return null;

  return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
}
