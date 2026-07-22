
"use client";

import { PlusCircle, MoreHorizontal, Search, MessageSquare, Edit, NotebookPen, Eye, FileX2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge";
import { Protocol, ProtocolStatus, CreditNote, OM, Modality, UserProfile } from "@/lib/data";
import { PageHeader } from "@/components/dashboard/page-header";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy, limit } from "firebase/firestore";
import { ProtocolForm } from "@/components/dashboard/protocol-form";
import { ProtocolObservations } from "@/components/dashboard/protocol-observations";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CommitmentForm } from "@/components/dashboard/commitment-form";
import Link from "next/link";
import { AnnulmentForm } from "@/components/dashboard/annulment-form";
import { ReinforcementForm } from "@/components/dashboard/reinforcement-form";
import { ScrollArea } from "@/components/ui/scroll-area";


type StatusVariant = "default" | "secondary" | "destructive" | "outline";

const getStatusVariant = (status: ProtocolStatus): StatusVariant => {
    switch(status) {
        case "Deferido":
            return "default";
        case "Empenhado":
            return "default";
        case "Em Análise":
            return "secondary";
        case "Correção":
            return "outline";
        case "Restituído":
        case "Anulado":
            return "destructive";
        default:
            return "default";
    }
}

export default function ProtocolsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isReinforcementFormOpen, setIsReinforcementFormOpen] = useState(false);
  const [editingProtocol, setEditingProtocol] = useState<Protocol | null>(null);
  const [isCommitmentFormOpen, setIsCommitmentFormOpen] = useState(false);
  const [isAnnulmentFormOpen, setIsAnnulmentFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewingProtocol, setViewingProtocol] = useState<Protocol | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedOmId, setSelectedOmId] = useState("all");

  const firestore = useFirestore();

  const protocolsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "protocols"), orderBy("createdAt", "desc"), limit(50)) : null, [firestore]);
  const { data: protocols, isLoading: isLoadingProtocols } = useCollection<Protocol>(protocolsQuery);

  const creditNotesQuery = useMemoFirebase(() => firestore ? collection(firestore, "creditNotes") : null, [firestore]);
  const { data: creditNotes, isLoading: isLoadingCreditNotes } = useCollection<CreditNote>(creditNotesQuery);
  
  const omsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "militaryOrganizations"), orderBy("code")) : null, [firestore]);
  const { data: oms, isLoading: isLoadingOms } = useCollection<OM>(omsQuery);

  const modalitiesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "licitationModalities"), orderBy("order")) : null, [firestore]);
  const { data: modalities, isLoading: isLoadingModalities } = useCollection<Modality>(modalitiesQuery);

  const usersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
  const { data: usersData, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);

  
  const creditNotesMap = useMemo(() => creditNotes ? new Map(creditNotes.map(nc => [nc.id, nc])) : new Map(), [creditNotes]);
  const omsMap = useMemo(() => oms ? new Map(oms.map(om => [om.id, om])) : new Map(), [oms]);
  const modalitiesMap = useMemo(() => modalities ? new Map(modalities.map(m => [m.id, m])) : new Map(), [modalities]);
  const usersMap = useMemo(() => usersData ? new Map(usersData.map(u => [u.id, u])) : new Map(), [usersData]);
  
  const isLoading = isLoadingProtocols || isLoadingCreditNotes || isLoadingOms || isLoadingModalities || isLoadingUsers;
  const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatDate = (dateString?: string) => dateString ? new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';


  const filteredProtocols = useMemo(() => {
    if (!protocols || !modalities) return [];
    
    let baseProtocols = protocols;

    // Filter by OM
    let omIdToFilter: string | undefined = selectedOmId;
    if (omIdToFilter && omIdToFilter !== "all") {
        baseProtocols = baseProtocols.filter(p => p.omId === omIdToFilter);
    }
    
    // 1. Filter by active tab
    let tabFiltered = baseProtocols;
    if (activeTab !== "all") {
        tabFiltered = baseProtocols.filter(p => {
            const modality = modalitiesMap.get(p.modalityId);
            if (!modality) return false;
            if (activeTab === "compliance") return modality.isCompliance;
            if (activeTab === "financial") return modality.isFinancial;
            return false;
        })
    }
    
    // 2. Filter by search term
    if (!searchTerm) return tabFiltered;
    
    const search = searchTerm.toLowerCase();
    return tabFiltered.filter(p => {
        const om = omsMap.get(p.omId);
        // Search in all credit notes linked to the protocol
        const ncMatch = p.creditSources?.some(source => {
            const nc = creditNotesMap.get(source.creditNoteId);
            return nc && nc.ncNumber.toLowerCase().includes(search);
        });

        // Search in all commitments
        const commitmentMatch = p.commitments?.some(c => c.neNumber.toLowerCase().includes(search));

        return (
            (p.controlCode && p.controlCode.toLowerCase().includes(search)) ||
            (p.pReqNumber && p.pReqNumber.toLowerCase().includes(search)) ||
            (p.diexNumber && p.diexNumber.toLowerCase().includes(search)) ||
            (p.status && p.status.toLowerCase().includes(search)) ||
            (om && om.abbreviation.toLowerCase().includes(search)) ||
            ncMatch ||
            commitmentMatch
        )
    })
  }, [protocols, modalities, searchTerm, activeTab, omsMap, creditNotesMap, modalitiesMap, selectedOmId]);

  const handleEdit = (protocol: Protocol) => {
    setEditingProtocol(protocol);
    setIsFormOpen(true);
  }

  const handleOpenChange = (open: boolean) => {
    setIsFormOpen(open);
    if (!open) {
      setEditingProtocol(null); // Reset editing state when dialog closes
    }
  }

  return (
    <>
      <PageHeader
        title="Protocolos (P_Req)"
        description="Acompanhe os pedidos de aquisição desde a entrada até o empenho."
      >
        <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
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
                  <Dialog open={isReinforcementFormOpen} onOpenChange={setIsReinforcementFormOpen}>
                      <DialogTrigger asChild>
                          <Button variant="outline">
                              <TrendingUp className="mr-2 h-4 w-4" />
                              Lançar Reforço
                          </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[750px]">
                          <DialogHeader>
                              <DialogTitle>Lançar Reforço de Empenho</DialogTitle>
                              <DialogDescription>
                                  Selecione o empenho original e informe o valor e a fonte do reforço.
                              </DialogDescription>
                          </DialogHeader>
                          <ScrollArea className="max-h-[80vh] p-6">
                              <ReinforcementForm 
                                  setOpen={setIsReinforcementFormOpen}
                                  creditNotes={creditNotes || []}
                                  oms={oms || []}
                                  protocols={protocols || []}
                              />
                          </ScrollArea>
                      </DialogContent>
                  </Dialog>
              </div>
             <div className="flex items-center gap-2">
                    <Dialog open={isCommitmentFormOpen} onOpenChange={setIsCommitmentFormOpen}>
                        <DialogTrigger asChild>
                            <Button variant="default" className="bg-green-600 hover:bg-green-700">
                                <NotebookPen className="mr-2 h-4 w-4" />
                                Lançar Empenho
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[750px]">
                            <DialogHeader>
                                <DialogTitle>Lançar Nota de Empenho</DialogTitle>
                                <DialogDescription>
                                    Localize o protocolo e preencha os dados do empenho.
                                </DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="max-h-[80vh] p-6">
                                {protocols && creditNotes && oms && (
                                    <CommitmentForm 
                                        protocols={protocols}
                                        creditNotes={creditNotes}
                                        oms={oms}
                                        setOpen={setIsCommitmentFormOpen}
                                    />
                                )}
                            </ScrollArea>
                        </DialogContent>
                    </Dialog>
                    <Dialog open={isFormOpen} onOpenChange={handleOpenChange}>
                    <DialogTrigger asChild>
                        <Button>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Novo Protocolo
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[750px]">
                        <DialogHeader>
                        <DialogTitle>{editingProtocol ? `Editar Protocolo ${editingProtocol.controlCode}` : 'Novo Protocolo de Aquisição'}</DialogTitle>
                        <DialogDescription>
                            {editingProtocol ? 'Altere os dados do protocolo abaixo.' : 'Preencha os dados para registrar um novo pedido de aquisição.'}
                        </DialogDescription>
                        </DialogHeader>
                        <ScrollArea className="max-h-[80vh] p-6">
                            <ProtocolForm 
                            setOpen={handleOpenChange} 
                            creditNotes={creditNotes || []}
                            oms={oms || []}
                            modalities={modalities || []}
                            protocols={protocols || []}
                            protocol={editingProtocol}
                            />
                        </ScrollArea>
                    </DialogContent>
                    </Dialog>
            </div>
        </div>
      </PageHeader>
        
        <div className="flex items-center gap-2 mb-4">
            <Select onValueChange={setSelectedOmId} value={selectedOmId}>
                <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Filtrar por OM" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todas as OMs</SelectItem>
                    {oms?.map(om => (
                        <SelectItem key={om.id} value={om.id}>{om.abbreviation}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                type="search" 
                placeholder="Pesquisar protocolos..." 
                className="pl-8 sm:w-[300px]" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="compliance">Conformidade</TabsTrigger>
                <TabsTrigger value="financial">Financeiro</TabsTrigger>
            </TabsList>
            <Card>
                <CardContent className="pt-6">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Cód. Controle / Data</TableHead>
                        <TableHead>OM</TableHead>
                        <TableHead>Tipo / Modalidade</TableHead>
                        {activeTab === 'financial' ? (
                            <>
                                <TableHead>Mapa SIPEO</TableHead>
                                <TableHead>Nome do Beneficiário</TableHead>
                            </>
                        ) : (
                            <>
                                <TableHead>DIEx / P_Req</TableHead>
                                <TableHead>Nº Pregão</TableHead>
                            </>
                        )}
                        <TableHead>NC Vinculada</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Nº Empenho</TableHead>
                        <TableHead>Data Empenho</TableHead>
                        <TableHead>Situação</TableHead>
                        <TableHead className="text-right">
                        Ações
                        </TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {isLoading ? (
                        <TableRow>
                            <TableCell colSpan={11} className="h-24 text-center">
                            Carregando protocolos...
                            </TableCell>
                        </TableRow>
                    ) : filteredProtocols.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={11} className="h-24 text-center">
                            {searchTerm ? "Nenhum resultado encontrado." : "Nenhum protocolo encontrado."}
                            </TableCell>
                        </TableRow>
                    ) : (
                        filteredProtocols.map((item) => {
                        const om = omsMap.get(item.omId);
                        const modality = modalitiesMap.get(item.modalityId);
                        const messageCount = item.observations?.length || 0;
                        const hasMultipleSources = item.creditSources.length > 1;

                        return (
                            <TableRow key={item.id}>
                                <TableCell>
                                    <div className="font-medium">{item.controlCode}</div>
                                    <div className="text-sm text-muted-foreground">{formatDate(item.entryDate)}</div>
                                </TableCell>
                                <TableCell>{om?.abbreviation || 'N/A'}</TableCell>
                                <TableCell>
                                    <div className="font-medium">{item.type}</div>
                                    <div className="text-sm text-muted-foreground">{modality?.name || 'N/A'}</div>
                                </TableCell>
                                {activeTab === 'financial' ? (
                                    <>
                                        <TableCell>{item.sipeoMapNumber || '—'}</TableCell>
                                        <TableCell>{item.beneficiaryName || '—'}</TableCell>
                                    </>
                                ) : (
                                    <>
                                        <TableCell>
                                            <div className="font-medium">{item.diexNumber || '—'}</div>
                                            <div className="text-sm text-muted-foreground">{item.pReqNumber || '—'}</div>
                                        </TableCell>
                                        <TableCell>{item.pregaoNumber || '—'}</TableCell>
                                    </>
                                )}
                                <TableCell>
                                    {hasMultipleSources ? (
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className="font-medium underline decoration-dashed cursor-help">{item.creditSources.length} selecionadas</span>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <div className="flex flex-col gap-1">
                                                        {item.creditSources.map(source => {
                                                            const nc = creditNotesMap.get(source.creditNoteId);
                                                            return <span key={nc?.id}>{nc?.ncNumber}</span>
                                                        })}
                                                    </div>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    ) : (
                                        <>
                                            <div className="font-medium">{creditNotesMap.get(item.creditSources[0]?.creditNoteId)?.ncNumber || 'N/A'}</div>
                                            <div className="text-sm text-muted-foreground">{creditNotesMap.get(item.creditSources[0]?.creditNoteId)?.uasg || '—'}</div>
                                        </>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span className={cn(hasMultipleSources && "underline decoration-dashed cursor-help")}>{formatCurrency(item.value)}</span>
                                            </TooltipTrigger>
                                            {hasMultipleSources && (
                                                <TooltipContent>
                                                    <div className="flex flex-col gap-1 text-xs">
                                                         {item.creditSources.map(source => {
                                                            const nc = creditNotesMap.get(source.creditNoteId);
                                                            return <div key={nc?.id} className="flex justify-between gap-2"><span>{nc?.ncNumber}:</span> <span className="font-semibold">{formatCurrency(source.value)}</span></div>
                                                        })}
                                                    </div>
                                                </TooltipContent>
                                            )}
                                        </Tooltip>
                                    </TooltipProvider>
                                </TableCell>
                                <TableCell>
                                    {item.commitments && item.commitments.length > 0 ? (
                                        item.commitments.length === 1 ? (
                                            <div className="font-medium">{item.commitments[0].neNumber}</div>
                                        ) : (
                                             <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="font-medium underline decoration-dashed cursor-help">{item.commitments.length} empenhos</span>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <div className="flex flex-col gap-1 text-xs">
                                                            {item.commitments.map(c => (
                                                                <div key={c.neNumber} className="flex justify-between gap-2">
                                                                    <span>{c.neNumber}:</span> <span className="font-semibold">{formatCurrency(c.value)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )
                                    ) : (
                                        '—'
                                    )}
                                </TableCell>
                                <TableCell>{item.commitments && item.commitments.length > 0 ? formatDate(item.commitments[0].neDate) : '—'}</TableCell>
                                <TableCell>
                                    <Badge 
                                        variant={getStatusVariant(item.status)}
                                        className={cn(
                                            (item.status === 'Empenhado' || item.status === 'Deferido') && 'bg-green-600 hover:bg-green-700 text-white',
                                            item.status === 'Correção' && 'bg-yellow-500 hover:bg-yellow-600 text-black',
                                            (item.status === 'Restituído' || item.status === 'Anulado') && 'bg-red-600',
                                        )}
                                    >
                                        {item.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                <TooltipProvider>
                                    <div className="flex items-center justify-end gap-1">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button asChild variant="ghost" size="icon">
                                            <Link href={`/dashboard/protocols/${item.id}`}>
                                                <Eye className="h-4 w-4" />
                                                <span className="sr-only">Ver Dossiê</span>
                                            </Link>
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                        <p>Ver Dossiê</p>
                                        </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                        <div className="relative">
                                            <Button variant="ghost" size="icon" onClick={() => setViewingProtocol(item)}>
                                            <MessageSquare className="h-4 w-4" />
                                            <span className="sr-only">Mensagens</span>
                                            </Button>
                                            {messageCount > 0 && (
                                            <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
                                                {messageCount}
                                            </span>
                                            )}
                                        </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                        <p>Mensagens ({messageCount})</p>
                                        </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                            <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                                                <Edit className="h-4 w-4" />
                                                <span className="sr-only">Editar</span>
                                            </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                            <p>Editar</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                </TooltipProvider>
                                </TableCell>
                            </TableRow>
                        )
                        })
                    )}
                    </TableBody>
                </Table>
                </CardContent>
            </Card>
        </Tabs>

      {/* Observations Dialog */}
      <Dialog open={!!viewingProtocol} onOpenChange={(isOpen) => !isOpen && setViewingProtocol(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Observações do Protocolo {viewingProtocol?.controlCode}</DialogTitle>
            <DialogDescription>
              Visualize o histórico de mensagens e adicione novas observações.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[80vh] p-6">
            {viewingProtocol && (
                <ProtocolObservations 
                protocol={viewingProtocol} 
                usersMap={usersMap}
                onObservationAdded={() => setViewingProtocol(null)}
                />
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
