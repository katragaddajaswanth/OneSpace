export const quickAccessDestinations = [
  { number: "01", label: "Academic Hub", description: "Courses, attendance and academics", href: "/academic-hub", icon: "▤" },
  { number: "02", label: "Project Nexus", description: "Discover and build projects", href: "/projects", icon: "◇" },
  { number: "03", label: "Communities", description: "Connect with university members", href: "/communities", icon: "◎" },
  { number: "04", label: "Mentorship", description: "Find guidance and expertise", href: "/mentorship", icon: "♧" },
  { number: "05", label: "Career & Opportunities", description: "Discover jobs, internships and projects", href: "/opportunities", icon: "⌕" },
] as const;

export const workspaceDestinations = [
  { icon: "⌂", label: "Dashboard", href: "/" },
  { icon: "◎", label: "Profile", href: "/profile" },
  { icon: "◉", label: "My University", href: "/university" },
  { icon: "▤", label: "Academic Hub", href: "/academic-hub" },
  { icon: "◇", label: "Project Nexus", href: "/projects" },
  { icon: "◎", label: "Communities", href: "/communities" },
  { icon: "♧", label: "Mentorship", href: "/mentorship" },
  { icon: "⌕", label: "Discover", href: "/opportunities" },
] as const;

export const prospectiveStudentDestinations = [
  { icon: "⌂", label: "Dashboard", href: "/" },
  { icon: "◉", label: "My University", href: "/university" },
  { icon: "◎", label: "Profile", href: "/profile" },
  { icon: "⌕", label: "Discover", href: "/university?tab=people" },
  { icon: "◎", label: "Communities", href: "/communities" },
  { icon: "◇", label: "Public Projects", href: "/projects" },
  { icon: "▤", label: "Admissions", href: "/admissions" },
] as const;

export const unavailableDashboardDestinations = {
  notifications: "Notifications are not included in this prototype",
} as const;

export const dashboardRouteDestinations = {
  home: "/",
  communities: "/communities",
  projects: "/projects",
  opportunities: "/opportunities",
} as const;

export function isActiveDestination(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
