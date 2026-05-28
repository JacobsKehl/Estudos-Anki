import { Metadata } from "next";
import { LoginClient } from "./LoginClient";

export const metadata: Metadata = {
  title: "Acessar Conta | Kehl Study",
  description: "Faça login no Kehl Study para acessar seus flashcards, cronograma personalizado e materiais de estudo.",
};

export default function LoginPage() {
  const enableSignup = process.env.ENABLE_SIGNUP === "true";

  return <LoginClient enableSignup={enableSignup} />;
}
