const fs = require('fs');
const path = require('path');
const { Resend } = require('resend');

// 1. Carregador simples de arquivo .env (sem dependências externas)
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envLines = fs.readFileSync(envPath, 'utf-8').split('\n');
  envLines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    const key = parts[0].trim();
    let val = parts.slice(1).join('=').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    process.env[key] = val;
  });
}

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.error("Erro: RESEND_API_KEY não encontrada no arquivo .env");
  process.exit(1);
}

const resend = new Resend(apiKey);
const targetEmail = "henrique.j.kehl@icloud.com";
const fromName = process.env.EMAIL_FROM || "Kehl Study <onboarding@resend.dev>";

// 2. Mock dos dados do cronograma para o teste
const mockTodayTasks = [
  { subject: { name: "Direito Constitucional" }, studyBlock: { title: "Aplicabilidade das Normas Constitucionais" }, estimatedMinutes: 45 },
  { subject: { name: "Português" }, studyBlock: { title: "Acentuação Gráfica e Ortografia" }, estimatedMinutes: 30 }
];

const mockYesterdayItems = [
  { subject: { name: "Direito do Trabalho" }, studyBlock: { title: "Princípios do Direito do Trabalho" }, status: "COMPLETED" },
  { subject: { name: "Processual Civil" }, studyBlock: { title: "Petência Inicial (PDF 0)" }, status: "PENDING" }
];

const mockYesterdayStats = {
  completed: 1,
  pending: 1,
  skipped: 0
};

const todayLabel = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

// 3. Gerador do HTML idêntico ao da aplicação
function generateEmailHtml() {
  const yesterdayCompletedList = mockYesterdayItems.filter(i => i.status === "COMPLETED");
  const yesterdayPendingList = mockYesterdayItems.filter(i => i.status !== "COMPLETED" && i.status !== "SKIPPED");

  const tasksHtml = mockTodayTasks.map(t => `
    <li style="margin-bottom: 8px; font-size: 15px; color: #2d3748; list-style-type: none; padding-left: 0;">
      <span style="color: #869774; font-weight: bold; margin-right: 6px;">•</span>
      <strong>${t.subject.name}:</strong> ${t.studyBlock.title}
      <span style="font-size: 12px; color: #718096; margin-left: 6px;">(${t.estimatedMinutes} min)</span>
    </li>
  `).join("");

  const yesterdayCompletedHtml = yesterdayCompletedList.map(t => `
    <li style="margin-bottom: 6px; font-size: 14px; color: #2f855a; list-style-type: none; padding-left: 0;">
      <span style="margin-right: 6px; font-weight: bold;">✓</span>
      <strong>${t.subject.name}:</strong> ${t.studyBlock.title}
    </li>
  `).join("");

  const yesterdayPendingHtml = yesterdayPendingList.map(t => `
    <li style="margin-bottom: 6px; font-size: 14px; color: #c53030; list-style-type: none; padding-left: 0;">
      <span style="margin-right: 6px; font-weight: bold;">⚠</span>
      <strong>${t.subject.name}:</strong> ${t.studyBlock.title} (Movido para hoje)
    </li>
  `).join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Seu roteiro de estudos de hoje</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8f9fa; padding: 20px 0;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
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
                Bom dia, <strong>Henrique (Teste)</strong>! ☀️
              </p>
              <p style="font-size: 15px; color: #4a5568; line-height: 1.6; margin-bottom: 25px;">
                Este é um e-mail de teste para validar a sua integração com o **Resend** e o visual do template **Soft Premium**:
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
                      Você tem <strong>12</strong> flashcards disponíveis para praticar hoje.
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
                      Metas concluídas: <strong>${mockYesterdayStats.completed}</strong> | Pendentes: <strong>${mockYesterdayStats.pending}</strong>
                    </p>
                    
                    <!-- Concluídos ontem -->
                    <ul style="margin: 0 0 10px 0; padding: 0;">
                      ${yesterdayCompletedHtml}
                    </ul>
                    
                    <!-- Pendências movidas -->
                    ${yesterdayPendingHtml ? `
                      <div style="border-top: 1px dashed #feebc8; margin-top: 12px; padding-top: 12px;">
                        <span style="font-size: 12px; font-weight: bold; color: #dd6b20; text-transform: uppercase; display: block; margin-bottom: 8px;">Pendências movidas para hoje:</span>
                        <ul style="margin: 0; padding: 0;">
                          ${yesterdayPendingHtml}
                        </ul>
                      </div>
                    ` : ""}
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="text-align: center; margin-top: 30px; margin-bottom: 20px;">
                <tr>
                  <td>
                    <a href="https://kehlstudy.com" style="background-color: #869774; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; display: inline-block;">
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

// 4. Executa o disparo do e-mail
console.log("Iniciando disparo do e-mail de teste...");
console.log(`De: ${fromName}`);
console.log(`Para: ${targetEmail}`);

resend.emails.send({
  from: fromName,
  to: [targetEmail],
  subject: "Kehl Study — Roteiro de Teste do Modelo",
  html: generateEmailHtml()
}).then(response => {
  if (response.error) {
    console.error("Erro no envio do Resend:", response.error.message);
  } else {
    console.log("Sucesso absoluto! E-mail enviado com ID:", response.data.id);
  }
}).catch(err => {
  console.error("Erro fatal ao enviar e-mail:", err.message);
});
