import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reorganizeActiveSchedule } from "@/lib/scheduler";
import { getUnifiedTodayCards } from "@/lib/srs/srs-utils";
import { Resend } from "resend";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

// Helper para calcular o intervalo de um dia no fuso horário America/Sao_Paulo (UTC-3)
function getDayRangeInSP(date: Date, offsetDays = 0) {
  // Formatando a data do servidor para o fuso de São Paulo
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = fmt.formatToParts(date);
  const partMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  const year = parseInt(partMap.year);
  const month = parseInt(partMap.month) - 1; // 0-indexed
  const day = parseInt(partMap.day);

  // Como São Paulo é UTC-3 (sem horário de verão atualmente),
  // 00:00 em São Paulo corresponde a 03:00 UTC.
  // Criamos o objeto de data em UTC representando 03:00 daquele dia calendarar
  const start = new Date(Date.UTC(year, month, day, 3));
  start.setUTCDate(start.getUTCDate() + offsetDays);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  // String legível no padrão brasileiro
  const formattedDay = start.getUTCDate().toString().padStart(2, "0");
  const formattedMonth = (start.getUTCMonth() + 1).toString().padStart(2, "0");
  const formattedYear = start.getUTCFullYear();
  const label = `${formattedDay}/${formattedMonth}/${formattedYear}`;

  return { start, end, label };
}

// Template HTML Premium do e-mail
function generateEmailHtml(
  studentName: string,
  todayLabel: string,
  todayTasks: any[],
  todayCardsCount: number,
  yesterdayStats: { completed: number; pending: number; skipped: number },
  yesterdayItems: any[],
  appUrl: string
) {
  const yesterdayCompletedList = yesterdayItems.filter((i: any) => i.status === "COMPLETED");
  const yesterdayPendingList = yesterdayItems.filter(
    (i: any) => i.status !== "COMPLETED" && i.status !== "SKIPPED"
  );

  const tasksHtml =
    todayTasks.length > 0
      ? todayTasks
          .map(
            (t) => `
        <li style="margin-bottom: 8px; font-size: 15px; color: #2d3748; list-style-type: none; padding-left: 0;">
          <span style="color: #869774; font-weight: bold; margin-right: 6px;">•</span>
          <strong>${t.subject?.name || "Matéria"}:</strong> ${t.studyBlock?.title || "Bloco de Estudo"}
          <span style="font-size: 12px; color: #718096; margin-left: 6px;">(${t.estimatedMinutes || 60} min)</span>
        </li>
      `
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
          <strong>${t.subject?.name || "Matéria"}:</strong> ${t.studyBlock?.title || "Bloco de Estudo"} (Movido para hoje)
        </li>
      `
          )
          .join("")
      : "";

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
                Seu planejamento diário de estudos está pronto. Confira abaixo as suas metas de hoje e o resumo de ontem:
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
                        <span style="font-size: 12px; font-weight: bold; color: #dd6b20; text-transform: uppercase; display: block; margin-bottom: 8px;">Pendências movidas para hoje:</span>
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

export async function GET(req: NextRequest) {
  try {
    // 1. Validação de Segurança (CRON_SECRET ou manual trigger key)
    const authHeader = req.headers.get("authorization");
    const secret = process.env.CRON_SECRET;
    const manualKey = process.env.MANUAL_TRIGGER_KEY;
    const queryKey = req.nextUrl.searchParams.get("manual_key");

    // Permite bypass via query param seguro (para envio manual pontual)
    const isManualTrigger = manualKey && queryKey === manualKey;

    if (!isManualTrigger) {
      if (process.env.NODE_ENV !== "development") {
        if (!secret || authHeader !== `Bearer ${secret}`) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
      } else {
        if (secret && authHeader !== `Bearer ${secret}`) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
      }
    }

    // 2. Localizar usuário destinatário
    let user = await prisma.user.findFirst();

    if (!user) {
      return NextResponse.json({ error: "Nenhum usuário encontrado no banco de dados." }, { status: 404 });
    }

    // Se o lembrete estiver desativado e NÃO for um disparo de teste manual, abortar o envio
    if (!user.emailReminderEnabled && !isManualTrigger) {
      return NextResponse.json({ 
        success: false, 
        skipped: true, 
        reason: "Envio cancelado: lembrete diário por e-mail desativado nas configurações do usuário." 
      });
    }

    const targetEmail = user.dailyReminderEmail || "gabriela.furtado.p@gmail.com";

    // 3. Obter datas em America/Sao_Paulo (Ontem e Hoje)
    const now = new Date();
    const yesterdayRange = getDayRangeInSP(now, -1);
    const todayRange = getDayRangeInSP(now, 0);

    // 4. Coletar tarefas de ontem antes da reorganização
    const yesterdayItems = await (prisma as any).studyScheduleItem.findMany({
      where: {
        userId: user.id,
        schedule: { status: "ACTIVE" },
        scheduledDate: { gte: yesterdayRange.start, lt: yesterdayRange.end },
      },
      include: {
        subject: true,
        studyBlock: true,
      },
    });

    const yesterdayCompleted = yesterdayItems.filter((i: any) => i.status === "COMPLETED").length;
    const yesterdayPending = yesterdayItems.filter(
      (i: any) => i.status !== "COMPLETED" && i.status !== "SKIPPED"
    ).length;
    const yesterdaySkipped = yesterdayItems.filter((i: any) => i.status === "SKIPPED").length;

    // 5. Aplicar reorganização ativa leve (carry-over das pendências passadas)
    await reorganizeActiveSchedule(user.id, 30);

    // 6. Buscar tarefas de hoje atualizadas após carry-over
    const todayItems = await (prisma as any).studyScheduleItem.findMany({
      where: {
        userId: user.id,
        schedule: { status: "ACTIVE" },
        scheduledDate: { gte: todayRange.start, lt: todayRange.end },
      },
      include: {
        subject: true,
        studyBlock: true,
      },
    });

    // Filtra tarefas teóricas ou de exercícios (exclui REVIEW_FLASHCARDS que tem exibição própria)
    const todayTasks = todayItems.filter(
      (i: any) => i.actionType !== "REVIEW_FLASHCARDS" && i.actionType !== "PRACTICE_CARDS"
    );

    // 7. Obter contagem de cards SRS para hoje
    let todayCardsCount = 0;
    try {
      const unifiedData = await getUnifiedTodayCards(user.id);
      todayCardsCount = unifiedData.stats.total;
    } catch (err) {
      console.error("Erro ao carregar métricas do SRS:", err);
    }

    // 8. Renderizar HTML do e-mail
    const studentName = user.name || "Gabriela";
    const appUrl = process.env.APP_BASE_URL || "https://kehlstudy.com";
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
      appUrl
    );

    // 9. Envio por Resend (Principal) ou Nodemailer (Fallback)
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
    } else if (process.env.NODE_ENV === "development") {
      console.log("=== EMAIL CRON FALLBACK (DEV CONSOLE) ===");
      console.log(`To: ${targetEmail}`);
      console.log(`Subject: Kehl Study — Seus estudos de hoje`);
      console.log("HTML Content preview: (Ver HTML gerado)");
      console.log("=========================================");
      emailSent = true;
      provider = "console";
      messageId = "dev-console-stub";
    } else {
      return NextResponse.json(
        { error: "Nenhum provedor de e-mail configurado em produção." },
        { status: 500 }
      );
    }

    // 10. Retornar resposta de sucesso
    return NextResponse.json({
      success: true,
      emailSent,
      provider,
      messageId,
      recipient: targetEmail,
      date: todayRange.label,
      yesterday: {
        completed: yesterdayCompleted,
        pending: yesterdayPending,
      },
      today: {
        tasksCount: todayTasks.length,
        cardsCount: todayCardsCount,
      },
    });
  } catch (error: any) {
    console.error("Erro na rota de Cron de Lembrete Diário:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
