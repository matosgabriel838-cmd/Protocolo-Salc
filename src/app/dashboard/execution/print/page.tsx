"use client";

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, Suspense, useRef } from 'react';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, documentId, doc } from 'firebase/firestore';
import { Protocol, CreditNote, OM, ComplianceReport, UserProfile, Modality } from '@/lib/data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import './print.css';
import { PlaceHolderImages } from '@/lib/placeholder-images';

type EnrichedPrintItem = {
    protocol: Protocol;
    om: OM;
    modality: Modality;
    lastUpdate: string;
};


// Helper to get the last update from observations
const getLastUpdateDate = (protocol: Protocol): string => {
    if (!protocol.observations || protocol.observations.length === 0) {
        // Fallback to the most recent commitment date if no observations
        if (protocol.commitments && protocol.commitments.length > 0) {
            const sortedCommitments = [...protocol.commitments].sort((a,b) => new Date(b.neDate).getTime() - new Date(a.neDate).getTime());
            return sortedCommitments[0].neDate;
        }
        return protocol.createdAt;
    }
    const sortedObs = [...protocol.observations].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return sortedObs[0].createdAt;
}


function PrintContent() {
    const searchParams = useSearchParams();
    const firestore = useFirestore();
    const printContainerRef = useRef<HTMLDivElement>(null);
    
    const reportId = searchParams.get('reportId');

    const reportDocRef = useMemoFirebase(() => {
        if (!firestore || !reportId) return null;
        return doc(firestore, "complianceReports", reportId);
    }, [firestore, reportId]);

    const { data: report, isLoading: isLoadingReport } = useDoc<ComplianceReport>(reportDocRef);

    const protocolIds = useMemo(() => report?.protocolIds || [], [report]);

    const protocolsQuery = useMemoFirebase(() => {
        if (!firestore || protocolIds.length === 0) return null;
        return query(collection(firestore, "protocols"), where(documentId(), "in", protocolIds));
    }, [firestore, protocolIds]);

    const { data: protocols, isLoading: isLoadingProtocols } = useCollection<Protocol>(protocolsQuery);

    const allOmIds = useMemo(() => protocols ? [...new Set(protocols.map(p => p.omId))] : [], [protocols]);
    const allModalityIds = useMemo(() => protocols ? [...new Set(protocols.map(p => p.modalityId))] : [], [protocols]);
    const allUserIds = useMemo(() => report ? [report.generatedBy] : [], [report]);

    const omsQuery = useMemoFirebase(() => {
        if (!firestore || allOmIds.length === 0) return null;
        return query(collection(firestore, 'militaryOrganizations'), where(documentId(), 'in', allOmIds));
    }, [firestore, allOmIds]);
    const { data: oms, isLoading: isLoadingOms } = useCollection<OM>(omsQuery);

    const modalitiesQuery = useMemoFirebase(() => {
        if (!firestore || allModalityIds.length === 0) return null;
        return query(collection(firestore, 'licitationModalities'), where(documentId(), 'in', allModalityIds));
    }, [firestore, allModalityIds]);
    const { data: modalities, isLoading: isLoadingModalities } = useCollection<Modality>(modalitiesQuery);

    const usersQuery = useMemoFirebase(() => {
        if (!firestore || allUserIds.length === 0) return null;
        return query(collection(firestore, 'users'), where('id', 'in', allUserIds));
    }, [firestore, allUserIds]);
    const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);
    
    const generatorUser = useMemo(() => {
        if(!users || !report) return null;
        return users.find(u => u.id === report.generatedBy);
    }, [users, report]);

    const brasaoImage = PlaceHolderImages.find(p => p.id === 'brasao-nacional');


    const isLoading = isLoadingReport || isLoadingProtocols || isLoadingOms || isLoadingUsers || isLoadingModalities;

    useEffect(() => {
        if (!isLoading && report && protocols && protocols.length > 0 && printContainerRef.current) {
            document.title = report.controlNumber.replace(/[\s/]/g, '_');
            const element = printContainerRef.current;
            const opt = {
                margin:       1,
                filename:     `${document.title}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2 },
                jsPDF:        { unit: 'cm', format: 'a4', orientation: 'portrait' }
            };
            
            // @ts-ignore
            if (window.html2pdf) {
                // @ts-ignore
                window.html2pdf().from(element).set(opt).save();
            } else {
                 console.error("html2pdf.js not loaded");
            }
        }
    }, [isLoading, protocols, report]);

    const enrichedItems = useMemo(() => {
        if (isLoading || !protocols || !oms || !modalities) return [];

        const omsMap = new Map(oms.map(om => [om.id, om]));
        const modalitiesMap = new Map(modalities.map(m => [m.id, m]));

        const result: EnrichedPrintItem[] = protocols
            .filter(protocol => protocol.commitments && protocol.commitments.length > 0)
            .map(protocol => {
                const om = omsMap.get(protocol.omId);
                const modality = modalitiesMap.get(protocol.modalityId);
                if (!om || !modality) return null;
                
                const lastUpdate = getLastUpdateDate(protocol);

                return {
                    protocol,
                    om,
                    modality,
                    lastUpdate
                };
            }).filter((item): item is EnrichedPrintItem => item !== null);
        
        result.sort((a, b) => {
            const dateA = new Date(a.lastUpdate).getTime();
            const dateB = new Date(b.lastUpdate).getTime();
            if (dateA !== dateB) return dateA - dateB;

            const neA = a.protocol.commitments?.[0]?.neNumber || '';
            const neB = b.protocol.commitments?.[0]?.neNumber || '';
            return neA.localeCompare(neB, undefined, { numeric: true });
        });

        return result;

    }, [protocols, oms, modalities, isLoading]);

    const formatDate = (dateString?: string) => dateString ? new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
    
    const getOrderNumber = (index: number) => {
        return (index + 1).toString().padStart(3, '0');
    };


    if (isLoading) {
        return (
            <div className="print-container p-8">
                <Skeleton className="h-24 w-full mb-8" />
                <Skeleton className="h-64 w-full" />
                <p className="text-center mt-4">Carregando dados para gerar o PDF...</p>
            </div>
        );
    }
    
    if (!report || enrichedItems.length === 0) {
        return <div className="print-container p-8 text-center">Nenhum empenho válido encontrado para este relatório. O PDF não será gerado.</div>;
    }

    return (
        <div className="print-container-wrapper">
            <div className="print-container" ref={printContainerRef}>
                <header className="print-header text-center text-xs">
                    {brasaoImage && (
                        <Image 
                            src={brasaoImage.imageUrl}
                            alt={brasaoImage.description}
                            width={80}
                            height={80}
                            className="mx-auto mb-4"
                        />
                    )}
                    <p className="font-bold">MINISTÉRIO DA DEFESA</p>
                    <p className="font-bold">EXÉRCITO BRASILEIRO</p>
                    <p className="font-bold">COMANDO DE OPERAÇÕES ESPECIAIS</p>
                    <p className="font-bold">BASE ADMINISTRATIVA</p>
                    <p className="mt-2">Avenida Salvador, S/Nº – Jardim Guanabara – Goiânia (GO) – CEP 74675-710</p>
                    <p>FONE (62) 3239 4545 – FAX (62) 3239 4543 – E-mail: salc@copesp.eb.mil.br</p>
                </header>
                
                <div className="report-info text-center my-6">
                    <h1 className="text-xl font-bold">RELATÓRIO DE CONFORMIDADE DE EMPENHOS</h1>
                    <p className="font-bold mt-2">{report.controlNumber}</p>
                    <p className="text-sm text-muted-foreground">Gerado em: {formatDate(report.generatedAt)}</p>
                </div>


                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-16">Ordem</TableHead>
                            <TableHead>Data do Evento</TableHead>
                            <TableHead>Nº Empenho</TableHead>
                            <TableHead>Conformidade</TableHead>
                            <TableHead>Financeiro</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {enrichedItems.map((item, index) => {
                            const commitmentNumbers = item.protocol.commitments?.map(c => c.neNumber).join(', ') || '—';
                            return (
                                <TableRow key={item.protocol.id}>
                                    <TableCell>{getOrderNumber(index)}</TableCell>
                                    <TableCell>{formatDate(item.lastUpdate)}</TableCell>
                                    <TableCell>{commitmentNumbers}</TableCell>
                                    <TableCell></TableCell>
                                    <TableCell>{item.modality.isFinancial ? '' : '—'}</TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
                <footer className="print-footer">
                    <div className="signature-line">
                        <p>_________________________________________</p>
                        <p>Assinatura do Responsável pela Geração</p>
                        <p>{generatorUser?.username || report.generatedBy}</p>
                    </div>
                </footer>
            </div>
        </div>
    );
}

export default function PrintPage() {
    return (
        <Suspense fallback={<div className="p-8"><Skeleton className="h-screen w-full" /></div>}>
            <PrintContent />
        </Suspense>
    )
}