import { Home, FileText, Target, MessageSquare, TrendingUp, Settings, HelpCircle, HeadphonesIcon } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { t } = useTranslation();

  const menuItems = [
    { title: t("nav.dashboard"), url: "/dashboard", icon: Home },
    { title: t("nav.resume"), url: "/resume", icon: FileText },
    { title: t("nav.plan"), url: "/plan/p_demo", icon: Target },
    { title: t("nav.interview"), url: "/interview", icon: MessageSquare },
    { title: t("nav.progress"), url: "/progress", icon: TrendingUp },
    { title: t("nav.settings"), url: "/settings", icon: Settings },
  ];

  const secondaryItems = [
    { title: t("nav.support"), url: "/support", icon: HeadphonesIcon },
    { title: t("nav.faq"), url: "/faq", icon: HelpCircle },
  ];

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarContent>
        <div className="p-4">
          <h1 className="text-xl font-bold text-sidebar-foreground">{t("app.name")}</h1>
        </div>
        
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        isActive
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
              className="block text-white/70 hover:text-white transition-colors"
            >
              {item.title}
            </NavLink>
          ))}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
