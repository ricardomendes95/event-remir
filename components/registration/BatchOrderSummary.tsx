"use client";

import { ShirtPhoto } from "@/components/registration/ShirtPhoto";
import { INFINITEPAY_PAYMENT_HINT } from "@/backend/utils/paymentFees";

export interface BatchOrderPerson {
  key: string;
  name: string;
  isResponsible: boolean;
  wantsShirt: boolean;
  shirtSize: string | null;
  error?: string | null;
}

interface BatchOrderSummaryProps {
  people: BatchOrderPerson[];
  shirtConfig: {
    priceWithShirt: number;
    sizes: string[];
    imageUrl?: string;
  } | null;
  basePrice: number;
  batchName?: string | null;
  formatCurrency: (value: number) => string;
  onShirtChange: (key: string, wantsShirt: boolean, size: string | null) => void;
}

/**
 * Etapa de pagamento de uma compra em grupo: uma linha por pessoa (com a
 * escolha de camisa, quando o evento oferece) e o total do pedido.
 */
export function BatchOrderSummary({
  people,
  shirtConfig,
  basePrice,
  batchName,
  formatCurrency,
  onShirtChange,
}: BatchOrderSummaryProps) {
  const priceOf = (p: BatchOrderPerson) =>
    shirtConfig && p.wantsShirt ? shirtConfig.priceWithShirt : basePrice;
  const total = people.reduce((sum, p) => sum + priceOf(p), 0);

  return (
    <div data-testid="batch-summary">
      <h3 className="text-lg font-medium mb-1">
        Compra para {people.length} pessoas
      </h3>
      <p className="text-gray-600 mb-4 text-sm">
        {shirtConfig
          ? "Escolha a camisa de cada pessoa. Você vê o total antes de pagar."
          : "Confira as pessoas e o total antes de pagar."}
      </p>

      {shirtConfig?.imageUrl && (
        <div className="mb-4">
          <ShirtPhoto src={shirtConfig.imageUrl} size="md" />
        </div>
      )}

      <ul className="space-y-3 mb-4">
        {people.map((p, i) => (
          <li
            key={p.key}
            className={`border-2 rounded-lg p-3 ${
              p.error ? "border-red-400" : "border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-gray-500">
                  Pessoa {i + 1}
                  {p.isResponsible && " · Responsável pela compra"}
                </p>
                <p className="font-medium truncate">{p.name}</p>
              </div>
              <span className="font-bold text-blue-700 flex-shrink-0">
                {formatCurrency(priceOf(p))}
              </span>
            </div>

            {shirtConfig && (
              <div className="mt-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onShirtChange(p.key, false, null)}
                    style={{ minHeight: "48px" }}
                    className={`rounded-lg border-2 px-2 py-2 text-sm font-medium transition ${
                      !p.wantsShirt
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    Sem camisa
                    <span className="block text-xs font-normal text-gray-600">
                      {formatCurrency(basePrice)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onShirtChange(p.key, true, p.shirtSize)}
                    style={{ minHeight: "48px" }}
                    className={`rounded-lg border-2 px-2 py-2 text-sm font-medium transition ${
                      p.wantsShirt
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    Com camisa
                    <span className="block text-xs font-normal text-gray-600">
                      {formatCurrency(shirtConfig.priceWithShirt)}
                    </span>
                  </button>
                </div>

                {p.wantsShirt && (
                  <div className="mt-3">
                    <p className="text-sm font-medium mb-2">Tamanho</p>
                    <div className="flex flex-wrap gap-2">
                      {shirtConfig.sizes.map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => onShirtChange(p.key, true, size)}
                          style={{ minWidth: "56px", minHeight: "48px" }}
                          className={`px-4 py-2 rounded-lg border-2 font-semibold transition ${
                            p.shirtSize === size
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-gray-300 bg-white text-gray-700"
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {p.error && <p className="text-red-600 text-sm mt-2">{p.error}</p>}
          </li>
        ))}
      </ul>

      <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-800">
            Total do pedido
            <span className="block text-sm font-normal text-gray-600">
              {people.length} inscrições
              {batchName ? ` · ${batchName}` : ""}
            </span>
          </span>
          <span
            className="text-2xl font-extrabold text-blue-700"
            data-testid="batch-total"
          >
            {formatCurrency(total)}
          </span>
        </div>
        <p className="text-sm text-gray-600 mt-2">{INFINITEPAY_PAYMENT_HINT}</p>
      </div>
    </div>
  );
}

/** Total do pedido em grupo (mesma regra do resumo, para o rótulo do botão). */
export function batchTotal(
  people: Pick<BatchOrderPerson, "wantsShirt">[],
  basePrice: number,
  shirtPrice: number | null,
): number {
  return people.reduce(
    (sum, p) => sum + (shirtPrice !== null && p.wantsShirt ? shirtPrice : basePrice),
    0,
  );
}
