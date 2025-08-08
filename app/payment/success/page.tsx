import { Suspense } from "react";
import PaymentResultPage from "@/components/PaymentResultPage";

function PaymentSuccessContent() {
  return <PaymentResultPage type="success" />;
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
