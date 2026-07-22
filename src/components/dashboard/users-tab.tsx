

"use client"

import { useState, useMemo } from "react";
import { PlusCircle, Edit, Trash2, KeyRound } from "lucide-react";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserProfile, OM } from "@/lib/data";
import { useAuth, useCollection, useFirestore, useMemoFirebase, useUser, deleteDocumentNonBlocking } from "@/firebase";
import { collection, query, orderBy, doc } from "firebase/firestore";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserForm } from "./user-form";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { sendPasswordResetEmail } from "firebase/auth";
import { ScrollArea } from "../ui/scroll-area";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";

export function UsersTab() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userToReset, setUserToReset] = useState<UserProfile | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const { toast } = useToast();
  
  const firestore = useFirestore();
  const auth = useAuth();
  const { user: currentUser } = useUser();

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "users"), orderBy("warName"));
  }, [firestore]);

  const { data: users, isLoading } = useCollection<UserProfile>(usersQuery);

  const omsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'militaryOrganizations') : null, [firestore]);
  const { data: oms, isLoading: isLoadingOms } = useCollection<OM>(omsQuery);
  const omsMap = useMemo(() => oms ? new Map(oms.map(om => [om.id, om])) : new Map(), [oms]);

  const handleEdit = (user: UserProfile) => {
    setEditingUser(user);
    setIsFormOpen(true);
  }

  const handleAdd = () => {
    setEditingUser(null);
    setIsFormOpen(true);
  }
  
  const handleDelete = (user: UserProfile) => {
    if (user.id === currentUser?.uid) {
        toast({
            variant: "destructive",
            title: "Ação não permitida",
            description: "Você não pode excluir a si mesmo.",
        });
        return;
    }
    setUserToDelete(user);
  };

  const confirmDelete = () => {
    if (!userToDelete || !firestore) return;

    const userDocRef = doc(firestore, "users", userToDelete.id);
    deleteDocumentNonBlocking(userDocRef);

    toast({
        title: "Usuário Removido do Sistema",
        description: `O perfil de "${userToDelete.username}" foi excluído. Para remover completamente o acesso, exclua o usuário na aba 'Authentication' do seu Console do Firebase.`,
        duration: 9000,
    });
    setUserToDelete(null);
  };

  const handleResetPassword = (user: UserProfile) => {
    setUserToReset(user);
  };
  
  const confirmResetPassword = async () => {
    if (!userToReset || !auth) return;
    try {
        await sendPasswordResetEmail(auth, userToReset.email);
        toast({
            title: "E-mail de redefinição enviado!",
            description: `Um e-mail foi enviado para ${userToReset.email} com instruções.`,
        });
    } catch (error: any) {
         toast({
            variant: "destructive",
            title: "Erro ao enviar e-mail",
            description: error.message || "Não foi possível enviar o e-mail de redefinição de senha.",
        });
    } finally {
        setUserToReset(null);
    }
  }

  const getRoleVariant = (role: string) => {
    switch(role) {
      case 'ADMIN': return 'destructive';
      case 'VIEWER': return 'secondary';
      default: return 'outline';
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Usuários do Sistema</CardTitle>
                <CardDescription>Consulte e gerencie os usuários cadastrados.</CardDescription>
            </div>
            <Button onClick={handleAdd}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Adicionar Usuário
            </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>P/G</TableHead>
                <TableHead>Nome de Guerra</TableHead>
                <TableHead>Nome de Usuário</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>OM</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="w-[100px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading || isLoadingOms ? (
                 <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      Carregando...
                    </TableCell>
                  </TableRow>
              ) : (!users || users.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.rank}</TableCell>
                    <TableCell>{user.warName}</TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleVariant(user.role)} className={cn(user.role === 'ADMIN' && 'text-white')}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{omsMap.get(user.omId)?.abbreviation || 'N/A'}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.phoneNumber || '—'}</TableCell>
                    <TableCell className="text-right">
                        <TooltipProvider>
                            <div className="flex items-center justify-end gap-2">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(user)}>
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
                                        <Button variant="ghost" size="icon" onClick={() => handleResetPassword(user)}>
                                            <KeyRound className="h-4 w-4" />
                                            <span className="sr-only">Reiniciar Senha</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Enviar e-mail para redefinir senha</p>
                                    </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(user)}>
                                            <Trash2 className="h-4 w-4" />
                                            <span className="sr-only">Excluir</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Excluir Usuário</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Dialog open={isFormOpen} onOpenChange={(isOpen) => { setIsFormOpen(isOpen); if(!isOpen) setEditingUser(null);}}>
        <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
                <DialogTitle>{editingUser ? 'Editar Usuário' : 'Adicionar Novo Usuário'}</DialogTitle>
                <DialogDescription>
                    {editingUser ? 'Altere os dados do usuário abaixo.' : 'Preencha os dados para criar um novo usuário.'}
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[80vh] p-6">
                <UserForm setOpen={setIsFormOpen} user={editingUser} />
            </ScrollArea>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!userToReset} onOpenChange={(isOpen) => !isOpen && setUserToReset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reiniciar Senha?</AlertDialogTitle>
            <AlertDialogDescription>
                Tem certeza que deseja enviar um e-mail de redefinição de senha para <span className="font-bold">{userToReset?.username}</span>?
                Um link para criar uma nova senha será enviado para <span className="font-mono bg-muted p-1 rounded-sm">{userToReset?.email}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmResetPassword}>Confirmar e Enviar E-mail</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!userToDelete} onOpenChange={(isOpen) => !isOpen && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário?</AlertDialogTitle>
            <AlertDialogDescription>
                Você está prestes a remover o perfil de <span className="font-bold">{userToDelete?.username}</span> do sistema.
                <br /><br />
                Esta ação **não pode ser desfeita**. Para remover completamente o acesso, você também precisará excluir o usuário da aba 'Authentication' no Console do Firebase.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Confirmar Exclusão</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
