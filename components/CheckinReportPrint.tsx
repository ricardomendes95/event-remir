import React from "react";
import dayjs from "dayjs";

interface ExportData {
  event: {
    id: string;
    title: string;
    description?: string;
    price: number;
    startDate: string;
    endDate?: string;
    location?: string;
  };
  registrations: Array<{
    id: string;
    name: string;
    email: string;
    cpf: string;
    phone: string;
    status: string;
    checkedInAt?: string;
    createdAt: string;
    paymentMethod?: string;
    paymentStatus?: string;
  }>;
  stats: {
    total: number;
    checkedIn: number;
    pending: number;
    totalRevenue: number;
    checkinRate: number;
  };
  exportedAt: string;
}

interface CheckinReportPrintProps {
  data: ExportData;
}

const CheckinReportPrint: React.FC<CheckinReportPrintProps> = ({ data }) => {
  return (
    <div
      className="print-container"
      style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}
    >
      {/* Cabeçalho */}
      <div
        style={{
          textAlign: "center",
          marginBottom: "30px",
          borderBottom: "2px solid #000",
          paddingBottom: "20px",
        }}
      >
        <h1 style={{ fontSize: "24px", margin: "0 0 10px 0" }}>
          RELATÓRIO DE CHECK-IN
        </h1>
        <h2 style={{ fontSize: "18px", margin: "0", color: "#666" }}>
          {data.event.title}
        </h2>
        {data.event.location && (
          <p style={{ fontSize: "14px", margin: "5px 0 0 0", color: "#666" }}>
            Local: {data.event.location}
          </p>
        )}
        <p style={{ fontSize: "14px", margin: "5px 0 0 0", color: "#666" }}>
          Data do Evento:{" "}
          {dayjs(data.event.startDate).format("DD/MM/YYYY HH:mm")}
          {data.event.endDate &&
            ` - ${dayjs(data.event.endDate).format("DD/MM/YYYY HH:mm")}`}
        </p>
        <p style={{ fontSize: "12px", margin: "10px 0 0 0", color: "#999" }}>
          Relatório gerado em:{" "}
          {dayjs(data.exportedAt).format("DD/MM/YYYY HH:mm")}
        </p>
      </div>

      {/* Estatísticas */}
      <div
        style={{
          marginBottom: "30px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "15px",
        }}
      >
        <div
          style={{
            border: "1px solid #ddd",
            padding: "15px",
            textAlign: "center",
            borderRadius: "5px",
          }}
        >
          <h3
            style={{ margin: "0 0 10px 0", fontSize: "16px", color: "#1890ff" }}
          >
            Total Confirmados
          </h3>
          <p style={{ fontSize: "24px", fontWeight: "bold", margin: "0" }}>
            {data.stats.total}
          </p>
        </div>
        <div
          style={{
            border: "1px solid #ddd",
            padding: "15px",
            textAlign: "center",
            borderRadius: "5px",
          }}
        >
          <h3
            style={{ margin: "0 0 10px 0", fontSize: "16px", color: "#52c41a" }}
          >
            Check-ins Realizados
          </h3>
          <p style={{ fontSize: "24px", fontWeight: "bold", margin: "0" }}>
            {data.stats.checkedIn}
          </p>
        </div>
        <div
          style={{
            border: "1px solid #ddd",
            padding: "15px",
            textAlign: "center",
            borderRadius: "5px",
          }}
        >
          <h3
            style={{ margin: "0 0 10px 0", fontSize: "16px", color: "#faad14" }}
          >
            Aguardando Check-in
          </h3>
          <p style={{ fontSize: "24px", fontWeight: "bold", margin: "0" }}>
            {data.stats.pending}
          </p>
        </div>
        <div
          style={{
            border: "1px solid #ddd",
            padding: "15px",
            textAlign: "center",
            borderRadius: "5px",
          }}
        >
          <h3
            style={{ margin: "0 0 10px 0", fontSize: "16px", color: "#722ed1" }}
          >
            Taxa de Presença
          </h3>
          <p style={{ fontSize: "24px", fontWeight: "bold", margin: "0" }}>
            {data.stats.checkinRate}%
          </p>
        </div>
      </div>

      {/* Lista de Participantes */}
      <div style={{ marginBottom: "20px" }}>
        <h3
          style={{
            fontSize: "18px",
            marginBottom: "15px",
            borderBottom: "1px solid #ddd",
            paddingBottom: "10px",
          }}
        >
          Lista de Participantes ({data.registrations.length})
        </h3>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "12px",
          }}
        >
          <thead>
            <tr style={{ backgroundColor: "#f5f5f5" }}>
              <th
                style={{
                  border: "1px solid #ddd",
                  padding: "8px",
                  textAlign: "left",
                }}
              >
                #
              </th>
              <th
                style={{
                  border: "1px solid #ddd",
                  padding: "8px",
                  textAlign: "left",
                }}
              >
                Nome
              </th>
              <th
                style={{
                  border: "1px solid #ddd",
                  padding: "8px",
                  textAlign: "left",
                }}
              >
                Email
              </th>
              <th
                style={{
                  border: "1px solid #ddd",
                  padding: "8px",
                  textAlign: "left",
                }}
              >
                CPF
              </th>
              <th
                style={{
                  border: "1px solid #ddd",
                  padding: "8px",
                  textAlign: "left",
                }}
              >
                Telefone
              </th>
              <th
                style={{
                  border: "1px solid #ddd",
                  padding: "8px",
                  textAlign: "center",
                }}
              >
                Status Check-in
              </th>
              <th
                style={{
                  border: "1px solid #ddd",
                  padding: "8px",
                  textAlign: "center",
                }}
              >
                Data Check-in
              </th>
              <th
                style={{
                  border: "1px solid #ddd",
                  padding: "8px",
                  textAlign: "center",
                }}
              >
                Assinatura
              </th>
            </tr>
          </thead>
          <tbody>
            {data.registrations.map((registration, index) => (
              <tr
                key={registration.id}
                style={{
                  backgroundColor: registration.checkedInAt
                    ? "#f6ffed"
                    : "#fff",
                }}
              >
                <td
                  style={{
                    border: "1px solid #ddd",
                    padding: "8px",
                    textAlign: "center",
                  }}
                >
                  {index + 1}
                </td>
                <td
                  style={{
                    border: "1px solid #ddd",
                    padding: "8px",
                    fontWeight: "500",
                  }}
                >
                  {registration.name}
                </td>
                <td style={{ border: "1px solid #ddd", padding: "8px" }}>
                  {registration.email}
                </td>
                <td style={{ border: "1px solid #ddd", padding: "8px" }}>
                  {registration.cpf.replace(
                    /(\d{3})(\d{3})(\d{3})(\d{2})/,
                    "$1.$2.$3-$4"
                  )}
                </td>
                <td style={{ border: "1px solid #ddd", padding: "8px" }}>
                  {registration.phone || "-"}
                </td>
                <td
                  style={{
                    border: "1px solid #ddd",
                    padding: "8px",
                    textAlign: "center",
                  }}
                >
                  {registration.checkedInAt ? (
                    <span style={{ color: "#52c41a", fontWeight: "bold" }}>
                      ✓ PRESENTE
                    </span>
                  ) : (
                    <span style={{ color: "#faad14" }}>⏱ AGUARDANDO</span>
                  )}
                </td>
                <td
                  style={{
                    border: "1px solid #ddd",
                    padding: "8px",
                    textAlign: "center",
                  }}
                >
                  {registration.checkedInAt
                    ? dayjs(registration.checkedInAt).format("DD/MM HH:mm")
                    : "-"}
                </td>
                <td
                  style={{
                    border: "1px solid #ddd",
                    padding: "8px",
                    height: "30px",
                  }}
                >
                  {/* Espaço para assinatura manual */}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Resumo Final */}
      <div
        style={{
          marginTop: "30px",
          borderTop: "2px solid #000",
          paddingTop: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <p style={{ fontSize: "12px", margin: "0", color: "#666" }}>
              Total de páginas: {Math.ceil(data.registrations.length / 30) || 1}
            </p>
            <p style={{ fontSize: "12px", margin: "5px 0 0 0", color: "#666" }}>
              Receita Total: R${" "}
              {data.stats.totalRevenue.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: "12px", margin: "0", color: "#666" }}>
              ________________________________
            </p>
            <p style={{ fontSize: "12px", margin: "5px 0 0 0", color: "#666" }}>
              Responsável pelo Evento
            </p>
          </div>
        </div>
      </div>

      {/* Estilos de impressão */}
      <style jsx>{`
        @media print {
          .print-container {
            margin: 0;
            padding: 20px;
          }

          table {
            page-break-inside: avoid;
          }

          tr {
            page-break-inside: avoid;
          }

          thead {
            display: table-header-group;
          }
        }
      `}</style>
    </div>
  );
};

export default CheckinReportPrint;
