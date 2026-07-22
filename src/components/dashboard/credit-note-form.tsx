"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import React, { useEffect } from "react"
import { v4 as uuidv4 } from 'uuid';

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { CreditNote } from "@/lib/data"
import { useFirestore, addDocumentNonBlocking, useMemoFirebase, setDocumentNonBlocking } from "@/firebase"
import { collection, doc, serverTimestamp } from "firebase/firestore"
import { Textarea } from "../ui/textarea"
import { Separator } from "../ui/separator"

const currentYear = new Date().getFullYear();

const formSchema = z.object({
  ncNumber: z.string()
    .length(12, "O nº da NC deve ter exatamente 12 caracteres.")
    .refine(val => val.toUpperCase().startsWith(`${currentYear}NC`), `O nº da NC deve começar com ${currentYear}NC.`),
  emissionDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "A data de emissão é obrigatória.",
  }),
  limitDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: "A data limite é obrigatória.",
  }),
  uasg: z.enum(["160098", "167098"], {
    required_error: "A UASG é obrigatória.",
  }),
  esf: z.string().length(1, "A Esfera deve ter 1 caractere."),
  ptres: z.string().length(6, "O PTRES deve ter 6 caracteres."),
  fonte: z.string().length(10, "A Fonte deve ter 10 caracteres."),
  nd: z.string().length(6, "A ND deve ter 6 caracteres."),
  ugr: z.string().length(6, "A UGR deve ter 6 caracteres."),
  pi: z.string().min(1, "O PI é obrigatório.").max(11, "O PI deve ter no máximo 11 caracteres."),
  totalValue: z.coerce.number().min(0.01, "O valor total deve ser maior que zero."),
  observation: z.string().optional(),
});

interface CreditNoteFormProps {
    setOpen: (open: boolean) => void;
    existingNotes: CreditNote[];
    initialData?: Partial<CreditNote> | null;
}

export function CreditNoteForm({ setOpen, existingNotes, initialData }: CreditNoteFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  
  const isEditing = !!(initialData && 'id' in initialData);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        ncNumber: `${currentYear}NC`,
        emissionDate: "",
        limitDate: "",
        esf: "",
        ptres: "",
        fonte: "",
        nd: "",
        ugr: "",
        pi: "",
        totalValue: 0,
        observation: "",
    },
  })
  
  useEffect(() => {
    if (initialData) {
        form.reset({
            ncNumber: initialData.ncNumber || `${currentYear}NC`,
            emissionDate: initialData.emissionDate ? new Date(initialData.emissionDate).toISOString().split('T')[0] : "",
            limitDate: initialData.limitDate ? new Date(initialData.limitDate).toISOString().split('T')[0] : "",
            uasg: initialData.uasg as "160098" | "167098" | undefined,
            esf: initialData.esf || "",
            ptres: initialData.ptres || "",
            fonte: initialData.fonte || "",
            nd: initialData.nd || "",
            ugr: initialData.ugr || "",
            pi: initialData.pi || "",
            totalValue: initialData.totalValue || 0,
            observation: initialData.observation || "",
        });
    }
  }, [initialData, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore) {
      toast({
          variant: "destructive",
          title: "Erro de Conexão!",
          description: "Não foi possível conectar ao banco de dados.",
      });
      return;
    }

    const finalValues = {
        ...values,
        ncNumber: values.ncNumber.toUpperCase(),
        esf: values.esf.toUpperCase(),
        ptres: values.ptres.toUpperCase(),
        fonte: values.fonte.toUpperCase(),
        nd: values.nd.toUpperCase(),
        ugr: values.ugr.toUpperCase(),
        pi: values.pi.toUpperCase(),
    };

    // Check for uniqueness of ncNumber + uasg + ptres + nd + pi, excluding the current document being edited
    const isDuplicate = existingNotes.some(note => 
        note.ncNumber === finalValues.ncNumber && 
        note.uasg === finalValues.uasg &&
        note.ptres === finalValues.ptres &&
        note.nd === finalValues.nd &&
        note.pi === finalValues.pi &&
        note.id !== (initialData as CreditNote)?.id
    );

    if (isDuplicate) {
        form.setError("ncNumber", {
            type: "manual",
            message: "Já existe uma nota com esta combinação de Nº, UASG, PTRES, ND e PI.",
        });
        toast({
            variant: "destructive",
            title: "Nota Duplicada",
            description: "A combinação de Nº, UASG, PTRES, ND e PI informada já está cadastrada.",
        });
        return;
    }
    
    if (isEditing && initialData?.id) {
        const docRef = doc(firestore, "creditNotes", initialData.id);
        
        // Ensure values for balance calculation are numbers
        const currentTotal = initialData.totalValue || 0;
        const currentBalance = initialData.balance || 0;
        const spent = currentTotal - currentBalance;
        
        const updatedData = {
            ...finalValues,
            emissionDate: new Date(values.emissionDate).toISOString(),
            limitDate: new Date(values.limitDate).toISOString(),
            // Balance is total - already spent
            balance: values.totalValue - spent,
        };
        setDocumentNonBlocking(docRef, updatedData, { merge: true });
        toast({
            title: "Sucesso!",
            description: "Nota de Crédito atualizada.",
        });

    } else {
        const creditNotesCollection = collection(firestore, "creditNotes");
        const newCreditNote = {
            id: uuidv4(),
            ...finalValues,
            emissionDate: new Date(values.emissionDate).toISOString(),
            limitDate: new Date(values.limitDate).toISOString(),
            balance: values.totalValue,
            shares: [],
            createdAt: serverTimestamp(),
        };
        addDocumentNonBlocking(creditNotesCollection, newCreditNote);
        toast({
            title: "Sucesso!",
            description: "Nota de Crédito incluída no sistema.",
        });
    }

    setOpen(false);
  }
  
  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value) {
      const numberValue = parseInt(value, 10) / 100;
      form.setValue('totalValue', numberValue, { shouldValidate: true });
    } else {
      form.setValue('totalValue', 0, { shouldValidate: true });
    }
  };
  
  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || isNaN(value)) return "";
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  const isSubmitDisabled = !firestore;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

        <h3 className="text-lg font-semibold">Informações Básicas</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="ncNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nº da NC</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={`${currentYear}NC000000`} 
                      {...field}
                      maxLength={12}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
                control={form.control}
                name="emissionDate"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Data de Emissão</FormLabel>
                        <FormControl>
                            <Input type="date" placeholder="AAAA-MM-DD" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="limitDate"
                render={({ field }) => (
                     <FormItem>
                        <FormLabel>Data Limite</FormLabel>
                        <FormControl>
                            <Input type="date" placeholder="AAAA-MM-DD" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>

        <FormField
            control={form.control}
            name="uasg"
            render={({ field }) => (
                <FormItem>
                <FormLabel>UASG</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                    <SelectTrigger>
                        <SelectValue placeholder="Selecione a UASG" />
                    </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                    <SelectItem value="160098">160098</SelectItem>
                    <SelectItem value="167098">167098</SelectItem>
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
        />
        
        <FormField
            control={form.control}
            name="observation"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Observação</FormLabel>
                <FormControl>
                    <Textarea
                        placeholder="Insira qualquer observação relevante para esta Nota de Crédito."
                        className="resize-none"
                        {...field}
                    />
                </FormControl>
                <FormMessage />
            </FormItem>
            )}
        />

        <Separator className="my-6" />

        <h3 className="text-lg font-semibold">Dados da Linha de Crédito</h3>

         <FormField
            control={form.control}
            name="esf"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Esfera (Esf)</FormLabel>
                <FormControl>
                <Input 
                    placeholder="1" 
                    {...field} 
                    maxLength={1} 
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                />
                </FormControl>
                <FormMessage />
            </FormItem>
            )}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <FormField
              control={form.control}
              name="ptres"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>PTRES</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="082444" 
                      {...field} 
                      maxLength={6} 
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fonte"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fonte</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="1000000000" 
                      {...field} 
                      maxLength={10} 
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nd"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Natureza da Despesa (ND)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="339030" 
                      {...field} 
                      maxLength={6} 
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="ugr"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>UGR</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="160098" 
                      {...field} 
                      maxLength={6} 
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pi"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>PI</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="VBRBRAVO" 
                      {...field} 
                      maxLength={11} 
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="totalValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor Total</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="R$ 0,00"
                      {...field}
                      value={formatCurrency(field.value) || ""}
                      onChange={handleValueChange}
                      onBlur={field.onBlur}
                      disabled={isEditing}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>
        
        <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSubmitDisabled}>
              {isEditing ? "Salvar Alterações" : "Salvar Nota de Crédito"}
            </Button>
        </div>
      </form>
    </Form>
  )
}
