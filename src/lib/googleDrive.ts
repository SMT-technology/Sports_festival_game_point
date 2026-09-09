// 구글 드라이브의 "공유 링크"(예: https://drive.google.com/file/d/XXXX/view?usp=sharing)는
// 사람이 보는 뷰어 페이지 주소라서, <img src="..."> 에 그대로 넣으면 이미지가 아니라
// 구글 드라이브 화면 전체가 나타나 버린다. 실제 이미지 파일을 직접 가리키는 형태
// (drive.google.com/uc?export=view&id=XXXX)로 바꿔줘야 <img> 태그에서 정상적으로 보인다.
export function driveShareLinkToDirectUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // https://drive.google.com/file/d/<ID>/view?usp=sharing
  let match = trimmed.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (!match) {
    // https://drive.google.com/open?id=<ID> 또는 이미 변환된 .../uc?id=<ID>
    match = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  }
  if (!match) return null;

  return `https://drive.google.com/uc?export=view&id=${match[1]}`;
}
