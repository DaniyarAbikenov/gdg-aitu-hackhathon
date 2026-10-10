import { tr, useLocale } from "@/i18n/copy";
import {
  Home,
  Building2,
  BriefcaseBusiness,
  UserRound,
  FileText,
  Target,
  MessageSquare,
  TrendingUp,
  Settings,
  HelpCircle,
  HeadphonesIcon,
  Waypoints,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  useLocale();
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const active = (url: string) =>
    pathname === url ||
    pathname.startsWith(url + "/") ||
    (url === "/dashboard" && pathname === "/");

  const menuItems = [
    { title: t("nav.dashboard"), url: "/dashboard", icon: Home },
    { title: tr("copy.c123"), url: "/companies", icon: Building2 },
    { title: tr("copy.c124"), url: "/applications", icon: BriefcaseBusiness },
    { title: t("nav.resume"), url: "/resume", icon: FileText },
    { title: tr("skillMap.nav"), url: "/skills", icon: Waypoints },
    { title: t("nav.plan"), url: "/plan", icon: Target },
    { title: t("nav.interview"), url: "/interview", icon: MessageSquare },
    { title: t("nav.progress"), url: "/progress", icon: TrendingUp },
    { title: tr("copy.c125"), url: "/onboarding", icon: UserRound },
    { title: t("nav.settings"), url: "/settings", icon: Settings },
  ];

  const secondaryItems = [
    { title: t("nav.support"), url: "/support", icon: HeadphonesIcon },
    { title: tr("copy.c126"), url: "/faq", icon: HelpCircle },
  ];

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarContent>
        <div className="p-5 pt-7 flex gap-3 items-center">
          <span className="brand-mark" aria-hidden="true">
            a2d
          </span>
          <h1 className="text-lg text-sidebar-foreground">{t("app.name")}</h1>
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={active(item.url)}>
                    <NavLink
                      to={item.url}
                      className={
                        active(item.url)
                          ? "flex items-center gap-3 bg-sidebar-accent text-sidebar-primary font-medium"
                          : "flex items-center gap-3 text-sidebar-foreground hover:bg-sidebar-accent/50"
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="px-4 pb-4 space-y-2">
          {secondaryItems.map((item) => (
            <NavLink
              key={item.title}
              to={item.url}
              className="block text-sidebar-foreground/70 hover:text-sidebar-primary transition-colors"
            >
              {item.title}
            </NavLink>
          ))}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
