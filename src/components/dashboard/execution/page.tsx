
"use client";

import { useState, useMemo, useEffect } from "react";
import { v4 as uuidv4 } from 'uuid';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Protocol, CreditNote, OM, ComplianceReport, UserProfile, Modality, ReportType, Commitment } from "@/lib/data";
import { PageHeader } from "@/components/dashboard/page-header";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, orderBy, where, documentId, setDoc, doc } from "firebase/firestore";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Printer, Search, X, FileSignature } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type EnrichedReportableItem = {
    uniqueId: string; // protocolId-commitmentIndex
    protocol: Protocol;
    commitment: Commitment;
    creditNotes: CreditNote[];
    om: OM;
    modality: Modality;
    lastUpdate: string;
    complianceReportControlNumber?: string;
    complianceReportGeneratedAt?: string;
    financialReportControlNumber?: string;
    financialReportGeneratedAt?: string;
};


// Helper to get the last update from observations
const getLastUpdateDate = (protocol: Protocol): string => {
    if (!protocol.observations || protocol.observations.length === 0) {
        const lastCommitmentDate = protocol.commitments && protocol.commitments.length > 0 
            ? [...protocol.commitments].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].createdAt
            : protocol.createdAt;
        return lastCommitmentDate || protocol.createdAt;
    }
    const sortedObs = [...protocol.observations].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return sortedObs[0].createdAt;
}

function ComplianceTable({ 
    items, 
    selectedItems,
    setSelectedItems,
    type,
}: { 
    items: EnrichedReportableItem[]; 
    selectedItems: Set<string>;
    setSelectedItems: React.Dispatch<React.SetStateAction<Set<string>>>;
    type: ReportType;
}) {

    const formatDate = (dateString?: string) => dateString ? new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
    
    const handleSelectAll = (checked: boolean | "indeterminate") => {
        const currentIds = items.map(p => p.uniqueId);
        if (checked) {
            setSelectedItems(prev => new Set([...prev, ...currentIds]));
        } else {
            setSelectedItems(prev => {
                const newSet = new Set(prev);
                currentIds.forEach(id => newSet.delete(id));
                return newSet;
            });
        }
    }

    const handleSelectRow = (id: string, checked: boolean) => {
        setSelectedItems(prev => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(id);
            } else {
                newSet.delete(id);
            }
            return newSet;
        });
    }

    const isAllSelected = items.length > 0 && items.every(p => selectedItems.has(p.uniqueId));
    const isSomeSelected = items.some(p => selectedItems.has(p.uniqueId));
    
    const reportControlNumberField = type === 'COMPLIANCE' ? 'complianceReportControlNumber' : 'financialReportControlNumber';

    return (
        <Table>
            <TableHeader>
                <TableRow>
                     <TableHead className="w-12">
                        <Checkbox
                            checked={isAllSelected ? true : (isSomeSelected ? "indeterminate" : false)}
                            onCheckedChange={handleSelectAll}
                        />
                    </TableHead>
                    <TableHead>Nº Empenho</TableHead>
                    {type === 'FINANCIAL' && <TableHead>Favorecido</TableHead>}
                    <TableHead>Data do Evento</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Relatório Associado</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {items.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={type === 'FINANCIAL' ? 6 : 5} className="h-24 text-center">Nenhum empenho encontrado para esta UASG.</TableCell>
                    </TableRow>
                ) : (
                    items.map((item) => {
                        return(
                        <TableRow key={item.uniqueId} data-state={selectedItems.has(item.uniqueId) && "selected"}>
                            <TableCell>
                                <Checkbox
                                    checked={selectedItems.has(item.uniqueId)}
                                    onCheckedChange={(checked) => handleSelectRow(item.uniqueId, !!checked)}
                                />
                            </TableCell>
                            <TableCell>
                               <div className="font-medium">{item.commitment.neNumber}</div>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="text-xs text-muted-foreground cursor-help underline decoration-dashed">
                                                {item.creditNotes.length > 1 ? `${item.creditNotes.length} NCs` : item.creditNotes[0]?.ncNumber}
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            {item.creditNotes.map(nc => <p key={nc.id}>{nc.ncNumber}</p>)}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </TableCell>
                            {type === 'FINANCIAL' && (
                                <TableCell className="max-w-[200px] truncate" title={item.protocol.beneficiaryName}>
                                    {item.protocol.beneficiaryName || "—"}
                                </TableCell>
                            )}
                            <TableCell className="font-medium">{formatDate(item.lastUpdate)}</TableCell>
                            <TableCell>
                                <div className="flex items-center gap-1">
                                    {item.modality.isCompliance && <Badge variant="secondary" className="w-6 h-6 flex items-center justify-center">C</Badge>}
                                    {item.modality.isFinancial && <Badge variant="outline" className="w-6 h-6 flex items-center justify-center">F</Badge>}
                                </div>
                            </TableCell>
                            <TableCell>{item[reportControlNumberField] || "—"}</TableCell>
                        </TableRow>
                    )})
                )}
            </TableBody>
        </Table>
    );
}

export default function CompliancePage() {
    const firestore = useFirestore();
    const { user, userProfile } = useUser();
    const { toast } = useToast();
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState("uasg_160098");
    const [isGenerating, setIsGenerating] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [hideReported, setHideReported] = useState(true);
    const isAdmin = userProfile?.role === 'ADMIN';

    const protocolsQuery = useMemoFirebase(() => (firestore && user) ? query(collection(firestore, "protocols"), orderBy("createdAt", "desc")) : null, [firestore, user]);
    const { data: protocols, isLoading: isLoadingProtocols } = useCollection<Protocol>(protocolsQuery);

    const creditNotesQuery = useMemoFirebase(() => (firestore && user) ? collection(firestore, "creditNotes") : null, [firestore, user]);
    const { data: creditNotes, isLoading: isLoadingCreditNotes } = useCollection<CreditNote>(creditNotesQuery);
  
    const omsQuery = useMemoFirebase(() => (firestore && user) ? collection(firestore, "militaryOrganizations") : null, [firestore, user]);
    const { data: oms, isLoading: isLoadingOms } = useCollection<OM>(omsQuery);

    const modalitiesQuery = useMemoFirebase(() => (firestore && user) ? collection(firestore, "licitationModalities") : null, [firestore, user]);
    const { data: modalities, isLoading: isLoadingModalities } = useCollection<Modality>(modalitiesQuery);

    const reportsQuery = useMemoFirebase(() => (firestore && user) ? query(collection(firestore, "complianceReports"), orderBy("generatedAt", "desc")) : null, [firestore, user]);
    const { data: reports, isLoading: isLoadingReports } = useCollection<ComplianceReport>(reportsQuery);

    const allUserIds = useMemo(() => reports ? [...new Set(reports.map(r => r.generatedBy))] : [], [reports]);
    const usersQuery = useMemoFirebase(() => {
        if (!firestore || !user || allUserIds.length === 0) return null;
        return query(collection(firestore, 'users'), where(documentId(), 'in', allUserIds));
    }, [firestore, user, allUserIds]);
    const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);
    const usersMap = useMemo(() => users ? new Map(users.map(u => [u.id, u.warName])) : new Map(), [users]);

    const isLoading = isLoadingProtocols || isLoadingCreditNotes || isLoadingOms || isLoadingReports || isLoadingUsers || isLoadingModalities;
    const formatDate = (dateString?: string) => dateString ? new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';

    useEffect(() => {
        setSelectedItems(new Set());
    }, [activeTab, hideReported]);
    
    const allRelevantItems = useMemo(() => {
        if (isLoading || !protocols || !creditNotes || !oms || !reports || !modalities) return [];

        const creditNotesMap = new Map(creditNotes.map(nc => [nc.id, nc]));
        const omsMap = new Map(oms.map(om => [om.id, om]));
        const modalitiesMap = new Map(modalities.map(m => [m.id, m]));
        
        const baseItems: EnrichedReportableItem[] = [];
        protocols.forEach(protocol => {
            if (!protocol.commitments || protocol.commitments.length === 0) return;

            const protocolCreditNotes = protocol.creditSources.map(source => creditNotesMap.get(source.creditNoteId)).filter(Boolean) as CreditNote[];
            if (protocolCreditNotes.length === 0) return;

            const om = omsMap.get(protocol.omId);
            const modality = modalitiesMap.get(protocol.modalityId);
            
            if (!om || !modality) return;

            const lastUpdate = getLastUpdateDate(protocol);

            protocol.commitments.forEach((commitment, index) => {
                const uniqueId = `${protocol.id}-${index}`;
                
                // Find latest reports for this specific commitment
                const latestCompliance = reports.find(r => 
                    r.type === 'COMPLIANCE' && 
                    r.protocolIds.includes(protocol.id) && 
                    (r.commitmentNumbers?.includes(commitment.neNumber))
                );

                const latestFinancial = reports.find(r => 
                    r.type === 'FINANCIAL' && 
                    r.protocolIds.includes(protocol.id) && 
                    (r.commitmentNumbers?.includes(commitment.neNumber))
                );

                baseItems.push({
                    uniqueId,
                    protocol,
                    commitment,
                    creditNotes: protocolCreditNotes,
                    om,
                    modality,
                    lastUpdate,
                    complianceReportControlNumber: latestCompliance?.controlNumber,
                    complianceReportGeneratedAt: latestCompliance?.generatedAt,
                    financialReportControlNumber: latestFinancial?.controlNumber,
                    financialReportGeneratedAt: latestFinancial?.generatedAt,
                });
            });
        });
        
        return baseItems;

    }, [protocols, creditNotes, oms, reports, modalities, isLoading]);

    const { uasg160098, uasg167098 } = useMemo(() => {
        const result: { uasg160098: EnrichedReportableItem[], uasg167098: EnrichedReportableItem[] } = { uasg160098: [], uasg167098: [] };
        
        allRelevantItems.forEach(item => {
             if (item.creditNotes.some(nc => nc.uasg === '160098')) result.uasg160098.push(item);
             if (item.creditNotes.some(nc => nc.uasg === '167098')) result.uasg167098.push(item);
        });
        
         const sortFn = (a: EnrichedReportableItem, b: EnrichedReportableItem) => {
            const dateA = new Date(a.lastUpdate).getTime();
            const dateB = new Date(b.lastUpdate).getTime();
            if (dateA !== dateB) return dateA - dateB;

            const neA = a.commitment.neNumber || '';
            const neB = b.commitment.neNumber || '';
            return neA.localeCompare(neB, undefined, { numeric: true });
        };
        
        result.uasg160098.sort(sortFn);
        result.uasg167098.sort(sortFn);

        return result;
    }, [allRelevantItems]);

    const filterItems = (items: EnrichedReportableItem[], reportType: ReportType) => {
        return items.filter(item => {
            const search = searchTerm.toLowerCase();
            const reportControlNumber = reportType === 'COMPLIANCE' ? item.complianceReportControlNumber : item.financialReportControlNumber;
            
            const matchesSearch = !search || 
                item.commitment.neNumber.toLowerCase().includes(search) ||
                (reportControlNumber && reportControlNumber.toLowerCase().includes(search)) ||
                (item.protocol.beneficiaryName && item.protocol.beneficiaryName.toLowerCase().includes(search));
            
            const isApplicable = reportType === 'COMPLIANCE' ? item.modality.isCompliance : item.modality.isFinancial;
            if(!isApplicable) return false;

            const reportGeneratedAt = reportType === 'COMPLIANCE' ? item.complianceReportGeneratedAt : item.financialReportGeneratedAt;
            // Item is "clean" only if report date >= last event date
            const hasBeenReportedAndNotUpdated = reportGeneratedAt && new Date(reportGeneratedAt).getTime() >= new Date(item.lastUpdate).getTime();
            const matchesFilter = !hideReported || !hasBeenReportedAndNotUpdated;

            return matchesSearch && matchesFilter;
        });
    }

    const filteredUasg160098Compliance = useMemo(() => filterItems(uasg160098, 'COMPLIANCE'), [uasg160098, searchTerm, hideReported]);
    const filteredUasg167098Compliance = useMemo(() => filterItems(uasg167098, 'COMPLIANCE'), [uasg167098, searchTerm, hideReported]);
    
    const filteredUasg160098Financial = useMemo(() => filterItems(uasg160098, 'FINANCIAL'), [uasg160098, searchTerm, hideReported]);
    const filteredUasg167098Financial = useMemo(() => filterItems(uasg167098, 'FINANCIAL'), [uasg167098, searchTerm, hideReported]);

    const filteredReports = useMemo(() => {
        if (!reports) return [];
        const search = searchTerm.toLowerCase();
        if (!search) return reports;
        return reports.filter(r => r.controlNumber.toLowerCase().includes(search));
    }, [reports, searchTerm]);

    const handleGenerateReport = async (type: ReportType) => {
        const uasg = activeTab.split('_')[1];
        if (selectedItems.size === 0) {
            toast({ variant: "destructive", title: "Nenhum empenho selecionado nesta aba." });
            return;
        }

        if (!firestore || !user) {
            toast({ variant: "destructive", title: "Erro de Autenticação!" });
            return;
        }

        setIsGenerating(true);

        try {
            const year = new Date().getFullYear();
            const yearReports = reports?.filter(r => r.year === year && r.uasg === uasg && r.type === type) || [];
            const sequence = (yearReports[0]?.sequence || 0) + 1;
            const controlNumber = `${sequence.toString().padStart(3, '0')}/${year} - ${uasg}`;
            
            const selectedCommitmentItems = allRelevantItems.filter(item => selectedItems.has(item.uniqueId));

            const selectedProtocolIds = [...new Set(selectedCommitmentItems.map(item => item.protocol.id))];
            const selectedCommitmentNumbers = selectedCommitmentItems.map(item => item.commitment.neNumber);

            const newReport: ComplianceReport = {
                id: uuidv4(),
                controlNumber,
                year,
                sequence,
                generatedAt: new Date().toISOString(),
                generatedBy: user.uid,
                protocolIds: selectedProtocolIds,
                commitmentNumbers: selectedCommitmentNumbers,
                uasg,
                type,
            };

            const reportDocRef = doc(firestore, 'complianceReports', newReport.id);
            await setDoc(reportDocRef, newReport);

            toast({ title: "Sucesso!", description: `Relatório ${controlNumber} gerado.` });
            
            // Clear selection after generation
            setSelectedItems(new Set());

            const printPage = type === 'COMPLIANCE' ? 'print' : 'print-financial';
            const urlParams = new URLSearchParams({
                reportId: newReport.id,
                commitmentNumbers: JSON.stringify(selectedCommitmentNumbers)
            });
            window.open(`/dashboard/execution/${printPage}?${urlParams.toString()}`, '_blank');
            
        } catch (error: any) {
            toast({ variant: "destructive", title: "Erro ao gerar relatório", description: error.message });
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleClearFilters = () => {
        setSearchTerm("");
    }

    return (
        <>
            <PageHeader
                title="Controle de Conformidade e Financeiro"
                description="Selecione os processos, emita e consulte os relatórios."
            >
                <div className="flex items-center gap-4">
                     <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            type="search" 
                            placeholder="Pesquisar..." 
                            className="pl-8 sm:w-[300px]" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                         {searchTerm && (
                            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6" onClick={handleClearFilters}>
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                    {isAdmin && (
                        <>
                            <Button onClick={() => handleGenerateReport('FINANCIAL')} disabled={selectedItems.size === 0 || isGenerating || activeTab === 'history'}>
                                <FileSignature className="mr-2 h-4 w-4" />
                                {isGenerating ? "Gerando..." : "Gerar Rel. Financeiro"}
                            </Button>
                            <Button onClick={() => handleGenerateReport('COMPLIANCE')} disabled={selectedItems.size === 0 || isGenerating || activeTab === 'history'}>
                                <Printer className="mr-2 h-4 w-4" />
                                {isGenerating ? "Gerando..." : "Gerar Rel. Conformidade"}
                            </Button>
                        </>
                    )}
                </div>
            </PageHeader>
            
            <Tabs defaultValue="uasg_160098" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <div className="flex items-center justify-between">
                    <TabsList>
                        <TabsTrigger value="uasg_160098">UASG 160098</TabsTrigger>
                        <TabsTrigger value="uasg_167098">UASG 167098</TabsTrigger>
                        <TabsTrigger value="history">Histórico de Relatórios</TabsTrigger>
                    </TabsList>
                    {activeTab !== 'history' && (
                        <div className="flex items-center space-x-2">
                            <Switch id="hide-reported" checked={hideReported} onCheckedChange={setHideReported} />
                            <Label htmlFor="hide-reported">Ocultar empenhos já em relatório</Label>
                        </div>
                    )}
                </div>
                
                <TabsContent value="uasg_160098">
                    <Tabs defaultValue="compliance">
                        <div className="flex justify-between items-center pb-4">
                            <TabsList>
                                <TabsTrigger value="compliance">Conformidade</TabsTrigger>
                                <TabsTrigger value="financial">Financeiro</TabsTrigger>
                            </TabsList>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="w-6 h-6 flex items-center justify-center">C</Badge>
                                    <span>Rel. Conformidade</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="w-6 h-6 flex items-center justify-center">F</Badge>
                                    <span>Rel. Financeiro</span>
                                </div>
                            </div>
                        </div>
                        <TabsContent value="compliance" className="pt-0">
                            <Card><CardContent className="pt-6"><ComplianceTable items={filteredUasg160098Compliance} selectedItems={selectedItems} setSelectedItems={setSelectedItems} type="COMPLIANCE" /></CardContent></Card>
                        </TabsContent>
                         <TabsContent value="financial" className="pt-0">
                            <Card><CardContent className="pt-6"><ComplianceTable items={filteredUasg160098Financial} selectedItems={selectedItems} setSelectedItems={setSelectedItems} type="FINANCIAL"/></CardContent></Card>
                        </TabsContent>
                    </Tabs>
                </TabsContent>

                <TabsContent value="uasg_167098">
                    <Tabs defaultValue="compliance">
                        <div className="flex justify-between items-center pb-4">
                            <TabsList>
                                <TabsTrigger value="compliance">Conformidade</TabsTrigger>
                                <TabsTrigger value="financial">Financeiro</TabsTrigger>
                            </TabsList>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="w-6 h-6 flex items-center justify-center">C</Badge>
                                    <span>Rel. Conformidade</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="w-6 h-6 flex items-center justify-center">F</Badge>
                                    <span>Rel. Financeiro</span>
                                </div>
                            </div>
                        </div>
                        <TabsContent value="compliance" className="pt-0">
                            <Card><CardContent className="pt-6"><ComplianceTable items={filteredUasg167098Compliance} selectedItems={selectedItems} setSelectedItems={setSelectedItems} type="COMPLIANCE"/></CardContent></Card>
                        </TabsContent>
                        <TabsContent value="financial" className="pt-0">
                            <Card><CardContent className="pt-6"><ComplianceTable items={filteredUasg167098Financial} selectedItems={selectedItems} setSelectedItems={setSelectedItems} type="FINANCIAL"/></CardContent></Card>
                        </TabsContent>
                    </Tabs>
                </TabsContent>

                 <TabsContent value="history">
                     <Card>
                        <CardHeader>
                            <CardTitle>Histórico de Relatórios Gerados</CardTitle>
                            <CardDescription>Consulte e reimprima os relatórios de conformidade já emitidos.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nº de Controle</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>UASG</TableHead>
                                        <TableHead>Data de Geração</TableHead>
                                        <TableHead>Gerado por</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoadingReports || isLoadingUsers ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center">Carregando relatórios...</TableCell>
                                        </TableRow>
                                    ) : filteredReports.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center">Nenhum relatório encontrado.</TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredReports.map(report => {
                                            const printPage = report.type === 'COMPLIANCE' ? 'print' : 'print-financial';
                                            const urlParams = new URLSearchParams({ reportId: report.id });
                                            if (report.commitmentNumbers) {
                                                urlParams.set('commitmentNumbers', JSON.stringify(report.commitmentNumbers));
                                            }
                                            return (
                                            <TableRow key={report.id}>
                                                <TableCell className="font-medium">{report.controlNumber}</TableCell>
                                                <TableCell>{report.type === 'COMPLIANCE' ? 'Conformidade' : 'Financeiro'}</TableCell>
                                                <TableCell>{report.uasg}</TableCell>
                                                <TableCell>{formatDate(report.generatedAt)}</TableCell>
                                                <TableCell>{usersMap.get(report.generatedBy) || report.generatedBy}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button asChild variant="outline" size="sm" onClick={() => {
                                                        const win = window.open(`/dashboard/execution/${printPage}?${urlParams.toString()}`, '_blank');
                                                        win?.focus();
                                                    }}>
                                                        <Printer className="mr-2 h-4 w-4" />
                                                        Reimprimir
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )})
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </>
    );
}
