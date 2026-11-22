import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import AppHeader from "@/components/layout/AppHeader";
import AppSidebar from "@/components/layout/AppSidebar";
import RightSidebar from "@/components/layout/RightSidebar";
import WelcomeBanner from "@/components/dashboard/WelcomeBanner";
import QuickAccess from "@/components/dashboard/QuickAccess";
import CreatePost from "@/components/dashboard/CreatePost";
import UniversityFeed from "@/components/dashboard/UniversityFeed";
import ProspectiveStudentDashboard from "@/components/dashboard/ProspectiveStudentDashboard";
import DashboardMotion from "@/components/ui/DashboardMotion";

export const instant = false;

export default async function Home() {
  await connection();
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  if (user.primaryRole === "PROSPECTIVE_STUDENT") {
    return <ProspectiveStudentDashboard />;
  }

  return <main className="page-enter min-h-screen app-atmosphere" style={{ color: "var(--foreground)" }}>
    <AppHeader />
    <DashboardMotion>
      <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-5 px-4 py-6 lg:grid-cols-[220px_minmax(0,1fr)_260px] lg:px-6">
        <AppSidebar />
        <section className="min-w-0 space-y-6">
          <WelcomeBanner />
          <QuickAccess />
          <CreatePost />
          <UniversityFeed />
          <div className="text-center"><Link href="/profile" className="action-control action-control-tertiary">Complete your profile</Link></div>
        </section>
        <div className="hidden lg:block"><RightSidebar /></div>
      </div>
    </DashboardMotion>
    <footer className="border-t px-5 py-6 text-center text-xs" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-tertiary)" }}>One-Space · Your university. Connected.</footer>
  </main>;
}
