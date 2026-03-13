export const config = {
  wip: {
    baseUrl: import.meta.env.VITE_WIP_BASE_URL as string || window.location.origin,
    apiKey: import.meta.env.VITE_WIP_API_KEY as string || '',
  },
  basePath: import.meta.env.VITE_BASE_PATH as string || '/apps/statements',

  templates: {
    ACCOUNT: 'FIN_ACCOUNT',
    TRANSACTION: 'FIN_TRANSACTION',
    PAYSLIP: 'FIN_PAYSLIP',
    PAYSLIP_LINE: 'FIN_PAYSLIP_LINE',
  },

  templateIds: {
    ACCOUNT: '019ce6e6-327a-7c0f-a546-e6a939f43639',
    TRANSACTION: '019ce6e6-662f-79f7-ac1f-a4336c63fbec',
    PAYSLIP: '019ce6e6-75de-78cd-8940-95553d18c726',
    PAYSLIP_LINE: '019ce6e6-b34a-7530-a2eb-d9f1dec9439f',
    IMPORT: '019ce7f5-7313-7ce4-a58f-ca1bdd02e5ea',
  },

  terminologyIds: {
    CURRENCY: '019ce6e5-9938-741e-bdc8-c793598759c0',
    ACCOUNT_TYPE: '019ce6e5-9fdb-71b1-8d31-c5d42694dc65',
    TRANSACTION_TYPE: '019ce6e5-a2bf-7cb0-9631-4c3834772a9e',
    TRANSACTION_CATEGORY: '019ce6e5-a628-722c-8a0f-25cbd7f4de43',
    PAYSLIP_LINE_CATEGORY: '019ce6e5-a9b0-7242-9f12-89a81e2c241f',
  },
} as const
