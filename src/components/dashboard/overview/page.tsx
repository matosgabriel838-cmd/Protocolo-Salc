
"use client"

import { useState, useMemo } from "react";
import {
  Activity,
  DollarSign,
  Landmark,
  Percent,
} from "lucide-react"
import { collection, query, orderBy, where, limit } from "firebase/firestore"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PageHeader } from "@/components/dashboard/page-header"
import { CreditNote, OM, Protocol } from "@/lib/data"
import { Badge } from "@/components/ui/badge"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"


export default function DashboardOverview() {
  const firestore = useFirestore();
  const [selectedOmId, setSelectedOmId] = useState("all");

  // Firestore Queries
  const omsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "militaryOrganizations"), orderBy("code")) : null, [firestore]);
  const creditNotesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "creditNotes")) : null, [firestore]);
  const protocolsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "protocols"), orderBy("createdAt", "desc")) : null, [firestore]);

  // Data Hooks
  const { data: oms, isLoading: isLoadingOms } = useCollection<OM>(omsQuery);
  const { data: allCreditNotes, isLoading: isLoadingCreditNotes } = useCollection<CreditNote>(creditNotesQuery);
  const { data: allProtocols, isLoading: isLoadingProtocols } = useCollection<Protocol>(protocolsQuery);

  const isLoading = isLoadingOms || isLoadingCreditNotes || isLoadingProtocols;
  
  const handleOmChange = (value: string) => {
    setSelectedOmId(value);
  }

  const { protocols, creditNotes } = useMemo(() => {
    let filteredProtocols = allProtocols || [];
    let filteredCreditNotes = allCreditNotes || [];
    
    let omIdToFilter: string | undefined = selectedOmId;

    if (omIdToFilter && omIdToFilter !== "all") {
      filteredProtocols = filteredProtocols.filter(p => p.omId === omIdToFilter);
      // Filter credit notes based on shares to the selected OM
      filteredCreditNotes = filteredCreditNotes.filter(cn => cn.shares?.some(s => s.omId === omIdToFilter));
    }
    
    return { protocols: filteredProtocols, creditNotes: filteredCreditNotes };
  }, [allProtocols, allCreditNotes, selectedOmId]);

  // Memoized Data Processing
  const omsMap = useMemo(() => oms ? new Map(oms.map(om => [om.id, om])) : new Map(), [oms]);
  
  const pageTitle = useMemo(() => {
    if (selectedOmId !== "all" && omsMap.has(selectedOmId)) {
        return `Visão Geral - ${omsMap.get(selectedOmId)?.name}`;
    }
    return "Visão Geral Consolidada";
  }, [selectedOmId, omsMap]);

  const totalCreditReceived = useMemo(() => {
    if (!creditNotes) return 0;
    // When a specific OM is selected, sum only the shares for that OM
    if (selectedOmId !== 'all') {
      return allCreditNotes?.reduce((sum, note) => {
        const omShare = note.shares?.find(s => s.omId === selectedOmId)?.value || 0;
        return sum + omShare;
      }, 0) || 0;
    }
    // Otherwise, sum the total value of all notes
    return creditNotes.reduce((sum, note) => sum + note.totalValue, 0);
  }, [creditNotes, allCreditNotes, selectedOmId]);

  const totalCreditCommitted = useMemo(() => {
    if (!protocols) return 0;
    // Sum the value of all protocols that are not 'Restituído' or 'Anulado'
    return protocols
      .filter(p => p.status !== 'Restituído' && p.status !== 'Anulado')
      .reduce((sum, p) => sum + p.value, 0);
  }, [protocols]);
  
  const committedPercentage = useMemo(() => {
      if (totalCreditReceived === 0) return 0;
      return (totalCreditCommitted / totalCreditReceived) * 100;
  }, [totalCreditReceived, totalCreditCommitted]);

  const pendingProtocolsCount = useMemo(() => {
    if (!protocols) return 0;
    return protocols.filter(p => p.status === 'Em Análise' || p.status === 'Correção').length;
  }, [protocols]);

  const correctionProtocols = useMemo(() => {
    if (!protocols) return [];
    return protocols.filter(p => p.status === "Correção").slice(0, 10);
  }, [protocols]);

  const recentProtocols = useMemo(() => {
      if (!protocols) return [];
      return protocols.filter(p => p.status === "Em Análise").slice(0,5);
  }, [protocols]);
  
  const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatDate = (dateString?: string) => dateString ? new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';


  return (
    <>
      <PageHeader
        title={pageTitle}
        description="Um resumo das atividades recentes e status do sistema."
      >
        <Select onValueChange={handleOmChange} value={selectedOmId}>
            <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Filtrar por OM" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Todas as OMs</SelectItem>
                {oms?.map(om => (
                    <SelectItem key={om.id} value={om.id}>{om.abbreviation}</SelectItem>
                ))}
            </SelectContent>
        </Select>
      </PageHeader>
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Crédito {selectedOmId !== 'all' ? 'Partilhado' : 'Recebido'}
            </CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {isLoading ? (
                <Skeleton className="h-8 w-3/4" />
            ) : (
                <div className="text-2xl font-bold">{formatCurrency(totalCreditReceived)}</div>
            )}
            <p className="text-xs text-muted-foreground">
              {selectedOmId !== 'all' ? 'Soma das partilhas para a OM selecionada' : 'Soma de todas as NCs recebidas'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Crédito Empenhado
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {isLoading ? (
                <Skeleton className="h-8 w-1/4" />
            ) : (
                <div className="text-2xl font-bold">{formatCurrency(totalCreditCommitted)}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Valor utilizado em P_Reqs válidas
            </p>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">% Empenhada</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
                 <Skeleton className="h-8 w-1/4" />
            ) : (
                <div className="text-2xl font-bold">{committedPercentage.toFixed(2)}%</div>
            )}
            <p className="text-xs text-muted-foreground">
              Relação empenhado vs. recebido/partilhado
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Requisitórias Pendentes</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {isLoading ? (
                <Skeleton className="h-8 w-1/4" />
            ) : (
                <div className="text-2xl font-bold">+{pendingProtocolsCount}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Protocolos aguardando análise ou correção
            </p>
          </CardContent>
        </Card>
      </div>

       <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Requisitórias Pendentes de Correção</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cód. Controle / Data</TableHead>
                  <TableHead>OM</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                    <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                        Carregando protocolos...
                        </TableCell>
                    </TableRow>
                ) : correctionProtocols.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      Nenhum protocolo aguardando correção.
                    </TableCell>
                  </TableRow>
                ) : (
                    correctionProtocols.map(p => {
                        const om = omsMap.get(p.omId);
                        return (
                        <TableRow key={p.id}>
                            <TableCell>
                                <Link href={`/dashboard/protocols/${p.id}`} className="font-medium text-primary hover:underline">{p.controlCode}</Link>
                                <div className="text-sm text-muted-foreground">
                                    {formatDate(p.createdAt)}
                                </div>
                            </TableCell>
                             <TableCell>
                                <div className="font-medium">{om?.abbreviation || 'N/A'}</div>
                            </TableCell>
                            <TableCell>
                                <Badge className="text-xs" variant="outline">
                                    {p.status}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                {formatCurrency(p.value)}
                            </TableCell>
                      </TableRow>
                    )})
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Protocolos Recentes (Em Análise)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cód. Controle / Data</TableHead>
                  <TableHead>OM</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                    <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                        Carregando protocolos...
                        </TableCell>
                    </TableRow>
                ) : recentProtocols.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      Nenhum protocolo em análise encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                    recentProtocols.map(p => {
                        const om = omsMap.get(p.omId);
                        return (
                        <TableRow key={p.id}>
                            <TableCell>
                                <Link href={`/dashboard/protocols/${p.id}`} className="font-medium text-primary hover:underline">{p.controlCode}</Link>
                                <div className="text-sm text-muted-foreground">
                                    {formatDate(p.createdAt)}
                                </div>
                            </TableCell>
                             <TableCell>
                                <div className="font-medium">{om?.abbreviation || 'N/A'}</div>
                            </TableCell>
                            <TableCell>
                                <Badge className="text-xs" variant="secondary">
                                    {p.status}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                {formatCurrency(p.value)}
                            </TableCell>
                      </TableRow>
                    )})
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
