
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
import { CreditNote, CreditNoteRecollection } from "@/lib/data"
import { useFirestore, useUser } from "@/firebase"
import { doc, runTransaction, arrayUnion } from "firebase/firestore"
import { Textarea } from "../ui/textarea"
import { useState } from "react"
import { ScrollArea } from "../ui/scroll-area"

const formSchema = z.object({
  creditNoteId: z.string().min(1, "Selecione uma Nota de Crédito."),
  value: z.coerce.number().min(0.01, "O valor recolhido deve ser maior que zero."),
  recollectionDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "A data de recolhimento é obrigatória.",
  }),
  observation: z.string().optional(),
});

interface CreditRecollectionFormProps {
    creditNotes: CreditNote[];
    setOpen: (open: boolean) => void;
}

export function CreditRecollectionForm({ creditNotes, setOpen }: CreditRecollectionFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const [selectedNC, setSelectedNC] = useState<CreditNote | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      creditNoteId: "",
      value: 0,
      recollectionDate: new Date().toISOString().split('T')[0],
      observation: "",
    },
  });
  
  const handleNCChange = (id: string) => {
    const note = creditNotes.find(n => n.id === id);
    setSelectedNC(note || null);
    form.setValue("creditNoteId", id);
  }

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || isNaN(value)) return "";
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  
  const filteredNotes = creditNotes.filter(note => {
      const search = searchTerm.toLowerCase();
      return (
          note.ncNumber.toLowerCase().includes(search) ||
          note.uasg.toLowerCase().includes(search) ||
          (note.pi && note.pi.toLowerCase().includes(search))
      );
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !selectedNC || !user) {
      toast({ variant: "destructive", title: "Erro de Permissão ou Dados!" });
      return;
    }
    
    if (values.value > selectedNC.balance) {
        form.setError("value", { message: "O valor do recolhimento não pode ser maior que o saldo disponível." });
        return;
    }

    const docRef = doc(firestore, "creditNotes", values.creditNoteId);

    const newRecollection: CreditNoteRecollection = {
        recollectedAt: new Date(values.recollectionDate).toISOString(),
        recollectedBy: user.uid,
        value: values.value,
        observation: values.observation || "",
    }

    try {
        await runTransaction(firestore, async (transaction) => {
            const ncDoc = await transaction.get(docRef);
            if (!ncDoc.exists()) {
                throw new Error("Nota de Crédito não encontrada.");
            }

            const currentData = ncDoc.data() as CreditNote;
            
            if (values.value > currentData.balance) {
                 throw new Error("O valor do recolhimento excede o saldo atual da NC.");
            }

            const newTotalValue = currentData.totalValue - values.value;
            const newBalance = currentData.balance - values.value;

            transaction.update(docRef, {
                totalValue: newTotalValue,
                balance: newBalance,
                recollections: arrayUnion(newRecollection)
            });
        });

        toast({
            title: "Sucesso!",
            description: "Recolhimento de crédito registrado.",
        });
        setOpen(false);

    } catch (error: any) {
         toast({
            variant: "destructive",
            title: "Erro ao Salvar",
            description: error.message || "Não foi possível registrar o recolhimento. Tente novamente.",
        });
    }
  }

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    const numberValue = value ? parseInt(value, 10) / 100 : 0;
    form.setValue('value', numberValue, { shouldValidate: true });
  };
  
  const valueWatch = form.watch("value");
  const newBalance = selectedNC ? selectedNC.balance - valueWatch : undefined;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-2">
          <FormLabel>Nota de Crédito (NC)</FormLabel>
          <Input 
            placeholder="Pesquisar por Nº da NC, UASG ou PI..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-2"
          />
          <FormField
            control={form.control}
            name="creditNoteId"
            render={({ field }) => (
              <FormItem>
                  <Select onValueChange={handleNCChange} defaultValue={field.value}>
                      <FormControl>
                          <SelectTrigger>
                              <SelectValue placeholder="Selecione a NC para recolher o crédito" />
                          </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <ScrollArea className="h-[200px]">
                          {filteredNotes
                          .filter(note => note.balance > 0)
                          .map(note => (
                              <SelectItem key={note.id} value={note.id}>
                                  NC: {note.ncNumber} | UASG: {note.uasg} | PI: {note.pi} | Saldo: {formatCurrency(note.balance)}
                              </SelectItem>
                          ))}
                           {filteredNotes.length === 0 && <div className="p-4 text-sm text-muted-foreground">Nenhuma NC encontrada.</div>}
                        </ScrollArea>
                      </SelectContent>
                  </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        {selectedNC && (
            <div className="space-y-2 text-sm p-4 border rounded-md bg-muted/50">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Saldo Atual da NC:</span>
                    <span className="font-medium">{formatCurrency(selectedNC.balance)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor a Recolher:</span>
                    <span className="font-medium text-destructive">{formatCurrency(valueWatch)}</span>
                </div>
                <div className="flex justify-between font-bold text-base pt-2 border-t mt-2">
                    <span className="text-foreground">Novo Saldo (após recolhimento):</span>
                    <span className={newBalance !== undefined && newBalance < 0 ? 'text-destructive' : 'text-foreground'}>
                        {formatCurrency(newBalance)}
                    </span>
                </div>
            </div>
        )}

        <div className="grid grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Valor a ser Recolhido</FormLabel>
                        <FormControl>
                            <Input
                                placeholder="R$ 0,00"
                                {...field}
                                value={formatCurrency(field.value) || ""}
                                onChange={handleValueChange}
                                onBlur={field.onBlur}
                                className="text-right"
                                disabled={!selectedNC}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="recollectionDate"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Data do Recolhimento</FormLabel>
                        <FormControl>
                            <Input type="date" {...field} disabled={!selectedNC} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>

        <FormField
            control={form.control}
            name="observation"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Observação</FormLabel>
                    <FormControl>
                        <Textarea
                            placeholder="Insira o motivo ou outra informação sobre o recolhimento."
                            className="resize-none"
                            {...field}
                            disabled={!selectedNC}
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />

        <div className="flex justify-end pt-4">
            <Button type="submit" disabled={!firestore || !selectedNC || !valueWatch || (newBalance !== undefined && newBalance < 0) || !user}>
                Registrar Recolhimento
            </Button>
        </div>
      </form>
    </Form>
  )
}
