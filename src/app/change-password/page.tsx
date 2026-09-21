import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function ChangePasswordPage() {
  const profile = await requireProfile();
  // 교사 계정은 비밀번호가 항상 고정값(1234)이라 바꿀 필요가 없다 —
  // 직접 이 주소로 들어와도 입력 화면으로 돌려보낸다.
  if (profile.role === "teacher") {
    redirect("/input");
  }
  return <ChangePasswordForm required={profile.must_change_password} />;
}
