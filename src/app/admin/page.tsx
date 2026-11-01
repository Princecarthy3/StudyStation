import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Portal — StudyStation Command Center",
  description: "Executive administrative dashboard and platform analytics for StudyStation.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminPage() {
  const session = await getAdminSession();

  if (!session) {
    redirect("/admin/login");
  }

  return <AdminDashboard adminEmail={session.email} />;
}
