"use client";

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, Suspense, useRef } from 'react';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, documentId, doc } from 'firebase/firestore';
import { Protocol, OM, ComplianceReport, UserProfile, Commitment } from '@/lib/data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import './../print/print.css'; // Reuse the same CSS
import { PlaceHolderImages } from '@/lib/placeholder-images';

type EnrichedPrintItem = Protocol & { 
    om: OM;
    commitments: Commitment[]; // Group commitments
};

function PrintFinancialContent() {
    const searchParams = useSearchParams();
    const firestore = useFirestore();
    const printContainerRef = useRef<HTMLDivElement>(null);
    
    const reportId = searchParams.get('reportId');
    const commitmentNumbersParam = searchParams.get('commitmentNumbers');

    const reportDocRef = useMemoFirebase(() => {
        if (!firestore || !reportId) return null;
        return doc(firestore, "complianceReports", reportId);
    }, [firestore, reportId]);
    const { data: report, isLoading: isLoadingReport } = useDoc<ComplianceReport>(reportDocRef);

    const protocolIds = useMemo(() => report?.protocolIds || [], [report]);
    const commitmentNumbers = useMemo(() => {
        try {
            return commitmentNumbersParam ? JSON.parse(commitmentNumbersParam) : [];
        } catch (e) {
            return [];
        }
    }, [commitmentNumbersParam]);

    const protocolsQuery = useMemoFirebase(() => {
        if (!firestore || protocolIds.length === 0) return null;
        return query(collection(firestore, "protocols"), where(documentId(), "in", protocolIds));
    }, [firestore, protocolIds]);
    const { data: protocols, isLoading: isLoadingProtocols } = useCollection<Protocol>(protocolsQuery);

    const allOmIds = useMemo(() => protocols ? [...new Set(protocols.map(p => p.omId))] : [], [protocols]);
    const allUserIds = useMemo(() => report ? [report.generatedBy] : [], [report]);

    const omsQuery = useMemoFirebase(() => {
        if (!firestore || allOmIds.length === 0) return null;
        return query(collection(firestore, 'militaryOrganizations'), where(documentId(), 'in', allOmIds));
    }, [firestore, allOmIds]);
    const { data: oms, isLoading: isLoadingOms } = useCollection<OM>(omsQuery);

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


    const isLoading = isLoadingReport || isLoadingProtocols || isLoadingOms || isLoadingUsers;

    useEffect(() => {
        if (!isLoading && report && protocols && protocols.length > 0 && printContainerRef.current) {
            document.title = `Protocolo_Financeiro_${report.controlNumber.replace(/[\s/]/g, '_')}`;
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
        if (isLoading || !protocols || !oms) return [];

        const omsMap = new Map(oms.map(om => [om.id, om]));
        const items: EnrichedPrintItem[] = [];

        protocols.forEach(protocol => {
            const om = omsMap.get(protocol.omId);
            if (!om) return;

            const relevantCommitments = protocol.commitments?.filter(c => commitmentNumbers.includes(c.neNumber)) || [];
            
            if (relevantCommitments.length > 0) {
                const existing = items.find(i => i.id === protocol.id);
                if (existing) {
                    existing.commitments.push(...relevantCommitments);
                } else {
                    items.push({
                        ...protocol,
                        om,
                        commitments: relevantCommitments,
                    });
                }
            }
        });
        
        items.sort((a, b) => (a.commitments[0].neNumber || '').localeCompare(b.commitments[0].neNumber || '', undefined, { numeric: true }));

        return items;

    }, [protocols, oms, commitmentNumbers, isLoading]);

    const formatDate = (dateString?: string) => dateString ? new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
    
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
        return <div className="print-container p-8 text-center">Nenhum protocolo válido encontrado para este relatório financeiro. O PDF não será gerado.</div>;
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
                    <h1 className="text-xl font-bold">PROTOCOLO FINANCEIRO</h1>
                    <p className="font-bold mt-2">{report.controlNumber}</p>
                    <p className="text-sm text-muted-foreground">Gerado em: {formatDate(report.generatedAt)}</p>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>OM</TableHead>
                            <TableHead>Nome do Beneficiário</TableHead>
                            <TableHead>Nº Empenho</TableHead>
                            <TableHead>Data do Empenho</TableHead>
                            <TableHead>Mapa SIPEO</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {enrichedItems.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>{item.om.code} - {item.om.abbreviation}</TableCell>
                                <TableCell>{item.beneficiaryName || '—'}</TableCell>
                                <TableCell>{item.commitments.map(c => c.neNumber).join(', ')}</TableCell>
                                <TableCell>{formatDate(item.commitments[0].neDate)}</TableCell>
                                <TableCell>{item.sipeoMapNumber || '—'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <footer className="print-footer grid grid-cols-2 gap-4 items-end">
                    <div className="signature-line">
                        <p>_________________________________________</p>
                        <p>Assinatura do Responsável pela Geração</p>
                        <p>{generatorUser ? `${generatorUser.rank} ${generatorUser.warName}`: 'Usuário não encontrado'}</p>
                    </div>
                    <div className="signature-line">
                        <p>_________________________________________</p>
                        <p>Responsável pelo Recebimento</p>
                    </div>
                </footer>
            </div>
        </div>
    );
}

export default function PrintFinancialPage() {
    return (
        <Suspense fallback={<div className="p-8"><Skeleton className="h-screen w-full" /></div>}>
            <PrintFinancialContent />
        </Suspense>
    )
}