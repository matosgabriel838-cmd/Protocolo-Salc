'use client';

import { AppSidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { useAuth } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // onAuthStateChanged returns an unsubscriber
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        
        // Logic for initial password check
        const { creationTime, lastSignInTime } = user.metadata;
        const passwordCheckDone = typeof window !== 'undefined' ? sessionStorage.getItem('passwordCheckDone') === 'true' : false;

        // A simple heuristic for "first login": creation and sign-in times are very close.
        const isNewUserFirstLogin = creationTime && lastSignInTime && 
                                  (new Date(lastSignInTime).getTime() - new Date(creationTime).getTime() < 10000); // 10-second window for safety

        // If it looks like the first login and they haven't changed the password yet in this session,
        // and they aren't already on the change password page, redirect them.
        if (isNewUserFirstLogin && !passwordCheckDone && pathname !== '/dashboard/change-password') {
          router.push('/dashboard/change-password');
        }

      } else {
        router.push('/login');
      }
      setIsLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [auth, router, pathname]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    // While redirecting, show a loader to prevent flicker
     return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
        <footer className="footer">
          Desenvolvido pelo 1º Ten OCT Deyvison Araújo
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
