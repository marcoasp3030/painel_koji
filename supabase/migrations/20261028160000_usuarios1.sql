-- USUARIOS1: papéis por permissão e unidades por usuário.
-- Não altera a conta admin@luxtia.local.

CREATE TABLE public.permissoes (
  codigo text PRIMARY KEY,
  grupo text NOT NULL,
  descricao text NOT NULL
);

CREATE TABLE public.papeis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nome text NOT NULL,
  nivel integer NOT NULL,
  sistema boolean NOT NULL DEFAULT false,
  escopo_unidades text NOT NULL DEFAULT 'lista' CHECK (escopo_unidades IN ('todas', 'lista')),
  papel_gateway text NOT NULL CHECK (papel_gateway IN ('plataforma', 'gestor', 'supervisor', 'funcionario')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);

CREATE UNIQUE INDEX papeis_sistema_codigo ON public.papeis (codigo) WHERE empresa_id IS NULL;

CREATE TABLE public.papel_permissoes (
  papel_id uuid NOT NULL REFERENCES public.papeis(id) ON DELETE CASCADE,
  permissao_codigo text NOT NULL REFERENCES public.permissoes(codigo),
  PRIMARY KEY (papel_id, permissao_codigo)
);

CREATE TABLE public.usuario_unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_user_id uuid NOT NULL REFERENCES public.tenant_users(id) ON DELETE CASCADE,
  unidade_codigo text NOT NULL CHECK (unidade_codigo ~ '^[a-z0-9_]{1,40}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_user_id, unidade_codigo)
);

ALTER TABLE public.tenant_users
  ADD COLUMN papel_id uuid REFERENCES public.papeis(id),
  ADD COLUMN ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN convidado_em timestamptz;

CREATE TABLE public.conta_seguranca (
  user_id uuid PRIMARY KEY,
  prazo_ate timestamptz,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.permissoes, public.papeis, public.papel_permissoes TO authenticated;
GRANT ALL ON public.permissoes, public.papeis, public.papel_permissoes, public.usuario_unidades, public.conta_seguranca TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuario_unidades, public.conta_seguranca TO authenticated;

ALTER TABLE public.permissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.papeis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.papel_permissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conta_seguranca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leitura das permissoes" ON public.permissoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "leitura dos papeis" ON public.papeis FOR SELECT TO authenticated USING (true);
CREATE POLICY "leitura das permissoes do papel" ON public.papel_permissoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "super admin gere unidades" ON public.usuario_unidades FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "membro le as proprias unidades" ON public.usuario_unidades FOR SELECT TO authenticated
  USING (tenant_user_id IN (SELECT id FROM public.tenant_users WHERE user_id = auth.uid()));
CREATE POLICY "a propria seguranca" ON public.conta_seguranca FOR SELECT TO authenticated
  USING (user_id = auth.uid());

INSERT INTO public.permissoes (codigo, grupo, descricao) VALUES
  ('pedidos.operar', 'Pedidos', 'Ver, mudar status, aceitar e recusar'),
  ('pedidos.cancelar_confirmado', 'Pedidos', 'Cancelar pedido já confirmado, com motivo'),
  ('cardapio.esgotar', 'Cardápio', 'Esgotado hoje e repor'),
  ('cardapio.disponibilidade', 'Cardápio', 'Disponibilidade e horários do item'),
  ('cardapio.editar', 'Cardápio', 'Criar, preço e apagar'),
  ('conversas.operar', 'Conversas', 'Ver e assumir'),
  ('conversas.encerrar', 'Conversas', 'Pausar robô, transferir e encerrar'),
  ('unidade.operar', 'Unidade', 'Pausar loja e horário especial'),
  ('historico.ver', 'Histórico', 'Histórico nas unidades do escopo'),
  ('agente.ver', 'Agente', 'Ver o comportamento'),
  ('agente.editar', 'Agente', 'Editar o rascunho e publicar'),
  ('simular', 'Agente', 'Simular conversa'),
  ('avisos', 'Pedidos', 'Avisos de pedido'),
  ('documentos', 'Documentos', 'Documentos'),
  ('canais.editar', 'Canais', 'Editar canais'),
  ('integracoes.gerir', 'Integrações', 'Integrações, chaves, webhooks, iFood e 99Food'),
  ('usuarios.funcionario', 'Usuários', 'Convidar funcionário nas próprias unidades'),
  ('usuarios.gerir', 'Usuários', 'Convidar gestor, supervisor e funcionário'),
  ('followup.cancelar', 'Follow-up', 'Cancelar follow-up'),
  ('followup.reativar', 'Follow-up', 'Reativar opt-out'),
  ('telefone.completo', 'Cliente', 'Ver o telefone completo'),
  ('relatorios.exportar', 'Relatórios', 'Exportar'),
  ('tecnico', 'Técnico', 'Envio, piloto, Skyone e limites');

INSERT INTO public.papeis (codigo, nome, nivel, sistema, escopo_unidades, papel_gateway) VALUES
  ('plataforma', 'Plataforma', 40, true, 'todas', 'plataforma'),
  ('gestor', 'Gestor', 30, true, 'todas', 'gestor'),
  ('supervisor', 'Supervisor', 20, true, 'lista', 'supervisor'),
  ('funcionario', 'Funcionário', 10, true, 'lista', 'funcionario');

INSERT INTO public.papel_permissoes (papel_id, permissao_codigo)
SELECT p.id, x.codigo
FROM public.papeis p
JOIN (
  VALUES
    ('funcionario', 'pedidos.operar'),
    ('funcionario', 'cardapio.esgotar'),
    ('funcionario', 'conversas.operar'),
    ('funcionario', 'historico.ver'),
    ('supervisor', 'pedidos.operar'),
    ('supervisor', 'cardapio.esgotar'),
    ('supervisor', 'conversas.operar'),
    ('supervisor', 'historico.ver'),
    ('supervisor', 'pedidos.cancelar_confirmado'),
    ('supervisor', 'cardapio.disponibilidade'),
    ('supervisor', 'conversas.encerrar'),
    ('supervisor', 'unidade.operar'),
    ('supervisor', 'agente.ver'),
    ('supervisor', 'simular'),
    ('supervisor', 'avisos'),
    ('supervisor', 'usuarios.funcionario'),
    ('supervisor', 'followup.cancelar'),
    ('supervisor', 'telefone.completo'),
    ('gestor', 'pedidos.operar'),
    ('gestor', 'cardapio.esgotar'),
    ('gestor', 'conversas.operar'),
    ('gestor', 'historico.ver'),
    ('gestor', 'pedidos.cancelar_confirmado'),
    ('gestor', 'cardapio.disponibilidade'),
    ('gestor', 'conversas.encerrar'),
    ('gestor', 'unidade.operar'),
    ('gestor', 'agente.ver'),
    ('gestor', 'simular'),
    ('gestor', 'avisos'),
    ('gestor', 'usuarios.funcionario'),
    ('gestor', 'followup.cancelar'),
    ('gestor', 'telefone.completo'),
    ('gestor', 'cardapio.editar'),
    ('gestor', 'relatorios.exportar'),
    ('gestor', 'usuarios.gerir'),
    ('gestor', 'agente.editar'),
    ('gestor', 'integracoes.gerir'),
    ('gestor', 'documentos'),
    ('gestor', 'canais.editar'),
    ('gestor', 'followup.reativar')
) AS x(papel, codigo) ON x.papel = p.codigo
WHERE p.empresa_id IS NULL;

-- Vínculo de empresa que já era administrador aponta para o papel gestor.
-- Quem é super_admin continua plataforma na sessão; o vínculo não muda o X-Role.
UPDATE public.tenant_users tu
SET papel_id = (SELECT id FROM public.papeis WHERE codigo = 'gestor' AND empresa_id IS NULL)
WHERE tu.is_tenant_admin AND tu.papel_id IS NULL;

UPDATE public.tenant_users tu
SET papel_id = (SELECT id FROM public.papeis WHERE codigo = 'funcionario' AND empresa_id IS NULL)
WHERE NOT tu.is_tenant_admin AND tu.papel_id IS NULL;

-- César: tenant_admin órfão, sem empresa. A conta permanece.
INSERT INTO public.audit_logs (actor_email, action, target, status, detail)
SELECT 'sistema', 'Remoção de papel órfão', u.email, 'success',
       'Papel tenant_admin sem empresa. A conta permanece.'
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id AND ur.role = 'tenant_admin'
WHERE u.email = 'cesar.almeida@ticway.com.br'
  AND NOT EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.user_id = u.id);

DELETE FROM public.user_roles ur
USING auth.users u
WHERE ur.user_id = u.id
  AND ur.role = 'tenant_admin'
  AND u.email = 'cesar.almeida@ticway.com.br'
  AND NOT EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.user_id = u.id);

CREATE OR REPLACE FUNCTION public.fatores_verificados(uid uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT count(*)::integer FROM auth.mfa_factors
  WHERE user_id = uid AND status = 'verified'
$$;

CREATE OR REPLACE FUNCTION public.derrubar_sessoes(uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  DELETE FROM auth.refresh_tokens WHERE user_id = uid::text;
  DELETE FROM auth.sessions WHERE user_id = uid;
END
$$;

REVOKE ALL ON FUNCTION public.fatores_verificados(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.derrubar_sessoes(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fatores_verificados(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.derrubar_sessoes(uuid) TO service_role;

-- E-mail já cadastrado: o convite reaproveita a conta, sem devolver o link.
CREATE OR REPLACE FUNCTION public.usuario_id_por_email(alvo text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(alvo) LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.usuario_id_por_email(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.usuario_id_por_email(text) TO service_role;
