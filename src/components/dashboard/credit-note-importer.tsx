
"use client";

import { useState, useRef } from "react";
import Papa from "papaparse";
import { v4 as uuidv4 } from "uuid";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { CreditNote } from "@/lib/data";
import { useFirestore } from "@/firebase";
import { collection, writeBatch, doc } from "firebase/firestore";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { ScrollArea } from "../ui/scroll-area";
import { UploadCloud, File, AlertTriangle } from "lucide-react";

const REQUIRED_HEADERS = ["UG FAVORECIDA", "NÚMERO NC", "DATA EMISSÃO", "UGR DESTINO", "OBS", "ESFERA DESTINO", "PTRES DESTINO", "FONTE DESTINO", "PI DESTINO", "ND DESTINO", "VALOR NC"];

const headerMapping: { [key: string]: string } = {
    "UG FAVORECIDA": "uasg",
    "NÚMERO NC": "ncNumber",
    "DATA EMISSÃO": "emissionDate",
    "DATA LIMITE": "limitDate",
    "UGR DESTINO": "ugr",
    "OBS": "observation",
    "ESFERA DESTINO": "esf",
    "PTRES DESTINO": "ptres",
    "FONTE DESTINO": "fonte",
    "PI DESTINO": "pi",
    "ND DESTINO": "nd",
    "VALOR NC": "totalValue",
};

interface CreditNoteImporterProps {
  setOpen: (open: boolean) => void;
  existingNotes: CreditNote[];
}

export function CreditNoteImporter({ setOpen, existingNotes }: CreditNoteImporterProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [newNotes, setNewNotes] = useState<CreditNote[]>([]);
  const [skippedNotes, setSkippedNotes] = useState<any[]>([]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const selectedFile = event.target.files[0];
      const validTypes = ["text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
      if (!validTypes.includes(selectedFile.type)) {
        toast({
          variant: "destructive",
          title: "Formato Inválido",
          description: "Por favor, selecione um arquivo CSV ou Excel (.xls, .xlsx).",
        });
        return;
      }
      setFile(selectedFile);
      setNewNotes([]);
      setSkippedNotes([]);
    }
  };

  const parseDate = (dateInput: any): Date | null => {
    if (!dateInput) return null;
    if (typeof dateInput === 'number') {
        const excelEpoch = new Date(Date.UTC(0, 0, dateInput - 1));
        return excelEpoch;
    }
    if (typeof dateInput === 'string') {
        const parts = dateInput.split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            let year = parseInt(parts[2], 10);
            if (year < 100) year += 2000;
            const date = new Date(year, month, day);
            if (!isNaN(date.getTime())) return date;
        }
    }
    return null;
  };
  

  const processData = (data: any[]) => {
      const notesToImport: CreditNote[] = [];
      const notesToSkip: any[] = [];
      const existingNoteKeys = new Set(existingNotes.map(n => `${n.ncNumber}-${n.uasg}-${n.ptres}-${n.nd}-${n.pi}`));

      data.forEach((row: any) => {
        const mappedRow: any = {};
        for (const key in headerMapping) {
            if (row[key] !== undefined) {
                mappedRow[headerMapping[key]] = row[key];
            }
        }
        
        const totalValueString = String(mappedRow.totalValue || '0').replace(/\./g, '').replace(',', '.');
        const totalValue = parseFloat(totalValueString);

        const emissionDate = parseDate(mappedRow.emissionDate);
        const limitDate = parseDate(mappedRow.limitDate);

        if (isNaN(totalValue) || !emissionDate) {
          notesToSkip.push({ ...row, reason: "Valor ou Data de Emissão inválidos" });
          return;
        }
        
        const key = `${mappedRow.ncNumber}-${mappedRow.uasg}-${mappedRow.ptres}-${mappedRow.nd}-${mappedRow.pi}`;

        if (existingNoteKeys.has(key)) {
          notesToSkip.push({ ...row, reason: "Já existe no sistema" });
        } else {
          notesToImport.push({
            id: uuidv4(),
            ncNumber: String(mappedRow.ncNumber || ""),
            uasg: String(mappedRow.uasg || ""),
            esf: String(mappedRow.esf || ""),
            ptres: String(mappedRow.ptres || ""),
            fonte: String(mappedRow.fonte || ""),
            nd: String(mappedRow.nd || ""),
            ugr: String(mappedRow.ugr || ""),
            pi: String(mappedRow.pi || ""),
            observation: String(mappedRow.observation || ""),
            totalValue,
            balance: totalValue,
            emissionDate: emissionDate.toISOString(),
            limitDate: limitDate ? limitDate.toISOString() : new Date(emissionDate.getFullYear(), 11, 31).toISOString(),
            shares: [],
            createdAt: new Date().toISOString(),
          });
        }
      });
      
      setNewNotes(notesToImport);
      setSkippedNotes(notesToSkip);
      setIsProcessing(false);
  }

  const parseFile = () => {
    if (!file || !firestore) return;
    setIsProcessing(true);

    const reader = new FileReader();

    if (file.type === "text/csv") {
        reader.onload = (e) => {
            const text = e.target?.result;
            Papa.parse(text as string, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const headers = results.meta.fields || [];
                    const missingHeaders = REQUIRED_HEADERS.filter(h => !headers.includes(h));
                    if (missingHeaders.length > 0) {
                        toast({ variant: "destructive", title: "Cabeçalhos Ausentes", description: `Faltando: ${missingHeaders.join(", ")}` });
                        setIsProcessing(false);
                        return;
                    }
                    processData(results.data);
                }
            });
        };
        reader.readAsText(file);
    } else {
        reader.onload = (e) => {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet);

            if (json.length > 0) {
                const headers = Object.keys(json[0] as object);
                 const missingHeaders = REQUIRED_HEADERS.filter(h => !headers.includes(h));
                if (missingHeaders.length > 0) {
                    toast({ variant: "destructive", title: "Cabeçalhos Ausentes", description: `Faltando: ${missingHeaders.join(", ")}` });
                    setIsProcessing(false);
                    return;
                }
            }
            processData(json);
        };
        reader.readAsArrayBuffer(file);
    }
  };
  
  const handleImport = async () => {
      if (!firestore || newNotes.length === 0) return;
      
      setIsProcessing(true);
      const batch = writeBatch(firestore);
      const creditNotesCollection = collection(firestore, "creditNotes");

      newNotes.forEach(note => {
          const docRef = doc(creditNotesCollection, note.id);
          batch.set(docRef, note);
      });

      try {
          await batch.commit();
          toast({
              title: "Importação Concluída!",
              description: `${newNotes.length} novas Notas de Crédito foram adicionadas.`,
          });
          setOpen(false);
      } catch (error: any) {
           toast({
              variant: "destructive",
              title: "Erro na Importação",
              description: error.message || "Não foi possível salvar os dados. Tente novamente.",
          });
      } finally {
          setIsProcessing(false);
      }
  }

  const triggerFileSelect = () => fileInputRef.current?.click();

  return (
    <div className="space-y-4">
      <Input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xls,.xlsx"
        onChange={handleFileChange}
        className="hidden"
      />
      
      {!file && (
         <div 
            className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-muted-foreground/50 rounded-lg cursor-pointer hover:bg-muted"
            onClick={triggerFileSelect}
        >
            <UploadCloud className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">Clique ou arraste um arquivo CSV ou Excel aqui</p>
            <p className="text-xs text-muted-foreground/80">O arquivo deve conter os cabeçalhos necessários.</p>
        </div>
      )}

      {file && (
          <div className="p-4 border rounded-md bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                  <File className="h-5 w-5" />
                  <span className="font-medium">{file.name}</span>
              </div>
              <Button variant="outline" size="sm" onClick={parseFile} disabled={isProcessing}>
                {isProcessing ? "Processando..." : "Analisar Arquivo"}
              </Button>
          </div>
      )}

      {(newNotes.length > 0 || skippedNotes.length > 0) && (
          <div className="space-y-4">
               {newNotes.length > 0 && (
                   <Alert variant="default">
                      <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Pronto para Importar</AlertTitle>
                        <AlertDescription>
                            Encontramos {newNotes.length} nova(s) Nota(s) de Crédito para importar.
                        </AlertDescription>
                   </Alert>
               )}
                {skippedNotes.length > 0 && (
                   <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>{skippedNotes.length} Linha(s) Serão Ignoradas</AlertTitle>
                        <AlertDescription>
                            Algumas linhas do seu arquivo não serão importadas por já existirem ou conterem erros.
                        </AlertDescription>
                   </Alert>
               )}
              <ScrollArea className="h-64 w-full">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nº da NC</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Motivo</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {newNotes.map(note => (
                             <TableRow key={note.id} className="bg-green-100 dark:bg-green-900/30">
                                 <TableCell>{note.ncNumber}</TableCell>
                                 <TableCell>{note.totalValue.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</TableCell>
                                 <TableCell className="text-green-600 dark:text-green-400">Nova</TableCell>
                             </TableRow>
                         ))}
                         {skippedNotes.map((note, index) => (
                             <TableRow key={index} className="bg-red-100 dark:bg-red-900/30">
                                 <TableCell>{note["NÚMERO NC"]}</TableCell>
                                 <TableCell>{note["VALOR NC"]}</TableCell>
                                 <TableCell className="text-destructive">{note.reason}</TableCell>
                             </TableRow>
                         ))}
                    </TableBody>
                </Table>
              </ScrollArea>
          </div>
      )}

      <div className="flex justify-end pt-4">
        <Button onClick={handleImport} disabled={newNotes.length === 0 || isProcessing}>
          Importar {newNotes.length} NC(s)
        </Button>
      </div>
    </div>
  );
}
