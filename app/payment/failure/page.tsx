import { Suspense } from "react";
import PaymentResultPage from "@/components/PaymentResultPage";

function PaymentFailureContent() {
  return <PaymentResultPage type="failure" />;
}

export default function PaymentFailurePage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <PaymentFailureContent />
    </Suspense>
  );
}
