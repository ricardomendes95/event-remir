import { Suspense } from "react";
import PaymentResultPage from "@/components/PaymentResultPage";

function PaymentPendingContent() {
  return <PaymentResultPage type="pending" />;
}

export default function PaymentPendingPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <PaymentPendingContent />
    </Suspense>
  );
}
