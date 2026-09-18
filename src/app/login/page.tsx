import { getBranding } from "@/lib/settings";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const { orgName, logoUrl, weatherLat, weatherLon, weatherLocationName } = await getBranding();
  return (
    <LoginForm
      orgName={orgName}
      logoUrl={logoUrl}
      weatherLat={weatherLat}
      weatherLon={weatherLon}
      weatherLocationName={weatherLocationName}
    />
  );
}
