import { NextRequest } from "next/server";
import { BaseController } from "@/backend/controllers/BaseController";
import { eventRepository } from "@/backend/repositories";
import { PaymentFeeCalculator } from "@/backend/utils/paymentFeeCalculator";
import { PaymentConfig } from "@/backend/schemas/eventSchemas";
import { z } from "zod";

// Schema para validação do body
const validatePaymentSchema = z.object({
  method: z.enum(["pix", "credit_card", "debit_card"]),
  installments: z.number().min(1).max(12).optional(),
});

class PaymentMethodsController extends BaseController {
  /**
   * GET /api/events/:id/payment-methods
   * Retorna os métodos de pagamento disponíveis para um evento específico
   */
  async getPaymentMethods(request: NextRequest, eventId: string) {
    try {
      // Buscar evento
      const eventData = await eventRepository.findById(eventId);
      if (!eventData) {
        return this.notFound("Evento não encontrado");
      }

      // Type assertion para incluir paymentConfig
      const event = eventData as typeof eventData & {
        paymentConfig?: PaymentConfig | null;
      };

      // Verificar se evento está ativo
      const now = new Date();
      if (!event.isActive || now > event.registrationEndDate) {
        return this.badRequest("Este evento não está aceitando inscrições");
      }

      // Calcular opções de pagamento disponíveis
      const paymentOptions = PaymentFeeCalculator.calculatePaymentOptions(
        event.price,
        event.paymentConfig || undefined
      );

      return this.success(paymentOptions);
    } catch (error) {
      console.error("Controller Error:", error);
      return this.handleError(error);
    }
  }

  /**
   * POST /api/events/:id/payment-methods
   * Valida um método de pagamento específico
   */
  async validatePaymentMethod(request: NextRequest, eventId: string) {
    try {
      const body = await request.json();
      const { method, installments } = validatePaymentSchema.parse(body);

      // Buscar evento
      const eventData = await eventRepository.findById(eventId);
      if (!eventData) {
        return this.notFound("Evento não encontrado");
      }

      // Type assertion para incluir paymentConfig
      const event = eventData as typeof eventData & {
        paymentConfig?: PaymentConfig | null;
      };

      // Verificar se evento está ativo
      const now = new Date();
      if (!event.isActive || now > event.registrationEndDate) {
        return this.badRequest("Este evento não está aceitando inscrições");
      }

      // Validar método de pagamento
      const paymentConfig = event.paymentConfig;
      const isValid = PaymentFeeCalculator.validatePaymentOption(
        method,
        installments,
        paymentConfig || undefined
      );

      if (!isValid) {
        return this.badRequest(
          "Método de pagamento não disponível para este evento"
        );
      }

      // Calcular valor final
      const paymentOptions = PaymentFeeCalculator.calculatePaymentOptions(
        event.price,
        paymentConfig || undefined
      );

      const selectedOption = paymentOptions.available_methods.find(
        (option) =>
          option.method === method &&
          (method !== "credit_card" || option.installments === installments)
      );

      if (!selectedOption) {
        return this.badRequest("Opção de pagamento não encontrada");
      }

      return this.success({
        valid: true,
        method,
        installments: installments || 1,
        finalValue: selectedOption.final_value,
        description: selectedOption.description,
      });
    } catch (error) {
      console.error("Controller Error:", error);
      return this.handleError(error);
    }
  }
}

const controller = new PaymentMethodsController();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return controller.getPaymentMethods(request, id);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return controller.validatePaymentMethod(request, id);
}
