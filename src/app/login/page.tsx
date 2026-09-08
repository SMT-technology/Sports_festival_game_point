import { getBranding } from "@/lib/settings";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const { orgName, logoUrl } = await getBranding();
  return <LoginForm orgName={orgName} logoUrl={logoUrl} />;
}
