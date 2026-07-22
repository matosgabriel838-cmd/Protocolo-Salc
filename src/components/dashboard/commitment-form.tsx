
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useFieldArray } from "react-hook-form"
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
import { CreditNote, OM, Protocol, ProtocolObservation, Commitment, ProtocolStatus } from "@/lib/data"
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { doc, arrayUnion, runTransaction, collection, query } from "firebase/firestore"
import { Textarea } from "../ui/textarea"
import { useState, useMemo } from "react"
import { ScrollArea } from "../ui/scroll-area"
import { PlusCircle, Trash2 } from "lucide-react"

const currentYear = new Date().getFullYear();

const commitmentSchema = z.object({
  neNumber: z.string()
    .length(12, "O nº do empenho deve ter 12 caracteres (ex: 2024NE000123).")
    .refine(val => val.toUpperCase().startsWith(`${currentYear}NE`), `O nº do Empenho deve começar com ${currentYear}NE.`),
  neDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "A data de emissão é obrigatória.",
  }),
  value: z.coerce.number().min(0.01, "O valor do empenho deve ser maior que zero."),
  observation: z.string().optional(),
});

const formSchema = z.object({
  protocolId: z.string().min(1, "Selecione um protocolo."),
  commitments: z.array(commitmentSchema).min(1, "Adicione pelo menos um empenho."),
  status: z.enum(["Em Análise", "Correção", "Deferido", "Restituído", "Empenhado", "Anulado"]),
});

interface CommitmentFormProps {
    protocols: Protocol[];
    creditNotes: CreditNote[];
    oms: OM[];
    setOpen: (open: boolean) => void;
}

export function CommitmentForm({ protocols: displayedProtocols, creditNotes, oms, setOpen }: CommitmentFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Fetch ALL protocols for validation purposes to check for duplicates across the entire DB
  const allProtocolsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "protocols")) : null, [firestore]);
  const { data: allProtocols } = useCollection<Protocol>(allProtocolsQuery);


  const creditNotesMap = useMemo(() => creditNotes ? new Map(creditNotes.map(nc => [nc.id, nc])) : new Map(), [creditNotes]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      protocolId: "",
      commitments: [],
      status: "Empenhado",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "commitments",
  });
  
  const valueCommittedInDb = useMemo(() => {
    if (!selectedProtocol) return 0;
    return selectedProtocol.commitments?.reduce((sum, c) => sum + c.value, 0) || 0;
  }, [selectedProtocol]);

  const remainingValue = useMemo(() => {
    if (!selectedProtocol) return 0;
    return selectedProtocol.value - valueCommittedInDb;
  }, [selectedProtocol, valueCommittedInDb]);


  const handleProtocolChange = (id: string) => {
    const protocol = displayedProtocols.find(p => p.id === id);

    if (protocol) {
      const uasgs = [...new Set(protocol.creditSources.map(s => creditNotesMap.get(s.creditNoteId)?.uasg).filter(Boolean))];
      if (uasgs.length > 1) {
        toast({
          variant: "destructive",
          title: "Protocolo com Múltiplas UASGs",
          description: "Este protocolo é financiado por múltiplas UASGs e não pode ter empenhos lançados por este formulário. Por favor, ajuste o protocolo."
        });
        setSelectedProtocol(null);
        form.setValue("protocolId", "");
        return;
      }
    }

    setSelectedProtocol(protocol || null);
    form.setValue("protocolId", id);
    form.setValue("commitments", []); // Reset commitments when protocol changes
    if (protocol) {
      const remaining = protocol.value - (protocol.commitments?.reduce((s,c) => s + c.value, 0) || 0);
      append({
          neNumber: `${currentYear}NE`,
          neDate: new Date().toISOString().split('T')[0],
          value: remaining > 0 ? remaining : 0,
          observation: ""
      });
    }
  }

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || isNaN(value)) return "";
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    let value = e.target.value.replace(/\D/g, '');
    const numberValue = value ? parseInt(value, 10) / 100 : 0;
    form.setValue(`commitments.${index}.value`, numberValue, { shouldValidate: true });
  };
  
  const filteredProtocols = useMemo(() => {
      if (!displayedProtocols) return [];
      
      const protocolsPendingCommitment = displayedProtocols.filter(p => {
          const totalCommitted = p.commitments?.reduce((sum, c) => sum + c.value, 0) || 0;
          const validStatuses: ProtocolStatus[] = ["Deferido", "Em Análise", "Correção"];
          return validStatuses.includes(p.status) && (p.value - totalCommitted > 0.001);
      });

      if (!searchTerm) return protocolsPendingCommitment;

      const search = searchTerm.toLowerCase();
      return protocolsPendingCommitment.filter(p => 
          p.controlCode.toLowerCase().includes(search)
      );

  }, [displayedProtocols, searchTerm]);
  
  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !selectedProtocol || !user || !allProtocols) {
      toast({ variant: "destructive", title: "Aguardando carregamento de dados..." });
      return;
    }

    const totalNewCommitmentValue = values.commitments.reduce((sum, c) => sum + c.value, 0);
    
    if (totalNewCommitmentValue > remainingValue + 0.001) {
        form.setError("commitments", { message: `O valor total dos novos empenhos não pode ser maior que o saldo restante do protocolo: ${formatCurrency(remainingValue)}` });
        return;
    }
    
    // Check for duplicate NE numbers within the current form submission
    const formNeNumbers = values.commitments.map(c => c.neNumber.toUpperCase());
    if (new Set(formNeNumbers).size !== formNeNumbers.length) {
         form.setError("commitments", { message: `Existem números de empenho duplicados no preenchimento.` });
        return;
    }

    // Identify the UASG of the protocol
    const protocolNC = creditNotesMap.get(selectedProtocol.creditSources[0]?.creditNoteId);
    if (!protocolNC) {
        toast({ variant: "destructive", title: "Erro de Dados", description: "Nota de crédito do protocolo não encontrada." });
        return;
    }
    const protocolUasg = protocolNC.uasg;

    // Check for duplicates against the entire database for the same UASG
    const allExistingNeNumbersForUasg = new Set<string>();
    allProtocols.forEach(p => {
        // Find UASG for this protocol's first credit source
        const uasgForP = p.creditSources.length > 0 ? creditNotesMap.get(p.creditSources[0].creditNoteId)?.uasg : undefined;
        if (uasgForP === protocolUasg && p.commitments) {
            p.commitments.forEach(c => {
                allExistingNeNumbersForUasg.add(c.neNumber.toUpperCase());
            });
        }
    });

    const duplicatesInDb = formNeNumbers.filter(neNumber => allExistingNeNumbersForUasg.has(neNumber));

    if (duplicatesInDb.length > 0) {
        toast({
            variant: "destructive",
            title: "NE Duplicada",
            description: `O empenho ${duplicatesInDb[0]} já existe para a UASG ${protocolUasg}.`,
        });
        form.setError("commitments", { message: `NE Duplicada: ${duplicatesInDb.join(', ')} já cadastrada na UASG ${protocolUasg}.` });
        return;
    }

    const protocolRef = doc(firestore, "protocols", selectedProtocol.id);
    
    try {
        await runTransaction(firestore, async (transaction) => {
            const protocolDoc = await transaction.get(protocolRef);
            if (!protocolDoc.exists()) {
                throw new Error("Protocolo não encontrado.");
            }
            
            const currentProtocol = protocolDoc.data() as Protocol;
            const newTotalCommitted = valueCommittedInDb + totalNewCommitmentValue;

            const newCommitments: Commitment[] = values.commitments.map(c => ({
                neNumber: c.neNumber.toUpperCase(),
                neDate: new Date(c.neDate).toISOString(),
                value: c.value,
                observation: c.observation || "",
                createdAt: new Date().toISOString(),
                createdBy: user.uid,
            }));

            const observationsText = newCommitments.map(c => `Empenho ${c.neNumber} no valor de ${formatCurrency(c.value)} lançado.`).join(' ');
            const newObservation: ProtocolObservation = {
                text: `${observationsText} Situação alterada para ${values.status}.`,
                createdAt: new Date().toISOString(),
                userId: user.uid,
            };
            
            const isFullyCommitted = Math.abs(newTotalCommitted - currentProtocol.value) < 0.001;
            const newStatus = isFullyCommitted ? 'Empenhado' : values.status;
            
            const finalCommitments = [...(currentProtocol.commitments || []), ...newCommitments];

            transaction.update(protocolRef, {
                commitments: finalCommitments,
                observations: arrayUnion(newObservation),
                status: newStatus,
                updatedAt: new Date().toISOString(),
            });
        });

        toast({
            title: "Sucesso!",
            description: "Empenho(s) lançado(s) com sucesso.",
        });
        setOpen(false);

    } catch (error: any) {
         toast({
            variant: "destructive",
            title: "Erro ao Lançar Empenho",
            description: error.message || "Não foi possível processar a operação.",
        });
    }
  }

  const om = selectedProtocol ? oms.find(o => o.id === selectedProtocol.omId) : null;
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-2">
            <FormLabel>Protocolo (P_Req)</FormLabel>
            <Input 
                placeholder="Pesquisar por Cód. Controle..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mb-2"
            />
            <FormField
                control={form.control}
                name="protocolId"
                render={({ field }) => (
                <FormItem>
                    <Select onValueChange={handleProtocolChange} value={field.value}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o protocolo para empenhar" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <ScrollArea className="h-[200px]">
                            {filteredProtocols.map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                    {p.controlCode} | {oms.find(o => o.id === p.omId)?.abbreviation} | {formatCurrency(p.value)}
                                </SelectItem>
                            ))}
                            {filteredProtocols.length === 0 && <div className="p-4 text-sm text-muted-foreground">Nenhum protocolo pendente de empenho encontrado.</div>}
                            </ScrollArea>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>
        
        {selectedProtocol && (
            <div className="space-y-2 text-sm p-4 border rounded-md bg-muted/50">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">OM:</span>
                    <span className="font-medium">{om?.abbreviation}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">UASG:</span>
                    <span className="font-medium">{creditNotesMap.get(selectedProtocol.creditSources[0]?.creditNoteId)?.uasg || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor do Protocolo:</span>
                    <span className="font-medium">{formatCurrency(selectedProtocol.value)}</span>
                </div>
                 <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor já Empenhado:</span>
                    <span className="font-medium">{formatCurrency(valueCommittedInDb)}</span>
                </div>
                <div className="flex justify-between font-bold">
                    <span className="text-foreground">Saldo a Empenhar:</span>
                    <span className="text-foreground">{formatCurrency(remainingValue)}</span>
                </div>
            </div>
        )}

        <div className="space-y-4 max-h-[350px] overflow-y-auto p-1">
            {fields.map((field, index) => (
                <div key={field.id} className="grid gap-4 p-4 border rounded-lg relative">
                     <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute -top-3 -right-3 h-6 w-6 text-destructive hover:text-destructive bg-background rounded-full border shadow-sm"
                        onClick={() => remove(index)}
                        disabled={fields.length <= 1}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                    <div className="grid grid-cols-2 gap-4">
                         <FormField
                            control={form.control}
                            name={`commitments.${index}.neNumber`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nº do Empenho (6 dígitos finais)</FormLabel>
                                    <FormControl>
                                        <Input placeholder={`${currentYear}NE000000`} {...field} disabled={!selectedProtocol} onChange={(e) => field.onChange(e.target.value.toUpperCase())} maxLength={12} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`commitments.${index}.neDate`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Data de Emissão</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} disabled={!selectedProtocol} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                     <div className="grid grid-cols-1">
                         <FormField
                            control={form.control}
                            name={`commitments.${index}.value`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Valor do Empenho</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="R$ 0,00"
                                            {...field}
                                            value={formatCurrency(field.value) || ""}
                                            onChange={(e) => handleValueChange(e, index)}
                                            className="text-right"
                                            disabled={!selectedProtocol}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <FormField
                        control={form.control}
                        name={`commitments.${index}.observation`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Observação do Empenho (Opcional)</FormLabel>
                                <FormControl>
                                    <Textarea
                                        placeholder="Ex: Ref. Nota Fiscal 123..."
                                        className="resize-none h-20"
                                        {...field}
                                        value={field.value || ""}
                                        disabled={!selectedProtocol}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
            ))}
             <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full border-dashed"
                onClick={() => append({ neNumber: `${currentYear}NE`, neDate: new Date().toISOString().split('T')[0], value: 0 })}
                disabled={!selectedProtocol}
            >
                <PlusCircle className="mr-2 h-4 w-4" />
                Adicionar outro Empenho para este Protocolo
            </Button>
            <FormMessage>{form.formState.errors.commitments?.message}</FormMessage>
        </div>


        <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Nova Situação do Protocolo</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={!selectedProtocol}>
                    <FormControl>
                    <SelectTrigger>
                        <SelectValue placeholder="Selecione a situação" />
                    </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        <SelectItem value="Empenhado">Empenhado (Total ou Parcial)</SelectItem>
                        <SelectItem value="Em Análise">Manter em Análise</SelectItem>
                        <SelectItem value="Correção">Manter para Correção</SelectItem>
                        <SelectItem value="Deferido">Manter Deferido</SelectItem>
                    </SelectContent>
                </Select>
                 <p className="text-xs text-muted-foreground">
                    Nota: Se o valor total do protocolo for atingido, a situação mudará para 'Empenhado' automaticamente.
                </p>
                <FormMessage />
                </FormItem>
            )}
        />
        
        <div className="flex justify-end pt-4">
            <Button type="submit" disabled={!firestore || !selectedProtocol || !user || form.formState.isSubmitting}>
                 {form.formState.isSubmitting ? "Processando..." : "Lançar Empenho(s)"}
            </Button>
        </div>
      </form>
    </Form>
  )
}
