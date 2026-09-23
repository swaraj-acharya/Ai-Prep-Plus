import {
  Award, BookOpen, Bot, Briefcase, CalendarDays, ChartColumn, CheckCheck, ClipboardCheck, Code, Compass, FlaskConical, FolderGit2, GitBranch, GraduationCap,
  History, House, Layers, LifeBuoy, ListChecks, Map, Repeat, Settings, Shield, Sparkles, Target, Telescope, Blocks, Trophy,
  type LucideIcon,
} from "lucide-react";

export interface NavItem { href: string; label: string; icon: LucideIcon; keywords?: string }
export const NAV: { group: string; items: NavItem[] }[] = [
  { group: "Home", items: [
    { href: "/", label: "Dashboard", icon: House },
    { href: "/today", label: "Today", icon: Target, keywords: "daily plan tasks" },
    { href: "/week", label: "This week", icon: CalendarDays, keywords: "weekly plan review" },
    { href: "/history", label: "History", icon: History, keywords: "calendar past days" },
    { href: "/analytics", label: "Analytics", icon: ChartColumn, keywords: "charts stats" },
  ] },
  { group: "Roadmap", items: [
    { href: "/roadmap", label: "Roadmap", icon: Map, keywords: "phases weeks year" },
    { href: "/assessments", label: "Phase gates", icon: ClipboardCheck, keywords: "assessments gate" },
    { href: "/recovery", label: "Recovery mode", icon: LifeBuoy, keywords: "behind catch up missed" },
    { href: "/coverage", label: "Coverage & decisions", icon: Layers },
  ] },
  { group: "Learning", items: [
    { href: "/dsa", label: "DSA", icon: Code, keywords: "leetcode neetcode problems" },
    { href: "/revision", label: "Revision", icon: Repeat, keywords: "spaced repetition due" },
    { href: "/mastery", label: "Mastery", icon: GraduationCap, keywords: "checkpoints" },
    { href: "/resources", label: "Resources", icon: BookOpen, keywords: "courses books links" },
  ] },
  { group: "Projects", items: [
    { href: "/projects", label: "Project Lab", icon: FlaskConical, keywords: "build portfolio" },
    { href: "/projects/pick", label: "What should I build?", icon: Sparkles, keywords: "recommend" },
    { href: "/projects/portfolio", label: "Portfolio", icon: Trophy },
  ] },
  { group: "AI", items: [{ href: "/tutor", label: "Study with Claude", icon: Bot, keywords: "prompts tutor" }] },
  { group: "Career", items: [
    { href: "/career", label: "Career blueprint", icon: Briefcase },
    { href: "/certifications", label: "Certifications", icon: Award },
    { href: "/readiness", label: "Final readiness", icon: CheckCheck },
    { href: "/horizon", label: "Horizon", icon: Telescope },
  ] },
  { group: "Special tracks", items: [
    { href: "/tracks/mern", label: "JavaScript & MERN", icon: ListChecks },
    { href: "/tracks/cyber", label: "Cybersecurity", icon: Shield },
    { href: "/tracks/chain", label: "Blockchain", icon: Blocks },
  ] },
  { group: "GitHub", items: [{ href: "/github", label: "Save to GitHub", icon: GitBranch, keywords: "github push progress sync commits" }] },
];
export const SETTINGS_ITEM: NavItem = { href: "/settings", label: "Settings", icon: Settings, keywords: "preferences backup import export timezone" };
export const MOBILE_TABS: NavItem[] = [
  { href: "/today", label: "Today", icon: Target },
  { href: "/", label: "Home", icon: House },
  { href: "/dsa", label: "DSA", icon: Code },
  { href: "/projects", label: "Lab", icon: FolderGit2 },
];
export const ALL_NAV = [...NAV.flatMap((g) => g.items), SETTINGS_ITEM, { href: "/roadmap/dependencies", label: "Dependency map", icon: Compass }];
