
'use client';

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useAuth, useUser } from "@/firebase";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInWithEmailAndPassword, sendPasswordResetEmail, setPersistence, browserLocalPersistence } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";

const formSchema = z.object({
  email: z.string().email({ message: "O e-mail é obrigatório." }),
  password: z.string().min(1, { message: "A senha é obrigatória." }),
});

const resetSchema = z.object({
  email: z.string().email({ message: "Por favor, insira um email válido." }),
});

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { user, isLoading } = useUser();
  const copespLogo = PlaceHolderImages.find(img => img.id === 'copesp-logo');
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [emailForReset, setEmailForReset] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (!isLoading && user) {
        router.replace('/dashboard/overview');
    }
  }, [user, isLoading, router]);

  const handleLogin = async (values: z.infer<typeof formSchema>) => {
    try {
      const normalizedEmail = values.email.trim().toLowerCase();
      
      await setPersistence(auth, browserLocalPersistence);
      await signInWithEmailAndPassword(auth, normalizedEmail, values.password);

      toast({
        title: "Login bem-sucedido!",
        description: "Você será redirecionado para o painel.",
      });

    } catch (error: any) {
      console.error("Login Error:", error);
      let description = "Ocorreu um erro desconhecido. Tente novamente.";
      
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        description = "Credenciais incorretas. Verifique seu e-mail e senha.";
      } else if (error.code === 'auth/too-many-requests') {
        description = "Muitas tentativas de login. Tente novamente mais tarde.";
      }

      toast({
        variant: "destructive",
        title: "Falha no Login",
        description,
      });
    }
  };

  const handlePasswordReset = async () => {
    const normalizedEmail = emailForReset.trim().toLowerCase();
    const result = resetSchema.safeParse({ email: normalizedEmail });
    
    if (!result.success) {
      toast({
        variant: "destructive",
        title: "Email Inválido",
        description: result.error.errors[0].message,
      });
      return;
    }

    setIsResetting(true);
    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      toast({
        title: "Email Enviado",
        description: "Se o email estiver cadastrado, um link para redefinição de senha será enviado.",
      });
      setIsResetDialogOpen(false);
    } catch (error: any) {
      console.error("Password Reset Error:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível enviar o email de redefinição.",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="mx-auto w-full max-w-sm">
         {copespLogo && (
            <div className="flex justify-center pt-6">
                <div className="relative h-20 w-20">
                    <Image src={copespLogo.imageUrl} alt={copespLogo.description} fill className="object-contain"/>
                </div>
            </div>
        )}
        <CardHeader>
          <CardTitle className="text-xl text-center">SisGEC</CardTitle>
          <CardDescription className="text-center">
            Gestão de Empenhos e Crédito
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input placeholder="usuario@eb.mil.br" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center">
                      <FormLabel>Senha</FormLabel>
                       <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                        <AlertDialogTrigger asChild>
                           <Button variant="link" type="button" className="ml-auto text-xs px-0">Esqueceu sua senha?</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Redefinir Senha</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Digite seu email abaixo. Se ele estiver cadastrado, enviaremos um link para você criar uma nova senha.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="email-reset" className="text-right">
                                    Email
                                    </Label>
                                    <Input
                                    id="email-reset"
                                    type="email"
                                    value={emailForReset}
                                    onChange={(e) => setEmailForReset(e.target.value)}
                                    className="col-span-3"
                                    placeholder="usuario@eb.mil.br"
                                    />
                                </div>
                            </div>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <Button onClick={handlePasswordReset} disabled={isResetting}>
                                    {isResetting ? "Enviando..." : "Enviar link"}
                                </Button>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                       </AlertDialog>
                    </div>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Autenticando..." : "Entrar"}
              </Button>
            </form>
          </Form>
          <Separator className="my-4" />
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Acesso restrito ao Exército Brasileiro.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
