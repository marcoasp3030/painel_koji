/** Cartão que acompanha o anexo sozinho: GET a cada 2 s, por no máximo 30 s. */
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CartaoDocumentoConversa } from "@/components/luxtia/documentos/CartaoDocumentoConversa";
import { anexoDoSimulador } from "@/lib/gateway-simular.functions";
import { INTERVALO_CONSULTA_ANEXO_MS, consultaDoAnexoDeveParar } from "@/lib/gateway/documentos";

export function CartaoDocumentoSimulado({
  empresa,
  nome,
  tipo,
  formato,
  estado,
  id,
}: {
  empresa: string | null;
  nome: string;
  tipo: string | null;
  formato: string | null;
  estado: string;
  id: string | null;
}) {
  const consultar = useServerFn(anexoDoSimulador);
  const consultarRef = useRef(consultar);
  consultarRef.current = consultar;
  const nomeRef = useRef(nome);
  nomeRef.current = nome;
  const [lido, setLido] = useState<{
    nome: string;
    tipo: string | null;
    formato: string | null;
    estado: string;
  } | null>(null);
  const [demorou, setDemorou] = useState(false);

  useEffect(() => {
    setLido(null);
    setDemorou(false);
  }, [id]);

  useEffect(() => {
    if (estado === "processando") return;
    setLido({ nome, tipo, formato, estado });
    setDemorou(false);
  }, [estado, nome, tipo, formato]);

  useEffect(() => {
    if (!id || estado !== "processando") return;
    const inicio = Date.now();
    let cancelado = false;
    const timer = window.setInterval(() => {
      if (consultaDoAnexoDeveParar(inicio, Date.now(), "processando")) {
        if (!cancelado) setDemorou(true);
        window.clearInterval(timer);
        return;
      }
      void consultarRef
        .current({ data: { empresa, anexo: id } })
        .then((doc) => {
          if (cancelado) return;
          setLido({
            nome: doc.nome || nomeRef.current,
            tipo: doc.tipo_documento,
            formato: doc.formato,
            estado: doc.estado,
          });
          if (doc.estado !== "processando") window.clearInterval(timer);
        })
        .catch(() => {
          // A consulta seguinte, ainda dentro dos 30 s, tenta de novo.
        });
    }, INTERVALO_CONSULTA_ANEXO_MS);
    return () => {
      cancelado = true;
      window.clearInterval(timer);
    };
  }, [empresa, estado, id]);

  const visivel = lido ?? { nome, tipo, formato, estado };
  return (
    <CartaoDocumentoConversa
      nome={visivel.nome}
      tipo={visivel.tipo}
      formato={visivel.formato}
      estado={visivel.estado}
      id={id}
      leituraDemorada={demorou && visivel.estado === "processando"}
    />
  );
}
