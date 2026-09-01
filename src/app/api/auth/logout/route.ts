import { NextResponse } from "next/server";
import { WEB_SESSION_COOKIE } from "@/server/auth/web-session";

export async function POST() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set({
    name: WEB_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
