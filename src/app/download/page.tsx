import { redirect } from "next/navigation";

/** Short alias — CSV export guide lives at /help/download. */
export default function DownloadGuideRedirect() {
  redirect("/help/download");
}
