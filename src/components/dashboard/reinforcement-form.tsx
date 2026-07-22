
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { v4 as uuidv4 } from 'uuid';
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
import { CreditNote, OM, Protocol, ProtocolCreditSource } from "@/lib/data"
import { useFirestore, setDocumentNonBlocking, useUser } from "@/firebase"
import { collection, doc, runTransaction, arrayUnion } from "firebase/firestore"
import { useState, useMemo, useEffect } from "react"
import { Textarea } from "../ui/textarea"
import { ScrollArea } from "../ui/scroll-area"
import { cn } from "@/lib/utils";

// Schema for creating a reinforcement protocol
const formSchema = z.object({
  originalProtocolId: z.string().min(1, "Selecione o empenho original para reforçar."),
  creditSources: z.array(z.object({
      creditNoteId: z.string().min(1, "Selecione uma NC."),
      value: z.coerce.number().min(0.01, "O valor deve ser maior que zero.")
  })).min(1, "Adicione pelo menos uma fonte de crédito."),
  diexNumber: z.string().min(1, "O número do DIEx é obrigatório."),
  pReqNumber: z.string().min(1, "O número do P_Req é obrigatório."),
  entryDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "A data de entrada é obrigatória.",
  }),
  observation: z.string().optional(),
});


interface ReinforcementFormProps {
    setOpen: (open: boolean) => void;
    creditNotes: CreditNote[];
    oms: OM[];
    protocols: Protocol[];
}

export function ReinforcementForm({ setOpen, creditNotes, oms, protocols }: ReinforcementFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const [selectedOriginalProtocol, setSelectedOriginalProtocol] = useState<Protocol | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        entryDate: new Date().toISOString().split('T')[0],
        creditSources: [],
    },
  });

  const handleOriginalProtocolChange = (id: string) => {
    const protocol = protocols.find(p => p.id === id);
    setSelectedOriginalProtocol(protocol || null);
    form.setValue("originalProtocolId", id);
    form.setValue("creditSources", []);
  }

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || isNaN(value)) return "";
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !selectedOriginalProtocol || !user) {
      toast({ variant: "destructive", title: "Erro de Permissão ou Dados!" });
      return;
    }
    
    const totalValue = values.creditSources.reduce((sum, s) => sum + s.value, 0);

    try {
        const om = oms.find(om => om.id === selectedOriginalProtocol.omId);
        if (!om) throw new Error("Organização Militar do protocolo original não encontrada.");
        
        await runTransaction(firestore, async (transaction) => {
            for (const source of values.creditSources) {
                const ncRef = doc(firestore, "creditNotes", source.creditNoteId);
                const ncDoc = await transaction.get(ncRef);
                if (!ncDoc.exists()) throw new Error(`Nota de Crédito ${source.creditNoteId} não encontrada.`);
                if (source.value > ncDoc.data().balance) {
                    throw new Error(`Saldo insuficiente na Nota de Crédito ${ncDoc.data().ncNumber}.`);
                }
            }

            for (const source of values.creditSources) {
                 const ncRef = doc(firestore, "creditNotes", source.creditNoteId);
                 transaction.update(ncRef, { balance: (await transaction.get(ncRef)).data()!.balance - source.value });
            }

            const protocolsCollection = collection(firestore, "protocols");
            const omProtocols = protocols.filter(p => p.omId === selectedOriginalProtocol.omId);
            const nextOmProtocolNumber = (omProtocols.length + 1).toString().padStart(3, '0');
            const controlCode = `${om.code}-${nextOmProtocolNumber}`;
            
            const newProtocolData: Protocol = {
                id: uuidv4(),
                controlCode: controlCode,
                entryDate: new Date(values.entryDate).toISOString(),
                omId: selectedOriginalProtocol.omId,
                diexNumber: values.diexNumber,
                pReqNumber: values.pReqNumber,
                type: "Reforço",
                modalityId: selectedOriginalProtocol.modalityId,
                pregaoNumber: selectedOriginalProtocol.commitments?.[0]?.neNumber, // Storing original NE in pregao field for context
                creditSources: values.creditSources,
                originalProtocolId: values.originalProtocolId,
                value: totalValue,
                observations: values.observation ? [{ text: `Reforço para o empenho ${selectedOriginalProtocol.commitments?.[0]?.neNumber}. Observação: ${values.observation}`, createdAt: new Date().toISOString(), userId: user.uid }] : [{ text: `Reforço para o empenho ${selectedOriginalProtocol.commitments?.[0]?.neNumber}.`, createdAt: new Date().toISOString(), userId: user.uid }],
                status: "Em Análise",
                userId: user.uid,
                createdAt: new Date().toISOString(),
            };
            
            const newProtocolRef = doc(protocolsCollection, newProtocolData.id);
            transaction.set(newProtocolRef, newProtocolData);
        });
        
        toast({ title: "Sucesso!", description: `Protocolo de Reforço gerado.` });
        setOpen(false);

    } catch (error: any) {
      toast({
          variant: "destructive",
          title: "Erro na Criação do Reforço",
          description: error.message || "Não foi possível processar a operação. Tente novamente.",
      });
    }
  }

  const committedProtocols = useMemo(() => {
      return protocols.filter(p => (p.status === "Empenhado" || p.status === "Deferido") && p.type === "Empenho");
  }, [protocols]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
            control={form.control}
            name="originalProtocolId"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Empenho Original</FormLabel>
                <Select onValueChange={handleOriginalProtocolChange} value={field.value}>
                    <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecione o empenho a ser reforçado" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        <ScrollArea className="h-[200px]">
                            {committedProtocols.map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                    {p.commitments?.[0]?.neNumber || p.controlCode} ({oms.find(o => o.id === p.omId)?.abbreviation}) - Valor: {formatCurrency(p.value)}
                                </SelectItem>
                            ))}
                        </ScrollArea>
                    </SelectContent>
                </Select>
                <FormMessage />
            </FormItem>
            )}
        />
        
        {selectedOriginalProtocol && (
            <>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="diexNumber"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nº do DIEx de Reforço</FormLabel>
                                <FormControl>
                                    <Input placeholder="123-SCA" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="pReqNumber"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nº do P_Req de Reforço</FormLabel>
                                <FormControl>
                                    <Input placeholder="456-SALC" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                {/* Simplified to single credit source for now */}
                 <FormField
                    control={form.control}
                    name="creditSources.0.creditNoteId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Fonte do Reforço (NC)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl>
                                    <SelectTrigger><SelectValue placeholder={"Selecione a NC para o reforço"} /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <ScrollArea className="h-[200px]">
                                    {creditNotes.filter(nc => nc.balance > 0 && nc.shares?.some(s => s.omId === selectedOriginalProtocol.omId)).map(note => (
                                        <SelectItem key={note.id} value={note.id}>
                                            {note.uasg} / {note.ncNumber} / {note.pi} / (Saldo: {formatCurrency(note.balance)})
                                        </SelectItem>
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
                    name="creditSources.0.value"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Valor do Reforço</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="R$ 0,00"
                                    type="text" // Use text to manage formatting
                                    value={formatCurrency(field.value) || ""}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/\D/g, '');
                                        field.onChange(value ? parseInt(value, 10) / 100 : 0);
                                    }}
                                    className={"text-right"}
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
                            <FormLabel>Observação (Opcional)</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="Justificativa ou detalhe do reforço."
                                    className="resize-none"
                                    {...field}
                                    value={field.value || ''}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </>
        )}

        <div className="flex justify-end pt-4">
            <Button type="submit" disabled={!firestore || !selectedOriginalProtocol || !user || !form.formState.isValid}>
                Gerar Protocolo de Reforço
            </Button>
        </div>
      </form>
    </Form>
  )
}
