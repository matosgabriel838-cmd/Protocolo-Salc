"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { useFirebaseApp, useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { collection, doc, updateDoc } from "firebase/firestore"
import { UserProfile, RANKS, Rank, OM, UserRole, ROLES } from "@/lib/data"
import { useEffect, useMemo } from "react"
import { ScrollArea } from "../ui/scroll-area"
import { getFunctions, httpsCallable } from "firebase/functions"

// Schema para criação
const createSchema = z.object({
  email: z.string().email({ message: "Por favor, insira um email válido." }),
  rank: z.enum(RANKS, { required_error: "O Posto/Graduação é obrigatório." }),
  warName: z.string().min(1, "O nome de guerra é obrigatório."),
  phoneNumber: z.string().optional(),
  omId: z.string().min(1, "A OM é obrigatória."),
  role: z.enum(ROLES, { required_error: "A função é obrigatória."}),
});

// Schema para edição
const editSchema = z.object({
  rank: z.enum(RANKS, { required_error: "O Posto/Graduação é obrigatório." }),
  warName: z.string().min(1, "O nome de guerra é obrigatório."),
  phoneNumber: z.string().optional(),
  omId: z.string().min(1, "A OM é obrigatória."),
  role: z.enum(ROLES, { required_error: "A função é obrigatória."}),
});


type UserFormProps = {
    setOpen: (open: boolean) => void;
    user?: UserProfile | null;
}

export function UserForm({ setOpen, user }: UserFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const functions = getFunctions(firebaseApp);

  const isEditing = !!user;

  const omsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'militaryOrganizations') : null, [firestore]);
  const { data: oms, isLoading: isLoadingOms } = useCollection<OM>(omsQuery);

  const form = useForm<any>({
    resolver: zodResolver(isEditing ? editSchema : createSchema),
    defaultValues: user ? { ...user } : {
      email: "",
      warName: "",
      phoneNumber: "",
      omId: "",
      role: "VIEWER",
    },
  });
  
  useEffect(() => {
    if (user) {
      form.reset({
        rank: user.rank,
        warName: user.warName,
        omId: user.omId,
        role: user.role,
        phoneNumber: user.phoneNumber || ""
      });
    }
  }, [user, form]);

  async function onSubmit(values: any) {
    if (!firestore) {
        toast({variant: 'destructive', title: 'Erro de conexão.'});
        return;
    }
    
    // Normalizamos dados críticos
    const rankFormatted = values.rank.toLowerCase().replace(/[\d\sºª.]/g, '');
    const warNameFormatted = values.warName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '');
    const username = `${rankFormatted}.${warNameFormatted}`;

    if (isEditing && user) {
        // EDIÇÃO: Atualiza Firestore diretamente
        const userDocRef = doc(firestore, "users", user.id);
        
        try {
            await updateDoc(userDocRef, {
                rank: values.rank,
                warName: values.warName,
                omId: values.omId,
                username: username,
                role: values.role,
                phoneNumber: values.phoneNumber || "",
            });

            toast({
                title: "Sucesso!",
                description: `Usuário "${username}" atualizado.`,
            });
            setOpen(false);
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Erro ao atualizar",
                description: error.message || "Não foi possível completar a operação.",
            });
        }
    } else { 
        // CRIAÇÃO: Chama a Cloud Function
        try {
            const normalizedEmail = values.email.trim().toLowerCase();
            const createUserFn = httpsCallable(functions, 'createuser');
            
            const result: any = await createUserFn({
                ...values,
                email: normalizedEmail
            });
            
            toast({
                title: "Usuário Criado!",
                description: result.data.result + " A senha padrão é: sisgec2026",
            });
            setOpen(false);
        } catch (error: any) {
             console.error("Erro na Cloud Function:", error);
             let description = error.message || "Falha no servidor.";
             
             if (error.code === 'already-exists' || error.message.includes('already in use')) {
                 description = "Este e-mail já está cadastrado no sistema.";
             }

             toast({
                variant: "destructive",
                title: "Falha na Criação",
                description: description,
            });
        }
    }
  }

  const isSubmitDisabled = isLoadingOms;
  const sortedOMs = useMemo(() => oms ? [...oms].sort((a,b) => a.code.localeCompare(b.code, undefined, {numeric: true})) : [], [oms]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        
        <div className="grid grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="rank"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>P/G</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value as Rank}>
                        <FormControl>
                            <SelectTrigger><SelectValue placeholder="Posto" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {RANKS.map(rank => (
                                <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
             <FormField
                control={form.control}
                name="warName"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Nome de Guerra</FormLabel>
                    <FormControl>
                        <Input placeholder="NOME" {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
        </div>
       
        {!isEditing && (
            <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                        <Input placeholder="usuario@eb.mil.br" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
        )}
        
        <FormField
          control={form.control}
          name="phoneNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telefone</FormLabel>
              <FormControl>
                <Input placeholder="(62) 99999-9999" type="tel" {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="omId"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>OM</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                            <SelectTrigger><SelectValue placeholder="OM" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <ScrollArea className="h-[200px]">
                            {sortedOMs.map(om => (
                                <SelectItem key={om.id} value={om.id}>{om.code} - {om.abbreviation}</SelectItem>
                            ))}
                        </ScrollArea>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Função</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value as UserRole}>
                        <FormControl>
                            <SelectTrigger><SelectValue placeholder="Papel" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {ROLES.map(role => (
                                <SelectItem key={role} value={role}>{role}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>

        <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSubmitDisabled || form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Processando...' : (isEditing ? 'Salvar' : 'Criar')}
            </Button>
        </div>
      </form>
    </Form>
  )
}