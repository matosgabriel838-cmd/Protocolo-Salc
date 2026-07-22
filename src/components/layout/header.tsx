
"use client"

import Link from 'next/link'
import {
  LogOut,
  User as UserIcon,
  Lock
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { usePathname, useRouter } from 'next/navigation'
import React, { useMemo } from 'react'
import Image from 'next/image'
import { ThemeToggle } from '../theme-toggle'
import { useAuth, useUser } from '@/firebase'
import { signOut } from 'firebase/auth'
import { Avatar, AvatarFallback } from '../ui/avatar'
import { Skeleton } from '../ui/skeleton'
import { PlaceHolderImages } from '@/lib/placeholder-images'

const breadcrumbItems = [
    { label: 'Visão Geral', path: '/dashboard/overview' },
    { label: 'Notas de Crédito', path: '/dashboard/credit-notes' },
    { label: 'Protocolos', path: '/dashboard/protocols' },
    { label: 'Execução', path: '/dashboard/execution' },
    { label: 'Organizações', path: '/dashboard/organizations' },
    { label: 'Anulações', path: '/dashboard/annulments' },
    { label: 'Configurações', path: '/dashboard/settings' },
]

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const { user, userProfile, isLoading } = useUser();

  const pageTitle = breadcrumbItems.find(item => pathname.startsWith(item.path))?.label || 'Dashboard';

  const badmLogo = PlaceHolderImages.find(img => img.id === 'badm-logo');
  const copespLogo = PlaceHolderImages.find(img => img.id === 'copesp-logo');


  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const userDisplayName = useMemo(() => {
    if (isLoading) return <Skeleton className="h-4 w-24" />;
    if (!userProfile) return user?.email || 'Usuário';
    return `${userProfile.rank} ${userProfile.warName}`;
  }, [userProfile, user, isLoading]);

  const userInitials = useMemo(() => {
    if (isLoading) return '';
    if (!userProfile) return user?.email?.charAt(0).toUpperCase() || '?';
    return userProfile.warName.charAt(0).toUpperCase();
  }, [userProfile, user, isLoading]);

  return (
    <header className="flex h-14 items-center gap-4 border-b border-sidebar-border bg-sidebar text-sidebar-foreground px-4 lg:h-[60px] lg:px-6">
      {badmLogo && (
        <div className="relative h-10 w-10 hidden md:block">
            <Image src={badmLogo.imageUrl} alt={badmLogo.description} fill className="object-contain"/>
        </div>
      )}

      <div className="w-full flex-1">
        <h1 className="font-semibold text-lg">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-4">
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2"
              disabled={isLoading}
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline">{userDisplayName}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/profile">
                <UserIcon className="mr-2 h-4 w-4" />
                <span>Meu Perfil</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/change-password">
                <Lock className="mr-2 h-4 w-4" />
                <span>Trocar Senha</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {copespLogo && (
            <div className="relative h-10 w-10 hidden md:block">
                <Image src={copespLogo.imageUrl} alt={copespLogo.description} fill className="object-contain"/>
            </div>
        )}
      </div>
    </header>
  )
}
