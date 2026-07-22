
"use client";

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Protocol, UserProfile, CreditNote, OM, ProtocolObservation, CancellationLog, Commitment } from '@/lib/data';
import { PageHeader } from '@/components/dashboard/page-header';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, FileX2 } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CancellationForm } from '@/components/dashboard/cancellation-form';
import { AnnulmentForm } from '@/components/dashboard/annulment-form';
import { ScrollArea } from '@/components/ui/scroll-area';

type AnnulmentEntry = {
    id: string;
    protocolId?: string;
    creditNoteId?: string;
    controlCode?: string;
    neNumber?: string;
    omAbbreviation: string;
    annulmentDate: string;
    annulledValue: number;
    justification: string;
    user: string;
    uasg?: string;
    ncNumber?: string;
    pi?: string;
    type: 'Anulação' | 'Cancelamento';
    diexNumber?: string;
}

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (dateString?: string) => dateString ? new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';

// Helper to find the original commitment that was annulled
const findAnnulledCommitment = (protocol: Protocol, neNumber: string | undefined): Commitment | undefined => {
    if (!neNumber || !protocol.commitments) return undefined;
    return protocol.commitments.find(c => c.neNumber === neNumber);
};

const AnnulmentsTable = ({ records, isLoading }: { records: AnnulmentEntry[], isLoading: boolean }) => {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo / DIEx</TableHead>
                    <TableHead>Cód. Controle / OM</TableHead>
                    <TableHead>Nº Empenho / UASG</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>NC / PI</TableHead>
                    <TableHead>Observação</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">Carregando registros...</TableCell>
                    </TableRow>
                ) : records.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">Nenhum lançamento encontrado.</TableCell>
                    </TableRow>
                ) : (
                    records.map((item) => (
                        <TableRow key={item.id}>
                            <TableCell>
                                <div className="font-medium">{formatDate(item.annulmentDate)}</div>
                                <div className="text-sm text-muted-foreground">{item.user}</div>
                            </TableCell>
                            <TableCell>
                                <Badge variant={item.type === 'Anulação' ? 'destructive' : 'secondary'}>
                                    {item.type}
                                </Badge>
                                {item.diexNumber && <div className="text-sm text-muted-foreground">{item.diexNumber}</div>}
                            </TableCell>
                            <TableCell>
                                {item.protocolId ? (
                                    <Link href={`/dashboard/protocols/${item.protocolId}`} className="font-medium text-primary hover:underline">{item.controlCode}</Link>
                                ) : (
                                    <div className="font-medium text-muted-foreground">—</div>
                                )}
                                <div className="text-sm text-muted-foreground">{item.omAbbreviation}</div>
                            </TableCell>
                            <TableCell>
                                <div className="font-medium">{item.neNumber || '—'}</div>
                                <div className="text-sm text-muted-foreground">{item.uasg || '—'}</div>
                            </TableCell>
                            <TableCell className="font-medium text-destructive">{formatCurrency(item.annulledValue)}</TableCell>
                            <TableCell>
                                {item.ncNumber && item.creditNoteId ? (
                                     <Link href={`/dashboard/credit-notes/${item.creditNoteId}`} className="font-medium text-primary hover:underline">{item.ncNumber}</Link>
                                ): (
                                    <div className="font-medium text-muted-foreground">{item.ncNumber || '—'}</div>
                                )}
                                <div className="text-sm text-muted-foreground">{item.pi || '—'}</div>
                            </TableCell>
                            <TableCell className="text-xs whitespace-pre-wrap break-words max-w-xs">{item.justification}</TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
    )
}

export default function AnnulmentsPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [isCancellationFormOpen, setIsCancellationFormOpen] = useState(false);
    const [isAnnulmentFormOpen, setIsAnnulmentFormOpen] = useState(false);
    const firestore = useFirestore();
    const { userProfile } = useUser();
    const isAdmin = userProfile?.role === 'ADMIN';

    const protocolsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, "protocols"), orderBy("createdAt", "desc"), limit(200));
    }, [firestore]);
    const { data: protocols, isLoading: isLoadingProtocols } = useCollection<Protocol>(protocolsQuery);

    const omsQuery = useMemoFirebase(() => {
        if(!firestore) return null;
        return collection(firestore, "militaryOrganizations");
    }, [firestore]);
    const { data: oms, isLoading: isLoadingOms } = useCollection<OM>(omsQuery);

    const usersQuery = useMemoFirebase(() => {
        if(!firestore) return null;
        return collection(firestore, 'users');
    }, [firestore]);
    const { data: usersData, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);

    const creditNotesQuery = useMemoFirebase(() => {
        if(!firestore) return null;
        return collection(firestore, 'creditNotes');
    }, [firestore]);
    const { data: creditNotes, isLoading: isLoadingCreditNotes } = useCollection<CreditNote>(creditNotesQuery);

    const cancellationsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'cancellationLogs'), orderBy('createdAt', 'desc'), limit(50));
    }, [firestore]);
    const { data: cancellationLogs, isLoading: isLoadingCancellations } = useCollection<CancellationLog>(cancellationsQuery);

    const omsMap = useMemo(() => oms ? new Map(oms.map(om => [om.id, om])) : new Map(), [oms]);
    const usersMap = useMemo(() => usersData ? new Map(usersData.map(u => [u.id, u])) : new Map(), [usersData]);
    const creditNotesMap = useMemo(() => creditNotes ? new Map(creditNotes.map(nc => [nc.id, nc])) : new Map(), [creditNotes]);
    
    const isLoading = isLoadingProtocols || isLoadingOms || isLoadingUsers || isLoadingCreditNotes || isLoadingCancellations;

    const { annulments, cancellations } = useMemo(() => {
        const annulmentRecords: AnnulmentEntry[] = [];
        const cancellationRecords: AnnulmentEntry[] = [];

        // Process Annulments from Protocols
        protocols?.forEach(protocol => {
            protocol.observations.forEach((obs, index) => {
                if (obs.text?.toUpperCase().startsWith('ANULAÇÃO')) {
                    const neMatch = obs.text.match(/do empenho\s+([a-zA-Z0-9]+)/);
                    const diexMatch = obs.text.match(/ANULAÇÃO \(DIEx\s+([^)]+)\)/);
                    const neNumber = neMatch ? neMatch[1] : undefined;
                    const diexNumber = diexMatch ? diexMatch[1] : undefined;
                    
                    const valueMatch = obs.text.match(/Valor de (R\$\s*[\d.,]+)/);
                    let annulledValue = 0;
                    if(valueMatch && valueMatch[1]) {
                        annulledValue = parseFloat(valueMatch[1].replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
                    }
                    
                    const firstCreditSource = protocol.creditSources?.[0];
                    const creditNote = firstCreditSource ? creditNotesMap.get(firstCreditSource.creditNoteId) : undefined;
                    const user = usersMap.get(obs.userId);

                    annulmentRecords.push({
                        id: `${protocol.id}-${index}`,
                        protocolId: protocol.id,
                        creditNoteId: creditNote?.id,
                        controlCode: protocol.controlCode,
                        neNumber: neNumber, 
                        omAbbreviation: omsMap.get(protocol.omId)?.abbreviation || 'N/A',
                        annulmentDate: obs.createdAt,
                        annulledValue: annulledValue,
                        justification: obs.text,
                        user: user ? `${user.rank} ${user.warName}` : "Desconhecido",
                        uasg: creditNote?.uasg || 'N/A',
                        ncNumber: creditNote?.ncNumber || 'N/A',
                        pi: creditNote?.pi || 'N/A',
                        type: 'Anulação',
                        diexNumber: diexNumber
                    });
                }
            });
        });

        // Process Cancellations from Logs
        cancellationLogs?.forEach(log => {
            const user = usersMap.get(log.createdBy);
            cancellationRecords.push({
                id: log.id,
                omAbbreviation: omsMap.get(log.omId)?.abbreviation || 'N/A',
                neNumber: log.neNumber,
                annulmentDate: log.createdAt,
                annulledValue: log.value,
                justification: log.observation,
                user: user ? `${user.rank} ${user.warName}` : "Desconhecido",
                uasg: log.uasg,
                type: 'Cancelamento',
                diexNumber: log.diexNumber,
            });
        });

        // Sort both lists by most recent date
        annulmentRecords.sort((a, b) => new Date(b.annulmentDate).getTime() - new Date(a.annulmentDate).getTime());
        cancellationRecords.sort((a, b) => new Date(b.annulmentDate).getTime() - new Date(a.annulmentDate).getTime());
        
        return { annulments: annulmentRecords, cancellations: cancellationRecords };

    }, [protocols, cancellationLogs, omsMap, usersMap, creditNotesMap]);

    const filterRecords = (records: AnnulmentEntry[], term: string) => {
        if (!records) return [];
        const search = term.toLowerCase();
        if (!search) return records;
        return records.filter(entry => 
            (entry.controlCode?.toLowerCase().includes(search)) ||
            (entry.neNumber?.toLowerCase().includes(search)) ||
            entry.omAbbreviation?.toLowerCase().includes(search) ||
            entry.justification?.toLowerCase().includes(search) ||
            entry.user?.toLowerCase().includes(search) ||
            entry.annulledValue?.toString().includes(search) ||
            (entry.uasg?.toLowerCase().includes(search)) ||
            (entry.ncNumber?.toLowerCase().includes(search)) ||
            (entry.pi?.toLowerCase().includes(search)) ||
            (entry.diexNumber?.toLowerCase().includes(search))
        );
    }

    const filteredAnnulments = useMemo(() => filterRecords(annulments, searchTerm), [annulments, searchTerm]);
    const filteredCancellations = useMemo(() => filterRecords(cancellations, searchTerm), [cancellations, searchTerm]);

    return (
        <>
            <PageHeader
                title="Consulta de Anulações e Cancelamentos"
                description="Visualize o histórico de todos os empenhos que foram anulados ou cancelados."
            >
                <div className='flex items-center gap-2'>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            type="search" 
                            placeholder="Pesquisar lançamentos..." 
                            className="pl-8 sm:w-[300px]" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {isAdmin && (
                        <>
                             <Dialog open={isAnnulmentFormOpen} onOpenChange={setIsAnnulmentFormOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="destructive">
                                        <FileX2 className="mr-2 h-4 w-4" />
                                        Lançar Anulação
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[750px]">
                                    <DialogHeader>
                                        <DialogTitle>Anulação de Empenho</DialogTitle>
                                        <DialogDescription>
                                            Selecione o empenho e preencha os dados para anulação.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <ScrollArea className="max-h-[80vh] p-6">
                                        {protocols && creditNotes && oms && (
                                            <AnnulmentForm
                                                protocols={protocols}
                                                creditNotes={creditNotes}
                                                setOpen={setIsAnnulmentFormOpen}
                                            />
                                        )}
                                    </ScrollArea>
                                </DialogContent>
                            </Dialog>
                            <Dialog open={isCancellationFormOpen} onOpenChange={setIsCancellationFormOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="destructive" className="bg-red-800 hover:bg-red-900">
                                        <FileX2 className="mr-2 h-4 w-4" />
                                        Lançar Cancelamento
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[700px]">
                                     <DialogHeader>
                                        <DialogTitle>Lançar Cancelamento de Empenho</DialogTitle>
                                        <DialogDescription>
                                            Registre um cancelamento de empenho de exercícios anteriores. Este lançamento é apenas para fins de registro histórico.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <ScrollArea className="max-h-[80vh] p-6">
                                        {oms && <CancellationForm oms={oms} setOpen={setIsCancellationFormOpen} />}
                                    </ScrollArea>
                                </DialogContent>
                            </Dialog>
                        </>
                    )}
                </div>
            </PageHeader>
            <Tabs defaultValue="annulments">
                <TabsList>
                    <TabsTrigger value="annulments">Anulações</TabsTrigger>
                    <TabsTrigger value="cancellations">Cancelamentos</TabsTrigger>
                </TabsList>
                <TabsContent value="annulments">
                    <Card>
                        <CardContent className='pt-6'>
                            <AnnulmentsTable records={filteredAnnulments} isLoading={isLoading} />
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="cancellations">
                     <Card>
                        <CardContent className='pt-6'>
                            <AnnulmentsTable records={filteredCancellations} isLoading={isLoading} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </>
    );
}
