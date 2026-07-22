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
import { OM } from "@/lib/data"
import { useFirestore, addDocumentNonBlocking, useUser } from "@/firebase"
import { collection } from "firebase/firestore"
import { Textarea } from "../ui/textarea"
import { useMemo } from "react"
import { ScrollArea } from "../ui/scroll-area"
import { v4 as uuidv4 } from 'uuid';

const formSchema = z.object({
  omId: z.string().min(1, "Selecione a OM."),
  uasg: z.enum(["160098", "167098"], {
    required_error: "A UASG é obrigatória.",
  }),
  diexNumber: z.string().min(1, "O número do DIEx é obrigatório."),
  neNumber: z.string().min(1, "O número do empenho é obrigatório."),
  value: z.coerce.number().min(0.01, "O valor a cancelar deve ser maior que zero."),
  observation: z.string().min(1, "A observação é obrigatória."),
});

interface CancellationFormProps {
    oms: OM[];
    setOpen: (open: boolean) => void;
}

export function CancellationForm({ oms, setOpen }: CancellationFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        omId: "",
        neNumber: "",
        observation: "",
        diexNumber: "",
        value: 0,
    },
  });

  const uasgWatch = form.watch("uasg");

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || isNaN(value)) return "";
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    const numberValue = value ? parseInt(value, 10) / 100 : 0;
    form.setValue('value', numberValue, { shouldValidate: true });
  };
  
  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !user ) {
      toast({ variant: "destructive", title: "Erro de Conexão ou Autenticação!" });
      return;
    }

    try {
        const cancellationLogsCollection = collection(firestore, 'cancellationLogs');
        const newLog = {
            id: uuidv4(),
            ...values,
            diexNumber: values.diexNumber.toUpperCase(),
            neNumber: values.neNumber.toUpperCase(),
            observation: values.observation.toUpperCase(),
            createdBy: user.uid,
            createdAt: new Date().toISOString(),
        }

        addDocumentNonBlocking(cancellationLogsCollection, newLog);
        
        toast({ title: "Sucesso!", description: "Lançamento de cancelamento registrado." });
        
        setOpen(false);
    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Erro ao processar",
            description: error.message || "Não foi possível concluir a operação.",
        });
    }
  }

  const sortedOMs = useMemo(() => {
    if(!oms) return [];
    return [...oms].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [oms]);


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        <FormField
            control={form.control}
            name="omId"
            render={({ field }) => (
            <FormItem>
                <FormLabel>OM</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecione a OM" /></SelectTrigger>
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
            name="diexNumber"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Nº do DIEx</FormLabel>
                    <FormControl>
                        <Input 
                            placeholder="Ex: 456-Seç/SAdm" 
                            {...field}
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
        
        <div className="grid grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="uasg"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>UASG</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione a UASG" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        <SelectItem value="160098">160098</SelectItem>
                        <SelectItem value="167098">167098</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="neNumber"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Nº do Empenho Cancelado</FormLabel>
                        <FormControl>
                            <Input 
                                placeholder="Ex: 2023NE000123" 
                                {...field} 
                                onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                disabled={!uasgWatch}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>


        <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Valor Cancelado</FormLabel>
                    <FormControl>
                        <Input
                            placeholder="R$ 0,00"
                            {...field}
                            value={formatCurrency(field.value) || ""}
                            onChange={handleValueChange}
                            onBlur={field.onBlur}
                            className="text-right"
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />

        <FormField
            control={form.control}
            name="observation"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Observação</FormLabel>
                    <FormControl>
                        <Textarea
                            placeholder="Descreva o motivo ou detalhes do cancelamento."
                            className="resize-none"
                            {...field}
                             onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />

        <div className="flex justify-end pt-4">
            <Button type="submit" disabled={!firestore || !user}>
                Registrar Cancelamento
            </Button>
        </div>
      </form>
    </Form>
  )
}