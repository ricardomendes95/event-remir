/**
 * Documento de comprovante de inscrição para impressão (HTML autônomo).
 * Fonte única: usado pelo comprovante público (RegistrationProofModal) e pela
 * ação "Imprimir comprovante" do admin, para que sejam idênticos (RFC req. 9,
 * decisão Q12: o comprovante é o documento público, inclusive com o valor).
 */
export interface ProofPrintData {
  id: string;
  name: string;
  email: string | null;
  cpf: string;
  phone: string | null;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "PAYMENT_FAILED";
  paymentId: string;
  registrationDate: string;
  /** Valor efetivamente pago pela inscrição (com camisa, se escolhida). */
  amountPaid?: number;
  wantsShirt?: boolean;
  shirtSize?: string | null;
  /** Indica se o evento oferece camisa (para exibir a linha no comprovante). */
  eventHasShirt?: boolean;
  event: {
    title: string;
    price: number;
    date: string;
    location: string;
  };
}

export function formatProofCPF(value: string) {
  const cpf = value.replace(/\D/g, "");
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

// Valor efetivamente pago (com camisa, se escolhida). Cai para o preço do
// evento caso a inscrição seja antiga e não tenha o valor calculado.
export function getProofAmountPaid(r: ProofPrintData) {
  return typeof r.amountPaid === "number" ? r.amountPaid : r.event.price;
}

// Texto da camisa para o comprovante.
export function getProofShirtText(r: ProofPrintData) {
  return r.wantsShirt ? `Sim — Tamanho ${r.shirtSize ?? "—"}` : "Não";
}

const STATUS_PRINT: Record<string, { color: string; text: string }> = {
  CONFIRMED: { color: "green", text: "Confirmado" },
  PENDING: { color: "orange", text: "Pendente" },
  CANCELLED: { color: "red", text: "Cancelado" },
  PAYMENT_FAILED: { color: "red", text: "Falha no Pagamento" },
};

export function buildProofPrintHtml(
  r: ProofPrintData,
  qrCodeDataUrl: string
): string {
  const statusConfig = STATUS_PRINT[r.status] ?? {
    color: "default",
    text: r.status,
  };
  const formatCPF = formatProofCPF;
  const getAmountPaid = getProofAmountPaid;
  const getShirtText = getProofShirtText;

  return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Comprovante de Inscrição</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .header { text-align: center; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: bold; color: #1f2937; }
            .subtitle { font-size: 16px; color: #6b7280; margin-top: 5px; }
            .content { max-width: 600px; margin: 0 auto; }
            .section { margin-bottom: 20px; }
            .section-title { font-size: 18px; font-weight: bold; color: #374151; margin-bottom: 10px; }
            .info-row { margin-bottom: 8px; }
            .label { font-weight: bold; color: #4b5563; }
            .value { color: #1f2937; }
            .status { 
              display: inline-block; 
              padding: 4px 12px; 
              border-radius: 4px; 
              font-weight: bold;
              background-color: ${
                statusConfig.color === "green"
                  ? "#10b981"
                  : statusConfig.color === "orange"
                  ? "#f59e0b"
                  : "#ef4444"
              };
              color: white;
            }
            .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Comprovante de Inscrição</div>
            <div class="subtitle">Event Remir</div>
          </div>
          
          <div class="content">
            <div class="section">
              <div class="section-title">Dados do Evento</div>
              <div class="info-row"><span class="label">Evento:</span> <span class="value">${
                r.event.title
              }</span></div>
              <div class="info-row"><span class="label">Data:</span> <span class="value">${new Date(
                r.event.date
              ).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}</span></div>
              <div class="info-row"><span class="label">Local:</span> <span class="value">${
                r.event.location
              }</span></div>
              <div class="info-row"><span class="label">Valor pago:</span> <span class="value">${getAmountPaid(
                r
              ).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></div>
              ${
                r.eventHasShirt
                  ? `<div class="info-row"><span class="label">Camisa:</span> <span class="value">${getShirtText(
                      r
                    )}</span></div>`
                  : ""
              }
            </div>

            <div class="section">
              <div class="section-title">Dados do Participante</div>
              <div class="info-row"><span class="label">Nome:</span> <span class="value">${r.name}</span></div>
              ${r.email ? `<div class="info-row"><span class="label">E-mail:</span> <span class="value">${r.email}</span></div>` : ""}
              <div class="info-row"><span class="label">CPF:</span> <span class="value">${formatCPF(r.cpf)}</span></div>
              ${r.phone ? `<div class="info-row"><span class="label">Telefone:</span> <span class="value">${r.phone}</span></div>` : ""}
            </div>

            <div class="section">
              <div class="section-title">Dados da Inscrição</div>
              <div class="info-row">
                <span class="label">ID da Inscrição:</span> 
                <span class="value">${r.id}</span>
              </div>
              ${
                qrCodeDataUrl
                  ? `
              <div class="info-row" style="text-align: center; margin: 20px 0;">
                <div style="display: inline-block;">
                  <img src="${qrCodeDataUrl}" alt="QR Code do ID da Inscrição" style="border: 1px solid #ddd; border-radius: 4px;" />
                  <div style="font-size: 10px; color: #666; margin-top: 5px;">QR Code para Check-in</div>
                </div>
              </div>
              `
                  : ""
              }
              <div class="info-row"><span class="label">Status:</span> <span class="status">${
                statusConfig.text
              }</span></div>
              <div class="info-row"><span class="label">Data da Inscrição:</span> <span class="value">${new Date(
                r.registrationDate
              ).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}</span></div>
              <div class="info-row"><span class="label">ID do Pagamento:</span> <span class="value">${
                r.paymentId
              }</span></div>
            </div>
          </div>

          <div class="footer">
            <p>Comprovante gerado em ${new Date().toLocaleDateString(
              "pt-BR"
            )} às ${new Date().toLocaleTimeString("pt-BR")}</p>
            <p>Event Remir - Sistema de Gestão de Eventos</p>
          </div>
        </body>
      </html>
    `;
}

/** Abre a janela de impressão do comprovante. */
export function openProofPrintWindow(
  r: ProofPrintData,
  qrCodeDataUrl: string,
  /** Janela já aberta no clique (evita bloqueio de pop-up após um fetch) */
  target?: Window | null
): boolean {
  const printWindow = target ?? window.open("", "_blank");
  if (!printWindow) return false;
  printWindow.document.write(buildProofPrintHtml(r, qrCodeDataUrl));
  printWindow.document.close();
  printWindow.print();
  return true;
}
