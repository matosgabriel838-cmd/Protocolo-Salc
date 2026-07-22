
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm } from "react-hook-form"
import { z } from "zod"
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
import { CreditNote, OM } from "@/lib/data"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, doc, query, orderBy, runTransaction } from "firebase/firestore"
import { PlusCircle, Trash2 } from "lucide-react"
import { useMemo, useEffect, useState } from "react"
import { Checkbox } from "../ui/checkbox"

const shareSchema = z.object({
  omId: z.string().min(1, "Selecione uma OM."),
  value: z.coerce.number().min(0.01, "O valor deve ser maior que zero."),
  sharedAt: z.string(),
  sharedBy: z.string(),
});

const formSchema = z.object({
  shares: z.array(shareSchema).min(0, "Adicione pelo menos uma partilha."),
}).refine(
    (data) => {
        const uniqueOmIds = new Set(data.shares.map(s => s.omId));
        return uniqueOmIds.size === data.shares.length;
    },
    {
        message: "Não é possível partilhar para a mesma OM mais de uma vez na mesma operação.",
        path: ["shares"],
    }
);

interface CreditShareFormProps {
    creditNote: CreditNote;
    setOpen: (open: boolean) => void;
}

export function CreditShareForm({ creditNote, setOpen }: CreditShareFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const [useTotalValue, setUseTotalValue] = useState(false);

  const omsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "militaryOrganizations"), orderBy("code"));
  }, [firestore]);
  const { data: oms, isLoading: isLoadingOms } = useCollection<OM>(omsQuery);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      shares: [],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "shares",
  });

  useEffect(() => {
      replace(creditNote.shares || []);
  }, [creditNote.shares, replace]);
  
  const sharesWatch = form.watch("shares");
  const totalSharedValue = sharesWatch.reduce((sum, share) => sum + (share.value || 0), 0);
  
  const remainingBalance = creditNote.balance;

  const handleUseTotalValueChange = (checked: boolean) => {
    setUseTotalValue(checked);
    if (checked && user) {
        replace([{
            omId: "",
            value: creditNote.totalValue,
            sharedAt: new Date().toISOString(),
            sharedBy: user.uid
        }]);
    } else {
        replace(creditNote.shares || []);
    }
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || isNaN(value)) return "";
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  
  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !user) {
      toast({ variant: "destructive", title: "Erro de Conexão ou Autenticação!" });
      return;
    }
    
    const docRef = doc(firestore, "creditNotes", creditNote.id);

    try {
        await runTransaction(firestore, async (transaction) => {
            const ncDoc = await transaction.get(docRef);
            if (!ncDoc.exists()) {
                throw "Nota de Crédito não encontrada.";
            }

            const currentData = ncDoc.data() as CreditNote;
            const newTotalShared = values.shares.reduce((sum, share) => sum + share.value, 0);
            
            if (newTotalShared > currentData.totalValue) {
                throw new Error(`O valor total partilhado (${formatCurrency(newTotalShared)}) não pode exceder o valor total da NC (${formatCurrency(currentData.totalValue)}).`);
            }
            
            const updatedShares = values.shares.map(share => ({
                ...share,
                sharedAt: share.sharedAt || new Date().toISOString(),
                sharedBy: share.sharedBy || user.uid,
            }));

            transaction.update(docRef, {
                shares: updatedShares,
            });
        });

        toast({
            title: "Sucesso!",
            description: "Partilhas de crédito atualizadas.",
        });
        setOpen(false);

    } catch (error: any) {
         toast({
            variant: "destructive",
            title: "Erro ao Salvar",
            description: error.message || "Não foi possível salvar as partilhas. Tente novamente.",
        });
    }
  }
  
  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    let value = e.target.value.replace(/\D/g, '');
    const numberValue = value ? parseInt(value, 10) / 100 : 0;
    form.setValue(`shares.${index}.value`, numberValue, { shouldValidate: true });
  };
  
  const exceedsTotalValue = totalSharedValue > creditNote.totalValue;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

        <div className="space-y-2 text-sm p-4 border rounded-md bg-muted/50">
            <div className="flex justify-between">
                <span className="text-muted-foreground">Valor Total da NC:</span>
                <span className="font-medium">{formatCurrency(creditNote.totalValue)}</span>
            </div>
             <div className="flex justify-between">
                <span className="text-muted-foreground">Total Partilhado (nesta op.):</span>
                <span className="font-medium text-blue-600">{formatCurrency(totalSharedValue)}</span>
            </div>
            <div className="flex justify-between font-bold text-base pt-2 border-t mt-2">
                <span className="text-foreground">Saldo Disponível na NC:</span>
                <span className={'text-foreground'}>
                    {formatCurrency(remainingBalance)}
                </span>
            </div>
             {exceedsTotalValue && <p className="text-xs text-destructive text-center pt-2">O valor total partilhado não pode exceder o valor da NC.</p>}
        </div>

        <div className="space-y-4 max-h-[250px] overflow-y-auto p-1">
          {fields.length === 0 && (
            <p className="text-center text-muted-foreground py-4">Nenhuma partilha adicionada.</p>
          )}
          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-[1fr_auto_auto] items-end gap-2 p-3 border rounded-md">
                <FormField
                    control={form.control}
                    name={`shares.${index}.omId`}
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className={index !== 0 ? "sr-only": ""}>OM</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione a OM" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {isLoadingOms ? <SelectItem value="loading" disabled>Carregando...</SelectItem> : 
                                    oms?.map(om => (
                                        <SelectItem key={om.id} value={om.id}>{om.code} - {om.abbreviation}</SelectItem>
                                    ))
                                }
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name={`shares.${index}.value`}
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className={index !== 0 ? "sr-only": ""}>Valor</FormLabel>
                        <FormControl>
                             <Input
                                placeholder="R$ 0,00"
                                {...field}
                                value={formatCurrency(field.value) || ""}
                                onChange={(e) => handleValueChange(e, index)}
                                onBlur={field.onBlur}
                                className="w-36 text-right"
                                disabled={useTotalValue}
                            />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => remove(index)}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
          ))}
        </div>
        
        <div className="flex items-center space-x-2">
            <Checkbox
                id="useTotalValue"
                onCheckedChange={(checked) => handleUseTotalValueChange(!!checked)}
            />
            <label
                htmlFor="useTotalValue"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
                Utilizar valor total da NC para uma única partilha
            </label>
        </div>

        <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => user && append({ omId: "", value: 0, sharedAt: new Date().toISOString(), sharedBy: user.uid })}
            disabled={useTotalValue}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Adicionar Nova Partilha
        </Button>

        <div className="flex justify-end pt-4">
            <Button type="submit" disabled={!firestore || exceedsTotalValue || !user}>
                Salvar Partilhas
            </Button>
        </div>
      </form>
    </Form>
  )
}
