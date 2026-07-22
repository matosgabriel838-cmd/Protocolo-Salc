
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
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, addDocumentNonBlocking, useMemoFirebase, setDocumentNonBlocking, useCollection } from "@/firebase"
import { collection, doc, query } from "firebase/firestore"
import { v4 as uuidv4 } from 'uuid';
import { OM, UserProfile } from "@/lib/data"
import { useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { ScrollArea } from "../ui/scroll-area"

const formSchema = z.object({
  code: z.string().min(1, "O código é obrigatório."),
  abbreviation: z.string().min(1, "A sigla é obrigatória."),
  name: z.string().min(1, "O nome é obrigatório."),
  responsibleUserId: z.string().optional(),
});

type OrganizationFormProps = {
    setOpen: (open: boolean) => void;
    organization?: OM | null;
}

export function OrganizationForm({ setOpen, organization }: OrganizationFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();

  const isEditing = !!organization;

  const usersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "users")) : null, [firestore]);
  const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      abbreviation: "",
      name: "",
      responsibleUserId: "",
    },
  });

  useEffect(() => {
    if (isEditing && organization) {
        form.reset({
            code: organization.code,
            abbreviation: organization.abbreviation,
            name: organization.name,
            responsibleUserId: organization.responsibleUserId,
        });
    } else {
        form.reset({
            code: "",
            abbreviation: "",
            name: "",
            responsibleUserId: "",
        });
    }
  }, [organization, isEditing, form]);


  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore) {
        toast({
            variant: "destructive",
            title: "Erro de Conexão!",
            description: "Não foi possível conectar ao banco de dados.",
        });
        return;
    }
    
    const finalValues = {
        ...values,
        responsibleUserId: values.responsibleUserId || "",
    }

    if(isEditing && organization) {
        const docRef = doc(firestore, "militaryOrganizations", organization.id);
        setDocumentNonBlocking(docRef, finalValues, { merge: true });
         toast({
            title: "Sucesso!",
            description: "Organização Militar atualizada no sistema.",
        });
    } else {
        const omsCollection = collection(firestore, "militaryOrganizations");
        const newOM = {
            id: uuidv4(),
            ...finalValues,
        };
        addDocumentNonBlocking(omsCollection, newOM);
        toast({
            title: "Sucesso!",
            description: "Organização Militar adicionada ao sistema.",
        });
    }
    
    setOpen(false);
  }

  const isSubmitDisabled = !firestore;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Código</FormLabel>
              <FormControl>
                <Input placeholder="123456" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="abbreviation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sigla</FormLabel>
              <FormControl>
                <Input placeholder="1º BAC" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome Extenso</FormLabel>
              <FormControl>
                <Input placeholder="1º Batalhão de Aviação do Exército" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="responsibleUserId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Responsável pela OM</FormLabel>
              <Select 
                onValueChange={(value) => field.onChange(value === 'none' ? undefined : value)} 
                value={field.value}
              >
                  <FormControl>
                      <SelectTrigger>
                          <SelectValue placeholder="Selecione um militar" />
                      </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                      <ScrollArea className="h-[200px]">
                          <SelectItem value="none">Nenhum</SelectItem>
                          {users?.map(user => (
                              <SelectItem key={user.id} value={user.id}>
                                  {user.rank} {user.warName}
                              </SelectItem>
                          ))}
                      </ScrollArea>
                  </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSubmitDisabled}>
              {isEditing ? "Salvar Alterações" : "Salvar Organização"}
            </Button>
        </div>
      </form>
    </Form>
  )
}
