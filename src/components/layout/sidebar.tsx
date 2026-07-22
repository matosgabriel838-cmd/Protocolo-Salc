
"use client"

import Link from "next/link"
import {
  FileText,
  GanttChartSquare,
  LayoutGrid,
  Settings,
  Wallet,
  FileX2,
} from "lucide-react"
import { usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar"

const navItems = [
  { href: "/dashboard/overview", icon: LayoutGrid, label: "Visão Geral" },
  { href: "/dashboard/protocols", icon: FileText, label: "Protocolos (P_Req)" },
  { href: "/dashboard/execution", icon: GanttChartSquare, label: "Conformidade" },
  { href: "/dashboard/annulments", icon: FileX2, label: "Anulações" },
  { href: "/dashboard/credit-notes", icon: Wallet, label: "Notas de Crédito" },
]

const settingsItem = { href: "/dashboard/settings", icon: Settings, label: "Configurações" };


export function AppSidebar() {
  const pathname = usePathname()
  const { setOpenMobile, isMobile } = useSidebar();

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }
  
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border justify-center">
        <Link href="/dashboard/overview" className="flex items-center gap-2 p-2 text-sidebar-foreground">
            <GanttChartSquare className="w-8 h-8 text-accent" />
            <span className="text-xl font-semibold group-data-[collapsible=icon]:hidden">SisGEC</span>
        </Link>
      </SidebarHeader>
      <SidebarMenu className="flex-1 p-2">
        {navItems.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={pathname.startsWith(item.href)}
              className="justify-start"
              tooltip={item.label}
            >
              <Link href={item.href} onClick={handleLinkClick}>
                <item.icon className="mr-3 h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
        <SidebarFooter>
            <SidebarMenu className="p-2">
              <SidebarMenuItem>
                  <SidebarMenuButton
                      asChild
                      isActive={pathname.startsWith(settingsItem.href)}
                      className="justify-start"
                      tooltip={settingsItem.label}
                      >
                      <Link href={settingsItem.href} onClick={handleLinkClick}>
                          <settingsItem.icon className="mr-3 h-5 w-5" />
                          <span>{settingsItem.label}</span>
                      </Link>
                  </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
        </SidebarFooter>
    </Sidebar>
  )
}
