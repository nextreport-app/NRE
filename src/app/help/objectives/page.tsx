import { redirect } from "next/navigation";

/** Legacy wizard link — objectives are covered in the CSV download guide. */
export default function HelpObjectivesRedirectPage() {
  redirect("/help/download");
}
