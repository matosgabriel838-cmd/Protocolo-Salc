

"use client"

import { PlusCircle, Edit, Trash2, CheckCircle2, ArrowUp, ArrowDown, FileText, FileBadge, FileBarChart2, User as UserIcon, Wallet, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Modality, OM, AppSettings, UserProfile } from "@/lib/data";
import { useCollection, useFirestore, useMemoFirebase, deleteDocumentNonBlocking, setDocumentNonBlocking, useDoc } from "@/firebase";
import { collection, doc, query, orderBy, runTransaction, limit } from "firebase/firestore";
import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ModalityForm } from "@/components/dashboard/modality-form";
import { OrganizationForm } from "@/components/dashboard/organization-form";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";


export function OrganizationsTab() {
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [editingOM, setEditingOM] = useState<OM | null>(null);
  const [deletingOM, setDeletingOM] = useState<OM | null>(null);

  const firestore = useFirestore();
  const { toast } = useToast();


  const omsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "militaryOrganizations"), orderBy("code"), limit(10));
  }, [firestore]);

  const usersQuery = useMemoFirebase(() => {
    if(!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);

  const { data: oms, isLoading } = useCollection<OM>(omsQuery);
  const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);

  const usersMap = useMemo(() => {
    if (!users) return new Map();
    return new Map(users.map(u => [u.id, u]));
  }, [users]);


  const handleDelete = () => {
    if (!deletingOM || !firestore) return;
    const docRef = doc(firestore, "militaryOrganizations", deletingOM.id);
    deleteDocumentNonBlocking(docRef);
    toast({
        title: "Sucesso!",
        description: `A OM "${deletingOM.abbreviation}" foi excluída.`,
    });
    setDeletingOM(null);
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Organizações Militares (OM)</CardTitle>
                <CardDescription>Cadastre e gerencie as OMs do sistema.</CardDescription>
            </div>
            <Dialog open={isCreateFormOpen} onOpenChange={setIsCreateFormOpen}>
            <DialogTrigger asChild>
                <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Adicionar OM
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                <DialogTitle>Adicionar Nova OM</DialogTitle>
                <DialogDescription>
                    Preencha os campos para cadastrar uma nova Organização Militar.
                </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[80vh] p-6">
                    <OrganizationForm setOpen={setIsCreateFormOpen} />
                </ScrollArea>
            </DialogContent>
            </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Sigla</TableHead>
                <TableHead>Nome Extenso</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="w-[100px] text-right">
                    Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading || isLoadingUsers ? (
                 <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      Carregando...
                    </TableCell>
                  </TableRow>
              ) : (
                !oms || oms.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    Nenhuma organização militar encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                oms?.map((om) => {
                  const responsibleUser = om.responsibleUserId ? usersMap.get(om.responsibleUserId) : null;
                  return (
                  <TableRow key={om.id}>
                    <TableCell className="font-medium">{om.code}</TableCell>
                    <TableCell>{om.abbreviation}</TableCell>
                    <TableCell>{om.name}</TableCell>
                     <TableCell>
                      {responsibleUser ? `${responsibleUser.rank} ${responsibleUser.warName}` : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                        <TooltipProvider>
                            <div className="flex items-center justify-end gap-2">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                         <Button variant="ghost" size="icon" onClick={() => setEditingOM(om)}>
                                            <Edit className="h-4 w-4" />
                                            <span className="sr-only">Editar</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Editar</p>
                                    </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeletingOM(om)}>
                                            <Trash2 className="h-4 w-4" />
                                            <span className="sr-only">Excluir</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Excluir</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        </TooltipProvider>
                    </TableCell>
                  </TableRow>
                )})
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Edit Dialog */}
      <Dialog open={!!editingOM} onOpenChange={(isOpen) => !isOpen && setEditingOM(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Organização Militar</DialogTitle>
            <DialogDescription>
              Altere os dados da OM e clique em salvar.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[80vh] p-6">
            <OrganizationForm setOpen={(isOpen) => !isOpen && setEditingOM(null)} organization={editingOM} />
          </ScrollArea>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingOM} onOpenChange={(isOpen) => !isOpen && setDeletingOM(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente a organização militar 
              <span className="font-bold"> "{deletingOM?.abbreviation}"</span> do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function ModalitiesTab() {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingModality, setEditingModality] = useState<Modality | null>(null);
    const [deletingModality, setDeletingModality] = useState<Modality | null>(null);
    const firestore = useFirestore();
    const { toast } = useToast();

    const modalitiesCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, "licitationModalities"), orderBy("order"), limit(10));
    }, [firestore]);
    const { data: modalities, isLoading } = useCollection<Modality>(modalitiesCollection);
    
    const handleDelete = () => {
        if (!deletingModality || !firestore) return;
        const docRef = doc(firestore, "licitationModalities", deletingModality.id);
        deleteDocumentNonBlocking(docRef);
        toast({
            title: "Sucesso!",
            description: `A modalidade "${deletingModality.name}" foi excluída.`,
        });
        setDeletingModality(null);
    }
    
    const handleReorder = async (currentIndex: number, direction: 'up' | 'down') => {
        if (!modalities || !firestore) return;

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

        if (targetIndex < 0 || targetIndex >= modalities.length) {
            return; // Cannot move outside of bounds
        }
        
        const currentItem = modalities[currentIndex];
        const targetItem = modalities[targetIndex];

        // Swap order values
        const currentOrder = currentItem.order;
        const targetOrder = targetItem.order;
        
        try {
            await runTransaction(firestore, async (transaction) => {
                const currentRef = doc(firestore, "licitationModalities", currentItem.id);
                const targetRef = doc(firestore, "licitationModalities", targetItem.id);

                transaction.update(currentRef, { order: targetOrder });
                transaction.update(targetRef, { order: currentOrder });
            });
             toast({
                title: "Sucesso!",
                description: "Ordem das modalidades atualizada.",
            });
        } catch (e) {
             toast({
                variant: "destructive",
                title: "Erro ao reordenar!",
                description: "Não foi possível atualizar a ordem.",
            });
        }
    }

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Modalidades de Aquisição</CardTitle>
                        <CardDescription>Adicione, remova ou reordene as modalidades utilizadas nos protocolos.</CardDescription>
                    </div>
                    <Dialog open={isFormOpen} onOpenChange={(isOpen) => { setIsFormOpen(isOpen); if(!isOpen) setEditingModality(null);}}>
                        <DialogTrigger asChild>
                            <Button onClick={() => setIsFormOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Nova Modalidade</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px]">
                            <DialogHeader>
                                <DialogTitle>Nova Modalidade</DialogTitle>
                                <DialogDescription>
                                    Preencha o nome da nova modalidade de aquisição.
                                </DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="max-h-[80vh] p-6">
                                <ModalityForm setOpen={setIsFormOpen} existingModalities={modalities || []} />
                            </ScrollArea>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[80px]">Ordem</TableHead>
                                <TableHead>Nome da Modalidade</TableHead>
                                <TableHead>Relatórios</TableHead>
                                <TableHead>Campos</TableHead>
                                <TableHead className="text-right w-[100px]">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        Carregando...
                                    </TableCell>
                                </TableRow>
                            ) : (
                                !modalities || modalities.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        Nenhuma modalidade encontrada.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                modalities?.map((m, index) => (
                                    <TableRow key={m.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleReorder(index, 'up')}
                                                    disabled={index === 0}
                                                    className="h-6 w-6"
                                                >
                                                    <ArrowUp className="h-4 w-4"/>
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleReorder(index, 'down')}
                                                    disabled={index === modalities.length - 1}
                                                    className="h-6 w-6"
                                                >
                                                    <ArrowDown className="h-4 w-4"/>
                                                </Button>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">{m.name}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {m.isCompliance && <TooltipProvider><Tooltip><TooltipTrigger><CheckCircle2 className="h-5 w-5 text-green-500" /></TooltipTrigger><TooltipContent>Conformidade</TooltipContent></Tooltip></TooltipProvider>}
                                                {m.isFinancial && <TooltipProvider><Tooltip><TooltipTrigger><CheckCircle2 className="h-5 w-5 text-blue-500" /></TooltipTrigger><TooltipContent>Financeiro</TooltipContent></Tooltip></TooltipProvider>}
                                            </div>
                                        </TableCell>
                                         <TableCell>
                                            <div className="flex items-center gap-2">
                                                {m.requiresDiexPreq && <TooltipProvider><Tooltip><TooltipTrigger><FileText className="h-4 w-4 text-gray-500" /></TooltipTrigger><TooltipContent>Requer DIEx/P_Req</TooltipContent></Tooltip></TooltipProvider>}
                                                {m.requiresPregao && <TooltipProvider><Tooltip><TooltipTrigger><FileBadge className="h-4 w-4 text-gray-500" /></TooltipTrigger><TooltipContent>Requer Nº Pregão</TooltipContent></Tooltip></TooltipProvider>}
                                                {m.requiresSipeo && <TooltipProvider><Tooltip><TooltipTrigger><FileBarChart2 className="h-4 w-4 text-gray-500" /></TooltipTrigger><TooltipContent>Requer Mapa SIPEO</TooltipContent></Tooltip></TooltipProvider>}
                                                {m.requiresBeneficiary && <TooltipProvider><Tooltip><TooltipTrigger><UserIcon className="h-4 w-4 text-gray-500" /></TooltipTrigger><TooltipContent>Requer Beneficiário</TooltipContent></Tooltip></TooltipProvider>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <TooltipProvider>
                                                <div className="flex items-center justify-end gap-2">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button variant="ghost" size="icon" onClick={() => setEditingModality(m)}>
                                                                <Edit className="h-4 w-4" />
                                                                <span className="sr-only">Editar</span>
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent><p>Editar</p></TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeletingModality(m)}>
                                                                <Trash2 className="h-4 w-4" />
                                                                <span className="sr-only">Excluir</span>
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent><p>Excluir</p></TooltipContent>
                                                    </Tooltip>
                                                </div>
                                            </TooltipProvider>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <Dialog open={!!editingModality} onOpenChange={(isOpen) => !isOpen && setEditingModality(null)}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Editar Modalidade</DialogTitle>
                        <DialogDescription>
                            Altere os dados da modalidade e clique em salvar.
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[80vh] p-6">
                        <ModalityForm setOpen={(isOpen) => !isOpen && setEditingModality(null)} modality={editingModality} existingModalities={modalities || []} />
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deletingModality} onOpenChange={(isOpen) => !isOpen && setDeletingModality(null)}>
                <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                    Esta ação não pode ser desfeita. Isso excluirá permanentemente a modalidade
                    <span className="font-bold"> "{deletingModality?.name}"</span> do sistema.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Confirmar</AlertDialogAction>
                </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

const ncSettingsSchema = z.object({
  warning: z.coerce.number().min(0, "O valor deve ser positivo."),
  critical: z.coerce.number().min(0, "O valor deve ser positivo."),
}).refine(data => data.warning > data.critical, {
    message: "O alerta de atenção deve ter mais dias que o alerta crítico.",
    path: ["warning"],
});


export function NCSettingsTab() {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const settingsDocRef = useMemoFirebase(() => firestore ? doc(firestore, 'settings', 'global') : null, [firestore]);
    const { data: settings, isLoading } = useDoc<AppSettings>(settingsDocRef);

    const form = useForm<z.infer<typeof ncSettingsSchema>>({
        resolver: zodResolver(ncSettingsSchema),
        defaultValues: {
            warning: 30,
            critical: 7,
        }
    });
    
    useEffect(() => {
        if (settings && settings.ncAlertDays) {
            form.reset(settings.ncAlertDays);
        }
    }, [settings, form]);
    
    const onSubmit = (values: z.infer<typeof ncSettingsSchema>) => {
        if (!firestore) {
             toast({ variant: "destructive", title: "Erro de Conexão!" });
             return;
        }

        const settingsRef = doc(firestore, "settings", "global");
        setDocumentNonBlocking(settingsRef, {
            id: 'global',
            ncAlertDays: values
        }, { merge: true });

        toast({
            title: "Sucesso!",
            description: "Configurações de alerta da NC salvas.",
        });
    }

    return (
         <Card>
            <CardHeader>
                <CardTitle>Configurações das Notas de Crédito</CardTitle>
                <CardDescription>Defina os parâmetros de alerta para o vencimento das NCs.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-md">
                        <FormField
                            control={form.control}
                            name="warning"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Alerta de Atenção (Laranja)</FormLabel>
                                    <div className="flex items-center gap-2">
                                        <FormControl>
                                            <Input type="number" className="w-24" {...field} />
                                        </FormControl>
                                        <span>dias antes do vencimento</span>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="critical"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Alerta Crítico (Vermelho)</FormLabel>
                                    <div className="flex items-center gap-2">
                                        <FormControl>
                                            <Input type="number" className="w-24" {...field} />
                                        </FormControl>
                                         <span>dias antes do vencimento</span>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" disabled={isLoading || form.formState.isSubmitting}>
                            {form.formState.isSubmitting ? "Salvando..." : "Salvar Configurações"}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}

    