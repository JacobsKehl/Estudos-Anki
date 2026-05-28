import { Metadata } from "next";
import { RegisterClient } from "./RegisterClient";

export const metadata: Metadata = {
  title: "Criar Conta | Kehl Study",
  description: "Crie sua conta no Kehl Study para ter acesso ao cronograma inteligente e revisão de flashcards.",
};

export default function RegisterPage() {
  const enableSignup = process.env.ENABLE_SIGNUP === "true";

  return <RegisterClient enableSignup={enableSignup} />;
}
