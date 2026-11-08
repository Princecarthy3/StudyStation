import { NextResponse } from "next/server";

const GITHUB_APK =
  "https://github.com/Princecarthy3/StudyStation/releases/latest/download/StudyStation.apk";

/**
 * Same-origin download entry so mobile browsers treat the file as an installable APK.
 * Redirects to the signed GitHub Release asset.
 */
export function GET() {
  return NextResponse.redirect(GITHUB_APK, 302);
}
