import { redirect } from "next/navigation";
import { getWebSession } from "@/server/auth/web-session";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const session = await getWebSession();
  redirect(session ? "/dashboard" : "/login");
}
