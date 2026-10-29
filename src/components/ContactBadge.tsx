import { SUPER_ADMIN_CONTACT } from "@/lib/contact";

// 화면 구석에 작게 떠서 방해되지 않으면서도, 문제가 생겼을 때 누구에게
// 연락하면 되는지 항상 보이게 하는 배지. light는 어두운/화려한 배경(로그인
// 화면) 위에, 기본값은 밝은 배경(로그인 후 화면) 위에 쓰기 좋게 디자인했다.
export function ContactBadge({ light = false }: { light?: boolean }) {
  return (
    <div
      className={`fixed bottom-2 right-3 z-40 rounded-full px-3 py-1 text-[11px] shadow-sm backdrop-blur-sm ${
        light ? "bg-white/20 text-white" : "bg-white/90 text-slate-500 ring-1 ring-slate-200"
      }`}
    >
      {SUPER_ADMIN_CONTACT}
    </div>
  );
}
