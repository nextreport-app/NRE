import { redirect } from "next/navigation";

/** Legacy wizard link — metrics columns are covered in the CSV download guide. */
export default function HelpMetricsRedirectPage() {
  redirect("/help/download");
}
