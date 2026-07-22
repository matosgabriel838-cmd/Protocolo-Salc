"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDoc, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { UserProfile, OM } from "@/lib/data";
import { doc } from "firebase/firestore";

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-lg">{value}</p>
    </div>
  );
}

export default function ProfilePage() {
  const { userProfile, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();

  const omDocRef = useMemoFirebase(() => {
      if(!firestore || !userProfile) return null;
      return doc(firestore, "militaryOrganizations", userProfile.omId);
  }, [firestore, userProfile]);
  
  const { data: om, isLoading: isOmLoading } = useDoc<OM>(omDocRef);

  const isLoading = isUserLoading || isOmLoading;

  if (isLoading) {
    return (
      <>
        <PageHeader
          title="Meu Perfil"
          description="Consulte suas informações de usuário."
        />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/4" />
          </CardHeader>
          <CardContent className="space-y-6">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-8 w-1/3" />
          </CardContent>
        </Card>
      </>
    );
  }

  if (!userProfile) {
    return (
      <>
        <PageHeader
          title="Erro"
          description="Não foi possível carregar seu perfil."
        />
        <p>Aguarde um momento e tente novamente. Se for um novo usuário, pode levar alguns segundos para o perfil ser sincronizado.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Meu Perfil"
        description="Consulte suas informações de usuário."
      />
      <Card>
        <CardHeader>
          <CardTitle>Dados do Usuário</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoItem label="Posto/Graduação" value={userProfile.rank} />
            <InfoItem
              label="Nome de Guerra"
              value={userProfile.warName}
            />
            <InfoItem label="Nome de Usuário" value={userProfile.username} />
            <InfoItem label="Email" value={userProfile.email} />
            <InfoItem label="Telefone" value={userProfile.phoneNumber || 'Não informado'} />
            <InfoItem label="Organização Militar" value={om?.abbreviation || 'Não definida'} />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
