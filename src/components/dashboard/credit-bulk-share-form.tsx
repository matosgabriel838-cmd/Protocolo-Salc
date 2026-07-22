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
import { useToast } from "@/hooks/use-toast"
import { CreditNote, OM } from "@/lib/data"
import { useFirestore, useUser } from "@/firebase"
import { doc, runTransaction } from "firebase/firestore"
import { useMemo } from "react"
import { ScrollArea } from "../ui/scroll-area"

const formSchema = z.object({
  omId: z.string().min(1, "Selecione a OM de destino."),
});

interface CreditBulkShareFormProps {
    creditNotes: CreditNote[];
    oms: OM[];
    setOpen: (open: boolean) => void;
}

export function CreditBulkShareForm({ creditNotes, oms, setOpen }: CreditBulkShareFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const totalValue = useMemo(() => {
      return creditNotes.reduce((sum, note) => sum + note.totalValue, 0);
  }, [creditNotes]);

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || isNaN(value)) return "";
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  const sortedOMs = useMemo(() => {
    if(!oms) return [];
    return [...oms].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [oms]);
  
  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !user) {
      toast({ variant: "destructive", title: "Erro de Conexão ou Autenticação!" });
      return;
    }
    
    try {
        await runTransaction(firestore, async (transaction) => {
            for (const note of creditNotes) {
                const docRef = doc(firestore, "creditNotes", note.id);
                const share = {
                    omId: values.omId,
                    value: note.totalValue,
                    sharedAt: new Date().toISOString(),
                    sharedBy: user.uid,
                };
                // NOTE: This will overwrite any existing shares on the note.
                transaction.update(docRef, { shares: [share] });
            }
        });

        toast({
            title: "Sucesso!",
            description: `${creditNotes.length} NC(s) tiveram seu valor total partilhado.`,
        });
        setOpen(false);

    } catch (error: any) {
         toast({
            variant: "destructive",
            title: "Erro ao Salvar Partilhas",
            description: error.message || "Não foi possível salvar as partilhas. Tente novamente.",
        });
    }
  }
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        <div className="space-y-2 text-sm p-4 border rounded-md bg-muted/50">
            <div className="flex justify-between">
                <span className="text-muted-foreground">NCs Selecionadas:</span>
                <span className="font-medium">{creditNotes.length}</span>
            </div>
            <div className="flex justify-between font-bold text-base pt-2 border-t mt-2">
                <span className="text-foreground">Valor Total a ser Partilhado:</span>
                <span className="text-foreground">{formatCurrency(totalValue)}</span>
            </div>
            <p className="text-xs text-muted-foreground pt-2">O valor total de cada NC selecionada será alocado para a OM de destino. Quaisquer partilhas existentes nestas NCs serão sobrescritas.</p>
        </div>

        <FormField
            control={form.control}
            name="omId"
            render={({ field }) => (
            <FormItem>
                <FormLabel>OM de Destino</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecione a OM de destino" /></SelectTrigger>
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

        <div className="flex justify-end pt-4">
            <Button type="submit" disabled={!firestore || !user}>
                Confirmar Partilha em Lote
            </Button>
        </div>
      </form>
    </Form>
  )
}