import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUnifiedTodayCards } from "@/lib/srs/srs-utils";
import { getMockUserId } from "@/lib/auth-mock";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import { getUserCopy } from "@/lib/user-copy";
import { getTodayRangeSP } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

// Helper para verificar se o horário do lembrete coincide com a janela de 15 minutos (America/Sao_Paulo)
function isTimeInGridWindow(reminderTimeStr: string, nowSP: Date): boolean {
  const parts = reminderTimeStr.split(":");
  if (parts.length !== 2) return false;
  const remHour = parseInt(parts[0], 10);
  const remMin = parseInt(parts[1], 10);
  if (isNaN(remHour) || isNaN(remMin)) return false;
  const remTotalMinutes = remHour * 60 + remMin;

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "numeric",
    minute: "numeric",
    hour12: false
  });
  const partsSP = fmt.formatToParts(nowSP);
  const partMap = Object.fromEntries(partsSP.map((p) => [p.type, p.value]));
  const spHour = parseInt(partMap.hour, 10);
  const spMin = parseInt(partMap.minute, 10);

  // Arredonda spMin para o grid de 15 minutos mais próximo (0, 15, 30, 45, 60)
  let gridMin = Math.round(spMin / 15) * 15;
  let gridHour = spHour;
  if (gridMin === 60) {
    gridMin = 0;
    gridHour = (gridHour + 1) % 24;
  }

  const gridTotalMinutes = gridHour * 60 + gridMin;
  const startMinutes = gridTotalMinutes - 15;

  if (startMinutes < 0) {
    const wrappedStart = 1440 + startMinutes;
    return (remTotalMinutes > wrappedStart && remTotalMinutes <= 1440) || 
           (remTotalMinutes >= 0 && remTotalMinutes <= gridTotalMinutes);
  } else {
    return remTotalMinutes > startMinutes && remTotalMinutes <= gridTotalMinutes;
  }
}

// Template HTML Premium do e-mail
function generateEmailHtml(
  studentName: string,
  todayLabel: string,
  todayTasks: any[],
  todayCardsCount: number,
  yesterdayStats: { completed: number; pending: number; skipped: number },
  yesterdayItems: any[],
  appUrl: string,
  nextTheoryItem?: any,
  languageTone?: string
) {
  const copy = getUserCopy(languageTone);
  const yesterdayCompletedList = yesterdayItems.filter((i: any) => i.status === "COMPLETED");
  const yesterdayPendingList = yesterdayItems.filter(
    (i: any) => i.status !== "COMPLETED" && i.status !== "SKIPPED"
  );

  const tasksHtml =
    todayTasks.length > 0
      ? todayTasks
          .map(
            (t) => {
              const material = t.studyBlock?.material || t.material;
              const pdfName = material 
                ? (material.originalFileName || (material as any).originalName || material.fileName || (material as any).title || "PDF não identificado") 
                : "PDF não identificado";
              const pageStart = t.studyBlock?.pageStart;
              const pageEnd = t.studyBlock?.pageEnd;
              const pageRange = pageStart !== undefined && pageEnd !== undefined ? `Páginas: ${pageStart} - ${pageEnd}` : "";
              const pdfHtml = material 
                ? `<div style="font-size: 13px; color: #4a5568; margin-top: 2px;">
                     <strong>PDF:</strong> ${pdfName} ${pageRange ? `(${pageRange})` : ""}
                   </div>` 
                : "";

              let actionLabel = "Estudo";
              if (t.actionType === "THEORY") actionLabel = "Teoria";
              else if (t.actionType === "QUESTIONS") actionLabel = "Questões";
              else if (t.actionType === "GENERATE_FLASHCARDS") actionLabel = "Criar Cards";
              else if (t.actionType === "REVIEW_BLOCK") actionLabel = "Revisar Bloco";
              else if (t.actionType === "REVIEW_FLASHCARDS") actionLabel = "Revisar Cards";
              else if (t.actionType === "REINFORCEMENT") actionLabel = "Reforço";

              return `
                <li style="margin-bottom: 16px; font-size: 15px; color: #2d3748; list-style-type: none; padding-left: 12px; border-left: 3px solid #869774;">
                  <div style="font-weight: 700; color: #2d3748; font-size: 15px;">
                    ${t.subject?.name || "Matéria"}
                  </div>
                  <div style="font-size: 14px; color: #4a5568; margin-top: 2px;">
                    <strong>Bloco:</strong> ${t.studyBlock?.title || "Bloco de Estudo"}
                  </div>
                  ${pdfHtml}
                  <div style="font-size: 13px; color: #718096; margin-top: 4px;">
                    <span style="background-color: #f0f2ed; color: #869774; padding: 2px 6px; border-radius: 4px; font-weight: 500; font-size: 11px; margin-right: 6px; text-transform: uppercase;">
                      ${actionLabel}
                    </span>
                    <strong>Tempo estimado:</strong> ${t.estimatedMinutes || 30} min
                  </div>
                </li>
              `;
            }
          )
          .join("")
      : `
        <li style="margin-bottom: 8px; font-size: 15px; color: #718096; list-style-type: none; padding-left: 0;">
          Nenhuma matéria agendada para hoje.
        </li>
      `;

  const yesterdayCompletedHtml =
    yesterdayCompletedList.length > 0
      ? yesterdayCompletedList
          .map(
            (t) => `
        <li style="margin-bottom: 6px; font-size: 14px; color: #2f855a; list-style-type: none; padding-left: 0;">
          <span style="margin-right: 6px; font-weight: bold;">✓</span>
          <strong>${t.subject?.name || "Matéria"}:</strong> ${t.studyBlock?.title || "Bloco de Estudo"}
        </li>
      `
          )
          .join("")
      : `<li style="font-size: 14px; color: #718096; list-style-type: none;">Nenhuma matéria concluída ontem.</li>`;

  const yesterdayPendingHtml =
    yesterdayPendingList.length > 0
      ? yesterdayPendingList
          .map(
            (t) => `
        <li style="margin-bottom: 6px; font-size: 14px; color: #c53030; list-style-type: none; padding-left: 0;">
          <span style="margin-right: 6px; font-weight: bold;">⚠</span>
          <strong>${t.subject?.name || "Matéria"}:</strong> ${t.studyBlock?.title || "Bloco de Estudo"} (Pendente)
        </li>
      `
          )
          .join("")
      : "";

  let nextTheoryItemHtml = "";
  if (nextTheoryItem) {
    const nextMaterial = nextTheoryItem.studyBlock?.material || nextTheoryItem.material;
    const nextPdfName = nextMaterial 
      ? (nextMaterial.originalFileName || (nextMaterial as any).originalName || nextMaterial.fileName || (nextMaterial as any).title || "PDF não identificado") 
      : "PDF não identificado";
    const nextPageStart = nextTheoryItem.studyBlock?.pageStart;
    const nextPageEnd = nextTheoryItem.studyBlock?.pageEnd;
    const nextPageRange = nextPageStart !== undefined && nextPageEnd !== undefined ? `Páginas: ${nextPageStart} - ${nextPageEnd}` : "";
    
    nextTheoryItemHtml = `
      <!-- Section: Sugestão de Adiantamento -->
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 25px; background-color: #f7fafc; border: 1px solid #edf2f7; border-radius: 12px; padding: 20px;">
        <tr>
          <td>
            <h2 style="font-size: 16px; color: #4a5568; margin-top: 0; margin-bottom: 12px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">🚀 Se quiser adiantar</h2>
            <div style="font-size: 14px; color: #2d3748; line-height: 1.6;">
              Se sobrar tempo hoje, você pode adiantar a próxima teoria do seu cronograma (sem alterar a data original do agendamento):
              <div style="margin-top: 10px; padding: 12px; background-color: #ffffff; border: 1px solid #edf2f7; border-radius: 8px; border-left: 3px solid #869774;">
                <div style="font-weight: 700; color: #2d3748; font-size: 14px; margin-bottom: 4px;">
                  ${nextTheoryItem.subject?.name || "Matéria"}
                </div>
                <div style="font-size: 13px; color: #4a5568; margin-bottom: 2px;">
                  <strong>Bloco:</strong> ${nextTheoryItem.studyBlock?.title || "Bloco de Estudo"}
                </div>
                ${nextMaterial ? `<div style="font-size: 13px; color: #4a5568; margin-bottom: 4px;"><strong>PDF:</strong> ${nextPdfName} ${nextPageRange ? `(${nextPageRange})` : ""}</div>` : ""}
                <div style="font-size: 12px; color: #718096;">
                  <strong>Tempo estimado:</strong> ${nextTheoryItem.estimatedMinutes || 30} min
                </div>
              </div>
            </div>
          </td>
        </tr>
      </table>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Seu roteiro de estudos de hoje</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8f9fa; padding: 20px 0;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #869774; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Kehl Study</h1>
              <p style="color: #f0f2ed; margin: 5px 0 0 0; font-size: 14px; font-weight: 500;">Seu roteiro de estudos de hoje · ${todayLabel}</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="font-size: 16px; color: #2d3748; line-height: 1.5; margin-top: 0;">
                Bom dia, <strong>${studentName}</strong>! ☀️
              </p>
              <p style="font-size: 15px; color: #4a5568; line-height: 1.6; margin-bottom: 25px;">
                ${copy.todayReady}. ${copy.readyForMore}<br />
                Confira abaixo as suas metas de hoje e o resumo de ontem:
              </p>
              
              <!-- Section: Estudos de Hoje -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 25px; background-color: #fcfdfb; border: 1px solid #eef1ed; border-radius: 12px; padding: 20px;">
                <tr>
                  <td>
                    <h2 style="font-size: 16px; color: #869774; margin-top: 0; margin-bottom: 12px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">📚 Estudos de Hoje</h2>
                    <ul style="margin: 0; padding: 0;">
                      ${tasksHtml}
                    </ul>
                  </td>
                </tr>
              </table>

              <!-- Section: Cards do Dia -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 25px; background-color: #f7fafc; border: 1px solid #edf2f7; border-radius: 12px; padding: 20px;">
                <tr>
                  <td>
                    <h2 style="font-size: 16px; color: #4a5568; margin-top: 0; margin-bottom: 8px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">🧠 Cards do Dia (SRS)</h2>
                    <p style="font-size: 15px; color: #2d3748; margin: 0;">
                      Você tem <strong>${todayCardsCount}</strong> flashcards disponíveis para praticar hoje.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Section: Ontem -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 30px; background-color: #fffaf0; border: 1px solid #feebc8; border-radius: 12px; padding: 20px;">
                <tr>
                  <td>
                    <h2 style="font-size: 16px; color: #dd6b20; margin-top: 0; margin-bottom: 12px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">⏱ Status de Ontem</h2>
                    <p style="font-size: 14px; color: #4a5568; margin-top: 0; margin-bottom: 12px;">
                      Metas concluídas: <strong>${yesterdayStats.completed}</strong> | Pendentes: <strong>${yesterdayStats.pending}</strong>
                    </p>
                    
                    <!-- Concluídos ontem -->
                    <ul style="margin: 0 0 10px 0; padding: 0;">
                      ${yesterdayCompletedHtml}
                    </ul>
                    
                    <!-- Pendências movidas -->
                    ${
                      yesterdayPendingHtml
                        ? `
                      <div style="border-top: 1px dashed #feebc8; margin-top: 12px; padding-top: 12px;">
                        <span style="font-size: 12px; font-weight: bold; color: #dd6b20; text-transform: uppercase; display: block; margin-bottom: 8px;">Pendências de ontem:</span>
                        <ul style="margin: 0; padding: 0;">
                          ${yesterdayPendingHtml}
                        </ul>
                      </div>
                    `
                        : ""
                    }
                  </td>
                </tr>
              </table>

              <!-- Section: Sugestão de Adiantamento -->
              ${nextTheoryItemHtml}

              <!-- CTA -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="text-align: center; margin-top: 30px; margin-bottom: 20px;">
                <tr>
                  <td>
                    <a href="${appUrl}" style="background-color: #869774; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px rgba(134,151,116,0.25);">
                      Abrir Kehl Study
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f7fafc; border-top: 1px solid #edf2f7; padding: 25px; text-align: center;">
              <p style="font-size: 13px; color: #718096; margin: 0 0 8px 0; font-style: italic;">
                "O sucesso é a soma de pequenos esforços repetidos dia após dia."
              </p>
              <p style="font-size: 11px; color: #a0aec0; margin: 0;">
                Enviado automaticamente por Kehl Study. Não responda a este e-mail.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Função isolada e pura (sem efeitos colaterais de reordenação) para compor e enviar o lembrete para um usuário.
 */
async function processUserReminder(
  user: any,
  isManualTrigger: boolean,
  todayRange: any,
  yesterdayRange: any
) {
  // Resolve o e-mail sem fallbacks estáticos baseados em strings hardcoded.
  const targetEmail = user.preferences?.dailyReminderEmail || user.email;
  if (!targetEmail) {
    return {
      success: false,
      skipped: true,
      reason: "Erro: Usuário não possui e-mail cadastrado ou configurado."
    };
  }

  // 1. Obter itens do cronograma de ontem
  const yesterdayItems = await (prisma as any).studyScheduleItem.findMany({
    where: {
      userId: user.id,
      schedule: { status: "ACTIVE" },
      scheduledDate: { gte: yesterdayRange.start, lt: yesterdayRange.end },
    },
    include: {
      subject: true,
      studyBlock: {
        include: {
          material: true
        }
      },
      material: true
    },
  });

  const yesterdayCompleted = yesterdayItems.filter((i: any) => i.status === "COMPLETED").length;
  const yesterdayPending = yesterdayItems.filter(
    (i: any) => i.status !== "COMPLETED" && i.status !== "SKIPPED"
  ).length;
  const yesterdaySkipped = yesterdayItems.filter((i: any) => i.status === "SKIPPED").length;

  // H4 - REMOVIDO: reorganizeActiveSchedule(user.id, 30);
  // O cron de e-mail agora é 100% read-only para evitar alterações inesperadas no cronograma.

  // 2. Obter itens agendados para hoje
  const todayItems = await (prisma as any).studyScheduleItem.findMany({
    where: {
      userId: user.id,
      schedule: { status: "ACTIVE" },
      scheduledDate: { gte: todayRange.start, lt: todayRange.end },
    },
    include: {
      subject: true,
      studyBlock: {
        include: {
          material: true
        }
      },
      material: true
    },
  });

  const todayTasks = todayItems.filter(
    (i: any) => i.actionType !== "REVIEW_FLASHCARDS" && i.actionType !== "PRACTICE_CARDS"
  );

  // 3. Buscar a próxima teoria pendente (sugestão de adiantamento)
  const nextTheoryItem = await (prisma as any).studyScheduleItem.findFirst({
    where: {
      userId: user.id,
      status: "PENDING",
      actionType: "THEORY",
      scheduledDate: { gte: todayRange.end },
      subject: {
        studyPriority: { not: "EXCLUDED" }
      }
    },
    include: {
      subject: true,
      studyBlock: {
        include: {
          material: true
        }
      },
      material: true
    },
    orderBy: [
      { scheduledDate: "asc" },
      { dayNumber: "asc" },
      { id: "asc" }
    ]
  });

  // 4. Obter contagem de cards do SRS
  let todayCardsCount = 0;
  try {
    const unifiedData = await getUnifiedTodayCards(user.id);
    todayCardsCount = unifiedData.stats.total;
  } catch (err) {
    console.error(`[CRON] Erro ao carregar SRS para usuário ${user.id}:`, err);
  }

  // 5. Renderizar HTML
  const studentName = user.name || "Estudante";
  const appUrl = process.env.APP_BASE_URL || "https://kehlstudy.com";
  const languageTone = user.preferences?.languageTone || "MASCULINE_NEUTRAL";
  const emailHtml = generateEmailHtml(
    studentName,
    todayRange.label,
    todayTasks,
    todayCardsCount,
    {
      completed: yesterdayCompleted,
      pending: yesterdayPending,
      skipped: yesterdaySkipped,
    },
    yesterdayItems,
    appUrl,
    nextTheoryItem,
    languageTone
  );

  // 6. Enviar e-mail
  let emailSent = false;
  let provider = "none";
  let messageId = "";

  const fromName = process.env.EMAIL_FROM || "Kehl Study <noreply@kehlstudy.com>";

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: fromName,
      to: [targetEmail],
      subject: "Kehl Study — Seus estudos de hoje",
      html: emailHtml,
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }

    emailSent = true;
    provider = "resend";
    messageId = data?.id || "";
  } else if (
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  ) {
    const smtpPort = parseInt(process.env.SMTP_PORT || "587");
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || fromName,
      to: targetEmail,
      subject: "Kehl Study — Seus estudos de hoje",
      html: emailHtml,
    });

    emailSent = true;
    provider = "smtp";
    messageId = info.messageId;
  } else if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
    console.log("=== EMAIL CRON FALLBACK (DEV CONSOLE) ===");
    console.log(`To: ${targetEmail}`);
    console.log(`Subject: Kehl Study — Seus estudos de hoje`);
    console.log("=========================================");
    emailSent = true;
    provider = "console";
    messageId = "dev-console-stub";
  } else {
    throw new Error("Nenhum provedor de e-mail configurado em produção.");
  }

  return {
    success: true,
    emailSent,
    provider,
    messageId,
    recipient: targetEmail,
    tasksCount: todayTasks.length,
    cardsCount: todayCardsCount
  };
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const secret = process.env.CRON_SECRET;
    const manualKey = process.env.MANUAL_TRIGGER_KEY;
    const queryKey = req.nextUrl.searchParams.get("manual_key");
    const userIdParam = req.nextUrl.searchParams.get("userId");

    const isCronSecretValid = secret && authHeader === `Bearer ${secret}`;
    const isManualKeyValid = manualKey && queryKey === manualKey;
    const isSystemCall = isCronSecretValid || isManualKeyValid;

    let sessionUserId: string | null = null;
    let sessionUser: any = null;
    let isAdmin = false;

    // Tentar ler a sessão para chamadas manuais logadas
    try {
      sessionUserId = await getMockUserId();
      if (sessionUserId) {
        sessionUser = await prisma.user.findUnique({
          where: { id: sessionUserId },
          include: { preferences: true },
        });
        if (sessionUser) {
          const adminEmail = process.env.ADMIN_EMAIL || "dev@kehl.study";
          isAdmin = sessionUser.email === adminEmail;
        }
      }
    } catch (err) {
      // Sem sessão ativa - comum para disparos de cron
    }

    // 1. Garantir que a chamada é autorizada (sistema ou sessão ativa)
    if (!isSystemCall && !sessionUser) {
      return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
    }

    let targetUsers: any[] = [];

    // 2. Tratar userIdParam (com restrição de privilégio)
    if (userIdParam) {
      // O userId por query param só é aceito se a chamada for do sistema (Cron/Manual key) ou admin autenticado
      if (!isSystemCall && !isAdmin) {
        return NextResponse.json(
          { error: "Acesso negado: Apenas administradores podem especificar o userId via query param." },
          { status: 403 }
        );
      }

      const specificUser = await prisma.user.findUnique({
        where: { id: userIdParam },
        include: { preferences: true },
      });

      if (!specificUser) {
        return NextResponse.json(
          { error: "Usuário especificado não encontrado." },
          { status: 404 }
        );
      }

      targetUsers = [specificUser];
    } else {
      // 3. Sem userIdParam
      if (isSystemCall) {
        // Disparo geral do sistema: buscar todos com lembrete habilitado
        targetUsers = await prisma.user.findMany({
          where: {
            preferences: {
              emailReminderEnabled: true
            }
          },
          include: { preferences: true },
        });
      } else {
        // Chamada autenticada de usuário comum: processa apenas a si mesmo
        if (sessionUser) {
          targetUsers = [sessionUser];
        }
      }
    }

    if (targetUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Nenhum usuário qualificado para envio de lembrete diário."
      });
    }

    // 4. Executar envios
    const now = new Date();
    const yesterdayRange = getTodayRangeSP(now, -1);
    const todayRange = getTodayRangeSP(now, 0);
    const results = [];

    // Bypass da verificação de horário para acionamento manual (query param, chave ou logado)
    const bypassTimeCheck = isManualKeyValid || (userIdParam !== null) || !isSystemCall;

    for (const user of targetUsers) {
      try {
        const bypassReminderCheck = isManualKeyValid || (userIdParam !== null);
        const emailReminderEnabled = user.preferences?.emailReminderEnabled !== false;
        
        if (!emailReminderEnabled && !bypassReminderCheck) {
          results.push({
            userId: user.id,
            email: user.email,
            success: false,
            skipped: true,
            reason: "Lembrete diário por e-mail desativado nas configurações do usuário."
          });
          continue;
        }

        // Validar fuso horário do lembrete (America/Sao_Paulo)
        const reminderTime = user.preferences?.emailReminderTime || "08:00";
        if (!bypassTimeCheck && !isTimeInGridWindow(reminderTime, now)) {
          continue; // Pula silenciosamente sem computar no resultado ou erro
        }

        const result = await processUserReminder(user, bypassReminderCheck, todayRange, yesterdayRange);
        
        const recipientMasked = result.recipient
          ? result.recipient.replace(/^(.)(.*)(@.*)$/, (_: string, first: string, middle: string, domain: string) => first + "*".repeat(Math.min(middle.length, 10)) + domain)
          : "unknown";

        console.log(JSON.stringify({
          eventType: "daily_reminder",
          provider: result.provider,
          recipientMasked,
          userId: user.id,
          success: result.success && result.emailSent,
          messageId: result.messageId || null,
          errorCode: result.success ? null : "SEND_FAILED",
          timestamp: new Date().toISOString()
        }));

        results.push({
          userId: user.id,
          email: user.email,
          ...result
        });
      } catch (err: any) {
        console.error(`Erro ao processar lembrete para usuário ${user.id}:`, err);
        
        const recipientMasked = user.email
          ? user.email.replace(/^(.)(.*)(@.*)$/, (_: string, first: string, middle: string, domain: string) => first + "*".repeat(Math.min(middle.length, 10)) + domain)
          : "unknown";

        console.log(JSON.stringify({
          eventType: "daily_reminder",
          provider: "none",
          recipientMasked,
          userId: user.id,
          success: false,
          messageId: null,
          errorCode: err.message || "CRITICAL_ERROR",
          timestamp: new Date().toISOString()
        }));

        results.push({
          userId: user.id,
          email: user.email,
          success: false,
          error: err.message || "Erro desconhecido durante o processamento."
        });
      }
    }

    // Filtrar resultados relevantes (os que foram realmente processados ou que falharam)
    const activeResults = results.filter((r) => !r.skipped);
    const failedResults = activeResults.filter((r) => !r.success);
    const sentResults = activeResults.filter((r) => r.success);
    
    if (failedResults.length > 0) {
      return NextResponse.json({
        success: false,
        sent: sentResults.length,
        failed: failedResults.length,
        errors: failedResults.map((f) => ({ userId: f.userId, error: f.error || f.reason })),
        date: todayRange.label,
        totalProcessed: targetUsers.length,
        results
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      sent: sentResults.length,
      failed: 0,
      date: todayRange.label,
      totalProcessed: targetUsers.length,
      results
    });

  } catch (error: any) {
    console.error("Erro crítico na rota do cron de lembrete:", error);
    return NextResponse.json(
      { success: false, error: "Erro crítico no servidor durante a execução do cron." },
      { status: 500 }
    );
  }
}
