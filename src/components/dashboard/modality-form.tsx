
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
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
import { useToast } from "@/hooks/use-toast"
import { useFirestore, addDocumentNonBlocking, setDocumentNonBlocking } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { Modality } from "@/lib/data"
import { Checkbox } from "../ui/checkbox"
import { useEffect } from "react"
import { Separator } from "../ui/separator"

const formSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório."),
  description: z.string().optional(),
  // Report settings
  isCompliance: z.boolean().default(false),
  isFinancial: z.boolean().default(false),
  // Field requirements
  requiresDiexPreq: z.boolean().default(true),
  requiresPregao: z.boolean().default(false),
  requiresSipeo: z.boolean().default(false),
  requiresBeneficiary: z.boolean().default(false),
  order: z.number().optional(),
});

interface ModalityFormProps {
    setOpen: (open: boolean) => void;
    modality?: Modality | null;
    existingModalities: Modality[];
}

export function ModalityForm({ setOpen, modality, existingModalities }: ModalityFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const isEditing = !!modality;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      isCompliance: false,
      isFinancial: false,
      requiresDiexPreq: true,
      requiresPregao: false,
      requiresSipeo: false,
      requiresBeneficiary: false,
    },
  });

  useEffect(() => {
      if(isEditing && modality) {
          form.reset({
              name: modality.name,
              description: modality.description,
              isCompliance: modality.isCompliance || false,
              isFinancial: modality.isFinancial || false,
              requiresDiexPreq: modality.requiresDiexPreq !== false, // Default to true if undefined
              requiresPregao: modality.requiresPregao || false,
              requiresSipeo: modality.requiresSipeo || false,
              requiresBeneficiary: modality.requiresBeneficiary || false,
              order: modality.order,
          })
      } else {
          form.reset({
            name: "",
            description: "",
            isCompliance: false,
            isFinancial: false,
            requiresDiexPreq: true,
            requiresPregao: false,
            requiresSipeo: false,
            requiresBeneficiary: false,
          })
      }
  }, [modality, isEditing, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore) {
        toast({
            variant: "destructive",
            title: "Erro de Conexão!",
            description: "Não foi possível conectar ao banco de dados.",
        });
        return;
    }
    
    if (isEditing && modality) {
        const docRef = doc(firestore, "licitationModalities", modality.id);
        setDocumentNonBlocking(docRef, values, { merge: true });
        toast({
            title: "Sucesso!",
            description: "Modalidade atualizada.",
        });
    } else {
        const modalities = existingModalities || [];
        const highestOrder = modalities.reduce((max, m) => (m.order !== undefined && m.order > max ? m.order : max), 0);
        const newModality = {
            id: uuidv4(),
            ...values,
            order: highestOrder + 1,
        };
        const modalitiesCollection = collection(firestore, "licitationModalities");
        addDocumentNonBlocking(modalitiesCollection, newModality);
        toast({
            title: "Sucesso!",
            description: "Modalidade adicionada ao sistema.",
        });
    }

    setOpen(false);
  }

  const isSubmitDisabled = !firestore;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome da Modalidade</FormLabel>
              <FormControl>
                <Input placeholder="Pregão" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição (Opcional)</FormLabel>
              <FormControl>
                <Input placeholder="Descrição da modalidade" {...field} value={field.value || ''}/>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Separator />

        <div className="space-y-4">
            <FormLabel>Campos Obrigatórios no Protocolo</FormLabel>
             <div className="space-y-2 rounded-md border p-4">
                 <FormField
                    control={form.control}
                    name="requiresDiexPreq"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <div className="space-y-1 leading-none"><FormLabel>DIEx / P_Req</FormLabel></div>
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="requiresPregao"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <div className="space-y-1 leading-none"><FormLabel>Nº do Pregão</FormLabel></div>
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="requiresSipeo"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <div className="space-y-1 leading-none"><FormLabel>Mapa SIPEO</FormLabel></div>
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="requiresBeneficiary"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <div className="space-y-1 leading-none"><FormLabel>Nome do Beneficiário</FormLabel></div>
                        </FormItem>
                    )}
                />
            </div>
        </div>
        
        <Separator />
        
        <div className="space-y-4">
            <FormLabel>Aplica-se aos Relatórios</FormLabel>
            <div className="flex gap-4 items-center rounded-md border p-4">
                 <FormField
                    control={form.control}
                    name="isCompliance"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                            <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                            <FormLabel>Conformidade</FormLabel>
                        </div>
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="isFinancial"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                            <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                            <FormLabel>Financeiro</FormLabel>
                        </div>
                        </FormItem>
                    )}
                />
            </div>
        </div>

        <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSubmitDisabled}>
              {isEditing ? "Salvar Alterações" : "Salvar Modalidade"}
            </Button>
        </div>
      </form>
    </Form>
  )
}
