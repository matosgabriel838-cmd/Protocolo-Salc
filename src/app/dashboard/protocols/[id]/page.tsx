
"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useDoc, useFirestore, useMemoFirebase, useCollection, useUser } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { CreditNote, Modality, OM, Protocol, ProtocolStatus, UserProfile } from "@/lib/data";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Printer, History, Edit } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ProtocolForm } from "@/components/dashboard/protocol-form";
import { ScrollArea } from "@/components/ui/scroll-area";


function InfoItem({ label, value }: { label: string, value: React.ReactNode }) {
    return (
        <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <div className="font-medium">{value || '—'}</div>
        </div>
    )
}

const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch(status) {
        case "Deferido": return "default";
        case "Em Análise": return "secondary";
        case "Correção": return "outline";
        case "Restituído": return "destructive";
        case "Anulado": return "destructive";
        case "Empenhado": return "default";
        default: return "default";
    }
}


export default function ProtocolDetailPage() {
    const { id: protocolId } = useParams<{ id: string }>();
    const firestore = useFirestore();
    const { userProfile } = useUser();
    const isAdmin = userProfile?.role === 'ADMIN';
    const [isEditOpen, setIsEditOpen] = useState(false);

    // Fetch single protocol
    const protocolDocRef = useMemoFirebase(() => {
        if (!firestore || !protocolId) return null;
        return doc(firestore, "protocols", protocolId);
    }, [firestore, protocolId]);
    const { data: protocol, isLoading: isLoadingProtocol } = useDoc<Protocol>(protocolDocRef);

    // Fetch related collections
    const omsCollection = useMemoFirebase(() => firestore ? collection(firestore, "militaryOrganizations") : null, [firestore]);
    const { data: oms, isLoading: isLoadingOms } = useCollection<OM>(omsCollection);
    
    const usersCollection = useMemoFirebase(() => firestore ? collection(firestore, "users") : null, [firestore]);
    const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersCollection);
    
    const creditNotesCollection = useMemoFirebase(() => firestore ? collection(firestore, "creditNotes") : null, [firestore]);
    const { data: creditNotes, isLoading: isLoadingCreditNotes } = useCollection<CreditNote>(creditNotesCollection);
    
    const modalitiesCollection = useMemoFirebase(() => firestore ? collection(firestore, "licitationModalities") : null, [firestore]);
    const { data: modalities, isLoading: isLoadingModalities } = useCollection<Modality>(modalitiesCollection);

    // Create maps for easy lookup
    const omsMap = useMemo(() => oms ? new Map(oms.map(om => [om.id, om])) : new Map(), [oms]);
    const usersMap = useMemo(() => users ? new Map(users.map(user => [user.id, user])) : new Map(), [users]);
    const creditNotesMap = useMemo(() => creditNotes ? new Map(creditNotes.map(nc => [nc.id, nc])) : new Map(), [creditNotes]);
    const modalitiesMap = useMemo(() => modalities ? new Map(modalities.map(m => [m.id, m])) : new Map(), [modalities]);

    const isLoading = isLoadingProtocol || isLoadingOms || isLoadingUsers || isLoadingCreditNotes || isLoadingModalities;

    // Formatters
    const formattedDate = (dateString: string | undefined) => dateString ? new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
    const formatDateTime = (dateString: string) => new Date(dateString).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
    const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    const relatedOm = protocol ? omsMap.get(protocol.omId) : null;
    const relatedModality = protocol ? modalitiesMap.get(protocol.modalityId) : null;
    const creatorUser = protocol ? usersMap.get(protocol.userId) : null;

    const sortedObservations = useMemo(() => {
        if (!protocol?.observations) return [];
        return [...protocol.observations].sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }, [protocol?.observations]);

    const statusHistory = useMemo(() => {
        const history: { user?: UserProfile, text: string, date: string, status?: ProtocolStatus }[] = [];
        if (!protocol || !usersMap) return history;

        // Add initial status
        history.push({
            user: usersMap.get(protocol.userId),
            text: 'Protocolo criado.',
            date: protocol.createdAt,
            status: 'Em Análise'
        });
        
        const statusKeywords: ProtocolStatus[] = ["Deferido", "Correção", "Restituído", "Empenhado", "Anulado"];

        sortedObservations.forEach(obs => {
            const lowerText = obs.text.toLowerCase();
            const keyword = statusKeywords.find(k => lowerText.includes(k.toLowerCase()) && (lowerText.includes('status') || lowerText.includes('situação') || lowerText.includes('anula') || lowerText.includes('cancela')));
            
            if (keyword) {
                 history.push({
                    user: usersMap.get(obs.userId),
                    text: obs.text,
                    date: obs.createdAt,
                    status: keyword
                });
            }
        });
        
        return history.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [protocol, usersMap, sortedObservations]);

    
    if (isLoading) {
        return (
            <div className="p-4 md:p-6 lg:p-8 space-y-6">
                <Skeleton className="h-8 w-1/3 mb-2" />
                <Skeleton className="h-4 w-2/3 mb-6" />
                <Card><CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader><CardContent><Skeleton className="h-24 w-full" /></CardContent></Card>
                <Card><CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader><CardContent><Skeleton className="h-24 w-full" /></CardContent></Card>
            </div>
        );
    }
    
    if (!protocol) {
        return (
             <div className="p-4 md:p-6 lg:p-8">
                <PageHeader title="Erro" description="Protocolo não encontrado." >
                     <Button asChild variant="outline">
                        <Link href="/dashboard/protocols"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Link>
                    </Button>
                </PageHeader>
            </div>
        );
    }

    return (
        <>
            <PageHeader
                title={`Dossiê do Protocolo: ${protocol.controlCode}`}
                description="Detalhes completos do processo de aquisição."
            >
                <div className="flex gap-2">
                    <Button asChild variant="outline">
                        <Link href="/dashboard/protocols"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar à Lista</Link>
                    </Button>
                    {isAdmin && (
                        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:text-blue-700">
                                    <Edit className="mr-2 h-4 w-4" /> Editar Protocolo
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[750px]">
                                <DialogHeader>
                                    <DialogTitle>Editar Protocolo {protocol.controlCode}</DialogTitle>
                                    <DialogDescription>Altere a situação ou adicione observações.</DialogDescription>
                                </DialogHeader>
                                <ScrollArea className="max-h-[80vh] p-6">
                                    <ProtocolForm 
                                        setOpen={setIsEditOpen}
                                        creditNotes={creditNotes || []}
                                        oms={oms || []}
                                        modalities={modalities || []}
                                        protocols={[]} // Duplicate check not strictly needed for edit
                                        protocol={protocol}
                                    />
                                </ScrollArea>
                            </DialogContent>
                        </Dialog>
                    )}
                     <Button onClick={() => window.print()}>
                        <Printer className="mr-2 h-4 w-4" /> Imprimir
                    </Button>
                </div>
            </PageHeader>

            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Dados Gerais do Protocolo</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <InfoItem label="Cód. Controle" value={protocol.controlCode} />
                        <InfoItem label="Data de Entrada" value={formattedDate(protocol.entryDate)} />
                        <InfoItem label="OM Solicitante" value={relatedOm ? `${relatedOm.code} - ${relatedOm.abbreviation}` : 'N/A'} />
                        <InfoItem label="Complemento da OM" value={protocol.omComplement} />
                        <InfoItem label="Nº do DIEx" value={protocol.diexNumber} />
                        <InfoItem label="Nº do P_Req" value={protocol.pReqNumber} />
                        <InfoItem label="Tipo" value={protocol.type} />
                        <InfoItem label="Modalidade" value={relatedModality?.name || 'N/A'} />
                        <InfoItem label="Nº do Pregão" value={protocol.pregaoNumber} />
                        {protocol.sipeoMapNumber && <InfoItem label="Mapa SIPEO" value={protocol.sipeoMapNumber} />}
                        {protocol.beneficiaryName && <InfoItem label="Nome do Beneficiário" value={protocol.beneficiaryName} />}
                        <InfoItem label="Valor Solicitado" value={
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className={cn(protocol.creditSources.length > 1 && "underline decoration-dashed cursor-help")}>{formatCurrency(protocol.value)}</span>
                                    </TooltipTrigger>
                                    {protocol.creditSources.length > 1 && (
                                        <TooltipContent>
                                            <div className="flex flex-col gap-1 text-xs">
                                                    {protocol.creditSources.map(source => {
                                                    return <div key={source.creditNoteId} className="flex justify-between gap-2"><span>{source.ncNumber}:</span> <span className="font-semibold">{formatCurrency(source.value)}</span></div>
                                                })}
                                            </div>
                                        </TooltipContent>
                                    )}
                                </Tooltip>
                            </TooltipProvider>
                        } />
                        <InfoItem label="Situação Atual" value={
                            <Badge variant={getStatusVariant(protocol.status)} className={cn(protocol.status === "Empenhado" && "bg-green-600 hover:bg-green-700", (protocol.status === "Anulado" || protocol.status === "Restituído") && "bg-destructive")}>
                                {protocol.status}
                            </Badge>} 
                        />
                        <InfoItem label="Criado por" value={creatorUser ? `${creatorUser.rank} ${creatorUser.warName}` : 'N/A'} />
                    </CardContent>
                </Card>
                
                 <Card>
                    <CardHeader>
                        <CardTitle>Fontes de Crédito Vinculadas</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {protocol.creditSources.map((source, index) => {
                            const ncDoc = creditNotesMap.get(source.creditNoteId);
                            return (
                                <div key={index} className="p-3 border rounded-lg">
                                    <div className="font-semibold">
                                        {ncDoc ? (
                                            <Link href={`/dashboard/credit-notes/${source.creditNoteId}`} className="text-primary hover:underline">{source.ncNumber}</Link>
                                        ) : (
                                            <span className="text-muted-foreground">{source.ncNumber} (NC Excluída)</span>
                                        )}
                                    </div>
                                    {ncDoc && <div className="text-sm text-muted-foreground">UASG: {ncDoc.uasg} | PI: {ncDoc.pi}</div>}
                                    <div className="text-sm font-medium mt-1">Valor Utilizado: {formatCurrency(source.value)}</div>
                                </div>
                            )
                        })}
                    </CardContent>
                </Card>
                
                {protocol.commitments && protocol.commitments.length > 0 && (
                     <Card>
                        <CardHeader>
                            <CardTitle>Dados do Empenho</CardTitle>
                        </CardHeader>
                        <CardContent>
                           <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nº do Empenho</TableHead>
                                        <TableHead>Data</TableHead>
                                        <TableHead className="text-right">Valor</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {protocol.commitments.map((c, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-medium">{c.neNumber}</TableCell>
                                            <TableCell>{formattedDate(c.neDate)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(c.value)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                           </Table>
                        </CardContent>
                    </Card>
                 )}

                <Card>
                    <CardHeader>
                        <CardTitle>Histórico de Situação</CardTitle>
                        <CardDescription>Linha do tempo das mudanças de status do processo.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {statusHistory.map((item, index) => (
                        <div key={index} className="flex items-center gap-4">
                            <div className="flex flex-col items-center">
                                <Badge variant={getStatusVariant(item.status || '')} className={cn('h-8 w-8 flex items-center justify-center rounded-full', item.status === "Empenhado" && "bg-green-600", (item.status === "Anulado" || item.status === "Restituído") && "bg-destructive")}>
                                    <History className="h-4 w-4" />
                                </Badge>
                                {index < statusHistory.length - 1 && <div className="w-px h-8 bg-border" />}
                            </div>
                            <div className="grid gap-1">
                                <p className="font-semibold">
                                    {item.status}
                                    <span className="font-normal text-muted-foreground ml-2">por {item.user ? `${item.user.rank} ${item.user.warName}` : 'Sistema'}</span>
                                </p>
                                <p className="text-sm text-muted-foreground">{item.text}</p>
                                <time className="text-xs text-muted-foreground">{formatDateTime(item.date)}</time>
                            </div>
                        </div>
                        ))}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Histórico de Observações</CardTitle>
                        <CardDescription>Acompanhamento e comunicações do processo.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         {sortedObservations.length > 0 ? (
                            <div className="space-y-4">
                                {sortedObservations.map((obs, index) => {
                                    const obsUser = usersMap.get(obs.userId);
                                    return (
                                        <div key={index} className="flex items-start gap-4 p-3 border-b last:border-b-0">
                                            {obsUser && (
                                                <Avatar className="h-9 w-9">
                                                    <AvatarFallback>{obsUser?.warName?.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                            )}
                                            <div className="grid gap-1.5 w-full">
                                                <div className="flex items-center justify-between">
                                                    <p className="font-semibold">{obsUser ? `${obsUser.rank} ${obsUser.warName}` : "Usuário Desconhecido"}</p>
                                                    <time className="text-xs text-muted-foreground">{formatDateTime(obs.createdAt)}</time>
                                                </div>
                                                <p className="text-sm text-gray-700 leading-snug">{obs.text}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                         ) : (
                             <p className="text-sm text-muted-foreground text-center py-8">Nenhuma observação registrada neste protocolo.</p>
                         )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
