import { requireProfile } from "@/lib/auth";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function ChangePasswordPage() {
  const profile = await requireProfile();
  return <ChangePasswordForm required={profile.must_change_password} />;
}
