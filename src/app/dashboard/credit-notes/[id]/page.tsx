
"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useDoc, useFirestore, useMemoFirebase, useCollection } from "@/firebase";
import { collection, doc, query, where, limit } from "firebase/firestore";
import { CreditNote, OM, Protocol, UserProfile } from "@/lib/data";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


function InfoItem({ label, value }: { label: string, value: React.ReactNode }) {
    return (
        <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="font-medium">{value}</p>
        </div>
    )
}

const getStatusVariant = (status: string) => {
    switch(status) {
        case "Deferido": return "default";
        case "Em Análise": return "secondary";
        case "Correção": return "outline";
        case "Restituído": return "destructive";
        case "Empenhado": return "default";
        default: return "default";
    }
}


export default function CreditNoteDetailPage() {
    const params = useParams();
    const creditNoteId = params?.id as string;
    const firestore = useFirestore();

    const creditNoteDocRef = useMemoFirebase(() => {
        if (!firestore || !creditNoteId) return null;
        return doc(firestore, "creditNotes", creditNoteId);
    }, [firestore, creditNoteId]);

    const { data: creditNote, isLoading: isLoadingNote } = useDoc<CreditNote>(creditNoteDocRef);

    const omsCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, "militaryOrganizations");
    }, [firestore]);
    const { data: oms, isLoading: isLoadingOms } = useCollection<OM>(omsCollection);
    
    const usersCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, "users");
    }, [firestore]);
    const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersCollection);

    // Fetch related protocols with a reasonable limit to prevent quota errors
    const linkedProtocolsQuery = useMemoFirebase(() => {
        if (!firestore || !creditNoteId) return null;
        return query(collection(firestore, "protocols"), limit(200));
    }, [firestore, creditNoteId]);

    const { data: allProtocols, isLoading: isLoadingProtocols } = useCollection<Protocol>(linkedProtocolsQuery);

    const linkedProtocols = useMemo(() => {
        if (!allProtocols || !creditNoteId) return [];
        return allProtocols.filter(p => p.creditSources.some(s => s.creditNoteId === creditNoteId));
    }, [allProtocols, creditNoteId]);


    const omsMap = useMemo(() => {
        if (!oms) return new Map();
        return new Map(oms.map(om => [om.id, om]));
    }, [oms]);
    
    const usersMap = useMemo(() => {
        if (!users) return new Map();
        return new Map(users.map(user => [user.id, user]));
    }, [users]);

    const isLoading = isLoadingNote || isLoadingOms || isLoadingUsers || isLoadingProtocols;
    const formattedDate = (dateString: string | undefined) => dateString ? new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
    const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });


    if (isLoading) {
        return (
            <div className="p-4 md:p-6 lg:p-8">
                <Skeleton className="h-8 w-1/4 mb-4" />
                <Skeleton className="h-4 w-1/2 mb-8" />
                <Card>
                    <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    if (!creditNote) {
        return (
             <div className="p-4 md:p-6 lg:p-8">
                <PageHeader title="Erro" description="Nota de Crédito não encontrada." >
                     <Button asChild variant="outline">
                        <Link href="/dashboard/credit-notes"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Link>
                    </Button>
                </PageHeader>
            </div>
        );
    }


    return (
        <>
            <PageHeader
                title={`Dossiê da NC: ${creditNote.ncNumber}`}
                description="Detalhes, histórico de partilhas e protocolos vinculados."
            >
                <div className="flex gap-2">
                    <Button asChild variant="outline">
                        <Link href="/dashboard/credit-notes"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar à Lista</Link>
                    </Button>
                     <Button onClick={() => window.print()}>
                        <Printer className="mr-2 h-4 w-4" /> Imprimir
                    </Button>
                </div>
            </PageHeader>

            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Dados de Lançamento</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <InfoItem label="Nº da NC" value={creditNote.ncNumber} />
                            <InfoItem label="UASG" value={creditNote.uasg} />
                            <InfoItem label="Data de Emissão" value={formattedDate(creditNote.emissionDate)} />
                            <InfoItem label="Data Limite" value={formattedDate(creditNote.limitDate)} />
                            <InfoItem label="PTRES" value={creditNote.ptres} />
                            <InfoItem label="Fonte" value={creditNote.fonte} />
                            <InfoItem label="Natureza da Despesa (ND)" value={creditNote.nd} />
                            <InfoItem label="Plano Interno (PI)" value={creditNote.pi} />
                            <InfoItem label="Valor Total" value={formatCurrency(creditNote.totalValue)} />
                            <InfoItem label="Saldo Disponível" value={formatCurrency(creditNote.balance)} />
                        </div>
                        {creditNote.observation && (
                             <div className="pt-4">
                                <InfoItem label="Observação" value={<span className="text-sm font-normal italic">"{creditNote.observation}"</span>} />
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Histórico de Partilhas</CardTitle>
                        <CardDescription>Valores distribuídos para as Organizações Militares.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>OM</TableHead>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Lançado por</TableHead>
                                    <TableHead className="text-right">Valor Partilhado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {creditNote.shares && creditNote.shares.length > 0 ? (
                                    creditNote.shares.map((share, index) => {
                                        const om = omsMap.get(share.omId);
                                        const user = usersMap.get(share.sharedBy);
                                        return (
                                            <TableRow key={index}>
                                                <TableCell>{om ? `${om.code} - ${om.abbreviation}` : 'OM não encontrada'}</TableCell>
                                                <TableCell>{formattedDate(share.sharedAt)}</TableCell>
                                                <TableCell>{user ? `${user.rank} ${user.warName}` : 'Usuário desconhecido'}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(share.value)}</TableCell>
                                            </TableRow>
                                        )
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center h-24">Nenhuma partilha realizada para esta NC.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle>Histórico de Recolhimentos</CardTitle>
                        <CardDescription>Valores que foram recolhidos da Nota de Crédito.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Lançado por</TableHead>
                                    <TableHead>Observação</TableHead>
                                    <TableHead className="text-right">Valor Recolhido</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {creditNote.recollections && creditNote.recollections.length > 0 ? (
                                    creditNote.recollections.map((recollection, index) => {
                                        const user = usersMap.get(recollection.recollectedBy);
                                        return (
                                            <TableRow key={index}>
                                                <TableCell>{formattedDate(recollection.recollectedAt)}</TableCell>
                                                <TableCell>{user ? `${user.rank} ${user.warName}` : 'Usuário desconhecido'}</TableCell>
                                                <TableCell>{recollection.observation || '—'}</TableCell>
                                                <TableCell className="text-right font-medium text-destructive">-{formatCurrency(recollection.value)}</TableCell>
                                            </TableRow>
                                        )
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center h-24">Nenhum recolhimento realizado para esta NC.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Histórico de Protocolos (P_Req)</CardTitle>
                        <CardDescription>Processos de aquisição vinculados a esta Nota de Crédito.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Cód. Controle</TableHead>
                                    <TableHead>OM</TableHead>
                                    <TableHead>Situação</TableHead>
                                    <TableHead>Lançado por</TableHead>
                                    <TableHead>Data Protocolo</TableHead>
                                    <TableHead>Nº Empenho</TableHead>
                                    <TableHead className="text-right">Valor Utilizado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                 {linkedProtocols.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">Nenhum protocolo vinculado a esta NC.</TableCell>
                                    </TableRow>
                                ) : (
                                    linkedProtocols.map(protocol => {
                                         const om = omsMap.get(protocol.omId);
                                         const user = usersMap.get(protocol.userId);
                                         const valueFromThisNC = protocol.creditSources.find(s => s.creditNoteId === creditNoteId)?.value || 0;
                                         return (
                                            <TableRow key={protocol.id}>
                                                <TableCell className="font-medium">
                                                    <Link href={`/dashboard/protocols/${protocol.id}`} className="text-primary hover:underline">{protocol.controlCode}</Link>
                                                </TableCell>
                                                <TableCell>{om?.abbreviation || 'N/A'}</TableCell>
                                                <TableCell>
                                                    <Badge variant={getStatusVariant(protocol.status)} className={cn(protocol.status === "Empenhado" && "bg-green-600 hover:bg-green-700")}>
                                                        {protocol.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{user ? `${user.rank} ${user.warName}` : 'N/A'}</TableCell>
                                                <TableCell>{formattedDate(protocol.createdAt)}</TableCell>
                                                <TableCell>
                                                    {protocol.commitments && protocol.commitments.length > 0 ? protocol.commitments[0].neNumber : '—'}
                                                </TableCell>
                                                <TableCell className="text-right">{formatCurrency(valueFromThisNC)}</TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
