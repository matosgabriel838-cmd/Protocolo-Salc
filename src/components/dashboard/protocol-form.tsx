
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
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
import { CreditNote, OM, Modality, Protocol, ProtocolObservation } from "@/lib/data"
import { useFirestore, useUser } from "@/firebase"
import { doc, runTransaction, arrayUnion } from "firebase/firestore"
import { useState, useMemo, useEffect } from "react"
import { Textarea } from "../ui/textarea"
import { ScrollArea } from "../ui/scroll-area"
import { Info, PlusCircle, Trash2, CalendarIcon } from "lucide-react";
import { Separator } from "../ui/separator";

const currentYear = new Date().getFullYear();

const creditSourceSchema = z.object({
    creditNoteId: z.string().min(1, "Selecione uma NC."),
    value: z.coerce.number().min(0.01, "O valor deve ser maior que zero.")
});

const commitmentSchema = z.object({
  neNumber: z.string().optional(),
  neDate: z.string().optional(),
  value: z.coerce.number().optional(),
  observation: z.string().optional(),
  createdAt: z.string().optional(),
  createdBy: z.string().optional(),
});

const baseProtocolSchema = z.object({
  entryDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "A data de entrada é obrigatória.",
  }),
  omId: z.string().min(1, "Selecione a OM solicitante."),
  omComplement: z.string().optional(),
  modalityId: z.string().min(1, "Selecione a modalidade de aquisição."),
  creditSources: z.array(creditSourceSchema).min(1, "Adicione pelo menos uma fonte de crédito."),
  observations: z.string().optional(),
  diexNumber: z.string().optional(),
  pReqNumber: z.string().optional(),
  pregaoNumber: z.string().optional(),
  sipeoMapNumber: z.string().optional(),
  beneficiaryName: z.string().optional(),
  status: z.enum(["Em Análise", "Deferido", "Correção", "Restituído", "Empenhado", "Anulado"]),
  commitments: z.array(commitmentSchema).optional(),
});

interface ProtocolFormProps {
    setOpen: (open: boolean) => void;
    creditNotes: CreditNote[];
    oms: OM[];
    modalities: Modality[];
    protocols: Protocol[];
    protocol?: Protocol | null;
}

export function ProtocolForm({ setOpen, creditNotes, oms, modalities, protocols, protocol = null }: ProtocolFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const isEditing = !!protocol;

  const [selectedModality, setSelectedModality] = useState<Modality | null>(null);
  const [ncSearchTerm, setNcSearchTerm] = useState("");

  const form = useForm<any>({
    resolver: async (data, context, options) => {
        const currentModality = modalities.find(m => m.id === (data as any).modalityId);
        let schema = baseProtocolSchema;
        if (currentModality) {
            if (currentModality.requiresDiexPreq) {
                schema = schema.extend({
                    diexNumber: z.string().min(1, "DIEx obrigatório."),
                    pReqNumber: z.string().min(1, "P_Req obrigatório."),
                });
            }
            if (currentModality.requiresPregao) {
                 schema = schema.extend({ pregaoNumber: z.string().min(1, "Pregão obrigatório.") });
            }
             if (currentModality.requiresSipeo) {
                 schema = schema.extend({ sipeoMapNumber: z.string().min(1, "Mapa SIPEO obrigatório.") });
            }
            if (currentModality.requiresBeneficiary) {
                 schema = schema.extend({ beneficiaryName: z.string().min(1, "Beneficiário obrigatório.") });
            }
        }
        return zodResolver(schema)(data, context, options);
    },
    defaultValues: isEditing && protocol ? { 
        ...protocol, 
        entryDate: protocol.entryDate ? new Date(protocol.entryDate).toISOString().split('T')[0] : "",
        observations: "",
        commitments: protocol.commitments?.map(c => ({
            ...c,
            neDate: c.neDate ? new Date(c.neDate).toISOString().split('T')[0] : ""
        })) || []
    } : {
        entryDate: new Date().toISOString().split('T')[0],
        creditSources: [],
        status: "Em Análise",
        commitments: [],
    },
  });

  const { fields: creditFields, append: appendCredit, remove: removeCredit } = useFieldArray({
    control: form.control,
    name: "creditSources",
  });

  const { fields: commitmentFields, remove: removeCommitment } = useFieldArray({
    control: form.control,
    name: "commitments",
  });

  useEffect(() => {
    if (isEditing && protocol) {
        form.reset({
            ...protocol,
            entryDate: protocol.entryDate ? new Date(protocol.entryDate).toISOString().split('T')[0] : "",
            observations: "",
            commitments: protocol.commitments?.map(c => ({
                ...c,
                neDate: c.neDate ? new Date(c.neDate).toISOString().split('T')[0] : ""
            })) || []
        });
        const mod = modalities.find(m => m.id === protocol.modalityId);
        setSelectedModality(mod || null);
    }
  }, [protocol, isEditing, form, modalities]);

  const omIdWatch = form.watch("omId");
  const modalityIdWatch = form.watch("modalityId");
  const creditSourcesWatch = useWatch({ control: form.control, name: "creditSources" });

  useEffect(() => {
    const mod = modalities.find(m => m.id === modalityIdWatch);
    setSelectedModality(mod || null);
  }, [modalityIdWatch, modalities]);
  
  const formatCurrency = (value: number | undefined) => (value?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })) || "R$ 0,00";
  const sortedOMs = useMemo(() => [...oms].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })), [oms]);

  const availableOMSharesByNC = useMemo(() => {
    const availableMap = new Map<string, number>();
    if (!protocols || !creditNotes || !omIdWatch) return availableMap;

    const usageByNc = new Map<string, number>();
    protocols
        .filter(p => p.id !== protocol?.id)
        .filter(p => p.omId === omIdWatch)
        .filter(p => p.status !== "Restituído" && p.status !== "Anulado")
        .flatMap(p => p.creditSources)
        .forEach(cs => {
            usageByNc.set(cs.creditNoteId, (usageByNc.get(cs.creditNoteId) || 0) + cs.value);
        });

    creditNotes.forEach(nc => {
        const omShare = nc.shares?.find(s => s.omId === omIdWatch);
        if (omShare) {
            const usedAmount = usageByNc.get(nc.id) || 0;
            availableMap.set(nc.id, Math.max(0, omShare.value - usedAmount));
        }
    });

    return availableMap;
  }, [protocols, creditNotes, omIdWatch, protocol]);
  
  const filteredCreditNotes = useMemo(() => {
    if (!creditNotes || !omIdWatch) return [];

    let notes = creditNotes.filter(nc => {
      const availableForOM = availableOMSharesByNC.get(nc.id);
      if (isEditing && protocol?.creditSources.some(cs => cs.creditNoteId === nc.id)) return true;
      return availableForOM !== undefined && availableForOM > 0.001;
    });
    
    if (creditSourcesWatch && creditSourcesWatch.length > 0 && creditSourcesWatch[0]?.creditNoteId) {
        const firstCreditNote = creditNotes.find(nc => nc.id === creditSourcesWatch[0].creditNoteId);
        if (firstCreditNote) {
            notes = notes.filter(nc => nc.uasg === firstCreditNote.uasg);
        }
    }

    if (ncSearchTerm) {
        const search = ncSearchTerm.toLowerCase();
        notes = notes.filter(note => 
            note.ncNumber.toLowerCase().includes(search) ||
            note.uasg.toLowerCase().includes(search) ||
            (note.pi && note.pi.toLowerCase().includes(search))
        );
    }

    notes.sort((a, b) => a.ncNumber.localeCompare(b.ncNumber));
    return notes;
  }, [creditNotes, omIdWatch, ncSearchTerm, creditSourcesWatch, availableOMSharesByNC, isEditing, protocol]);

  const totalProtocolValue = useMemo(() => {
    return creditSourcesWatch?.reduce((sum: number, source: any) => sum + (source.value || 0), 0) || 0;
  }, [creditSourcesWatch]);

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    let value = e.target.value.replace(/\D/g, '');
    form.setValue(`creditSources.${index}.value`, value ? parseInt(value, 10) / 100 : 0, { shouldValidate: true });
  };

  const handleCommitmentValueChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    let value = e.target.value.replace(/\D/g, '');
    form.setValue(`commitments.${index}.value`, value ? parseInt(value, 10) / 100 : 0, { shouldValidate: true });
  };

  async function onSubmit(values: any) {
    if (!firestore || !user) {
      toast({ variant: "destructive", title: "Erro de Conexão ou Autenticação!" });
      return;
    }

    try {
      const sanitizedData = {
        omId: values.omId || "",
        modalityId: values.modalityId || "",
        status: values.status || "Em Análise",
        type: values.type || "Empenho",
        omComplement: values.omComplement || "",
        diexNumber: (values.diexNumber || "").toUpperCase(),
        pReqNumber: (values.pReqNumber || "").toUpperCase(),
        pregaoNumber: (values.pregaoNumber || "").toUpperCase(),
        sipeoMapNumber: (values.sipeoMapNumber || "").toUpperCase(),
        beneficiaryName: (values.beneficiaryName || "").toUpperCase(),
        creditSources: values.creditSources.map((source: any) => {
            const nc = creditNotes.find(n => n.id === source.creditNoteId);
            return {
                ...source,
                ncNumber: nc?.ncNumber || "N/A"
            };
        }),
      };

      if (isEditing && protocol) {
        const protocolRef = doc(firestore, "protocols", protocol.id);
        const hasNewObservation = values.observations && values.observations.trim() !== "";
        
        await runTransaction(firestore, async (transaction) => {
            const docSnapshot = await transaction.get(protocolRef);
            if (!docSnapshot.exists()) throw new Error("Protocolo não encontrado.");

            const oldData = docSnapshot.data() as Protocol;
            let newObservations: ProtocolObservation[] = [];

            const oldSources = oldData.creditSources;
            const newSources = sanitizedData.creditSources;
            const allNcIds = Array.from(new Set([
                ...oldSources.map(s => s.creditNoteId),
                ...newSources.map(s => s.creditNoteId)
            ]));

            const ncDocs = await Promise.all(allNcIds.map(id => transaction.get(doc(firestore, "creditNotes", id))));
            const ncMap = new Map<string, CreditNote>();
            ncDocs.forEach(d => { if(d.exists()) ncMap.set(d.id, d.data() as CreditNote); });

            const isStatusInactive = (s: string) => s === "Restituído" || s === "Anulado";

            for (const ncId of allNcIds) {
                const nc = ncMap.get(ncId);
                if (!nc) continue;
                
                let balanceAdjustment = 0;
                if (!isStatusInactive(oldData.status)) {
                    const oldSource = oldSources.find(s => s.creditNoteId === ncId);
                    if (oldSource) balanceAdjustment += oldSource.value;
                }
                if (!isStatusInactive(values.status)) {
                    const newSource = newSources.find(s => s.creditNoteId === ncId);
                    if (newSource) balanceAdjustment -= newSource.value;
                }
                
                if (balanceAdjustment !== 0) {
                    const finalBalance = nc.balance + balanceAdjustment;
                    if (finalBalance < -0.001) throw new Error(`Saldo insuficiente na NC ${nc.ncNumber}. Disponível: ${formatCurrency(nc.balance)}.`);
                    transaction.update(doc(firestore, "creditNotes", ncId), { balance: finalBalance });
                }
            }

            if (values.status !== oldData.status) {
                newObservations.push({ text: `Situação alterada para ${values.status}.${hasNewObservation ? ` Obs: ${values.observations}` : ''}`, createdAt: new Date().toISOString(), userId: user.uid });
            } else if (hasNewObservation) {
                newObservations.push({ text: values.observations, createdAt: new Date().toISOString(), userId: user.uid });
            }

            const finalCommitments = values.commitments?.map((c: any) => {
                if (!c.neNumber || !c.neDate) return null;
                return { ...c, neNumber: c.neNumber.toUpperCase(), neDate: new Date(c.neDate).toISOString(), createdAt: c.createdAt || new Date().toISOString(), createdBy: c.createdBy || user.uid };
            }).filter(Boolean) || [];

            transaction.update(protocolRef, {
                ...sanitizedData,
                entryDate: new Date(values.entryDate).toISOString(),
                value: totalProtocolValue,
                commitments: finalCommitments,
                observations: newObservations.length > 0 ? arrayUnion(...newObservations) : (oldData.observations || []),
                updatedAt: new Date().toISOString(),
            } as any);
        });
        toast({ title: "Sucesso!", description: "Alterações salvas." });

      } else {
        await runTransaction(firestore, async (transaction) => {
            const ncDocs = await Promise.all(sanitizedData.creditSources.map((source: any) => transaction.get(doc(firestore, "creditNotes", source.creditNoteId))));
            for (let i = 0; i < ncDocs.length; i++) {
                const ncDoc = ncDocs[i];
                if (!ncDoc.exists()) throw new Error(`NC não encontrada.`);
                const ncData = ncDoc.data() as CreditNote;
                if (sanitizedData.creditSources[i].value > ncData.balance + 0.001) throw new Error(`Saldo insuficiente na NC ${ncData.ncNumber}.`);
                transaction.update(ncDoc.ref, { balance: ncData.balance - sanitizedData.creditSources[i].value });
            }

            const om = oms.find(om => om.id === values.omId);
            const omProtocols = protocols.filter(p => p.omId === values.omId);
            let nextSequence = 1;
            if (omProtocols.length > 0) {
                const sequences = omProtocols.map(p => {
                    const parts = p.controlCode.split('-');
                    const seq = parseInt(parts[parts.length - 1] || "0", 10);
                    return isNaN(seq) ? 0 : seq;
                });
                nextSequence = Math.max(0, ...sequences) + 1;
            }
            const controlCode = `${om?.code}-${nextSequence.toString().padStart(3, '0')}`;
            
            const newProtocolData: Protocol = {
                id: uuidv4(),
                controlCode,
                entryDate: new Date(values.entryDate).toISOString(),
                omId: values.omId!,
                type: values.type || "Empenho",
                status: values.status || "Em Análise",
                userId: user.uid,
                createdAt: new Date().toISOString(),
                observations: values.observations ? [{ text: values.observations, createdAt: new Date().toISOString(), userId: user.uid }] : [],
                value: totalProtocolValue,
                modalityId: values.modalityId,
                creditSources: sanitizedData.creditSources,
                omComplement: sanitizedData.omComplement,
                diexNumber: sanitizedData.diexNumber,
                pReqNumber: sanitizedData.pReqNumber,
                pregaoNumber: sanitizedData.pregaoNumber,
                sipeoMapNumber: sanitizedData.sipeoMapNumber,
                beneficiaryName: sanitizedData.beneficiaryName,
            };
            transaction.set(doc(firestore, "protocols", newProtocolData.id), newProtocolData);
            toast({ title: "Sucesso!", description: `Protocolo ${newProtocolData.controlCode} gerado.` });
        });
      }
      setOpen(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: error.message || "Verifique os dados." });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
            <div className="flex items-center gap-2 text-blue-700 text-sm font-semibold">
                <Info className="h-4 w-4" />
                <span>{isEditing ? "Modo de Edição" : "Novo Registro"}</span>
            </div>
            <p className="text-blue-600 text-xs mt-1">
                {isEditing ? "Alterações de valor recalcularão automaticamente os saldos das NCs." : "Selecione a OM e vincule as Notas de Crédito de origem."}
            </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="entryDate" render={({ field }) => (
                <FormItem>
                    <FormLabel>Data de Entrada</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="omId" render={({ field }) => (
                <FormItem>
                    <FormLabel>OM Solicitante</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value as string}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                        <SelectContent>
                            <ScrollArea className="h-[200px]">
                                {sortedOMs.map(om => (<SelectItem key={om.id} value={om.id}>{om.code} - {om.abbreviation}</SelectItem>))}
                            </ScrollArea>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
            )}/>
        </div>

        <FormField control={form.control} name="omComplement" render={({ field }) => (
            <FormItem>
                <FormLabel>Complemento da OM</FormLabel>
                <FormControl><Input placeholder="Ex: Manutenção" {...field} value={field.value || ''} /></FormControl>
                <FormMessage />
            </FormItem>
        )}/>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="modalityId" render={({ field }) => (
                <FormItem>
                    <FormLabel>Modalidade</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value as string}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                        <SelectContent>{modalities.map(m => (<SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>))}</SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
            )}/>
            <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                    <FormLabel>Situação</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value as string}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="Em Análise">Em Análise</SelectItem>
                            <SelectItem value="Deferido">Deferido</SelectItem>
                            <SelectItem value="Correção">Correção</SelectItem>
                            <SelectItem value="Empenhado">Empenhado</SelectItem>
                            <SelectItem value="Restituído">Restituído</SelectItem>
                            <SelectItem value="Anulado">Anulado</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
            )}/>
        </div>
        
        {selectedModality && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedModality.requiresDiexPreq && <>
                    <FormField control={form.control} name="diexNumber" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nº do DIEx</FormLabel>
                            <FormControl><Input placeholder="Ex: 123-SAdm" {...field} value={field.value || ''}/></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="pReqNumber" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nº do P_Req</FormLabel>
                            <FormControl><Input placeholder="Ex: 456-SCA" {...field} value={field.value || ''}/></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </>}
                {selectedModality.requiresPregao && <FormField control={form.control} name="pregaoNumber" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Nº do Pregão</FormLabel>
                        <FormControl><Input placeholder="90001/2024" maxLength={10} {...field} value={field.value || ''}/></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />}
                {selectedModality.requiresSipeo && <FormField control={form.control} name="sipeoMapNumber" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Mapa SIPEO</FormLabel>
                        <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />}
                {selectedModality.requiresBeneficiary && <FormField control={form.control} name="beneficiaryName" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Nome do Beneficiário</FormLabel>
                        <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />}
            </div>
        )}
        
        <Separator />
        <div className="space-y-4">
            <FormLabel className="text-base font-bold">Fontes de Crédito</FormLabel>
            <Input placeholder="Pesquisar NC por Nº ou PI..." className="mb-2 h-8 text-sm" value={ncSearchTerm} onChange={(e) => setNcSearchTerm(e.target.value)} disabled={!omIdWatch} />
            {creditFields.map((field, index) => {
                const selectedNCId = creditSourcesWatch?.[index]?.creditNoteId;
                return (
                    <div key={field.id} className="flex items-start gap-2 p-3 border rounded-md bg-background shadow-sm">
                        <div className="grid gap-2 flex-1">
                            <FormField
                                control={form.control}
                                name={`creditSources.${index}.creditNoteId`}
                                render={({ field }) => (
                                    <FormItem>
                                        <Select onValueChange={field.onChange} value={field.value} disabled={!omIdWatch}>
                                            <FormControl><SelectTrigger className="h-10 text-sm"><SelectValue placeholder="NC" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <ScrollArea className="h-[200px]">
                                                    {filteredCreditNotes.map(note => (
                                                        <SelectItem key={note.id} value={note.id} className="text-xs">
                                                            {note.ncNumber} | PI: {note.pi} (Disp: {formatCurrency(availableOMSharesByNC.get(note.id))})
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
                                name={`creditSources.${index}.value`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl><Input value={formatCurrency(field.value)} onChange={(e) => handleValueChange(e, index)} className="h-10 text-right font-mono" disabled={!selectedNCId} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="text-destructive h-10 w-10" onClick={() => removeCredit(index)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                );
            })}
            <Button type="button" variant="outline" size="sm" className="w-full text-xs h-10 border-dashed" onClick={() => appendCredit({ creditNoteId: "", value: 0 })} disabled={!omIdWatch}><PlusCircle className="mr-2 h-4 w-4" /> Adicionar NC</Button>
        </div>
            
        <div className="text-lg font-bold p-4 border rounded-md bg-muted/50 text-center flex justify-between items-center">
            <span>TOTAL:</span>
            <span>{formatCurrency(totalProtocolValue)}</span>
        </div>

        {isEditing && (commitmentFields.length > 0) && (
            <div className="space-y-4 border p-4 rounded-lg bg-yellow-50/30 border-yellow-200">
                <h4 className="font-bold flex items-center gap-2 text-yellow-800 text-sm">
                    <CalendarIcon className="h-4 w-4" />
                    Notas de Empenho (NE)
                </h4>
                <div className="space-y-4">
                    {commitmentFields.map((field, index) => (
                        <div key={field.id} className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3 border rounded bg-background relative group shadow-sm">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-white"
                                onClick={() => removeCommitment(index)}
                            >
                                <Trash2 className="h-3 w-3" />
                            </Button>
                            <FormField
                                control={form.control}
                                name={`commitments.${index}.neNumber`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px]">Número</FormLabel>
                                        <FormControl><Input {...field} className="h-8 font-mono text-xs" maxLength={12} onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name={`commitments.${index}.neDate`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px]">Emissão</FormLabel>
                                        <FormControl><Input type="date" {...field} className="h-8 text-xs" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name={`commitments.${index}.value`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px]">Valor</FormLabel>
                                        <FormControl><Input value={formatCurrency(field.value)} onChange={(e) => handleCommitmentValueChange(e, index)} className="h-8 text-right font-mono text-xs" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    ))}
                </div>
            </div>
        )}

        <FormField control={form.control} name="observations" render={({ field }) => (
            <FormItem>
                <FormLabel>Observação / Histórico</FormLabel>
                <FormControl><Textarea className="resize-none h-24" placeholder="Descreva o motivo da alteração..." {...field} value={field.value || ''} /></FormControl>
                <FormMessage />
            </FormItem>
        )}/>

        <div className="flex justify-end pt-4 gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={!firestore || (!isEditing && totalProtocolValue === 0)}>
                {isEditing ? "Salvar Edição" : "Gerar Protocolo"}
            </Button>
        </div>
      </form>
    </Form>
  )
}
