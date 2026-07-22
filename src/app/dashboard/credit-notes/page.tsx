
"use client"

import { useState, useMemo, useEffect } from "react";
import { PlusCircle, Printer, Edit, Share2, Copy, Search, Trash2, MinusCircle, Upload, AlertTriangle, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
    Collapsible,
    CollapsibleContent,
} from "@/components/ui/collapsible";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge";
import { CreditNote, OM, UserProfile, AppSettings } from "@/lib/data";
import { PageHeader } from "@/components/dashboard/page-header";
import { differenceInDays, parseISO, isValid } from 'date-fns';
import { CreditNoteForm } from "@/components/dashboard/credit-note-form";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useCollection, useFirestore, useMemoFirebase, deleteDocumentNonBlocking, useDoc, useUser } from "@/firebase";
import { collection, doc, orderBy, query, limit, getCountFromServer } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { CreditShareForm } from "@/components/dashboard/credit-share-form";
import { CreditRecollectionForm } from "@/components/dashboard/credit-recollection-form";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CreditNoteImporter } from "@/components/dashboard/credit-note-importer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { CreditBulkShareForm } from "@/components/dashboard/credit-bulk-share-form";

const ITEMS_PER_PAGE = 50;

function DateBadge({ dateString, settings }: { dateString: string, settings: AppSettings | null }) {
  const date = dateString ? parseISO(dateString) : null;
  
  if (!date || !isValid(date)) {
    return <Badge variant="outline" className="bg-yellow-400 text-black hover:bg-yellow-500">Sem data</Badge>;
  }

  const criticalDays = settings?.ncAlertDays?.critical || 7;
  const warningDays = settings?.ncAlertDays?.warning || 30;

  const daysUntilLimit = differenceInDays(date, new Date());
  let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
  let className = "";

  if (daysUntilLimit <= criticalDays) {
    variant = "destructive";
  } else if (daysUntilLimit <= warningDays) {
    className = "bg-orange-400 text-white hover:bg-orange-500";
  }

  const formattedDate = new Date(dateString).toLocaleDateString('pt-BR', {timeZone: 'UTC'});

  return <Badge variant={variant} className={className}>{formattedDate}</Badge>;
}

export default function CreditNotesPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isShareFormOpen, setIsShareFormOpen] = useState(false);
  const [isRecollectionFormOpen, setIsRecollectionFormOpen] = useState(false);
  const [isBulkShareOpen, setIsBulkShareOpen] = useState(false);
  const [isBulkDeleteAlertOpen, setIsBulkDeleteAlertOpen] = useState(false);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<Partial<CreditNote> | null>(null);
  const [noteToShare, setNoteToShare] = useState<CreditNote | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<CreditNote | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [hideZeroBalance, setHideZeroBalance] = useState(true);
  const [showOnlyWithoutShares, setShowOnlyWithoutShares] = useState(false);
  const [totalNotesCount, setTotalNotesCount] = useState<number | null>(null);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  
  const firestore = useFirestore();
  const { toast } = useToast();
  const { userProfile } = useUser();
  const isAdmin = userProfile?.role === 'ADMIN';

  const creditNotesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "creditNotes"), orderBy("emissionDate", "desc"), limit(500));
  }, [firestore]);
  const { data: creditNotes, isLoading } = useCollection<CreditNote>(creditNotesQuery);

  useEffect(() => {
    async function fetchCount() {
      if (firestore) {
        const coll = collection(firestore, "creditNotes");
        const snapshot = await getCountFromServer(coll);
        setTotalNotesCount(snapshot.data().count);
      }
    }
    fetchCount();
  }, [firestore]);

  const omsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'militaryOrganizations') : null, [firestore]);
  const { data: oms, isLoading: isLoadingOms } = useCollection<OM>(omsQuery);

  const usersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
  const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);
  
  const settingsDocRef = useMemoFirebase(() => firestore ? doc(firestore, 'settings', 'global') : null, [firestore]);
  const { data: appSettings, isLoading: isLoadingSettings } = useDoc<AppSettings>(settingsDocRef);

  const omsMap = useMemo(() => oms ? new Map(oms.map(om => [om.id, om])) : new Map(), [oms]);
  const usersMap = useMemo(() => users ? new Map(users.map(u => [u.id, u])) : new Map(), [users]);

  // Reset page on filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, hideZeroBalance, showOnlyWithoutShares]);

  const handleDuplicate = (e: React.MouseEvent, note: CreditNote) => {
    e.stopPropagation();
    const duplicatedData = { ...note };
    delete (duplicatedData as any).id;
    delete (duplicatedData as any).createdAt;
    delete (duplicatedData as any).balance;
    setSelectedNote(duplicatedData);
    setIsFormOpen(true);
  }
  
  const handleAddNew = () => {
    setSelectedNote(null);
    setIsFormOpen(true);
  }

  const handleEdit = (e: React.MouseEvent, note: CreditNote) => {
    e.stopPropagation();
    setSelectedNote(note);
    setIsFormOpen(true);
  }
  
  const handleShare = (e: React.MouseEvent, note: CreditNote) => {
    e.stopPropagation();
    setNoteToShare(note);
    setIsShareFormOpen(true);
  }

  const handleDelete = (e: React.MouseEvent, note: CreditNote) => {
    e.stopPropagation();
    setNoteToDelete(note);
  }

  const handleDeleteConfirm = () => {
    if (!noteToDelete || !firestore) return;
    const docRef = doc(firestore, "creditNotes", noteToDelete.id);
    deleteDocumentNonBlocking(docRef);
    toast({
      title: "Sucesso!",
      description: `A Nota de Crédito "${noteToDelete.ncNumber}" foi excluída.`,
    });
    setNoteToDelete(null);
  }

  const handleBulkDeleteConfirm = () => {
    if (!firestore || selectedNoteIds.size === 0) return;
    
    selectedNoteIds.forEach(id => {
      const docRef = doc(firestore, "creditNotes", id);
      deleteDocumentNonBlocking(docRef);
    });

    toast({
      title: "Sucesso!",
      description: `${selectedNoteIds.size} Notas de Crédito foram excluídas.`,
    });
    
    setSelectedNoteIds(new Set());
    setIsBulkDeleteAlertOpen(false);
  }
  
  const handleRowClick = (noteId: string) => {
    setOpenNoteId(prev => (prev === noteId ? null : noteId));
  }

  const filteredNotes = useMemo(() => {
    if (!creditNotes) return [];
    
    let notes = [...creditNotes];

    if (hideZeroBalance) {
      notes = notes.filter(note => note.balance > 0);
    }
    
    if (showOnlyWithoutShares) {
        notes = notes.filter(note => !note.shares || note.shares.length === 0);
    }

    if (!searchTerm) {
      return notes;
    }

    const search = searchTerm.toLowerCase();
    return notes.filter(note => 
        note.ncNumber.toLowerCase().includes(search) ||
        note.uasg.toLowerCase().includes(search) ||
        (note.nd && note.nd.toLowerCase().includes(search)) ||
        (note.pi && note.pi.toLowerCase().includes(search))
    );
  }, [creditNotes, searchTerm, hideZeroBalance, showOnlyWithoutShares]);

  const paginatedNotes = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredNotes.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredNotes, currentPage]);

  const totalPages = Math.ceil(filteredNotes.length / ITEMS_PER_PAGE);

  const selectedNotesForBulkShare = useMemo(() => {
      return (creditNotes || []).filter(note => selectedNoteIds.has(note.id));
  }, [creditNotes, selectedNoteIds]);
  
  const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatDate = (dateString?: string) => dateString ? new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';

  const handleSelectAll = (checked: boolean | "indeterminate") => {
    const currentIds = paginatedNotes.map(n => n.id);
    if (checked) {
        setSelectedNoteIds(prev => new Set([...prev, ...currentIds]));
    } else {
        setSelectedNoteIds(prev => {
            const newSet = new Set(prev);
            currentIds.forEach(id => newSet.delete(id));
            return newSet;
        });
    }
  }

  const handleSelectRow = (id: string, checked: boolean) => {
      setSelectedNoteIds(prev => {
          const newSet = new Set(prev);
          if (checked) {
              newSet.add(id);
          } else {
              newSet.delete(id);
          }
          return newSet;
      });
  }

  const isAllPaginatedSelected = paginatedNotes.length > 0 && paginatedNotes.every(p => selectedNoteIds.has(p.id));
  const isSomePaginatedSelected = paginatedNotes.some(p => selectedNoteIds.has(p.id));

  return (
    <>
      <PageHeader
        title="Notas de Crédito"
        description="Gerencie e distribua os saldos das Notas de Crédito (NC)."
      >
        <div className="flex items-center gap-2 flex-wrap justify-end">
             <div className="flex items-center space-x-2">
              <Switch id="show-no-shares" checked={showOnlyWithoutShares} onCheckedChange={setShowOnlyWithoutShares} />
              <Label htmlFor="show-no-shares">Sem Partilha</Label>
            </div>
             <div className="flex items-center space-x-2">
              <Switch id="hide-zero-balance" checked={hideZeroBalance} onCheckedChange={setHideZeroBalance} />
              <Label htmlFor="hide-zero-balance">Ocultar Saldo Zero</Label>
            </div>
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    type="search" 
                    placeholder="Pesquisar NCs..." 
                    className="pl-8 sm:w-[250px]" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            {isAdmin && (
                <>
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="destructive" 
                            disabled={selectedNoteIds.size === 0}
                            onClick={() => setIsBulkDeleteAlertOpen(true)}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir Selecionadas ({selectedNoteIds.size})
                        </Button>
                        <Dialog open={isBulkShareOpen} onOpenChange={setIsBulkShareOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" disabled={selectedNoteIds.size === 0}>
                                    <Share2 className="mr-2 h-4 w-4" />
                                    Partilhar Selecionadas ({selectedNoteIds.size})
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[700px]">
                                <DialogHeader>
                                    <DialogTitle>Partilha de Crédito em Lote</DialogTitle>
                                    <DialogDescription>
                                        Aloque o valor total das NCs selecionadas para uma única OM.
                                    </DialogDescription>
                                </DialogHeader>
                                <ScrollArea className="max-h-[80vh] p-6">
                                    <CreditBulkShareForm
                                        creditNotes={selectedNotesForBulkShare}
                                        oms={oms || []}
                                        setOpen={setIsBulkShareOpen}
                                    />
                                </ScrollArea>
                            </DialogContent>
                        </Dialog>
                    </div>
                    <div className="flex items-center gap-2">
                        <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline">
                                    <Upload className="mr-2 h-4 w-4" />
                                    Importar
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[700px]">
                                <DialogHeader>
                                    <DialogTitle>Importar Notas de Crédito</DialogTitle>
                                    <DialogDescription>
                                        Selecione um arquivo CSV ou Excel para adicionar múltiplas NCs.
                                    </DialogDescription>
                                </DialogHeader>
                                <ScrollArea className="max-h-[80vh] p-6">
                                    <CreditNoteImporter setOpen={setIsImportModalOpen} existingNotes={creditNotes || []} />
                                </ScrollArea>
                            </DialogContent>
                        </Dialog>
                        <Dialog open={isRecollectionFormOpen} onOpenChange={setIsRecollectionFormOpen}>
                          <DialogTrigger asChild>
                            <Button variant="outline">
                              <MinusCircle className="mr-2 h-4 w-4" />
                              Recolher
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[700px]">
                            <DialogHeader>
                                <DialogTitle>Registrar Recolhimento de Crédito</DialogTitle>
                                <DialogDescription>
                                    Selecione a NC e informe o valor que foi recolhido.
                                </DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="max-h-[80vh] p-6">
                                {creditNotes && <CreditRecollectionForm creditNotes={creditNotes} setOpen={setIsRecollectionFormOpen} />}
                            </ScrollArea>
                          </DialogContent>
                        </Dialog>

                        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                            <DialogTrigger asChild>
                                <Button onClick={handleAddNew}>
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Incluir NC
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[800px]">
                                <DialogHeader>
                                    <DialogTitle>{selectedNote?.id ? 'Editar' : selectedNote ? 'Duplicar' : 'Incluir Nova'} Nota de Crédito</DialogTitle>
                                    <DialogDescription>
                                    {selectedNote?.id ? 'Altere as informações abaixo.' : 'Preencha as informações abaixo para adicionar uma nova NC ao sistema.'}
                                    </DialogDescription>
                                </DialogHeader>
                                <ScrollArea className="max-h-[80vh] p-6">
                                    <CreditNoteForm 
                                        setOpen={setIsFormOpen} 
                                        existingNotes={creditNotes || []}
                                        initialData={selectedNote}
                                    />
                                </ScrollArea>
                            </DialogContent>
                        </Dialog>
                    </div>
                </>
            )}
        </div>
      </PageHeader>
      <Card>
        <CardHeader>
            <CardTitle>
                {totalNotesCount !== null && (
                    <p className="text-sm text-muted-foreground">
                        Exibindo {Math.min(filteredNotes.length, (currentPage-1)*ITEMS_PER_PAGE + 1)}-{Math.min(filteredNotes.length, currentPage*ITEMS_PER_PAGE)} de {filteredNotes.length} notas de crédito.
                    </p>
                )}
            </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                    <Checkbox
                        checked={isAllPaginatedSelected ? true : (isSomePaginatedSelected ? "indeterminate" : false)}
                        onCheckedChange={handleSelectAll}
                    />
                </TableHead>
                <TableHead>Nº da NC / Emissão</TableHead>
                <TableHead>UASG</TableHead>
                <TableHead>ND</TableHead>
                <TableHead>PI</TableHead>
                <TableHead>Valor Total</TableHead>
                <TableHead>Saldo Disponível</TableHead>
                <TableHead>Data Limite</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading || isLoadingOms || isLoadingUsers || isLoadingSettings ? (
                 <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
                      Carregando...
                    </TableCell>
                  </TableRow>
              ) : (!paginatedNotes || paginatedNotes.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    {searchTerm ? "Nenhum resultado encontrado." : "Nenhuma nota de crédito encontrada."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedNotes?.map((note) => {
                    const hasNoShares = !note.shares || note.shares.length === 0;
                    return(
                  <Collapsible asChild key={note.id} open={openNoteId === note.id} onOpenChange={() => handleRowClick(note.id)}>
                      <TableRow className="cursor-pointer data-[state=open]:bg-muted/50" data-state={selectedNoteIds.has(note.id) && "selected"}>
                          <TableCell>
                            <Checkbox
                                checked={selectedNoteIds.has(note.id)}
                                onCheckedChange={(checked) => handleSelectRow(note.id, !!checked)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                                <Link href={`/dashboard/credit-notes/${note.id}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                                    {note.ncNumber}
                                </Link>
                                {hasNoShares && (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger>
                                                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Esta NC ainda não teve seu crédito partilhado.</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )}
                            </div>
                            <div className="text-sm text-muted-foreground">{formatDate(note.emissionDate)}</div>
                          </TableCell>
                          <TableCell>{note.uasg}</TableCell>
                          <TableCell>{note.nd}</TableCell>
                          <TableCell>{note.pi}</TableCell>
                          <TableCell>
                          {formatCurrency(note.totalValue)}
                          </TableCell>
                          <TableCell>
                          {formatCurrency(note.balance)}
                          </TableCell>
                          <TableCell>
                          <DateBadge dateString={note.limitDate} settings={appSettings} />
                          </TableCell>
                          <TableCell className="text-right">
                          {isAdmin ? (
                              <TooltipProvider>
                                  <div className="flex justify-end items-center gap-1">
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" onClick={(e) => handleDuplicate(e, note)}>
                                                    <Copy className="h-4 w-4" />
                                                    <span className="sr-only">Duplicar</span>
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Duplicar</TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" onClick={(e) => handleEdit(e, note)}>
                                                    <Edit className="h-4 w-4" />
                                                    <span className="sr-only">Editar</span>
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Editar</TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" onClick={(e) => handleShare(e, note)}>
                                                    <Share2 className="h-4 w-4" />
                                                    <span className="sr-only">Partilhar Crédito</span>
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Partilhar Crédito</TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" onClick={(e) => handleDelete(e, note)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                    <span className="sr-only">Excluir</span>
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Excluir</TooltipContent>
                                        </Tooltip>
                                  </div>
                              </TooltipProvider>
                          ) : (
                               <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button asChild variant="ghost" size="icon">
                                                <Link href={`/dashboard/credit-notes/${note.id}`} onClick={(e) => e.stopPropagation()}>
                                                    <Eye className="h-4 w-4" />
                                                    <span className="sr-only">Ver Dossiê</span>
                                                </Link>
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Ver Dossiê</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                          )}
                          </TableCell>
                          <CollapsibleContent asChild>
                              <tr className="bg-muted/50">
                                <td colSpan={9} className="p-0">
                                  <div className="p-4">
                                      <h4 className="font-semibold mb-2">Histórico de Partilhas</h4>
                                      {note.shares && note.shares.length > 0 ? (
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
                                                  {note.shares.map((share, index) => {
                                                      const om = omsMap.get(share.omId);
                                                      const user = usersMap.get(share.sharedBy);
                                                      return (
                                                          <TableRow key={index}>
                                                              <TableCell>{om ? `${om.code} - ${om.abbreviation}` : 'OM não encontrada'}</TableCell>
                                                              <TableCell>{formatDate(share.sharedAt)}</TableCell>
                                                              <TableCell>{user ? `${user.rank} ${user.warName}` : 'Desconhecido'}</TableCell>
                                                              <TableCell className="text-right">{formatCurrency(share.value)}</TableCell>
                                                          </TableRow>
                                                      )
                                                  })}
                                              </TableBody>
                                          </Table>
                                      ) : (
                                          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma partilha realizada para esta NC.</p>
                                      )}
                                  </div>
                                </td>
                              </tr>
                          </CollapsibleContent>
                      </TableRow>
                  </Collapsible>
                )})
              )}
            </TableBody>
          </Table>
          
          {/* Pagination Controls */}
          {filteredNotes.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between py-4 border-t">
                <div className="text-sm text-muted-foreground">
                    Mostrando {Math.min(filteredNotes.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)} a {Math.min(filteredNotes.length, currentPage * ITEMS_PER_PAGE)} de {filteredNotes.length} notas
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Anterior
                    </Button>
                    <div className="text-sm font-medium">
                        Página {currentPage} de {totalPages || 1}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages || totalPages === 0}
                    >
                        Próxima
                        <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                </div>
            </div>
          )}
        </CardContent>
      </Card>

        {/* Share Credit Dialog */}
        <Dialog open={isShareFormOpen} onOpenChange={setIsShareFormOpen}>
            <DialogContent className="sm:max-w-[700px]">
                <DialogHeader>
                    <DialogTitle>Partilhar Crédito da NC {noteToShare?.ncNumber}</DialogTitle>
                    <DialogDescription>
                        Distribua o saldo disponível entre as Organizações Militares.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[80vh] p-6">
                    {noteToShare && (
                        <CreditShareForm 
                            creditNote={noteToShare}
                            setOpen={setIsShareFormOpen}
                        />
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>

        {/* Individual Delete Confirmation Dialog */}
        <AlertDialog open={!!noteToDelete} onOpenChange={(isOpen) => !isOpen && setNoteToDelete(null)}>
            <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                <AlertDialogDescription>
                Esta ação não pode ser desfeita. Isso excluirá permanentemente a nota de crédito 
                <span className="font-bold"> "{noteToDelete?.ncNumber}"</span>.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteConfirm}>Confirmar Exclusão</AlertDialogAction>
            </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Delete Confirmation Dialog */}
        <AlertDialog open={isBulkDeleteAlertOpen} onOpenChange={setIsBulkDeleteAlertOpen}>
            <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Excluir em Lote?</AlertDialogTitle>
                <AlertDialogDescription>
                Você está prestes a excluir <span className="font-bold">{selectedNoteIds.size}</span> Notas de Crédito selecionadas. Esta ação é irreversível.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleBulkDeleteConfirm} className="bg-destructive hover:bg-destructive/90">Confirmar Exclusão em Lote</AlertDialogAction>
            </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
