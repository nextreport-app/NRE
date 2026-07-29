import { redirect } from "next/navigation";

// The app's actual dashboard is the clients list — this route exists only
// so a fixed "/dashboard" URL always works (e.g. the post-checkout
// redirect in components/subscribe-button.tsx), without duplicating that
// page's content here.
export default function DashboardRedirectPage() {
  redirect("/clients");
}
