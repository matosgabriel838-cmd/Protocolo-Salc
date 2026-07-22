
"use client"

import { Wallet, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { PageHeader } from "@/components/dashboard/page-header";
import { useUser } from "@/firebase";
import { OrganizationsTab, ModalitiesTab, NCSettingsTab } from "@/components/dashboard/settings/page";
import { UsersTab } from "@/components/dashboard/users-tab";


export default function SettingsPage() {
    const { userProfile, isLoading } = useUser();

    if (isLoading) {
        return (
             <>
                <PageHeader
                    title="Configurações"
                    description="Gerencie os parâmetros do sistema."
                />
                <p>Carregando permissões...</p>
            </>
        )
    }

    if (userProfile?.role !== 'ADMIN') {
        return (
            <>
                <PageHeader
                    title="Acesso Negado"
                    description="Você não tem permissão para visualizar esta página."
                />
                <Card>
                    <CardContent className="p-6">
                        <p>Apenas administradores do sistema podem acessar a área de configurações.</p>
                    </CardContent>
                </Card>
            </>
        )
    }
  
  return (
    <>
      <PageHeader
        title="Configurações"
        description="Gerencie os parâmetros do sistema."
      />
      <Tabs defaultValue="organizations" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 md:w-[600px]">
            <TabsTrigger value="organizations">Organizações</TabsTrigger>
            <TabsTrigger value="modalities">Modalidades</TabsTrigger>
            <TabsTrigger value="nc_settings">
                <Wallet className="mr-2 h-4 w-4" />
                NCs
            </TabsTrigger>
            <TabsTrigger value="users">
                <Users className="mr-2 h-4 w-4" />
                Usuários
            </TabsTrigger>
        </TabsList>
         <TabsContent value="organizations">
            <OrganizationsTab />
        </TabsContent>
        <TabsContent value="modalities">
            <ModalitiesTab />
        </TabsContent>
        <TabsContent value="nc_settings">
            <NCSettingsTab />
        </TabsContent>
         <TabsContent value="users">
            <UsersTab />
        </TabsContent>
      </Tabs>
    </>
  );
}
