"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";

import { PageHeader } from "@/components/dashboard/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth, useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

const formSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, { message: "A senha atual é obrigatória." }),
    newPassword: z
      .string()
      .min(6, { message: "A nova senha deve ter no mínimo 6 caracteres." }),
    confirmPassword: z
      .string()
      .min(1, { message: "A confirmação da senha é obrigatória." }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As novas senhas não coincidem.",
    path: ["confirmPassword"],
  });

export default function ChangePasswordPage() {
  const auth = useAuth();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user || !user.email) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Usuário não autenticado.",
      });
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(
        user.email,
        values.currentPassword
      );
      
      // Re-authenticate to confirm the user's identity
      await reauthenticateWithCredential(user, credential);

      // If re-authentication is successful, update the password
      await updatePassword(user, values.newPassword);
      
      // We don't need the password check anymore for this session
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('passwordCheckDone', 'true');
      }

      toast({
        title: "Sucesso!",
        description: "Sua senha foi alterada.",
      });
      router.push("/dashboard/overview");

    } catch (error: any) {
      let description = "Ocorreu um erro. Tente novamente.";
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        description = "A senha atual está incorreta.";
      }
       if (error.code === 'auth/too-many-requests') {
        description = "Muitas tentativas. Tente novamente mais tarde.";
      }
      toast({
        variant: "destructive",
        title: "Falha na Alteração",
        description: description,
      });
    }
  };

  return (
    <>
      <PageHeader
        title="Trocar Senha"
        description="Altere sua senha de acesso ao sistema."
      />
      <div className="flex justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Alteração de Senha</CardTitle>
            <CardDescription>
              Para sua segurança, digite sua senha atual e a nova senha desejada.
            </CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha Atual</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nova Senha</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar Nova Senha</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Alterando..." : "Alterar Senha"}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </>
  );
}