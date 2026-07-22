
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
import { Protocol, CreditNote, ProtocolObservation, OM, Commitment } from "@/lib/data"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { doc, runTransaction, arrayUnion, collection } from "firebase/firestore"
import { Textarea } from "../ui/textarea"
import { useState, useMemo } from "react"
import { ScrollArea } from "../ui/scroll-area"

const formSchema = z.object({
  commitmentIdentifier: z.string().min(1, "Selecione o empenho para anular."), // protocolId|neNumber
  value: z.coerce.number().min(0.01, "O valor a anular deve ser maior que zero."),
  justification: z.string().min(1, "A justificativa é obrigatória."),
  diexNumber: z.string().min(1, "O número do DIEx é obrigatório."),
});

interface AnnulmentFormProps {
    protocols: Protocol[];
    creditNotes: CreditNote[];
    setOpen: (open: boolean) => void;
}

type AnnulmentTarget = {
    protocol: Protocol;
    commitment: Commitment;
}

export function AnnulmentForm({ protocols, creditNotes, setOpen }: AnnulmentFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      value: 0,
      justification: "",
      diexNumber: "",
    },
  });

  const [searchTerm, setSearchTerm] = useState("");
  const selectedCommitmentIdentifier = form.watch("commitmentIdentifier");

  const omsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'militaryOrganizations') : null, [firestore]);
  const { data: oms } = useCollection<OM>(omsQuery);
  const omsMap = useMemo(() => oms ? new Map(oms.map(om => [om.id, om])) : new Map(), [oms]);
  const creditNotesMap = useMemo(() => creditNotes ? new Map(creditNotes.map(nc => [nc.id, nc])) : new Map(), [creditNotes]);

  const availableForAnnulment: AnnulmentTarget[] = useMemo(() => {
    if (!protocols) return [];
    const targets: AnnulmentTarget[] = [];
    protocols.forEach(p => {
      if (p.status !== 'Anulado' && p.status !== 'Restituído' && p.commitments && p.commitments.length > 0) {
        p.commitments.forEach(c => {
          if (c.value > 0) {
            targets.push({ protocol: p, commitment: c });
          }
        });
      }
    });
    return targets;
  }, [protocols]);
  
  const selectedTarget: AnnulmentTarget | null = useMemo(() => {
      if (!selectedCommitmentIdentifier) return null;
      const [protocolId, neNumber] = selectedCommitmentIdentifier.split('|');
      const target = availableForAnnulment.find(t => t.protocol.id === protocolId && t.commitment.neNumber === neNumber);
      return target || null;
  }, [availableForAnnulment, selectedCommitmentIdentifier]);


  const filteredTargets = useMemo(() => {
    if (availableForAnnulment.length === 0) return [];
    const search = searchTerm.toLowerCase();
    if (!search) return availableForAnnulment;
    
    return availableForAnnulment.filter(target => {
        const om = omsMap.get(target.protocol.omId);
        return (
            target.commitment.neNumber.toLowerCase().includes(search) ||
            target.protocol.controlCode.toLowerCase().includes(search) ||
            (om && om.abbreviation.toLowerCase().includes(search))
        )
    });
  }, [availableForAnnulment, searchTerm, omsMap]);


  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || isNaN(value)) return "R$ 0,00";
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    const numberValue = value ? parseInt(value, 10) / 100 : 0;
    form.setValue('value', numberValue, { shouldValidate: true });
  };
  
  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !user || !selectedTarget) {
      toast({ variant: "destructive", title: "Erro de Conexão ou Autenticação!" });
      return;
    }

    try {
        const { protocol, commitment } = selectedTarget;
        
        if (values.value > commitment.value) {
            form.setError("value", {message: "Valor da anulação não pode ser maior que o valor empenhado."});
            return;
        }

        await runTransaction(firestore, async (transaction) => {
            const protocolRef = doc(firestore, "protocols", protocol.id);

            const protocolDoc = await transaction.get(protocolRef);
            if (!protocolDoc.exists()) throw new Error("Documento do protocolo não encontrado.");
            const currentProtocol = protocolDoc.data() as Protocol;

            const creditNoteRefs = currentProtocol.creditSources.map(source => doc(firestore, "creditNotes", source.creditNoteId));
            const creditNoteDocs = await Promise.all(creditNoteRefs.map(ref => transaction.get(ref)));

            for (const ncDoc of creditNoteDocs) {
                if (!ncDoc.exists()) {
                    throw new Error(`A Nota de Crédito com ID ${ncDoc.id} não foi encontrada.`);
                }
            }

            creditNoteDocs.forEach((ncDoc, index) => {
                const source = currentProtocol.creditSources[index];
                let valueToRestore = 0;
                if (currentProtocol.value > 0) {
                    const proportion = source.value / currentProtocol.value;
                    valueToRestore = values.value * proportion;
                } else if (creditNoteDocs.length === 1) {
                    valueToRestore = values.value;
                }
                
                const currentNC = ncDoc.data() as CreditNote;
                transaction.update(ncDoc.ref, { balance: currentNC.balance + valueToRestore });
            });
            
            const newObservation: ProtocolObservation = {
                text: `ANULAÇÃO (DIEx ${values.diexNumber.toUpperCase()}): Valor de ${formatCurrency(values.value)} do empenho ${commitment.neNumber} estornado para a(s) NC(s) de origem. Justificativa: ${values.justification}`,
                createdAt: new Date().toISOString(),
                userId: user.uid,
            };

            const updatedCommitments = (currentProtocol.commitments || []).map(c => {
                if (c.neNumber === commitment.neNumber) {
                    return { ...c, value: c.value - values.value };
                }
                return c;
            });

            const totalCommitmentValue = updatedCommitments.reduce((sum, c) => sum + c.value, 0);
            
            const updateData = {
                commitments: updatedCommitments,
                observations: arrayUnion(newObservation) as any,
                status: totalCommitmentValue < 0.01 ? 'Anulado' : currentProtocol.status,
            };

            transaction.update(protocolRef, updateData);
        });
        
        toast({ title: "Sucesso!", description: "Anulação de empenho registrada." });
        setOpen(false);
    } catch (error: any) {
        console.error("Annulment Error:", error);
        toast({
            variant: "destructive",
            title: "Erro ao processar",
            description: error.message || "Não foi possível concluir a operação.",
        });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        
        <div className="space-y-2">
            <FormLabel>Protocolo Empenhado (NE)</FormLabel>
            <Input 
                placeholder="Pesquisar por NE, Cód. Controle ou OM..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mb-2"
            />
            <FormField
                control={form.control}
                name="commitmentIdentifier"
                render={({ field }) => (
                <FormItem>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder='Selecione o empenho a anular' />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <ScrollArea className="h-[200px]">
                            {filteredTargets.map(({protocol, commitment}) => {
                                const nc = creditNotesMap.get(protocol.creditSources[0]?.creditNoteId);
                                const identifier = `${protocol.id}|${commitment.neNumber}`;
                                return (
                                    <SelectItem key={identifier} value={identifier}>
                                        {commitment.neNumber} ({protocol.controlCode}) / {nc?.uasg} / {formatCurrency(commitment.value)}
                                    </SelectItem>
                                )
                            })}
                            {filteredTargets.length === 0 && <div className="p-4 text-sm text-muted-foreground">Nenhum empenho encontrado.</div>}
                            </ScrollArea>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>

        <FormField
            control={form.control}
            name="diexNumber"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Nº do DIEx</FormLabel>
                    <FormControl>
                        <Input 
                            placeholder="Ex: 123-Seç/SAdm" 
                            {...field}
                            disabled={!selectedTarget}
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
        
        <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Valor a Anular</FormLabel>
                    <FormControl>
                        <Input
                            placeholder="R$ 0,00"
                            {...field}
                            value={formatCurrency(field.value) || ""}
                            onChange={handleValueChange}
                            onBlur={field.onBlur}
                            className="text-right"
                            disabled={!selectedTarget}
                        />
                    </FormControl>
                     {selectedTarget && <p className="text-xs text-muted-foreground">Valor empenhado: {formatCurrency(selectedTarget.commitment.value)}</p>}
                    <FormMessage />
                </FormItem>
            )}
        />


        <FormField
            control={form.control}
            name="justification"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Justificativa</FormLabel>
                    <FormControl>
                        <Textarea
                            placeholder="Descreva o motivo da anulação."
                            className="resize-none"
                            {...field}
                            disabled={!selectedTarget}
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />

        <div className="flex justify-end pt-4">
            <Button type="submit" disabled={!firestore || !selectedTarget || !user}>
                Confirmar Anulação
            </Button>
        </div>
      </form>
    </Form>
  )
}
