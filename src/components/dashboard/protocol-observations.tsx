
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Protocol, ProtocolObservation, UserProfile } from "@/lib/data";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useFirestore, useUser, setDocumentNonBlocking } from "@/firebase";
import { doc, arrayUnion } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "../ui/avatar";

const formSchema = z.object({
  text: z.string().min(1, "A observação não pode estar em branco."),
});

interface ProtocolObservationsProps {
  protocol: Protocol;
  usersMap: Map<string, UserProfile>;
  onObservationAdded: () => void;
}

export function ProtocolObservations({
  protocol,
  usersMap,
  onObservationAdded,
}: ProtocolObservationsProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user, userProfile } = useUser();
  const isAdmin = userProfile?.role === 'ADMIN';

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      text: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!firestore || !user || user.isAnonymous) {
      toast({
        variant: "destructive",
        title: "Acesso Negado",
        description: "Você não tem permissão para adicionar observações.",
      });
      return;
    }

    const newObservation: ProtocolObservation = {
      userId: user.uid,
      text: values.text,
      createdAt: new Date().toISOString(),
    };

    const protocolRef = doc(firestore, "protocols", protocol.id);

    try {
        setDocumentNonBlocking(protocolRef, {
            observations: arrayUnion(newObservation)
        }, { merge: true });

        toast({
            title: "Sucesso!",
            description: "Sua observação foi adicionada.",
        });
        
        form.reset();
        onObservationAdded(); // Close the dialog
    } catch (error) {
        console.error("Error adding observation: ", error);
        toast({
            variant: "destructive",
            title: "Erro",
            description: "Não foi possível adicionar a observação.",
        });
    }
  };
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
  }

  return (
    <div className="space-y-6">
      <ScrollArea className="h-64 w-full pr-4">
        <div className="space-y-4">
          {protocol.observations.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma observação ainda.</p>
          ) : (
            [...protocol.observations].sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map((obs, index) => {
              const obsUser = usersMap.get(obs.userId);
              return (
                <div key={index} className="flex items-start gap-4">
                  {obsUser && !user?.isAnonymous && (
                    <Avatar className="h-9 w-9">
                      <AvatarFallback>{obsUser?.warName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className="grid gap-1.5 w-full">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">
                        {obsUser ? `${obsUser.rank} ${obsUser.warName}` : "Usuário Desconhecido"}
                      </p>
                      <time className="text-xs text-muted-foreground">
                        {formatDate(obs.createdAt)}
                      </time>
                    </div>
                    <p className="text-sm leading-snug bg-muted p-3 rounded-md">
                      {obs.text}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
      {isAdmin && (
        <div className="pt-6 border-t">
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                control={form.control}
                name="text"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Adicionar Nova Observação</FormLabel>
                    <FormControl>
                        <Textarea
                        placeholder="Digite sua mensagem aqui..."
                        {...field}
                        />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <Button type="submit">Enviar Mensagem</Button>
            </form>
            </Form>
        </div>
      )}
    </div>
  );
}
