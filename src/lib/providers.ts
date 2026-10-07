export type ProviderKey = "ifood" | "food99" | "whatsapp_official" | "uazapi";

export type ProviderField = {
  key: string;
  label: string;
  secret: boolean;
  placeholder?: string;
  /** Texto de ajuda exibido abaixo do campo. */
  help?: string;
  /** Campo que pode ficar em branco sem impedir o teste de conexão. */
  optional?: boolean;
  /** Quando presente, o campo vira uma lista de opções. */
  options?: { value: string; label: string }[];
};

export type ProviderDef = {
  key: ProviderKey;
  name: string;
  category: "Delivery" | "Mensagens";
  description: string;
  fields: ProviderField[];
};

export const PROVIDERS: ProviderDef[] = [
  {
    key: "ifood",
    name: "iFood",
    category: "Delivery",
    description: "Pedidos e cardápio das lojas conectadas ao iFood.",
    fields: [
      { key: "client_id", label: "Client ID", secret: false },
      { key: "client_secret", label: "Client Secret", secret: true },
      { key: "merchant_id", label: "ID da loja (merchant)", secret: false },
    ],
  },
  {
    key: "food99",
    name: "99Food",
    category: "Delivery",
    description: "Pedidos das lojas conectadas ao 99Food.",
    fields: [
      {
        key: "app_id",
        label: "App ID",
        secret: false,
        placeholder: "Ex.: 1029384756",
        help: "Identificador público da aplicação. No portal de desenvolvedores da 99Food, abra Minhas aplicações e copie o App ID da aplicação criada.",
      },
      {
        key: "app_secret",
        label: "App Secret",
        secret: true,
        help: "Chave secreta da mesma aplicação, mostrada ao lado do App ID no portal de desenvolvedores. É exibida uma única vez na criação; se perder, gere uma nova.",
      },
      {
        key: "shop_id",
        label: "Shop ID (ID da Loja)",
        secret: false,
        placeholder: "Ex.: 88123456",
        help: "Identificador do restaurante na 99Food. Encontra-se no painel do parceiro, em Configurações da loja, ou na lista de lojas vinculadas à sua aplicação.",
      },
      {
        key: "app_shop_id",
        label: "APP Shop ID",
        secret: false,
        placeholder: "Ex.: luxtia_sp_001",
        help: "Identificador único da loja no seu sistema, vinculado à aplicação no portal da 99Food. É obrigatório para obter o Auth Token e não é o Shop ID numérico.",
      },
      {
        key: "environment",
        label: "Ambiente",
        secret: false,
        optional: true,
        options: [
          { value: "sandbox", label: "Ambiente de teste (sandbox)" },
          { value: "production", label: "Produção" },
        ],
        help: "Identifica se a vinculação está em teste ou produção. A API oficial usa o mesmo endereço nos dois casos.",
      },
    ],
  },
  {
    key: "whatsapp_official",
    name: "WhatsApp API Oficial",
    category: "Mensagens",
    description: "Envio e recebimento pela API oficial da Meta.",
    fields: [
      { key: "phone_number_id", label: "ID do número", secret: false },
      { key: "business_account_id", label: "ID da conta comercial", secret: false },
      { key: "access_token", label: "Token de acesso", secret: true },
      { key: "verify_token", label: "Token de verificação", secret: true },
    ],
  },
  {
    key: "uazapi",
    name: "Uazapi",
    category: "Mensagens",
    description: "Instância Uazapi para WhatsApp não oficial.",
    fields: [
      { key: "instance_url", label: "URL da instância", secret: false, placeholder: "https://" },
      { key: "instance_name", label: "Nome da instância", secret: false },
      { key: "token", label: "Token", secret: true },
    ],
  },
];

export const PROVIDER_BY_KEY = Object.fromEntries(PROVIDERS.map((p) => [p.key, p])) as Record<
  ProviderKey,
  ProviderDef
>;
